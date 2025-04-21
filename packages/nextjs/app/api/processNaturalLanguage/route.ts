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
    
    // 使用提供的API密钥或默认值
    const actualApiKey = apiKey || "neu-3e21der1trt341!f";
    headers['Authorization'] = `Bearer ${actualApiKey}`;

    // 从customURL中提取基础URL
    // 如果用户提供完整URL，使用它；否则构建基础URL
    const baseUrl = customURL.includes('/v1') 
      ? customURL.substring(0, customURL.indexOf('/v1') + 3)
      : customURL.replace(/\/$/, '') + '/v1';
    
    // 确保使用/v1/chat/completions端点
    const endpoint = `${baseUrl}/chat/completions`;

    console.log(`Calling custom LLM at endpoint: ${endpoint}`);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          
          model: "neuralmagic/Meta-Llama-3.1-8B-Instruct-quantized.w4a16",
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input }
          ],
          temperature: 0.2
          // 不使用response_format，兼容更多模型
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Custom LLM error response:', errorText);
        throw new Error(`Custom LLM API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Custom LLM response data:', JSON.stringify(data));
      
      // 处理不同格式的响应
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        // OpenAI兼容格式
        return data.choices[0].message.content || '';
      } else if (data.response) {
        // 某些自定义格式
        return data.response;
      } else if (typeof data.output === 'string') {
        // 另一种自定义格式
        return data.output;
      } else if (typeof data === 'string') {
        // 直接返回字符串
        return data;
      }
      
      // 找不到有效的响应内容
      console.error('Unexpected LLM response format:', data);
      throw new Error('Unable to parse LLM response: unexpected format');
    } catch (error) {
      console.error('Error calling custom LLM:', error);
      throw error;
    }
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
    // 如果customLLMUrl未定义，则使用环境变量；如果环境变量也未定义，默认设为Modal.run URL
    const defaultModalUrl = "https://neu-info5100-oak-spr-2025--example-vllm-openai-compatible-serve.modal.run/v1";
    const llmUrl = customLLMUrl || defaultCustomLLMUrl || defaultModalUrl;

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

      Important: You MUST return a valid JSON object with either a 'function' and 'parameters' fields, or an 'error' field. Your entire response must be valid JSON and nothing else.

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
      // 记录请求信息
      console.log(`Processing natural language request: "${input}"`);
      console.log(`Using LLM URL: ${llmUrl}`);
      
      // 默认使用自定义URL (Modal.run)
      let llmResponseContent;
      try {
        llmResponseContent = await LLMService.processWithCustomURL(input, systemPrompt, llmUrl, apiKey);
      } catch (customUrlError) {
        // 如果自定义URL失败，并且有OpenAI API密钥，尝试使用OpenAI
        console.error('Error with custom LLM:', customUrlError);
        if (openaiApiKey) {
          console.log('Falling back to OpenAI API');
          llmResponseContent = await LLMService.processWithOpenAI(input, systemPrompt, openaiApiKey);
        } else {
          throw customUrlError; // 重新抛出错误
        }
      }
      
      console.log(`LLM response content: ${llmResponseContent}`);
      
      // 确保响应是有效的JSON
      let parsedResponse;
      try {
        // 尝试清理响应内容，删除可能影响JSON解析的字符
        const cleanedResponse = llmResponseContent
          .replace(/^```json/, '') // 删除可能的Markdown JSON代码块开始
          .replace(/```$/, '')     // 删除可能的Markdown代码块结束
          .trim();                 // 删除前后空白
          
        console.log('Cleaned response for JSON parsing:', cleanedResponse);
        parsedResponse = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('Failed to parse LLM response as JSON:', parseError);
        console.error('Raw response:', llmResponseContent);
        
        // 尝试使用正则表达式提取JSON部分
        try {
          const jsonMatch = llmResponseContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const extractedJson = jsonMatch[0];
            console.log('Extracted JSON using regex:', extractedJson);
            parsedResponse = JSON.parse(extractedJson);
          } else {
            throw new Error('No JSON object found in response');
          }
        } catch (regexError) {
          // 如果仍然无法解析，返回错误
          return NextResponse.json(
            { 
              success: false, 
              message: 'Invalid LLM response format: not valid JSON', 
              rawResponse: llmResponseContent 
            },
            { status: 500 }
          );
        }
      }
      
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
          { 
            success: false, 
            message: 'Missing function in response',
            rawResponse: parsedResponse
          },
          { status: 400 }
        );
      }

      // Check if the function is valid
      const validFunctions = ['swap', 'addLiquidity', 'removeLiquidity'];
      if (!validFunctions.includes(parsedResponse.function)) {
        return NextResponse.json(
          { 
            success: false, 
            message: `Invalid function: ${parsedResponse.function}`,
            rawResponse: parsedResponse
          },
          { status: 400 }
        );
      }

      // Check if parameters exist
      if (!parsedResponse.parameters) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Missing parameters in response',
            rawResponse: parsedResponse
          },
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
        { success: false, message: `Error calling language model API: ${error instanceof Error ? error.message : String(error)}` },
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