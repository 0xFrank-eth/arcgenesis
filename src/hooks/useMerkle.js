import { useState, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';

/**
 * Merkle Tree implementation for whitelist verification
 * Compatible with OpenZeppelin's MerkleProof.sol
 * 
 * The contract uses: keccak256(abi.encodePacked(address))
 * This hook matches that exact hashing scheme
 */

/**
 * Sort pair of hashes for consistent tree construction
 */
function sortPair(a, b) {
    return Buffer.compare(a, b) < 0 ? [a, b] : [b, a];
}

/**
 * Hash two nodes together (sorted)
 */
function hashPair(a, b) {
    const [left, right] = sortPair(a, b);
    const combined = Buffer.concat([left, right]);
    return Buffer.from(ethers.keccak256(combined).slice(2), 'hex');
}

/**
 * Build Merkle tree from leaves
 * Returns array of layers (bottom to top)
 */
function buildTree(leaves) {
    if (leaves.length === 0) return [];

    const layers = [leaves];

    while (layers[layers.length - 1].length > 1) {
        const currentLayer = layers[layers.length - 1];
        const nextLayer = [];

        for (let i = 0; i < currentLayer.length; i += 2) {
            if (i + 1 < currentLayer.length) {
                nextLayer.push(hashPair(currentLayer[i], currentLayer[i + 1]));
            } else {
                nextLayer.push(currentLayer[i]);
            }
        }

        layers.push(nextLayer);
    }

    return layers;
}

/**
 * Get Merkle proof for a leaf
 */
function getProof(layers, leafIndex) {
    if (layers.length === 0) return [];

    const proof = [];
    let index = leafIndex;

    for (let i = 0; i < layers.length - 1; i++) {
        const layer = layers[i];
        const isRight = index % 2 === 1;
        const siblingIndex = isRight ? index - 1 : index + 1;

        if (siblingIndex < layer.length) {
            proof.push('0x' + layer[siblingIndex].toString('hex'));
        }

        index = Math.floor(index / 2);
    }

    return proof;
}

/**
 * Hook for Merkle tree whitelist management
 */
export function useMerkle() {
    const [whitelist, setWhitelist] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    /**
     * Hash an address the same way the contract does
     * Contract: keccak256(abi.encodePacked(address))
     */
    const hashAddress = useCallback((address) => {
        const normalized = ethers.getAddress(address);
        const hash = ethers.solidityPackedKeccak256(['address'], [normalized]);
        return Buffer.from(hash.slice(2), 'hex');
    }, []);

    /**
     * Build Merkle tree and return computed data
     */
    const treeData = useMemo(() => {
        if (whitelist.length === 0) {
            return {
                leaves: [],
                layers: [],
                root: ethers.ZeroHash,
                addressToIndex: new Map()
            };
        }

        try {
            // Normalize and deduplicate addresses
            const normalizedAddresses = [...new Set(
                whitelist.map(addr => ethers.getAddress(addr.trim()))
            )];

            // Create leaves (hashed addresses)
            const leaves = normalizedAddresses.map(addr => hashAddress(addr));

            // Build tree
            const layers = buildTree(leaves);

            // Get root
            const root = layers.length > 0
                ? '0x' + layers[layers.length - 1][0].toString('hex')
                : ethers.ZeroHash;

            // Create address to index mapping
            const addressToIndex = new Map(
                normalizedAddresses.map((addr, i) => [addr.toLowerCase(), i])
            );

            return { leaves, layers, root, addressToIndex, addresses: normalizedAddresses };
        } catch (err) {
            console.error('Error building Merkle tree:', err);
            return {
                leaves: [],
                layers: [],
                root: ethers.ZeroHash,
                addressToIndex: new Map()
            };
        }
    }, [whitelist, hashAddress]);

    /**
     * Load whitelist from array of addresses
     */
    const loadWhitelist = useCallback((addresses) => {
        try {
            setIsLoading(true);
            setError(null);

            // Validate addresses
            const validAddresses = addresses.filter(addr => {
                try {
                    ethers.getAddress(addr.trim());
                    return true;
                } catch {
                    return false;
                }
            });

            setWhitelist(validAddresses);
            return true;
        } catch (err) {
            setError('Failed to load whitelist: ' + err.message);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Load whitelist from text (one address per line or comma-separated)
     */
    const loadWhitelistFromText = useCallback((text) => {
        const addresses = text
            .split(/[\n,]/)
            .map(addr => addr.trim())
            .filter(addr => addr.length > 0);

        return loadWhitelist(addresses);
    }, [loadWhitelist]);

    /**
     * Check if address is in whitelist
     */
    const isWhitelisted = useCallback((address) => {
        try {
            const normalized = ethers.getAddress(address).toLowerCase();
            return treeData.addressToIndex.has(normalized);
        } catch {
            return false;
        }
    }, [treeData]);

    /**
     * Get Merkle proof for an address
     * Returns empty array if not whitelisted
     */
    const getProofForAddress = useCallback((address) => {
        try {
            const normalized = ethers.getAddress(address).toLowerCase();
            const index = treeData.addressToIndex.get(normalized);

            if (index === undefined) {
                return [];
            }

            return getProof(treeData.layers, index);
        } catch {
            return [];
        }
    }, [treeData]);

    /**
     * Verify proof client-side (for testing)
     */
    const verifyProof = useCallback((proof, address) => {
        try {
            let hash = hashAddress(address);

            for (const proofElement of proof) {
                const sibling = Buffer.from(proofElement.slice(2), 'hex');
                hash = hashPair(hash, sibling);
            }

            const computedRoot = '0x' + hash.toString('hex');
            return computedRoot === treeData.root;
        } catch {
            return false;
        }
    }, [treeData, hashAddress]);

    /**
     * Get Merkle root
     */
    const getMerkleRoot = useCallback(() => {
        return treeData.root;
    }, [treeData]);

    /**
     * Get whitelist count
     */
    const getWhitelistCount = useCallback(() => {
        return treeData.addresses?.length || 0;
    }, [treeData]);

    /**
     * Clear whitelist
     */
    const clearWhitelist = useCallback(() => {
        setWhitelist([]);
        setError(null);
    }, []);

    /**
     * Export whitelist as JSON
     */
    const exportAsJSON = useCallback(() => {
        return {
            addresses: treeData.addresses || [],
            root: treeData.root,
            count: treeData.addresses?.length || 0
        };
    }, [treeData]);

    return {
        // State
        whitelist: treeData.addresses || [],
        merkleRoot: treeData.root,
        isLoading,
        error,

        // Actions
        loadWhitelist,
        loadWhitelistFromText,
        clearWhitelist,

        // Queries
        isWhitelisted,
        getProofForAddress,
        verifyProof,
        getMerkleRoot,
        getWhitelistCount,
        exportAsJSON
    };
}

/**
 * Utility function to generate Merkle root from addresses
 * For use outside of React components
 */
export function generateMerkleRoot(addresses) {
    if (!addresses || addresses.length === 0) {
        return ethers.ZeroHash;
    }

    try {
        const normalized = [...new Set(
            addresses.map(addr => ethers.getAddress(addr.trim()))
        )];

        const leaves = normalized.map(addr => {
            const hash = ethers.solidityPackedKeccak256(['address'], [addr]);
            return Buffer.from(hash.slice(2), 'hex');
        });

        const layers = buildTree(leaves);

        return layers.length > 0
            ? '0x' + layers[layers.length - 1][0].toString('hex')
            : ethers.ZeroHash;
    } catch (err) {
        console.error('Error generating Merkle root:', err);
        return ethers.ZeroHash;
    }
}

/**
 * Utility function to get proof for a single address
 * For use outside of React components
 */
export function generateMerkleProof(addresses, targetAddress) {
    if (!addresses || addresses.length === 0) {
        return [];
    }

    try {
        const normalized = [...new Set(
            addresses.map(addr => ethers.getAddress(addr.trim()))
        )];

        const targetNormalized = ethers.getAddress(targetAddress);
        const targetIndex = normalized.findIndex(
            addr => addr.toLowerCase() === targetNormalized.toLowerCase()
        );

        if (targetIndex === -1) {
            return [];
        }

        const leaves = normalized.map(addr => {
            const hash = ethers.solidityPackedKeccak256(['address'], [addr]);
            return Buffer.from(hash.slice(2), 'hex');
        });

        const layers = buildTree(leaves);
        return getProof(layers, targetIndex);
    } catch (err) {
        console.error('Error generating Merkle proof:', err);
        return [];
    }
}
