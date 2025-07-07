/**
 * Demonstrates how to mint NFTs and store their metadata on chain using the Metaplex MetadataProgram
 */

import { Keypair } from "@solana/web3.js";
import { Metaplex, keypairIdentity, mockStorage } from "@metaplex-foundation/js";

import { payer, connection } from "@/lib/vars";
import { explorerURL, printConsoleSeparator } from "@/lib/helpers";

(async () => {
  console.log("Payer address:", payer.publicKey.toBase58());

  /**
   * define our ship's JSON metadata
   */
  const metadata = {
    name: "Solana Bootcamp Autumn 2024",
    symbol: "SBS",
    description: "Solana Bootcamp Autumn 2024",
    image:
      "https://github.com/trankhacvy/solana-bootcamp-autumn-2024/blob/main/assets/logo.png?raw=true",
    attributes: [
      {
        trait_type: "bootcamp",
        value: "Autumn 2024",
      },
      {
        trait_type: "blockchain",
        value: "Solana",
      },
    ],
  };

  /**
   * Use the Metaplex sdk to handle most NFT actions
   */

  // create an instance of Metaplex sdk for use
  const metaplex = Metaplex.make(connection)
    // set our keypair to use, and pay for the transaction
    .use(keypairIdentity(payer))
    // use mock storage instead of bundlr to avoid the RPC issue
    .use(mockStorage());

  console.log("Uploading metadata...");

  // upload the JSON metadata
  const { uri } = await metaplex.nfts().uploadMetadata(metadata);

  console.log("Metadata uploaded:", uri);

  printConsoleSeparator("NFT details");

  console.log("Creating NFT using Metaplex...");

  const tokenMint = Keypair.generate();

  // create a new nft using the metaplex sdk
  const { nft, response } = await metaplex.nfts().create({
    uri,
    name: metadata.name,
    symbol: metadata.symbol,
    useNewMint: tokenMint,

    // `sellerFeeBasisPoints` is the royalty that you can define on nft
    sellerFeeBasisPoints: 1000, // Represents 10.00% (as required in assignment)

    //
    isMutable: true,
  });

  console.log(nft);

  printConsoleSeparator("NFT created:");
  console.log(explorerURL({ txSignature: response.signature }));

  /**
   *
   */

  printConsoleSeparator("Find by mint:");

  // you can also use the metaplex sdk to retrieve info about the NFT's mint
  const mintInfo = await metaplex.nfts().findByMint({
    mintAddress: tokenMint.publicKey,
  });
  console.log(mintInfo);
})();
