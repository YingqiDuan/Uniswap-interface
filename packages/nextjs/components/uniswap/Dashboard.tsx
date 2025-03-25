"use client";

import React, { useState } from "react";
import { PoolSelector, type Pool } from "./PoolSelector";
import { PoolDetails } from "./PoolDetails";
import { ReservesCurveChart } from "./ReservesCurveChart";
import { SwapHistoryChart } from "./SwapHistoryChart";
import { SwapInterface } from "./SwapInterface";
import { ActionPanel } from "./ActionPanel";

const Dashboard = () => {
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  
  // When operation is complete, refresh pool information
  const handleActionComplete = () => {
    // Trigger pool information refresh
    console.log("Action completed, refreshing pool data...");
    // Logic to retrieve updated pool information can be added here
  };

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
    </div>
  );
};

export default Dashboard; 