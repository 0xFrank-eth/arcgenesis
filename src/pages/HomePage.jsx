import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ethers } from 'ethers';
import { CONTRACTS, ARC_TESTNET, formatUSDC } from '../config/chains';

const QUICKMINT_ABI = [
    "function totalMinted() external view returns (uint256)",
    "function mintPrice() external view returns (uint256)",
    "function getTokenMetadata(uint256 tokenId) external view returns (string name, string description, string image, address creator, uint256 mintedAt)"
];

export function HomePage() {
    const [stats, setStats] = useState({ totalMinted: 0, mintPrice: '0' });
    const [recentNFTs, setRecentNFTs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const provider = new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrl);
            const contract = new ethers.Contract(CONTRACTS.QUICKMINT, QUICKMINT_ABI, provider);

            const [minted, price] = await Promise.all([
                contract.totalMinted(),
                contract.mintPrice()
            ]);

            const totalMintedNum = Number(minted);
            setStats({
                totalMinted: totalMintedNum,
                mintPrice: formatUSDC(price)
            });

            // Load recent NFTs (last 6)
            if (totalMintedNum > 0) {
                await loadRecentNFTs(contract, totalMintedNum);
            }
        } catch (err) {
            console.error('Error loading stats:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadRecentNFTs = async (contract, totalMinted) => {
        const nfts = [];
        const startId = Math.max(1, totalMinted - 5); // Get last 6 NFTs

        for (let id = totalMinted; id >= startId; id--) {
            try {
                const [name, description, image, creator, mintedAt] = await contract.getTokenMetadata(id);
                nfts.push({
                    id,
                    name,
                    description,
                    image,
                    creator,
                    mintedAt: Number(mintedAt)
                });
            } catch (err) {
                console.error('Error loading NFT:', id, err);
            }
        }

        setRecentNFTs(nfts);
    };

    const formatAddress = (addr) => {
        if (!addr) return '';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    return (
        <div className="home-page">
            {/* Hero Section - Centered */}
            <section className="hero">
                <div className="container">
                    <div className="hero-centered">
                        <h1 className="hero-title">
                            Create Your NFT
                            <span className="hero-highlight"> Instantly</span>
                        </h1>
                        <p className="hero-subtitle">
                            Upload your artwork and mint it as an NFT on Arc Network in seconds.
                            <br />No coding required. Simple, fast, and decentralized.
                        </p>
                        <div className="hero-actions">
                            <Link to="/quick-mint" className="btn btn-primary btn-large">
                                ⚡ Start Minting
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Section - Centered Grid */}
            <section className="stats-section">
                <div className="container">
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon">🎨</div>
                            <div className="stat-value">{stats.totalMinted}</div>
                            <div className="stat-label">NFTs Minted</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">💰</div>
                            <div className="stat-value">{stats.mintPrice}</div>
                            <div className="stat-label">USDC per Mint</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">⚡</div>
                            <div className="stat-value">Arc</div>
                            <div className="stat-label">Network</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Recent Minted NFTs */}
            {recentNFTs.length > 0 && (
                <section className="gallery-section">
                    <div className="container">
                        <h2 className="section-title">🖼️ Recent Mints</h2>
                        <div className="nft-gallery">
                            {recentNFTs.map((nft) => (
                                <div key={nft.id} className="nft-card">
                                    <div className="nft-image">
                                        <img src={nft.image} alt={nft.name} />
                                    </div>
                                    <div className="nft-info">
                                        <h3 className="nft-name">{nft.name}</h3>
                                        <div className="nft-meta">
                                            <span className="nft-creator" title={nft.creator}>
                                                👤 {formatAddress(nft.creator)}
                                            </span>
                                            <span className="nft-time">
                                                🕐 {formatTime(nft.mintedAt)}
                                            </span>
                                        </div>
                                        <div className="nft-id">#{nft.id}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {stats.totalMinted > 6 && (
                            <div className="gallery-footer">
                                <Link to="/gallery" className="btn btn-secondary">
                                    View All {stats.totalMinted} NFTs →
                                </Link>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* How It Works - Centered */}
            <section className="how-section">
                <div className="container">
                    <h2 className="section-title">How It Works</h2>
                    <div className="steps-grid">
                        <div className="step-card">
                            <div className="step-number">1</div>
                            <div className="step-icon">📤</div>
                            <h3>Upload Image</h3>
                            <p>Drag and drop your artwork</p>
                        </div>
                        <div className="step-card">
                            <div className="step-number">2</div>
                            <div className="step-icon">✏️</div>
                            <h3>Add Details</h3>
                            <p>Name and describe your NFT</p>
                        </div>
                        <div className="step-card">
                            <div className="step-number">3</div>
                            <div className="step-icon">🚀</div>
                            <h3>Mint & Own</h3>
                            <p>Pay and receive your NFT</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section - Centered */}
            <section className="cta-section">
                <div className="container">
                    <div className="cta-content">
                        <h2>Ready to Create?</h2>
                        <p>Your artwork deserves to be on the blockchain</p>
                        <Link to="/quick-mint" className="btn btn-primary btn-large">
                            ⚡ Mint Your NFT Now
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
