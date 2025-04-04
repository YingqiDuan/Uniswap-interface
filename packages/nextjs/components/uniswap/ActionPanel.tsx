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
  const [activeTab, setActiveTab] = useState<string>("add");
  
  // Deposit state
  const [depositAmount0, setDepositAmount0] = useState<string>("");
  const [depositAmount1, setDepositAmount1] = useState<string>("");
  
  // Redeem state
  const [redeemAmount, setRedeemAmount] = useState<string>("");
  
  // Swap state
  const [swapFromToken, setSwapFromToken] = useState<"token0" | "token1">("token0");
  const [swapAmount, setSwapAmount] = useState<string>("");
  const [swapDirection, setSwapDirection] = useState<string>("token0ToToken1");
  const [slippageTolerance, setSlippageTolerance] = useState<string>("5.0");
  const [isApproving, setIsApproving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Get contract info
  const { data: routerContract } = useDeployedContractInfo("UniswapV2Router02");
  const { data: wethContract } = useDeployedContractInfo("WETH");
  const { data: pairContract } = useDeployedContractInfo("UniswapV2Pair");
  
  // Write contract hooks
  const { writeContractAsync: writeContract } = useWriteContract();
  
  // Check if we're dealing with ETH/WETH (compare symbols and addresses)
  const isToken0Weth = selectedPool?.token0Symbol === "WETH" && selectedPool?.token0 === wethContract?.address;
  const isToken1Weth = selectedPool?.token1Symbol === "WETH" && selectedPool?.token1 === wethContract?.address;
  // 根据实际情况判断是否是ETH对（包含真正的WETH的对，不仅是符号匹配，还要地址匹配）
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
      
      // 记录当前参数
      console.log("Adding liquidity with params:");
      console.log("isEthPair:", isEthPair);
      console.log("isToken0Weth:", isToken0Weth);
      console.log("isToken1Weth:", isToken1Weth);
      console.log("Token0:", selectedPool.token0Symbol, selectedPool.token0);
      console.log("Token1:", selectedPool.token1Symbol, selectedPool.token1);
      console.log("Amount0:", depositAmount0);
      console.log("Amount1:", depositAmount1);
      
      // Parse amounts
      const amount0 = parseEther(depositAmount1 === "" ? "0" : depositAmount0);
      const amount1 = parseEther(depositAmount1 === "" ? "0" : depositAmount1);
      
      // 记录解析后的金额
      console.log("Parsed amount0:", amount0.toString());
      console.log("Parsed amount1:", amount1.toString());
      
      // 更慷慨的滑点设置 - 提高成功率
      const slippagePercent = Math.max(parseFloat(slippageTolerance), 5) / 100; // 至少5%滑点
      console.log("Using slippage percentage:", slippagePercent * 100, "%");
      
      // 计算最小接收量（考虑滑点）
      const minAmount0 = amount0 - (amount0 * BigInt(Math.floor(slippagePercent * 10000))) / 10000n;
      const minAmount1 = amount1 - (amount1 * BigInt(Math.floor(slippagePercent * 10000))) / 10000n;
      
      console.log("Min amount0:", minAmount0.toString());
      console.log("Min amount1:", minAmount1.toString());
      
      // Set deadline to 20 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
      
      // 如果是与ETH/WETH的交易对
      if (isEthPair) {
        console.log("Using ETH pair logic");
        // ETH pair logic (one token is WETH)
        const tokenAddress = isToken0Weth ? selectedPool.token1 : selectedPool.token0;
        const tokenAmount = isToken0Weth ? amount1 : amount0;
        const tokenAllowance = isToken0Weth ? token1Allowance : token0Allowance;
        const ethAmount = isToken0Weth ? amount0 : amount1;
        const minTokenAmount = isToken0Weth ? minAmount1 : minAmount0;
        const minEthAmount = isToken0Weth ? minAmount0 : minAmount1;
        
        console.log("Token address:", tokenAddress);
        console.log("Token amount:", tokenAmount.toString());
        console.log("Token allowance:", tokenAllowance?.toString() || "unknown");
        console.log("ETH amount:", ethAmount.toString());
        console.log("Min token amount:", minTokenAmount.toString());
        console.log("Min ETH amount:", minEthAmount.toString());
        
        // 检查代币授权
        if (tokenAllowance && tokenAllowance < tokenAmount) {
          console.log("Approving token...");
          await approveToken(tokenAddress as `0x${string}`, parseEther("100000000")); // Approve a large amount
        }
        
        console.log("Adding liquidity with WETH tokens...");
        // 使用addLiquidity添加WETH代币对流动性
        await writeContract({
          address: routerContract.address,
          abi: routerContract.abi,
          functionName: "addLiquidity",
          args: [
            isToken0Weth ? selectedPool.token0 : tokenAddress,
            isToken0Weth ? tokenAddress : selectedPool.token1,
            amount0,
            amount1,
            minAmount0,
            minAmount1,
            connectedAddress,
            deadline,
          ],
        });
      } else {
        console.log("Using regular token pair logic");
        // Regular token pair logic
        if (token0Allowance && token0Allowance < amount0) {
          console.log("Approving token0...");
          await approveToken(selectedPool.token0 as `0x${string}`, parseEther("100000000")); // Approve a large amount
        }
        
        if (token1Allowance && token1Allowance < amount1) {
          console.log("Approving token1...");
          await approveToken(selectedPool.token1 as `0x${string}`, parseEther("100000000")); // Approve a large amount
        }
        
        console.log("Adding liquidity for regular token pair...");
        console.log("Args:", [
          selectedPool.token0,
          selectedPool.token1,
          amount0,
          amount1,
          minAmount0,
          minAmount1,
          connectedAddress,
          deadline,
        ]);
        
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
      
      console.log("Starting to remove liquidity...");
      console.log("LP Token address:", selectedPool.address);
      console.log("LP Token amount to remove:", liquidity.toString());
      console.log("Current LP allowance:", lpTokenAllowance?.toString() || "unknown");
      
      // Check if LP token allowance is sufficient
      if (!lpTokenAllowance || lpTokenAllowance < liquidity) {
        console.log("Approving LP token...");
        notification.info("Approving LP tokens. Please wait for the transaction to be confirmed.");
        
        try {
          await approveToken(selectedPool.address as `0x${string}`, parseEther("100000000")); // Approve a large amount
          console.log("LP token approved successfully.");
          
          // Wait for 5 seconds to ensure the approval transaction is confirmed
          console.log("Waiting 5 seconds for approval confirmation...");
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Refetch allowance to verify approval
          await refetchLpTokenAllowance();
          console.log("Updated LP allowance after approval:", lpTokenAllowance?.toString() || "unknown");
          
          if (!lpTokenAllowance || lpTokenAllowance < liquidity) {
            notification.warning("LP token approval may not be confirmed yet. Please try again in a moment.");
            console.warn("LP token approval may not be confirmed yet:", lpTokenAllowance?.toString() || "unknown");
          }
        } catch (error) {
          console.error("Error approving LP token:", error);
          notification.error("Failed to approve LP token. Cannot proceed with removing liquidity.");
          setIsLoading(false);
          return;
        }
      }
      
      // Calculate min amounts with slippage tolerance
      const slippagePercent = parseFloat(slippageTolerance) / 100;
      const minAmount0 = BigInt(0); // For demo, can be calculated based on current reserves
      const minAmount1 = BigInt(0); // For demo, can be calculated based on current reserves
      
      // Set deadline to 20 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
      
      console.log("Preparing to call removeLiquidity contract function with arguments:");
      
      if (isEthPair) {
        // ETH pair logic (with WETH)
        console.log("Removing liquidity from WETH token pair...");
        const tokenAddress = isToken0Weth ? selectedPool.token1 : selectedPool.token0;
        const minTokenAmount = isToken0Weth ? minAmount1 : minAmount0;
        const minEthAmount = isToken0Weth ? minAmount0 : minAmount1;
        
        const token0 = isToken0Weth ? selectedPool.token0 : tokenAddress;
        const token1 = isToken0Weth ? tokenAddress : selectedPool.token1;
        
        console.log("Token0:", token0);
        console.log("Token1:", token1);
        console.log("Liquidity:", liquidity.toString());
        console.log("MinAmount0:", minAmount0.toString());
        console.log("MinAmount1:", minAmount1.toString());
        console.log("To Address:", connectedAddress);
        console.log("Deadline:", deadline.toString());
        
        await writeContract({
          address: routerContract.address,
          abi: routerContract.abi,
          functionName: "removeLiquidity",
          args: [
            token0,
            token1,
            liquidity,
            minAmount0,
            minAmount1,
            connectedAddress,
            deadline,
          ],
        });
      } else {
        // Regular token pair logic
        console.log("Removing liquidity from regular token pair...");
        console.log("Token0:", selectedPool.token0);
        console.log("Token1:", selectedPool.token1);
        console.log("Liquidity:", liquidity.toString());
        console.log("MinAmount0:", minAmount0.toString());
        console.log("MinAmount1:", minAmount1.toString());
        console.log("To Address:", connectedAddress);
        console.log("Deadline:", deadline.toString());
        
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
        // Swapping from WETH token to another token
        console.log("Swapping from WETH token...");
        
        // Check WETH allowance
        const wethAllowance = swapFromToken === "token0" ? token0Allowance : token1Allowance;
        if (wethAllowance && wethAllowance < amountIn) {
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
      } else if (isToETH) {
        // Swapping from token to WETH token
        console.log("Swapping to WETH token...");
        
        // Check token allowance
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
      } else {
        // Regular token to token swap
        console.log("Performing regular token swap...");
        
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

  const handleDepositAmount0Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDepositAmount0(e.target.value);
    
    // 如果池子存在且有储备，计算对应的token1数量
    if (selectedPool && selectedPool.reserve0 > 0n && selectedPool.reserve1 > 0n) {
      const amount0 = parseFloat(e.target.value || "0");
      const reserve0 = Number(selectedPool.reserve0) / (10 ** 18);
      const reserve1 = Number(selectedPool.reserve1) / (10 ** 18);
      
      // 根据当前池子比例计算token1数量
      const amount1 = (amount0 * reserve1) / reserve0;
      
      // 更新token1输入框
      if (!isNaN(amount1) && isFinite(amount1)) {
        setDepositAmount1(amount1.toFixed(6));
      }
    }
  };

  const handleDepositAmount1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDepositAmount1(e.target.value);
    
    // 如果池子存在且有储备，计算对应的token0数量
    if (selectedPool && selectedPool.reserve0 > 0n && selectedPool.reserve1 > 0n) {
      const amount1 = parseFloat(e.target.value || "0");
      const reserve0 = Number(selectedPool.reserve0) / (10 ** 18);
      const reserve1 = Number(selectedPool.reserve1) / (10 ** 18);
      
      // 根据当前池子比例计算token0数量
      const amount0 = (amount1 * reserve0) / reserve1;
      
      // 更新token0输入框
      if (!isNaN(amount0) && isFinite(amount0)) {
        setDepositAmount0(amount0.toFixed(6));
      }
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
                onChange={handleDepositAmount0Change}
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
                onChange={handleDepositAmount1Change}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Slippage Tolerance (%)</span>
              </label>
              <input
                type="text"
                placeholder="5.0"
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
                placeholder="5.0"
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
                placeholder="5.0"
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
          <div className="flex flex-col gap-2 mt-2">
            <div className="text-sm">
              <span className="font-medium">Pair:</span> {selectedPool.token0Symbol}/{selectedPool.token1Symbol}
            </div>
            <div className="text-sm">
              <span className="font-medium">Type:</span> {selectedPool.isRealPool ? "Real Pool" : "Simulated Pool"}
            </div>
            
            {selectedPool.isRealPool && (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Pool address:</span>
                  <div className="text-xs font-mono bg-base-200 p-2 rounded overflow-auto">{selectedPool.address}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{selectedPool.token0Symbol} address:</span>
                  <div className="text-xs font-mono bg-base-200 p-2 rounded overflow-auto">{selectedPool.token0}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{selectedPool.token1Symbol} address:</span>
                  <div className="text-xs font-mono bg-base-200 p-2 rounded overflow-auto">{selectedPool.token1}</div>
                </div>
              </>
            )}
            
            {!selectedPool.isRealPool && (
              <div className="text-sm">
                <span className="font-medium">Address:</span> 
                <span className="ml-1 font-mono">{selectedPool.address} (simulated)</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 