import React from 'react';

export function MintSection({
    account,
    isOnArcTestnet,
    isMinting,
    isApproving,
    error,
    txHash,
    onConnect,
    onMint,
    onSwitchNetwork,
    collectionInfo
}) {
    const renderButton = () => {
        if (!account) {
            return (
                <button className="btn btn-primary" onClick={onConnect}>
                    Connect Wallet
                </button>
            );
        }

        if (!isOnArcTestnet) {
            return (
                <button className="btn btn-secondary" onClick={onSwitchNetwork}>
                    Switch to Arc Testnet
                </button>
            );
        }

        if (isApproving) {
            return (
                <button className="btn btn-primary" disabled>
                    <span className="spinner"></span>
                    Approving USDC...
                </button>
            );
        }

        if (isMinting) {
            return (
                <button className="btn btn-success" disabled>
                    <span className="spinner"></span>
                    Minting...
                </button>
            );
        }

        return (
            <button
                className="btn btn-success"
                onClick={onMint}
                disabled={!collectionInfo?.mintingEnabled}
            >
                Mint NFT
            </button>
        );
    };

    const renderStatus = () => {
        if (error) {
            return (
                <div className="mint-status error">
                    ❌ {error}
                </div>
            );
        }

        if (isApproving) {
            return (
                <div className="mint-status loading">
                    ⏳ Please approve USDC spending in your wallet...
                </div>
            );
        }

        if (isMinting) {
            return (
                <div className="mint-status loading">
                    ⏳ Minting your NFT... Please confirm in your wallet.
                </div>
            );
        }

        if (txHash) {
            return (
                <div className="mint-status">
                    ✅ Transaction submitted!{' '}
                    <a
                        href={`https://testnet.arcscan.app/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        View on Explorer
                    </a>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="card mint-section fade-in">
            <h3 className="card-title">Mint Your NFT</h3>
            <div className="mint-actions">
                {renderButton()}
                {renderStatus()}
            </div>

            {!account && (
                <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    💡 Connect your wallet to mint NFTs. Make sure you have testnet USDC from{' '}
                    <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">
                        Circle Faucet
                    </a>
                </p>
            )}
        </div>
    );
}
