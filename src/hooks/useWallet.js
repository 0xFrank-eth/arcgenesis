import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ARC_TESTNET } from '../config/chains';

export function useWallet() {
    const [account, setAccount] = useState(null);
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState(null);

    // Check if MetaMask is installed
    const isMetaMaskInstalled = typeof window !== 'undefined' && window.ethereum;

    // Initialize provider on mount
    useEffect(() => {
        if (isMetaMaskInstalled) {
            const web3Provider = new ethers.BrowserProvider(window.ethereum);
            setProvider(web3Provider);

            // Check if already connected
            window.ethereum.request({ method: 'eth_accounts' })
                .then(async (accounts) => {
                    if (accounts.length > 0) {
                        setAccount(accounts[0]);
                        try {
                            const signerInstance = await web3Provider.getSigner();
                            setSigner(signerInstance);
                        } catch (err) {
                            console.error('Error getting signer:', err);
                        }
                    }
                })
                .catch(console.error);

            // Get current chain
            window.ethereum.request({ method: 'eth_chainId' })
                .then(chainIdHex => setChainId(parseInt(chainIdHex, 16)))
                .catch(console.error);
        }
    }, [isMetaMaskInstalled]);

    // Listen for account and chain changes
    useEffect(() => {
        if (!isMetaMaskInstalled) return;

        const handleAccountsChanged = async (accounts) => {
            if (accounts.length === 0) {
                setAccount(null);
                setSigner(null);
            } else {
                setAccount(accounts[0]);
                if (provider) {
                    const newSigner = await provider.getSigner();
                    setSigner(newSigner);
                }
            }
        };

        const handleChainChanged = (chainIdHex) => {
            setChainId(parseInt(chainIdHex, 16));
            window.location.reload();
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum.removeListener('chainChanged', handleChainChanged);
        };
    }, [isMetaMaskInstalled, provider]);

    // Connect wallet
    const connect = useCallback(async () => {
        if (!isMetaMaskInstalled) {
            setError('Please install MetaMask to continue');
            window.open('https://metamask.io/download/', '_blank');
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length > 0) {
                setAccount(accounts[0]);

                // Get signer
                const web3Provider = new ethers.BrowserProvider(window.ethereum);
                setProvider(web3Provider);
                const signerInstance = await web3Provider.getSigner();
                setSigner(signerInstance);

                // Switch to Arc Testnet
                await switchToArcTestnet();
            }
        } catch (err) {
            console.error('Connection error:', err);
            setError(err.message || 'Failed to connect wallet');
        } finally {
            setIsConnecting(false);
        }
    }, [isMetaMaskInstalled]);

    // Disconnect wallet
    const disconnect = useCallback(() => {
        setAccount(null);
        setSigner(null);
    }, []);

    // Switch to Arc Testnet
    const switchToArcTestnet = useCallback(async () => {
        if (!isMetaMaskInstalled) return;

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: ARC_TESTNET.chainIdHex }]
            });
        } catch (switchError) {
            // Chain not added, add it
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: ARC_TESTNET.chainIdHex,
                            chainName: ARC_TESTNET.name,
                            nativeCurrency: ARC_TESTNET.currency,
                            rpcUrls: [ARC_TESTNET.rpcUrl],
                            blockExplorerUrls: [ARC_TESTNET.blockExplorer]
                        }]
                    });
                } catch (addError) {
                    console.error('Failed to add Arc Testnet:', addError);
                    setError('Failed to add Arc Testnet to MetaMask');
                }
            } else {
                console.error('Failed to switch network:', switchError);
            }
        }
    }, [isMetaMaskInstalled]);

    // Check if on Arc Testnet
    const isOnArcTestnet = chainId === ARC_TESTNET.chainId;

    // Format address for display
    const formatAddress = (addr) => {
        if (!addr) return '';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return {
        account,
        provider,
        signer,
        chainId,
        isConnecting,
        error,
        isMetaMaskInstalled,
        isOnArcTestnet,
        connect,
        disconnect,
        switchToArcTestnet,
        formatAddress
    };
}
