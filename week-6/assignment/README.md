# Creator Support Action

A simple Solana Action & Blink for creator support with tips and votes in one transaction.

## Features

- 💰 **Tip Creator** - Send SOL tips (0.01, 0.05, 0.1 SOL or custom)
- 🗳️ **Vote for Content** - Vote "Awesome" or "Good" with minimal SOL
- 🎯 **All-in-One** - Tip + Vote in single transaction
- 🌐 **Blinks Ready** - Shareable blockchain links

## Quick Start

1. Install dependencies:
```bash
yarn install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Configure your wallet address in `.env`:
```env
CREATOR_WALLET_ADDRESS=your_wallet_address_here
```

4. Start server:
```bash
yarn dev
```

5. Test your blink:
https://dial.to/?action=solana-action:http://localhost:3001/api/actions/support


## API Endpoints

- `GET /actions.json` - Action discovery
- `GET /api/actions/support` - Support action metadata
- `POST /api/actions/support` - Create support transaction
- `GET /api/actions/health` - Health check

## Support Options

| Option | Amount | Vote | Description |
|--------|--------|------|-------------|
| 🔥 Small + Awesome | 0.01 SOL | Awesome | Small tip + awesome vote |
| 👍 Medium + Good | 0.05 SOL | Good | Medium tip + good vote |
| 🚀 Large + Awesome | 0.1 SOL | Awesome | Large tip + awesome vote |
| 🔥 Vote Awesome | 0.001 SOL | Awesome | Just vote awesome |
| 👍 Vote Good | 0.001 SOL | Good | Just vote good |
| 💰 Custom + Awesome | Custom | Awesome | Choose your amount |

## Usage

Share your blink URL:
https://dial.to/?action=solana-action:http://localhost:3001/api/actions/support?creatorAddress=YOUR_ADDRESS&contentId=CONTENT_ID


## Development

```bash
# Start development server
yarn dev

# Test endpoints
curl http://localhost:3001/api/actions/support
curl http://localhost:3001/api/actions/health

# Check actions.json
curl http://localhost:3001/actions.json
```

## Built With

- **Solana Actions SDK** - Transaction creation
- **Express.js** - Web server
- **@solana/web3.js** - Solana integration

---

