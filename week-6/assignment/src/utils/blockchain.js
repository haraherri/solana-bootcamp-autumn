import { Connection, clusterApiUrl, SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Initialize Solana connection
export const getConnection = () => {
  const network = process.env.SOLANA_NETWORK || 'devnet';
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(network);
  return new Connection(rpcUrl, 'confirmed');
};

// Create SOL transfer instruction
export const createSOLTransferInstruction = (fromPubkey, toPubkey, amount) => {
  return SystemProgram.transfer({
    fromPubkey,
    toPubkey,
    lamports: amount * LAMPORTS_PER_SOL
  });
};

// Create transaction with instruction
export const createTransaction = async (instructions, feePayer) => {
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  
  const transaction = new Transaction({
    feePayer,
    blockhash,
    lastValidBlockHeight
  });
  
  instructions.forEach(instruction => {
    transaction.add(instruction);
  });
  
  return transaction;
};

// Get account balance
export const getAccountBalance = async (publicKey) => {
  const connection = getConnection();
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
};