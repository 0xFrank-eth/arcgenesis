import { useState, useEffect, useCallback, useMemo } from 'react';
import { MINT_PHASE } from './useNFT';

/**
 * Hook for managing mint phase countdowns and status
 */
export function useMintPhase(collectionInfo) {
    const [countdown, setCountdown] = useState(null);
    const [currentPhase, setCurrentPhase] = useState(MINT_PHASE.NOT_STARTED);

    /**
     * Calculate time remaining in a readable format
     */
    const formatCountdown = useCallback((seconds) => {
        if (seconds <= 0) return null;

        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        return {
            days,
            hours,
            minutes,
            seconds: secs,
            total: seconds,
            formatted: days > 0
                ? `${days}d ${hours}h ${minutes}m`
                : hours > 0
                    ? `${hours}h ${minutes}m ${secs}s`
                    : `${minutes}m ${secs}s`
        };
    }, []);

    /**
     * Determine current phase and countdown target
     */
    const updatePhaseAndCountdown = useCallback(() => {
        if (!collectionInfo) {
            setCurrentPhase(MINT_PHASE.NOT_STARTED);
            setCountdown(null);
            return;
        }

        const now = Math.floor(Date.now() / 1000);
        const {
            whitelistStartTime,
            whitelistEndTime,
            publicStartTime,
            publicEndTime
        } = collectionInfo;

        // Before whitelist
        if (now < whitelistStartTime) {
            setCurrentPhase(MINT_PHASE.NOT_STARTED);
            setCountdown(formatCountdown(whitelistStartTime - now));
            return;
        }

        // During whitelist
        if (now >= whitelistStartTime && now <= whitelistEndTime) {
            setCurrentPhase(MINT_PHASE.WHITELIST);
            setCountdown(formatCountdown(whitelistEndTime - now));
            return;
        }

        // Between phases
        if (now > whitelistEndTime && now < publicStartTime) {
            setCurrentPhase(MINT_PHASE.BETWEEN_PHASES);
            setCountdown(formatCountdown(publicStartTime - now));
            return;
        }

        // During public
        if (now >= publicStartTime && now <= publicEndTime) {
            setCurrentPhase(MINT_PHASE.PUBLIC);
            setCountdown(formatCountdown(publicEndTime - now));
            return;
        }

        // Ended
        setCurrentPhase(MINT_PHASE.ENDED);
        setCountdown(null);
    }, [collectionInfo, formatCountdown]);

    /**
     * Update countdown every second
     */
    useEffect(() => {
        updatePhaseAndCountdown();

        const interval = setInterval(updatePhaseAndCountdown, 1000);
        return () => clearInterval(interval);
    }, [updatePhaseAndCountdown]);

    /**
     * Phase display information
     */
    const phaseInfo = useMemo(() => {
        switch (currentPhase) {
            case MINT_PHASE.NOT_STARTED:
                return {
                    label: 'Whitelist Starting Soon',
                    description: 'Whitelist mint will begin shortly',
                    color: 'yellow',
                    canMint: false,
                    showCountdown: true,
                    countdownLabel: 'Whitelist starts in'
                };
            case MINT_PHASE.WHITELIST:
                return {
                    label: 'Whitelist Mint Active',
                    description: 'Only whitelisted addresses can mint',
                    color: 'purple',
                    canMint: true,
                    showCountdown: true,
                    countdownLabel: 'Whitelist ends in'
                };
            case MINT_PHASE.BETWEEN_PHASES:
                return {
                    label: 'Public Mint Starting Soon',
                    description: 'Whitelist phase ended, public mint coming',
                    color: 'blue',
                    canMint: false,
                    showCountdown: true,
                    countdownLabel: 'Public mint starts in'
                };
            case MINT_PHASE.PUBLIC:
                return {
                    label: 'Public Mint Active',
                    description: 'Anyone can mint',
                    color: 'green',
                    canMint: true,
                    showCountdown: true,
                    countdownLabel: 'Public mint ends in'
                };
            case MINT_PHASE.ENDED:
                return {
                    label: 'Mint Ended',
                    description: 'This collection is no longer minting',
                    color: 'gray',
                    canMint: false,
                    showCountdown: false,
                    countdownLabel: null
                };
            default:
                return {
                    label: 'Loading...',
                    description: '',
                    color: 'gray',
                    canMint: false,
                    showCountdown: false,
                    countdownLabel: null
                };
        }
    }, [currentPhase]);

    /**
     * Get current mint price based on phase
     */
    const currentPrice = useMemo(() => {
        if (!collectionInfo) return null;

        if (currentPhase === MINT_PHASE.WHITELIST) {
            return {
                formatted: collectionInfo.whitelistMintPrice,
                raw: collectionInfo.whitelistMintPriceRaw,
                label: 'Whitelist Price'
            };
        }

        return {
            formatted: collectionInfo.publicMintPrice,
            raw: collectionInfo.publicMintPriceRaw,
            label: 'Public Price'
        };
    }, [collectionInfo, currentPhase]);

    /**
     * Check if mint button should be disabled
     */
    const isMintDisabled = useMemo(() => {
        if (!collectionInfo) return true;
        if (collectionInfo.paused) return true;
        if (collectionInfo.remainingSupply === 0) return true;

        return !phaseInfo.canMint;
    }, [collectionInfo, phaseInfo]);

    /**
     * Get mint button text
     */
    const mintButtonText = useMemo(() => {
        if (!collectionInfo) return 'Loading...';
        if (collectionInfo.paused) return 'Minting Paused';
        if (collectionInfo.remainingSupply === 0) return 'Sold Out';

        switch (currentPhase) {
            case MINT_PHASE.NOT_STARTED:
                return 'Mint Not Started';
            case MINT_PHASE.WHITELIST:
                return 'Whitelist Mint';
            case MINT_PHASE.BETWEEN_PHASES:
                return 'Waiting for Public';
            case MINT_PHASE.PUBLIC:
                return 'Mint Now';
            case MINT_PHASE.ENDED:
                return 'Mint Ended';
            default:
                return 'Mint';
        }
    }, [collectionInfo, currentPhase]);

    return {
        // Phase state
        currentPhase,
        phaseInfo,
        countdown,

        // Price info
        currentPrice,

        // UI helpers
        isMintDisabled,
        mintButtonText,

        // Constants
        MINT_PHASE
    };
}

/**
 * Format a Unix timestamp to readable date/time
 */
export function formatTimestamp(timestamp) {
    if (!timestamp) return 'Not set';

    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });
}

/**
 * Get time until a timestamp in human readable format
 */
export function getTimeUntil(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const diff = timestamp - now;

    if (diff <= 0) return 'Started';

    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}
