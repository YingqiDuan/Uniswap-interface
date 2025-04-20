import { NextResponse } from 'next/server';

// 大语言模型服务类 - 分离OpenAI和自定义URL的处理逻辑
class LLMService {
  static async processWithOpenAI(input: string, systemPrompt: string, apiKey: string) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.choices[0].message.content || '';
  }

  static async processWithCustomURL(input: string, systemPrompt: string, customURL: string, apiKey?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(customURL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Custom LLM API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || data.response || '';
  }
}

// Get OpenAI API key from environment variable
const defaultOpenaiApiKey = process.env.OPENAI_API_KEY;
const defaultCustomLLMUrl = process.env.CUSTOM_LLM_URL;

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { input, pool, apiKey, customLLMUrl } = body;

    if (!input) {
      return NextResponse.json(
        { success: false, message: 'Missing input' },
        { status: 400 }
      );
    }

    if (!pool) {
      return NextResponse.json(
        { success: false, message: 'Missing pool information' },
        { status: 400 }
      );
    }

    // Use provided API key or fall back to the default one
    const openaiApiKey = apiKey || defaultOpenaiApiKey;
    const llmUrl = customLLMUrl || defaultCustomLLMUrl;

    // Create a system prompt with information about available functions
    const systemPrompt = `
      You are a helpful assistant that converts natural language instructions into structured actions for a Uniswap-like decentralized exchange.
      You have the following functions available:

      1. swap(fromToken, toToken, amount)
         - fromToken: The token to swap from (e.g., "ETH", "USDC")
         - toToken: The token to swap to (e.g., "ETH", "USDC")
         - amount: The amount to swap (e.g., "0.1", "100")

      2. addLiquidity(token0, token1, amount0, amount1)
         - token0: The first token in the pair (e.g., "ETH", "USDC")
         - token1: The second token in the pair (e.g., "ETH", "USDC")
         - amount0: The amount of the first token (e.g., "0.1", "100") - if only this is provided, amount1 will be calculated based on current pool ratio
         - amount1: The amount of the second token (e.g., "0.1", "100") - if only this is provided, amount0 will be calculated based on current pool ratio
         - Note: You can provide either both amounts or just one amount. If only one is provided, the other will be calculated automatically.

      3. removeLiquidity(token0, token1, percent, amount0, amount1)
         - token0: The first token in the pair (e.g., "ETH", "USDC")
         - token1: The second token in the pair (e.g., "ETH", "USDC")
         - percent: The percentage of liquidity to remove (e.g., "50", "100") - used when user wants to remove a percentage of their liquidity
         - amount0: The amount of token0 to withdraw (e.g., "0.1", "100") - if only this is provided, percent will be calculated based on token0 amount
         - amount1: The amount of token1 to withdraw (e.g., "0.1", "100") - if only this is provided, percent will be calculated based on token1 amount
         - Note: You must provide either 'percent' OR one of 'amount0'/'amount1', but not both. If a token amount is provided, the system will calculate the needed percentage to withdraw that amount.

      Current pool information:
      - Pool Address: ${pool.address}
      - Token0: ${pool.token0Symbol} (${pool.token0})
      - Token1: ${pool.token1Symbol} (${pool.token1})
      - Reserve0: ${pool.reserve0}
      - Reserve1: ${pool.reserve1}

      Return your response as a JSON object with the following structure:
      {
        "function": "swap" | "addLiquidity" | "removeLiquidity",
        "parameters": {
          // Include the appropriate parameters for the selected function
        }
      }

      If the user instruction is unclear or cannot be mapped to one of these functions, return:
      {
        "error": "Explanation of the issue"
      }
    `;
    
    try {
      // 根据是否有自定义URL决定使用哪个处理方法
      let llmResponseContent;
      if (llmUrl) {
        // 使用自定义URL处理
        if (!llmUrl) {
          return NextResponse.json(
            { success: false, message: 'Custom LLM URL is not configured' },
            { status: 500 }
          );
        }
        llmResponseContent = await LLMService.processWithCustomURL(input, systemPrompt, llmUrl, apiKey);
      } else {
        // 使用OpenAI处理
        if (!openaiApiKey) {
          return NextResponse.json(
            { success: false, message: 'OpenAI API key is not configured' },
            { status: 500 }
          );
        }
        llmResponseContent = await LLMService.processWithOpenAI(input, systemPrompt, openaiApiKey);
      }
      
      // Parse the LLM response
      const parsedResponse = JSON.parse(llmResponseContent);
      
      // Check if the response contains an error
      if (parsedResponse.error) {
        return NextResponse.json(
          { success: false, message: parsedResponse.error },
          { status: 400 }
        );
      }

      // Validate the function and parameters
      if (!parsedResponse.function) {
        return NextResponse.json(
          { success: false, message: 'Missing function in response' },
          { status: 400 }
        );
      }

      // Check if the function is valid
      const validFunctions = ['swap', 'addLiquidity', 'removeLiquidity'];
      if (!validFunctions.includes(parsedResponse.function)) {
        return NextResponse.json(
          { success: false, message: `Invalid function: ${parsedResponse.function}` },
          { status: 400 }
        );
      }

      // Check if parameters exist
      if (!parsedResponse.parameters) {
        return NextResponse.json(
          { success: false, message: 'Missing parameters in response' },
          { status: 400 }
        );
      }

      // Return the structured response
      return NextResponse.json({
        success: true,
        action: {
          function: parsedResponse.function,
          parameters: parsedResponse.parameters
        }
      });
      
    } catch (error) {
      console.error('Error calling LLM API:', error);
      return NextResponse.json(
        { success: false, message: 'Error calling language model API' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error processing natural language:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
} 