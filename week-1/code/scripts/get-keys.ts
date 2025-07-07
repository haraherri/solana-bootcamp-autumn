import { Keypair } from "@solana/web3.js";
import { payer, testWallet } from "@/lib/vars";
import { saveKeypairToFile } from "@/lib/helpers";
import fs from "fs";

// Function to generate a vanity keypair that starts with a specific prefix
function generateVanityKeypair(prefix: string): Keypair {
  let attempts = 0;
  console.log(`Searching for a public key that starts with "${prefix}"...`);

  while (true) {
    attempts++;
    const keypair = Keypair.generate();
    const pubkeyString = keypair.publicKey.toBase58();

    // Check if the base58 encoded public key starts with our prefix
    if (pubkeyString.toLowerCase().startsWith(prefix.toLowerCase())) {
      console.log(`Found after ${attempts} attempts!`);
      return keypair;
    }

    // Show progress every 10000 attempts
    if (attempts % 10000 === 0) {
      console.log(`Still searching... (${attempts} attempts so far)`);
    }
  }
}

// Hiển thị thông tin của payer
console.log("=== PAYER WALLET INFO ===");
console.log("Public Key:", payer.publicKey.toBase58());
console.log("Private Key (Secret Key):", Array.from(payer.secretKey));

// Hiển thị thông tin của testWallet
console.log("\n=== TEST WALLET INFO ===");
console.log("Public Key:", testWallet.publicKey.toBase58());
console.log("Private Key (Secret Key):", Array.from(testWallet.secretKey));

// Generate a vanity keypair that starts with "huy"
const huyWallet = generateVanityKeypair("huy");

console.log("\n=== HUY VANITY WALLET INFO ===");
console.log("Public Key:", huyWallet.publicKey.toBase58());
console.log("Private Key (Secret Key):", Array.from(huyWallet.secretKey));

// Save to file system
saveKeypairToFile(huyWallet, "huyWallet");

// Lưu thông tin vào file để tham khảo sau
const walletInfo = {
  payer: {
    publicKey: payer.publicKey.toBase58(),
    privateKey: Array.from(payer.secretKey),
  },
  testWallet: {
    publicKey: testWallet.publicKey.toBase58(),
    privateKey: Array.from(testWallet.secretKey),
  },
  huyWallet: {
    publicKey: huyWallet.publicKey.toBase58(),
    privateKey: Array.from(huyWallet.secretKey),
  },
};

// Tạo thư mục nếu chưa tồn tại
if (!fs.existsSync("./.local_keys")) {
  fs.mkdirSync("./.local_keys");
}

// Lưu vào file
fs.writeFileSync("./.local_keys/wallet_info.json", JSON.stringify(walletInfo, null, 2));

console.log("\nThông tin đã được lưu vào ./.local_keys/wallet_info.json");
console.log(`Vanity wallet "huy" đã được lưu vào ./.local_keys/huyWallet.json`);
