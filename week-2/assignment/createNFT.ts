/**
 * Assignment 2: Create NFT with 10% royalty
 * Requirements:
 * - NFT with name, symbol, description, image, and traits
 * - 10% royalty (1000 basis points)
 */

import { Keypair } from "@solana/web3.js";
import { Metaplex, keypairIdentity, mockStorage } from "@metaplex-foundation/js";

import { payer, connection } from "@/lib/vars";
import { explorerURL, printConsoleSeparator } from "@/lib/helpers";

(async () => {
  console.log("Payer address:", payer.publicKey.toBase58());

  // NFT metadata
  const metadata = {
    name: "HuyGia Bootcamp NFT",
    symbol: "HGNFT",
    description: "Assignment 2 NFT for Solana Bootcamp Autumn 2024 - Created by HuyGia",
    image: "https://github.com/trankhacvy/solana-bootcamp-autumn-2024/blob/main/assets/logo.png?raw=true",
    attributes: [
      {
        trait_type: "Assignment",
        value: "Assignment 2",
      },
      {
        trait_type: "Creator",
        value: "HuyGia",
      },
      {
        trait_type: "Bootcamp",
        value: "Solana Bootcamp Autumn 2024",
      },
      {
        trait_type: "Blockchain",
        value: "Solana",
      },
      {
        trait_type: "Rarity",
        value: "Legendary",
      },
    ],
  };

  // Create Metaplex instance
  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(payer))
    .use(mockStorage());

  console.log("📤 Uploading NFT metadata...");

  // Upload metadata
  const { uri } = await metaplex.nfts().uploadMetadata(metadata);
  console.log("✅ Metadata uploaded:", uri);

  printConsoleSeparator("NFT Creation");

  console.log("🎨 Creating NFT...");

  // Generate keypair for the NFT mint
  const nftMint = Keypair.generate();

  // Create NFT with 10% royalty
  const { nft, response } = await metaplex.nfts().create({
    uri,
    name: metadata.name,
    symbol: metadata.symbol,
    useNewMint: nftMint,
    sellerFeeBasisPoints: 1000, // 10% royalty (10.00% = 1000 basis points)
    isMutable: true,
  });

  console.log("✅ NFT created successfully!");
  console.log("📝 Transaction signature:", response.signature);
  console.log("🔗 Explorer URL:", explorerURL({ txSignature: response.signature }));
  console.log("🎨 NFT Mint Address:", nftMint.publicKey.toBase58());
  console.log("👑 NFT Name:", nft.name);
  console.log("🎯 NFT Symbol:", nft.symbol);
  console.log("💰 Royalty:", "10% (1000 basis points)");

  printConsoleSeparator("NFT Details");
  console.log("NFT Object:", nft);

  printConsoleSeparator("Verification");
  
  // Verify the NFT by fetching it
  const mintInfo = await metaplex.nfts().findByMint({
    mintAddress: nftMint.publicKey,
  });
  
  console.log("✅ NFT verification successful");
  console.log("📋 Retrieved NFT info:", {
    name: mintInfo.name,
    symbol: mintInfo.symbol,
    uri: mintInfo.uri,
    sellerFeeBasisPoints: mintInfo.sellerFeeBasisPoints,
  });

})();