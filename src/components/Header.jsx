import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Header() {
    const location = useLocation();
    const isActive = (path) => location.pathname === path;

    return (
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
                    <ConnectButton
                        chainStatus="icon"
                        showBalance={{
                            smallScreen: false,
                            largeScreen: true
                        }}
                        accountStatus={{
                            smallScreen: 'avatar',
                            largeScreen: 'full'
                        }}
                    />
                </div>
            </div>
        </header>
    );
}
