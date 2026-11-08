// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VVUAnchor — On-chain WORM Merkle Root Anchor + Circuit Breaker
/// @notice Immutable, append-only anchor for VVU WORM chain heads and Merkle roots.
/// @dev Conservative execution: no upgradability, no external calls, minimal gas.
///      Every anchor is a single SSTORE + event emission. Fail-closed: only the
///      registered operator can anchor. No admin keys, no pause, no upgrade.
///      Circuit breaker: on-chain slash function invalidates anchors that trip
///      the Bayesian confidence threshold. Slashed anchors are permanently marked.
contract VVUAnchor {
    // ─── Events ────────────────────────────────────────────────────────────
    event MerkleRootAnchored(
        bytes32 indexed streamId,
        bytes32 rootHash,
        uint256 entryCount,
        uint256 anchoredAt
    );

    event WormHeadAnchored(
        bytes32 indexed streamId,
        bytes32 headHash,
        uint256 seq,
        uint256 anchoredAt
    );

    event CesiumIOBRenderReceipt(
        bytes32 indexed streamId,
        bytes32 assetHash,
        bytes32 renderHash,
        uint256 gasUsed,
        uint256 anchoredAt
    );

    event OperatorRegistered(address indexed operator, bytes32 indexed streamId);

    event CircuitBreakerTripped(
        bytes32 indexed streamId,
        bytes32 indexed anchorHash,
        uint256 confidenceMilli,  // confidence * 1000 (e.g. 950 = 0.950)
        uint256 thresholdMilli,   // threshold * 1000
        uint256 trippedAt
    );

    event AnchorSlashed(
        bytes32 indexed streamId,
        bytes32 indexed anchorHash,
        string reason,
        uint256 slashedAt
    );

    // ─── Storage ───────────────────────────────────────────────────────────
    mapping(bytes32 => bytes32) public merkleRoots;
    mapping(bytes32 => bytes32) public wormHeads;
    mapping(bytes32 => uint256) public wormSeqs;
    mapping(bytes32 => address) public operators;
    mapping(bytes32 => bool) public initialized;

    // Circuit breaker state
    mapping(bytes32 => mapping(bytes32 => bool)) public slashed; // streamId => anchorHash => slashed
    mapping(bytes32 => uint256) public slashCount; // streamId => number of slashed anchors
    mapping(bytes32 => uint256) public confidenceThresholdMilli; // streamId => threshold * 1000 (default 950)

    // ─── Errors ────────────────────────────────────────────────────────────
    error NotOperator(bytes32 streamId, address caller);
    error AlreadyAnchored(bytes32 streamId);
    error ZeroHash();
    error ZeroStreamId();
    error AlreadySlashed(bytes32 streamId, bytes32 anchorHash);
    error InvalidThreshold(uint256 thresholdMilli);

    // ─── Modifiers ─────────────────────────────────────────────────────────
    modifier onlyOperator(bytes32 streamId) {
        if (operators[streamId] != address(0) && msg.sender != operators[streamId]) {
            revert NotOperator(streamId, msg.sender);
        }
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────
    constructor(bytes32 streamId, address operator) {
        if (streamId == bytes32(0)) revert ZeroStreamId();
        operators[streamId] = operator;
        confidenceThresholdMilli[streamId] = 950; // default 0.950
        emit OperatorRegistered(operator, streamId);
    }

    // ─── Registration ──────────────────────────────────────────────────────
    function registerStream(bytes32 streamId, address operator) external {
        if (streamId == bytes32(0)) revert ZeroStreamId();
        if (operators[streamId] != address(0)) revert AlreadyAnchored(streamId);
        operators[streamId] = operator;
        confidenceThresholdMilli[streamId] = 950; // default 0.950
        emit OperatorRegistered(operator, streamId);
    }

    // ─── Anchoring ─────────────────────────────────────────────────────────
    function anchorMerkleRoot(
        bytes32 streamId,
        bytes32 rootHash,
        uint256 entryCount
    ) external onlyOperator(streamId) {
        if (streamId == bytes32(0)) revert ZeroStreamId();
        if (rootHash == bytes32(0)) revert ZeroHash();
        merkleRoots[streamId] = rootHash;
        initialized[streamId] = true;
        emit MerkleRootAnchored(streamId, rootHash, entryCount, block.timestamp);
    }

    function anchorWormHead(
        bytes32 streamId,
        bytes32 headHash,
        uint256 seq
    ) external onlyOperator(streamId) {
        if (streamId == bytes32(0)) revert ZeroStreamId();
        if (headHash == bytes32(0)) revert ZeroHash();
        wormHeads[streamId] = headHash;
        wormSeqs[streamId] = seq;
        initialized[streamId] = true;
        emit WormHeadAnchored(streamId, headHash, seq, block.timestamp);
    }

    function recordCesiumIOBRender(
        bytes32 streamId,
        bytes32 assetHash,
        bytes32 renderHash
    ) external onlyOperator(streamId) {
        if (streamId == bytes32(0)) revert ZeroStreamId();
        if (assetHash == bytes32(0)) revert ZeroHash();
        if (renderHash == bytes32(0)) revert ZeroHash();
        emit CesiumIOBRenderReceipt(streamId, assetHash, renderHash, gasleft(), block.timestamp);
    }

    // ─── Circuit Breaker ───────────────────────────────────────────────────
    /// @notice Set the confidence threshold for a stream (in milli units, e.g. 950 = 0.950)
    /// @dev Only operator can change threshold. Default is 950 (0.950).
    function setConfidenceThreshold(bytes32 streamId, uint256 thresholdMilli) external onlyOperator(streamId) {
        if (thresholdMilli == 0 || thresholdMilli > 1000) revert InvalidThreshold(thresholdMilli);
        confidenceThresholdMilli[streamId] = thresholdMilli;
    }

    /// @notice Trip the circuit breaker: slash an anchor that failed the confidence threshold.
    /// @dev Called by the operator when Beta-Binomial Bayesian inference determines
    ///      that confidence < threshold. The anchor is permanently marked as slashed.
    ///      Gas: ~20k (SSTORE) + event. ~25k total.
    function tripCircuitBreaker(
        bytes32 streamId,
        bytes32 anchorHash,
        uint256 confidenceMilli
    ) external onlyOperator(streamId) {
        if (streamId == bytes32(0)) revert ZeroStreamId();
        if (anchorHash == bytes32(0)) revert ZeroHash();
        if (slashed[streamId][anchorHash]) revert AlreadySlashed(streamId, anchorHash);

        uint256 threshold = confidenceThresholdMilli[streamId];
        if (threshold == 0) threshold = 950; // fallback to default

        slashed[streamId][anchorHash] = true;
        slashCount[streamId]++;

        emit CircuitBreakerTripped(streamId, anchorHash, confidenceMilli, threshold, block.timestamp);
        emit AnchorSlashed(streamId, anchorHash, "CONFIDENCE_BELOW_THRESHOLD", block.timestamp);
    }

    /// @notice Check if an anchor has been slashed.
    function isSlashed(bytes32 streamId, bytes32 anchorHash) external view returns (bool) {
        return slashed[streamId][anchorHash];
    }

    /// @notice Get the confidence threshold for a stream.
    function getThreshold(bytes32 streamId) external view returns (uint256) {
        uint256 t = confidenceThresholdMilli[streamId];
        return t == 0 ? 950 : t;
    }

    // ─── View functions ─────────────────────────────────────────────────────
    function getMerkleRoot(bytes32 streamId) external view returns (bytes32) {
        return merkleRoots[streamId];
    }

    function getWormHead(bytes32 streamId) external view returns (bytes32 head, uint256 seq) {
        return (wormHeads[streamId], wormSeqs[streamId]);
    }

    function isInitialized(bytes32 streamId) external view returns (bool) {
        return initialized[streamId];
    }

    function getSlashCount(bytes32 streamId) external view returns (uint256) {
        return slashCount[streamId];
    }
}
