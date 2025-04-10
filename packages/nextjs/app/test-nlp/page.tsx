"use client";

import React, { useState } from "react";
import { notification } from "~~/utils/scaffold-eth";

interface TestCase {
  id: number;
  input: string;
  expectedOutput: string;
  openaiOutput?: string;
  customModelOutput?: string;
}

const defaultTestCases: TestCase[] = [
  {
    id: 1,
    input: "Swap 0.1 ETH for USDC",
    expectedOutput: JSON.stringify({
      function: "swap",
      parameters: {
        fromToken: "ETH",
        toToken: "USDC",
        amount: "0.1"
      }
    }, null, 2)
  },
  {
    id: 2,
    input: "Exchange 100 USDC for ETH",
    expectedOutput: JSON.stringify({
      function: "swap",
      parameters: {
        fromToken: "USDC",
        toToken: "ETH",
        amount: "100"
      }
    }, null, 2)
  },
  {
    id: 3,
    input: "Add liquidity with 0.5 ETH and 1000 USDC",
    expectedOutput: JSON.stringify({
      function: "addLiquidity",
      parameters: {
        token0: "ETH",
        token1: "USDC",
        amount0: "0.5",
        amount1: "1000"
      }
    }, null, 2)
  },
  {
    id: 4,
    input: "Remove 50% of my liquidity from ETH/USDC pool",
    expectedOutput: JSON.stringify({
      function: "removeLiquidity",
      parameters: {
        token0: "ETH",
        token1: "USDC",
        percent: "50"
      }
    }, null, 2)
  },
  {
    id: 5,
    input: "I want to trade 1.5 ETH for WBTC",
    expectedOutput: JSON.stringify({
      function: "swap",
      parameters: {
        fromToken: "ETH",
        toToken: "WBTC",
        amount: "1.5"
      }
    }, null, 2)
  },
  {
    id: 6,
    input: "Provide 2 ETH and 4000 USDC as liquidity",
    expectedOutput: JSON.stringify({
      function: "addLiquidity",
      parameters: {
        token0: "ETH",
        token1: "USDC",
        amount0: "2",
        amount1: "4000"
      }
    }, null, 2)
  },
  {
    id: 7,
    input: "Withdraw all my liquidity from ETH/USDC pool",
    expectedOutput: JSON.stringify({
      function: "removeLiquidity",
      parameters: {
        token0: "ETH",
        token1: "USDC",
        percent: "100"
      }
    }, null, 2)
  },
  {
    id: 8,
    input: "Swap exactly 500 USDC for ETH",
    expectedOutput: JSON.stringify({
      function: "swap",
      parameters: {
        fromToken: "USDC",
        toToken: "ETH",
        amount: "500"
      }
    }, null, 2)
  },
  {
    id: 9,
    input: "Convert 0.25 ETH to WBTC",
    expectedOutput: JSON.stringify({
      function: "swap",
      parameters: {
        fromToken: "ETH",
        toToken: "WBTC",
        amount: "0.25"
      }
    }, null, 2)
  },
  {
    id: 10,
    input: "Add liquidity: 0.75 ETH and 1500 USDC",
    expectedOutput: JSON.stringify({
      function: "addLiquidity",
      parameters: {
        token0: "ETH",
        token1: "USDC",
        amount0: "0.75",
        amount1: "1500"
      }
    }, null, 2)
  },
  {
    id: 11,
    input: "Trade 0.05 WBTC for USDC",
    expectedOutput: JSON.stringify({
      function: "swap",
      parameters: {
        fromToken: "WBTC",
        toToken: "USDC",
        amount: "0.05"
      }
    }, null, 2)
  },
  {
    id: 12,
    input: "Remove 25% of my ETH/USDC liquidity",
    expectedOutput: JSON.stringify({
      function: "removeLiquidity",
      parameters: {
        token0: "ETH",
        token1: "USDC",
        percent: "25"
      }
    }, null, 2)
  },
  {
    id: 13,
    input: "I'd like to provide liquidity with 3 ETH and 6000 USDC",
    expectedOutput: JSON.stringify({
      function: "addLiquidity",
      parameters: {
        token0: "ETH",
        token1: "USDC",
        amount0: "3",
        amount1: "6000"
      }
    }, null, 2)
  },
  {
    id: 14,
    input: "Exchange 1 WBTC for ETH",
    expectedOutput: JSON.stringify({
      function: "swap",
      parameters: {
        fromToken: "WBTC",
        toToken: "ETH",
        amount: "1"
      }
    }, null, 2)
  },
  {
    id: 15,
    input: "Withdraw 75% liquidity from WBTC/ETH pool",
    expectedOutput: JSON.stringify({
      function: "removeLiquidity",
      parameters: {
        token0: "WBTC",
        token1: "ETH",
        percent: "75"
      }
    }, null, 2)
  },
  {
    id: 16,
    input: "Swap 200 USDC to WBTC",
    expectedOutput: JSON.stringify({
      function: "swap",
      parameters: {
        fromToken: "USDC",
        toToken: "WBTC",
        amount: "200"
      }
    }, null, 2)
  },
  {
    id: 17,
    input: "Add 0.3 ETH and 600 USDC as liquidity",
    expectedOutput: JSON.stringify({
      function: "addLiquidity",
      parameters: {
        token0: "ETH",
        token1: "USDC",
        amount0: "0.3",
        amount1: "600"
      }
    }, null, 2)
  },
  {
    id: 18,
    input: "Remove all liquidity from WBTC/USDC pool",
    expectedOutput: JSON.stringify({
      function: "removeLiquidity",
      parameters: {
        token0: "WBTC",
        token1: "USDC",
        percent: "100"
      }
    }, null, 2)
  },
  {
    id: 19,
    input: "Exchange 0.5 WBTC for 10000 USDC",
    expectedOutput: JSON.stringify({
      function: "swap",
      parameters: {
        fromToken: "WBTC",
        toToken: "USDC",
        amount: "0.5"
      }
    }, null, 2)
  },
  {
    id: 20,
    input: "Provide 0.1 WBTC and 0.5 ETH as liquidity",
    expectedOutput: JSON.stringify({
      function: "addLiquidity",
      parameters: {
        token0: "WBTC",
        token1: "ETH",
        amount0: "0.1",
        amount1: "0.5"
      }
    }, null, 2)
  }
];

