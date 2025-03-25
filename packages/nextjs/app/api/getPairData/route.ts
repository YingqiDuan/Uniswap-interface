import { NextRequest } from 'next/server';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import externalContracts from '~~/contracts/externalContracts';

// Get Alchemy API Key from environment variables
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || 'acn7zdrU5xIrMMxfS1Hu9v-SEcEy_geV';

// Create public client connection using Alchemy API
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(`https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`)
});

// ERC20 token ABI
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
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const pair = searchParams.get('pair');

    if (!pair) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log(`Attempting to get data for pool ${pair}`);

    // Get Uniswap Pair ABI
    const pairAbi = externalContracts[11155111].UniswapV2Pair.abi;

    // Parallel call contract methods to get pool information
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

    // Log detailed information
    console.log(`Retrieved token information for pool ${pair}:`);
    console.log(`- token0 address: ${token0}`);
    console.log(`- token1 address: ${token1}`);
    console.log(`- reserve0 (original BigInt): ${reserves[0]}`);
    console.log(`- reserve0 (converted to number): ${Number(reserves[0])}`);
    console.log(`- reserve1 (original BigInt): ${reserves[1]}`);
    console.log(`- reserve1 (converted to number): ${Number(reserves[1])}`);
    console.log(`- blockTimestampLast: ${reserves[2]}`);

    // Get token symbols
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
      
      console.log(`Retrieved token0 symbol: ${token0Symbol}, decimal places: ${token0Decimals}`);
    } catch (error) {
      console.error('Failed to retrieve token0 information:', error);
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
      
      console.log(`Retrieved token1 symbol: ${token1Symbol}, decimal places: ${token1Decimals}`);
    } catch (error) {
      console.error('Failed to retrieve token1 information:', error);
    }

    // Return merged data
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
    
    console.log(`Returning complete JSON data for pool ${pair}:`);
    console.log(JSON.stringify(result, null, 2));
    return Response.json(result);
  } catch (error) {
    console.error('Failed to retrieve pool details:', error);
    return Response.json({ error: 'Failed to retrieve pool details', details: error }, { status: 500 });
  }
} 