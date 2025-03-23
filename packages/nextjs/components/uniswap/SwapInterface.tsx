"use client";

import React, { useState, useEffect } from "react";
import { type Pool } from "./PoolSelector";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import externalContracts from "~~/contracts/externalContracts";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

interface SwapInterfaceProps {
  selectedPool: Pool | null;
}

export const SwapInterface: React.FC<SwapInterfaceProps> = ({ selectedPool }) => {
  const [inputAmount, setInputAmount] = useState<string>("");
  const [outputAmount, setOutputAmount] = useState<string>("");
  const [slippage, setSlippage] = useState<number>(0.5);
  const [swapDirection, setSwapDirection] = useState<"token0ToToken1" | "token1ToToken0">("token0ToToken1");
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { address: account } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { writeContractAsync } = useWriteContract();
  const { isLoading: isWaitingForTx, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}` | undefined,
  });

  // 获取路由合约
  const routerAddress = externalContracts[11155111].UniswapV2Router02.address as `0x${string}`;
  const routerAbi = externalContracts[11155111].UniswapV2Router02.abi;
  const erc20Abi = [
    {
      "constant": false,
      "inputs": [
        { "name": "_spender", "type": "address" },
        { "name": "_value", "type": "uint256" }
      ],
      "name": "approve",
      "outputs": [{ "name": "", "type": "bool" }],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        { "name": "_owner", "type": "address" },
        { "name": "_spender", "type": "address" }
      ],
      "name": "allowance",
      "outputs": [{ "name": "", "type": "uint256" }],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    }
  ];

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
    
    // 更新格式化输出金额的逻辑
    const outputTokenSymbol = swapDirection === "token0ToToken1" ? selectedPool.token1Symbol : selectedPool.token0Symbol;

    // 根据代币类型确定小数位数
    let decimals = 6;
    if (outputTokenSymbol === "WBTC") decimals = 8;
    else if (outputTokenSymbol === "WETH") decimals = 8; // WETH使用8位小数显示
    else if (outputTokenSymbol === "USDC" || outputTokenSymbol === "USDT") decimals = 6;
    else if (outputTokenSymbol === "TEST") decimals = 6;

    // 根据值的大小调整小数位数
    const outputValue = Number(outputAmountInWei) / (10 ** getDecimals(outputTokenSymbol));
    let formattedOutput: string;

    if (outputValue < 0.000001) {
      formattedOutput = outputValue.toExponential(6); // 使用科学计数法
    } else if (outputValue < 0.1) {
      formattedOutput = outputValue.toFixed(decimals); // 小值使用更多小数位
    } else if (outputValue < 1) {
      formattedOutput = outputValue.toFixed(Math.min(decimals, 6)); // 中等值
    } else {
      formattedOutput = outputValue.toFixed(Math.min(decimals, 4)); // 大值
    }

    console.log(`格式化输出: ${outputAmountInWei} → ${outputValue} → ${formattedOutput} (${outputTokenSymbol})`);
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
    setTxHash(null);
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

  // 获取代币地址
  const getTokenAddresses = () => {
    if (!selectedPool) return { fromToken: null, toToken: null };
    
    if (swapDirection === "token0ToToken1") {
      return {
        fromToken: selectedPool.token0,
        toToken: selectedPool.token1
      };
    } else {
      return {
        fromToken: selectedPool.token1,
        toToken: selectedPool.token0
      };
    }
  };

  // 获取代币小数位数
  const getDecimals = (symbol: string) => {
    if (symbol === "WBTC") return 8;
    if (symbol === "USDC" || symbol === "USDT") return 6;
    return 18; // 默认为18位（大多数ERC20代币）
  };

  // 处理代币授权
  const handleApprove = async () => {
    if (!selectedPool || !account || !inputAmount) return;
    
    try {
      setIsApproving(true);
      
      const { fromToken, toToken } = getTokenAddresses();
      const { fromSymbol } = getTokenSymbols();
      
      if (!fromToken) {
        throw new Error("未找到代币地址");
      }
      
      const amountToApprove = parseUnits(inputAmount, getDecimals(fromSymbol));
      
      // 授权Router合约使用代币
      const approveTx = await writeContractAsync({
        address: fromToken,
        abi: erc20Abi,
        functionName: "approve",
        args: [routerAddress, amountToApprove],
      });
      
      setTxHash(approveTx);
      
    } catch (error) {
      console.error("授权失败:", error);
      alert("授权失败，请查看控制台了解更多信息");
    } finally {
      setIsApproving(false);
    }
  };

  // 执行代币交换
  const handleSwap = async () => {
    if (!selectedPool || !account || !inputAmount || !outputAmount) return;
    
    try {
      setIsSwapping(true);
      
      const { fromToken, toToken } = getTokenAddresses();
      const { fromSymbol, toSymbol } = getTokenSymbols();
      
      if (!fromToken || !toToken) {
        throw new Error("未找到代币地址");
      }
      
      // 计算交换参数
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20分钟后过期
      const amountIn = parseUnits(inputAmount, getDecimals(fromSymbol));
      const amountOutMin = parseUnits(
        (parseFloat(outputAmount) * (1 - slippage / 100)).toFixed(
          Math.min(getDecimals(toSymbol), 8) // 最多使用8位小数
        ), 
        getDecimals(toSymbol)
      );
      
      console.log("交换参数:", {
        amountIn: amountIn.toString(),
        amountOutMin: amountOutMin.toString(),
        path: [fromToken, toToken],
        to: account,
        deadline
      });
      
      // 执行交换
      const swapTx = await writeContractAsync({
        address: routerAddress,
        abi: routerAbi,
        functionName: "swapExactTokensForTokens",
        args: [
          amountIn,
          amountOutMin,
          [fromToken, toToken],
          account,
          BigInt(deadline)
        ],
      });
      
      setTxHash(swapTx);
      
    } catch (error) {
      console.error("交换失败:", error);
      alert("交换失败，请查看控制台了解更多信息");
    } finally {
      setIsSwapping(false);
    }
  };

  const { fromSymbol, toSymbol } = getTokenSymbols();

  if (!selectedPool) {
    return <div className="card bg-base-100 shadow-xl p-6">请选择一个交易池以开始兑换</div>;
  }

  return (
    <div className="card bg-base-100 shadow-xl p-6">
      <h2 className="text-xl font-bold mb-4">代币兑换</h2>
      
      {txHash && (isTxSuccess || isWaitingForTx) && (
        <div className={`alert ${isTxSuccess ? 'alert-success' : 'alert-info'} mb-4`}>
          <div>
            {isWaitingForTx ? (
              <>
                <span className="loading loading-spinner loading-xs mr-2"></span>
                <span>交易处理中...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>交易成功!</span>
              </>
            )}
          </div>
          <div className="text-xs mt-1">
            <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="link">
              在Etherscan上查看
            </a>
          </div>
        </div>
      )}
      
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
            disabled={isApproving || isSwapping || isWaitingForTx}
          />
          <span className="btn btn-square">{fromSymbol}</span>
        </div>
      </div>
      
      {/* 交换方向按钮 */}
      <div className="flex justify-center my-2">
        <button 
          className="btn btn-circle btn-sm"
          onClick={handleSwapDirection}
          disabled={isApproving || isSwapping || isWaitingForTx}
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
          disabled={isApproving || isSwapping || isWaitingForTx}
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
              1 {fromSymbol} = {parseFloat(inputAmount) > 0 
                ? (parseFloat(outputAmount) / parseFloat(inputAmount)).toFixed(
                    fromSymbol === "WETH" || toSymbol === "WETH" ? 8 : 6
                  ) 
                : "0"} {toSymbol}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm opacity-70">最小接收</span>
            <span className="text-sm">
              {parseFloat(outputAmount) > 0 
                ? (parseFloat(outputAmount) * (1 - slippage / 100)).toFixed(
                    toSymbol === "WETH" || toSymbol === "WBTC" ? 8 : 6
                  )
                : "0"} {toSymbol}
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
      
      {/* 按钮组 */}
      <div className="flex flex-col gap-2">
        {!account ? (
          <button className="btn btn-primary w-full">
            请先连接钱包
          </button>
        ) : (
          <>
            <button 
              className={`btn btn-outline w-full ${isApproving ? 'btn-disabled' : ''}`}
              disabled={!inputAmount || parseFloat(inputAmount) <= 0 || isApproving || isSwapping || isWaitingForTx}
              onClick={handleApprove}
            >
              {isApproving ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  授权中...
                </>
              ) : "授权代币"}
            </button>
            <button 
              className={`btn btn-primary w-full ${isSwapping ? 'btn-disabled' : ''}`}
              disabled={!inputAmount || parseFloat(inputAmount) <= 0 || isSwapping || isWaitingForTx}
              onClick={handleSwap}
            >
              {isSwapping ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  兑换中...
                </>
              ) : "兑换"}
            </button>
          </>
        )}
      </div>
      
      {/* 测试网提示 */}
      <div className="mt-4 text-xs text-center opacity-70">
        此界面连接到Sepolia测试网，请确保您的钱包已切换到正确的网络
      </div>
    </div>
  );
}; 