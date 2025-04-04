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

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Generate simulated trading history data
const generateMockSwapHistory = (pool: Pool | null) => {
  if (!pool) return { labels: [], datasets: [] };
  
  // Generate date labels for the last 30 days
  const labels = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  });
  
  // Generate random but relatively reasonable data based on pool characteristics
  const baseVolume = pool.token0Symbol === 'WBTC' ? 0.5 :
                     pool.token0Symbol === 'ETH' ? 10 : 1000;
  
  const volumeData = labels.map(() => {
    return baseVolume * (0.7 + Math.random() * 0.6);
  });
  
  const priceData = labels.map((_, i) => {
    // Create price trend
    const trendFactor = Math.sin(i / 5) * 0.1;
    const randomFactor = (Math.random() - 0.5) * 0.05;
    const priceFactor = 1 + trendFactor + randomFactor;
    
    // Calculate reasonable price based on token pair
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
        label: 'Volume',
        data: volumeData,
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        yAxisID: 'y',
      },
      {
        label: `${pool.token0Symbol}/${pool.token1Symbol} Price`,
        data: priceData,
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        yAxisID: 'y1',
      }
    ]
  };
};

// Fetch real swap history data from the API
const fetchRealSwapHistory = async (pool: Pool | null, days = 30) => {
  if (!pool || !pool.isRealPool || !pool.address) {
    console.log("Not fetching real data: pool is null, not real, or has no address");
    return null;
  }
  
  try {
    console.log(`Fetching swap history for pool ${pool.address} for ${days} days`);
    const response = await fetch(`/api/getPoolSwapHistory?pair=${pool.address}&days=${days}`);
    
    if (!response.ok) {
      console.warn(`Failed to fetch swap history: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    console.log("Received swap history data:", data);
    
    // Check if we actually got any swap data
    const hasSwapData = data.swapCount > 0;
    if (!hasSwapData) {
      console.log("No swap events found for this pool");
      return null;
    }
    
    // Format the data for Chart.js
    return {
      labels: data.labels,
      datasets: [
        {
          label: 'Volume',
          data: data.volumeData,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          yAxisID: 'y',
        },
        {
          label: `${pool.token0Symbol}/${pool.token1Symbol} Price`,
          data: data.priceData,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          yAxisID: 'y1',
        }
      ]
    };
  } catch (error) {
    console.error("Error fetching swap history:", error);
    return null;
  }
};

interface SwapHistoryChartProps {
  selectedPool: Pool | null;
}

export const SwapHistoryChart: React.FC<SwapHistoryChartProps> = ({ selectedPool }) => {
  const [chartData, setChartData] = useState<any>({ labels: [], datasets: [] });
  const [chartType, setChartType] = useState<'volume' | 'price'>('volume');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isRealData, setIsRealData] = useState(false);
  
  useEffect(() => {
    async function loadData() {
      if (!selectedPool) {
        setChartData({ labels: [], datasets: [] });
        setIsRealData(false);
        return;
      }
      
      setIsLoadingData(true);
      
      try {
        // Try to fetch real data first
        if (selectedPool.isRealPool) {
          const realData = await fetchRealSwapHistory(selectedPool);
          
          if (realData) {
            console.log("Using real swap history data");
            setChartData(realData);
            setIsRealData(true);
            setIsLoadingData(false);
            return;
          }
        }
        
        // Fall back to mock data if no real data available
        console.log("Using simulated swap history data");
        const mockData = generateMockSwapHistory(selectedPool);
        setChartData(mockData);
        setIsRealData(false);
      } catch (error) {
        console.error("Error loading swap history data:", error);
        const mockData = generateMockSwapHistory(selectedPool);
        setChartData(mockData);
        setIsRealData(false);
      } finally {
        setIsLoadingData(false);
      }
    }
    
    loadData();
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
        text: selectedPool ? `${selectedPool.token0Symbol}/${selectedPool.token1Symbol} Trading History${isRealData ? ' (Real Data)' : ' (Simulated)'}` : 'Trading History',
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: chartType === 'volume',
        position: 'left' as const,
        title: {
          display: true,
          text: 'Volume',
        }
      },
      y1: {
        type: 'linear' as const,
        display: chartType === 'price',
        position: 'left' as const,
        title: {
          display: true,
          text: 'Price',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };
  
  if (!selectedPool) {
    return <div className="card bg-base-100 shadow-xl p-6">Please select a pool to view trading history</div>;
  }
  
  return (
    <div className="card bg-base-100 shadow-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Trading History</h2>
        {isRealData && <span className="badge badge-success">Real Data</span>}
        {!isRealData && selectedPool.isRealPool && <span className="badge badge-warning">Simulated (No Events Found)</span>}
        {!selectedPool.isRealPool && <span className="badge badge-warning">Simulated</span>}
      </div>
      
      <div className="flex justify-center mb-4">
        <div className="join">
          <button 
            className={`btn join-item ${chartType === 'volume' ? 'btn-active' : ''}`}
            onClick={() => setChartType('volume')}
          >
            Volume
          </button>
          <button 
            className={`btn join-item ${chartType === 'price' ? 'btn-active' : ''}`}
            onClick={() => setChartType('price')}
          >
            Price
          </button>
        </div>
      </div>
      
      {isLoadingData ? (
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <Line options={options} data={chartData} />
      )}
    </div>
  );
}; 