import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreateCollectionForm } from '../components/CreateCollectionForm';

export function CreateCollection({
    account,
    isOnArcTestnet,
    onConnect,
    onSwitchNetwork,
    createCollection,
    isCreating,
    error,
    txHash
}) {
    const navigate = useNavigate();

    const handleSubmit = async (formData) => {
        const collectionAddress = await createCollection({
            name: formData.name,
            symbol: formData.symbol,
            maxSupply: parseInt(formData.maxSupply),
            whitelistMintPrice: formData.mintPrice || '0',
            publicMintPrice: formData.mintPrice || '0',
            baseTokenURI: formData.baseTokenURI || '',
            royaltyFeePercent: parseInt(formData.royaltyFeePercent) || 500,
            maxMintsPerWallet: parseInt(formData.maxMintsPerWallet) || 5
        });

        if (collectionAddress) {
            // Redirect to the new collection's detail page
            setTimeout(() => {
                navigate(`/collection/address/${collectionAddress}`);
            }, 2000);
        }
    };

    return (
        <div className="create-page">
            <div className="container">
                <div className="page-header">
                    <Link to="/" className="back-link">
                        ← Back to Home
                    </Link>
                    <h1 className="page-title">
                        <span className="title-icon">🚀</span>
                        Launch Your Collection
                    </h1>
                    <p className="page-subtitle">
                        Create your own NFT collection on Arc Network in just a few steps
                    </p>
                </div>

                <div className="create-content">
                    {!account ? (
                        <div className="connect-prompt">
                            <div className="prompt-icon">🔗</div>
                            <h2>Connect Your Wallet</h2>
                            <p>Please connect your wallet to create a collection</p>
                            <button className="btn btn-primary btn-lg" onClick={onConnect}>
                                Connect Wallet
                            </button>
                        </div>
                    ) : !isOnArcTestnet ? (
                        <div className="connect-prompt">
                            <div className="prompt-icon">🔄</div>
                            <h2>Switch to Arc Testnet</h2>
                            <p>Please switch to Arc Testnet to continue</p>
                            <button className="btn btn-primary btn-lg" onClick={onSwitchNetwork}>
                                Switch Network
                            </button>
                        </div>
                    ) : (
                        <CreateCollectionForm
                            onSubmit={handleSubmit}
                            isCreating={isCreating}
                            error={error}
                            txHash={txHash}
                        />
                    )}
                </div>

                <div className="create-info">
                    <div className="info-card">
                        <h3>📋 What You'll Need</h3>
                        <ul>
                            <li>Collection name and symbol</li>
                            <li>Maximum supply (up to 10,000)</li>
                            <li>Mint price in USDC</li>
                            <li>Small gas fee in USDC for deployment</li>
                        </ul>
                    </div>
                    <div className="info-card">
                        <h3>✨ What You'll Get</h3>
                        <ul>
                            <li>Fully on-chain ERC-721 collection</li>
                            <li>Automatic listing on ArcGenesis</li>
                            <li>Mint payments sent directly to you</li>
                            <li>Full ownership and control</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
