import { PublicKey, SystemProgram } from '@solana/web3.js';
import { createPostResponse } from '@solana/actions';
import { validateTipRequest, validateAmount, validateSolanaAddress } from '../utils/validation.js';
import { createTransaction } from '../utils/blockchain.js';

// Support options combining tip + vote
const SUPPORT_OPTIONS = [
  {
    id: 'tip_small_awesome',
    amount: 0.01,
    vote: 'awesome',
    label: '🔥 0.01 SOL + Awesome Vote',
    description: 'Small tip + vote content as awesome'
  },
  {
    id: 'tip_medium_good', 
    amount: 0.05,
    vote: 'good',
    label: '👍 0.05 SOL + Good Vote',
    description: 'Medium tip + vote content as good'
  },
  {
    id: 'tip_large_awesome',
    amount: 0.1,
    vote: 'awesome', 
    label: '🚀 0.1 SOL + Awesome Vote',
    description: 'Large tip + vote content as awesome'
  },
  {
    id: 'vote_only_awesome',
    amount: 0.001,
    vote: 'awesome',
    label: '🔥 Vote Awesome (0.001 SOL)',
    description: 'Just vote awesome with minimal SOL'
  },
  {
    id: 'vote_only_good',
    amount: 0.001,
    vote: 'good', 
    label: '👍 Vote Good (0.001 SOL)',
    description: 'Just vote good with minimal SOL'
  },
  {
    id: 'custom_tip',
    amount: null,
    vote: 'awesome',
    label: '💰 Custom Tip + Awesome',
    description: 'Choose your tip amount + awesome vote'
  }
];

// Get support action metadata
export const getSupportAction = async (req, res) => {
  try {
    const { creatorAddress, contentId } = req.query;
    
    // Validate creator address
    const creator = creatorAddress || process.env.CREATOR_WALLET_ADDRESS;
    if (!validateSolanaAddress(creator)) {
      return res.status(400).json({
        error: 'Invalid creator address'
      });
    }

    const baseHref = `${process.env.BASE_URL}/api/actions/support?creatorAddress=${creator}&contentId=${contentId || 'default'}`;

    // Create action links
    const actions = SUPPORT_OPTIONS.map(option => {
      if (option.amount === null) {
        // Custom amount option
        return {
          label: option.label,
          href: `${baseHref}&option=${option.id}&amount={amount}`,
          description: option.description,
          parameters: [
            {
              name: 'amount',
              label: 'Enter tip amount (SOL)',
              required: true,
              type: 'number',
              min: 0.001,
              max: 10
            }
          ]
        };
      } else {
        // Fixed amount option
        return {
          label: option.label,
          href: `${baseHref}&option=${option.id}`,
          description: option.description
        };
      }
    });

    const payload = {
      type: 'action',
      title: '🎯 Support Creator',
      icon: `${process.env.BASE_URL}/icons/support.png`,
      description: `Show support with tips and votes for content: ${contentId || 'default'}`,
      label: 'Support Creator',
      links: {
        actions: actions
      }
    };

    res.json(payload);
  } catch (error) {
    console.error('Error in getSupportAction:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Create support transaction (tip + vote in one)
export const postSupportAction = async (req, res) => {
  try {
    // Validate request
    validateTipRequest(req.body);
    
    const { account } = req.body;
    const { option, amount, creatorAddress, contentId } = req.query;
    
    // Find support option
    const supportOption = SUPPORT_OPTIONS.find(opt => opt.id === option);
    if (!supportOption) {
      return res.status(400).json({
        error: 'Invalid support option'
      });
    }
    
    // Determine final amount
    let finalAmount;
    if (supportOption.amount === null) {
      // Custom amount
      finalAmount = parseFloat(amount);
      if (!validateAmount(finalAmount)) {
        return res.status(400).json({
          error: 'Invalid tip amount. Must be between 0.001 and 10 SOL'
        });
      }
    } else {
      // Fixed amount
      finalAmount = supportOption.amount;
    }
    
    // Validate creator address
    const creator = creatorAddress || process.env.CREATOR_WALLET_ADDRESS;
    if (!validateSolanaAddress(creator)) {
      return res.status(400).json({
        error: 'Invalid creator address'
      });
    }
    
    // Create public keys
    const fromPubkey = new PublicKey(account);
    const toPubkey = new PublicKey(creator);
    
    // Create transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports: finalAmount * 1000000000 // Convert to lamports
    });
    
    // Create transaction
    const transaction = await createTransaction([transferInstruction], fromPubkey);
    
    // Create descriptive message
    const voteEmoji = supportOption.vote === 'awesome' ? '🔥' : '👍';
    const voteText = supportOption.vote === 'awesome' ? 'Awesome' : 'Good';
    
    const message = finalAmount > 0.005 
      ? `💰 Tipped ${finalAmount} SOL + ${voteEmoji} Voted "${voteText}" for content: ${contentId || 'default'}`
      : `${voteEmoji} Voted "${voteText}" for content: ${contentId || 'default'} (${finalAmount} SOL)`;
    
    // Create response
    const payload = await createPostResponse({
      fields: {
        transaction,
        message: message
      }
    });
    
    res.json(payload);
    
  } catch (error) {
    console.error('Error in postSupportAction:', error);
    res.status(400).json({
      error: error.message || 'Failed to create support transaction'
    });
  }
};