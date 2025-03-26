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

  // Get router contract
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

  // Calculate output amount when input amount or selected pool changes
  useEffect(() => {
    if (!selectedPool || !inputAmount || parseFloat(inputAmount) <= 0) {
      setOutputAmount("");
      setPriceImpact(0);
      return;
    }

    // Get current reserves
    const reserve0 = swapDirection === "token0ToToken1" ? selectedPool.reserve0 : selectedPool.reserve1;
    const reserve1 = swapDirection === "token0ToToken1" ? selectedPool.reserve1 : selectedPool.reserve0;
    
    // Calculate input amount (considering token decimals)
    let inputAmountInWei: bigint;
    const tokenSymbol = swapDirection === "token0ToToken1" ? selectedPool.token0Symbol : selectedPool.token1Symbol;
    
    if (tokenSymbol === "WBTC") {
      inputAmountInWei = BigInt(Math.floor(parseFloat(inputAmount) * 10 ** 8));
    } else if (tokenSymbol === "USDC" || tokenSymbol === "USDT") {
      inputAmountInWei = BigInt(Math.floor(parseFloat(inputAmount) * 10 ** 6));
    } else {
      inputAmountInWei = BigInt(Math.floor(parseFloat(inputAmount) * 10 ** 18));
    }
    
    // Calculate output amount (considering 0.3% swap fee)
    const inputWithFee = inputAmountInWei * BigInt(997);
    const numerator = inputWithFee * reserve1;
    const denominator = reserve0 * BigInt(1000) + inputWithFee;
    const outputAmountInWei = numerator / denominator;
    
    // Update output amount formatting logic
    const outputTokenSymbol = swapDirection === "token0ToToken1" ? selectedPool.token1Symbol : selectedPool.token0Symbol;

    // Determine decimal places based on token type
    let decimals = 6;
    if (outputTokenSymbol === "WBTC") decimals = 8;
    else if (outputTokenSymbol === "WETH") decimals = 8; // WETH uses 8 decimal places
    else if (outputTokenSymbol === "USDC" || outputTokenSymbol === "USDT") decimals = 6;
    else if (outputTokenSymbol === "TEST") decimals = 6;

    // Adjust decimal places based on value size
    const outputValue = Number(outputAmountInWei) / (10 ** getDecimals(outputTokenSymbol));
    let formattedOutput: string;

    if (outputValue < 0.000001) {
      formattedOutput = outputValue.toExponential(6); // Use scientific notation
    } else if (outputValue < 0.1) {
      formattedOutput = outputValue.toFixed(decimals); // Small values use more decimal places
    } else if (outputValue < 1) {
      formattedOutput = outputValue.toFixed(Math.min(decimals, 6)); // Medium values
    } else {
      formattedOutput = outputValue.toFixed(Math.min(decimals, 4)); // Large values
    }

    console.log(`Formatted output: ${outputAmountInWei} → ${outputValue} → ${formattedOutput} (${outputTokenSymbol})`);
    setOutputAmount(formattedOutput);
    
    // Calculate price impact
    const spotPrice = Number(reserve1) / Number(reserve0);
    const executionPrice = Number(outputAmountInWei) / Number(inputAmountInWei);
    const impact = Math.abs((spotPrice - executionPrice) / spotPrice * 100);
    setPriceImpact(impact > 100 ? 100 : impact); // Limit max value to 100%
    
  }, [inputAmount, selectedPool, swapDirection]);

  // Switch token direction
  const handleSwapDirection = () => {
    setSwapDirection(swapDirection === "token0ToToken1" ? "token1ToToken0" : "token0ToToken1");
    setInputAmount(""); // Clear input to avoid calculation errors
    setOutputAmount("");
    setTxHash(null);
  };

  // Get token symbols
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

  // Get token addresses
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

  // Get token decimals
  const getDecimals = (symbol: string) => {
    if (symbol === "WBTC") return 8;
    if (symbol === "USDC" || symbol === "USDT") return 6;
    if (symbol === "TEST") return 18; // 确保TEST代币使用正确的精度
    return 18; // Default is 18 (most ERC20 tokens)
  };

  // Handle token approval
  const handleApprove = async () => {
    if (!selectedPool || !account || !inputAmount) return;
    
    try {
      setIsApproving(true);
      
      const { fromToken, toToken } = getTokenAddresses();
      const { fromSymbol } = getTokenSymbols();
      
      if (!fromToken) {
        throw new Error("Token address not found");
      }
      
      const amountToApprove = parseUnits(inputAmount, getDecimals(fromSymbol));
      
      // Authorize Router contract to use tokens
      const approveTx = await writeContractAsync({
        address: fromToken,
        abi: erc20Abi,
        functionName: "approve",
        args: [routerAddress, amountToApprove],
      });
      
      setTxHash(approveTx);
      
    } catch (error) {
      console.error("Approval failed:", error);
      alert("Approval failed, please check console for more information");
    } finally {
      setIsApproving(false);
    }
  };

  // Execute token swap
  const handleSwap = async () => {
    if (!selectedPool || !account || !inputAmount || !outputAmount) return;
    
    try {
      setIsSwapping(true);
      
      const { fromToken, toToken } = getTokenAddresses();
      const { fromSymbol, toSymbol } = getTokenSymbols();
      
      if (!fromToken || !toToken) {
        throw new Error("Token address not found");
      }
      
      // Calculate swap parameters
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // Expires in 20 minutes
      const amountIn = parseUnits(inputAmount, getDecimals(fromSymbol));

      // 使用更激进的滑点保护，确保交易能够执行成功
      // 当price impact很高时，我们需要设置更保守的amountOutMin
      const effectiveSlippage = priceImpact > 10 ? Math.max(slippage, priceImpact + 5) : slippage;
      console.log(`Using effective slippage: ${effectiveSlippage}% (original: ${slippage}%, price impact: ${priceImpact}%)`);

      const amountOutMin = parseUnits(
        (parseFloat(outputAmount) * (1 - effectiveSlippage / 100)).toFixed(
          Math.min(getDecimals(toSymbol), 8) // Use at most 8 decimal places
        ), 
        getDecimals(toSymbol)
      );
      
      console.log("Swap parameters:", {
        amountIn: amountIn.toString(),
        amountOutMin: amountOutMin.toString(),
        path: [fromToken, toToken],
        to: account,
        deadline,
        routerAddress,
        fromSymbol,
        toSymbol,
        fromTokenDecimals: getDecimals(fromSymbol),
        toTokenDecimals: getDecimals(toSymbol)
      });
      
      // Execute swap with support for fee-on-transfer tokens
      const swapTx = await writeContractAsync({
        address: routerAddress,
        abi: routerAbi,
        functionName: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
        args: [
          amountIn,
          amountOutMin,
          [fromToken, toToken],
          account,
          BigInt(deadline)
        ],
      });
      
      setTxHash(swapTx);
      
    } catch (error: any) {
      console.error("Swap failed with error:", error);
      
      // 尝试提取更详细的错误信息
      if (error.toString().includes("execution reverted")) {
        const revertReason = error.toString().match(/execution reverted: (.*?)(?:$|"\})/);
        if (revertReason && revertReason[1]) {
          console.error("Revert reason:", revertReason[1]);
          alert(`Swap failed: ${revertReason[1]}`);
        } else {
          alert("Swap failed, please check console for more information");
        }
      } else {
        alert("Swap failed, please check console for more information");
      }
    } finally {
      setIsSwapping(false);
    }
  };

  const { fromSymbol, toSymbol } = getTokenSymbols();

  if (!selectedPool) {
    return <div className="card bg-base-100 shadow-xl p-6">Please select a pool to start swapping</div>;
  }

  return (
    <div className="card bg-base-100 shadow-xl p-6">
      <h2 className="text-xl font-bold mb-4">Token Swap</h2>
      
      {txHash && (isTxSuccess || isWaitingForTx) && (
        <div className={`alert ${isTxSuccess ? 'alert-success' : 'alert-info'} mb-4`}>
          <div>
            {isWaitingForTx ? (
              <>
                <span className="loading loading-spinner loading-xs mr-2"></span>
                <span>Transaction processing...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Transaction successful!</span>
              </>
            )}
          </div>
          <div className="text-xs mt-1">
            <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="link">
              View on Etherscan
            </a>
          </div>
        </div>
      )}
      
      {/* Input amount */}
      <div className="form-control mb-2">
        <label className="label">
          <span className="label-text">You pay</span>
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
      
      {/* Swap direction button */}
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
      
      {/* Output amount */}
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">You receive</span>
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
      
      {/* Slippage setting */}
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">Slippage tolerance: {slippage}%</span>
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
      
      {/* Transaction details */}
      {inputAmount && outputAmount && (
        <div className="bg-base-200 p-4 rounded-lg mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm opacity-70">Price</span>
            <span className="text-sm">
              1 {fromSymbol} = {parseFloat(inputAmount) > 0 
                ? (parseFloat(outputAmount) / parseFloat(inputAmount)).toFixed(
                    fromSymbol === "WETH" || toSymbol === "WETH" ? 8 : 6
                  ) 
                : "0"} {toSymbol}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm opacity-70">Minimum received</span>
            <span className="text-sm">
              {parseFloat(outputAmount) > 0 
                ? (parseFloat(outputAmount) * (1 - slippage / 100)).toFixed(
                    toSymbol === "WETH" || toSymbol === "WBTC" ? 8 : 6
                  )
                : "0"} {toSymbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm opacity-70">Price impact</span>
            <span className={`text-sm ${priceImpact > 5 ? "text-error" : priceImpact > 1 ? "text-warning" : "text-success"}`}>
              {priceImpact.toFixed(2)}%
            </span>
          </div>
        </div>
      )}
      
      {/* Buttons */}
      <div className="flex flex-col gap-2">
        {!account ? (
          <button className="btn btn-primary w-full">
            Please connect wallet first
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
                  Approving...
                </>
              ) : "Approve token"}
            </button>
            <button 
              className={`btn btn-primary w-full ${isSwapping ? 'btn-disabled' : ''}`}
              disabled={!inputAmount || parseFloat(inputAmount) <= 0 || isSwapping || isWaitingForTx}
              onClick={handleSwap}
            >
              {isSwapping ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Swapping...
                </>
              ) : "Swap"}
            </button>
          </>
        )}
      </div>
      
      {/* Testnet notice */}
      <div className="mt-4 text-xs text-center opacity-70">
        This interface is connected to the Sepolia testnet, please ensure your wallet is switched to the correct network
      </div>
    </div>
  );
}; 