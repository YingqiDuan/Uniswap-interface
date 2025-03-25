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

// Fallback test pools
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
  // Other mock pools
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

// Real liquidity pools we created on Sepolia
const REAL_POOLS: Pool[] = [
  {
    address: "0xCd40Fb4Bae9A7e2240975A590E23dA8a5AE3df67" as `0x${string}`, // TEST/WETH Pair
    token0: "0x22cD43F525494c87edB678cBbc7F99baEc7eC39B" as `0x${string}`, // TestToken
    token1: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9" as `0x${string}`, // WETH
    token0Symbol: "TEST",
    token1Symbol: "WETH",
    reserve0: BigInt(0), // Initialize to 0, wait for API update
    reserve1: BigInt(0), // Initialize to 0, wait for API update
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

  // Get Uniswap Factory address from environment variables
  const factoryAddress = process.env.NEXT_PUBLIC_UNISWAP_FACTORY_ADDRESS as `0x${string}` || 
                        "0x2f3f73153388bfc11d5ddcf6e26aef613b4c54ff" as `0x${string}`;
  
  console.log(`Using Factory address: ${factoryAddress}`);
  console.log(`Current network ID: ${targetNetwork.id}`);
  
  // Get ABI
  const factoryAbi = externalContracts[11155111].UniswapV2Factory.abi;
  
  // Get the number of all pools in the Uniswap factory contract
  const { data: pairsLength, isError: isFactoryError } = useReadContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "allPairsLength",
    chainId: targetNetwork.id,
  });

  // Get pool list and detailed information
  useEffect(() => {
    const fetchPools = async () => {
      setIsLoading(true);
      try {
        // Get real pool data
        const realPoolsWithData = await Promise.all(
          REAL_POOLS.map(async (pool) => {
            try {
              // Try to get pool data from API
              console.log(`Getting data for pool ${pool.token0Symbol}/${pool.token1Symbol}...`);
              const response = await fetch(`/api/getPairData?pair=${pool.address}`);
              
              if (!response.ok) {
                console.warn(`Failed to get data for pool ${pool.address}: ${response.statusText}`);
                return { ...pool, isRealPool: true }; // Keep original data, but mark as real pool
              }
              
              const pairData = await response.json();
              console.log("Pool data received:", pairData);
              
              // Update pool data
              return {
                ...pool,
                reserve0: BigInt(pairData.reserve0 || 0),
                reserve1: BigInt(pairData.reserve1 || 0),
                isRealPool: true
              };
            } catch (error) {
              console.error(`Error getting data for pool ${pool.address}:`, error);
              return { ...pool, isRealPool: true }; // Keep original data, but mark as real pool
            }
          })
        );
        
        // Build the complete pool list
        const allPools = [...realPoolsWithData, ...MOCK_POOLS.map(pool => ({...pool, isRealPool: false}))];
        
        // Filter valid pools
        const validRealPools = realPoolsWithData.filter(
          pool => pool.reserve0 !== undefined && pool.reserve1 !== undefined
        );
        
        console.log(`Found ${validRealPools.length} valid real pools, reserves:`);
        validRealPools.forEach(pool => {
          console.log(`${pool.token0Symbol}/${pool.token1Symbol}: ${formatReserve(pool.reserve0, pool.token0Symbol)} ${pool.token0Symbol}, ${formatReserve(pool.reserve1, pool.token1Symbol)} ${pool.token1Symbol}`);
        });
        
        // Update state
        setPools(allPools);
      } catch (error) {
        console.error("Failed to get pool data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPools();
  }, [factoryAddress, pairsLength, targetNetwork.id, isFactoryError]);

  // Add logs to check isRealPool property for each pool
  useEffect(() => {
    if (!isLoading && pools.length > 0) {
      console.log("isRealPool property for all pools:");
      pools.forEach(pool => {
        console.log(`${pool.token0Symbol}/${pool.token1Symbol}: isRealPool=${pool.isRealPool}`);
      });
    }
  }, [pools, isLoading]);

  // Periodically update pool data
  useEffect(() => {
    // Only update when there's a selected pool and not in loading state
    if (!selectedPool || isLoading) return undefined;
    
    const updateInterval = setInterval(() => {
      if (selectedPool) {
        updateSelectedPoolReserves();
      }
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(updateInterval);
  }, [selectedPool, isLoading]);
  
  // Update selected pool reserves
  const updateSelectedPoolReserves = async () => {
    if (!selectedPool) return;
    
    try {
      console.log(`Updating reserves for pool ${selectedPool.address}`);
      const pairDataResponse = await fetch(`/api/getPairData?pair=${selectedPool.address}`);
      if (!pairDataResponse.ok) {
        console.error("Failed to get pool data:", await pairDataResponse.text());
        return;
      }
      
      const pairData = await pairDataResponse.json();
      
      if (pairData && pairData.reserve0 !== undefined && pairData.reserve1 !== undefined) {
        console.log(`New reserves received: reserve0=${pairData.reserve0}, reserve1=${pairData.reserve1}`);
        setSelectedPool({
          ...selectedPool,
          reserve0: BigInt(pairData.reserve0),
          reserve1: BigInt(pairData.reserve1),
        });
      } else {
        console.error("Received incomplete pool data:", pairData);
      }
    } catch (error) {
      console.error("Failed to update pool reserves:", error);
    }
  };

  // Format reserve amount for display
  const formatReserve = (amount: bigint, symbol: string) => {
    try {
      console.log(`Formatting reserve amount [${symbol}]: ${amount.toString()} (${typeof amount})`);
      
      if (amount === BigInt(0)) {
        console.log(`${symbol} reserve is 0, returning "0"`);
        return "0";
      }
      
      let divisor = BigInt(10 ** 18); // Default 18 decimal places
      let decimals = 4; // Default display 4 decimal places
      
      if (symbol === "WBTC") {
        divisor = BigInt(10 ** 8);
        decimals = 8;
      } else if (symbol === "USDC" || symbol === "USDT") {
        divisor = BigInt(10 ** 6);
        decimals = 2;
      } else if (symbol === "WETH") {
        divisor = BigInt(10 ** 18);
        // Increase WETH decimal places to ensure small value can be displayed correctly
        decimals = 8;
      } else if (symbol === "TEST") {
        divisor = BigInt(10 ** 18);
        decimals = 2;
      }
      
      const wholePart = amount / divisor;
      const fractionPart = amount % divisor;
      
      // For very small values, ensure not rounded to 0
      let result;
      if (wholePart === BigInt(0) && fractionPart > BigInt(0)) {
        // For values less than 1, retain more decimal places
        const fractionStr = fractionPart.toString().padStart(Number(Math.log10(Number(divisor))), '0');
        // Find position of first non-0 digit
        let firstNonZero = 0;
        for (let i = 0; i < fractionStr.length; i++) {
          if (fractionStr[i] !== '0') {
            firstNonZero = i;
            break;
          }
        }
        // Ensure at least 3 significant digits
        const significantDigits = Math.max(decimals, firstNonZero + 3);
        const floatValue = Number(fractionPart) / Number(divisor);
        result = floatValue.toFixed(significantDigits);
      } else {
        // Normal formatting
        const floatValue = Number(wholePart) + Number(fractionPart) / Number(divisor);
        result = floatValue.toFixed(decimals);
      }
      
      console.log(`${symbol} final formatted result: ${result}`);
      return result;
    } catch (error) {
      console.error(`Error formatting reserve amount:`, error);
      return "Error";
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="text-lg font-semibold mb-2">Select trading pool</div>
      
      {isLoading ? (
        <div className="p-4 text-center">
          <span className="loading loading-spinner"></span>
          <p>Loading pool list...</p>
        </div>
      ) : isLoadingError ? (
        <div className="p-4 text-center text-error">
          <p>Failed to load, please refresh the page</p>
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
                      <span className="badge badge-success badge-sm">Real pool</span>
                    )}
                    {!isRealPool && (
                      <span className="badge badge-warning badge-sm">Mock pool</span>
                    )}
                  </div>
                  <div className="text-sm opacity-70">Fee: {pool.fee * 100}%</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <div className="text-xs opacity-70">{pool.token0Symbol} reserve</div>
                    <div className="font-mono">{reserve0Formatted}</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-70">{pool.token1Symbol} reserve</div>
                    <div className="font-mono">{reserve1Formatted}</div>
                  </div>
                </div>
                
                {/* Add debug information */}
                <div className="mt-2 text-xs opacity-50 font-mono">
                  <div>Address: {pool.address.slice(0, 8)}...{pool.address.slice(-6)}</div>
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