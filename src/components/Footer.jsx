import React from 'react';
import { Link } from 'react-router-dom';

export function Footer() {
    return (
        <footer className="footer">
            <div className="container">
                <div className="footer-content">
                    <div className="footer-brand">
                        <Link to="/" className="footer-logo">
                            <img src="/logo.png" alt="ArcGenesis" className="footer-logo-img" />
                            <span>ArcGenesis</span>
                        </Link>
                        <p className="footer-tagline">Create Your NFT Instantly</p>
                    </div>

                    <div className="footer-links">
                        <div className="footer-section">
                            <h4>Platform</h4>
                            <Link to="/">Home</Link>
                            <Link to="/gallery">Gallery</Link>
                            <Link to="/quick-mint">Quick Mint</Link>
                        </div>
                        <div className="footer-section">
                            <h4>Resources</h4>
                            <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">
                                Get Testnet USDC
                            </a>
                            <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer">
                                Block Explorer
                            </a>
                            <a href="https://arc.network" target="_blank" rel="noopener noreferrer">
                                Arc Network
                            </a>
                        </div>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p className="footer-disclaimer">
                        ⚠️ Testnet Only - No Real Value | Built on Arc Network
                    </p>
                    <p className="footer-copyright">
                        © 2026 ArcGenesis. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
