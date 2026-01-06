import React from 'react';
import { Link } from 'react-router-dom';

export function HeroSection() {
    return (
        <section className="hero">
            <div className="hero-content">
                <div className="hero-text">
                    <div className="hero-logo">
                        <img src="/logo.png" alt="ArcGenesis" className="hero-logo-img" />
                        <span className="hero-brand">ArcGenesis</span>
                    </div>
                    <h1 className="hero-title">
                        The Origin of<br />
                        <span className="hero-title-gradient">NFT Launches.</span>
                    </h1>
                    <p className="hero-description">
                        Create and launch your own NFT collection on Arc Network.
                        No coding required. Start minting in minutes.
                    </p>
                    <div className="hero-buttons">
                        <Link to="/create" className="btn btn-primary btn-lg">
                            <span className="btn-icon">🚀</span>
                            Launch Collection
                        </Link>
                        <a href="#collections" className="btn btn-secondary btn-lg">
                            Explore Collections
                        </a>
                    </div>
                    <div className="hero-stats">
                        <div className="hero-stat">
                            <span className="hero-stat-value">500+</span>
                            <span className="hero-stat-label">Collections</span>
                        </div>
                        <div className="hero-stat">
                            <span className="hero-stat-value">10K+</span>
                            <span className="hero-stat-label">NFTs Minted</span>
                        </div>
                        <div className="hero-stat">
                            <span className="hero-stat-value">2K+</span>
                            <span className="hero-stat-label">Creators</span>
                        </div>
                    </div>
                </div>
                <div className="hero-visual">
                    <div className="hero-cards">
                        <div className="hero-card hero-card-1">
                            <div className="hero-card-image">🎨</div>
                            <div className="hero-card-info">
                                <span className="hero-card-name">Cosmic Creators</span>
                                <div className="hero-card-meta">
                                    <span className="hero-card-price">0.05 USDC</span>
                                    <span className="hero-card-supply">600 / 1000</span>
                                </div>
                            </div>
                        </div>
                        <div className="hero-card hero-card-2">
                            <div className="hero-card-image">🌌</div>
                            <div className="hero-card-info">
                                <span className="hero-card-name">Stellar Dreams</span>
                                <div className="hero-card-meta">
                                    <span className="hero-card-price">0.08 USDC</span>
                                    <span className="hero-card-supply">250 / 500</span>
                                </div>
                            </div>
                        </div>
                        <div className="hero-card hero-card-3">
                            <div className="hero-card-image">✨</div>
                            <div className="hero-card-info">
                                <span className="hero-card-name">Neon Pulse</span>
                                <div className="hero-card-meta">
                                    <span className="hero-card-price">0.03 USDC</span>
                                    <span className="hero-card-supply">1200 / 2000</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="hero-glow"></div>
        </section>
    );
}
