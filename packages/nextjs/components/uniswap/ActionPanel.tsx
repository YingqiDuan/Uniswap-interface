import React, { useState } from "react";
import { parseEther } from "viem";
import { Address } from "~~/components/scaffold-eth";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { useAccount, useWriteContract } from "wagmi";
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

  // Get contract info
  const { data: routerContract } = useDeployedContractInfo("UniswapV2Router02");
  
  // Write contract hooks
  const { writeContractAsync: writeContract } = useWriteContract();

  const handleAddLiquidity = async () => {
    if (!selectedPool || !routerContract || !connectedAddress) {
      notification.error("Missing required information");
      return;
    }

    try {
      const amount0 = parseEther(depositAmount0);
      const amount1 = parseEther(depositAmount1);
      
      // Calculate min amounts (accounting for slippage)
      const slippagePercent = parseFloat(slippageTolerance) / 100;
      const minAmount0 = amount0 - (amount0 * BigInt(Math.floor(slippagePercent * 100))) / 100n;
      const minAmount1 = amount1 - (amount1 * BigInt(Math.floor(slippagePercent * 100))) / 100n;
      
      // Set deadline to 20 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
      
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
      
      notification.success("Liquidity added successfully!");
      setDepositAmount0("");
      setDepositAmount1("");
      onActionComplete();
    } catch (error) {
      console.error("Error adding liquidity:", error);
      notification.error("Failed to add liquidity");
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!selectedPool || !routerContract || !connectedAddress) {
      notification.error("Missing required information");
      return;
    }

    try {
      const liquidity = parseEther(redeemAmount);
      
      // Set min amounts to 0 for demo
      const minAmount0 = 0n;
      const minAmount1 = 0n;
      
      // Set deadline to 20 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
      
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
      
      notification.success("Liquidity removed successfully!");
      setRedeemAmount("");
      onActionComplete();
    } catch (error) {
      console.error("Error removing liquidity:", error);
      notification.error("Failed to remove liquidity");
    }
  };

  const handleSwap = async () => {
    if (!selectedPool || !routerContract || !connectedAddress) {
      notification.error("Missing required information");
      return;
    }

    try {
      const amountIn = parseEther(swapAmount);
      
      // Set min amount out to 0 for demo
      // In production, you would calculate this based on the current price and slippage
      const amountOutMin = 0n;
      
      // Set deadline to 20 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
      
      // Create path array
      const path = swapFromToken === "token0" 
        ? [selectedPool.token0, selectedPool.token1]
        : [selectedPool.token1, selectedPool.token0];
      
      await writeContract({
        address: routerContract.address,
        abi: routerContract.abi,
        functionName: "swapExactTokensForTokens",
        args: [
          amountIn,
          amountOutMin,
          path,
          connectedAddress,
          deadline,
        ],
      });
      
      notification.success("Swap executed successfully!");
      setSwapAmount("");
      onActionComplete();
    } catch (error) {
      console.error("Error executing swap:", error);
      notification.error("Failed to execute swap");
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

    switch (activeAction) {
      case ActionType.Deposit:
        return (
          <div className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Amount of {selectedPool.token0Symbol}</span>
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
              disabled={!depositAmount0 || !depositAmount1}
            >
              Add Liquidity
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
              disabled={!redeemAmount}
            >
              Remove Liquidity
            </button>
          </div>
        );
        
      case ActionType.Swap:
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
                <span className="label-text">To</span>
              </label>
              <div className="input input-bordered w-full flex items-center px-4">
                {swapFromToken === "token0" ? selectedPool.token1Symbol : selectedPool.token0Symbol}
              </div>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Amount</span>
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
              disabled={!swapAmount}
            >
              Swap
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
              <span className="font-medium">Address:</span> <Address address={selectedPool.address} size="sm" />
            </div>
            <div className="text-sm">
              <span className="font-medium">Pair:</span> {selectedPool.token0Symbol}/{selectedPool.token1Symbol}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 