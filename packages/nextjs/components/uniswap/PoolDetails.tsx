"use client";

import React from "react";
import { type Pool } from "./PoolSelector";

interface PoolDetailsProps {
  selectedPool: Pool | null;
}

export const PoolDetails: React.FC<PoolDetailsProps> = ({ selectedPool }) => {
  if (!selectedPool) {
    return <div className="card bg-base-100 shadow-xl p-6">请选择一个交易池查看详情</div>;
  }

  // 提供帮助函数来处理数字格式化
  const formatReserve = (amount: bigint, symbol: string) => {
    try {
      console.log(`Pool详情格式化储备金额 [${symbol}]: ${amount.toString()}`);
      
      if (amount === BigInt(0)) {
        return 0;
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
        decimals = 8; // 增加WETH的小数位数，以确保小数值能够正确显示
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
        result = parseFloat(floatValue.toFixed(significantDigits));
      } else {
        // 正常情况下的格式化
        const floatValue = Number(wholePart) + Number(fractionPart) / Number(divisor);
        result = parseFloat(floatValue.toFixed(decimals));
      }
      
      console.log(`${symbol}最终格式化结果: ${result}`);
      return result;
    } catch (error) {
      console.error(`格式化储备金额时出错:`, error);
      return 0;
    }
  };
  
  const reserve0Formatted = formatReserve(selectedPool.reserve0, selectedPool.token0Symbol);
  const reserve1Formatted = formatReserve(selectedPool.reserve1, selectedPool.token1Symbol);
  
  const k = reserve0Formatted * reserve1Formatted;
  
  return (
    <div className="card bg-base-100 shadow-xl p-6">
      <h2 className="text-xl font-bold mb-4">交易池详情</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="stat">
          <div className="stat-title">{selectedPool.token0Symbol} 储备</div>
          <div className="stat-value text-lg font-mono">
            {reserve0Formatted.toLocaleString(undefined, { 
              minimumFractionDigits: 2,
              maximumFractionDigits: selectedPool.token0Symbol === "WBTC" || selectedPool.token0Symbol === "WETH" ? 8 : 4
            })}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">{selectedPool.token1Symbol} 储备</div>
          <div className="stat-value text-lg font-mono">
            {reserve1Formatted.toLocaleString(undefined, { 
              minimumFractionDigits: 2,
              maximumFractionDigits: selectedPool.token1Symbol === "WBTC" || selectedPool.token1Symbol === "WETH" ? 8 : 4
            })}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">常数K</div>
          <div className="stat-value text-lg font-mono">{k.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
          <div className="stat-desc">x · y = k</div>
        </div>
        <div className="stat">
          <div className="stat-title">交易费率</div>
          <div className="stat-value text-lg">{(selectedPool.fee * 100).toFixed(2)}%</div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-60">交易池地址:</span>
          <div className="badge badge-primary font-mono">{selectedPool.address.slice(0, 6)}...{selectedPool.address.slice(-4)}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-60">{selectedPool.token0Symbol} 地址:</span>
          <div className="badge badge-secondary font-mono">{selectedPool.token0.slice(0, 6)}...{selectedPool.token0.slice(-4)}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-60">{selectedPool.token1Symbol} 地址:</span>
          <div className="badge badge-secondary font-mono">{selectedPool.token1.slice(0, 6)}...{selectedPool.token1.slice(-4)}</div>
        </div>
      </div>
    </div>
  );
}; 