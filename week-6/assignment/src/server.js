import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { actionCors, actionHeaders } from './middleware/cors.js';
import actionRoutes from './actions/index.js';

// Load environment variables
dotenv.config();

// ES module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(morgan('combined'));
app.use(express.json());
app.use(actionCors);
app.use(actionHeaders);

app.use('/api/actions', actionRoutes);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    network: process.env.SOLANA_NETWORK || 'devnet'
  });
});

// Actions.json endpoint
app.get('/actions.json', (req, res) => {
  res.json({
    rules: [
      {
        pathPattern: '/api/actions/support',
        apiPath: '/api/actions/support'
      },
      {
        pathPattern: '/api/actions/**',
        apiPath: '/api/actions/**'
      }
    ]
  });
});

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'Creator Support Action Server',
    description: 'All-in-one creator support with tips and votes',
    endpoints: {
      actions: '/actions.json',
      support: '/api/actions/support',  // Main endpoint
      health: '/api/actions/health'
    },
    usage: {
      blink: `https://dial.to/?action=solana-action:${process.env.BASE_URL || 'http://localhost:3001'}/api/actions/support`,
      direct: `${process.env.BASE_URL || 'http://localhost:3001'}/api/actions/support`
    }
  });
});

// TODO: Import and use action routes
// app.use('/api/actions', actionRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Update server startup logs
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Base URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
  console.log(`🎯 Support Action: ${process.env.BASE_URL || `http://localhost:${PORT}`}/api/actions/support`);
  console.log(`🔗 Test Blink: https://dial.to/?action=solana-action:${process.env.BASE_URL || `http://localhost:${PORT}`}/api/actions/support`);
});