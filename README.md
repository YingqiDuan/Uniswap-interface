# Uniswap Interface

A custom implementation of Uniswap V2 interface built with Scaffold-ETH 2.

## Prerequisites

- Node (>= v20.18.3)
- Yarn (v1 or v2+)
- Git

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/uniswap-interface.git
cd uniswap-interface
```

2. Install dependencies:
```bash
yarn install
```

3. Environment setup (optional):
   - Copy `.env.example` to `.env` in the packages/foundry directory
   - For production, update API keys in the .env file

4. Run a local network:
```bash
yarn chain
```

5. Deploy the test contracts:
```bash
yarn deploy
```

6. Start the application:
```bash
yarn start
```

Visit the app at: `http://localhost:3000`

## Additional Commands

- Run tests: `yarn test`
- Build for production: `yarn build`
- Serve production build: `yarn next:serve`
- Deploy to Vercel: `yarn vercel`
