// SPDX-License-Identifier: MIT
pragma solidity >=0.8.18 <0.9.0;

import {FHE, euint64, ebool} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title NegotiationRoom — Zero-Knowledge ZOPA Detection
/// @notice Two parties submit encrypted reservation prices. FHE determines
///         whether a Zone of Possible Agreement exists and computes the
///         midpoint — without revealing either party's actual number.
contract NegotiationRoom {
    // ── State ──────────────────────────────────────────────────────

    address public partyA;
    address public partyB;
    string public context;

    bool public aSubmitted;
    bool public bSubmitted;
    bool public resolved;

    /// @dev Encrypted reservation prices — never decrypted individually
    euint64 private encMinA; // A's floor (minimum acceptable)
    euint64 private encMaxB; // B's ceiling (maximum willing to pay)

    /// @dev Encrypted results — decryptable only via threshold network
    ebool private encZopaExists;
    euint64 private encResult; // midpoint if deal, 0 if no deal

    /// @dev Plaintext results — set after threshold decryption
    bool public dealExists;
    uint256 public revealedSplit;

    // ── Events ─────────────────────────────────────────────────────

    event PartySubmitted(address indexed party);
    event DealFound(uint256 splitPoint);
    event NoDeal();

    // ── Constructor ────────────────────────────────────────────────

    constructor(address _partyA, address _partyB, string memory _context) {
        partyA = _partyA;
        partyB = _partyB;
        context = _context;
    }

    // ── Modifiers ──────────────────────────────────────────────────

    modifier onlyParty() {
        require(msg.sender == partyA || msg.sender == partyB, "Not a party");
        _;
    }

    modifier notResolved() {
        require(!resolved, "Already resolved");
        _;
    }

    // ── Submit Reservation Price ───────────────────────────────────
    /// @notice Submit your reservation price. Value is trivially encrypted
    ///         on-chain for mock testing; production uses InEuint64 calldata.
    /// @param amount The reservation price (A's floor or B's ceiling)
    function submitReservation(uint256 amount) external onlyParty notResolved {
        if (msg.sender == partyA) {
            require(!aSubmitted, "A already submitted");
            encMinA = FHE.asEuint64(amount);
            aSubmitted = true;
            FHE.allowThis(encMinA);
            FHE.allow(encMinA, partyA);
        } else {
            require(!bSubmitted, "B already submitted");
            encMaxB = FHE.asEuint64(amount);
            bSubmitted = true;
            FHE.allowThis(encMaxB);
            FHE.allow(encMaxB, partyB);
        }

        emit PartySubmitted(msg.sender);

        if (aSubmitted && bSubmitted) {
            _resolve();
        }
    }

    // ── Core FHE Logic ─────────────────────────────────────────────
    /// @dev Determines ZOPA existence and computes midpoint on ciphertexts.
    ///      Neither reservation price is ever decrypted.
    function _resolve() internal {
        // ZOPA check: is A's floor <= B's ceiling?
        ebool zopaExists = FHE.lte(encMinA, encMaxB);
        FHE.allowThis(zopaExists);

        // Midpoint = (minA + maxB) / 2 — entirely on ciphertexts
        euint64 encSum = FHE.add(encMinA, encMaxB);
        FHE.allowThis(encSum);

        euint64 encTwo = FHE.asEuint64(2);
        FHE.allowThis(encTwo);

        euint64 encMidpoint = FHE.div(encSum, encTwo);
        FHE.allowThis(encMidpoint);

        // If ZOPA → reveal midpoint; if no ZOPA → reveal 0 (nothing meaningful)
        euint64 zeroValue = FHE.asEuint64(0);
        FHE.allowThis(zeroValue);

        encResult = FHE.select(zopaExists, encMidpoint, zeroValue);
        FHE.allowThis(encResult);

        encZopaExists = zopaExists;

        // Allow threshold network to decrypt only the results
        FHE.allowPublic(encZopaExists);
        FHE.allowPublic(encResult);

        resolved = true;
    }

    // ── View Functions for SDK Decryption ───────────────────────────

    /// @notice Returns the encrypted result handle for client-side decryption
    function getEncryptedResult() external view returns (euint64) {
        require(resolved, "Not resolved yet");
        return encResult;
    }

    /// @notice Returns the encrypted ZOPA boolean for client-side decryption
    function getEncryptedZopa() external view returns (ebool) {
        require(resolved, "Not resolved yet");
        return encZopaExists;
    }

    // ── Publish Threshold-Decrypted Results ─────────────────────────
    /// @notice Called after CoFHE SDK runs decryptForTx off-chain.
    ///         Verifies threshold signatures and publishes plaintext results.
    function publishResults(
        ebool zopaCtHash,
        bool zopaBool,
        bytes calldata zopaSignature,
        euint64 resultCtHash,
        uint64 resultPlaintext,
        bytes calldata resultSignature
    ) external {
        require(resolved, "Not resolved yet");

        FHE.publishDecryptResult(zopaCtHash, zopaBool, zopaSignature);
        FHE.publishDecryptResult(resultCtHash, resultPlaintext, resultSignature);

        dealExists = zopaBool;
        revealedSplit = uint256(resultPlaintext);

        if (zopaBool) {
            emit DealFound(resultPlaintext);
        } else {
            emit NoDeal();
        }
    }
}
