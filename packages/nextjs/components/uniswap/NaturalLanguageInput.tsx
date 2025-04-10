"use client";

import React, { useState, useEffect } from "react";
import { parseUnits } from "viem";
import { notification } from "~~/utils/scaffold-eth";
import { type Pool } from "./PoolSelector";
import { useAccount, useWriteContract } from "wagmi";
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

  // Reset pending action when the pool changes
  useEffect(() => {
    setPendingAction(null);
  }, [selectedPool]);

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
      
      // Check if we're dealing with WETH specifically (not ETH)
      // WETH只是与ETH 1:1兑换的代币，这里需要区分处理
      const isToken0Weth = selectedPool.token0Symbol === "WETH" && selectedPool.token0 === wethContract?.address;
      const isToken1Weth = selectedPool.token1Symbol === "WETH" && selectedPool.token1 === wethContract?.address;
      
      // Process based on action type
      switch (pendingAction.function) {
        case 'swap': {
          const { fromToken, toToken, amount } = pendingAction.parameters;
          console.log("Executing swap:", { fromToken, toToken, amount });
          
          // 明确区分ETH和WETH
          // 当用户输入ETH时，我们假设他们是想使用原生ETH
          // 当用户输入WETH时，我们假设他们是想使用WETH代币
          const isFromETH = fromToken === "ETH"; // 只有明确指定ETH才用原生ETH
          const isToETH = toToken === "ETH"; // 只有明确指定ETH才接收原生ETH
          
          // 当用户输入WETH时，或者选中的池中有WETH时，正确处理WETH代币地址
          const fromTokenIsWETH = fromToken === "WETH" || 
                                (fromToken === selectedPool.token0Symbol && isToken0Weth) ||
                                (fromToken === selectedPool.token1Symbol && isToken1Weth);
          
          const toTokenIsWETH = toToken === "WETH" || 
                               (toToken === selectedPool.token0Symbol && isToken0Weth) || 
                               (toToken === selectedPool.token1Symbol && isToken1Weth);
          
          // 获取正确的代币地址
          // 对于WETH，使用WETH合约地址
          // 对于其他代币，使用代币地址
          const fromTokenAddress = fromTokenIsWETH 
            ? wethContract?.address 
            : (fromToken === selectedPool.token0Symbol 
                ? selectedPool.token0 
                : selectedPool.token1);
          
          const toTokenAddress = toTokenIsWETH 
            ? wethContract?.address 
            : (toToken === selectedPool.token0Symbol 
                ? selectedPool.token0 
                : selectedPool.token1);
          
          // Parse the amount with proper decimals (assuming 18 decimals for now)
          const amountIn = parseUnits(amount.toString(), 18);
          
          // 5% slippage
          const slippagePercent = 0.05;
          const amountOutMin = BigInt(Number(amountIn) * 0.95);
          
          if (isFromETH && !isToETH) {
            // ETH to Token (使用原生ETH兑换代币)
            console.log("Using swapExactETHForTokens for ETH -> Token swap");
            await writeContractAsync({
              address: routerContract.address,
              abi: routerContract.abi,
              functionName: 'swapExactETHForTokens',
              args: [
                amountOutMin,
                [wethContract?.address, toTokenAddress],
                connectedAddress,
                deadline
              ],
              value: amountIn
            });
          } else if (!isFromETH && isToETH) {
            // Token to ETH (将代币兑换为原生ETH)
            console.log("Using swapExactTokensForETH for Token -> ETH swap");
            await writeContractAsync({
              address: routerContract.address,
              abi: routerContract.abi,
              functionName: 'swapExactTokensForETH',
              args: [
                amountIn,
                amountOutMin,
                [fromTokenAddress, wethContract?.address],
                connectedAddress,
                deadline
              ]
            });
          } else {
            // Token to Token 或 WETH to Token 或 Token to WETH 或 WETH to WETH
            // 这些情况都使用swapExactTokensForTokens
            console.log("Using swapExactTokensForTokens for token swap");
            await writeContractAsync({
              address: routerContract.address,
              abi: routerContract.abi,
              functionName: 'swapExactTokensForTokens',
              args: [
                amountIn,
                amountOutMin,
                [fromTokenAddress, toTokenAddress],
                connectedAddress,
                deadline
              ]
            });
          }
          
          notification.success("Swap executed successfully");
          break;
        }
        
        case 'addLiquidity': {
          const { token0, token1, amount0, amount1 } = pendingAction.parameters;
          console.log("Executing add liquidity:", { token0, token1, amount0, amount1 });
          
          // 区分ETH和WETH
          const isToken0ETH = token0 === "ETH"; // 只有明确指定ETH才用原生ETH
          const isToken1ETH = token1 === "ETH"; // 只有明确指定ETH才用原生ETH
          
          // 处理WETH代币
          const token0IsWETH = token0 === "WETH" || 
                            (token0 === selectedPool.token0Symbol && isToken0Weth) || 
                            (token0 === selectedPool.token1Symbol && isToken1Weth);
          
          const token1IsWETH = token1 === "WETH" || 
                            (token1 === selectedPool.token0Symbol && isToken0Weth) || 
                            (token1 === selectedPool.token1Symbol && isToken1Weth);
          
          // Parse amounts with proper decimals (assuming 18 decimals for now)
          const parsedAmount0 = parseUnits(amount0.toString(), 18);
          const parsedAmount1 = parseUnits(amount1.toString(), 18);
          
          // 5% slippage
          const slippagePercent = 0.05;
          const minAmount0 = BigInt(Number(parsedAmount0) * 0.95);
          const minAmount1 = BigInt(Number(parsedAmount1) * 0.95);
          
          // 获取正确的代币地址
          const token0Address = token0IsWETH 
            ? wethContract?.address 
            : (token0 === selectedPool.token0Symbol 
                ? selectedPool.token0 
                : selectedPool.token1);
          
          const token1Address = token1IsWETH 
            ? wethContract?.address 
            : (token1 === selectedPool.token0Symbol 
                ? selectedPool.token0 
                : selectedPool.token1);
          
          if (isToken0ETH || isToken1ETH) {
            // 使用ETH + Token添加流动性
            console.log("Using addLiquidityETH for ETH + Token liquidity");
            const tokenAddress = isToken0ETH ? token1Address : token0Address;
            const ethAmount = isToken0ETH ? parsedAmount0 : parsedAmount1;
            const tokenAmount = isToken0ETH ? parsedAmount1 : parsedAmount0;
            const minTokenAmount = isToken0ETH ? minAmount1 : minAmount0;
            const minEthAmount = isToken0ETH ? minAmount0 : minAmount1;
            
            await writeContractAsync({
              address: routerContract.address,
              abi: routerContract.abi,
              functionName: 'addLiquidityETH',
              args: [
                tokenAddress,
                tokenAmount,
                minTokenAmount,
                minEthAmount,
                connectedAddress,
                deadline
              ],
              value: ethAmount
            });
          } else {
            // Token + Token 或 WETH + Token 或 WETH + WETH
            // 这些情况都使用addLiquidity
            console.log("Using addLiquidity for token + token liquidity");
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
          }
          
          notification.success("Liquidity added successfully");
          break;
        }
        
        case 'removeLiquidity': {
          const { token0, token1, percent } = pendingAction.parameters;
          console.log("Executing remove liquidity:", { token0, token1, percent });
          
          // 区分ETH和WETH
          const isToken0ETH = token0 === "ETH"; // 只有明确指定ETH才用原生ETH
          const isToken1ETH = token1 === "ETH"; // 只有明确指定ETH才用原生ETH
          
          // 处理WETH代币
          const token0IsWETH = token0 === "WETH" || 
                            (token0 === selectedPool.token0Symbol && isToken0Weth) || 
                            (token0 === selectedPool.token1Symbol && isToken1Weth);
          
          const token1IsWETH = token1 === "WETH" || 
                            (token1 === selectedPool.token0Symbol && isToken0Weth) || 
                            (token1 === selectedPool.token1Symbol && isToken1Weth);
          
          // 获取正确的代币地址
          const token0Address = token0IsWETH 
            ? wethContract?.address 
            : (token0 === selectedPool.token0Symbol 
                ? selectedPool.token0 
                : selectedPool.token1);
          
          const token1Address = token1IsWETH 
            ? wethContract?.address 
            : (token1 === selectedPool.token0Symbol 
                ? selectedPool.token0 
                : selectedPool.token1);
          
          // We need to get the user's LP token balance to calculate how much to remove
          // For now, we'll use a placeholder value
          const liquidityAmount = BigInt(1000000000000000000); // 1 LP token as example
          const percentToRemove = Number(percent) / 100;
          const liquidityToRemove = BigInt(Number(liquidityAmount) * percentToRemove);
          
          // Minimum amounts (with 5% slippage)
          const minToken0 = BigInt(1);
          const minToken1 = BigInt(1);
          
          if (isToken0ETH || isToken1ETH) {
            // 提取流动性为ETH和代币
            console.log("Using removeLiquidityETH for removing ETH + Token liquidity");
            const tokenAddress = isToken0ETH ? token1Address : token0Address;
            const minTokenAmount = isToken0ETH ? minToken1 : minToken0;
            const minEthAmount = isToken0ETH ? minToken0 : minToken1;
            
            await writeContractAsync({
              address: routerContract.address,
              abi: routerContract.abi,
              functionName: 'removeLiquidityETH',
              args: [
                tokenAddress,
                liquidityToRemove,
                minTokenAmount,
                minEthAmount,
                connectedAddress,
                deadline
              ]
            });
          } else {
            // 提取流动性为代币和代币 (包括WETH)
            console.log("Using removeLiquidity for removing token + token liquidity");
            await writeContractAsync({
              address: routerContract.address,
              abi: routerContract.abi,
              functionName: 'removeLiquidity',
              args: [
                token0Address,
                token1Address,
                liquidityToRemove,
                minToken0,
                minToken1,
                connectedAddress,
                deadline
              ]
            });
          }
          
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