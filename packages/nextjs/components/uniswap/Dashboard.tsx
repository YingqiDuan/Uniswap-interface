"use client";

import React, { useState, useEffect } from "react";
import { PoolSelector, type Pool } from "./PoolSelector";
import { PoolDetails } from "./PoolDetails";
import { ReservesCurveChart } from "./ReservesCurveChart";
import { SwapHistoryChart } from "./SwapHistoryChart";
import { SwapInterface } from "./SwapInterface";
import { ActionPanel } from "./ActionPanel";
import { notification } from "~~/utils/scaffold-eth";

const Dashboard = () => {
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Function to refresh pool data
  const refreshPoolData = async () => {
    if (!selectedPool || !selectedPool.isRealPool) return;
    
    setIsRefreshing(true);
    try {
      console.log(`Refreshing data for pool ${selectedPool.address}...`);
      
      // Get updated pool data from the API
      const response = await fetch(`/api/getPairData?pair=${selectedPool.address}`);
      if (!response.ok) {
        throw new Error(`Failed to refresh pool data: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Received updated pool data:", data);
      
      // Update the selected pool with fresh data
      const updatedPool: Pool = {
        ...selectedPool,
        reserve0: BigInt(data.reserve0),
        reserve1: BigInt(data.reserve1)
      };
      
      setSelectedPool(updatedPool);
      notification.success("Pool data refreshed successfully");
    } catch (error) {
      console.error("Error refreshing pool data:", error);
      notification.error("Failed to refresh pool data");
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // When operation is complete, refresh pool information
  const handleActionComplete = () => {
    console.log("Action completed, refreshing pool data...");
    setRefreshTrigger(prev => prev + 1);
  };
  
  // Effect to refresh data periodically or when triggered
  useEffect(() => {
    if (selectedPool?.isRealPool) {
      refreshPoolData();
      
      // Set up a refresh interval (every 30 seconds)
      const intervalId = setInterval(() => {
        refreshPoolData();
      }, 30000);
      
      return () => clearInterval(intervalId);
    }
  }, [selectedPool?.address, refreshTrigger]);

  return (
    <div className="flex flex-col gap-8 py-8 px-4 md:px-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold mb-4">Uniswap Exchange Interface</h1>
        <p className="mb-6 text-lg">
          Decentralized exchange based on constant product automated market maker (x·y=k) model
        </p>
        <div className="alert alert-info mb-6">
          <div>
            <h3 className="font-bold">User Guide</h3>
            <p className="text-sm">
              1. Select a trading pool below <br />
              2. View pool details and reserve curve <br />
              3. Simulate token exchanges on the right <br />
              4. Use the action panel to add/remove liquidity and swap <br />
              5. Observe changes in the constant product curve (x·y=k)
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <PoolSelector selectedPool={selectedPool} setSelectedPool={setSelectedPool} />
          
          <div className="mt-6">
            <PoolDetails selectedPool={selectedPool} />
          </div>
          
          <div className="mt-6">
            <ReservesCurveChart selectedPool={selectedPool} />
          </div>
        </div>
        
        <div>
          <SwapInterface selectedPool={selectedPool} />
          
          <div className="mt-6">
            <ActionPanel selectedPool={selectedPool} onActionComplete={handleActionComplete} />
          </div>
          
          <div className="mt-6">
            <SwapHistoryChart selectedPool={selectedPool} />
          </div>
        </div>
      </div>
      
      {selectedPool?.isRealPool && (
        <div className="flex justify-center mt-4">
          <button 
            className={`btn btn-primary ${isRefreshing ? 'loading' : ''}`}
            onClick={refreshPoolData}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Pool Data'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 