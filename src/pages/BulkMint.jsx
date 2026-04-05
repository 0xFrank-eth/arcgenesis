import React, { useState, useCallback, useEffect } from 'react';
import { useAccount, useConnect, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { CONTRACTS, ARC_TESTNET, formatUSDC, retryContractCall } from '../config/chains';

// QuickMint ABI (same contract, multiple mints)
const QUICKMINT_ABI = [
    "function mint(string name, string description, string image) external payable returns (uint256)",
    "function mintPrice() external view returns (uint256)",
    "function totalMinted() external view returns (uint256)",
    "event NFTMinted(uint256 indexed tokenId, address indexed creator, string name, uint256 price)"
];

// Pinata JWT for IPFS uploads
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJhZTBlZjA3NC0yN2NkLTQ3N2ItODY5OS1lNDE0YjEwNTNmMWIiLCJlbWFpbCI6ImNpaGF0dm9vbGthbjc0ODBAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjFjNmU4MDFiN2UzY2FiMDE1MDA3Iiwic2NvcGVkS2V5U2VjcmV0IjoiOThhYTAxYjljYzQyYzQ1YTFmMWIxMjUyNGMyMWI5NmY4MDQ5N2Q0NDM1Mjc1ZTAyNDY2MGRlMjJkY2M0NjFlMyIsImV4cCI6MTgwMDA4MTIwNn0.xPla8yo0qOnGzhCbCv9hwd5sQck755K3nlCLxOTSw1s';

export function BulkMint() {
    const { address: account, isConnected, connector } = useAccount();
    const { connectors, connectAsync } = useConnect();
    const { data: walletClient } = useWalletClient();

    const connect = async () => {
        const targetConnector = connectors.find(c => c.name !== 'Injected') || connectors[0];
        if (targetConnector) {
            try {
                await connectAsync({ connector: targetConnector, chainId: 5042002 });
            } catch (err) {
                console.error('Connect error:', err);
            }
        }
    };

    // Collection state
    const [collectionName, setCollectionName] = useState('');
    const [images, setImages] = useState([]); // [{file, preview, ipfsUrl, name}]

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
            const price = await retryContractCall(async (provider) => {
                const contract = new ethers.Contract(CONTRACTS.QUICKMINT, QUICKMINT_ABI, provider);
                return await contract.mintPrice();
            });
            setMintPrice(formatUSDC(price));
        } catch (err) {
            console.error('Error loading contract:', err);
        }
    };

    /**
     * Upload to Pinata IPFS with retry logic.
     * Uses the same robust retry approach as QuickMint.
     */
    const uploadToIPFS = async (file) => {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = attempt === 1 ? 2000 : 5000;
                    console.log(`⏳ Retry ${attempt + 1}/3 after ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                }

                const formData = new FormData();
                formData.append('file', file);
                formData.append('pinataMetadata', JSON.stringify({
                    name: `ArcGenesis-Bulk-${Date.now()}`
                }));

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);

                const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
                    body: formData,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.status === 429) {
                    console.warn('⚠️ Rate limited, waiting 10s...');
                    await new Promise(r => setTimeout(r, 10000));
                    continue;
                }

                if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

                const result = await response.json();
                return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
            } catch (err) {
                console.error(`IPFS upload attempt ${attempt + 1} failed:`, err.message);
            }
        }

        // Fallback to high-quality base64 (512px max)
        console.warn('⚠️ IPFS failed, using base64 fallback');
        return createBase64Fallback(file);
    };

    /**
     * High-quality base64 fallback — 512px at 0.85 JPEG quality.
     * Much better than the original 64px at 0.5 quality.
     */
    const createBase64Fallback = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxSize = 512;
                    let { width, height } = img;

                    if (width > maxSize || height > maxSize) {
                        const ratio = Math.min(maxSize / width, maxSize / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);

                    let dataUrl = canvas.toDataURL('image/jpeg', 0.85);

                    // Progressive quality reduction if too large for on-chain
                    if (dataUrl.length > 24000) {
                        const maxSize2 = 256;
                        let w2 = img.width, h2 = img.height;
                        if (w2 > maxSize2 || h2 > maxSize2) {
                            const ratio2 = Math.min(maxSize2 / w2, maxSize2 / h2);
                            w2 = Math.round(w2 * ratio2);
                            h2 = Math.round(h2 * ratio2);
                        }
                        canvas.width = w2;
                        canvas.height = h2;
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(img, 0, 0, w2, h2);
                        dataUrl = canvas.toDataURL('image/jpeg', 0.70);
                    }

                    resolve(dataUrl);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    // Handle multiple file upload — upload to IPFS immediately
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

                // Upload to IPFS (with retry)
                console.log(`📤 Uploading image ${i + 1}/${files.length} to IPFS...`);
                const ipfsUrl = await uploadToIPFS(file);

                // Rate limit: 1 second between uploads to avoid Pinata 429
                if (i < files.length - 1) {
                    await new Promise(r => setTimeout(r, 1000));
                }

                newImages.push({
                    id: Date.now() + i,
                    file,
                    preview,
                    ipfsUrl,
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
            if (!walletClient) throw new Error('Wallet not connected');

            const walletProvider = await connector.getProvider();

            // Get mint price via retry
            const price = await retryContractCall(async (provider) => {
                const contract = new ethers.Contract(CONTRACTS.QUICKMINT, QUICKMINT_ABI, provider);
                return await contract.mintPrice();
            });

            const iface = new ethers.Interface(QUICKMINT_ABI);
            const minted = [];

            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                setMintProgress({ current: i + 1, total: images.length });

                try {
                    console.log(`Minting ${i + 1}/${images.length}: ${img.name}`);

                    const accounts = await walletProvider.request({ method: 'eth_accounts' });
                    const signerAddress = accounts[0];

                    const mintData = iface.encodeFunctionData('mint', [
                        img.name,
                        `Part of ${collectionName || 'Bulk Mint'} collection`,
                        img.ipfsUrl // Use IPFS URL instead of tiny thumbnail
                    ]);

                    const txHash = await walletProvider.request({
                        method: 'eth_sendTransaction',
                        params: [{
                            from: signerAddress,
                            to: CONTRACTS.QUICKMINT,
                            data: mintData,
                            value: '0x' + price.toString(16),
                            gas: '0x' + (img.ipfsUrl.startsWith('data:') ? 10000000 : 3500000).toString(16), // Higher gas for base64
                        }]
                    });

                    // Wait for receipt
                    let receipt = null;
                    for (let j = 0; j < 60; j++) {
                        await new Promise(r => setTimeout(r, 3000));
                        try {
                            receipt = await retryContractCall(async (provider) => {
                                return await provider.getTransactionReceipt(txHash);
                            }, 1);
                        } catch (e) { /* ignore individual poll failures */ }
                        if (receipt) break;
                    }

                    // Get token ID
                    let tokenId = '?';
                    if (receipt && receipt.logs) {
                        for (const log of receipt.logs) {
                            try {
                                const parsed = iface.parseLog(log);
                                if (parsed?.name === 'NFTMinted') {
                                    tokenId = parsed.args[0].toString();
                                    break;
                                }
                            } catch { }
                        }
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
                            <div className="processing-status">Uploading images to IPFS...</div>
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
