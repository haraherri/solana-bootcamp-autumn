import { Cluster, PublicKey } from "@solana/web3.js";

export const TODO_PROGRAM_ID = new PublicKey(
  "DqNi8KTQc4ZYtMDsxUxcB3SieB6vVrvSU1Kw2KtMo4JE"
);

export function getProgramId(cluster: Cluster) {
  switch (cluster) {
    case "devnet":
    case "testnet":
    case "mainnet-beta":
    default:
      return TODO_PROGRAM_ID;
  }
}
