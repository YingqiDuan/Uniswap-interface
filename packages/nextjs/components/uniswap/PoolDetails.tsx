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
    if (symbol === "WBTC") {
      return parseFloat((amount / BigInt(10 ** 8)).toString());
    } else if (symbol === "USDC" || symbol === "USDT") {
      return parseFloat((amount / BigInt(10 ** 6)).toString());
    } else {
      return parseFloat((amount / BigInt(10 ** 18)).toString());
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
          <div className="stat-value text-lg">{reserve0Formatted.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="stat-title">{selectedPool.token1Symbol} 储备</div>
          <div className="stat-value text-lg">{reserve1Formatted.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="stat-title">常数K</div>
          <div className="stat-value text-lg">{k.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="stat">
          <div className="stat-title">交易费率</div>
          <div className="stat-value text-lg">{(selectedPool.fee * 100).toFixed(2)}%</div>
        </div>
      </div>
      <div className="mt-4">
        <div className="badge badge-primary">{selectedPool.address.slice(0, 6)}...{selectedPool.address.slice(-4)}</div>
      </div>
    </div>
  );
}; 