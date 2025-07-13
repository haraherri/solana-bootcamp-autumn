import { Router } from 'express';
import { getSupportAction, postSupportAction } from './support.js';

const router = Router();

// Main support action (all-in-one)
router.get('/support', getSupportAction);
router.post('/support', postSupportAction);

// Redirect root to support
router.get('/', (req, res) => {
  res.redirect('/api/actions/support');
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    action: 'support',
    features: ['tip', 'vote', 'all-in-one'],
    timestamp: new Date().toISOString(),
    mainEndpoint: '/api/actions/support'
  });
});

export default router;