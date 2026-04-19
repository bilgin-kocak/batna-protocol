// SPDX-License-Identifier: MIT
pragma solidity >=0.8.18 <0.9.0;

import {FHE, euint64, ebool, InEuint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title NegotiationRoom — Encrypted ZOPA Detection
/// @notice Two parties submit encrypted reservation prices via CoFHE SDK.
///         FHE determines whether a Zone of Possible Agreement exists and
///         computes the midpoint — without revealing either party's actual number.
///
///         Wave 2.1 hardening:
///         - `context` is a keccak256 hash, not plaintext. The human-readable
///           context lives off-chain (localStorage / backend DB / IPFS), so
///           sensitive metadata like employer names and deal memos never
///           appear on-chain.
///         - `RoomStatus` lifecycle: OPEN → (RESOLVED | EXPIRED | CANCELLED).
///           `expireRoom()` lets either party reclaim a stalled room past the
///           deadline; `cancelRoom()` lets a party abort before any submission.
///         - `AgentSubmission` event carries structured provenance
///           (templateId, contextHash, modelHash, promptVersionHash) so the AI
///           claim is auditable, not marketing.
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

    /// @notice Room lifecycle. Only OPEN can accept submissions. RESOLVED is
    ///         terminal once both parties submit. EXPIRED / CANCELLED are
    ///         terminal without a settlement — they unlock a path for the
    ///         frontend to stop polling and for any escrow logic to refund.
    enum RoomStatus {
        OPEN,
        RESOLVED,
        EXPIRED,
        CANCELLED
    }

    /// @notice Structured provenance for agent-derived submissions. Recorded
    ///         in the `AgentSubmission` event so any observer can later prove
    ///         which template + model + prompt produced a given reservation.
    struct AgentProvenance {
        uint8 templateId; // mirrors NegotiationType; stored per-submission
        bytes32 contextHash; // keccak256 of the free-form context the agent read
        bytes32 modelHash; // keccak256("claude-opus-4-6") or similar
        bytes32 promptVersionHash; // keccak256 of the prompt template version id
    }

    // ── State ──────────────────────────────────────────────────────

    address public partyA;
    address public partyB;
    address public auditor; // optional: can decrypt result but never individual inputs

    /// @notice keccak256 hash of the negotiation context. Plaintext lives off-chain.
    bytes32 public contextHash;

    uint8 public weightA; // 0-100: weight for partyA's value in settlement (50 = equal midpoint)
    uint256 public deadline; // unix timestamp; 0 = no deadline
    NegotiationType public negotiationType;
    RoomStatus public status;

    bool public aSubmitted;
    bool public bSubmitted;
    /// @dev Retained for backward compatibility with Wave 2 frontend/API code.
    ///      Mirrors `status == RoomStatus.RESOLVED`.
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
    ///         derived the price. `templateId`, `contextHash`, `modelHash`, and
    ///         `promptVersionHash` form the auditable provenance of the derivation.
    event AgentSubmission(
        address indexed party,
        address indexed agent,
        uint8 templateId,
        bytes32 contextHash,
        bytes32 modelHash,
        bytes32 promptVersionHash
    );
    event DealFound(uint256 splitPoint);
    event NoDeal();
    event RoomExpired(address indexed triggeredBy);
    event RoomCancelled(address indexed cancelledBy);

    // ── Constructor ────────────────────────────────────────────────

    constructor(
        address _partyA,
        address _partyB,
        bytes32 _contextHash,
        uint8 _weightA,
        address _auditor,
        uint256 _deadline,
        NegotiationType _negotiationType
    ) {
        require(_weightA <= 100, "Weight must be 0-100");
        partyA = _partyA;
        partyB = _partyB;
        contextHash = _contextHash;
        weightA = _weightA;
        auditor = _auditor; // address(0) = no auditor
        deadline = _deadline; // 0 = no deadline
        negotiationType = _negotiationType;
        status = RoomStatus.OPEN;
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

    modifier onlyOpen() {
        require(status == RoomStatus.OPEN, "Room not open");
        _;
    }

    // ── Submit Reservation Price ───────────────────────────────────
    /// @notice Submit your reservation price encrypted client-side via CoFHE SDK.
    ///         The plaintext never touches the contract or calldata.
    /// @param encryptedAmount The encrypted reservation price (InEuint64 from client)
    function submitReservation(InEuint64 calldata encryptedAmount)
        external
        onlyParty
        onlyOpen
        notExpired
    {
        _submit(encryptedAmount);
    }

    /// @notice Submit a reservation price derived by an AI agent. The party still
    ///         signs the tx (msg.sender == partyA/partyB), so custody never leaves
    ///         the party. `agent` is recorded for on-chain provenance alongside
    ///         the structured `provenance` fields.
    /// @param encryptedAmount The encrypted reservation price (InEuint64 from client)
    /// @param agent           The address that derived the price (e.g., agent service wallet)
    /// @param provenance      Structured provenance for the AI derivation
    function submitReservationAsAgent(
        InEuint64 calldata encryptedAmount,
        address agent,
        AgentProvenance calldata provenance
    ) external onlyParty onlyOpen notExpired {
        _submit(encryptedAmount);
        emit AgentSubmission(
            msg.sender,
            agent,
            provenance.templateId,
            provenance.contextHash,
            provenance.modelHash,
            provenance.promptVersionHash
        );
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

    // ── Lifecycle Transitions ──────────────────────────────────────

    /// @notice Marks the room EXPIRED once the deadline has passed without both
    ///         sides submitting. Callable by either party — first to notice it
    ///         can reclaim the room (and any off-chain escrow flows). No-op on
    ///         rooms with deadline == 0.
    function expireRoom() external onlyParty onlyOpen {
        require(deadline > 0, "No deadline set");
        require(block.timestamp > deadline, "Deadline not passed");
        status = RoomStatus.EXPIRED;
        emit RoomExpired(msg.sender);
    }

    /// @notice Allows either party to cancel the room before any encrypted
    ///         reservation has been submitted. After the first submission
    ///         ciphertexts exist with ACL grants, so cancellation is disabled.
    function cancelRoom() external onlyParty onlyOpen {
        require(!aSubmitted && !bSubmitted, "Submission already made");
        status = RoomStatus.CANCELLED;
        emit RoomCancelled(msg.sender);
    }

    // ── Core FHE Logic ─────────────────────────────────────────────
    /// @dev Determines ZOPA existence and computes settlement on ciphertexts.
    ///      Settlement = (minA * weightA + maxB * (100 - weightA)) / 100
    ///      When weightA=50, this equals the simple midpoint (minA + maxB) / 2.
    ///      Neither reservation price is ever decrypted.
    ///
    ///      SAFE VALUE RANGE (overflow analysis of the euint64 math):
    ///      The intermediate products minA*weightA + maxB*weightB must fit
    ///      in euint64. Since weightA + weightB = 100, the worst case is
    ///      max(minA, maxB) * 100. Safe when both reservation prices are
    ///      strictly below  type(uint64).max / 100  ≈ 1.84e17.
    ///      For reference: $1 quadrillion in cents = 1e17 (still safe).
    ///      Any realistic salary / OTC / M&A deal size is comfortably inside.
    ///      FHE cannot bounds-check encrypted inputs without decrypting them,
    ///      so the safe range is a client-side contract with callers.
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

        // Confidential auditability — PRIVACY INVARIANT:
        //   The auditor is allowed to decrypt ONLY the final settlement result
        //   (`encResult`) and the ZOPA existence bit (`encZopaExists`).
        //
        //   The auditor is NEVER granted access to `encMinA` or `encMaxB` —
        //   the individual reservation prices stay sealed even under audit.
        //
        //   This invariant is verified on-chain by `auditorAccess()` below
        //   and asserted in `test/NegotiationRoom.test.ts` after resolution.
        if (auditor != address(0)) {
            FHE.allow(encZopaExists, auditor);
            FHE.allow(encResult, auditor);
            // (intentionally NO allow() calls for encMinA / encMaxB)
        }

        resolved = true;
        status = RoomStatus.RESOLVED;
    }

    /// @notice ACL inspection for the configured auditor. Returns whether each
    ///         encrypted field is decryptable by the auditor address.
    /// @dev    Privacy invariant: `canSeeMinA` and `canSeeMaxB` MUST always be
    ///         false when an auditor is set. Only `canSeeResult` and
    ///         `canSeeZopa` are granted. Testable form of the invariant —
    ///         call via staticCall in unit tests to assert the boundary.
    /// @return canSeeMinA   true iff auditor can decrypt partyA's floor (MUST be false)
    /// @return canSeeMaxB   true iff auditor can decrypt partyB's ceiling (MUST be false)
    /// @return canSeeResult true iff auditor can decrypt the settlement result
    /// @return canSeeZopa   true iff auditor can decrypt the ZOPA existence bit
    function auditorAccess()
        external
        returns (bool canSeeMinA, bool canSeeMaxB, bool canSeeResult, bool canSeeZopa)
    {
        if (auditor == address(0)) {
            return (false, false, false, false);
        }
        return (
            FHE.isAllowed(encMinA, auditor),
            FHE.isAllowed(encMaxB, auditor),
            FHE.isAllowed(encResult, auditor),
            FHE.isAllowed(encZopaExists, auditor)
        );
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
