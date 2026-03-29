export const FACTORY_ADDRESS =
  (process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}`) ||
  "0x1221aBCe7D8FB1ba4cF9293E94539cb45e7857fE";

export const NEGOTIATION_ROOM_ABI = [
  {
    inputs: [
      { internalType: "address", name: "_partyA", type: "address" },
      { internalType: "address", name: "_partyB", type: "address" },
      { internalType: "string", name: "_context", type: "string" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "splitPoint",
        type: "uint256",
      },
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
    name: "context",
    outputs: [{ internalType: "string", name: "", type: "string" }],
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
      {
        indexed: true,
        internalType: "address",
        name: "room",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "partyA",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "partyB",
        type: "address",
      },
      { indexed: false, internalType: "string", name: "context", type: "string" },
    ],
    name: "RoomCreated",
    type: "event",
  },
  {
    inputs: [
      { internalType: "address", name: "partyB", type: "address" },
      { internalType: "string", name: "context", type: "string" },
      { internalType: "uint8", name: "weightA", type: "uint8" },
      { internalType: "address", name: "auditor", type: "address" },
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
