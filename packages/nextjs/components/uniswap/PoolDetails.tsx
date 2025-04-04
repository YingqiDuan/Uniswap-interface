"use client";

import React from "react";
import { type Pool } from "./PoolSelector";

interface PoolDetailsProps {
  selectedPool: Pool | null;
}

export const PoolDetails: React.FC<PoolDetailsProps> = ({ selectedPool }) => {
  if (!selectedPool) {
    return <div className="card bg-base-100 shadow-xl p-6">Please select a pool to view details</div>;
  }

  // Helper function to handle number formatting
  const formatReserve = (amount: bigint, symbol: string) => {
    try {
      console.log(`Pool details formatting reserve amount [${symbol}]: ${amount.toString()}`);
      
      if (amount === BigInt(0)) {
        return 0;
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
        decimals = 8; // Increase WETH decimal places to ensure small decimal values display correctly
      } else if (symbol === "TEST") {
        divisor = BigInt(10 ** 18);
        decimals = 2;
      }
      
      const wholePart = amount / divisor;
      const fractionPart = amount % divisor;
      
      // For very small values, ensure they don't round to 0
      let result;
      if (wholePart === BigInt(0) && fractionPart > BigInt(0)) {
        // For values less than 1, keep more decimal places
        const fractionStr = fractionPart.toString().padStart(Number(Math.log10(Number(divisor))), '0');
        // Find the position of the first non-zero digit
        let firstNonZero = 0;
        for (let i = 0; i < fractionStr.length; i++) {
          if (fractionStr[i] !== '0') {
            firstNonZero = i;
            break;
          }
        }
        // Ensure at least 3 significant digits are displayed
        const significantDigits = Math.max(decimals, firstNonZero + 3);
        const floatValue = Number(fractionPart) / Number(divisor);
        result = parseFloat(floatValue.toFixed(significantDigits));
      } else {
        // Normal formatting
        const floatValue = Number(wholePart) + Number(fractionPart) / Number(divisor);
        result = parseFloat(floatValue.toFixed(decimals));
      }
      
      console.log(`${symbol} final formatting result: ${result}`);
      return result;
    } catch (error) {
      console.error(`Error formatting reserve amount:`, error);
      return 0;
    }
  };
  
  const reserve0Formatted = formatReserve(selectedPool.reserve0, selectedPool.token0Symbol);
  const reserve1Formatted = formatReserve(selectedPool.reserve1, selectedPool.token1Symbol);
  
  const k = reserve0Formatted * reserve1Formatted;
  
  return (
    <div className="card bg-base-100 shadow-xl p-6">
      <h2 className="text-xl font-bold mb-4">Pool Details</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="stat">
          <div className="stat-title">{selectedPool.token0Symbol} Reserve</div>
          <div className="stat-value text-lg font-mono">
            {reserve0Formatted.toLocaleString(undefined, { 
              minimumFractionDigits: 2,
              maximumFractionDigits: selectedPool.token0Symbol === "WBTC" || selectedPool.token0Symbol === "WETH" ? 8 : 4
            })}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">{selectedPool.token1Symbol} Reserve</div>
          <div className="stat-value text-lg font-mono">
            {reserve1Formatted.toLocaleString(undefined, { 
              minimumFractionDigits: 2,
              maximumFractionDigits: selectedPool.token1Symbol === "WBTC" || selectedPool.token1Symbol === "WETH" ? 8 : 4
            })}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Constant K</div>
          <div className="stat-value text-lg font-mono">{k.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
          <div className="stat-desc">x · y = k</div>
        </div>
        <div className="stat">
          <div className="stat-title">Fee Rate</div>
          <div className="stat-value text-lg">{(selectedPool.fee * 100).toFixed(2)}%</div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Pool address:</span>
          {selectedPool.isRealPool ? (
            <div className="text-xs font-mono bg-base-200 p-2 rounded overflow-auto">{selectedPool.address}</div>
          ) : (
            <div className="badge badge-primary font-mono">{selectedPool.address.slice(0, 6)}...{selectedPool.address.slice(-4)}</div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{selectedPool.token0Symbol} address:</span>
          {selectedPool.isRealPool ? (
            <div className="text-xs font-mono bg-base-200 p-2 rounded overflow-auto">{selectedPool.token0}</div>
          ) : (
            <div className="badge badge-secondary font-mono">{selectedPool.token0.slice(0, 6)}...{selectedPool.token0.slice(-4)}</div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{selectedPool.token1Symbol} address:</span>
          {selectedPool.isRealPool ? (
            <div className="text-xs font-mono bg-base-200 p-2 rounded overflow-auto">{selectedPool.token1}</div>
          ) : (
            <div className="badge badge-secondary font-mono">{selectedPool.token1.slice(0, 6)}...{selectedPool.token1.slice(-4)}</div>
          )}
        </div>
      </div>
    </div>
  );
}; 