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
            http: ['https://arc-testnet.drpc.org']
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

// Wagmi config
export const config = createConfig({
    chains: [arcTestnet],
    connectors: [
        injected({ shimDisconnect: true })
    ],
    transports: {
        [arcTestnet.id]: http()
    }
});
