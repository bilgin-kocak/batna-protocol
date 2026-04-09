// SPDX-License-Identifier: MIT
pragma solidity >=0.8.18 <0.9.0;

import {FHE, euint64, ebool, InEuint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title NegotiationRoom — Encrypted ZOPA Detection
/// @notice Two parties submit encrypted reservation prices via CoFHE SDK.
///         FHE determines whether a Zone of Possible Agreement exists and
///         computes the midpoint — without revealing either party's actual number.
contract NegotiationRoom {
    // ── Types ──────────────────────────────────────────────────────

    /// @notice Categorizes the deal so frontends can route to type-specific UX.
    ///         Stored as plaintext metadata — not part of the FHE computation.
    enum NegotiationType {
        GENERIC,
        SALARY,
        OTC,
        MA
    }

    // ── State ──────────────────────────────────────────────────────

    address public partyA;
    address public partyB;
    address public auditor; // optional: can decrypt result but never individual inputs
    string public context;
    uint8 public weightA; // 0-100: weight for partyA's value in settlement (50 = equal midpoint)
    uint256 public deadline; // unix timestamp; 0 = no deadline
    NegotiationType public negotiationType;

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
    /// @notice Emitted when an AI agent (rather than the party themselves) submits.
    ///         The party (partyA/partyB) signs the tx; `agent` records which agent
    ///         derived the price. Lets on-chain history distinguish agent vs human.
    event AgentSubmission(address indexed party, address indexed agent);
    event DealFound(uint256 splitPoint);
    event NoDeal();

    // ── Constructor ────────────────────────────────────────────────

    constructor(
        address _partyA,
        address _partyB,
        string memory _context,
        uint8 _weightA,
        address _auditor,
        uint256 _deadline,
        NegotiationType _negotiationType
    ) {
        require(_weightA <= 100, "Weight must be 0-100");
        partyA = _partyA;
        partyB = _partyB;
        context = _context;
        weightA = _weightA;
        auditor = _auditor; // address(0) = no auditor
        deadline = _deadline; // 0 = no deadline
        negotiationType = _negotiationType;
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

    modifier notExpired() {
        require(deadline == 0 || block.timestamp <= deadline, "Negotiation expired");
        _;
    }

    // ── Submit Reservation Price ───────────────────────────────────
    /// @notice Submit your reservation price encrypted client-side via CoFHE SDK.
    ///         The plaintext never touches the contract or calldata.
    /// @param encryptedAmount The encrypted reservation price (InEuint64 from client)
    function submitReservation(InEuint64 calldata encryptedAmount) external onlyParty notResolved notExpired {
        _submit(encryptedAmount);
    }

    /// @notice Submit a reservation price derived by an AI agent. The party still
    ///         signs the tx (msg.sender == partyA/partyB), so custody never leaves
    ///         the party. `agent` is recorded for on-chain provenance.
    /// @param encryptedAmount The encrypted reservation price (InEuint64 from client)
    /// @param agent The address that derived the price (e.g., agent service wallet)
    function submitReservationAsAgent(
        InEuint64 calldata encryptedAmount,
        address agent
    ) external onlyParty notResolved notExpired {
        _submit(encryptedAmount);
        emit AgentSubmission(msg.sender, agent);
    }

    /// @dev Shared submission logic. calldata params can flow into internal funcs.
    function _submit(InEuint64 calldata encryptedAmount) internal {
        if (msg.sender == partyA) {
            require(!aSubmitted, "A already submitted");
            encMinA = FHE.asEuint64(encryptedAmount);
            aSubmitted = true;
            FHE.allowThis(encMinA);
            FHE.allow(encMinA, partyA);
        } else {
            require(!bSubmitted, "B already submitted");
            encMaxB = FHE.asEuint64(encryptedAmount);
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
    /// @dev Determines ZOPA existence and computes settlement on ciphertexts.
    ///      Settlement = (minA * weightA + maxB * (100 - weightA)) / 100
    ///      When weightA=50, this equals the simple midpoint (minA + maxB) / 2.
    ///      Neither reservation price is ever decrypted.
    function _resolve() internal {
        // ZOPA check: is A's floor <= B's ceiling?
        ebool zopaExists = FHE.lte(encMinA, encMaxB);
        FHE.allowThis(zopaExists);

        // Weighted settlement — entirely on ciphertexts
        euint64 encWeightA = FHE.asEuint64(uint256(weightA));
        FHE.allowThis(encWeightA);
        euint64 encWeightB = FHE.asEuint64(uint256(100 - weightA));
        FHE.allowThis(encWeightB);

        euint64 weightedA = FHE.mul(encMinA, encWeightA);
        FHE.allowThis(weightedA);
        euint64 weightedB = FHE.mul(encMaxB, encWeightB);
        FHE.allowThis(weightedB);

        euint64 weightedSum = FHE.add(weightedA, weightedB);
        FHE.allowThis(weightedSum);

        euint64 encHundred = FHE.asEuint64(100);
        FHE.allowThis(encHundred);

        euint64 encMidpoint = FHE.div(weightedSum, encHundred);
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

        // Confidential auditability: auditor can decrypt result, never inputs
        if (auditor != address(0)) {
            FHE.allow(encZopaExists, auditor);
            FHE.allow(encResult, auditor);
            // Note: encMinA and encMaxB are NEVER allowed for auditor
        }

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
