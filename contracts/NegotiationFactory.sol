// SPDX-License-Identifier: MIT
pragma solidity >=0.8.18 <0.9.0;

import "./NegotiationRoom.sol";

/// @title NegotiationFactory — Permissionless Room Deployment
/// @notice Deploy negotiation rooms for any bilateral deal.
///         Tracks all rooms and provides lookup by party address.
contract NegotiationFactory {
    address[] private _rooms;
    mapping(address => address[]) private _roomsByParty;

    event RoomCreated(
        address indexed room,
        address indexed partyA,
        address indexed partyB,
        string context
    );

    /// @notice Create a new negotiation room. Caller becomes partyA.
    /// @param partyB The counterparty address
    /// @param context Human-readable description of the negotiation
    /// @param weightA Settlement weight for party A (0-100, 50 = equal midpoint)
    /// @param auditor Optional auditor address that can decrypt result only (address(0) = none)
    /// @param deadline Unix timestamp after which submissions revert (0 = no deadline)
    /// @param negotiationType Category for frontend routing (GENERIC/SALARY/OTC/MA)
    /// @return The deployed room address
    function createRoom(
        address partyB,
        string calldata context,
        uint8 weightA,
        address auditor,
        uint256 deadline,
        NegotiationRoom.NegotiationType negotiationType
    ) external returns (address) {
        NegotiationRoom room = new NegotiationRoom(
            msg.sender,
            partyB,
            context,
            weightA,
            auditor,
            deadline,
            negotiationType
        );

        address roomAddr = address(room);
        _rooms.push(roomAddr);
        _roomsByParty[msg.sender].push(roomAddr);
        _roomsByParty[partyB].push(roomAddr);

        emit RoomCreated(roomAddr, msg.sender, partyB, context);
        return roomAddr;
    }

    /// @notice Get all rooms ever created
    function getRooms() external view returns (address[] memory) {
        return _rooms;
    }

    /// @notice Get total number of rooms
    function getRoomCount() external view returns (uint256) {
        return _rooms.length;
    }

    /// @notice Get all rooms involving a specific party
    function getRoomsByParty(
        address party
    ) external view returns (address[] memory) {
        return _roomsByParty[party];
    }
}
