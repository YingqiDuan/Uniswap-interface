"use client";

import React, { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
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
  isRealPool: boolean;
};

// 回退使用的测试池
const MOCK_POOLS: Pool[] = [
  {
    address: "0x123mock1" as `0x${string}`,
    token0: "0x1111111111111111111111111111111111111111" as `0x${string}`,
    token1: "0x2222222222222222222222222222222222222222" as `0x${string}`,
    token0Symbol: "ETH",
    token1Symbol: "USDC",
    reserve0: BigInt(10) * BigInt(10 ** 18), // 10 ETH
    reserve1: BigInt(20000) * BigInt(10 ** 6), // 20,000 USDC
    fee: 0.003, // 0.3%
    isRealPool: false,
  },
  {
    address: "0x123mock2" as `0x${string}`,
    token0: "0x1111111111111111111111111111111111111111" as `0x${string}`,
    token1: "0x3333333333333333333333333333333333333333" as `0x${string}`,
    token0Symbol: "ETH",
    token1Symbol: "DAI",
    reserve0: BigInt(15) * BigInt(10 ** 18), // 15 ETH
    reserve1: BigInt(30000) * BigInt(10 ** 18), // 30,000 DAI
    fee: 0.003, // 0.3%
    isRealPool: false,
  },
  {
    address: "0x123mock3" as `0x${string}`,
    token0: "0x4444444444444444444444444444444444444444" as `0x${string}`,
    token1: "0x1111111111111111111111111111111111111111" as `0x${string}`,
    token0Symbol: "WBTC",
    token1Symbol: "ETH",
    reserve0: BigInt(2) * BigInt(10 ** 8), // 2 WBTC
    reserve1: BigInt(60) * BigInt(10 ** 18), // 60 ETH
    fee: 0.003, // 0.3%
    isRealPool: false,
  },
  // 其他模拟池
  {
    address: "0x123mock4" as `0x${string}`,
    token0: "0x4444444444444444444444444444444444444444" as `0x${string}`,
    token1: "0x2222222222222222222222222222222222222222" as `0x${string}`,
    token0Symbol: "WBTC",
    token1Symbol: "USDC",
    reserve0: BigInt(1) * BigInt(10 ** 8), // 1 WBTC
    reserve1: BigInt(25000) * BigInt(10 ** 6), // 25,000 USDC
    fee: 0.003, // 0.3%
    isRealPool: false,
  },
  {
    address: "0x123mock5" as `0x${string}`,
    token0: "0x2222222222222222222222222222222222222222" as `0x${string}`,
    token1: "0x5555555555555555555555555555555555555555" as `0x${string}`,
    token0Symbol: "USDC",
    token1Symbol: "USDT",
    reserve0: BigInt(50000) * BigInt(10 ** 6), // 50,000 USDC
    reserve1: BigInt(50000) * BigInt(10 ** 6), // 50,000 USDT
    fee: 0.003, // 0.3%
    isRealPool: false,
  },
];

// 我们在Sepolia上真实创建的流动性池
const REAL_POOLS: Pool[] = [
  {
    address: "0xCd40Fb4Bae9A7e2240975A590E23dA8a5AE3df67" as `0x${string}`, // TEST/WETH Pair
    token0: "0x22cD43F525494c87edB678cBbc7F99baEc7eC39B" as `0x${string}`, // TestToken
    token1: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9" as `0x${string}`, // WETH
    token0Symbol: "TEST",
    token1Symbol: "WETH",
    reserve0: BigInt(0), // 初始化为0，等待API更新
    reserve1: BigInt(0), // 初始化为0，等待API更新
    fee: 0.003, // 0.3%
    isRealPool: true,
  }
];

interface PoolSelectorProps {
  selectedPool: Pool | null;
  setSelectedPool: React.Dispatch<React.SetStateAction<Pool | null>>;
}

