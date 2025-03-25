# 🦄 Uniswap Interface

<h4 align="center">
  A custom implementation of Uniswap V2 interface built with Scaffold-ETH 2
</h4>

This project provides a modern, responsive interface for interacting with Uniswap V2 smart contracts. It enables users to view pool information, add/remove liquidity, and execute token swaps with an intuitive user experience.

## ✨ Features

- 🌊 **Pool Management**: View detailed information about liquidity pools including reserves, price, and constant product value
- 🔄 **Token Swapping**: Swap tokens with real-time price impact calculation and slippage protection
- 💧 **Liquidity Provision**: Add and remove liquidity from pools with customizable slippage tolerance
- 📊 **Visual Analytics**: View reserve curves and swap history with interactive charts
- 🔍 **Pool Exploration**: Browse and search for available pools with clear distinction between real and simulated pools

## 🛠️ Built With

- NextJS, React, and TypeScript for the frontend
- Wagmi, RainbowKit, and Viem for Web3 interactions
- Foundry for smart contract development and testing
- Tailwind CSS and DaisyUI for styling

## 🚀 Getting Started

### Prerequisites

Before you begin, you need to install the following tools:

- [Node (>= v20.18.3)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))
- [Git](https://git-scm.com/downloads)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/uniswap-interface.git
cd uniswap-interface
```

2. Install dependencies:

```bash
yarn install
```

3. Run a local network in the first terminal:

```bash
yarn chain
```

This command starts a local Ethereum network using Foundry. The network runs on your local machine and can be used for testing and development.

4. On a second terminal, deploy the test contracts:

```bash
yarn deploy
```

This command deploys the Uniswap V2 contracts to the local network. The contracts include the factory, router, and test tokens.

5. On a third terminal, start your NextJS app:

```bash
yarn start
```

Visit your app on: `http://localhost:3000`

## 🧪 Testing

Run smart contract tests with:

```bash
yarn foundry:test
```

## 📝 Notes

- This interface is configured to work with the Sepolia testnet by default
- For real operations, ensure your wallet is connected to the correct network
- Test tokens (TEST/WETH) are available for experimenting with the interface

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/yourusername/uniswap-interface/issues) for open issues or create a new one.
