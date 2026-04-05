import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { ethers } from 'ethers';
import { CONTRACTS, ARC_TESTNET, formatUSDC, retryContractCall } from '../config/chains';

// Build version - used to verify deployment cache
const BUILD_VERSION = 'v10-quality-fix';

// QuickMint ABI
const QUICKMINT_ABI = [
    "function mint(string name, string description, string image) external payable returns (uint256)",
    "function mintPrice() external view returns (uint256)",
    "function totalMinted() external view returns (uint256)",
    "function tokensOfOwner(address owner) external view returns (uint256[])",
    "function tokenURI(uint256 tokenId) external view returns (string)",
    "function getTokenMetadata(uint256 tokenId) external view returns (string name, string description, string image, address creator, uint256 mintedAt)",
    "event NFTMinted(uint256 indexed tokenId, address indexed creator, string name, uint256 price)"
];

// Alternative IPFS gateways for fallback
const IPFS_GATEWAYS = [
    'https://nftstorage.link/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/'
];

// Convert IPFS URL to use a specific gateway
const getIPFSUrl = (url, gatewayIndex = 0) => {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    let hash = '';
    if (url.includes('/ipfs/')) {
        hash = url.split('/ipfs/')[1];
    } else if (url.startsWith('ipfs://')) {
        hash = url.replace('ipfs://', '');
    } else {
        return url;
    }
    return IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length] + hash;
};

// NFT Image with fallback gateway support
function NFTImage({ src, alt }) {
    const [gatewayIndex, setGatewayIndex] = React.useState(0);
    const [hasError, setHasError] = React.useState(false);

    const handleError = () => {
        if (gatewayIndex < IPFS_GATEWAYS.length - 1) {
            setGatewayIndex(prev => prev + 1);
        } else {
            setHasError(true);
        }
    };

    if (hasError) return <div className="image-error">🖼️</div>;
    return <img src={getIPFSUrl(src, gatewayIndex)} alt={alt} onError={handleError} />;
}

// Pinata JWT for IPFS uploads
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJhZTBlZjA3NC0yN2NkLTQ3N2ItODY5OS1lNDE0YjEwNTNmMWIiLCJlbWFpbCI6ImNpaGF0dm9vbGthbjc0ODBAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjFjNmU4MDFiN2UzY2FiMDE1MDA3Iiwic2NvcGVkS2V5U2VjcmV0IjoiOThhYTAxYjljYzQyYzQ1YTFmMWIxMjUyNGMyMWI5NmY4MDQ5N2Q0NDM1Mjc1ZTAyNDY2MGRlMjJkY2M0NjFlMyIsImV4cCI6MTgwMDA4MTIwNn0.xPla8yo0qOnGzhCbCv9hwd5sQck755K3nlCLxOTSw1s';

// Secondary Pinata JWT (from .env) as backup
const PINATA_JWT_BACKUP = import.meta.env.VITE_PINATA_JWT;

