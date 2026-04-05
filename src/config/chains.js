import { ethers } from 'ethers';

// Arc Testnet Configuration
export const ARC_TESTNET = {
    chainId: 5042002,
    chainIdHex: '0x4CEF52',
    name: 'Arc Testnet',
    currency: {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6
    },
    rpcUrl: 'https://rpc.testnet.arc.network',
    rpcUrls: [
        'https://rpc.testnet.arc.network',
        'https://arc-testnet.drpc.org'
    ],
    blockExplorer: 'https://testnet.arcscan.app',
    faucet: 'https://faucet.circle.com'
};

// Contract Addresses
export const CONTRACTS = {
    LAUNCHPAD: '0xD70dB0a89912503239f230935E7F3727f4a1E997',
    USDC: '0x65e416b8069021124841d308c0f8ef844ba18ead',
    SAMPLE_COLLECTION: '',
    QUICKMINT: '0xb77C54Bf3868018e980cE70A78F1EAd74161ad6F'
};

export const isContractDeployed = (address) => {
    return address && address !== '' && address !== '0x0000000000000000000000000000000000000000';
};

export const isLaunchpadReady = () => isContractDeployed(CONTRACTS.LAUNCHPAD);
export const isUSDCReady = () => isContractDeployed(CONTRACTS.USDC);

export const LAUNCHPAD_ABI = [
    "function createCollection(string memory _name, string memory _symbol, uint256 _maxSupply, uint256 _whitelistMintPrice, uint256 _publicMintPrice, string memory _baseTokenURI, uint96 _royaltyFeePercent, uint256 _maxMintsPerWallet) external returns (address)",
    "function getCollectionCount() external view returns (uint256)",
    "function getAllCollections() external view returns (tuple(address contractAddress, string name, string symbol, uint256 maxSupply, uint256 whitelistMintPrice, uint256 publicMintPrice, address creator, uint256 createdAt)[])",
    "event CollectionCreated(uint256 indexed collectionId, address indexed contractAddress, string name, address indexed creator, uint256 whitelistMintPrice, uint256 publicMintPrice)"
];

export const NFT_COLLECTION_ABI = [
    "function publicMint(uint256 amount) external payable",
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "function maxSupply() external view returns (uint256)",
    "function totalMinted() external view returns (uint256)",
    "function publicMintPrice() external view returns (uint256)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function tokenURI(uint256 tokenId) external view returns (string)"
];

export const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)"
];

export const formatUSDC = (amount) => {
    if (!amount) return '0';
    return (Number(amount) / 1e6).toFixed(2);
};

export const parseUSDC = (amount) => {
    return BigInt(Math.floor(Number(amount) * 1e6));
};

export const getExplorerLink = (address, type = 'address') => {
    return `${ARC_TESTNET.blockExplorer}/${type}/${address}`;
};

export const getTxLink = (txHash) => {
    return `${ARC_TESTNET.blockExplorer}/tx/${txHash}`;
};

/**
 * Create a provider that falls back through multiple RPC URLs.
 * Tries each RPC in sequence; returns the first one that responds.
 */
export const createFallbackProvider = async () => {
    for (const rpcUrl of ARC_TESTNET.rpcUrls) {
        try {
            const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
                staticNetwork: true,
                batchMaxCount: 1
            });
            // Quick health check - 3s timeout
            const blockPromise = provider.getBlockNumber();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('RPC timeout')), 3000)
            );
            await Promise.race([blockPromise, timeoutPromise]);
            console.log(`✅ RPC connected: ${rpcUrl}`);
            return provider;
        } catch (err) {
            console.warn(`⚠️ RPC failed: ${rpcUrl}`, err.message);
        }
    }
    // Last resort — return provider for first URL without health check
    console.warn('⚠️ All RPC health checks failed, using primary URL anyway');
    return new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrls[0]);
};

/**
 * Retry a contract call with fallback RPC providers.
 * @param {Function} fn - async function that takes a provider and returns a result
 * @param {number} maxRetries - max retry attempts per RPC
 */
export const retryContractCall = async (fn, maxRetries = 2) => {
    let lastError;
    for (const rpcUrl of ARC_TESTNET.rpcUrls) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
                    staticNetwork: true
                });
                const result = await Promise.race([
                    fn(provider),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Call timeout')), 8000)
                    )
                ]);
                return result;
            } catch (err) {
                lastError = err;
                console.warn(`RPC call failed (${rpcUrl}, attempt ${attempt + 1}):`, err.message);
                // Wait before retry with backoff
                if (attempt < maxRetries - 1) {
                    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                }
            }
        }
    }
    throw lastError;
};
