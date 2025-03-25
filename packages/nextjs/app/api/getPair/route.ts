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

// Predefined list of pool addresses (accessible by index)
const KNOWN_PAIRS = [
  "0xCd40Fb4Bae9A7e2240975A590E23dA8a5AE3df67" // Our created TEST/WETH pool
];

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const factory = searchParams.get('factory');
    const indexParam = searchParams.get('index');
    const token0 = searchParams.get('token0');
    const token1 = searchParams.get('token1');

    // If index parameter is provided, return pool address from predefined list
    if (indexParam !== null) {
      const index = parseInt(indexParam);
      if (isNaN(index) || index < 0) {
        return Response.json({ error: 'Invalid index parameter' }, { status: 400 });
      }
      
      if (index < KNOWN_PAIRS.length) {
        const pairAddress = KNOWN_PAIRS[index];
        console.log(`Returning predefined pool address for index ${index}: ${pairAddress}`);
        return Response.json(pairAddress);
      } else {
        console.log(`Index ${index} is out of range for predefined pools`);
        return Response.json(null);
      }
    }
    
    // If token0 and token1 parameters are provided, query using getPair method
    if (factory && token0 && token1) {
      // Get Uniswap factory ABI
      const factoryAbi = externalContracts[11155111].UniswapV2Factory.abi;

      console.log(`Attempting to get pool address, factory: ${factory}, token0: ${token0}, token1: ${token1}`);

      // Call contract method to get pool address
      const pairAddress = await publicClient.readContract({
        address: factory as `0x${string}`,
        abi: factoryAbi,
        functionName: 'getPair',
        args: [token0 as `0x${string}`, token1 as `0x${string}`],
      });

      // Second request, check in reverse
      let reversePairAddress;
      if (pairAddress === '0x0000000000000000000000000000000000000000') {
        console.log('Pool not found, trying reverse token order');
        reversePairAddress = await publicClient.readContract({
          address: factory as `0x${string}`,
          abi: factoryAbi,
          functionName: 'getPair',
          args: [token1 as `0x${string}`, token0 as `0x${string}`],
        });
      }

      // If pool address is found
      if (pairAddress !== '0x0000000000000000000000000000000000000000' || 
          (reversePairAddress && reversePairAddress !== '0x0000000000000000000000000000000000000000')) {
        const finalAddress = pairAddress !== '0x0000000000000000000000000000000000000000' ? pairAddress : reversePairAddress;
        console.log(`Got pool address: ${finalAddress}`);
        return Response.json({ pairAddress: finalAddress });
      } else {
        console.log('Pool not found');
        return Response.json({ pairAddress: null });
      }
    }

    // If not enough parameters are provided
    return Response.json({ error: 'Missing required parameters. Need either index or (factory, token0, token1)' }, { status: 400 });
  } catch (error) {
    console.error('Failed to get pool address:', error);
    return Response.json({ error: 'Failed to get pool address', details: error }, { status: 500 });
  }
} 