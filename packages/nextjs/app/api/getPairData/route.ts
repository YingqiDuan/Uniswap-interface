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

// ERC20代币ABI
const ERC20ABI = [
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const pair = searchParams.get('pair');

    if (!pair) {
      return Response.json({ error: '缺少必要参数' }, { status: 400 });
    }

    console.log(`尝试获取池子 ${pair} 的数据`);

    // 获取Uniswap Pair ABI
    const pairAbi = externalContracts[11155111].UniswapV2Pair.abi;

    // 并行调用合约方法获取池子信息
    const [token0, token1, reserves] = await Promise.all([
      publicClient.readContract({
        address: pair as `0x${string}`,
        abi: pairAbi,
        functionName: 'token0',
      }) as Promise<`0x${string}`>,
      publicClient.readContract({
        address: pair as `0x${string}`,
        abi: pairAbi,
        functionName: 'token1',
      }) as Promise<`0x${string}`>,
      publicClient.readContract({
        address: pair as `0x${string}`,
        abi: pairAbi,
        functionName: 'getReserves',
      }) as Promise<[bigint, bigint, number]>
    ]);

    // 详细记录所有信息
    console.log(`获取到池子 ${pair} 的代币信息:`);
    console.log(`- token0 地址: ${token0}`);
    console.log(`- token1 地址: ${token1}`);
    console.log(`- reserve0 (原始BigInt): ${reserves[0]}`);
    console.log(`- reserve0 (转换为数字): ${Number(reserves[0])}`);
    console.log(`- reserve1 (原始BigInt): ${reserves[1]}`);
    console.log(`- reserve1 (转换为数字): ${Number(reserves[1])}`);
    console.log(`- blockTimestampLast: ${reserves[2]}`);

    // 获取代币符号
    let token0Symbol = "Unknown";
    let token1Symbol = "Unknown";
    let token0Decimals = 18;
    let token1Decimals = 18;
    
    try {
      token0Symbol = await publicClient.readContract({
        address: token0,
        abi: ERC20ABI,
        functionName: 'symbol',
      }) as string;
      
      token0Decimals = await publicClient.readContract({
        address: token0,
        abi: ERC20ABI,
        functionName: 'decimals',
      }) as number;
      
      console.log(`获取到代币0符号: ${token0Symbol}, 小数位: ${token0Decimals}`);
    } catch (error) {
      console.error('获取token0信息失败:', error);
    }
    
    try {
      token1Symbol = await publicClient.readContract({
        address: token1,
        abi: ERC20ABI,
        functionName: 'symbol',
      }) as string;
      
      token1Decimals = await publicClient.readContract({
        address: token1,
        abi: ERC20ABI,
        functionName: 'decimals',
      }) as number;
      
      console.log(`获取到代币1符号: ${token1Symbol}, 小数位: ${token1Decimals}`);
    } catch (error) {
      console.error('获取token1信息失败:', error);
    }

    // 返回合并的数据
    const result = {
      token0,
      token1,
      token0Symbol,
      token1Symbol,
      token0Decimals,
      token1Decimals,
      reserve0: reserves[0].toString(),
      reserve1: reserves[1].toString(),
      blockTimestampLast: reserves[2]
    };
    
    console.log(`返回池子 ${pair} 的完整JSON数据:`);
    console.log(JSON.stringify(result, null, 2));
    return Response.json(result);
  } catch (error) {
    console.error('获取池子详情失败:', error);
    return Response.json({ error: '获取池子详情失败', details: error }, { status: 500 });
  }
} 