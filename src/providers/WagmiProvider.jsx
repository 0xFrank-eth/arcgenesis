import React from 'react';
import { WagmiProvider as WagmiProviderCore } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '../config/wagmi';

const queryClient = new QueryClient();

export function WagmiProvider({ children }) {
    return (
        <WagmiProviderCore config={config}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProviderCore>
    );
}
