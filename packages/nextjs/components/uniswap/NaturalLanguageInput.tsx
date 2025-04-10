"use client";

import React, { useState, useEffect } from "react";
import { parseUnits, formatUnits } from "viem";
import { notification } from "~~/utils/scaffold-eth";
import { type Pool } from "./PoolSelector";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";

interface NaturalLanguageInputProps {
  selectedPool: Pool | null;
  onActionComplete: () => void;
}

type ActionFunction = 'swap' | 'addLiquidity' | 'removeLiquidity';

interface ActionResponse {
  function: ActionFunction;
  parameters: Record<string, any>;
}

export const NaturalLanguageInput: React.FC<NaturalLanguageInputProps> = ({ selectedPool, onActionComplete }) => {
  const [input, setInput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [modelUrl, setModelUrl] = useState<string>("");
  const [useOpenAI, setUseOpenAI] = useState<boolean>(true);
  const [pendingAction, setPendingAction] = useState<ActionResponse | null>(null);

  const { address: connectedAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  
  // Get contract info
  const { data: routerContract } = useDeployedContractInfo("UniswapV2Router02");
  const { data: wethContract } = useDeployedContractInfo("WETH");
  const { data: factoryContract } = useDeployedContractInfo("UniswapV2Factory");

  // 获取LP代币余额
  const { data: lpTokenBalance } = useReadContract({
    address: selectedPool?.address as `0x${string}`,
    abi: [{
      name: "balanceOf",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "owner", type: "address" }],
      outputs: [{ name: "", type: "uint256" }]
    }],
    functionName: "balanceOf",
    args: [connectedAddress as `0x${string}`],
    query: {
      enabled: !!connectedAddress && !!selectedPool?.address,
    }
  });

  // Reset pending action when the pool changes
  useEffect(() => {
    setPendingAction(null);
  }, [selectedPool]);

  // 计算交易的输出金额（考虑滑点）
  const calculateOutputAmount = (inputAmount: bigint, inputReserve: bigint, outputReserve: bigint, slippage: number): bigint => {
    if (inputReserve === BigInt(0) || outputReserve === BigInt(0)) {
      return BigInt(0);
    }
    
    // 根据x*y=k公式计算输出金额
    // outputAmount = (outputReserve * inputAmount) / (inputReserve + inputAmount)
    const inputAmountWithFee = inputAmount * BigInt(997); // 0.3% 交易费
    const numerator = inputAmountWithFee * outputReserve;
    const denominator = (inputReserve * BigInt(1000)) + inputAmountWithFee;
    let outputAmount = numerator / denominator;
    
    // 应用滑点保护，将最小输出金额设为理论输出的(1-slippage)
    outputAmount = outputAmount * BigInt(Math.floor((1 - slippage) * 10000)) / BigInt(10000);
    
    console.log(`计算输出金额: 输入=${inputAmount}, 输入储备=${inputReserve}, 输出储备=${outputReserve}`);
    console.log(`理论输出金额: ${outputAmount}`);
    
    return outputAmount;
  };

  // 计算添加流动性时的另一个代币数量
  const calculatePairAmount = (amount: bigint, thisTokenReserve: bigint, otherTokenReserve: bigint): bigint => {
    if (thisTokenReserve === BigInt(0) || otherTokenReserve === BigInt(0)) {
      return BigInt(0);
    }
    
    // 根据比例计算: amount1 = (amount0 * reserve1) / reserve0
    return (amount * otherTokenReserve) / thisTokenReserve;
  };

  // 计算移除流动性时预期返回的代币数量
  const calculateRemoveLiquidityAmounts = (
    liquidityAmount: bigint, 
    totalSupply: bigint, 
    reserve0: bigint, 
    reserve1: bigint
  ): [bigint, bigint] => {
    if (totalSupply === BigInt(0)) {
      return [BigInt(0), BigInt(0)];
    }
    
    // 根据LP代币比例计算返回的代币数量
    const amount0 = (liquidityAmount * reserve0) / totalSupply;
    const amount1 = (liquidityAmount * reserve1) / totalSupply;
    
    return [amount0, amount1];
  };

  // 获取代币精度 (用于解析金额)
  const getTokenDecimals = (symbol: string | undefined): number => {
    if (!symbol) return 18;
    
    switch (symbol.toUpperCase()) {
      case 'USDC':
      case 'USDT':
        return 6;
      case 'WBTC':
        return 8;
      default:
        return 18;
    }
  };

  // Handle natural language processing
  const handleProcessInput = async () => {
    if (!input.trim()) {
      notification.error("Please enter an instruction");
      return;
    }

    if (!selectedPool) {
      notification.error("Please select a pool first");
      return;
    }

    setIsProcessing(true);
    setPendingAction(null);
    
    try {
      const endpoint = useOpenAI 
        ? '/api/processNaturalLanguage' 
        : modelUrl.trim() || '/api/processNaturalLanguage';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input,
          pool: {
            address: selectedPool.address,
            token0: selectedPool.token0,
            token1: selectedPool.token1,
            token0Symbol: selectedPool.token0Symbol,
            token1Symbol: selectedPool.token1Symbol,
            reserve0: selectedPool.reserve0.toString(),
            reserve1: selectedPool.reserve1.toString(),
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to process: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        notification.error(data.message || "Failed to process your instruction");
        return;
      }

      // Handle the structured response
      const action = data.action as ActionResponse;
      console.log("Received action:", action);
      
      // Set pending action
      setPendingAction(action);
      notification.success("Instruction processed successfully");
      
    } catch (error) {
      console.error("Error processing natural language:", error);
      notification.error("Failed to process your instruction");
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute the requested action
  const executeAction = async () => {
    if (!pendingAction || !selectedPool || !routerContract || !connectedAddress) {
      notification.error("Cannot execute action - missing required data");
      return;
    }

    setIsExecuting(true);
    
    try {
      // Deadline for transactions (20 minutes from now)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
      
      // 获取WETH合约地址用于路径构建
      const wethAddress = wethContract?.address as `0x${string}`;
      
      // Process based on action type
      switch (pendingAction.function) {
        case 'swap': {
          const { fromToken, toToken, amount } = pendingAction.parameters;
          console.log("Executing swap:", { fromToken, toToken, amount });
          
          // 获取代币地址 - 不区分ETH和WETH，全部作为代币处理
          // 这样可以确保和UI中的交互逻辑一致
          const fromTokenAddress = fromToken === selectedPool.token0Symbol 
            ? selectedPool.token0 
            : selectedPool.token1;
          
          const toTokenAddress = toToken === selectedPool.token0Symbol 
            ? selectedPool.token0 
            : selectedPool.token1;
          
          // 解析输入金额 (根据代币精度)
          const fromTokenDecimals = getTokenDecimals(fromToken);
          const amountIn = parseUnits(amount.toString(), fromTokenDecimals);
          
          // 获取池中的储备量，用于计算输出金额
          let inputReserve: bigint;
          let outputReserve: bigint;
          
          if (fromToken === selectedPool.token0Symbol) {
            inputReserve = selectedPool.reserve0;
            outputReserve = selectedPool.reserve1;
          } else {
            inputReserve = selectedPool.reserve1;
            outputReserve = selectedPool.reserve0;
          }
          
          // 计算最小输出金额（考虑5%的滑点）
          const slippagePercent = 0.05; // 5% 滑点保护
          const amountOutMin = calculateOutputAmount(amountIn, inputReserve, outputReserve, slippagePercent);
          
          console.log(`Swap details: 输入金额=${amountIn}, 输入代币=${fromToken}, 输出代币=${toToken}`);
          console.log(`滑点设置: ${slippagePercent * 100}%`);
          console.log(`最小输出金额: ${amountOutMin}`);
          
          // 如果计算的输出金额为0，设置一个非常小的值，允许交易进行
          // 这通常表示我们没有足够的储备数据来准确计算
          const finalAmountOutMin = amountOutMin > 0 ? amountOutMin : BigInt(1);
          
          // 统一使用swapExactTokensForTokens处理所有情况
          // 这样与UI界面上的交互行为保持一致
          console.log("Using swapExactTokensForTokens for all swaps");
          await writeContractAsync({
            address: routerContract.address,
            abi: routerContract.abi,
            functionName: 'swapExactTokensForTokens',
            args: [
              amountIn,
              finalAmountOutMin, // 使用计算出的最小输出金额
              [fromTokenAddress, toTokenAddress],
              connectedAddress,
              deadline
            ]
          });
          
          notification.success("Swap executed successfully");
          break;
        }
        
        case 'addLiquidity': {
          const { token0, token1, amount0, amount1 } = pendingAction.parameters;
          console.log("Executing add liquidity:", { token0, token1, amount0, amount1 });
          
          // 获取代币地址
          const token0Address = token0 === selectedPool.token0Symbol 
            ? selectedPool.token0 
            : selectedPool.token1;
          
          const token1Address = token1 === selectedPool.token0Symbol 
            ? selectedPool.token0 
            : selectedPool.token1;
          
          // 获取代币精度
          const token0Decimals = getTokenDecimals(token0);
          const token1Decimals = getTokenDecimals(token1);
          
          // 解析金额
          let parsedAmount0 = parseUnits(amount0.toString(), token0Decimals);
          let parsedAmount1 = parseUnits(amount1.toString(), token1Decimals);
          
          // 获取池中的储备量
          let reserve0: bigint;
          let reserve1: bigint;
          
          if (token0 === selectedPool.token0Symbol) {
            reserve0 = selectedPool.reserve0;
            reserve1 = selectedPool.reserve1;
          } else {
            reserve0 = selectedPool.reserve1;
            reserve1 = selectedPool.reserve0;
          }
          
          // 如果只提供了一种代币的金额，计算另一种代币所需的金额
          if (parsedAmount0 > 0 && parsedAmount1 === BigInt(0)) {
            parsedAmount1 = calculatePairAmount(parsedAmount0, reserve0, reserve1);
            console.log(`计算token1金额: ${formatUnits(parsedAmount1, token1Decimals)} ${token1}`);
          } else if (parsedAmount0 === BigInt(0) && parsedAmount1 > 0) {
            parsedAmount0 = calculatePairAmount(parsedAmount1, reserve1, reserve0);
            console.log(`计算token0金额: ${formatUnits(parsedAmount0, token0Decimals)} ${token0}`);
          }
          
          // 确保两个金额都大于0
          if (parsedAmount0 === BigInt(0) || parsedAmount1 === BigInt(0)) {
            throw new Error("无法确定添加流动性所需的代币数量");
          }
          
          // 5% 滑点保护
          const slippagePercent = 0.05;
          const minAmount0 = parsedAmount0 * BigInt(Math.floor((1 - slippagePercent) * 100)) / BigInt(100);
          const minAmount1 = parsedAmount1 * BigInt(Math.floor((1 - slippagePercent) * 100)) / BigInt(100);
          
          console.log(`Add Liquidity details: ${formatUnits(parsedAmount0, token0Decimals)} ${token0} 和 ${formatUnits(parsedAmount1, token1Decimals)} ${token1}`);
          console.log(`滑点设置: ${slippagePercent * 100}%`);
          console.log(`最小金额: ${formatUnits(minAmount0, token0Decimals)} ${token0}, ${formatUnits(minAmount1, token1Decimals)} ${token1}`);
          
          // 统一使用addLiquidity处理所有情况
          console.log("Using addLiquidity for all liquidity additions");
          await writeContractAsync({
            address: routerContract.address,
            abi: routerContract.abi,
            functionName: 'addLiquidity',
            args: [
              token0Address,
              token1Address,
              parsedAmount0,
              parsedAmount1,
              minAmount0,
              minAmount1,
              connectedAddress,
              deadline
            ]
          });
          
          notification.success("Liquidity added successfully");
          break;
        }
        
        case 'removeLiquidity': {
          const { token0, token1, percent } = pendingAction.parameters;
          console.log("Executing remove liquidity:", { token0, token1, percent });
          
          // 获取代币地址
          const token0Address = token0 === selectedPool.token0Symbol 
            ? selectedPool.token0 
            : selectedPool.token1;
          
          const token1Address = token1 === selectedPool.token0Symbol 
            ? selectedPool.token0 
            : selectedPool.token1;
          
          // 计算要移除的流动性
          const percentToRemove = Number(percent) / 100;
          
          // 获取当前用户的LP代币余额
          let liquidityAmount: bigint;
          if (lpTokenBalance && lpTokenBalance > BigInt(0)) {
            liquidityAmount = lpTokenBalance;
            console.log(`获取到用户LP代币余额: ${liquidityAmount}`);
          } else {
            // 如果无法获取余额，使用默认值
            liquidityAmount = BigInt("1000000000000000000"); // 1 LP token
            console.log(`使用默认LP代币余额: ${liquidityAmount}`);
          }
          
          // 计算要移除的LP代币数量
          const liquidityToRemove = liquidityAmount * BigInt(Math.floor(percentToRemove * 100)) / BigInt(100);
          console.log(`移除 ${percent}% 流动性，数量: ${liquidityToRemove}`);
          
          // 预估会返回的代币数量
          const totalSupply = BigInt("0"); // 这里应该通过合约调用获取总供应量
          const [expectedAmount0, expectedAmount1] = calculateRemoveLiquidityAmounts(
            liquidityToRemove,
            totalSupply > 0 ? totalSupply : liquidityAmount * BigInt(10), // 如果无法获取总供应量，使用估计值
            selectedPool.reserve0,
            selectedPool.reserve1
          );
          
          // 计算最小返回金额 (5% 滑点保护)
          const slippagePercent = 0.05;
          const minAmount0 = expectedAmount0 > 0 
            ? expectedAmount0 * BigInt(Math.floor((1 - slippagePercent) * 100)) / BigInt(100)
            : BigInt(1);
          const minAmount1 = expectedAmount1 > 0
            ? expectedAmount1 * BigInt(Math.floor((1 - slippagePercent) * 100)) / BigInt(100)
            : BigInt(1);
          
          console.log(`预期返回: ${expectedAmount0} ${selectedPool.token0Symbol}, ${expectedAmount1} ${selectedPool.token1Symbol}`);
          console.log(`最小返回: ${minAmount0} ${selectedPool.token0Symbol}, ${minAmount1} ${selectedPool.token1Symbol}`);
          
          // 统一使用removeLiquidity处理所有情况
          console.log("Using removeLiquidity for all liquidity removals");
          await writeContractAsync({
            address: routerContract.address,
            abi: routerContract.abi,
            functionName: 'removeLiquidity',
            args: [
              token0Address,
              token1Address,
              liquidityToRemove,
              minAmount0,
              minAmount1,
              connectedAddress,
              deadline
            ]
          });
          
          notification.success("Liquidity removed successfully");
          break;
        }
        
        default:
          notification.error(`Unknown action: ${pendingAction.function}`);
          return;
      }
      
      // Reset input and pending action after successful execution
      setInput("");
      setPendingAction(null);
      
      // Trigger refresh of pool data
      onActionComplete();
      
    } catch (error) {
      console.error("Error executing action:", error);
      notification.error("Failed to execute action");
    } finally {
      setIsExecuting(false);
    }
  };

  // Toggle between OpenAI and custom model
  const handleModelToggle = () => {
    setUseOpenAI(!useOpenAI);
  };

  // Render pending action details
  const renderPendingAction = () => {
    if (!pendingAction) return null;
    
    const { function: actionType, parameters } = pendingAction;
    
    let description = "";
    switch (actionType) {
      case 'swap':
        description = `Swap ${parameters.amount} ${parameters.fromToken} for ${parameters.toToken}`;
        break;
      case 'addLiquidity':
        description = `Add liquidity with ${parameters.amount0} ${parameters.token0} and ${parameters.amount1} ${parameters.token1}`;
        break;
      case 'removeLiquidity':
        description = `Remove ${parameters.percent}% of liquidity from ${parameters.token0}/${parameters.token1} pool`;
        break;
    }
    
    return (
      <div className="alert alert-info mt-4">
        <div>
          <h3 className="font-bold">Pending Action</h3>
          <p>{description}</p>
          <div className="mt-2">
            <button 
              className={`btn btn-primary mr-2 ${isExecuting ? 'loading' : ''}`}
              onClick={executeAction}
              disabled={isExecuting}
            >
              {isExecuting ? 'Executing...' : 'Execute Action'}
            </button>
            <button 
              className="btn btn-ghost"
              onClick={() => setPendingAction(null)}
              disabled={isExecuting}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Natural Language Interaction</h2>
        <p className="text-sm mb-3">
          Enter instructions in natural language like "Swap 0.1 ETH for USDC" or "Add liquidity with 0.5 ETH and 1000 USDC"
        </p>
        
        <div className="form-control">
          <div className="flex items-center gap-2 mb-2">
            <label className="label cursor-pointer">
              <input 
                type="checkbox" 
                className="toggle toggle-primary" 
                checked={useOpenAI}
                onChange={handleModelToggle}
              />
              <span className="label-text ml-2">
                {useOpenAI ? "Using OpenAI (default)" : "Using Custom Model"}
              </span>
            </label>
          </div>
          
          {!useOpenAI && (
            <input
              type="text"
              placeholder="Enter custom model API URL (optional)"
              className="input input-bordered w-full mb-4"
              value={modelUrl}
              onChange={(e) => setModelUrl(e.target.value)}
            />
          )}
          
          <textarea 
            className="textarea textarea-bordered w-full h-24"
            placeholder="Enter your instruction here (e.g., 'Swap 0.1 ETH for USDC')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          
          <button 
            className={`btn btn-primary mt-4 ${isProcessing ? 'loading' : ''}`}
            onClick={handleProcessInput}
            disabled={isProcessing || !input.trim() || !selectedPool}
          >
            {isProcessing ? 'Processing...' : 'Process Instruction'}
          </button>
        </div>
        
        {renderPendingAction()}
      </div>
    </div>
  );
};

export default NaturalLanguageInput; 