"use client";

import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { type Pool } from './PoolSelector';

// 注册Chart.js组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// 模拟交易历史数据生成
const generateMockSwapHistory = (pool: Pool | null) => {
  if (!pool) return { labels: [], datasets: [] };
  
  // 生成最近30天的日期标签
  const labels = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  });
  
  // 基于池子特征生成随机但相对合理的数据
  const baseVolume = pool.token0Symbol === 'WBTC' ? 0.5 :
                     pool.token0Symbol === 'ETH' ? 10 : 1000;
  
  const volumeData = labels.map(() => {
    return baseVolume * (0.7 + Math.random() * 0.6);
  });
  
  const priceData = labels.map((_, i) => {
    // 创建价格趋势
    const trendFactor = Math.sin(i / 5) * 0.1;
    const randomFactor = (Math.random() - 0.5) * 0.05;
    const priceFactor = 1 + trendFactor + randomFactor;
    
    // 基于token对计算合理的价格
    if (pool.token0Symbol === 'ETH' && pool.token1Symbol === 'USDC') {
      return 2000 * priceFactor;
    } else if (pool.token0Symbol === 'WBTC' && pool.token1Symbol === 'ETH') {
      return 16 * priceFactor;
    } else {
      return priceFactor;
    }
  });
  
  return {
    labels,
    datasets: [
      {
        label: '交易量',
        data: volumeData,
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        yAxisID: 'y',
      },
      {
        label: `${pool.token0Symbol}/${pool.token1Symbol} 价格`,
        data: priceData,
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        yAxisID: 'y1',
      }
    ]
  };
};

interface SwapHistoryChartProps {
  selectedPool: Pool | null;
}

export const SwapHistoryChart: React.FC<SwapHistoryChartProps> = ({ selectedPool }) => {
  const [chartData, setChartData] = useState<any>({ labels: [], datasets: [] });
  const [chartType, setChartType] = useState<'volume' | 'price'>('volume');
  
  useEffect(() => {
    const mockData = generateMockSwapHistory(selectedPool);
    setChartData(mockData);
  }, [selectedPool]);
  
  const options: ChartOptions<'line'> = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: selectedPool ? `${selectedPool.token0Symbol}/${selectedPool.token1Symbol} 交易历史` : '交易历史',
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: chartType === 'volume',
        position: 'left' as const,
        title: {
          display: true,
          text: '交易量',
        }
      },
      y1: {
        type: 'linear' as const,
        display: chartType === 'price',
        position: 'left' as const,
        title: {
          display: true,
          text: '价格',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };
  
  if (!selectedPool) {
    return <div className="card bg-base-100 shadow-xl p-6">请选择一个交易池以查看交易历史</div>;
  }
  
  return (
    <div className="card bg-base-100 shadow-xl p-6">
      <h2 className="text-xl font-bold mb-4">交易历史</h2>
      
      <div className="flex justify-center mb-4">
        <div className="join">
          <button 
            className={`btn join-item ${chartType === 'volume' ? 'btn-active' : ''}`}
            onClick={() => setChartType('volume')}
          >
            交易量
          </button>
          <button 
            className={`btn join-item ${chartType === 'price' ? 'btn-active' : ''}`}
            onClick={() => setChartType('price')}
          >
            价格
          </button>
        </div>
      </div>
      
      <Line options={options} data={chartData} />
      
      <div className="mt-4 text-sm text-center opacity-70">
        注：此数据为模拟数据，仅用于UI展示
      </div>
    </div>
  );
}; 