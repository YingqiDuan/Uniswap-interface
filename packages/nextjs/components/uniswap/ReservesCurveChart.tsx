"use client";

import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { type Pool } from "./PoolSelector";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ReservesCurveChartProps {
  selectedPool: Pool | null;
}

export const ReservesCurveChart = ({ selectedPool }: ReservesCurveChartProps) => {
  const [chartData, setChartData] = useState<{
    labels: number[];
    datasets: {
      label: string;
      data: number[];
      borderColor: string;
      backgroundColor: string;
      fill: boolean;
      tension: number;
    }[];
  } | null>(null);

  useEffect(() => {
    if (!selectedPool) {
      return;
    }

    // Get current reserves
    const reserve0 = selectedPool.reserve0;
    const reserve1 = selectedPool.reserve1;

    // Calculate constant k = x * y
    const k = reserve0 * reserve1;

    // Generate curve points
    const generateCurvePoints = () => {
      const numPoints = 100;
      const points: { x: number; y: number }[] = [];

      // Convert reserves to human-readable values for display
      let scale0 = 10 ** 18;
      let scale1 = 10 ** 18;

      if (selectedPool.token0Symbol === "WBTC") scale0 = 10 ** 8;
      if (selectedPool.token1Symbol === "WBTC") scale1 = 10 ** 8;
      if (selectedPool.token0Symbol === "USDC") scale0 = 10 ** 6;
      if (selectedPool.token1Symbol === "USDC") scale1 = 10 ** 6;

      const currentX = Number(reserve0) / Number(scale0);
      const currentY = Number(reserve1) / Number(scale1);

      // Generate points in range of 0.1x to 3x the current reserves
      const minX = currentX * 0.1;
      const maxX = currentX * 3;
      const step = (maxX - minX) / numPoints;

      for (let i = 0; i <= numPoints; i++) {
        const x = minX + step * i;
        // y = k/x
        const y = Number(k) / (Number(x) * Number(scale0) * Number(scale1));
        points.push({ x, y });
      }

      return points;
    };

    const points = generateCurvePoints();

    // Format for Chart.js
    setChartData({
      labels: points.map(point => point.x),
      datasets: [
        {
          label: `${selectedPool.token1Symbol} 数量`,
          data: points.map(point => point.y),
          borderColor: "rgba(53, 162, 235, 1)",
          backgroundColor: "rgba(53, 162, 235, 0.2)",
          fill: true,
          tension: 0.4,
        },
      ],
    });
  }, [selectedPool]);

  if (!selectedPool || !chartData) {
    return (
      <div className="card bg-base-100 shadow-xl p-4">
        <h2 className="text-2xl font-bold mb-4">储备曲线</h2>
        <div className="flex justify-center items-center h-64">
          <p className="text-center text-base-content">选择一个池子查看储备曲线</p>
        </div>
      </div>
    );
  }

  // Current position marker
  const currentPoint = {
    x: Number(selectedPool.reserve0) / (selectedPool.token0Symbol === "WBTC" ? 10 ** 8 : selectedPool.token0Symbol === "USDC" ? 10 ** 6 : 10 ** 18),
    y: Number(selectedPool.reserve1) / (selectedPool.token1Symbol === "WBTC" ? 10 ** 8 : selectedPool.token1Symbol === "USDC" ? 10 ** 6 : 10 ** 18),
  };

  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: true,
          text: `${selectedPool.token0Symbol} 数量`,
        },
        ticks: {
          callback: function(value: any) {
            // Format large numbers
            return value >= 1000 
              ? (value / 1000).toFixed(1) + 'k' 
              : value.toFixed(1);
          }
        },
        grid: {
          display: true,
          drawOnChartArea: true,
        },
      },
      y: {
        title: {
          display: true,
          text: `${selectedPool.token1Symbol} 数量`,
        },
        ticks: {
          callback: function(value: any) {
            return value >= 1000 
              ? (value / 1000).toFixed(1) + 'k' 
              : value.toFixed(1);
          }
        },
        grid: {
          display: true,
          drawOnChartArea: true,
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: function(context: any) {
            const x = context[0].parsed.x;
            return `${selectedPool.token0Symbol}: ${x.toFixed(4)}`;
          },
          label: function(context: any) {
            const y = context.parsed.y;
            return `${selectedPool.token1Symbol}: ${y.toFixed(4)}`;
          },
          afterLabel: function(context: any) {
            const x = context.parsed.x;
            const y = context.parsed.y;
            return `x * y = k = ${(x * y).toFixed(2)}`;
          },
        },
      },
      title: {
        display: true,
        text: `恒定乘积曲线 (x * y = k)`,
      },
      legend: {
        display: false,
      },
    },
  };

  // Add annotation plugin to show current position
  const PointAnnotation = () => {
    return (
      <div className="absolute" style={{ 
        top: `calc(50% - ${currentPoint.y / chartData.labels[chartData.labels.length - 1] * 50}%)`, 
        left: `calc(${currentPoint.x / chartData.labels[chartData.labels.length - 1] * 100}% - 6px)`,
        backgroundColor: 'red',
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        zIndex: 10
      }}></div>
    );
  };

  return (
    <div className="card bg-base-100 shadow-xl p-4">
      <h2 className="text-2xl font-bold mb-4">储备曲线</h2>
      <div className="relative h-64">
        <Line data={chartData} options={options} />
        <PointAnnotation />
      </div>
      <div className="mt-4 text-center text-sm">
        <p>当前储备: {currentPoint.x.toFixed(4)} {selectedPool.token0Symbol} 和 {currentPoint.y.toFixed(4)} {selectedPool.token1Symbol}</p>
        <p>k = {(currentPoint.x * currentPoint.y).toFixed(2)}</p>
      </div>
    </div>
  );
}; 