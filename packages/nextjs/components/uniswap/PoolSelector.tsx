"use client";

import React, { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { parseAbi } from "viem";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import externalContracts from "~~/contracts/externalContracts";

// Define the Pool type that will be used throughout the app
export type Pool = {
  address: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  token0Symbol: string;
  token1Symbol: string;
  reserve0: bigint;
  reserve1: bigint;
  fee: number;
};

// Mock pools for testing/display
const MOCK_POOLS: Pool[] = [
  {
    address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
    token0: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    token1: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    token0Symbol: "ETH",
    token1Symbol: "USDC",
    reserve0: BigInt(10) * BigInt(10 ** 18), // 10 ETH
    reserve1: BigInt(20000) * BigInt(10 ** 6), // 20,000 USDC
    fee: 0.003, // 0.3%
  },
  {
    address: "0x0987654321098765432109876543210987654321" as `0x${string}`,
    token0: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    token1: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    token0Symbol: "ETH", 
    token1Symbol: "DAI",
    reserve0: BigInt(15) * BigInt(10 ** 18), // 15 ETH
    reserve1: BigInt(30000) * BigInt(10 ** 18), // 30,000 DAI
    fee: 0.003, // 0.3%
  },
  {
    address: "0xabcdef1234567890abcdef1234567890abcdef12" as `0x${string}`,
    token0: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    token1: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    token0Symbol: "WBTC",
    token1Symbol: "ETH",
    reserve0: BigInt(2) * BigInt(10 ** 8), // 2 WBTC
    reserve1: BigInt(60) * BigInt(10 ** 18), // 60 ETH
    fee: 0.003, // 0.3%
  },
  // 添加一些额外的模拟池
  {
    address: "0x2345678901234567890123456789012345678901" as `0x${string}`,
    token0: "0x1111111111111111111111111111111111111111" as `0x${string}`,
    token1: "0x2222222222222222222222222222222222222222" as `0x${string}`,
    token0Symbol: "LINK",
    token1Symbol: "ETH",
    reserve0: BigInt(500) * BigInt(10 ** 18), // 500 LINK
    reserve1: BigInt(25) * BigInt(10 ** 18), // 25 ETH
    fee: 0.003, // 0.3%
  },
  {
    address: "0x3456789012345678901234567890123456789012" as `0x${string}`,
    token0: "0x3333333333333333333333333333333333333333" as `0x${string}`,
    token1: "0x4444444444444444444444444444444444444444" as `0x${string}`,
    token0Symbol: "UNI",
    token1Symbol: "USDT",
    reserve0: BigInt(10000) * BigInt(10 ** 18), // 10000 UNI
    reserve1: BigInt(50000) * BigInt(10 ** 6), // 50,000 USDT
    fee: 0.003, // 0.3%
  },
];

interface PoolSelectorProps {
  selectedPool: Pool | null;
  setSelectedPool: React.Dispatch<React.SetStateAction<Pool | null>>;
}

export const PoolSelector = ({ selectedPool, setSelectedPool }: PoolSelectorProps) => {
  const [pools, setPools] = useState<Pool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { targetNetwork } = useTargetNetwork();

  // 使用从externalContracts获取的ABI
  const factoryAbi = externalContracts[11155111].UniswapV2Factory.abi;
  const factoryAddress = externalContracts[11155111].UniswapV2Factory.address as `0x${string}`;
  
  // 获取Uniswap工厂合约中的所有池数量
  const { data: pairsLength } = useReadContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "allPairsLength",
    chainId: targetNetwork.id,
  });

  // 获取池信息并设置到state
  useEffect(() => {
    // 模拟获取池的过程（在实际应用中，你需要实现真正的合约调用）
    const fetchPools = async () => {
      // 模拟网络请求延迟
      setTimeout(() => {
        setPools(MOCK_POOLS);
        setIsLoading(false);
      }, 1000);
      
      // 实际代码会在这里获取实时池数据
      // 出于演示目的，我们只使用模拟数据
    };
    
    fetchPools();
  }, []);

  // 提供帮助函数来处理数字格式化
  const formatReserve = (amount: bigint, symbol: string) => {
    if (symbol === "WBTC") {
      return parseFloat((amount / BigInt(10 ** 8)).toString()).toFixed(8);
    } else if (symbol === "USDC" || symbol === "USDT") {
      return parseFloat((amount / BigInt(10 ** 6)).toString()).toFixed(2);
    } else {
      return parseFloat((amount / BigInt(10 ** 18)).toString()).toFixed(4);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl p-4">
      <h2 className="text-2xl font-bold mb-4">选择池子</h2>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : pools.length === 0 ? (
        <div className="text-center py-8">
          <p>找不到可用的池子。请确保你已连接到Sepolia测试网。</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>池子</th>
                <th>储备金</th>
                <th>费率</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((pool) => (
                <tr key={pool.address} className={selectedPool?.address === pool.address ? "bg-base-200" : ""}>
                  <td>{pool.token0Symbol}/{pool.token1Symbol}</td>
                  <td>
                    {formatReserve(pool.reserve0, pool.token0Symbol)} {pool.token0Symbol} / 
                    {formatReserve(pool.reserve1, pool.token1Symbol)} {pool.token1Symbol}
                  </td>
                  <td>{(pool.fee * 100).toFixed(2)}%</td>
                  <td>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => setSelectedPool(pool)}
                    >
                      {selectedPool?.address === pool.address ? "已选择" : "选择"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}; 