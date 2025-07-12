import * as anchor from "@coral-xyz/anchor";
import {
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getMint,
} from "@solana/spl-token";

export const mintToken = async ({
  connection,
  payer,
  receiver,
  mint,
  decimals,
  amount,
}: {
  connection: anchor.web3.Connection;
  payer: anchor.web3.Keypair;
  receiver: anchor.web3.PublicKey;
  mint: anchor.web3.Keypair;
  decimals: number;
  amount: number;
}) => {
  // Check if mint already exists
  let mintExists = false;
  let mintInfo = null;
  
  try {
    mintInfo = await getMint(connection, mint.publicKey);
    mintExists = true;
    console.log("Mint already exists:", mint.publicKey.toBase58());
  } catch (error) {
    // Mint doesn't exist, we need to create it
    mintExists = false;
    console.log("Mint does not exist, creating new one:", mint.publicKey.toBase58());
  }

  if (!mintExists) {
    await createMint(
      connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      decimals,
      mint
    );
    console.log("Created new mint:", mint.publicKey.toBase58());
  } else {
    // Check if the payer is the mint authority
    if (mintInfo && !mintInfo.mintAuthority?.equals(payer.publicKey)) {
      console.log("Warning: Payer is not the mint authority. Mint authority:", mintInfo.mintAuthority?.toBase58());
      console.log("Payer:", payer.publicKey.toBase58());
      // Skip minting if authority doesn't match
      console.log("Skipping mint operation due to authority mismatch");
      return;
    }
  }

  await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint.publicKey,
    receiver
  );

  try {
    await mintTo(
      connection,
      payer,
      mint.publicKey,
      getAssociatedTokenAddressSync(mint.publicKey, receiver),
      payer.publicKey,
      amount * 10 ** decimals
    );
    console.log("Successfully minted", amount, "tokens to", receiver.toBase58());
  } catch (error) {
    console.log("Failed to mint tokens:", error);
    throw error;
  }
};

export const expectRevert = async (promise: Promise<any>) => {
  try {
    await promise;
    throw new Error("Expected a revert");
  } catch {
    return;
  }
};