"use client";

import React, { useState } from "react";
import { PoolSelector, type Pool } from "./PoolSelector";
import { PoolDetails } from "./PoolDetails";
import { ReservesCurveChart } from "./ReservesCurveChart";
import { SwapHistoryChart } from "./SwapHistoryChart";
import { SwapInterface } from "./SwapInterface";

const Dashboard = () => {
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);

  return (
    <div className="flex flex-col gap-8 py-8 px-4 md:px-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold mb-4">Uniswap 交易所界面</h1>
        <p className="mb-6 text-lg">
          基于恒定乘积自动做市商 (x·y=k) 模型的去中心化交易所
        </p>
        <div className="alert alert-info mb-6">
          <div>
            <h3 className="font-bold">使用说明</h3>
            <p className="text-sm">
              1. 从下方选择一个交易池 <br />
              2. 查看池子详情和储备曲线 <br />
              3. 在右侧模拟代币交换 <br />
              4. 观察恒定乘积曲线 (x·y=k) 的变化
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
            <SwapHistoryChart selectedPool={selectedPool} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 