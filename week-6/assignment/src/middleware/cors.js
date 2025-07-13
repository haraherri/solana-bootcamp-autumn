import cors from 'cors';

// CORS configuration for Solana Actions
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Content-Encoding',
    'Accept-Encoding',
    'X-Accept-Action-Version',
    'X-Accept-Blockchain-Ids'
  ],
  credentials: false
};

export const actionCors = cors(corsOptions);

// Additional headers for Solana Actions
export const actionHeaders = (req, res, next) => {
  res.setHeader('X-Action-Version', '2.2.0');
  res.setHeader('X-Blockchain-Ids', 'solana:mainnet,solana:devnet');
  next();
};