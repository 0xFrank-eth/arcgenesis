import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { CONTRACTS, ARC_TESTNET } from '../config/chains';

const QUICKMINT_ABI = [
    "function totalMinted() external view returns (uint256)",
    "function getTokenMetadata(uint256 tokenId) external view returns (string name, string description, string image, address creator, uint256 mintedAt)"
];

export function Gallery() {
    const [nfts, setNfts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalMinted, setTotalMinted] = useState(0);
    const loadedRef = useRef(false);

    useEffect(() => {
        if (loadedRef.current) return;
        loadedRef.current = true;
        loadAllNFTs();
    }, []);

    const loadAllNFTs = async () => {
        try {
            const provider = new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrl);
            const contract = new ethers.Contract(CONTRACTS.QUICKMINT, QUICKMINT_ABI, provider);

            const total = await contract.totalMinted();
            const totalNum = Number(total);
            setTotalMinted(totalNum);

            if (totalNum === 0) {
                setIsLoading(false);
                return;
            }

            // Simple reliable loading
            const loadedNfts = [];
            for (let id = totalNum; id >= 1; id--) {
                try {
                    const [name, description, image, creator, mintedAt] = await contract.getTokenMetadata(id);
                    loadedNfts.push({
                        id,
                        name,
                        description,
                        image,
                        creator,
                        mintedAt: Number(mintedAt)
                    });
                } catch (err) {
                    console.error('Error loading NFT:', id);
                }
            }

            setNfts(loadedNfts);
        } catch (err) {
            console.error('Error loading NFTs:', err);
        } finally {
            setIsLoading(false);
        }
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
        <div className="gallery-page">
            <div className="container">
                <div className="gallery-header">
                    <h1>🖼️ NFT Gallery</h1>
                    <p>All minted NFTs on ArcGenesis ({totalMinted} total)</p>
                </div>

                {isLoading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading NFTs...</p>
                    </div>
                ) : nfts.length === 0 ? (
                    <div className="empty-state">
                        <p>No NFTs minted yet. Be the first!</p>
                    </div>
                ) : (
                    <div className="nft-gallery">
                        {nfts.map((nft) => (
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
                )}
            </div>
        </div>
    );
}
