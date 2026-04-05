import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';

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

// RainbowKit + Wagmi config
export const config = getDefaultConfig({
    appName: 'ArcGenesis',
    projectId: 'b3d41de2e2eaa8b1eeb4e3b4e7d1e5c5', // WalletConnect project ID
    chains: [arcTestnet],
    transports: {
        [arcTestnet.id]: http('https://rpc.testnet.arc.network')
    }
});