export function QuickMint() {
    // Use wagmi hooks - same as Header for consistent wallet state
    const { address: account, isConnected, connector } = useAccount();
    const { data: walletClient } = useWalletClient();
    const { openConnectModal } = useConnectModal();

    // Connect wallet - opens RainbowKit modal
    const connect = () => {
        if (openConnectModal) openConnectModal();
    };

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [imageUrl, setImageUrl] = useState(''); // IPFS or data URL

    // UI state
    const [isMinting, setIsMinting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [mintPrice, setMintPrice] = useState('0');
    const [totalMinted, setTotalMinted] = useState(0);
    const [userNFTs, setUserNFTs] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Refs for periodic refresh
    const refreshIntervalRef = useRef(null);

    // Load contract data with retry
    useEffect(() => {
        loadContractData();

        // Set up periodic refresh every 15 seconds for the counter
        refreshIntervalRef.current = setInterval(() => {
            loadContractData(true); // silent refresh
        }, 15000);

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [account]);

    const loadContractData = async (silent = false) => {
        try {
            const data = await retryContractCall(async (provider) => {
                // Check if contract still exists on-chain
                const code = await provider.getCode(CONTRACTS.QUICKMINT);
                if (!code || code === '0x') {
                    throw new Error('CONTRACT_NOT_FOUND');
                }

                const contract = new ethers.Contract(CONTRACTS.QUICKMINT, QUICKMINT_ABI, provider);

                const [price, minted] = await Promise.all([
                    contract.mintPrice(),
                    contract.totalMinted()
                ]);

                return { price, minted };
            });

            setMintPrice(formatUSDC(data.price));
            setTotalMinted(Number(data.minted));

            // Clear any previous errors since data loaded successfully
            if (!silent) setError('');

            if (account) {
                await loadUserNFTs();
            }
        } catch (err) {
            console.error('Error loading contract data:', err);
            if (!silent) {
                if (err.message === 'CONTRACT_NOT_FOUND') {
                    setError('⚠️ Contract not found on Arc Testnet. The testnet may have been reset and the contract needs to be redeployed.');
                } else if (err.code === 'CALL_EXCEPTION') {
                    setError('⚠️ Cannot connect to QuickMint contract. The RPC might be down or the contract may need redeployment.');
                } else {
                    setError('⚠️ Failed to load contract data. Retrying...');
                    // Auto-retry once more after 3s on initial load
                    setTimeout(() => loadContractData(true), 3000);
                }
            }
        }
    };

    const loadUserNFTs = async () => {
        try {
            const nfts = await retryContractCall(async (provider) => {
                const contract = new ethers.Contract(CONTRACTS.QUICKMINT, QUICKMINT_ABI, provider);
                const tokenIds = await contract.tokensOfOwner(account);
                const results = [];

                for (const tokenId of tokenIds) {
                    try {
                        const [nftName, desc, img, creator, mintedAt] = await contract.getTokenMetadata(tokenId);
                        results.push({
                            tokenId: Number(tokenId),
                            name: nftName,
                            description: desc,
                            image: img,
                            creator,
                            mintedAt: Number(mintedAt)
                        });
                    } catch (e) {
                        console.error('Error loading NFT:', tokenId, e);
                    }
                }

                return results;
            });

            setUserNFTs(nfts.reverse());
        } catch (err) {
            console.error('Error loading user NFTs:', err);
        }
    };

    /**
     * Upload to Pinata IPFS with retry logic and exponential backoff.
     * Tries up to 3 times with increasing delays.
     * Falls back to high-quality base64 only as absolute last resort.
     */
    const uploadToIPFS = async (file) => {
        console.log('📤 Uploading to Pinata IPFS...');

        const jwtTokens = [PINATA_JWT, PINATA_JWT_BACKUP].filter(Boolean);
        // Remove duplicates
        const uniqueJWTs = [...new Set(jwtTokens)];

        for (const jwt of uniqueJWTs) {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    // Exponential backoff: 0s, 2s, 5s
                    if (attempt > 0) {
                        const delay = attempt === 1 ? 2000 : 5000;
                        console.log(`⏳ Retry ${attempt + 1}/3 after ${delay}ms...`);
                        await new Promise(r => setTimeout(r, delay));
                    }

                    const formData = new FormData();
                    formData.append('file', file);

                    const metadata = JSON.stringify({
                        name: `ArcGenesis-${Date.now()}`
                    });
                    formData.append('pinataMetadata', metadata);

                    // Use AbortController for timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

                    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${jwt}`
                        },
                        body: formData,
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (response.status === 429) {
                        // Rate limited — wait longer and retry
                        console.warn('⚠️ Pinata rate limited, waiting 10s...');
                        await new Promise(r => setTimeout(r, 10000));
                        continue;
                    }

                    if (!response.ok) {
                        throw new Error(`Pinata upload failed: ${response.status}`);
                    }

                    const result = await response.json();
                    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
                    console.log('✅ IPFS URL:', ipfsUrl);
                    return ipfsUrl;

                } catch (err) {
                    console.error(`IPFS upload attempt ${attempt + 1} failed:`, err.message);
                    if (err.name === 'AbortError') {
                        console.warn('⚠️ Upload timed out');
                    }
                }
            }
        }

        // ALL retries with ALL JWT tokens failed — use high-quality fallback
        console.warn('⚠️ All IPFS upload attempts failed. Using high-quality base64 fallback...');
        return createBase64Fallback(file);
    };

    /**
     * High-quality base64 fallback for when IPFS is completely unavailable.
     * Uses 512x512 max resolution and 0.85 JPEG quality to preserve detail.
     */
    const createBase64Fallback = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    // Use 512px as max dimension for much better quality
                    const maxSize = 512;
                    let { width, height } = img;

                    // Only downscale if larger than maxSize
                    if (width > maxSize || height > maxSize) {
                        const ratio = Math.min(maxSize / width, maxSize / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    // Use better image smoothing for quality
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);

                    // Use high JPEG quality (0.85) for much better results
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

                    // Check if the data URL is reasonably sized for on-chain storage
                    // If it's too large (>24KB), reduce quality progressively
                    if (dataUrl.length > 24000) {
                        console.warn(`⚠️ Base64 too large (${dataUrl.length}), reducing quality...`);
                        // Try reducing to 384px at 0.75 quality
                        const maxSize2 = 384;
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
                        const dataUrl2 = canvas.toDataURL('image/jpeg', 0.75);

                        if (dataUrl2.length > 24000) {
                            // Final fallback: 256px at 0.65
                            const maxSize3 = 256;
                            let w3 = img.width, h3 = img.height;
                            if (w3 > maxSize3 || h3 > maxSize3) {
                                const ratio3 = Math.min(maxSize3 / w3, maxSize3 / h3);
                                w3 = Math.round(w3 * ratio3);
                                h3 = Math.round(h3 * ratio3);
                            }
                            canvas.width = w3;
                            canvas.height = h3;
                            ctx.imageSmoothingEnabled = true;
                            ctx.imageSmoothingQuality = 'high';
                            ctx.drawImage(img, 0, 0, w3, h3);
                            resolve(canvas.toDataURL('image/jpeg', 0.65));
                        } else {
                            resolve(dataUrl2);
                        }
                    } else {
                        resolve(dataUrl);
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    // Handle image upload
    const handleImageUpload = useCallback(async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be less than 5MB');
            return;
        }

        setImage(file);
        setError('');
        setIsUploading(true);

        try {
            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => setImagePreview(e.target.result);
            reader.readAsDataURL(file);

            // Upload to IPFS (with retry) or create high-quality fallback
            const url = await uploadToIPFS(file);
            setImageUrl(url);
            console.log('Image URL ready, length:', url.length);
        } catch (err) {
            console.error('Upload error:', err);
            setError('Failed to process image');
        } finally {
            setIsUploading(false);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            handleImageUpload({ target: { files: [file] } });
        }
    }, [handleImageUpload]);

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // Mint NFT
    const handleMint = async () => {
        if (!isConnected) {
            connect();
            return;
        }

        if (!name.trim()) {
            setError('Please enter a name for your NFT');
            return;
        }

        if (!imageUrl) {
            setError('Please upload an image');
            return;
        }

        setIsMinting(true);
        setError('');
        setSuccess('');

        try {
            if (!walletClient) {
                throw new Error('Wallet not connected. Please connect your wallet first.');
            }

            // ============================================================
            // ZERO ethers.js BrowserProvider — all calls via raw RPC
            // ============================================================
            console.log(`=== MINT DEBUG [${BUILD_VERSION}] ===`);

            const walletProvider = await connector.getProvider();

            // === STEP 1: Check chain via raw RPC ===
            const chainIdHex = await walletProvider.request({ method: 'eth_chainId' });
            const currentChainId = parseInt(chainIdHex, 16);
            console.log('Current chain:', currentChainId, '| Required:', ARC_TESTNET.chainId);

            if (currentChainId !== ARC_TESTNET.chainId) {
                console.log('Wrong chain! Switching...');
                setSuccess('Switching to Arc Testnet...');
                try {
                    await walletProvider.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: ARC_TESTNET.chainIdHex }]
                    });
                } catch (switchError) {
                    if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
                        await walletProvider.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: ARC_TESTNET.chainIdHex,
                                chainName: ARC_TESTNET.name,
                                nativeCurrency: ARC_TESTNET.currency,
                                rpcUrls: [ARC_TESTNET.rpcUrl],
                                blockExplorerUrls: [ARC_TESTNET.blockExplorer]
                            }]
                        });
                    } else {
                        throw new Error('Please switch to Arc Testnet in your wallet.');
                    }
                }
            }

            // === STEP 2: Get signer address via raw RPC ===
            const accounts = await walletProvider.request({ method: 'eth_accounts' });
            const signerAddress = accounts[0];
            console.log('Signer:', signerAddress);
            console.log('Contract:', CONTRACTS.QUICKMINT);

            // === STEP 3: Verify contract exists (via retryContractCall) ===
            const { contractCode, price, rpcProvider } = await retryContractCall(async (provider) => {
                const code = await provider.getCode(CONTRACTS.QUICKMINT);
                const contract = new ethers.Contract(CONTRACTS.QUICKMINT, QUICKMINT_ABI, provider);
                const p = await contract.mintPrice();
                return { contractCode: code, price: p, rpcProvider: provider };
            });

            console.log('Contract code length:', contractCode.length);

            if (!contractCode || contractCode === '0x') {
                throw new Error(
                    'QuickMint contract not found on Arc Testnet! ' +
                    'The testnet may have been reset. Contract needs to be redeployed.'
                );
            }

            // === STEP 4: Use already-fetched price ===
            console.log('Price:', price.toString());

            // === STEP 5: Check balance via raw RPC ===
            const balanceHex = await walletProvider.request({
                method: 'eth_getBalance',
                params: [signerAddress, 'latest']
            });
            const userBalance = BigInt(balanceHex);
            console.log('Balance:', userBalance.toString(), '| Price:', price.toString());

            if (userBalance < price) {
                throw new Error(
                    `Insufficient balance! You have ${(Number(userBalance) / 1e18).toFixed(6)} but need ${(Number(price) / 1e18).toFixed(6)}. ` +
                    'Get testnet funds from the faucet.'
                );
            }

            // === STEP 6: Encode and send transaction via RAW wallet RPC ===
            console.log('Encoding mint call...');
            console.log('Name:', name.trim());
            console.log('Image URL length:', imageUrl.length);
            setSuccess('Please confirm the transaction in your wallet...');

            const iface = new ethers.Interface(QUICKMINT_ABI);
            const mintData = iface.encodeFunctionData('mint', [
                name.trim(),
                description.trim() || 'Minted on ArcGenesis',
                imageUrl
            ]);

            const txHash = await walletProvider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: signerAddress,
                    to: CONTRACTS.QUICKMINT,
                    data: mintData,
                    value: '0x' + price.toString(16),
                    gas: '0x' + (3500000).toString(16),
                }]
            });

            console.log('TX sent:', txHash);
            setSuccess(`Transaction sent! Confirming... TX: ${txHash.slice(0, 10)}...`);

            // === STEP 7: Wait for receipt (via retryContractCall for resilient polling) ===
            let receipt = null;
            for (let i = 0; i < 60; i++) {
                await new Promise(r => setTimeout(r, 3000));
                try {
                    receipt = await retryContractCall(async (provider) => {
                        return await provider.getTransactionReceipt(txHash);
                    }, 1);
                } catch (e) {
                    // Ignore individual poll failures
                }
                if (receipt) break;
                console.log(`Waiting... (${i + 1})`);
            }

            if (!receipt) {
                setSuccess(`⏳ TX sent (${txHash.slice(0, 10)}...) but taking long. Check explorer.`);
                return;
            }

            console.log('TX confirmed:', receipt);

            if (receipt.status === 0) {
                throw new Error('Transaction REVERTED on chain. Hash: ' + txHash);
            }

            // Find token ID from events
            let tokenId = 'Unknown';
            if (receipt.logs) {
                const iface2 = new ethers.Interface(QUICKMINT_ABI);
                for (const log of receipt.logs) {
                    try {
                        const parsed = iface2.parseLog(log);
                        if (parsed && parsed.name === 'NFTMinted') {
                            tokenId = parsed.args[0].toString();
                            break;
                        }
                    } catch { }
                }
            }

            setSuccess(`🎉 NFT Minted! Token ID: ${tokenId}`);

            // Reset form
            setName('');
            setDescription('');
            setImage(null);
            setImagePreview('');
            setImageUrl('');
            await loadContractData();

        } catch (err) {
            console.error('=== MINT ERROR ===', err);
            console.error('Full:', JSON.stringify(err, Object.getOwnPropertyNames(err)));

            let errorMsg;
            if (err.code === 'ACTION_REJECTED' || err.code === 4001) {
                errorMsg = 'Transaction cancelled by user.';
            } else if (err.message?.includes('Insufficient balance')) {
                errorMsg = err.message;
            } else {
                errorMsg = `[${BUILD_VERSION}] ${err.reason || err.shortMessage || err.message || 'Unknown error'}`;
            }
            setError(errorMsg);
        } finally {
            setIsMinting(false);
        }
    };

    return (
        <div className="quick-mint-page">
            <div className="container">
                <div className="quick-mint-header">
                    <h1>⚡ Quick Mint</h1>
                    <p>Mint your unique NFT instantly on Arc Testnet</p>
                </div>

                <div className="quick-mint-content">
                    {/* Mint Form */}
                    <div className="quick-mint-form card">
                        <h2>Create Your NFT</h2>

                        {/* Image Upload */}
                        <div
                            className={`image-drop-zone ${imagePreview ? 'has-image' : ''}`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                        >
                            {imagePreview ? (
                                <div className="image-preview-container">
                                    <img src={imagePreview} alt="Preview" className="image-preview" />
                                    <button
                                        className="btn-remove-image"
                                        onClick={() => {
                                            setImage(null);
                                            setImagePreview('');
                                            setImageUrl('');
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <div className="drop-zone-content">
                                    <span className="drop-icon">🖼️</span>
                                    <p>Drag & drop your image here</p>
                                    <p className="drop-hint">or click to browse</p>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="file-input"
                                    />
                                </div>
                            )}
                        </div>

                        {isUploading && (
                            <div className="upload-status">Uploading to IPFS...</div>
                        )}

                        {/* Name Input */}
                        <div className="form-group">
                            <label>NFT Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="My Amazing NFT"
                                maxLength={50}
                            />
                        </div>

                        {/* Description Input */}
                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe your NFT..."
                                rows={3}
                                maxLength={200}
                            />
                        </div>

                        {/* Mint Info */}
                        <div className="mint-info">
                            <div className="info-row">
                                <span>Network</span>
                                <span>Arc Testnet</span>
                            </div>
                            <div className="info-row">
                                <span>Total Minted</span>
                                <span>{totalMinted}</span>
                            </div>
                        </div>

                        {/* Error/Success Messages */}
                        {error && <div className="error-message">{error}</div>}
                        {success && <div className="success-message">{success}</div>}

                        {/* Mint Button */}
                        <button
                            className="btn-primary btn-mint"
                            onClick={handleMint}
                            disabled={isMinting || isUploading}
                        >
                            {!isConnected ? 'Connect Wallet' :
                                isUploading ? 'Uploading to IPFS...' :
                                    isMinting ? 'Minting...' :
                                        `Mint for ${mintPrice} USDC`}
                        </button>
                    </div>

                    {/* Minted NFTs Gallery */}
                    <div className="minted-gallery card">
                        <h2>Your Minted NFTs</h2>
                        {!isConnected ? (
                            <p className="gallery-hint">Connect wallet to see your NFTs</p>
                        ) : userNFTs.length === 0 ? (
                            <p className="gallery-hint">No NFTs yet. Mint your first one!</p>
                        ) : (
                            <div className="nft-gallery">
                                {userNFTs.map((nft) => (
                                    <div key={nft.tokenId} className="nft-card">
                                        <div className="nft-image">
                                            <NFTImage src={nft.image} alt={nft.name} />
                                        </div>
                                        <div className="nft-info">
                                            <h3 className="nft-name">{nft.name}</h3>
                                            <div className="nft-meta">
                                                <span className="nft-creator">#{nft.tokenId}</span>
                                            </div>
                                            <div className="nft-id">#{nft.tokenId}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
