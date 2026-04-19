export const FACTORY_ADDRESS =
  (process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}`) ||
  "0xE387f4FDa884FCc976F3f27853E34FdB895E9fBE";

/**
 * NegotiationType enum mirrors `enum NegotiationType { GENERIC, SALARY, OTC, MA }`
 * in NegotiationRoom.sol. Used by frontend selects + API route validation.
 */
export const NEGOTIATION_TYPE = {
  GENERIC: 0,
  SALARY: 1,
  OTC: 2,
  MA: 3,
} as const;
export type NegotiationTypeValue = (typeof NEGOTIATION_TYPE)[keyof typeof NEGOTIATION_TYPE];

export const NEGOTIATION_ROOM_ABI = [
  {
    inputs: [
      { internalType: "address", name: "_partyA", type: "address" },
      { internalType: "address", name: "_partyB", type: "address" },
      { internalType: "bytes32", name: "_contextHash", type: "bytes32" },
      { internalType: "uint8", name: "_weightA", type: "uint8" },
      { internalType: "address", name: "_auditor", type: "address" },
      { internalType: "uint256", name: "_deadline", type: "uint256" },
      { internalType: "uint8", name: "_negotiationType", type: "uint8" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "uint256", name: "splitPoint", type: "uint256" },
    ],
    name: "DealFound",
    type: "event",
  },
  { anonymous: false, inputs: [], name: "NoDeal", type: "event" },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "party", type: "address" },
    ],
    name: "PartySubmitted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "party", type: "address" },
      { indexed: true, internalType: "address", name: "agent", type: "address" },
      { indexed: false, internalType: "uint8", name: "templateId", type: "uint8" },
      { indexed: false, internalType: "bytes32", name: "contextHash", type: "bytes32" },
      { indexed: false, internalType: "bytes32", name: "modelHash", type: "bytes32" },
      { indexed: false, internalType: "bytes32", name: "promptVersionHash", type: "bytes32" },
    ],
    name: "AgentSubmission",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "triggeredBy", type: "address" },
    ],
    name: "RoomExpired",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "cancelledBy", type: "address" },
    ],
    name: "RoomCancelled",
    type: "event",
  },
  {
    inputs: [],
    name: "aSubmitted",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "bSubmitted",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "contextHash",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "status",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "expireRoom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "cancelRoom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "weightA",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "auditor",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "deadline",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "negotiationType",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "dealExists",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "partyA",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "partyB",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "resolved",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "revealedSplit",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "ctHash", type: "uint256" },
          { internalType: "uint8", name: "securityZone", type: "uint8" },
          { internalType: "uint8", name: "utype", type: "uint8" },
          { internalType: "bytes", name: "signature", type: "bytes" },
        ],
        internalType: "struct InEuint64",
        name: "encryptedAmount",
        type: "tuple",
      },
    ],
    name: "submitReservation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "ctHash", type: "uint256" },
          { internalType: "uint8", name: "securityZone", type: "uint8" },
          { internalType: "uint8", name: "utype", type: "uint8" },
          { internalType: "bytes", name: "signature", type: "bytes" },
        ],
        internalType: "struct InEuint64",
        name: "encryptedAmount",
        type: "tuple",
      },
      { internalType: "address", name: "agent", type: "address" },
      {
        components: [
          { internalType: "uint8", name: "templateId", type: "uint8" },
          { internalType: "bytes32", name: "contextHash", type: "bytes32" },
          { internalType: "bytes32", name: "modelHash", type: "bytes32" },
          { internalType: "bytes32", name: "promptVersionHash", type: "bytes32" },
        ],
        internalType: "struct NegotiationRoom.AgentProvenance",
        name: "provenance",
        type: "tuple",
      },
    ],
    name: "submitReservationAsAgent",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getEncryptedResult",
    outputs: [{ internalType: "euint64", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getEncryptedZopa",
    outputs: [{ internalType: "ebool", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "ebool", name: "zopaCtHash", type: "uint256" },
      { internalType: "bool", name: "zopaBool", type: "bool" },
      { internalType: "bytes", name: "zopaSignature", type: "bytes" },
      { internalType: "euint64", name: "resultCtHash", type: "uint256" },
      { internalType: "uint64", name: "resultPlaintext", type: "uint64" },
      { internalType: "bytes", name: "resultSignature", type: "bytes" },
    ],
    name: "publishResults",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const NEGOTIATION_FACTORY_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "room", type: "address" },
      { indexed: true, internalType: "address", name: "partyA", type: "address" },
      { indexed: true, internalType: "address", name: "partyB", type: "address" },
      { indexed: false, internalType: "bytes32", name: "contextHash", type: "bytes32" },
    ],
    name: "RoomCreated",
    type: "event",
  },
  {
    inputs: [
      { internalType: "address", name: "partyB", type: "address" },
      { internalType: "bytes32", name: "contextHash", type: "bytes32" },
      { internalType: "uint8", name: "weightA", type: "uint8" },
      { internalType: "address", name: "auditor", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      {
        internalType: "enum NegotiationRoom.NegotiationType",
        name: "negotiationType",
        type: "uint8",
      },
    ],
    name: "createRoom",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getRoomCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getRooms",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "party", type: "address" }],
    name: "getRoomsByParty",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/** Keccak256 hash of a UTF-8 string — matches the contract's contextHash convention. */
export function hashContext(text: string): `0x${string}` {
  // Avoid pulling a crypto dep into the bundle — let viem/ethers handle this
  // at call sites. This function is a stub; call sites should import the
  // real keccak256 from viem or ethers directly.
  throw new Error(
    "Call sites should hash via viem's keccak256(toBytes(text)) or ethers.keccak256(ethers.toUtf8Bytes(text))."
  );
}

/** Room status enum mirrors the contract. */
export const ROOM_STATUS = {
  OPEN: 0,
  RESOLVED: 1,
  EXPIRED: 2,
  CANCELLED: 3,
} as const;
