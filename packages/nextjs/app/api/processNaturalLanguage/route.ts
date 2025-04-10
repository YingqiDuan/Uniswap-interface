import { NextResponse } from 'next/server';

// Get OpenAI API key from environment variable
const defaultOpenaiApiKey = process.env.OPENAI_API_KEY;

export async function POST(request: Request) {
  // 添加CORS头，允许跨域请求
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // 对OPTIONS请求的处理 (预检请求)
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers });
  }

  try {
    // 获取配置和输入数据
    console.log('API请求开始处理');
    const openaiApiKey = defaultOpenaiApiKey;
    console.log('API Key可用性:', openaiApiKey ? '已配置' : '未配置');

    // Parse the request body
    const body = await request.json();
    const { input, pool, apiKey } = body;

    console.log('接收到的请求数据:', { 
      input: input ? '有输入' : '无输入', 
      pool: pool ? '有池信息' : '无池信息',
      customApiKey: apiKey ? '有自定义API Key' : '无自定义API Key'
    });

    // 输入验证
    if (!input) {
      console.log('错误: 缺少输入');
      return NextResponse.json(
        { success: false, message: 'Missing input' },
        { status: 400, headers }
      );
    }

    if (!pool) {
      console.log('错误: 缺少池信息');
      return NextResponse.json(
        { success: false, message: 'Missing pool information' },
        { status: 400, headers }
      );
    }

    // Use provided API key or fall back to the default one
    const finalApiKey = apiKey || openaiApiKey;

    // Check if OpenAI API key is available
    if (!finalApiKey) {
      console.error('OpenAI API key is not configured');
      return NextResponse.json(
        { success: false, message: 'LLM service is not configured. Please provide an OpenAI API key.' },
        { status: 500, headers }
      );
    }

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
         - amount0: The amount of the first token (e.g., "0.1", "100")
         - amount1: The amount of the second token (e.g., "0.1", "100")

      3. removeLiquidity(token0, token1, percent)
         - token0: The first token in the pair (e.g., "ETH", "USDC")
         - token1: The second token in the pair (e.g., "ETH", "USDC")
         - percent: The percentage of liquidity to remove (e.g., "50", "100")

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
    
    // Call OpenAI API using fetch instead of the OpenAI package
    try {
      console.log('准备调用OpenAI API');
      
      const apiRequestBody = {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      };
      
      console.log('API请求参数:', {
        model: apiRequestBody.model,
        messageCount: apiRequestBody.messages.length,
        temperature: apiRequestBody.temperature
      });
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${finalApiKey}`
        },
        body: JSON.stringify(apiRequestBody)
      });

      // 检查OpenAI API的响应
      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenAI API错误:', response.status, errorData);
        
        // 根据状态码返回更具体的错误信息
        if (response.status === 401) {
          return NextResponse.json(
            { success: false, message: 'OpenAI API密钥无效或已过期，请提供有效的API密钥' },
            { status: 401, headers }
          );
        } else if (response.status === 429) {
          return NextResponse.json(
            { success: false, message: 'OpenAI API调用次数超限或余额不足' },
            { status: 429, headers }
          );
        } else {
          return NextResponse.json(
            { success: false, message: `OpenAI API错误: ${response.status} - ${errorData.substring(0, 100)}` },
            { status: response.status, headers }
          );
        }
      }

      const data = await response.json();
      console.log('OpenAI API响应成功');
      
      const llmResponseContent = data.choices[0].message.content || '';
      console.log('LLM响应:', llmResponseContent.substring(0, 100) + '...');
      
      // Parse the LLM response
      try {
        const parsedResponse = JSON.parse(llmResponseContent);
        
        // Check if the response contains an error
        if (parsedResponse.error) {
          console.log('LLM返回错误:', parsedResponse.error);
          return NextResponse.json(
            { success: false, message: parsedResponse.error },
            { status: 400, headers }
          );
        }

        // Validate the function and parameters
        if (!parsedResponse.function) {
          console.log('错误: LLM响应缺少function字段');
          return NextResponse.json(
            { success: false, message: 'Missing function in response' },
            { status: 400, headers }
          );
        }

        // Check if the function is valid
        const validFunctions = ['swap', 'addLiquidity', 'removeLiquidity'];
        if (!validFunctions.includes(parsedResponse.function)) {
          console.log(`错误: 无效的function: ${parsedResponse.function}`);
          return NextResponse.json(
            { success: false, message: `Invalid function: ${parsedResponse.function}` },
            { status: 400, headers }
          );
        }

        // Check if parameters exist
        if (!parsedResponse.parameters) {
          console.log('错误: LLM响应缺少parameters字段');
          return NextResponse.json(
            { success: false, message: 'Missing parameters in response' },
            { status: 400, headers }
          );
        }

        // Return the structured response
        console.log('成功解析LLM响应');
        return NextResponse.json({
          success: true,
          action: {
            function: parsedResponse.function,
            parameters: parsedResponse.parameters
          }
        }, { headers });
        
      } catch (error) {
        console.error('解析LLM响应错误:', error);
        return NextResponse.json(
          { 
            success: false, 
            message: 'Failed to parse LLM response',
            details: error instanceof Error ? error.message : String(error),
            rawResponse: llmResponseContent.substring(0, 200) // 包含部分原始响应以便调试
          },
          { status: 500, headers }
        );
      }
      
    } catch (error) {
      console.error('调用OpenAI API错误:', error);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Error calling language model API',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500, headers }
      );
    }
    
  } catch (error) {
    console.error('处理自然语言请求错误:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500, headers }
    );
  }
} 