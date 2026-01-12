import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { CONTRACTS, ARC_TESTNET } from '../config/chains';

const QUICKMINT_ABI = [
    "function totalMinted() external view returns (uint256)",
    "function getTokenMetadata(uint256 tokenId) external view returns (string name, string description, string image, address creator, uint256 mintedAt)"
];

// Alternative IPFS gateways for fallback
const IPFS_GATEWAYS = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/'
];

// Convert IPFS URL to use a specific gateway
const getIPFSUrl = (url, gatewayIndex = 0) => {
    if (!url) return '';
    if (url.startsWith('data:')) return url; // base64 images

    // Extract IPFS hash from various URL formats
    let hash = '';
    if (url.includes('/ipfs/')) {
        hash = url.split('/ipfs/')[1];
    } else if (url.startsWith('ipfs://')) {
        hash = url.replace('ipfs://', '');
    } else {
        return url; // Not an IPFS URL
    }

    const gateway = IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length];
    return gateway + hash;
};

// Pagination settings
const ITEMS_PER_PAGE = 12;

// NFT Image component with fallback gateway support
function NFTImage({ src, alt }) {
    const [gatewayIndex, setGatewayIndex] = useState(0);
    const [hasError, setHasError] = useState(false);

    const handleError = () => {
        if (gatewayIndex < IPFS_GATEWAYS.length - 1) {
            // Try next gateway
            setGatewayIndex(prev => prev + 1);
        } else {
            setHasError(true);
        }
    };

    const imageUrl = getIPFSUrl(src, gatewayIndex);

    if (hasError) {
        return <div className="image-error">🖼️ Image unavailable</div>;
    }

    return <img src={imageUrl} alt={alt} onError={handleError} />;
}

export function Gallery() {
    const [nfts, setNfts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [totalMinted, setTotalMinted] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const loadedRef = useRef(false);
    const contractRef = useRef(null);

    useEffect(() => {
        if (loadedRef.current) return;
        loadedRef.current = true;
        initGallery();
    }, []);

    const initGallery = async () => {
        try {
            const provider = new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrl);
            const contract = new ethers.Contract(CONTRACTS.QUICKMINT, QUICKMINT_ABI, provider);
            contractRef.current = contract;

            const total = await contract.totalMinted();
            const totalNum = Number(total);
            setTotalMinted(totalNum);

            if (totalNum === 0) {
                setIsLoading(false);
                return;
            }

            // Load first page only
            await loadNFTsPage(contract, totalNum, 1);
        } catch (err) {
            console.error('Error initializing gallery:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadNFTsPage = async (contract, total, page) => {
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, total);

        // NFT IDs go from newest to oldest (total down to 1)
        const startId = total - startIndex;
        const endId = total - endIndex + 1;

        const loadedNfts = [];
        for (let id = startId; id >= endId; id--) {
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

        if (page === 1) {
            setNfts(loadedNfts);
        } else {
            setNfts(prev => [...prev, ...loadedNfts]);
        }
    };

    const handleLoadMore = async () => {
        if (!contractRef.current || isLoadingMore) return;

        setIsLoadingMore(true);
        try {
            const nextPage = currentPage + 1;
            await loadNFTsPage(contractRef.current, totalMinted, nextPage);
            setCurrentPage(nextPage);
        } catch (err) {
            console.error('Error loading more NFTs:', err);
        } finally {
            setIsLoadingMore(false);
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

    // Calculate if there are more NFTs to load
    const hasMore = nfts.length < totalMinted;
    const remaining = totalMinted - nfts.length;

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
                    <>
                        <div className="nft-gallery">
                            {nfts.map((nft) => (
                                <div key={nft.id} className="nft-card">
                                    <div className="nft-image">
                                        <NFTImage src={nft.image} alt={nft.name} />
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

                        {/* Load More Button */}
                        {hasMore && (
                            <div className="load-more-container">
                                <button
                                    className="btn-load-more"
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore}
                                >
                                    {isLoadingMore ? (
                                        <>Loading...</>
                                    ) : (
                                        <>Load More ({remaining} remaining)</>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Show loaded count */}
                        <div className="gallery-footer">
                            <p>Showing {nfts.length} of {totalMinted} NFTs</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
