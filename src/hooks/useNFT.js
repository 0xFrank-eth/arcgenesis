import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { NFT_COLLECTION_ABI, ERC20_ABI, CONTRACTS, isContractDeployed } from '../config/chains';

/**
 * Mint phase constants
 */
export const MINT_PHASE = {
    NOT_STARTED: 'NOT_STARTED',
    WHITELIST: 'WHITELIST',
    BETWEEN_PHASES: 'BETWEEN_PHASES',
    PUBLIC: 'PUBLIC',
    ENDED: 'ENDED'
};

/**
 * Hook for interacting with an NFT Collection contract
 * Supports whitelist and public minting with phase controls
 */
export function useNFT(collectionAddress, signer, provider) {
    const [collection, setCollection] = useState(null);
    const [collectionInfo, setCollectionInfo] = useState(null);
    const [mintPhase, setMintPhase] = useState(null);
    const [userNFTs, setUserNFTs] = useState([]);
    const [userMintCount, setUserMintCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isMinting, setIsMinting] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [error, setError] = useState(null);
    const [txHash, setTxHash] = useState(null);

    /**
     * Initialize contract instance
     */
    useEffect(() => {
        if (collectionAddress && provider && isContractDeployed(collectionAddress)) {
            const contract = new ethers.Contract(
                collectionAddress,
                NFT_COLLECTION_ABI,
                provider
            );
            setCollection(contract);
        } else {
            setCollection(null);
        }
    }, [collectionAddress, provider]);

    /**
     * Determine current mint phase based on timestamps
     */
    const calculateMintPhase = useCallback((info) => {
        const now = Math.floor(Date.now() / 1000);

        if (now < info.whitelistStartTime) {
            return {
                phase: MINT_PHASE.NOT_STARTED,
                nextPhaseTime: info.whitelistStartTime,
                currentPrice: info.whitelistMintPriceRaw,
                currentPriceFormatted: info.whitelistMintPrice
            };
        }

        if (now >= info.whitelistStartTime && now <= info.whitelistEndTime) {
            return {
                phase: MINT_PHASE.WHITELIST,
                nextPhaseTime: info.whitelistEndTime,
                currentPrice: info.whitelistMintPriceRaw,
                currentPriceFormatted: info.whitelistMintPrice
            };
        }

        if (now > info.whitelistEndTime && now < info.publicStartTime) {
            return {
                phase: MINT_PHASE.BETWEEN_PHASES,
                nextPhaseTime: info.publicStartTime,
                currentPrice: info.publicMintPriceRaw,
                currentPriceFormatted: info.publicMintPrice
            };
        }

        if (now >= info.publicStartTime && now <= info.publicEndTime) {
            return {
                phase: MINT_PHASE.PUBLIC,
                nextPhaseTime: info.publicEndTime,
                currentPrice: info.publicMintPriceRaw,
                currentPriceFormatted: info.publicMintPrice
            };
        }

        return {
            phase: MINT_PHASE.ENDED,
            nextPhaseTime: null,
            currentPrice: info.publicMintPriceRaw,
            currentPriceFormatted: info.publicMintPrice
        };
    }, []);

    /**
     * Fetch collection info including prices and phase times
     */
    const fetchCollectionInfo = useCallback(async () => {
        if (!collection) return;

        try {
            setIsLoading(true);
            setError(null);

            const [
                name,
                symbol,
                maxSupply,
                whitelistMintPrice,
                publicMintPrice,
                totalMinted,
                remainingSupply,
                whitelistStartTime,
                whitelistEndTime,
                publicStartTime,
                publicEndTime,
                maxMintsPerWallet,
                merkleRoot,
                paused
            ] = await Promise.all([
                collection.name(),
                collection.symbol(),
                collection.maxSupply(),
                collection.whitelistMintPrice(),
                collection.publicMintPrice(),
                collection.totalMinted(),
                collection.remainingSupply(),
                collection.whitelistStartTime(),
                collection.whitelistEndTime(),
                collection.publicStartTime(),
                collection.publicEndTime(),
                collection.maxMintsPerWallet(),
                collection.merkleRoot(),
                collection.paused()
            ]);

            const info = {
                name,
                symbol,
                maxSupply: Number(maxSupply),
                whitelistMintPrice: ethers.formatUnits(whitelistMintPrice, 6),
                whitelistMintPriceRaw: whitelistMintPrice,
                publicMintPrice: ethers.formatUnits(publicMintPrice, 6),
                publicMintPriceRaw: publicMintPrice,
                totalMinted: Number(totalMinted),
                remainingSupply: Number(remainingSupply),
                whitelistStartTime: Number(whitelistStartTime),
                whitelistEndTime: Number(whitelistEndTime),
                publicStartTime: Number(publicStartTime),
                publicEndTime: Number(publicEndTime),
                maxMintsPerWallet: Number(maxMintsPerWallet),
                merkleRoot,
                paused,
                hasWhitelist: merkleRoot !== ethers.ZeroHash
            };

            setCollectionInfo(info);
            setMintPhase(calculateMintPhase(info));
        } catch (err) {
            console.error('Failed to fetch collection info:', err);
            setError('Failed to load collection: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    }, [collection, calculateMintPhase]);

    /**
     * Fetch user's mint count and NFTs
     */
    const fetchUserData = useCallback(async (userAddress) => {
        if (!collection || !userAddress) return;

        try {
            const [mintCount, tokenIds] = await Promise.all([
                collection.mintCount(userAddress),
                collection.tokensOfOwner(userAddress).catch(() => [])
            ]);

            setUserMintCount(Number(mintCount));

            const nfts = await Promise.all(
                tokenIds.map(async (tokenId) => {
                    try {
                        const uri = await collection.tokenURI(tokenId);
                        return {
                            tokenId: Number(tokenId),
                            tokenURI: uri
                        };
                    } catch {
                        return {
                            tokenId: Number(tokenId),
                            tokenURI: ''
                        };
                    }
                })
            );

            setUserNFTs(nfts);
        } catch (err) {
            console.error('Failed to fetch user data:', err);
        }
    }, [collection]);

    /**
     * Check USDC allowance for collection contract
     */
    const checkAllowance = useCallback(async (userAddress) => {
        if (!provider || !userAddress || !collectionAddress) return BigInt(0);
        if (!isContractDeployed(CONTRACTS.USDC)) return BigInt(0);

        try {
            const usdc = new ethers.Contract(CONTRACTS.USDC, ERC20_ABI, provider);
            const allowance = await usdc.allowance(userAddress, collectionAddress);
            return allowance;
        } catch (err) {
            console.error('Failed to check allowance:', err);
            return BigInt(0);
        }
    }, [provider, collectionAddress]);

    /**
     * Approve USDC spending for minting
     */
    const approveUSDC = useCallback(async (amount) => {
        if (!signer) {
            setError('Please connect your wallet');
            return false;
        }

        if (!isContractDeployed(CONTRACTS.USDC)) {
            setError('USDC contract not configured');
            return false;
        }

        try {
            setIsApproving(true);
            setError(null);

            const usdc = new ethers.Contract(CONTRACTS.USDC, ERC20_ABI, signer);
            const tx = await usdc.approve(collectionAddress, amount);
            setTxHash(tx.hash);

            await tx.wait();
            return true;
        } catch (err) {
            console.error('Approval failed:', err);
            setError('Approval failed: ' + (err.reason || err.message));
            return false;
        } finally {
            setIsApproving(false);
        }
    }, [signer, collectionAddress]);

    /**
     * Mint NFTs during public phase
     * @param {number} amount Number of NFTs to mint (1-20)
     */
    const publicMint = useCallback(async (amount) => {
        if (!signer || !collection) {
            setError('Please connect your wallet');
            return null;
        }

        if (!collectionInfo) {
            setError('Collection info not loaded');
            return null;
        }

        if (mintPhase?.phase !== MINT_PHASE.PUBLIC) {
            setError('Public mint is not active');
            return null;
        }

        try {
            setIsMinting(true);
            setError(null);

            const userAddress = await signer.getAddress();
            const totalCost = collectionInfo.publicMintPriceRaw * BigInt(amount);

            // For Arc Network, payment is in native USDC (msg.value)
            const collectionWithSigner = collection.connect(signer);
            const tx = await collectionWithSigner.publicMint(amount, { value: totalCost });
            setTxHash(tx.hash);

            const receipt = await tx.wait();

            // Extract minted token IDs from event
            const mintEvent = receipt.logs.find(log => {
                try {
                    const parsed = collection.interface.parseLog(log);
                    return parsed?.name === 'PublicMinted';
                } catch {
                    return false;
                }
            });

            let startTokenId = null;
            if (mintEvent) {
                const parsed = collection.interface.parseLog(mintEvent);
                startTokenId = Number(parsed.args.tokenId);
            }

            // Refresh data
            await Promise.all([
                fetchCollectionInfo(),
                fetchUserData(userAddress)
            ]);

            return { startTokenId, amount, txHash: receipt.hash };
        } catch (err) {
            console.error('Public minting failed:', err);
            setError('Minting failed: ' + (err.reason || err.message));
            return null;
        } finally {
            setIsMinting(false);
        }
    }, [signer, collection, collectionInfo, mintPhase, fetchCollectionInfo, fetchUserData]);

    /**
     * Mint NFTs during whitelist phase with Merkle proof
     * @param {string[]} proof Merkle proof array
     * @param {number} amount Number of NFTs to mint (1-20)
     */
    const whitelistMint = useCallback(async (proof, amount) => {
        if (!signer || !collection) {
            setError('Please connect your wallet');
            return null;
        }

        if (!collectionInfo) {
            setError('Collection info not loaded');
            return null;
        }

        if (mintPhase?.phase !== MINT_PHASE.WHITELIST) {
            setError('Whitelist mint is not active');
            return null;
        }

        if (!proof || proof.length === 0) {
            setError('Invalid whitelist proof - you may not be whitelisted');
            return null;
        }

        try {
            setIsMinting(true);
            setError(null);

            const userAddress = await signer.getAddress();
            const totalCost = collectionInfo.whitelistMintPriceRaw * BigInt(amount);

            // For Arc Network, payment is in native USDC (msg.value)
            const collectionWithSigner = collection.connect(signer);
            const tx = await collectionWithSigner.whitelistMint(proof, amount, { value: totalCost });
            setTxHash(tx.hash);

            const receipt = await tx.wait();

            // Extract minted token IDs from event
            const mintEvent = receipt.logs.find(log => {
                try {
                    const parsed = collection.interface.parseLog(log);
                    return parsed?.name === 'WhitelistMinted';
                } catch {
                    return false;
                }
            });

            let startTokenId = null;
            if (mintEvent) {
                const parsed = collection.interface.parseLog(mintEvent);
                startTokenId = Number(parsed.args.tokenId);
            }

            // Refresh data
            await Promise.all([
                fetchCollectionInfo(),
                fetchUserData(userAddress)
            ]);

            return { startTokenId, amount, txHash: receipt.hash };
        } catch (err) {
            console.error('Whitelist minting failed:', err);

            // Handle specific error cases
            if (err.message?.includes('InvalidMerkleProof')) {
                setError('Your address is not on the whitelist');
            } else if (err.message?.includes('MintLimitExceeded')) {
                setError('You have reached the maximum mint limit');
            } else {
                setError('Minting failed: ' + (err.reason || err.message));
            }
            return null;
        } finally {
            setIsMinting(false);
        }
    }, [signer, collection, collectionInfo, mintPhase, fetchCollectionInfo, fetchUserData]);

    /**
     * Get remaining mints for user
     */
    const getRemainingMints = useCallback(() => {
        if (!collectionInfo) return 0;
        return Math.max(0, collectionInfo.maxMintsPerWallet - userMintCount);
    }, [collectionInfo, userMintCount]);

    /**
     * Check if user can mint
     */
    const canMint = useCallback(() => {
        if (!collectionInfo || !mintPhase) return false;
        if (collectionInfo.paused) return false;
        if (collectionInfo.remainingSupply === 0) return false;
        if (getRemainingMints() === 0) return false;

        return mintPhase.phase === MINT_PHASE.WHITELIST || mintPhase.phase === MINT_PHASE.PUBLIC;
    }, [collectionInfo, mintPhase, getRemainingMints]);

    /**
     * Initialize data on mount
     */
    useEffect(() => {
        if (collection) {
            fetchCollectionInfo();
        }
    }, [collection, fetchCollectionInfo]);

    /**
     * Update mint phase periodically
     */
    useEffect(() => {
        if (!collectionInfo) return;

        const interval = setInterval(() => {
            setMintPhase(calculateMintPhase(collectionInfo));
        }, 1000);

        return () => clearInterval(interval);
    }, [collectionInfo, calculateMintPhase]);

    return {
        // State
        collectionInfo,
        mintPhase,
        userNFTs,
        userMintCount,
        isLoading,
        isMinting,
        isApproving,
        error,
        txHash,

        // Actions
        fetchCollectionInfo,
        fetchUserData,
        publicMint,
        whitelistMint,
        approveUSDC,
        checkAllowance,

        // Utilities
        canMint,
        getRemainingMints,
        MINT_PHASE
    };
}
