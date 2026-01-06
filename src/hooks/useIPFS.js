import { useState, useCallback } from 'react';

// Pinata API endpoints
const PINATA_API_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

export function useIPFS() {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState(null);

    // Get Pinata JWT from environment
    const getPinataJWT = () => {
        return import.meta.env.VITE_PINATA_JWT || '';
    };

    // Upload image to IPFS via Pinata
    const uploadImage = useCallback(async (file) => {
        const jwt = getPinataJWT();

        if (!jwt) {
            // If no Pinata JWT, use a mock/placeholder for demo
            console.warn('No Pinata JWT found. Using placeholder CID for demo.');
            return {
                success: true,
                cid: 'QmDemo' + Math.random().toString(36).substring(7),
                url: URL.createObjectURL(file),
                isDemo: true
            };
        }

        setIsUploading(true);
        setUploadProgress(0);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            // Add metadata
            const metadata = JSON.stringify({
                name: file.name,
                keyvalues: {
                    platform: 'ArcGenesis',
                    type: 'collection-image'
                }
            });
            formData.append('pinataMetadata', metadata);

            // Pin options
            const options = JSON.stringify({
                cidVersion: 1
            });
            formData.append('pinataOptions', options);

            const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${jwt}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to upload to IPFS');
            }

            const data = await response.json();
            setUploadProgress(100);

            return {
                success: true,
                cid: data.IpfsHash,
                url: `${PINATA_GATEWAY}/${data.IpfsHash}`,
                isDemo: false
            };
        } catch (err) {
            console.error('IPFS upload error:', err);
            setError(err.message);
            return {
                success: false,
                error: err.message
            };
        } finally {
            setIsUploading(false);
        }
    }, []);

    // Upload JSON metadata to IPFS
    const uploadMetadata = useCallback(async (metadata) => {
        const jwt = getPinataJWT();

        if (!jwt) {
            console.warn('No Pinata JWT found. Using placeholder for demo.');
            return {
                success: true,
                cid: 'QmMeta' + Math.random().toString(36).substring(7),
                isDemo: true
            };
        }

        setIsUploading(true);
        setError(null);

        try {
            const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pinataContent: metadata,
                    pinataMetadata: {
                        name: `${metadata.name || 'NFT'}-metadata.json`,
                        keyvalues: {
                            platform: 'ArcGenesis',
                            type: 'nft-metadata'
                        }
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to upload metadata');
            }

            const data = await response.json();

            return {
                success: true,
                cid: data.IpfsHash,
                url: `ipfs://${data.IpfsHash}`,
                isDemo: false
            };
        } catch (err) {
            console.error('Metadata upload error:', err);
            setError(err.message);
            return {
                success: false,
                error: err.message
            };
        } finally {
            setIsUploading(false);
        }
    }, []);

    // Generate and upload collection metadata
    const generateCollectionMetadata = useCallback(async (collectionData, imageCID) => {
        const { name, symbol, description, maxSupply } = collectionData;

        // Create base metadata for the collection
        const metadata = {
            name: name,
            symbol: symbol,
            description: description || `${name} - An NFT collection on ArcGenesis`,
            image: `ipfs://${imageCID}`,
            external_url: 'https://arcgenesis.io',
            seller_fee_basis_points: 0,
            fee_recipient: '',
            attributes: [
                { trait_type: 'Platform', value: 'ArcGenesis' },
                { trait_type: 'Network', value: 'Arc Testnet' },
                { trait_type: 'Max Supply', value: maxSupply.toString() }
            ]
        };

        return uploadMetadata(metadata);
    }, [uploadMetadata]);

    // Generate base URI for NFT metadata (for on-chain reference)
    const generateBaseURI = useCallback((metadataCID) => {
        return `ipfs://${metadataCID}/`;
    }, []);

    // Convert IPFS CID to HTTP gateway URL for previewing
    const getGatewayURL = useCallback((cid) => {
        if (!cid) return '';
        // Handle ipfs:// prefix
        const cleanCID = cid.replace('ipfs://', '');
        return `${PINATA_GATEWAY}/${cleanCID}`;
    }, []);

    return {
        isUploading,
        uploadProgress,
        error,
        uploadImage,
        uploadMetadata,
        generateCollectionMetadata,
        generateBaseURI,
        getGatewayURL
    };
}
