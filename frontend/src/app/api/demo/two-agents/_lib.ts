/**
 * Heavy server-side helpers for the two-agent battle demo.
 *
 * Imports CoFHE Node SDK + ethers + viem — keep this OUT of the status route.
 * Lightweight session storage lives in `./_sessions.ts`.
 */
import { ethers } from "ethers";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/node";
import { arbSepolia } from "@cofhe/sdk/chains";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import {
  NEGOTIATION_FACTORY_ABI,
  NEGOTIATION_ROOM_ABI,
  FACTORY_ADDRESS,
} from "@/config/contracts";

export * from "./_sessions";

/**
 * Loads the two demo agent ethers wallets from env vars.
 * Throws with a clear message if either is missing.
 */
export function getDemoWallets() {
  const rpc = process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
  const provider = new ethers.JsonRpcProvider(rpc, { chainId: 421614, name: "arbitrum-sepolia" });

  const keyA = process.env.DEMO_AGENT_A_PRIVATE_KEY;
  const keyB = process.env.DEMO_AGENT_B_PRIVATE_KEY;
  if (!keyA || !keyB) {
    throw new Error(
      "Server missing DEMO_AGENT_A_PRIVATE_KEY or DEMO_AGENT_B_PRIVATE_KEY"
    );
  }

  const walletA = new ethers.Wallet(keyA, provider);
  const walletB = new ethers.Wallet(keyB, provider);

  return { walletA, walletB, provider, rpc };
}

/**
 * Creates a CoFHE Node client connected with a viem wallet for a given private key.
 * The CoFHE client uses viem internally; the actual contract submission is done with ethers.
 */
export async function createConnectedCofheClient(privateKeyHex: string) {
  const account = privateKeyToAccount(privateKeyHex as `0x${string}`);
  const rpc = process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";

  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpc),
  });
  const walletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(rpc),
  });

  const config = createCofheConfig({
    supportedChains: [arbSepolia],
  });
  const client = createCofheClient(config);
  await client.connect(publicClient as any, walletClient as any);

  return client;
}

export const FACTORY_ABI = NEGOTIATION_FACTORY_ABI;
export const ROOM_ABI = NEGOTIATION_ROOM_ABI;
export { FACTORY_ADDRESS };
