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
    rpcUrl: 'https://arc-testnet.drpc.org',
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
