/**
 * Assignment 2: Create fungible token with metadata and mint tokens in a single transaction
 * Requirements:
 * - Token decimals: 6
 * - Mint 100 tokens for yourself
 * - Mint 10 tokens for address 63EEC9FfGyksm7PkVC6z8uAmqozbQcTzbkWJNsgqjkFs
 */

import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { 
  MINT_SIZE, 
  TOKEN_PROGRAM_ID, 
  createInitializeMint2Instruction,
  getOrCreateAssociatedTokenAccount,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  createMintToInstruction
} from "@solana/spl-token";

import {
  PROGRAM_ID as METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata";

import { payer, connection, STATIC_PUBLICKEY } from "@/lib/vars";
import {
  buildTransaction,
  explorerURL,
  extractSignatureFromFailedTransaction,
  printConsoleSeparator,
  savePublicKeyToFile,
} from "@/lib/helpers";

(async () => {
  console.log("Payer address:", payer.publicKey.toBase58());
  console.log("Target address:", STATIC_PUBLICKEY.toBase58());

  // Generate a new keypair for our token mint
  const mintKeypair = Keypair.generate();
  console.log("Token Mint address:", mintKeypair.publicKey.toBase58());

  // Token configuration
  const tokenConfig = {
    decimals: 6, // Required: 6 decimals
    name: "HuyGia Bootcamp Token",
    symbol: "HGBT",
    uri: "https://raw.githubusercontent.com/solana-developers/pirate-bootcamp/main/quest-6/assets/spl-token.json",
  };

  // Calculate amounts (considering decimals)
  const selfAmount = 100 * Math.pow(10, tokenConfig.decimals); // 100 tokens
  const targetAmount = 10 * Math.pow(10, tokenConfig.decimals); // 10 tokens

  console.log(`Will mint ${100} tokens for self and ${10} tokens for target address`);

  /**
   * Step 1: Create Mint Account
   */
  const createMintAccountInstruction = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mintKeypair.publicKey,
    space: MINT_SIZE,
    lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE),
    programId: TOKEN_PROGRAM_ID,
  });

  /**
   * Step 2: Initialize Mint
   */
  const initializeMintInstruction = createInitializeMint2Instruction(
    mintKeypair.publicKey,
    tokenConfig.decimals,
    payer.publicKey,
    payer.publicKey,
  );

  /**
   * Step 3: Create Metadata Account
   */
  const metadataAccount = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer()],
    METADATA_PROGRAM_ID,
  )[0];

  console.log("Metadata address:", metadataAccount.toBase58());

  const createMetadataInstruction = createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataAccount,
      mint: mintKeypair.publicKey,
      mintAuthority: payer.publicKey,
      payer: payer.publicKey,
      updateAuthority: payer.publicKey,
    },
    {
      createMetadataAccountArgsV3: {
        data: {
          creators: null,
          name: tokenConfig.name,
          symbol: tokenConfig.symbol,
          uri: tokenConfig.uri,
          sellerFeeBasisPoints: 0,
          collection: null,
          uses: null,
        },
        collectionDetails: null,
        isMutable: true,
      },
    },
  );

  /**
   * Step 4: Create Associated Token Accounts and Mint Instructions
   */
  
  // Get ATA addresses
  const payerATA = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    payer.publicKey
  );

  const targetATA = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    STATIC_PUBLICKEY
  );

  console.log("Payer ATA:", payerATA.toBase58());
  console.log("Target ATA:", targetATA.toBase58());

  // Create ATA instructions
  const createPayerATAInstruction = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    payerATA,
    payer.publicKey,
    mintKeypair.publicKey
  );

  const createTargetATAInstruction = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    targetATA,
    STATIC_PUBLICKEY,
    mintKeypair.publicKey
  );

  // Create mint instructions
  const mintToPayerInstruction = createMintToInstruction(
    mintKeypair.publicKey,
    payerATA,
    payer.publicKey,
    selfAmount
  );

  const mintToTargetInstruction = createMintToInstruction(
    mintKeypair.publicKey,
    targetATA,
    payer.publicKey,
    targetAmount
  );

  /**
   * Build and send transaction with all instructions
   */
  const instructions = [
    createMintAccountInstruction,
    initializeMintInstruction,
    createMetadataInstruction,
    createPayerATAInstruction,
    createTargetATAInstruction,
    mintToPayerInstruction,
    mintToTargetInstruction,
  ];

  const tx = await buildTransaction({
    connection,
    payer: payer.publicKey,
    signers: [payer, mintKeypair],
    instructions,
  });

  printConsoleSeparator();

  try {
    const sig = await connection.sendTransaction(tx);

    console.log("✅ Transaction completed successfully!");
    console.log("📝 Transaction signature:", sig);
    console.log("🔗 Explorer URL:", explorerURL({ txSignature: sig }));
    console.log("🏷️  Token Mint:", mintKeypair.publicKey.toBase58());
    console.log("📊 Minted 100 tokens to payer:", payer.publicKey.toBase58());
    console.log("📊 Minted 10 tokens to target:", STATIC_PUBLICKEY.toBase58());

    // Save the mint address for potential future use
    savePublicKeyToFile("assignmentTokenMint", mintKeypair.publicKey);

  } catch (err) {
    console.error("❌ Failed to send transaction:");
    
    const failedSig = await extractSignatureFromFailedTransaction(connection, err);
    if (failedSig) console.log("Failed signature:", explorerURL({ txSignature: failedSig }));

    throw err;
  }
})();