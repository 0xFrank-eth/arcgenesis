import React from 'react';
import { Link } from 'react-router-dom';

export function CollectionGrid({ collections, isLoading, formatAddress }) {
    if (isLoading) {
        return (
            <div className="collection-grid">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="collection-card skeleton">
                        <div className="skeleton-image"></div>
                        <div className="skeleton-text"></div>
                        <div className="skeleton-text short"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (!collections || collections.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-icon">🎨</div>
                <h3>No Collections Yet</h3>
                <p>Be the first to launch your NFT collection on ArcGenesis!</p>
                <Link to="/create" className="btn btn-primary">
                    Create Collection
                </Link>
            </div>
        );
    }

    return (
        <div className="collection-grid">
            {collections.map((collection, index) => (
                <Link
                    key={collection.contractAddress || index}
                    to={`/collection/address/${collection.contractAddress}`}
                    className="collection-card"
                >
                    <div className="collection-card-image">
                        {collection.imageUrl ? (
                            <img
                                src={collection.imageUrl}
                                alt={collection.name}
                                className="collection-card-img"
                                onError={(e) => {
                                    // On error, replace with placeholder
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                }}
                            />
                        ) : null}
                        <div
                            className="collection-card-placeholder"
                            style={{ display: collection.imageUrl ? 'none' : 'flex' }}
                        >
                            {collection.symbol?.slice(0, 2) || '🎨'}
                        </div>
                        <div className="collection-card-badge">
                            {collection.symbol}
                        </div>
                    </div>
                    <div className="collection-card-content">
                        <h3 className="collection-card-name">{collection.name}</h3>
                        <div className="collection-card-creator">
                            <span className="creator-label">by</span>
                            <span className="creator-address">
                                {formatAddress ? formatAddress(collection.creator) :
                                    `${collection.creator?.slice(0, 6)}...${collection.creator?.slice(-4)}`}
                            </span>
                        </div>
                        <div className="collection-card-stats">
                            <div className="collection-stat">
                                <span className="stat-value">{collection.mintPrice} USDC</span>
                                <span className="stat-label">Price</span>
                            </div>
                            <div className="collection-stat">
                                <span className="stat-value">
                                    {collection.totalMinted} / {collection.maxSupply}
                                </span>
                                <span className="stat-label">Minted</span>
                            </div>
                        </div>
                        <div className="collection-progress">
                            <div
                                className="collection-progress-bar"
                                style={{
                                    width: `${(collection.totalMinted / collection.maxSupply) * 100}%`
                                }}
                            ></div>
                        </div>
                        <button className="btn btn-mint">Mint Now</button>
                    </div>
                </Link>
            ))}
        </div>
    );
}
