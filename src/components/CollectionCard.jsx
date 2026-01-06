import React from 'react';

// Placeholder image for demo (will be replaced with actual collection image)
const PLACEHOLDER_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(`
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="200" height="200" fill="#1e293b"/>
  <circle cx="100" cy="85" r="45" fill="url(#grad)"/>
  <circle cx="85" cy="75" r="12" fill="#fff"/>
  <circle cx="115" cy="75" r="12" fill="#fff"/>
  <circle cx="85" cy="75" r="6" fill="#1e293b"/>
  <circle cx="115" cy="75" r="6" fill="#1e293b"/>
  <circle cx="100" cy="95" r="8" fill="#a855f7"/>
  <ellipse cx="100" cy="145" rx="35" ry="25" fill="url(#grad)"/>
  <rect x="70" y="120" width="15" height="30" rx="5" fill="url(#grad)"/>
  <rect x="115" y="120" width="15" height="30" rx="5" fill="url(#grad)"/>
</svg>
`);

export function CollectionCard({ collection, isLoading }) {
    if (isLoading) {
        return (
            <div className="card collection-card">
                <div className="collection-image" style={{ background: 'var(--color-bg-secondary)' }}></div>
                <div className="collection-info">
                    <div style={{ height: '1.5rem', width: '200px', background: 'var(--color-bg-secondary)', borderRadius: '8px', marginBottom: '0.5rem' }}></div>
                    <div style={{ height: '1rem', width: '300px', background: 'var(--color-bg-secondary)', borderRadius: '8px' }}></div>
                </div>
            </div>
        );
    }

    // Use actual collection data with fallbacks
    // Spread collection first, then override with display-friendly values
    const displayCollection = {
        ...collection,
        name: collection?.name || 'Unnamed Collection',
        description: collection?.description || `Explore ${collection?.name || 'this collection'} on ArcGenesis!`,
        image: collection?.imageUrl || PLACEHOLDER_IMAGE,
        maxSupply: collection?.maxSupply || 0,
        mintPrice: collection?.publicMintPrice || collection?.mintPrice || '0',
        totalMinted: collection?.totalMinted || 0,
        remainingSupply: collection?.remainingSupply || collection?.maxSupply || 0
    };

    return (
        <div className="card collection-card fade-in">
            <img
                src={displayCollection.image}
                alt={displayCollection.name}
                className="collection-image"
                onError={(e) => {
                    e.target.src = PLACEHOLDER_IMAGE;
                }}
            />
            <div className="collection-info">
                <h2 className="collection-name">{displayCollection.name}</h2>
                <p className="collection-description">{displayCollection.description}</p>
                <div className="collection-stats">
                    <div className="stat">
                        <span className="stat-label">Total Supply</span>
                        <span className="stat-value">{displayCollection.maxSupply} NFTs</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Mint Price</span>
                        <span className="stat-value">{displayCollection.mintPrice} USDC</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Minted</span>
                        <span className="stat-value">{displayCollection.totalMinted} / {displayCollection.maxSupply}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
