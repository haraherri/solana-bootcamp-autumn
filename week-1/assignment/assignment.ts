import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

import { payer, connection } from '@/lib/vars';
import { explorerURL, printConsoleSeparator } from '@/lib/helpers';

(async () => {
  console.log(`Payer's address`, payer.publicKey.toBase58());

  // Check the payer's balance to ensure sufficient SOL
  const payerBalance = await connection.getBalance(payer.publicKey);
  console.log(
    `Payer's current balance (SOL):`,
    payerBalance / LAMPORTS_PER_SOL
  );

  // Airdrop more SOL if balance is too low
  if (payerBalance < LAMPORTS_PER_SOL) {
    console.log(`Balance too low, requesting airdrop...`);
    await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL);
    console.log(`Received 1 SOL airdrop`);
  }

  const newAccount = Keypair.generate();
  console.log(`New Account Created:`, newAccount.publicKey.toBase58());

  const destinationAddress = new PublicKey(
    '63EEC9FfGyksm7PkVC6z8uAmqozbQcTzbkWJNsgqjkFs'
  );
  console.log(`Destination Address:`, destinationAddress.toBase58());

  // Define the amount of SOL to transfer
  const transferAmount = 0.1 * LAMPORTS_PER_SOL;

  // Calculate initial SOL needed to create account
  // Must cover 0.1 SOL transfer + transaction fees
  const initialFunding = transferAmount + 0.01 * LAMPORTS_PER_SOL;

  // 1. Create instruction to initialize a new account with balance
  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: newAccount.publicKey,
    lamports: initialFunding,
    space: 0,
    programId: SystemProgram.programId,
  });

  // 2. Create instruction to transfer 0.1 SOL from new account to destination address
  const transferIx = SystemProgram.transfer({
    fromPubkey: newAccount.publicKey,
    toPubkey: destinationAddress,
    lamports: transferAmount,
  });

  // 3. Create instruction to close account (remaining balance refunded to payer)
  const closeAccountIx = SystemProgram.transfer({
    fromPubkey: newAccount.publicKey,
    toPubkey: payer.publicKey,
    lamports: initialFunding - transferAmount,
  });

  const { blockhash } = await connection.getLatestBlockhash();

  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [createAccountIx, transferIx, closeAccountIx],
  }).compileToV0Message();

  const transaction = new VersionedTransaction(message);

  transaction.sign([payer, newAccount]);

  try {
    const signature = await connection.sendTransaction(transaction);
    console.log(`Transaction successful!`);
    console.log(`Transaction signature:`);
    console.log(
      `See transaction details at:`,
      explorerURL({ txSignature: signature })
    );

    console.log(
      '\nNote: Please save the above transaction signature for submission!'
    );
  } catch (error) {
    console.error(`Transaction sending error`, error);
  }
  printConsoleSeparator();
})();
