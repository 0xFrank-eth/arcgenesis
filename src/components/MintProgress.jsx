import React from 'react';

export function MintProgress({ minted, total, showLabel = true }) {
    const percentage = total > 0 ? (minted / total) * 100 : 0;
    const isSoldOut = minted >= total;

    return (
        <div className="mint-progress-container">
            {showLabel && (
                <div className="mint-progress-label">
                    <span className="mint-progress-text">
                        {isSoldOut ? 'Sold Out!' : 'Minted'}
                    </span>
                    <span className="mint-progress-count">
                        {minted} / {total}
                    </span>
                </div>
            )}
            <div className="mint-progress-bar-wrapper">
                <div
                    className={`mint-progress-bar ${isSoldOut ? 'sold-out' : ''}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                >
                    <div className="mint-progress-glow"></div>
                </div>
            </div>
            {showLabel && (
                <span className="mint-progress-percentage">
                    {percentage.toFixed(1)}%
                </span>
            )}
        </div>
    );
}
