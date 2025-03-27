import { wagmiConnectors } from "./wagmiConnectors";
import { Chain, createClient, fallback, http } from "viem";
import { hardhat } from "viem/chains";
import { createConfig } from "wagmi";
import scaffoldConfig, { DEFAULT_ALCHEMY_API_KEY, ScaffoldConfig } from "~~/scaffold.config";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";

const { targetNetworks } = scaffoldConfig;

// 只使用配置中指定的网络，不自动添加主网
export const enabledChains = targetNetworks;

// Print current environment variables
console.log(`Alchemy API Key: ${scaffoldConfig.alchemyApiKey.substring(0, 4)}...`);
console.log(`Target Networks: ${JSON.stringify(targetNetworks.map(n => n.name))}`);
console.log(`RPC Overrides: ${JSON.stringify(scaffoldConfig.rpcOverrides)}`);

export const wagmiConfig = createConfig({
  chains: enabledChains,
  connectors: wagmiConnectors,
  ssr: true,
  client({ chain }) {
    let rpcFallbacks = [http()];

    const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as ScaffoldConfig["rpcOverrides"])?.[chain.id];
    if (rpcOverrideUrl) {
      console.log(`Using RPC override URL: ${rpcOverrideUrl} as primary RPC for chainId=${chain.id}`);
      rpcFallbacks = [http(rpcOverrideUrl)];
    } else {
      const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
      if (alchemyHttpUrl) {
        const isUsingDefaultKey = scaffoldConfig.alchemyApiKey === DEFAULT_ALCHEMY_API_KEY;
        console.log(`Using Alchemy URL: ${alchemyHttpUrl} as RPC for chainId=${chain.id}${isUsingDefaultKey ? " (using default API key)" : ""}`);
        // If using default Scaffold-ETH 2 API key, we prioritize the default RPC
        rpcFallbacks = [http(alchemyHttpUrl)];
      } else {
        console.log(`No Alchemy URL found for chainId=${chain.id}, using default RPC`);
      }
    }

    return createClient({
      chain,
      transport: fallback(rpcFallbacks),
      ...(chain.id !== (hardhat as Chain).id
        ? {
            pollingInterval: scaffoldConfig.pollingInterval,
          }
        : {}),
    });
  },
});
