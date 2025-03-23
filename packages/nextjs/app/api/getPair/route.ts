import { NextRequest } from 'next/server';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import externalContracts from '~~/contracts/externalContracts';

// 获取环境变量中的Alchemy API Key
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || 'acn7zdrU5xIrMMxfS1Hu9v-SEcEy_geV';

// 创建公共客户端连接，使用Alchemy API
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(`https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`)
});

// 预定义的池子地址列表 (按索引访问)
const KNOWN_PAIRS = [
  "0xCd40Fb4Bae9A7e2240975A590E23dA8a5AE3df67" // 我们创建的TEST/WETH池子
];

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const factory = searchParams.get('factory');
    const indexParam = searchParams.get('index');
    const token0 = searchParams.get('token0');
    const token1 = searchParams.get('token1');

    // 如果提供了索引参数，从预定义列表返回池子地址
    if (indexParam !== null) {
      const index = parseInt(indexParam);
      if (isNaN(index) || index < 0) {
        return Response.json({ error: 'Invalid index parameter' }, { status: 400 });
      }
      
      if (index < KNOWN_PAIRS.length) {
        const pairAddress = KNOWN_PAIRS[index];
        console.log(`通过索引 ${index} 返回预定义池子地址: ${pairAddress}`);
        return Response.json(pairAddress);
      } else {
        console.log(`索引 ${index} 超出预定义池子范围`);
        return Response.json(null);
      }
    }
    
    // 如果提供了token0和token1参数，通过getPair方法查询
    if (factory && token0 && token1) {
      // 获取Uniswap工厂ABI
      const factoryAbi = externalContracts[11155111].UniswapV2Factory.abi;

      console.log(`尝试获取池子地址，factory: ${factory}, token0: ${token0}, token1: ${token1}`);

      // 调用合约方法获取池子地址
      const pairAddress = await publicClient.readContract({
        address: factory as `0x${string}`,
        abi: factoryAbi,
        functionName: 'getPair',
        args: [token0 as `0x${string}`, token1 as `0x${string}`],
      });

      // 第二个请求，反过来检查
      let reversePairAddress;
      if (pairAddress === '0x0000000000000000000000000000000000000000') {
        console.log('没有找到池子，尝试反转代币顺序');
        reversePairAddress = await publicClient.readContract({
          address: factory as `0x${string}`,
          abi: factoryAbi,
          functionName: 'getPair',
          args: [token1 as `0x${string}`, token0 as `0x${string}`],
        });
      }

      // 如果找到了池子地址
      if (pairAddress !== '0x0000000000000000000000000000000000000000' || 
          (reversePairAddress && reversePairAddress !== '0x0000000000000000000000000000000000000000')) {
        const finalAddress = pairAddress !== '0x0000000000000000000000000000000000000000' ? pairAddress : reversePairAddress;
        console.log(`获取到池子地址: ${finalAddress}`);
        return Response.json({ pairAddress: finalAddress });
      } else {
        console.log('未找到池子');
        return Response.json({ pairAddress: null });
      }
    }

    // 如果没有提供足够的参数
    return Response.json({ error: 'Missing required parameters. Need either index or (factory, token0, token1)' }, { status: 400 });
  } catch (error) {
    console.error('获取池子地址失败:', error);
    return Response.json({ error: '获取池子地址失败', details: error }, { status: 500 });
  }
} 