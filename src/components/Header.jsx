import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

export function Header() {
    const location = useLocation();
    const { address, isConnected } = useAccount();
    const { connectors, connectAsync, status } = useConnect();
    const { disconnect } = useDisconnect();
    const [showModal, setShowModal] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    const isActive = (path) => location.pathname === path;
    const formatAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

    // EXACTLY like mintonarc.xyz - pass the connector directly
    const handleConnect = async (connector) => {
        try {
            await connectAsync({
                connector: connector,
                chainId: 5042002  // Arc Testnet
            });
            setShowModal(false);
        } catch (err) {
            console.error("Bağlantı hatası:", err.message);
        }
    };

    return (
        <>
            <header className="header">
                <div className="container header-content">
                    <Link to="/" className="logo">
                        <img src="/logo.png" alt="ArcGenesis" className="logo-img" />
                        <span className="logo-text">ArcGenesis</span>
                    </Link>

                    <nav className="nav">
                        <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
                            Home
                        </Link>
                        <Link to="/gallery" className={`nav-link ${isActive('/gallery') ? 'active' : ''}`}>
                            🖼️ Gallery
                        </Link>
                        <Link to="/quick-mint" className={`nav-link ${isActive('/quick-mint') ? 'active' : ''}`}>
                            ⚡ Mint NFT
                        </Link>
                    </nav>

                    <div className="header-actions">
                        {isConnected ? (
                            <div className="wallet-dropdown-container">
                                <button
                                    className="btn btn-wallet"
                                    onClick={() => setShowDropdown(!showDropdown)}
                                >
                                    👛 {formatAddress(address)} ▼
                                </button>
                                {showDropdown && (
                                    <>
                                        <div className="wallet-dropdown-menu">
                                            <button
                                                className="dropdown-option"
                                                onClick={() => { setShowDropdown(false); setShowModal(true); }}
                                            >
                                                🔄 Switch Wallet
                                            </button>
                                            <button
                                                className="dropdown-option danger"
                                                onClick={() => { disconnect(); setShowDropdown(false); }}
                                            >
                                                🚪 Disconnect
                                            </button>
                                        </div>
                                        <div className="dropdown-backdrop" onClick={() => setShowDropdown(false)} />
                                    </>
                                )}
                            </div>
                        ) : (
                            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                                {status === 'pending' ? 'Connecting...' : 'Connect Wallet'}
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Wallet Selection Modal - EXACTLY like mintonarc.xyz */}
            {showModal && (
                <div className="wallet-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="wallet-modal" onClick={e => e.stopPropagation()}>
                        <div className="wallet-modal-header">
                            <h2>Connect Wallet</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <div className="wallet-options">
                            {connectors.filter(c => c.name !== 'Injected').length > 0 ? (
                                // Map over connectors - EIP-6963 provides each wallet separately
                                // Filter out the generic "Injected" connector
                                connectors.filter(c => c.name !== 'Injected').map((connector) => (
                                    <button
                                        key={connector.uid || connector.id}
                                        className="wallet-option"
                                        onClick={() => handleConnect(connector)}
                                        disabled={status === 'pending'}
                                    >
                                        <span className="wallet-icon">
                                            {connector.icon ? (
                                                <img src={connector.icon} alt="" style={{ width: 28, height: 28, borderRadius: 6 }} />
                                            ) : '🔗'}
                                        </span>
                                        <span className="wallet-name">{connector.name}</span>
                                    </button>
                                ))
                            ) : (
                                <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                                    No wallet detected. Please install MetaMask or another wallet.
                                </p>
                            )}
                        </div>
                        <p className="wallet-modal-note">
                            Select your wallet to connect
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
