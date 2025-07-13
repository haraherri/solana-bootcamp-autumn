import { PublicKey } from '@solana/web3.js';

export const validateSolanaAddress = (address) => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

export const validateAmount = (amount) => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num <= 10; // Max 10 SOL
};

export const validateTipRequest = (body) => {
  const { account } = body;
  
  if (!account) {
    throw new Error('Missing required field: account');
  }
  
  if (!validateSolanaAddress(account)) {
    throw new Error('Invalid account address');
  }
  
  return true;
};

export const validateVoteRequest = (body) => {
  const { account } = body;
  
  if (!account) {
    throw new Error('Missing required field: account');
  }
  
  if (!validateSolanaAddress(account)) {
    throw new Error('Invalid account address');
  }
  
  return true;
};