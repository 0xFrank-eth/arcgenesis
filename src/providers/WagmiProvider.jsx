import React from 'react';
import { WagmiProvider as WagmiProviderCore } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '../config/wagmi';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

export function WagmiProvider({ children }) {
    return (
        <WagmiProviderCore config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: '#00d4ff',
                        accentColorForeground: '#000',
                        borderRadius: 'medium',
                        fontStack: 'system',
                        overlayBlur: 'small'
                    })}
                    modalSize="wide"
                    locale="en-US"
                >
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProviderCore>
    );
}
