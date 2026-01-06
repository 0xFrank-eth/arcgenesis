import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ethers } from 'ethers';
import { MintProgress } from '../components/MintProgress';
import { NFT_COLLECTION_ABI } from '../config/chains';

export function CollectionDetail({
    account,
    signer,
    provider,
    isOnArcTestnet,
    onConnect,
    onSwitchNetwork,
    getCollectionDetails,
    getCollectionByAddress,
    formatAddress
}) {
    const { id, address } = useParams();
    const [collection, setCollection] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMinting, setIsMinting] = useState(false);
    const [isEnabling, setIsEnabling] = useState(false);
    const [error, setError] = useState(null);
    const [txHash, setTxHash] = useState(null);
    const [mintedNFTs, setMintedNFTs] = useState([]);

    // Check if connected wallet is the collection owner
    const isOwner = account && collection?.creator &&
        account.toLowerCase() === collection.creator.toLowerCase();

    const fetchCollection = useCallback(async () => {
        setIsLoading(true);
        try {
            let details;

            // If we have an address param, use getCollectionByAddress
            if (address && ethers.isAddress(address)) {
                details = await getCollectionByAddress(address);
            }
            // If ID looks like an address (hex string starting with 0x), use getCollectionByAddress
            else if (id && ethers.isAddress(id)) {
                details = await getCollectionByAddress(id);
            }
            // If we have a numeric ID param, use getCollectionDetails
            else if (id && /^\d+$/.test(id)) {
                details = await getCollectionDetails(parseInt(id));
            }

            setCollection(details);
        } catch (err) {
            console.error('Error fetching collection:', err);
            setError('Failed to load collection');
        } finally {
            setIsLoading(false);
        }
    }, [id, address, getCollectionDetails, getCollectionByAddress]);

    useEffect(() => {
        fetchCollection();
    }, [fetchCollection]);

    // Enable public minting - only available to owner
    const handleEnablePublicMint = async () => {
        if (!signer || !collection || !isOwner) return;

        setIsEnabling(true);
        setError(null);

        try {
            const nftContract = new ethers.Contract(
                collection.contractAddress,
                NFT_COLLECTION_ABI,
                signer
            );

            // Set mint times: whitelist in past, public from now to 1 year
            const now = Math.floor(Date.now() / 1000);
            const twoHoursAgo = now - 7200;
            const oneHourAgo = now - 3600;
            const oneYearFromNow = now + (365 * 24 * 60 * 60);

            console.log('Enabling public mint...');
            const tx = await nftContract.setMintTimes(
                twoHoursAgo,      // whitelistStart (past)
                oneHourAgo,       // whitelistEnd (past)
                now,              // publicStart (now)
                oneYearFromNow    // publicEnd (1 year)
            );

            setTxHash(tx.hash);
            console.log('Transaction sent:', tx.hash);

            await tx.wait();
            console.log('Public minting enabled!');

            // Refresh collection data
            await fetchCollection();
            setError(null);
        } catch (err) {
            console.error('Error enabling public mint:', err);
            setError('Failed to enable public minting: ' + (err.reason || err.message));
        } finally {
            setIsEnabling(false);
        }
    };

    const handleMint = async () => {
        if (!signer || !collection) return;

        setIsMinting(true);
        setError(null);
        setTxHash(null);

        let currentStep = 'Initializing';

        try {
            // Step 1: Validate collection address
            currentStep = 'Validating collection address';
            if (!collection.contractAddress || collection.contractAddress === '0x0000000000000000000000000000000000000000') {
                throw new Error('Collection contract address is not valid. Please wait for deployment to complete.');
            }

            const nftContract = new ethers.Contract(
                collection.contractAddress,
                NFT_COLLECTION_ABI,
                signer
            );

            // Step 3: Check if public mint is active
            currentStep = 'Checking mint status';
            const isPublicActive = await nftContract.isPublicActive();
            if (!isPublicActive) {
                throw new Error('Public minting is not currently active. Please contact the collection owner to enable it.');
            }

            // Step 4: Calculate mint cost
            currentStep = 'Calculating mint cost';
            // Get the public mint price from contract (in wei, 6 decimals for USDC)
            const publicMintPrice = await nftContract.publicMintPrice();
            console.log('Public mint price (wei):', publicMintPrice.toString());

            // Arc Testnet uses USDC as native currency - send as msg.value
            // Step 5: Mint NFT with native payment
            currentStep = 'Minting NFT (waiting for wallet confirmation)';
            const mintTx = await nftContract.publicMint(1, {
                value: publicMintPrice  // Send USDC as native payment
            });
            setTxHash(mintTx.hash);

            currentStep = 'Waiting for mint confirmation';
            const receipt = await mintTx.wait();

            // Get minted token ID from event
            const mintEvent = receipt.logs.find(log => {
                try {
                    const parsed = nftContract.interface.parseLog(log);
                    return parsed?.name === 'PublicMinted' || parsed?.name === 'Transfer';
                } catch {
                    return false;
                }
            });

            if (mintEvent) {
                const parsed = nftContract.interface.parseLog(mintEvent);
                const tokenId = parsed.args.tokenId;
                setMintedNFTs(prev => [...prev, Number(tokenId)]);
            }

            // Refresh collection data
            fetchCollection();

        } catch (err) {
            console.error(`Error during ${currentStep}:`, err);

            // Create descriptive error message
            let errorMessage = `Failed at step: ${currentStep}. `;

            if (err.message.includes('missing revert data')) {
                errorMessage += 'Contract call failed - the target contract may not exist or function is invalid.';
            } else if (err.message.includes('user rejected')) {
                errorMessage += 'Transaction was rejected by user.';
            } else if (err.message.includes('insufficient funds')) {
                errorMessage += 'Insufficient USDC balance. You need more USDC to mint.';
            } else if (err.message.includes('PublicMintNotActive') || err.message.includes('Public minting is not')) {
                errorMessage += 'Public minting is not active yet. Please wait for the collection owner to enable it.';
            } else {
                errorMessage += err.message || 'Unknown error occurred.';
            }

            setError(errorMessage);
        } finally {
            setIsMinting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="collection-detail-page">
                <div className="container">
                    <div className="loading-state">
                        <div className="spinner large"></div>
                        <p>Loading collection...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!collection) {
        return (
            <div className="collection-detail-page">
                <div className="container">
                    <div className="error-state">
                        <div className="error-icon">😕</div>
                        <h2>Collection Not Found</h2>
                        <p>The collection you're looking for doesn't exist.</p>
                        <Link to="/" className="btn btn-primary">
                            Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const isSoldOut = collection.totalMinted >= collection.maxSupply;

    return (
        <div className="collection-detail-page">
            <div className="container">
                <Link to="/" className="back-link">
                    ← Back to Collections
                </Link>

                <div className="collection-detail-grid">
                    {/* Left: Collection Image */}
                    <div className="collection-image-section">
                        <div className="collection-image-wrapper">
                            {collection.imageUrl ? (
                                <img
                                    src={collection.imageUrl}
                                    alt={collection.name}
                                    className="collection-detail-image"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                    }}
                                />
                            ) : null}
                            <div
                                className="collection-image-placeholder"
                                style={{ display: collection.imageUrl ? 'none' : 'flex' }}
                            >
                                {collection.symbol?.slice(0, 2) || '🎨'}
                            </div>
                            <div className="collection-badge">{collection.symbol}</div>
                        </div>
                    </div>

                    {/* Right: Collection Info */}
                    <div className="collection-info-section">
                        <div className="collection-header">
                            <h1 className="collection-name">{collection.name}</h1>
                            <div className="collection-creator">
                                <span className="creator-label">Created by</span>
                                <span className="creator-address">
                                    {formatAddress ? formatAddress(collection.creator) :
                                        `${collection.creator?.slice(0, 6)}...${collection.creator?.slice(-4)}`}
                                </span>
                            </div>
                        </div>

                        <div className="collection-stats-grid">
                            <div className="stat-card">
                                <span className="stat-value">{collection.mintPrice} USDC</span>
                                <span className="stat-label">Mint Price</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{collection.maxSupply}</span>
                                <span className="stat-label">Total Supply</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{collection.totalMinted}</span>
                                <span className="stat-label">Minted</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{collection.maxSupply - collection.totalMinted}</span>
                                <span className="stat-label">Remaining</span>
                            </div>
                        </div>

                        <MintProgress
                            minted={collection.totalMinted}
                            total={collection.maxSupply}
                        />

                        <div className="mint-section">
                            {error && (
                                <div className="alert alert-error">
                                    <span className="alert-icon">⚠️</span>
                                    {error}
                                </div>
                            )}

                            {txHash && (
                                <div className="alert alert-success">
                                    <span className="alert-icon">✅</span>
                                    Mint successful!
                                    <a
                                        href={`https://testnet.arcscan.app/tx/${txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        View Transaction
                                    </a>
                                </div>
                            )}

                            {!account ? (
                                <button className="btn btn-primary btn-lg btn-full" onClick={onConnect}>
                                    Connect Wallet to Mint
                                </button>
                            ) : !isOnArcTestnet ? (
                                <button className="btn btn-primary btn-lg btn-full" onClick={onSwitchNetwork}>
                                    Switch to Arc Testnet
                                </button>
                            ) : isSoldOut ? (
                                <button className="btn btn-disabled btn-lg btn-full" disabled>
                                    Sold Out
                                </button>
                            ) : (
                                <button
                                    className="btn btn-primary btn-lg btn-full"
                                    onClick={handleMint}
                                    disabled={isMinting}
                                >
                                    {isMinting ? (
                                        <>
                                            <span className="spinner"></span>
                                            Minting...
                                        </>
                                    ) : (
                                        <>
                                            🎨 Mint for {collection.publicMintPrice || '0'} USDC
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Owner Panel - Enable Public Mint */}
                        {isOwner && !collection.isPublicActive && (
                            <div className="owner-panel" style={{
                                marginTop: '1.5rem',
                                padding: '1rem',
                                backgroundColor: 'rgba(255, 193, 7, 0.1)',
                                border: '1px solid rgba(255, 193, 7, 0.3)',
                                borderRadius: '0.5rem'
                            }}>
                                <h4 style={{ color: '#ffc107', marginBottom: '0.5rem' }}>
                                    👑 Owner Panel
                                </h4>
                                <p style={{ fontSize: '0.875rem', marginBottom: '1rem', opacity: 0.8 }}>
                                    Public minting is not active. Click below to enable it.
                                </p>
                                <button
                                    className="btn btn-primary btn-full"
                                    onClick={handleEnablePublicMint}
                                    disabled={isEnabling}
                                    style={{ backgroundColor: '#ffc107', color: '#000' }}
                                >
                                    {isEnabling ? (
                                        <>
                                            <span className="spinner"></span>
                                            Enabling...
                                        </>
                                    ) : (
                                        '🚀 Enable Public Minting'
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Recently Minted */}
                        {mintedNFTs.length > 0 && (
                            <div className="minted-nfts">
                                <h3>Your Minted NFTs</h3>
                                <div className="minted-grid">
                                    {mintedNFTs.map(tokenId => (
                                        <div key={tokenId} className="minted-nft-card">
                                            <span className="minted-nft-id">#{tokenId}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Contract Info */}
                <div className="contract-info">
                    <h3>Contract Details</h3>
                    <div className="contract-details">
                        <div className="contract-row">
                            <span className="contract-label">Contract Address</span>
                            <a
                                href={`https://testnet.arcscan.app/address/${collection.contractAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="contract-value"
                            >
                                {collection.contractAddress}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
