import { NextResponse } from 'next/server';

// Get OpenAI API key from environment variable
const defaultOpenaiApiKey = process.env.OPENAI_API_KEY;

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { input, pool, apiKey } = body;

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

    // Create a system prompt with information about available functions
    const systemPrompt = `
      You are a helpful assistant that converts natural language instructions into structured actions for a Uniswap-like decentralized exchange.
      You have the following functions available:

      1. swap(fromToken, toToken, amount)
         - fromToken: The token to swap from (e.g., "ETH", "USDC", "WETH")
         - toToken: The token to swap to (e.g., "ETH", "USDC", "WETH")
         - amount: The amount to swap (e.g., "0.1", "100")

      2. addLiquidity(token0, token1, amount0, amount1)
         - token0: The first token in the pair (e.g., "ETH", "USDC", "WETH")
         - token1: The second token in the pair (e.g., "ETH", "USDC", "WETH")
         - amount0: The amount of the first token (e.g., "0.1", "100")
         - amount1: The amount of the second token (e.g., "0.1", "100")

      3. removeLiquidity(token0, token1, percent)
         - token0: The first token in the pair (e.g., "ETH", "USDC", "WETH")
         - token1: The second token in the pair (e.g., "ETH", "USDC", "WETH")
         - percent: The percentage of liquidity to remove (e.g., "50", "100")

      Current pool information:
      - Pool Address: ${pool.address}
      - Token0: ${pool.token0Symbol} (${pool.token0})
      - Token1: ${pool.token1Symbol} (${pool.token1})
      - Reserve0: ${pool.reserve0}
      - Reserve1: ${pool.reserve1}

      IMPORTANT: If a user mentions "ETH", use "ETH" in your response.
      If a user specifically mentions "WETH", use "WETH" in your response.
      Remember that "ETH" and "WETH" should be treated as separate tokens with different symbols.
      Only use the exact token symbols that are in the current pool (${pool.token0Symbol} or ${pool.token1Symbol}) or that the user explicitly mentions.

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
    
    // Check if OpenAI API key is available
    if (!openaiApiKey) {
      console.error('OpenAI API key is not configured');
      return NextResponse.json(
        { success: false, message: 'LLM service is not configured' },
        { status: 500 }
      );
    }

    // Call OpenAI API using fetch instead of the OpenAI package
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
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
      const llmResponseContent = data.choices[0].message.content || '';
      
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
      console.error('Error calling OpenAI API:', error);
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