export const PoolSelector = ({ selectedPool, setSelectedPool }: PoolSelectorProps) => {
  const [pools, setPools] = useState<Pool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingError, setIsLoadingError] = useState(false);
  const { targetNetwork } = useTargetNetwork();

  // 从环境变量获取Uniswap Factory地址
  const factoryAddress = process.env.NEXT_PUBLIC_UNISWAP_FACTORY_ADDRESS as `0x${string}` || 
                        "0x2f3f73153388bfc11d5ddcf6e26aef613b4c54ff" as `0x${string}`;
  
  console.log(`使用Factory地址: ${factoryAddress}`);
  console.log(`当前网络ID: ${targetNetwork.id}`);
  
  // 获取ABI
  const factoryAbi = externalContracts[11155111].UniswapV2Factory.abi;
  
  // 获取Uniswap工厂合约中的所有池数量
  const { data: pairsLength, isError: isFactoryError } = useReadContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "allPairsLength",
    chainId: targetNetwork.id,
  });

  // 获取池列表和详细信息
  useEffect(() => {
    const fetchPools = async () => {
      setIsLoading(true);
      try {
        // 获取真实池子数据
        const realPoolsWithData = await Promise.all(
          REAL_POOLS.map(async (pool) => {
            try {
              // 尝试从API获取池子数据
              console.log(`正在获取池子 ${pool.token0Symbol}/${pool.token1Symbol} 的数据...`);
              const response = await fetch(`/api/getPairData?pair=${pool.address}`);
              
              if (!response.ok) {
                console.warn(`获取池子 ${pool.address} 数据失败: ${response.statusText}`);
                return { ...pool, isRealPool: true }; // 保持原始数据，但标记为真实池子
              }
              
              const pairData = await response.json();
              console.log("获取到的池子数据:", pairData);
              
              // 更新池子数据
              return {
                ...pool,
                reserve0: BigInt(pairData.reserve0 || 0),
                reserve1: BigInt(pairData.reserve1 || 0),
                isRealPool: true
              };
            } catch (error) {
              console.error(`获取池子 ${pool.address} 数据时出错:`, error);
              return { ...pool, isRealPool: true }; // 保持原始数据，但标记为真实池子
            }
          })
        );
        
        // 构建所有池子列表
        const allPools = [...realPoolsWithData, ...MOCK_POOLS.map(pool => ({...pool, isRealPool: false}))];
        
        // 过滤有效的池子
        const validRealPools = realPoolsWithData.filter(
          pool => pool.reserve0 !== undefined && pool.reserve1 !== undefined
        );
        
        console.log(`找到 ${validRealPools.length} 个有效的真实池子，储备:`);
        validRealPools.forEach(pool => {
          console.log(`${pool.token0Symbol}/${pool.token1Symbol}: ${formatReserve(pool.reserve0, pool.token0Symbol)} ${pool.token0Symbol}, ${formatReserve(pool.reserve1, pool.token1Symbol)} ${pool.token1Symbol}`);
        });
        
        // 更新状态
        setPools(allPools);
      } catch (error) {
        console.error("获取池子数据失败:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPools();
  }, [factoryAddress, pairsLength, targetNetwork.id, isFactoryError]);

  // 添加日志来检查每个池子的isRealPool属性
  useEffect(() => {
    if (!isLoading && pools.length > 0) {
      console.log("所有池子的isRealPool属性:");
      pools.forEach(pool => {
        console.log(`${pool.token0Symbol}/${pool.token1Symbol}: isRealPool=${pool.isRealPool}`);
      });
    }
  }, [pools, isLoading]);

  // 定期更新池子数据
  useEffect(() => {
    // 只有在有选中池子且不在加载状态时更新
    if (!selectedPool || isLoading) return undefined;
    
    const updateInterval = setInterval(() => {
      if (selectedPool) {
        updateSelectedPoolReserves();
      }
    }, 60000); // 每60秒更新一次
    
    return () => clearInterval(updateInterval);
  }, [selectedPool, isLoading]);
  
  // 更新选中池子的储备金额
  const updateSelectedPoolReserves = async () => {
    if (!selectedPool) return;
    
    try {
      console.log(`更新池子 ${selectedPool.address} 的储备金额`);
      const pairDataResponse = await fetch(`/api/getPairData?pair=${selectedPool.address}`);
      if (!pairDataResponse.ok) {
        console.error("获取池子数据失败:", await pairDataResponse.text());
        return;
      }
      
      const pairData = await pairDataResponse.json();
      
      if (pairData && pairData.reserve0 !== undefined && pairData.reserve1 !== undefined) {
        console.log(`获取到新的储备金额: reserve0=${pairData.reserve0}, reserve1=${pairData.reserve1}`);
        setSelectedPool({
          ...selectedPool,
          reserve0: BigInt(pairData.reserve0),
          reserve1: BigInt(pairData.reserve1),
        });
      } else {
        console.error("获取到的池子数据不完整:", pairData);
      }
    } catch (error) {
      console.error("更新池子储备金额失败:", error);
    }
  };

  // 格式化储备金额显示
  const formatReserve = (amount: bigint, symbol: string) => {
    try {
      console.log(`格式化储备金额 [${symbol}]: ${amount.toString()} (${typeof amount})`);
      
      if (amount === BigInt(0)) {
        console.log(`${symbol}储备为0，直接返回"0"`);
        return "0";
      }
      
      let divisor = BigInt(10 ** 18); // 默认18位小数
      let decimals = 4; // 默认显示4位小数
      
      if (symbol === "WBTC") {
        divisor = BigInt(10 ** 8);
        decimals = 8;
      } else if (symbol === "USDC" || symbol === "USDT") {
        divisor = BigInt(10 ** 6);
        decimals = 2;
      } else if (symbol === "WETH") {
        divisor = BigInt(10 ** 18);
        // 增加WETH的小数位数，以确保小数值能够正确显示
        decimals = 8;
      } else if (symbol === "TEST") {
        divisor = BigInt(10 ** 18);
        decimals = 2;
      }
      
      const wholePart = amount / divisor;
      const fractionPart = amount % divisor;
      
      // 对于非常小的值，确保不会四舍五入为0
      let result;
      if (wholePart === BigInt(0) && fractionPart > BigInt(0)) {
        // 对于小于1的值，保留更多小数位
        const fractionStr = fractionPart.toString().padStart(Number(Math.log10(Number(divisor))), '0');
        // 找到第一个非0数字的位置
        let firstNonZero = 0;
        for (let i = 0; i < fractionStr.length; i++) {
          if (fractionStr[i] !== '0') {
            firstNonZero = i;
            break;
          }
        }
        // 确保至少显示3位有效数字
        const significantDigits = Math.max(decimals, firstNonZero + 3);
        const floatValue = Number(fractionPart) / Number(divisor);
        result = floatValue.toFixed(significantDigits);
      } else {
        // 正常情况下的格式化
        const floatValue = Number(wholePart) + Number(fractionPart) / Number(divisor);
        result = floatValue.toFixed(decimals);
      }
      
      console.log(`${symbol}最终格式化结果: ${result}`);
      return result;
    } catch (error) {
      console.error(`格式化储备金额时出错:`, error);
      return "Error";
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="text-lg font-semibold mb-2">选择交易池</div>
      
      {isLoading ? (
        <div className="p-4 text-center">
          <span className="loading loading-spinner"></span>
          <p>加载池子列表...</p>
        </div>
      ) : isLoadingError ? (
        <div className="p-4 text-center text-error">
          <p>加载失败，请刷新页面重试</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {pools.map((pool, index) => {
            const reserve0Formatted = formatReserve(pool.reserve0, pool.token0Symbol);
            const reserve1Formatted = formatReserve(pool.reserve1, pool.token1Symbol);
            
            const isSelected = selectedPool?.address === pool.address;
            const isRealPool = pool.isRealPool;
            
            return (
              <div
                key={pool.address}
                className={`
                  flex flex-col p-4 cursor-pointer rounded-lg mb-2 transition-all
                  ${isSelected ? 'bg-primary/10 border-primary' : 'bg-base-200 hover:bg-base-300'}
                  border ${isRealPool ? 'border-l-4 border-l-success' : 'border-l-4 border-l-warning'}
                `}
                onClick={() => setSelectedPool(pool)}
              >
                <div className="flex justify-between items-center">
                  <div className="font-semibold flex items-center gap-2">
                    {pool.token0Symbol}/{pool.token1Symbol}
                    {isRealPool && (
                      <span className="badge badge-success badge-sm">真实池子</span>
                    )}
                    {!isRealPool && (
                      <span className="badge badge-warning badge-sm">模拟池子</span>
                    )}
                  </div>
                  <div className="text-sm opacity-70">费率: {pool.fee * 100}%</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <div className="text-xs opacity-70">{pool.token0Symbol} 储备</div>
                    <div className="font-mono">{reserve0Formatted}</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-70">{pool.token1Symbol} 储备</div>
                    <div className="font-mono">{reserve1Formatted}</div>
                  </div>
                </div>
                
                {/* 添加调试信息 */}
                <div className="mt-2 text-xs opacity-50 font-mono">
                  <div>地址: {pool.address.slice(0, 8)}...{pool.address.slice(-6)}</div>
                  <div>isRealPool: {isRealPool.toString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}; 