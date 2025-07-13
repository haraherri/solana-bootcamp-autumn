// code/app/src/lib/helper.ts
import { Cluster, PublicKey, Connection } from "@solana/web3.js";

// Get Program ID from environment
export const TODO_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_TODO_PROGRAM_ID || "5qc4okxCxVSpm6B3Tp4QmHtuQV966Q4zZh4n87FL9mjS"
);

// Get current network from environment
export const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as Cluster) || "devnet";

// RPC endpoint configuration
export function getRpcUrl(cluster?: Cluster): string {
  const targetCluster = cluster || SOLANA_NETWORK;
  
  switch (targetCluster) {
    case "devnet":
      return process.env.NEXT_PUBLIC_DEVNET_RPC || "https://api.devnet.solana.com";
    case "testnet":
      return process.env.NEXT_PUBLIC_TESTNET_RPC || "https://api.testnet.solana.com";
    case "mainnet-beta":
      return process.env.NEXT_PUBLIC_MAINNET_RPC || "https://api.mainnet-beta.solana.com";
    default:
      return process.env.NEXT_PUBLIC_DEVNET_RPC || "https://api.devnet.solana.com";
  }
}

// Create connection with proper configuration
export function createConnection(cluster?: Cluster): Connection {
  const rpcUrl = getRpcUrl(cluster);
  
  return new Connection(rpcUrl, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60000,
  });
}

export function getProgramId(cluster?: Cluster): string {
  // Return string address instead of PublicKey object
  return TODO_PROGRAM_ID.toBase58();
}

// Debug helper
export function getAppConfig() {
  return {
    network: SOLANA_NETWORK,
    programId: TODO_PROGRAM_ID.toString(),
    rpcUrl: getRpcUrl(),
    debug: process.env.NEXT_PUBLIC_DEBUG === "true",
  };
}