import { useState, useCallback, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { CONTRACTS, LAUNCHPAD_ABI, NFT_COLLECTION_ABI, isLaunchpadReady, ARC_TESTNET } from '../config/chains';

/**
 * Hook for interacting with the LaunchpadFactory contract
 * Supports creating collections with whitelist/public prices
 */
export function useLaunchpad(signer, provider) {
    const [collections, setCollections] = useState([]);
    const [userCollections, setUserCollections] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState(null);
    const [txHash, setTxHash] = useState(null);

    // Public provider fallback for read operations when wallet not connected
    const publicProvider = useMemo(() => {
        return new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrl, ARC_TESTNET.chainId, {
            staticNetwork: true,
            batchMaxCount: 1
        });
    }, []);

    // Use wallet provider if available, otherwise use public provider
    const readProvider = provider || publicProvider;

    /**
     * Get launchpad contract instance
     */
    const getLaunchpadContract = useCallback((signerOrProvider) => {
        if (!signerOrProvider) {
            return null;
        }
        if (!isLaunchpadReady()) {
            console.warn('Launchpad contract address not configured');
            return null;
        }
        return new ethers.Contract(CONTRACTS.LAUNCHPAD, LAUNCHPAD_ABI, signerOrProvider);
    }, []);

    /**
     * Fetch all collections from the factory
     */
    const fetchAllCollections = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const contract = getLaunchpadContract(readProvider);
            if (!contract) {
                setError('Launchpad contract not deployed yet');
                setCollections([]);
                return;
            }

            const allCollections = await contract.getAllCollections();

            // Enrich with on-chain data from each collection
            const enrichedCollections = await Promise.all(
                allCollections.map(async (col, index) => {
                    try {
                        const nftContract = new ethers.Contract(col.contractAddress, NFT_COLLECTION_ABI, readProvider);

                        const [totalMinted, remainingSupply, isWhitelistActive, isPublicActive, baseTokenURI] = await Promise.all([
                            nftContract.totalMinted(),
                            nftContract.remainingSupply(),
                            nftContract.isWhitelistActive(),
                            nftContract.isPublicActive(),
                            nftContract.baseTokenURI()
                        ]);

                        // Extract image URL from baseTokenURI metadata
                        let imageUrl = null;
                        if (baseTokenURI && baseTokenURI.startsWith('ipfs://')) {
                            const metadataCID = baseTokenURI.replace('ipfs://', '').replace(/\/$/, '');
                            const metadataUrl = `https://ipfs.io/ipfs/${metadataCID}`;

                            try {
                                const response = await fetch(metadataUrl);
                                if (response.ok) {
                                    const metadata = await response.json();
                                    if (metadata.image) {
                                        imageUrl = metadata.image.startsWith('ipfs://')
                                            ? `https://ipfs.io/ipfs/${metadata.image.replace('ipfs://', '')}`
                                            : metadata.image;
                                    }
                                }
                            } catch (metaErr) {
                                console.warn('Could not fetch collection metadata for image:', metaErr);
                            }
                        }

                        return {
                            id: index,
                            contractAddress: col.contractAddress,
                            name: col.name,
                            symbol: col.symbol,
                            maxSupply: Number(col.maxSupply || 0),
                            whitelistMintPrice: col.whitelistMintPrice ? ethers.formatUnits(col.whitelistMintPrice, 6) : '0',
                            whitelistMintPriceRaw: col.whitelistMintPrice || BigInt(0),
                            publicMintPrice: col.publicMintPrice ? ethers.formatUnits(col.publicMintPrice, 6) : '0',
                            publicMintPriceRaw: col.publicMintPrice || BigInt(0),
                            creator: col.creator,
                            createdAt: Number(col.createdAt),
                            totalMinted: Number(totalMinted),
                            remainingSupply: Number(remainingSupply),
                            isWhitelistActive,
                            isPublicActive,
                            baseTokenURI,
                            imageUrl
                        };
                    } catch (err) {
                        console.error('Error fetching collection data:', err);
                        return {
                            id: index,
                            contractAddress: col.contractAddress,
                            name: col.name,
                            symbol: col.symbol,
                            maxSupply: Number(col.maxSupply || 0),
                            whitelistMintPrice: col.whitelistMintPrice ? ethers.formatUnits(col.whitelistMintPrice, 6) : '0',
                            whitelistMintPriceRaw: col.whitelistMintPrice || BigInt(0),
                            publicMintPrice: col.publicMintPrice ? ethers.formatUnits(col.publicMintPrice, 6) : '0',
                            publicMintPriceRaw: col.publicMintPrice || BigInt(0),
                            creator: col.creator,
                            createdAt: Number(col.createdAt),
                            totalMinted: 0,
                            remainingSupply: Number(col.maxSupply),
                            isWhitelistActive: false,
                            isPublicActive: false,
                            imageUrl: null
                        };
                    }
                })
            );

            setCollections(enrichedCollections);
        } catch (err) {
            console.error('Error fetching collections:', err);

            // Handle specific error cases
            if (err.code === 'BAD_DATA' || err.message.includes('could not decode result data')) {
                // This happens when contract is not deployed or returns empty data
                console.log('Contract may not be deployed or has no collections yet');
                setError(null); // Don't show error for this case
                setCollections([]);
            } else if (err.message.includes('network')) {
                setError('Network error - please check your connection');
                setCollections([]);
            } else {
                setError('Failed to fetch collections: ' + err.message);
                setCollections([]);
            }
        } finally {
            setIsLoading(false);
        }
    }, [readProvider, getLaunchpadContract]);

    // Auto-fetch collections on mount
    useEffect(() => {
        fetchAllCollections();
    }, []);

    /**
     * Fetch collections by creator address
     */
    const fetchUserCollections = useCallback(async (creatorAddress) => {
        if (!provider || !creatorAddress) return;

        setIsLoading(true);

        try {
            const contract = getLaunchpadContract(provider);
            if (!contract) {
                setUserCollections([]);
                return;
            }

            const collectionIds = await contract.getCollectionsByCreator(creatorAddress);

            const userCols = await Promise.all(
                collectionIds.map(async (id) => {
                    const col = await contract.getCollection(id);
                    const nftContract = new ethers.Contract(col.contractAddress, NFT_COLLECTION_ABI, readProvider);

                    const [totalMinted, remainingSupply, baseTokenURI] = await Promise.all([
                        nftContract.totalMinted(),
                        nftContract.remainingSupply(),
                        nftContract.baseTokenURI()
                    ]);

                    // Extract image URL from baseTokenURI metadata
                    let imageUrl = null;
                    if (baseTokenURI && baseTokenURI.startsWith('ipfs://')) {
                        const metadataCID = baseTokenURI.replace('ipfs://', '').replace(/\/$/, '');
                        const metadataUrl = `https://ipfs.io/ipfs/${metadataCID}`;

                        try {
                            const response = await fetch(metadataUrl);
                            if (response.ok) {
                                const metadata = await response.json();
                                if (metadata.image) {
                                    imageUrl = metadata.image.startsWith('ipfs://')
                                        ? `https://ipfs.io/ipfs/${metadata.image.replace('ipfs://', '')}`
                                        : metadata.image;
                                }
                            }
                        } catch (metaErr) {
                            console.warn('Could not fetch collection metadata for image:', metaErr);
                        }
                    }

                    return {
                        id: Number(id),
                        contractAddress: col.contractAddress,
                        name: col.name,
                        symbol: col.symbol,
                        maxSupply: Number(col.maxSupply || 0),
                        whitelistMintPrice: col.whitelistMintPrice ? ethers.formatUnits(col.whitelistMintPrice, 6) : '0',
                        publicMintPrice: col.publicMintPrice ? ethers.formatUnits(col.publicMintPrice, 6) : '0',
                        mintPrice: col.publicMintPrice ? ethers.formatUnits(col.publicMintPrice, 6) : '0',
                        creator: col.creator,
                        createdAt: Number(col.createdAt || 0),
                        totalMinted: Number(totalMinted),
                        remainingSupply: Number(remainingSupply),
                        imageUrl
                    };
                })
            );

            setUserCollections(userCols);
        } catch (err) {
            console.error('Error fetching user collections:', err);
            setUserCollections([]);
        } finally {
            setIsLoading(false);
        }
    }, [provider, getLaunchpadContract]);

    /**
     * Create a new NFT collection
     * @param {Object} params Collection parameters
     * @param {string} params.name Collection name
     * @param {string} params.symbol Collection symbol
     * @param {number} params.maxSupply Maximum supply
     * @param {string} params.whitelistMintPrice Whitelist price in USDC
     * @param {string} params.publicMintPrice Public price in USDC
     * @param {string} params.baseTokenURI IPFS base URI
     * @param {number} params.royaltyFeePercent Royalty in basis points (e.g., 500 = 5%)
     * @param {number} params.maxMintsPerWallet Max mints per wallet
     */
    const createCollection = useCallback(async ({
        name,
        symbol,
        maxSupply,
        whitelistMintPrice,
        publicMintPrice,
        baseTokenURI,
        royaltyFeePercent = 500,
        maxMintsPerWallet = 5
    }) => {
        if (!signer) {
            setError('Please connect your wallet');
            return null;
        }

        setIsCreating(true);
        setError(null);
        setTxHash(null);

        try {
            const contract = getLaunchpadContract(signer);
            if (!contract) {
                setError('Launchpad contract not deployed');
                return null;
            }

            // Convert prices to USDC wei (6 decimals) with null checks
            const whitelistPriceWei = ethers.parseUnits((whitelistMintPrice || '0').toString(), 6);
            const publicPriceWei = ethers.parseUnits((publicMintPrice || '0').toString(), 6);

            console.log('Creating collection with params:', {
                name,
                symbol,
                maxSupply,
                whitelistPriceWei: whitelistPriceWei.toString(),
                publicPriceWei: publicPriceWei.toString(),
                baseTokenURI,
                royaltyFeePercent,
                maxMintsPerWallet
            });

            const tx = await contract.createCollection(
                name,
                symbol,
                maxSupply,
                whitelistPriceWei,
                publicPriceWei,
                baseTokenURI,
                royaltyFeePercent,
                maxMintsPerWallet
            );

            setTxHash(tx.hash);
            console.log('Transaction submitted:', tx.hash);

            const receipt = await tx.wait();
            console.log('Transaction confirmed:', receipt);

            // Extract collection address from event
            const event = receipt.logs.find(log => {
                try {
                    const parsed = contract.interface.parseLog(log);
                    return parsed?.name === 'CollectionCreated';
                } catch {
                    return false;
                }
            });

            if (event) {
                const parsed = contract.interface.parseLog(event);
                const collectionAddress = parsed.args.contractAddress;
                console.log('Collection created at:', collectionAddress);
                return collectionAddress;
            }

            return null;
        } catch (err) {
            console.error('Error creating collection:', err);
            setError(err.reason || err.message || 'Failed to create collection');
            return null;
        } finally {
            setIsCreating(false);
        }
    }, [signer, getLaunchpadContract]);

    /**
     * Get single collection details by ID
     */
    const getCollectionDetails = useCallback(async (collectionId) => {
        if (!readProvider) return null;

        try {
            const contract = getLaunchpadContract(readProvider);
            if (!contract) {
                return null;
            }

            const col = await contract.getCollection(collectionId);
            const nftContract = new ethers.Contract(col.contractAddress, NFT_COLLECTION_ABI, readProvider);

            const [
                totalMinted,
                remainingSupply,
                isWhitelistActive,
                isPublicActive,
                whitelistStartTime,
                whitelistEndTime,
                publicStartTime,
                publicEndTime,
                maxMintsPerWallet,
                merkleRoot,
                paused
            ] = await Promise.all([
                nftContract.totalMinted(),
                nftContract.remainingSupply(),
                nftContract.isWhitelistActive(),
                nftContract.isPublicActive(),
                nftContract.whitelistStartTime(),
                nftContract.whitelistEndTime(),
                nftContract.publicStartTime(),
                nftContract.publicEndTime(),
                nftContract.maxMintsPerWallet(),
                nftContract.merkleRoot(),
                nftContract.paused()
            ]);

            return {
                id: collectionId,
                contractAddress: col.contractAddress,
                name: col.name,
                symbol: col.symbol,
                maxSupply: Number(col.maxSupply),
                whitelistMintPrice: ethers.formatUnits(col.whitelistMintPrice, 6),
                whitelistMintPriceRaw: col.whitelistMintPrice,
                publicMintPrice: ethers.formatUnits(col.publicMintPrice, 6),
                publicMintPriceRaw: col.publicMintPrice,
                creator: col.creator,
                createdAt: Number(col.createdAt),
                totalMinted: Number(totalMinted),
                remainingSupply: Number(remainingSupply),
                isWhitelistActive,
                isPublicActive,
                whitelistStartTime: Number(whitelistStartTime),
                whitelistEndTime: Number(whitelistEndTime),
                publicStartTime: Number(publicStartTime),
                publicEndTime: Number(publicEndTime),
                maxMintsPerWallet: Number(maxMintsPerWallet),
                merkleRoot,
                paused
            };
        } catch (err) {
            console.error('Error fetching collection details:', err);
            return null;
        }
    }, [readProvider, getLaunchpadContract]);

    /**
     * Check if collection address is valid (deployed by factory)
     */
    const isValidCollection = useCallback(async (collectionAddress) => {
        if (!readProvider) return false;

        try {
            const contract = getLaunchpadContract(readProvider);
            if (!contract) return false;

            return await contract.isCollection(collectionAddress);
        } catch {
            return false;
        }
    }, [readProvider, getLaunchpadContract]);

    /**
     * Get collection details by contract address
     */
    const getCollectionByAddress = useCallback(async (contractAddress) => {
        if (!contractAddress) return null;

        try {
            const nftContract = new ethers.Contract(contractAddress, NFT_COLLECTION_ABI, readProvider);

            const [
                name,
                symbol,
                maxSupply,
                whitelistMintPrice,
                publicMintPrice,
                owner,
                totalMinted,
                remainingSupply,
                isWhitelistActive,
                isPublicActive,
                paused,
                baseTokenURI
            ] = await Promise.all([
                nftContract.name(),
                nftContract.symbol(),
                nftContract.maxSupply(),
                nftContract.whitelistMintPrice(),
                nftContract.publicMintPrice(),
                nftContract.owner(),
                nftContract.totalMinted(),
                nftContract.remainingSupply(),
                nftContract.isWhitelistActive(),
                nftContract.isPublicActive(),
                nftContract.paused(),
                nftContract.baseTokenURI()
            ]);

            // Extract image URL from baseTokenURI metadata
            // The baseTokenURI points to metadata JSON that contains an 'image' field
            let imageUrl = null;
            if (baseTokenURI && baseTokenURI.startsWith('ipfs://')) {
                // baseTokenURI is like ipfs://CID/ - the metadata is at this location
                // Remove trailing slash and convert to HTTP gateway URL
                const metadataCID = baseTokenURI.replace('ipfs://', '').replace(/\/$/, '');
                const metadataUrl = `https://ipfs.io/ipfs/${metadataCID}`;

                try {
                    // Fetch metadata JSON to get the actual image URL
                    const response = await fetch(metadataUrl);
                    if (response.ok) {
                        const metadata = await response.json();
                        if (metadata.image) {
                            // Convert ipfs:// to https gateway URL
                            imageUrl = metadata.image.startsWith('ipfs://')
                                ? `https://ipfs.io/ipfs/${metadata.image.replace('ipfs://', '')}`
                                : metadata.image;
                        }
                    }
                } catch (metaErr) {
                    console.warn('Could not fetch collection metadata for image:', metaErr);
                }
            }

            return {
                contractAddress,
                name,
                symbol,
                maxSupply: Number(maxSupply),
                whitelistMintPrice: ethers.formatUnits(whitelistMintPrice, 6),
                publicMintPrice: ethers.formatUnits(publicMintPrice, 6),
                mintPrice: ethers.formatUnits(publicMintPrice, 6), // Alias for compatibility
                creator: owner,
                totalMinted: Number(totalMinted),
                remainingSupply: Number(remainingSupply),
                isWhitelistActive,
                isPublicActive,
                paused,
                baseTokenURI,
                imageUrl
            };
        } catch (err) {
            console.error('Error fetching collection by address:', err);
            return null;
        }
    }, [readProvider]);

    return {
        // State
        collections,
        userCollections,
        isLoading,
        isCreating,
        error,
        txHash,

        // Actions
        fetchAllCollections,
        fetchUserCollections,
        createCollection,
        getCollectionDetails,
        getCollectionByAddress,
        isValidCollection,

        // Utilities
        isLaunchpadReady: isLaunchpadReady()
    };
}
