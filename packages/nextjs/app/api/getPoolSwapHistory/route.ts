import { NextRequest } from 'next/server';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { sepolia } from 'viem/chains';

// Get Alchemy API Key from environment variables
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || 'acn7zdrU5xIrMMxfS1Hu9v-SEcEy_geV';

// Create public client connection using Alchemy API
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(`https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`)
});

// Uniswap V2 Pair Swap event
const swapEventAbi = parseAbiItem('event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)');

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const pair = searchParams.get('pair');
    const days = Number(searchParams.get('days') || '30');

    if (!pair) {
      return Response.json({ error: 'Missing pair address' }, { status: 400 });
    }

    console.log(`Fetching swap history for pool ${pair} for last ${days} days`);

    // Calculate timestamp for 'days' ago
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const fromTimestamp = currentTimestamp - (days * 24 * 60 * 60);

    // Get the latest block number
    const toBlockNumber = await publicClient.getBlockNumber();
    
    // Fetch Swap events
    const logs = await publicClient.getLogs({
      address: pair as `0x${string}`,
      event: swapEventAbi,
      fromBlock: BigInt(0), // Start from beginning to ensure we get data, can be optimized
      toBlock: toBlockNumber
    });

    console.log(`Found ${logs.length} swap events`);

    // Group events by day and calculate daily stats
    const dailyData: {
      [date: string]: {
        volume0: bigint;
        volume1: bigint;
        swapCount: number;
        averagePrice: number;
      }
    } = {};

    // Process each swap event
    await Promise.all(
      logs.map(async (log) => {
        try {
          // Get block timestamp for this log
          const block = await publicClient.getBlock({
            blockNumber: log.blockNumber
          });
          
          if (!block.timestamp) return;
          
          // Convert timestamp to date string
          const date = new Date(Number(block.timestamp) * 1000).toISOString().split('T')[0];
          
          // Get amount values from the event
          const { amount0In, amount1In, amount0Out, amount1Out } = log.args as any;
          
          // Calculate volume for this swap
          const volume0 = (amount0In || BigInt(0)) + (amount0Out || BigInt(0));
          const volume1 = (amount1In || BigInt(0)) + (amount1Out || BigInt(0));
          
          // Calculate instantaneous price for this swap (ratio of token1/token0)
          let price = 0;
          if (amount0In > BigInt(0) && amount1Out > BigInt(0)) {
            price = Number(amount1Out) / Number(amount0In);
          } else if (amount1In > BigInt(0) && amount0Out > BigInt(0)) {
            price = Number(amount1In) / Number(amount0Out);
          }
          
          // Initialize or update daily data
          if (!dailyData[date]) {
            dailyData[date] = {
              volume0: BigInt(0),
              volume1: BigInt(0),
              swapCount: 0,
              averagePrice: 0
            };
          }
          
          dailyData[date].volume0 += volume0;
          dailyData[date].volume1 += volume1;
          dailyData[date].swapCount += 1;
          
          // Update average price
          if (price > 0) {
            const oldAvg = dailyData[date].averagePrice;
            const oldCount = dailyData[date].swapCount - 1;
            dailyData[date].averagePrice = (oldAvg * oldCount + price) / dailyData[date].swapCount;
          }
        } catch (error) {
          console.error('Error processing swap event:', error);
        }
      })
    );

    // Sort dates and ensure we have data for each day in the requested range
    const dates = [];
    const volumes = [];
    const prices = [];
    
    // Generate date range for the requested period
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      
      dates.push(dateStr);
      volumes.push(Number(dailyData[dateStr]?.volume0 || 0) / 1e18); // Assuming 18 decimals
      prices.push(dailyData[dateStr]?.averagePrice || 0);
    }

    // Return formatted data for chart
    const result = {
      labels: dates,
      volumeData: volumes,
      priceData: prices,
      swapCount: Object.values(dailyData).reduce((sum, day) => sum + day.swapCount, 0)
    };
    
    console.log(`Returning swap history data with ${dates.length} days`);
    return Response.json(result);
  } catch (error) {
    console.error('Failed to fetch swap history:', error);
    return Response.json({ error: 'Failed to fetch swap history', details: String(error) }, { status: 500 });
  }
} 