import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';

// Arc Testnet chain definition
export const arcTestnet = {
    id: 5042002,
    name: 'Arc Testnet',
    nativeCurrency: {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 18
    },
    rpcUrls: {
        default: {
            http: ['https://rpc.testnet.arc.network']
        }
    },
    blockExplorers: {
        default: {
            name: 'Arc Explorer',
            url: 'https://testnet.arcscan.app'
        }
    },
    testnet: true
};

// Wagmi config with fallback transports
export const config = createConfig({
    chains: [arcTestnet],
    connectors: [
        injected({ shimDisconnect: true })
    ],
    transports: {
        [arcTestnet.id]: http('https://rpc.testnet.arc.network')
    }
});
