import React from 'react';

// Generate placeholder NFT image with token ID
const generateNFTImage = (tokenId) => {
    const colors = [
        ['#6366f1', '#a855f7'],
        ['#10b981', '#059669'],
        ['#f59e0b', '#d97706'],
        ['#ef4444', '#dc2626'],
        ['#8b5cf6', '#7c3aed']
    ];
    const [color1, color2] = colors[tokenId % colors.length];

    return 'data:image/svg+xml,' + encodeURIComponent(`
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad${tokenId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
    </linearGradient>
    <linearGradient id="bg${tokenId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e293b;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#bg${tokenId})"/>
  <circle cx="100" cy="75" r="40" fill="url(#grad${tokenId})"/>
  <circle cx="85" cy="68" r="10" fill="#fff"/>
  <circle cx="115" cy="68" r="10" fill="#fff"/>
  <circle cx="87" cy="68" r="5" fill="#1e293b"/>
  <circle cx="117" cy="68" r="5" fill="#1e293b"/>
  <ellipse cx="100" cy="130" rx="30" ry="22" fill="url(#grad${tokenId})"/>
  <rect x="73" y="110" width="12" height="25" rx="4" fill="url(#grad${tokenId})"/>
  <rect x="115" y="110" width="12" height="25" rx="4" fill="url(#grad${tokenId})"/>
  <text x="100" y="185" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="12">#${tokenId}</text>
</svg>
  `);
};

export function MyNFTs({ account, nfts, isLoading, formatAddress }) {
    if (!account) {
        return null;
    }

    return (
        <div className="card nft-gallery fade-in">
            <h3 className="nft-gallery-title">
                Your Minted NFT
                <span className="wallet-address">Connected Wallet: {formatAddress}</span>
            </h3>

            {isLoading ? (
                <div className="empty-state">
                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                    <p style={{ marginTop: '1rem' }}>Loading your NFTs...</p>
                </div>
            ) : nfts.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🎨</div>
                    <p>You haven't minted any NFTs yet.</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                        Mint your first NFT above!
                    </p>
                </div>
            ) : (
                <div className="nft-grid">
                    {nfts.map((nft) => (
                        <div key={nft.tokenId} className="nft-card">
                            <img
                                src={generateNFTImage(nft.tokenId)}
                                alt={`Cosmic Creature #${nft.tokenId}`}
                                className="nft-image"
                            />
                            <div className="nft-info">
                                <p className="nft-name">Cosmic Creature #{nft.tokenId} - Minted!</p>
                                <p className="nft-id">Token ID: {nft.tokenId}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
