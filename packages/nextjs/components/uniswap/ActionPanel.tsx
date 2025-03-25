import React, { useState } from "react";
import { parseEther, parseUnits, formatUnits } from "viem";
import { Address } from "~~/components/scaffold-eth";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { useAccount, useBalance, useWriteContract, useReadContract } from "wagmi";
import { type Pool } from "./PoolSelector";

enum ActionType {
  Deposit = "Deposit",
  Redeem = "Redeem",
  Swap = "Swap",
}

interface ActionPanelProps {
  selectedPool: Pool | null;
  onActionComplete: () => void;
}

export const ActionPanel = ({ selectedPool, onActionComplete }: ActionPanelProps) => {
  const { address: connectedAddress } = useAccount();
  const [activeAction, setActiveAction] = useState<ActionType>(ActionType.Deposit);
  
  // Deposit state
  const [depositAmount0, setDepositAmount0] = useState("");
  const [depositAmount1, setDepositAmount1] = useState("");
  
  // Redeem state
  const [redeemAmount, setRedeemAmount] = useState("");
  
  // Swap state
  const [swapFromToken, setSwapFromToken] = useState<"token0" | "token1">("token0");
  const [swapAmount, setSwapAmount] = useState("");
  const [slippageTolerance, setSlippageTolerance] = useState("0.5");
  const [isApproving, setIsApproving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Get contract info
  const { data: routerContract } = useDeployedContractInfo("UniswapV2Router02");
  const { data: wethContract } = useDeployedContractInfo("WETH");
  const { data: pairContract } = useDeployedContractInfo("UniswapV2Pair");
  
  // Write contract hooks
  const { writeContractAsync: writeContract } = useWriteContract();
  
  // Check if we're dealing with ETH/WETH (compare symbols and addresses)
  const isToken0Weth = selectedPool?.token0Symbol === "WETH";
  const isToken1Weth = selectedPool?.token1Symbol === "WETH";
  const isEthPair = isToken0Weth || isToken1Weth;
  
  // Get token balances
  const { data: ethBalance } = useBalance({
    address: connectedAddress,
  });
  
  // Read token allowance
  const { data: token0Allowance, refetch: refetchToken0Allowance } = useReadContract({
    address: selectedPool?.token0 as `0x${string}`,
    abi: [{
      name: "allowance",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" }
      ],
      outputs: [{ name: "", type: "uint256" }]
    }],
    functionName: "allowance",
    args: [connectedAddress as `0x${string}`, routerContract?.address as `0x${string}`],
    query: {
      enabled: !!connectedAddress && !!routerContract && !!selectedPool && selectedPool.isRealPool,
    }
  });
  
  const { data: token1Allowance, refetch: refetchToken1Allowance } = useReadContract({
    address: selectedPool?.token1 as `0x${string}`,
    abi: [{
      name: "allowance",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" }
      ],
      outputs: [{ name: "", type: "uint256" }]
    }],
    functionName: "allowance",
    args: [connectedAddress as `0x${string}`, routerContract?.address as `0x${string}`],
    query: {
      enabled: !!connectedAddress && !!routerContract && !!selectedPool && selectedPool.isRealPool,
    }
  });
  
  // Get LP token allowance
  const { data: lpTokenAllowance, refetch: refetchLpTokenAllowance } = useReadContract({
    address: selectedPool?.address as `0x${string}`,
    abi: [{
      name: "allowance",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" }
      ],
      outputs: [{ name: "", type: "uint256" }]
    }],
    functionName: "allowance",
    args: [connectedAddress as `0x${string}`, routerContract?.address as `0x${string}`],
    query: {
      enabled: !!connectedAddress && !!routerContract && !!selectedPool && selectedPool.isRealPool,
    }
  });
  
  // Helper to approve tokens
  const approveToken = async (tokenAddress: `0x${string}`, amount: bigint) => {
    if (!routerContract || !connectedAddress) return;
    
    setIsApproving(true);
    try {
      await writeContract({
        address: tokenAddress,
        abi: [{
          name: "approve",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" }
          ],
          outputs: [{ name: "", type: "bool" }]
        }],
        functionName: "approve",
        args: [routerContract.address, amount],
      });
      
      notification.success("Token approved!");
      // Refetch allowances
      await refetchToken0Allowance();
      await refetchToken1Allowance();
      await refetchLpTokenAllowance();
    } catch (error) {
      console.error("Error approving token:", error);
      notification.error("Failed to approve token");
    } finally {
      setIsApproving(false);
    }
  };

  const handleAddLiquidity = async () => {
    if (!selectedPool || !routerContract || !connectedAddress) {
      notification.error("Missing required information");
      return;
    }

    // Check if it's a simulated pool
    if (!selectedPool.isRealPool) {
      notification.warning("Simulated pool does not support actual operations");
      return;
    }

    try {
      setIsLoading(true);
      
      // Parse amounts
      const amount0 = parseEther(depositAmount0);
      const amount1 = parseEther(depositAmount1);
      
      // Calculate min amounts (accounting for slippage)
      const slippagePercent = parseFloat(slippageTolerance) / 100;
      const minAmount0 = amount0 - (amount0 * BigInt(Math.floor(slippagePercent * 100))) / 100n;
      const minAmount1 = amount1 - (amount1 * BigInt(Math.floor(slippagePercent * 100))) / 100n;
      
      // Set deadline to 20 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
      
      // Check if we need to approve tokens
      if (isEthPair) {
        // ETH pair logic (one token is WETH)
        const tokenAddress = isToken0Weth ? selectedPool.token1 : selectedPool.token0;
        const tokenAmount = isToken0Weth ? amount1 : amount0;
        const tokenAllowance = isToken0Weth ? token1Allowance : token0Allowance;
        const ethAmount = isToken0Weth ? amount0 : amount1;
        const minTokenAmount = isToken0Weth ? minAmount1 : minAmount0;
        const minEthAmount = isToken0Weth ? minAmount0 : minAmount1;
        
        if (tokenAllowance && tokenAllowance < tokenAmount) {
          await approveToken(tokenAddress as `0x${string}`, parseEther("100000000")); // Approve a large amount
        }
        
        await writeContract({
          address: routerContract.address,
          abi: routerContract.abi,
          functionName: "addLiquidityETH",
          args: [
            tokenAddress,
            tokenAmount,
            minTokenAmount,
            minEthAmount,
            connectedAddress,
            deadline,
          ],
          value: ethAmount,
        });
      } else {
        // Regular token pair logic
        if (token0Allowance && token0Allowance < amount0) {
          await approveToken(selectedPool.token0 as `0x${string}`, parseEther("100000000")); // Approve a large amount
        }
        
        if (token1Allowance && token1Allowance < amount1) {
          await approveToken(selectedPool.token1 as `0x${string}`, parseEther("100000000")); // Approve a large amount
        }
        
        await writeContract({
          address: routerContract.address,
          abi: routerContract.abi,
          functionName: "addLiquidity",
          args: [
            selectedPool.token0,
            selectedPool.token1,
            amount0,
            amount1,
            minAmount0,
            minAmount1,
            connectedAddress,
            deadline,
          ],
        });
      }
      
      notification.success("Liquidity added successfully!");
      setDepositAmount0("");
      setDepositAmount1("");
      onActionComplete();
    } catch (error) {
      console.error("Error adding liquidity:", error);
      notification.error("Failed to add liquidity");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!selectedPool || !routerContract || !connectedAddress) {
      notification.error("Missing required information");
      return;
    }

    // Check if it's a simulated pool
    if (!selectedPool.isRealPool) {
      notification.warning("Simulated pool does not support actual operations");
      return;
    }

    try {
      setIsLoading(true);
      
      const liquidity = parseEther(redeemAmount);
      
      // Check if LP token allowance is sufficient
      if (lpTokenAllowance && lpTokenAllowance < liquidity) {
        await approveToken(selectedPool.address as `0x${string}`, parseEther("100000000")); // Approve a large amount
      }
      
      // Calculate min amounts with slippage tolerance
      const slippagePercent = parseFloat(slippageTolerance) / 100;
      const minAmount0 = BigInt(0); // For demo, can be calculated based on current reserves
      const minAmount1 = BigInt(0); // For demo, can be calculated based on current reserves
      
      // Set deadline to 20 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
      
      if (isEthPair) {
        // ETH pair logic
        const tokenAddress = isToken0Weth ? selectedPool.token1 : selectedPool.token0;
        const minTokenAmount = isToken0Weth ? minAmount1 : minAmount0;
        const minEthAmount = isToken0Weth ? minAmount0 : minAmount1;
        
        await writeContract({
          address: routerContract.address,
          abi: routerContract.abi,
          functionName: "removeLiquidityETH",
          args: [
            tokenAddress,
            liquidity,
            minTokenAmount,
            minEthAmount,
            connectedAddress,
            deadline,
          ],
        });
      } else {
        // Regular token pair logic
        await writeContract({
          address: routerContract.address,
          abi: routerContract.abi,
          functionName: "removeLiquidity",
          args: [
            selectedPool.token0,
            selectedPool.token1,
            liquidity,
            minAmount0,
            minAmount1,
            connectedAddress,
            deadline,
          ],
        });
      }
      
      notification.success("Liquidity removed successfully!");
      setRedeemAmount("");
      onActionComplete();
    } catch (error) {
      console.error("Error removing liquidity:", error);
      notification.error("Failed to remove liquidity");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!selectedPool || !routerContract || !connectedAddress) {
      notification.error("Missing required information");
      return;
    }

    // Check if it's a simulated pool
    if (!selectedPool.isRealPool) {
      notification.warning("Simulated pool does not support actual operations");
      return;
    }

    try {
      setIsLoading(true);
      
      const amountIn = parseEther(swapAmount);
      
      // Calculate min amount out with slippage
      const slippagePercent = parseFloat(slippageTolerance) / 100;
      const amountOutMin = 0n; // For demo, would normally calculate based on actual rates
      
      // Set deadline to 20 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
      
      const isFromETH = 
        (swapFromToken === "token0" && isToken0Weth) || 
        (swapFromToken === "token1" && isToken1Weth);
      
      const isToETH = 
        (swapFromToken === "token0" && isToken1Weth) || 
        (swapFromToken === "token1" && isToken0Weth);
      
      // Determine token addresses for the path
      let tokenIn, tokenOut;
      if (swapFromToken === "token0") {
        tokenIn = selectedPool.token0;
        tokenOut = selectedPool.token1;
      } else {
        tokenIn = selectedPool.token1;
        tokenOut = selectedPool.token0;
      }
      
      // Handle different swap types
      if (isFromETH) {
        // Swapping from ETH to token
        await writeContract({
          address: routerContract.address,
          abi: routerContract.abi,
          functionName: "swapExactETHForTokens",
          args: [
            amountOutMin,
            [wethContract?.address, tokenOut],
            connectedAddress,
            deadline,
          ],
          value: amountIn,
        });
      } else if (isToETH) {
        // Swapping from token to ETH
        // Check allowance
        if ((swapFromToken === "token0" && token0Allowance && token0Allowance < amountIn) ||
            (swapFromToken === "token1" && token1Allowance && token1Allowance < amountIn)) {
          await approveToken(tokenIn as `0x${string}`, parseEther("100000000"));
        }
        
        await writeContract({
          address: routerContract.address,
          abi: routerContract.abi,
          functionName: "swapExactTokensForETH",
          args: [
            amountIn,
            amountOutMin,
            [tokenIn, wethContract?.address],
            connectedAddress,
            deadline,
          ],
        });
      } else {
        // Regular token to token swap
        // Check allowance
        if ((swapFromToken === "token0" && token0Allowance && token0Allowance < amountIn) ||
            (swapFromToken === "token1" && token1Allowance && token1Allowance < amountIn)) {
          await approveToken(tokenIn as `0x${string}`, parseEther("100000000"));
        }
        
        await writeContract({
          address: routerContract.address,
          abi: routerContract.abi,
          functionName: "swapExactTokensForTokens",
          args: [
            amountIn,
            amountOutMin,
            [tokenIn, tokenOut],
            connectedAddress,
            deadline,
          ],
        });
      }
      
      notification.success("Swap executed successfully!");
      setSwapAmount("");
      onActionComplete();
    } catch (error) {
      console.error("Error executing swap:", error);
      notification.error("Failed to execute swap");
    } finally {
      setIsLoading(false);
    }
  };

  // Determine current button text based on approval and loading states
  const getActionButtonText = (action: ActionType) => {
    if (isApproving) return "Approving...";
    if (isLoading) return "Processing...";
    
    switch (action) {
      case ActionType.Deposit:
        return "Add Liquidity";
      case ActionType.Redeem:
        return "Remove Liquidity";
      case ActionType.Swap:
        return "Swap";
      default:
        return "Submit";
    }
  };

  const renderActionContent = () => {
    if (!selectedPool) {
      return (
        <div className="text-center py-8">
          <p>Please select a pool first</p>
        </div>
      );
    }
    
    // If it's a simulated pool, show a prompt message
    if (!selectedPool.isRealPool) {
      return (
        <div className="text-center py-8">
          <div className="alert alert-warning mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <div>
              <h3 className="font-bold">Simulated Pool - Operations Not Available</h3>
              <div className="text-sm">Simulated pools are for demonstration purposes only and do not support actual deposit, redeem, or swap operations. Please select a real pool to perform operations.</div>
            </div>
          </div>
          <p>Please select a real pool (marked with "Real Pool" label) to perform operations</p>
        </div>
      );
    }

    switch (activeAction) {
      case ActionType.Deposit:
        return (
          <div className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Amount of {selectedPool.token0Symbol}</span>
                {isToken0Weth && (
                  <span className="label-text-alt">Balance: {ethBalance ? parseFloat(ethBalance.formatted).toFixed(6) : "0"} ETH</span>
                )}
              </label>
              <input
                type="text"
                placeholder="0.0"
                className="input input-bordered w-full"
                value={depositAmount0}
                onChange={(e) => setDepositAmount0(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Amount of {selectedPool.token1Symbol}</span>
                {isToken1Weth && (
                  <span className="label-text-alt">Balance: {ethBalance ? parseFloat(ethBalance.formatted).toFixed(6) : "0"} ETH</span>
                )}
              </label>
              <input
                type="text"
                placeholder="0.0"
                className="input input-bordered w-full"
                value={depositAmount1}
                onChange={(e) => setDepositAmount1(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Slippage Tolerance (%)</span>
              </label>
              <input
                type="text"
                placeholder="0.5"
                className="input input-bordered w-full"
                value={slippageTolerance}
                onChange={(e) => setSlippageTolerance(e.target.value)}
              />
            </div>
            <button 
              className="btn btn-primary w-full"
              onClick={handleAddLiquidity}
              disabled={!depositAmount0 || !depositAmount1 || isApproving || isLoading}
            >
              {getActionButtonText(ActionType.Deposit)}
            </button>
          </div>
        );
        
      case ActionType.Redeem:
        return (
          <div className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Amount of LP Tokens</span>
              </label>
              <input
                type="text"
                placeholder="0.0"
                className="input input-bordered w-full"
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Slippage Tolerance (%)</span>
              </label>
              <input
                type="text"
                placeholder="0.5"
                className="input input-bordered w-full"
                value={slippageTolerance}
                onChange={(e) => setSlippageTolerance(e.target.value)}
              />
            </div>
            <button 
              className="btn btn-primary w-full"
              onClick={handleRemoveLiquidity}
              disabled={!redeemAmount || isApproving || isLoading}
            >
              {getActionButtonText(ActionType.Redeem)}
            </button>
          </div>
        );
        
      case ActionType.Swap:
        const fromTokenSymbol = swapFromToken === "token0" ? selectedPool.token0Symbol : selectedPool.token1Symbol;
        const toTokenSymbol = swapFromToken === "token0" ? selectedPool.token1Symbol : selectedPool.token0Symbol;
        
        return (
          <div className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">From</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={swapFromToken}
                onChange={(e) => setSwapFromToken(e.target.value as "token0" | "token1")}
              >
                <option value="token0">{selectedPool.token0Symbol}</option>
                <option value="token1">{selectedPool.token1Symbol}</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Amount</span>
                {((swapFromToken === "token0" && isToken0Weth) || (swapFromToken === "token1" && isToken1Weth)) && (
                  <span className="label-text-alt">Balance: {ethBalance ? parseFloat(ethBalance.formatted).toFixed(6) : "0"} ETH</span>
                )}
              </label>
              <input
                type="text"
                placeholder="0.0"
                className="input input-bordered w-full"
                value={swapAmount}
                onChange={(e) => setSwapAmount(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">To</span>
              </label>
              <div className="input input-bordered w-full flex items-center px-4">
                {toTokenSymbol}
              </div>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Slippage Tolerance (%)</span>
              </label>
              <input
                type="text"
                placeholder="0.5"
                className="input input-bordered w-full"
                value={slippageTolerance}
                onChange={(e) => setSlippageTolerance(e.target.value)}
              />
            </div>
            <button 
              className="btn btn-primary w-full"
              onClick={handleSwap}
              disabled={!swapAmount || isApproving || isLoading}
            >
              {getActionButtonText(ActionType.Swap)}
            </button>
          </div>
        );
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl p-4">
      <h2 className="text-2xl font-bold mb-4">Actions</h2>
      
      <div className="tabs tabs-boxed mb-4">
        <button 
          className={`tab ${activeAction === ActionType.Deposit ? 'tab-active' : ''}`}
          onClick={() => setActiveAction(ActionType.Deposit)}
        >
          Deposit
        </button>
        <button 
          className={`tab ${activeAction === ActionType.Redeem ? 'tab-active' : ''}`}
          onClick={() => setActiveAction(ActionType.Redeem)}
        >
          Redeem
        </button>
        <button 
          className={`tab ${activeAction === ActionType.Swap ? 'tab-active' : ''}`}
          onClick={() => setActiveAction(ActionType.Swap)}
        >
          Swap
        </button>
      </div>
      
      {renderActionContent()}
      
      {selectedPool && (
        <div className="mt-4 pt-4 border-t border-base-300">
          <h3 className="font-semibold">Selected Pool</h3>
          <div className="flex flex-col gap-1 mt-2">
            <div className="text-sm">
              <span className="font-medium">Address:</span> 
              {selectedPool.isRealPool ? (
                <Address address={selectedPool.address} size="sm" />
              ) : (
                <span className="ml-1 font-mono">{selectedPool.address} (simulated)</span>
              )}
            </div>
            <div className="text-sm">
              <span className="font-medium">Pair:</span> {selectedPool.token0Symbol}/{selectedPool.token1Symbol}
            </div>
            <div className="text-sm">
              <span className="font-medium">Type:</span> {selectedPool.isRealPool ? "Real Pool" : "Simulated Pool"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 