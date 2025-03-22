"use client";

import React, { useState, useEffect } from "react";
import { type Pool } from "./PoolSelector";

interface SwapInterfaceProps {
  selectedPool: Pool | null;
}

export const SwapInterface: React.FC<SwapInterfaceProps> = ({ selectedPool }) => {
  const [inputAmount, setInputAmount] = useState<string>("");
  const [outputAmount, setOutputAmount] = useState<string>("");
  const [slippage, setSlippage] = useState<number>(0.5);
  const [swapDirection, setSwapDirection] = useState<"token0ToToken1" | "token1ToToken0">("token0ToToken1");
  const [priceImpact, setPriceImpact] = useState<number>(0);

  // 当输入金额或选择的池子变化时，计算输出金额
  useEffect(() => {
    if (!selectedPool || !inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount("");
      setPriceImpact(0);
      return;
    }

    // 获取当前储备
    const reserve0 = swapDirection === "token0ToToken1" ? selectedPool.reserve0 : selectedPool.reserve1;
    const reserve1 = swapDirection === "token0ToToken1" ? selectedPool.reserve1 : selectedPool.reserve0;
    
    // 计算输入金额（考虑token小数位）
    let inputAmountInWei: bigint;
    const tokenSymbol = swapDirection === "token0ToToken1" ? selectedPool.token0Symbol : selectedPool.token1Symbol;
    
    if (tokenSymbol === "WBTC") {
      inputAmountInWei = BigInt(Math.floor(parseFloat(inputAmount) * 10 ** 8));
    } else if (tokenSymbol === "USDC" || tokenSymbol === "USDT") {
      inputAmountInWei = BigInt(Math.floor(parseFloat(inputAmount) * 10 ** 6));
    } else {
      inputAmountInWei = BigInt(Math.floor(parseFloat(inputAmount) * 10 ** 18));
    }
    
    // 计算输出金额（考虑0.3%的交易费）
    const inputWithFee = inputAmountInWei * BigInt(997);
    const numerator = inputWithFee * reserve1;
    const denominator = reserve0 * BigInt(1000) + inputWithFee;
    const outputAmountInWei = numerator / denominator;
    
    // 格式化输出金额
    let formattedOutput: string;
    const outputTokenSymbol = swapDirection === "token0ToToken1" ? selectedPool.token1Symbol : selectedPool.token0Symbol;
    
    if (outputTokenSymbol === "WBTC") {
      formattedOutput = (Number(outputAmountInWei) / 10 ** 8).toFixed(8);
    } else if (outputTokenSymbol === "USDC" || outputTokenSymbol === "USDT") {
      formattedOutput = (Number(outputAmountInWei) / 10 ** 6).toFixed(6);
    } else {
      formattedOutput = (Number(outputAmountInWei) / 10 ** 18).toFixed(6);
    }
    
    setOutputAmount(formattedOutput);
    
    // 计算价格影响
    const spotPrice = Number(reserve1) / Number(reserve0);
    const executionPrice = Number(outputAmountInWei) / Number(inputAmountInWei);
    const impact = Math.abs((spotPrice - executionPrice) / spotPrice * 100);
    setPriceImpact(impact > 100 ? 100 : impact); // 限制最大值为100%
    
  }, [inputAmount, selectedPool, swapDirection]);

  // 交换代币方向
  const handleSwapDirection = () => {
    setSwapDirection(swapDirection === "token0ToToken1" ? "token1ToToken0" : "token0ToToken1");
    setInputAmount(""); // 清空输入，避免计算错误
    setOutputAmount("");
  };

  // 获取代币符号
  const getTokenSymbols = () => {
    if (!selectedPool) return { fromSymbol: "?", toSymbol: "?" };
    
    if (swapDirection === "token0ToToken1") {
      return {
        fromSymbol: selectedPool.token0Symbol,
        toSymbol: selectedPool.token1Symbol
      };
    } else {
      return {
        fromSymbol: selectedPool.token1Symbol,
        toSymbol: selectedPool.token0Symbol
      };
    }
  };

  const { fromSymbol, toSymbol } = getTokenSymbols();

  if (!selectedPool) {
    return <div className="card bg-base-100 shadow-xl p-6">请选择一个交易池以开始兑换</div>;
  }

  return (
    <div className="card bg-base-100 shadow-xl p-6">
      <h2 className="text-xl font-bold mb-4">代币兑换</h2>
      
      {/* 输入金额 */}
      <div className="form-control mb-2">
        <label className="label">
          <span className="label-text">你支付</span>
        </label>
        <div className="input-group">
          <input
            type="number"
            placeholder="0.0"
            className="input input-bordered w-full"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            min="0"
            step="0.000001"
          />
          <span className="btn btn-square">{fromSymbol}</span>
        </div>
      </div>
      
      {/* 交换方向按钮 */}
      <div className="flex justify-center my-2">
        <button 
          className="btn btn-circle btn-sm"
          onClick={handleSwapDirection}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>
      
      {/* 输出金额 */}
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">你收到</span>
        </label>
        <div className="input-group">
          <input
            type="text"
            className="input input-bordered w-full"
            value={outputAmount}
            readOnly
            placeholder="0.0"
          />
          <span className="btn btn-square">{toSymbol}</span>
        </div>
      </div>
      
      {/* 滑点设置 */}
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">滑点容忍度: {slippage}%</span>
        </label>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          value={slippage}
          onChange={(e) => setSlippage(parseFloat(e.target.value))}
          className="range range-primary range-sm"
        />
        <div className="flex justify-between text-xs px-2">
          <span>0.1%</span>
          <span>1%</span>
          <span>5%</span>
        </div>
      </div>
      
      {/* 交易详情 */}
      {inputAmount && outputAmount && (
        <div className="bg-base-200 p-4 rounded-lg mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm opacity-70">价格</span>
            <span className="text-sm">
              1 {fromSymbol} = {(parseFloat(outputAmount) / parseFloat(inputAmount)).toFixed(6)} {toSymbol}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm opacity-70">最小接收</span>
            <span className="text-sm">
              {(parseFloat(outputAmount) * (1 - slippage / 100)).toFixed(6)} {toSymbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm opacity-70">价格影响</span>
            <span className={`text-sm ${priceImpact > 5 ? "text-error" : priceImpact > 1 ? "text-warning" : "text-success"}`}>
              {priceImpact.toFixed(2)}%
            </span>
          </div>
        </div>
      )}
      
      {/* 兑换按钮 */}
      <button 
        className="btn btn-primary w-full"
        disabled={!inputAmount || parseFloat(inputAmount) <= 0}
        onClick={() => alert("此功能尚未实现，将连接到真实智能合约。")}
      >
        兑换
      </button>
    </div>
  );
}; 