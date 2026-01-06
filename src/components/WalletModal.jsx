import React, { useState } from 'react';

const WALLETS = [
    {
        id: 'metamask',
        name: 'MetaMask',
        icon: '🦊',
        description: 'Popular browser extension',
        checkInstalled: () => window.ethereum?.isMetaMask
    },
    {
        id: 'rabby',
        name: 'Rabby Wallet',
        icon: '🐰',
        description: 'Security-focused wallet',
        checkInstalled: () => window.ethereum?.isRabby
    },
    {
        id: 'coinbase',
        name: 'Coinbase Wallet',
        icon: '🔵',
        description: 'Easy to use wallet',
        checkInstalled: () => window.ethereum?.isCoinbaseWallet
    },
    {
        id: 'injected',
        name: 'Browser Wallet',
        icon: '🌐',
        description: 'Any installed wallet',
        checkInstalled: () => !!window.ethereum
    }
];

export function WalletModal({ isOpen, onClose, onConnect }) {
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleWalletClick = async (wallet) => {
        setError('');
        setIsConnecting(true);

        try {
            if (!window.ethereum) {
                // No wallet installed - open download page based on selection
                const downloadUrls = {
                    metamask: 'https://metamask.io/download/',
                    rabby: 'https://rabby.io/',
                    coinbase: 'https://www.coinbase.com/wallet',
                    injected: 'https://ethereum.org/wallets/'
                };
                window.open(downloadUrls[wallet.id] || downloadUrls.injected, '_blank');
                setIsConnecting(false);
                return;
            }

            // Request account access - this triggers MetaMask popup
            console.log('Requesting accounts...');
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            console.log('Accounts received:', accounts);

            if (accounts && accounts.length > 0) {
                // Success! Close modal - useWallet will detect the change
                onConnect();
            } else {
                setError('No accounts found');
            }
        } catch (err) {
            console.error('Wallet connection error:', err);
            if (err.code === 4001) {
                setError('Connection rejected by user');
            } else {
                setError(err.message || 'Failed to connect wallet');
            }
        } finally {
            setIsConnecting(false);
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="wallet-modal-backdrop" onClick={handleBackdropClick}>
            <div className="wallet-modal">
                <div className="wallet-modal-header">
                    <h2>Connect Wallet</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="wallet-modal-body">
                    <p className="wallet-modal-hint">
                        Choose your preferred wallet to connect
                    </p>

                    {error && (
                        <div className="wallet-error">{error}</div>
                    )}

                    <div className="wallet-list">
                        {WALLETS.map((wallet) => {
                            const isInstalled = wallet.checkInstalled();
                            return (
                                <button
                                    key={wallet.id}
                                    className={`wallet-option ${isInstalled ? 'installed' : ''}`}
                                    onClick={() => handleWalletClick(wallet)}
                                    disabled={isConnecting}
                                >
                                    <span className="wallet-option-icon">{wallet.icon}</span>
                                    <div className="wallet-option-info">
                                        <span className="wallet-option-name">{wallet.name}</span>
                                        <span className="wallet-option-desc">{wallet.description}</span>
                                    </div>
                                    {isInstalled && (
                                        <span className="wallet-status">Detected</span>
                                    )}
                                    {isConnecting && (
                                        <span className="wallet-connecting">...</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="wallet-modal-footer">
                    <p>New to Web3? <a href="https://ethereum.org/wallets/" target="_blank" rel="noopener noreferrer">Learn about wallets</a></p>
                </div>
            </div>
        </div>
    );
}