// Sample pool data for testing
const mockPoolData = {
  address: "0x1234567890123456789012345678901234567890",
  token0: "0x2222222222222222222222222222222222222222",
  token1: "0x3333333333333333333333333333333333333333",
  token0Symbol: "ETH",
  token1Symbol: "USDC",
  reserve0: "1000000000000000000",
  reserve1: "2000000000",
};

export default function TestNLPPage() {
  const [testCases, setTestCases] = useState<TestCase[]>(defaultTestCases);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentTestCaseId, setCurrentTestCaseId] = useState<number | null>(null);
  const [openaiApiKey, setOpenaiApiKey] = useState<string>("");
  const [customModelUrl, setCustomModelUrl] = useState<string>("");
  const [newTestCase, setNewTestCase] = useState<{
    input: string;
    expectedOutput: string;
  }>({ input: "", expectedOutput: "" });

  // Process a test case with OpenAI
  const processWithOpenAI = async (input: string): Promise<string> => {
    try {
      const response = await fetch('/api/processNaturalLanguage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input,
          pool: mockPoolData,
          apiKey: openaiApiKey || undefined
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to process: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        return `Error: ${data.message}`;
      }

      return JSON.stringify(data.action, null, 2);
    } catch (error) {
      console.error("Error processing with OpenAI:", error);
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  // Process a test case with custom model
  const processWithCustomModel = async (input: string): Promise<string> => {
    if (!customModelUrl) {
      return "No custom model URL provided";
    }

    try {
      const response = await fetch(customModelUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input,
          pool: mockPoolData
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to process: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        return `Error: ${data.message}`;
      }

      return JSON.stringify(data.action, null, 2);
    } catch (error) {
      console.error("Error processing with custom model:", error);
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  // Run a test case
  const runTestCase = async (testCaseId: number) => {
    setIsProcessing(true);
    setCurrentTestCaseId(testCaseId);

    const testCase = testCases.find(tc => tc.id === testCaseId);
    if (!testCase) {
      notification.error("Test case not found");
      setIsProcessing(false);
      setCurrentTestCaseId(null);
      return;
    }

    try {
      // Process with OpenAI
      const openaiOutput = await processWithOpenAI(testCase.input);
      
      // Process with custom model if URL is provided
      let customModelOutput = "Not processed";
      if (customModelUrl) {
        customModelOutput = await processWithCustomModel(testCase.input);
      }

      // Update test case results
      setTestCases(prevTestCases => prevTestCases.map(tc => 
        tc.id === testCaseId 
          ? { ...tc, openaiOutput, customModelOutput } 
          : tc
      ));

      notification.success(`Test case ${testCaseId} processed`);
    } catch (error) {
      console.error("Error running test case:", error);
      notification.error("Failed to process test case");
    } finally {
      setIsProcessing(false);
      setCurrentTestCaseId(null);
    }
  };

  // Add a new test case
  const addNewTestCase = () => {
    if (!newTestCase.input.trim() || !newTestCase.expectedOutput.trim()) {
      notification.error("Please fill in both input and expected output");
      return;
    }
    
    try {
      // Validate JSON format of expected output
      JSON.parse(newTestCase.expectedOutput);
      
      const newId = Math.max(...testCases.map(tc => tc.id)) + 1;
      
      setTestCases([
        ...testCases,
        {
          id: newId,
          input: newTestCase.input,
          expectedOutput: newTestCase.expectedOutput,
        }
      ]);
      
      setNewTestCase({ input: "", expectedOutput: "" });
      notification.success("New test case added");
    } catch (error) {
      notification.error("Invalid JSON format in expected output");
    }
  };

  return (
    <div className="flex flex-col gap-8 py-8 px-4 md:px-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold mb-4">Natural Language Processing Test Suite</h1>
        <p className="mb-6 text-lg">
          Test and compare processing of natural language inputs for Uniswap operations
        </p>
      </div>

      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">Configuration</h2>
          
          <div className="form-control mt-2">
            <label className="label">
              <span className="label-text">OpenAI API Key (optional)</span>
            </label>
            <input
              type="password"
              placeholder="Enter your OpenAI API key"
              className="input input-bordered w-full"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
            />
            <p className="text-sm mt-1 text-gray-500">
              If not provided, the system will use the server-side configured key
            </p>
          </div>
          
          <div className="form-control mt-2">
            <label className="label">
              <span className="label-text">Custom Model URL</span>
            </label>
            <input
              type="text"
              placeholder="Enter custom model API URL"
              className="input input-bordered w-full"
              value={customModelUrl}
              onChange={(e) => setCustomModelUrl(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">Add New Test Case</h2>
          
          <div className="form-control mt-2">
            <label className="label">
              <span className="label-text">Natural Language Input</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="Enter natural language input (e.g., 'Swap 0.1 ETH for USDC')"
              value={newTestCase.input}
              onChange={(e) => setNewTestCase(prev => ({ ...prev, input: e.target.value }))}
            />
          </div>
          
          <div className="form-control mt-2">
            <label className="label">
              <span className="label-text">Expected Output (JSON)</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="Enter expected JSON output"
              value={newTestCase.expectedOutput}
              onChange={(e) => setNewTestCase(prev => ({ ...prev, expectedOutput: e.target.value }))}
            />
          </div>
          
          <button 
            className="btn btn-primary mt-4"
            onClick={addNewTestCase}
          >
            Add Test Case
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>ID</th>
              <th>Input</th>
              <th>Expected Output</th>
              <th>OpenAI Output</th>
              <th>Custom Model Output</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {testCases.map(testCase => (
              <tr key={testCase.id} className="hover">
                <td>{testCase.id}</td>
                <td className="max-w-xs overflow-hidden text-ellipsis">{testCase.input}</td>
                <td>
                  <pre className="whitespace-pre-wrap bg-base-200 p-2 rounded-md text-xs overflow-auto max-h-40 max-w-xs">
                    {testCase.expectedOutput}
                  </pre>
                </td>
                <td>
                  {testCase.openaiOutput ? (
                    <pre className="whitespace-pre-wrap bg-base-200 p-2 rounded-md text-xs overflow-auto max-h-40 max-w-xs">
                      {testCase.openaiOutput}
                    </pre>
                  ) : (
                    <span className="text-gray-400">Not processed</span>
                  )}
                </td>
                <td>
                  {testCase.customModelOutput ? (
                    <pre className="whitespace-pre-wrap bg-base-200 p-2 rounded-md text-xs overflow-auto max-h-40 max-w-xs">
                      {testCase.customModelOutput}
                    </pre>
                  ) : (
                    <span className="text-gray-400">Not processed</span>
                  )}
                </td>
                <td>
                  <button 
                    className={`btn btn-sm btn-primary ${isProcessing && currentTestCaseId === testCase.id ? 'loading' : ''}`}
                    onClick={() => runTestCase(testCase.id)}
                    disabled={isProcessing}
                  >
                    Run Test
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 