import React, { useState, useCallback, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { ethers } from 'ethers';
import { CONTRACTS, ARC_TESTNET, formatUSDC } from '../config/chains';

// QuickMint ABI (same contract, multiple mints)
const QUICKMINT_ABI = [
    "function mint(string name, string description, string image) external payable returns (uint256)",
    "function mintPrice() external view returns (uint256)",
    "function totalMinted() external view returns (uint256)",
    "event NFTMinted(uint256 indexed tokenId, address indexed creator, string name, uint256 price)"
];

export function BulkMint() {
    const { account, connect } = useWallet();
    const isConnected = !!account;

    // Collection state
    const [collectionName, setCollectionName] = useState('');
    const [images, setImages] = useState([]); // [{file, preview, thumbnail, name}]

    // UI state
    const [isProcessing, setIsProcessing] = useState(false);
    const [isMinting, setIsMinting] = useState(false);
    const [mintProgress, setMintProgress] = useState({ current: 0, total: 0 });
    const [mintedTokens, setMintedTokens] = useState([]);
    const [mintPrice, setMintPrice] = useState('0');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Load contract data
    useEffect(() => {
        loadContractData();
    }, []);

    const loadContractData = async () => {
        try {
            const provider = new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrl);
            const contract = new ethers.Contract(CONTRACTS.QUICKMINT, QUICKMINT_ABI, provider);
            const price = await contract.mintPrice();
            setMintPrice(formatUSDC(price));
        } catch (err) {
            console.error('Error loading contract:', err);
        }
    };

    // Compress image to thumbnail
    const compressImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxSize = 64;
                    let { width, height } = img;

                    if (width > maxSize || height > maxSize) {
                        const ratio = Math.min(maxSize / width, maxSize / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', 0.5));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    // Handle multiple file upload
    const handleFilesUpload = useCallback(async (files) => {
        if (files.length === 0) return;
        if (files.length > 100) {
            setError('Maximum 100 images allowed');
            return;
        }

        setIsProcessing(true);
        setError('');

        const newImages = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;

            try {
                // Create preview
                const preview = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(file);
                });

                // Create thumbnail for on-chain
                const thumbnail = await compressImage(file);

                newImages.push({
                    id: Date.now() + i,
                    file,
                    preview,
                    thumbnail,
                    name: `${collectionName || 'NFT'} #${images.length + i + 1}`
                });
            } catch (err) {
                console.error('Error processing image:', err);
            }
        }

        setImages(prev => [...prev, ...newImages]);
        setIsProcessing(false);
    }, [images.length, collectionName]);

    const handleFileInput = (e) => {
        handleFilesUpload(Array.from(e.target.files));
    };

    const handleDrop = (e) => {
        e.preventDefault();
        handleFilesUpload(Array.from(e.dataTransfer.files));
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // Remove image
    const removeImage = (id) => {
        setImages(prev => prev.filter(img => img.id !== id));
    };

    // Update image name
    const updateImageName = (id, name) => {
        setImages(prev => prev.map(img =>
            img.id === id ? { ...img, name } : img
        ));
    };

    // Mint all NFTs
    const handleMintAll = async () => {
        if (!isConnected) {
            connect();
            return;
        }

        if (images.length === 0) {
            setError('Please add some images first');
            return;
        }

        setIsMinting(true);
        setError('');
        setSuccess('');
        setMintProgress({ current: 0, total: images.length });
        setMintedTokens([]);

        try {
            if (!window.ethereum) throw new Error('MetaMask not found');

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(CONTRACTS.QUICKMINT, QUICKMINT_ABI, signer);
            const price = await contract.mintPrice();

            const feeData = await provider.getFeeData();
            const gasPrice = ((feeData.gasPrice || 160000000000n) * 150n) / 100n;

            const minted = [];

            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                setMintProgress({ current: i + 1, total: images.length });

                try {
                    console.log(`Minting ${i + 1}/${images.length}: ${img.name}`);

                    const tx = await contract.mint(
                        img.name,
                        `Part of ${collectionName || 'Bulk Mint'} collection`,
                        img.thumbnail,
                        {
                            value: price,
                            gasLimit: 1000000,
                            gasPrice
                        }
                    );

                    const receipt = await tx.wait();

                    // Get token ID
                    let tokenId = '?';
                    for (const log of receipt.logs) {
                        try {
                            const parsed = contract.interface.parseLog(log);
                            if (parsed?.name === 'NFTMinted') {
                                tokenId = parsed.args[0].toString();
                                break;
                            }
                        } catch { }
                    }

                    minted.push({ name: img.name, tokenId, success: true });
                    setMintedTokens([...minted]);

                } catch (err) {
                    console.error(`Failed to mint ${img.name}:`, err);
                    minted.push({ name: img.name, tokenId: '-', success: false, error: err.message });
                    setMintedTokens([...minted]);
                }
            }

            const successCount = minted.filter(m => m.success).length;
            setSuccess(`🎉 Minted ${successCount}/${images.length} NFTs!`);

            if (successCount === images.length) {
                setImages([]);
            }

        } catch (err) {
            console.error('Bulk mint error:', err);
            setError(err.reason || err.message || 'Minting failed');
        } finally {
            setIsMinting(false);
        }
    };

    const totalCost = (parseFloat(mintPrice) * images.length).toFixed(2);

    return (
        <div className="bulk-mint-page">
            <div className="container">
                <div className="bulk-mint-header">
                    <h1>📦 Bulk Mint</h1>
                    <p>Upload multiple images and mint them as a collection</p>
                </div>

                <div className="bulk-mint-content">
                    {/* Upload Section */}
                    <div className="bulk-upload-section card">
                        <h2>Upload Images</h2>

                        {/* Collection Name */}
                        <div className="form-group">
                            <label>Collection Name</label>
                            <input
                                type="text"
                                value={collectionName}
                                onChange={(e) => setCollectionName(e.target.value)}
                                placeholder="My Collection"
                            />
                        </div>

                        {/* Drop Zone */}
                        <div
                            className="bulk-drop-zone"
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                        >
                            <span className="drop-icon">📁</span>
                            <p>Drag & drop multiple images here</p>
                            <p className="drop-hint">or click to browse (max 100)</p>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleFileInput}
                                className="file-input"
                            />
                        </div>

                        {isProcessing && (
                            <div className="processing-status">Processing images...</div>
                        )}

                        {/* Image Grid */}
                        {images.length > 0 && (
                            <div className="image-grid">
                                {images.map((img, index) => (
                                    <div key={img.id} className="image-item">
                                        <img src={img.preview} alt={img.name} />
                                        <input
                                            type="text"
                                            value={img.name}
                                            onChange={(e) => updateImageName(img.id, e.target.value)}
                                            className="image-name-input"
                                        />
                                        <button
                                            className="remove-btn"
                                            onClick={() => removeImage(img.id)}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Mint Info */}
                        <div className="mint-info">
                            <div className="info-row">
                                <span>Images</span>
                                <span>{images.length}</span>
                            </div>
                            <div className="info-row">
                                <span>Price per NFT</span>
                                <span>{mintPrice} USDC</span>
                            </div>
                            <div className="info-row">
                                <span>Total Cost</span>
                                <span className="price">{totalCost} USDC</span>
                            </div>
                        </div>

                        {/* Progress */}
                        {isMinting && (
                            <div className="mint-progress-section">
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{ width: `${(mintProgress.current / mintProgress.total) * 100}%` }}
                                    />
                                </div>
                                <p>Minting {mintProgress.current} of {mintProgress.total}...</p>
                            </div>
                        )}

                        {/* Minted Tokens */}
                        {mintedTokens.length > 0 && (
                            <div className="minted-tokens">
                                <h3>Minted NFTs:</h3>
                                {mintedTokens.map((t, i) => (
                                    <div key={i} className={`token-result ${t.success ? 'success' : 'failed'}`}>
                                        {t.success ? '✅' : '❌'} {t.name} → Token #{t.tokenId}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Error/Success */}
                        {error && <div className="error-message">{error}</div>}
                        {success && <div className="success-message">{success}</div>}

                        {/* Mint Button */}
                        <button
                            className="btn-primary btn-mint"
                            onClick={handleMintAll}
                            disabled={isMinting || isProcessing || images.length === 0}
                        >
                            {!isConnected ? 'Connect Wallet' :
                                isMinting ? `Minting ${mintProgress.current}/${mintProgress.total}...` :
                                    `Mint ${images.length} NFTs for ${totalCost} USDC`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
