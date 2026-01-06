import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MintProgress } from '../components/MintProgress';

export function MyCollections({
    account,
    userCollections,
    isLoading,
    fetchUserCollections,
    onConnect,
    formatAddress
}) {
    useEffect(() => {
        if (account) {
            fetchUserCollections(account);
        }
    }, [account, fetchUserCollections]);

    if (!account) {
        return (
            <div className="my-collections-page">
                <div className="container">
                    <div className="connect-prompt">
                        <div className="prompt-icon">🔗</div>
                        <h2>Connect Your Wallet</h2>
                        <p>Please connect your wallet to view your collections</p>
                        <button className="btn btn-primary btn-lg" onClick={onConnect}>
                            Connect Wallet
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="my-collections-page">
            <div className="container">
                <div className="page-header">
                    <h1 className="page-title">
                        <span className="title-icon">📁</span>
                        My Collections
                    </h1>
                    <p className="page-subtitle">
                        Manage your NFT collections on ArcGenesis
                    </p>
                    <Link to="/create" className="btn btn-primary">
                        + Create New Collection
                    </Link>
                </div>

                {isLoading ? (
                    <div className="loading-state">
                        <div className="spinner large"></div>
                        <p>Loading your collections...</p>
                    </div>
                ) : userCollections.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🎨</div>
                        <h3>No Collections Yet</h3>
                        <p>You haven't created any collections yet. Start your NFT journey today!</p>
                        <Link to="/create" className="btn btn-primary btn-lg">
                            Create Your First Collection
                        </Link>
                    </div>
                ) : (
                    <div className="my-collections-grid">
                        {userCollections.map((collection) => (
                            <div key={collection.id} className="my-collection-card">
                                <div className="my-collection-header">
                                    <div className="my-collection-image">
                                        {collection.imageUrl ? (
                                            <img
                                                src={collection.imageUrl}
                                                alt={collection.name}
                                                className="my-collection-cover"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div
                                            className="my-collection-icon"
                                            style={{ display: collection.imageUrl ? 'none' : 'flex' }}
                                        >
                                            {collection.symbol?.slice(0, 2) || '🎨'}
                                        </div>
                                    </div>
                                    <div className="my-collection-info">
                                        <h3 className="my-collection-name">{collection.name}</h3>
                                        <span className="my-collection-symbol">${collection.symbol}</span>
                                    </div>
                                </div>

                                <div className="my-collection-stats">
                                    <div className="my-stat">
                                        <span className="my-stat-value">{collection.mintPrice} USDC</span>
                                        <span className="my-stat-label">Price</span>
                                    </div>
                                    <div className="my-stat">
                                        <span className="my-stat-value">
                                            {collection.totalMinted} / {collection.maxSupply}
                                        </span>
                                        <span className="my-stat-label">Minted</span>
                                    </div>
                                    <div className="my-stat">
                                        <span className="my-stat-value highlight">
                                            {(collection.totalMinted * parseFloat(collection.mintPrice)).toFixed(2)} USDC
                                        </span>
                                        <span className="my-stat-label">Revenue</span>
                                    </div>
                                </div>

                                <MintProgress
                                    minted={collection.totalMinted}
                                    total={collection.maxSupply}
                                    showLabel={false}
                                />

                                <div className="my-collection-actions">
                                    <Link
                                        to={`/collection/${collection.id}`}
                                        className="btn btn-secondary"
                                    >
                                        View Collection
                                    </Link>
                                    <a
                                        href={`https://testnet.arcscan.app/address/${collection.contractAddress}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-outline"
                                    >
                                        View on Explorer
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
