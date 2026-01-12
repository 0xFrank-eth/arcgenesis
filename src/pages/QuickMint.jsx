import React, { useState, useCallback, useEffect } from 'react';
import { useAccount, useConnect, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { CONTRACTS, ARC_TESTNET, formatUSDC } from '../config/chains';

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

export function QuickMint() {
    // Use wagmi hooks - same as Header for consistent wallet state
    const { address: account, isConnected, connector } = useAccount();
    const { connectors, connectAsync } = useConnect();
    const { data: walletClient } = useWalletClient();

    // Connect wallet using wagmi - opens wallet modal
    const connect = async () => {
        // Find the first available connector (prioritize non-Injected for EIP-6963)
        const targetConnector = connectors.find(c => c.name !== 'Injected') || connectors[0];
        if (targetConnector) {
            try {
                await connectAsync({ connector: targetConnector, chainId: 5042002 });
            } catch (err) {
                console.error('Connect error:', err);
            }
        }
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

    // Load contract data
    useEffect(() => {
        loadContractData();
    }, [account]);

    const loadContractData = async () => {
        try {
            const rpcProvider = new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrl);
            const contract = new ethers.Contract(CONTRACTS.QUICKMINT, QUICKMINT_ABI, rpcProvider);

            const price = await contract.mintPrice();
            setMintPrice(formatUSDC(price));

            const minted = await contract.totalMinted();
            setTotalMinted(Number(minted));

            if (account) {
                await loadUserNFTs(contract);
            }
        } catch (err) {
            console.error('Error loading contract data:', err);
        }
    };

    const loadUserNFTs = async (contract) => {
        try {
            const tokenIds = await contract.tokensOfOwner(account);
            const nfts = [];

            for (const tokenId of tokenIds) {
                try {
                    const [nftName, desc, img, creator, mintedAt] = await contract.getTokenMetadata(tokenId);
                    nfts.push({
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

            setUserNFTs(nfts.reverse());
        } catch (err) {
            console.error('Error loading user NFTs:', err);
        }
    };

    // Pinata JWT for IPFS uploads
    const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJiZGQzNDE4ZS1lMTE3LTRmYTYtYTY2My05YWViZGY5M2YwZmUiLCJlbWFpbCI6Im11aGVtbWVkY2VkMjlAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjdjZDg0NjAyMGVkMzBiNjFiM2M5Iiwic2NvcGVkS2V5U2VjcmV0IjoiNDUyZjk4NmU5YmZmNTRmYWRlMThiNGI0MTNjNTQwZjkyY2U4MTkzMzhmNDFjZDE5YjE5NWEzM2JhZDMyN2VmOSIsImV4cCI6MTc5OTE4NTQzOH0.Tnug_vkfdzfnFhT_DglNKM_GEai9mpJRX4Lb4Dyve9A';

    // Upload to Pinata IPFS - Full quality images!
    const uploadToIPFS = async (file) => {
        console.log('📤 Uploading to Pinata IPFS...');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const metadata = JSON.stringify({
                name: `ArcGenesis-${Date.now()}`
            });
            formData.append('pinataMetadata', metadata);

            const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${PINATA_JWT}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Pinata upload failed: ${response.status}`);
            }

            const result = await response.json();
            const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
            console.log('✅ IPFS URL:', ipfsUrl);
            return ipfsUrl;

        } catch (err) {
            console.error('IPFS upload error:', err);
            // DON'T use base64 fallback - it causes gas explosion!
            // Throw error instead so user knows to retry
            throw new Error('Image upload failed. Please try again. If the problem persists, try a smaller image.');
        }
    };

    // Fallback base64 for when IPFS is unavailable
    const createBase64Fallback = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxSize = 128;
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
                    resolve(canvas.toDataURL('image/jpeg', 0.65));
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

            // Upload to IPFS (or create thumbnail)
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
            // Use wagmi's wallet client to get the provider from the CONNECTED wallet
            if (!walletClient) {
                throw new Error('Wallet not connected. Please connect your wallet first.');
            }

            // Get provider from the connected wallet client (works with MetaMask, Rainbow, etc.)
            const provider = await connector.getProvider();
            const browserProvider = new ethers.BrowserProvider(provider);

            // CRITICAL: Check if user is on the correct network (Arc Testnet)
            const network = await browserProvider.getNetwork();
            const currentChainId = Number(network.chainId);
            console.log('Current Chain ID:', currentChainId);

            if (currentChainId !== 5042002) {
                throw new Error('Wrong network! Please switch to Arc Testnet (Chain ID: 5042002) in your wallet.');
            }

            const freshSigner = await browserProvider.getSigner();
            const signerAddress = await freshSigner.getAddress();

            console.log('=== MINT DEBUG ===');
            console.log('Signer:', signerAddress);
            console.log('Contract:', CONTRACTS.QUICKMINT);
            console.log('Name:', name.trim());
            console.log('Description:', description.trim() || 'Minted on ArcGenesis');
            console.log('Image URL length:', imageUrl.length);

            // Create contract with signer
            const contract = new ethers.Contract(CONTRACTS.QUICKMINT, QUICKMINT_ABI, freshSigner);

            // Get mint price
            const price = await contract.mintPrice();
            console.log('Price:', price.toString());

            // Get gas settings
            const feeData = await browserProvider.getFeeData();
            const gasPrice = ((feeData.gasPrice || 160000000000n) * 150n) / 100n;
            console.log('Gas price:', gasPrice.toString());

            // Call mint directly on contract
            console.log('Calling contract.mint()...');

            const tx = await contract.mint(
                name.trim(),
                description.trim() || 'Minted on ArcGenesis',
                imageUrl,
                {
                    value: price,
                    gasLimit: 500000, // IPFS URL is small, needs less gas
                    gasPrice: gasPrice
                }
            );

            console.log('TX sent:', tx.hash);
            setSuccess('Transaction sent! Confirming...');

            // Simple wait - no timeout complexity
            const receipt = await tx.wait();

            console.log('TX confirmed:', receipt);

            // Find token ID from events
            let tokenId = 'Unknown';
            if (receipt && receipt.logs) {
                for (const log of receipt.logs) {
                    try {
                        const parsed = contract.interface.parseLog(log);
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

            // Reload data
            await loadContractData();

        } catch (err) {
            console.error('Mint error:', err);
            setError(err.reason || err.message || 'Minting failed');
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
                            <div className="upload-status">Processing image...</div>
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
                                isUploading ? 'Processing...' :
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
                                            <img src={nft.image} alt={nft.name} />
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
