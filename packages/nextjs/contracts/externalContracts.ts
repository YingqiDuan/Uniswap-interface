import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";
import UniswapV2FactoryABI from "./abis/UniswapV2Factory.json";
import UniswapV2RouterABI from "./abis/UniswapV2Router02.json";
import UniswapV2PairABI from "./abis/UniswapV2Pair.json";
import ERC20ABI from "./abis/IERC20.json";

/**
 * @example
 * const externalContracts = {
 *   1: {
 *     DAI: {
 *       address: "0x...",
 *       abi: [...],
 *     },
 *   },
 * } as const;
 */
const externalContracts = {
  11155111: {
    UniswapV2Factory: {
      address: process.env.NEXT_PUBLIC_UNISWAP_FACTORY_ADDRESS as string,
      abi: UniswapV2FactoryABI,
    },
    UniswapV2Router02: {
      address: process.env.NEXT_PUBLIC_UNISWAP_ROUTER_ADDRESS as string,
      abi: UniswapV2RouterABI,
    },
    WETH: {
      address: process.env.NEXT_PUBLIC_WETH_ADDRESS as string,
      abi: ERC20ABI,
    },
  },
} as const as GenericContractsDeclaration;

export default externalContracts;
