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

            // Check if contract still exists on-chain
            const code = await rpcProvider.getCode(CONTRACTS.QUICKMINT);
            if (!code || code === '0x') {
                console.error('⚠️ QuickMint contract not found! Testnet may have been reset.');
                setError('⚠️ Contract not found on Arc Testnet. The testnet may have been reset and the contract needs to be redeployed.');
                return;
            }

            const contract = new ethers.Contract(CONTRACTS.QUICKMINT, QUICKMINT_ABI, rpcProvider);

            const price = await contract.mintPrice();
            setMintPrice(formatUSDC(price));

            const minted = await contract.totalMinted();
            setTotalMinted(Number(minted));

            // Clear any previous errors since data loaded successfully
            setError('');

            if (account) {
                await loadUserNFTs(contract);
            }
        } catch (err) {
            console.error('Error loading contract data:', err);
            if (err.code === 'CALL_EXCEPTION') {
                setError('⚠️ Cannot connect to QuickMint contract. The RPC might be down or the contract may need redeployment.');
            }
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
    const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJhZTBlZjA3NC0yN2NkLTQ3N2ItODY5OS1lNDE0YjEwNTNmMWIiLCJlbWFpbCI6ImNpaGF0dm9vbGthbjc0ODBAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjFjNmU4MDFiN2UzY2FiMDE1MDA3Iiwic2NvcGVkS2V5U2VjcmV0IjoiOThhYTAxYjljYzQyYzQ1YTFmMWIxMjUyNGMyMWI5NmY4MDQ5N2Q0NDM1Mjc1ZTAyNDY2MGRlMjJkY2M0NjFlMyIsImV4cCI6MTgwMDA4MTIwNn0.xPla8yo0qOnGzhCbCv9hwd5sQck755K3nlCLxOTSw1s';

    // Upload to Pinata IPFS
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
            // Fallback to small base64 if IPFS fails
            console.log('⚠️ Falling back to base64...');
            return createBase64Fallback(file);
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
            const walletProvider = await connector.getProvider();
            const browserProvider = new ethers.BrowserProvider(walletProvider);

            // === STEP 1: Check and switch to Arc Testnet ===
            console.log('=== MINT DEBUG ===');
            const network = await browserProvider.getNetwork();
            const currentChainId = Number(network.chainId);
            console.log('Current chain:', currentChainId, '| Required:', ARC_TESTNET.chainId);

            if (currentChainId !== ARC_TESTNET.chainId) {
                console.log('Wrong chain! Switching to Arc Testnet...');
                setSuccess('Switching to Arc Testnet...');
                try {
                    await walletProvider.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: ARC_TESTNET.chainIdHex }]
                    });
                } catch (switchError) {
                    // Chain not added yet, add it
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
                // Re-create provider after chain switch
                const freshBrowserProvider = new ethers.BrowserProvider(walletProvider);
                const freshSigner = await freshBrowserProvider.getSigner();
                const signerAddress = await freshSigner.getAddress();
                console.log('Switched! Signer:', signerAddress);
            }

            // Get fresh signer after potential chain switch
            const freshBrowserProvider = new ethers.BrowserProvider(walletProvider);
            const freshSigner = await freshBrowserProvider.getSigner();
            const signerAddress = await freshSigner.getAddress();
            console.log('Signer:', signerAddress);
            console.log('Contract:', CONTRACTS.QUICKMINT);

            // === STEP 2: Verify contract exists ===
            const rpcProvider = new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrl);
            const contractCode = await rpcProvider.getCode(CONTRACTS.QUICKMINT);
            console.log('Contract code length:', contractCode.length);

            if (!contractCode || contractCode === '0x') {
                throw new Error(
                    'QuickMint contract not found on Arc Testnet! ' +
                    'The testnet may have been reset. Contract needs to be redeployed. ' +
                    'Address: ' + CONTRACTS.QUICKMINT
                );
            }

            // === STEP 3: Get mint price using RPC provider (more reliable) ===
            const rpcContract = new ethers.Contract(CONTRACTS.QUICKMINT, QUICKMINT_ABI, rpcProvider);
            let price;
            try {
                price = await rpcContract.mintPrice();
                console.log('Price (from RPC):', price.toString());
            } catch (priceErr) {
                console.error('Failed to get price from RPC, trying browser provider...', priceErr);
                // Fallback to browser provider
                const signerContract = new ethers.Contract(CONTRACTS.QUICKMINT, QUICKMINT_ABI, freshSigner);
                price = await signerContract.mintPrice();
                console.log('Price (from browser):', price.toString());
            }

            console.log('Name:', name.trim());
            console.log('Description:', description.trim() || 'Minted on ArcGenesis');
            console.log('Image URL length:', imageUrl.length);

            // === STEP 4: Get gas settings ===
            let gasPrice;
            try {
                const feeData = await freshBrowserProvider.getFeeData();
                gasPrice = ((feeData.gasPrice || 160000000000n) * 150n) / 100n;
            } catch {
                // Fallback gas price
                gasPrice = 240000000000n;
            }
            console.log('Gas price:', gasPrice.toString());

            // === STEP 4.5: Check user balance ===
            const userBalance = await freshBrowserProvider.getBalance(signerAddress);
            console.log('User balance:', userBalance.toString(), '| Mint price:', price.toString());

            if (userBalance < price) {
                throw new Error(
                    `Insufficient balance! You have ${(Number(userBalance) / 1e6).toFixed(2)} USDC but need ${(Number(price) / 1e6).toFixed(2)} USDC. ` +
                    'Get testnet USDC from faucet.circle.com'
                );
            }

            // === STEP 5: Send mint via RAW TRANSACTION (bypass ethers contract layer) ===
            // Arc Testnet RPC is incompatible with ethers.js contract calls ("could not coalesce")
            // So we encode the function call manually and send as raw transaction
            console.log('Encoding mint function call manually...');
            setSuccess('Please confirm the transaction in your wallet...');

            const iface = new ethers.Interface(QUICKMINT_ABI);
            const mintData = iface.encodeFunctionData('mint', [
                name.trim(),
                description.trim() || 'Minted on ArcGenesis',
                imageUrl
            ]);
            console.log('Encoded data length:', mintData.length);

            const tx = await freshSigner.sendTransaction({
                to: CONTRACTS.QUICKMINT,
                data: mintData,
                value: price,
                gasLimit: 500000n,
                gasPrice: gasPrice
            });

            console.log('TX sent:', tx.hash);
            setSuccess(`Transaction sent! Confirming... TX: ${tx.hash.slice(0, 10)}...`);

            // Wait for confirmation
            const receipt = await tx.wait();
            console.log('TX confirmed:', receipt);

            // Find token ID from events
            let tokenId = 'Unknown';
            if (receipt && receipt.logs) {
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

            // Reload data
            await loadContractData();

        } catch (err) {
            console.error('Mint error:', err);
            console.error('Error code:', err.code);
            console.error('Error reason:', err.reason);
            console.error('Error message:', err.message);

            // Provide user-friendly error messages
            let errorMsg = 'Minting failed';
            const errMsg = (err.message || '').toLowerCase();

            if (errMsg.includes('insufficient balance') || errMsg.includes('insufficient usdc')) {
                errorMsg = err.message;
            } else if (errMsg.includes('could not coalesce')) {
                errorMsg = '❌ Transaction would revert! Most likely causes:\n' +
                    '• Insufficient USDC balance — get from faucet.circle.com\n' +
                    '• Transaction gas issue — try refreshing the page';
            } else if (err.code === 'CALL_EXCEPTION') {
                errorMsg = '❌ Contract call failed! Possible causes:\n' +
                    '• Wallet is on wrong network (switch to Arc Testnet)\n' +
                    '• Contract may need redeployment\n' +
                    '• Insufficient USDC balance';
            } else if (err.code === 'ACTION_REJECTED' || err.code === 4001) {
                errorMsg = 'Transaction cancelled by user.';
            } else if (err.code === 'INSUFFICIENT_FUNDS') {
                errorMsg = 'Insufficient funds! Get testnet USDC from faucet.circle.com';
            } else if (err.message?.includes('not found')) {
                errorMsg = err.message;
            } else if (err.message?.includes('Transaction would fail')) {
                errorMsg = err.message;
            } else {
                errorMsg = err.reason || err.shortMessage || err.message || 'Unknown error occurred';
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
