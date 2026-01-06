import React, { useState } from 'react';
import { ImageUploader } from './ImageUploader';
import { useIPFS } from '../hooks/useIPFS';

export function CreateCollectionForm({ onSubmit, isCreating, error, txHash }) {
    const [formData, setFormData] = useState({
        name: '',
        symbol: '',
        description: '',
        maxSupply: '',
        mintPrice: '',
        baseTokenURI: ''
    });
    const [step, setStep] = useState(1);
    const [formErrors, setFormErrors] = useState({});
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Image upload state
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [imageCID, setImageCID] = useState(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [uploadError, setUploadError] = useState(null);

    const { uploadImage, generateCollectionMetadata, isUploading } = useIPFS();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error when user starts typing
        if (formErrors[name]) {
            setFormErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const handleImageSelect = async (file) => {
        if (!file) {
            setImageFile(null);
            setImagePreview(null);
            setImageCID(null);
            return;
        }

        setImageFile(file);
        setIsUploadingImage(true);
        setUploadError(null);

        // Create preview immediately
        const reader = new FileReader();
        reader.onload = (e) => {
            setImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);

        // Upload to IPFS
        try {
            const result = await uploadImage(file);
            if (result.success) {
                setImageCID(result.cid);
                if (result.isDemo) {
                    console.log('Demo mode: Using placeholder CID');
                }
            } else {
                setUploadError(result.error);
            }
        } catch (err) {
            setUploadError('Failed to upload image');
        } finally {
            setIsUploadingImage(false);
        }
    };

    const validateStep1 = () => {
        const errors = {};
        if (!formData.name.trim()) errors.name = 'Collection name is required';
        if (!formData.symbol.trim()) errors.symbol = 'Symbol is required';
        if (formData.symbol.length > 10) errors.symbol = 'Symbol must be 10 characters or less';
        if (!imageFile) errors.image = 'Collection image is required';

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateStep2 = () => {
        const errors = {};
        if (!formData.maxSupply || formData.maxSupply <= 0) {
            errors.maxSupply = 'Max supply must be greater than 0';
        }
        if (formData.maxSupply > 10000) {
            errors.maxSupply = 'Max supply cannot exceed 10,000';
        }
        if (!formData.mintPrice || formData.mintPrice < 0) {
            errors.mintPrice = 'Mint price must be 0 or greater';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleNext = () => {
        if (step === 1 && validateStep1()) {
            setStep(2);
        } else if (step === 2 && validateStep2()) {
            setStep(3);
        }
    };

    const handleBack = () => {
        setStep(prev => prev - 1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (step === 3) {
            let baseURI = formData.baseTokenURI;

            // If no custom URI and we have an image CID, generate metadata
            if (!baseURI && imageCID) {
                const metadataResult = await generateCollectionMetadata(formData, imageCID);
                if (metadataResult.success) {
                    baseURI = `ipfs://${metadataResult.cid}/`;
                } else {
                    baseURI = `https://arcgenesis.io/api/metadata/${formData.symbol.toLowerCase()}/`;
                }
            } else if (!baseURI) {
                baseURI = `https://arcgenesis.io/api/metadata/${formData.symbol.toLowerCase()}/`;
            }

            const submitData = {
                ...formData,
                baseTokenURI: baseURI,
                imageCID: imageCID
            };
            onSubmit(submitData);
        }
    };

    return (
        <form className="create-form" onSubmit={handleSubmit}>
            {/* Progress Steps */}
            <div className="form-steps">
                <div className={`form-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                    <div className="step-number">1</div>
                    <span className="step-label">Basic Info</span>
                </div>
                <div className="step-connector"></div>
                <div className={`form-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                    <div className="step-number">2</div>
                    <span className="step-label">Supply & Price</span>
                </div>
                <div className="step-connector"></div>
                <div className={`form-step ${step >= 3 ? 'active' : ''}`}>
                    <div className="step-number">3</div>
                    <span className="step-label">Review</span>
                </div>
            </div>

            {/* Step 1: Basic Info */}
            {step === 1 && (
                <div className="form-section">
                    <h2 className="form-section-title">Collection Details</h2>
                    <p className="form-section-desc">Give your collection a unique identity</p>

                    {/* Image Uploader */}
                    <ImageUploader
                        onImageSelect={handleImageSelect}
                        currentImage={imagePreview}
                        isUploading={isUploadingImage}
                        error={formErrors.image || uploadError}
                    />

                    <div className="form-group">
                        <label htmlFor="name">Collection Name</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="e.g. Cosmic Explorers"
                            className={formErrors.name ? 'error' : ''}
                        />
                        {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="symbol">Symbol</label>
                        <input
                            type="text"
                            id="symbol"
                            name="symbol"
                            value={formData.symbol}
                            onChange={handleChange}
                            placeholder="e.g. COSMIC"
                            maxLength={10}
                            className={formErrors.symbol ? 'error' : ''}
                        />
                        <span className="input-hint">Max 10 characters, used as token symbol</span>
                        {formErrors.symbol && <span className="error-text">{formErrors.symbol}</span>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">
                            Description
                            <span className="label-optional">(Optional)</span>
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Tell collectors about your collection..."
                            rows={3}
                            className="form-textarea"
                        />
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleNext}
                            disabled={isUploadingImage}
                        >
                            {isUploadingImage ? (
                                <>
                                    <span className="spinner"></span>
                                    Uploading...
                                </>
                            ) : (
                                'Next Step'
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Supply & Price */}
            {step === 2 && (
                <div className="form-section">
                    <h2 className="form-section-title">Supply & Pricing</h2>
                    <p className="form-section-desc">Set the economics of your collection</p>

                    <div className="form-group">
                        <label htmlFor="maxSupply">Max Supply</label>
                        <input
                            type="number"
                            id="maxSupply"
                            name="maxSupply"
                            value={formData.maxSupply}
                            onChange={handleChange}
                            placeholder="e.g. 1000"
                            min="1"
                            max="10000"
                            className={formErrors.maxSupply ? 'error' : ''}
                        />
                        <span className="input-hint">Maximum number of NFTs that can be minted (1 - 10,000)</span>
                        {formErrors.maxSupply && <span className="error-text">{formErrors.maxSupply}</span>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="mintPrice">Mint Price (USDC)</label>
                        <div className="input-with-suffix">
                            <input
                                type="number"
                                id="mintPrice"
                                name="mintPrice"
                                value={formData.mintPrice}
                                onChange={handleChange}
                                placeholder="e.g. 5"
                                step="0.01"
                                min="0"
                                className={formErrors.mintPrice ? 'error' : ''}
                            />
                            <span className="input-suffix">USDC</span>
                        </div>
                        <span className="input-hint">Price per NFT in USDC (set 0 for free mint)</span>
                        {formErrors.mintPrice && <span className="error-text">{formErrors.mintPrice}</span>}
                    </div>

                    {/* Advanced Settings Toggle */}
                    <div className="advanced-toggle">
                        <button
                            type="button"
                            className="advanced-toggle-btn"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                        >
                            <span className="advanced-icon">{showAdvanced ? '▼' : '▶'}</span>
                            Advanced Settings (Optional)
                        </button>
                    </div>

                    {/* Advanced Settings - Hidden by default */}
                    {showAdvanced && (
                        <div className="advanced-section">
                            <div className="form-group">
                                <label htmlFor="baseTokenURI">
                                    Custom Metadata URI
                                    <span className="label-optional">(Optional)</span>
                                </label>
                                <input
                                    type="url"
                                    id="baseTokenURI"
                                    name="baseTokenURI"
                                    value={formData.baseTokenURI}
                                    onChange={handleChange}
                                    placeholder="Leave empty for auto-generated metadata"
                                />
                                <span className="input-hint">
                                    💡 Leave this empty! We'll automatically upload your image to IPFS and generate metadata.
                                    Only fill this if you have your own IPFS metadata hosted.
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={handleBack}>
                            Back
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handleNext}>
                            Review
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
                <div className="form-section">
                    <h2 className="form-section-title">Review & Launch</h2>
                    <p className="form-section-desc">Confirm your collection details</p>

                    <div className="review-card">
                        <div className="review-header">
                            {imagePreview ? (
                                <img src={imagePreview} alt="Collection" className="review-image" />
                            ) : (
                                <div className="review-icon">{formData.symbol?.slice(0, 2) || '🎨'}</div>
                            )}
                            <div>
                                <h3 className="review-name">{formData.name}</h3>
                                <span className="review-symbol">${formData.symbol}</span>
                            </div>
                        </div>
                        {formData.description && (
                            <p className="review-description">{formData.description}</p>
                        )}
                        <div className="review-details">
                            <div className="review-row">
                                <span className="review-label">Max Supply</span>
                                <span className="review-value">{formData.maxSupply} NFTs</span>
                            </div>
                            <div className="review-row">
                                <span className="review-label">Mint Price</span>
                                <span className="review-value">{formData.mintPrice || '0'} USDC</span>
                            </div>
                            <div className="review-row">
                                <span className="review-label">Potential Revenue</span>
                                <span className="review-value highlight">
                                    {(formData.maxSupply * (formData.mintPrice || 0)).toFixed(2)} USDC
                                </span>
                            </div>
                            <div className="review-row">
                                <span className="review-label">Image</span>
                                <span className="review-value">
                                    {imageCID ? '✓ Uploaded to IPFS' : '⏳ Pending'}
                                </span>
                            </div>
                            <div className="review-row">
                                <span className="review-label">Metadata</span>
                                <span className="review-value">
                                    {formData.baseTokenURI ? '✓ Custom' : '✓ Auto-generated'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="launch-info">
                        <div className="launch-info-icon">🚀</div>
                        <div className="launch-info-text">
                            <strong>Ready to Launch!</strong>
                            <p>Your collection image has been uploaded to IPFS. After launching, users can start minting NFTs and you'll receive USDC payments directly.</p>
                        </div>
                    </div>

                    {error && (
                        <div className="alert alert-error">
                            <span className="alert-icon">⚠️</span>
                            {error}
                        </div>
                    )}

                    {txHash && (
                        <div className="alert alert-success">
                            <span className="alert-icon">✅</span>
                            Transaction submitted!
                            <a
                                href={`https://testnet.arcscan.app/tx/${txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                View on Explorer
                            </a>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={handleBack}>
                            Back
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            disabled={isCreating || isUploading}
                        >
                            {isCreating || isUploading ? (
                                <>
                                    <span className="spinner"></span>
                                    {isUploading ? 'Uploading Metadata...' : 'Creating...'}
                                </>
                            ) : (
                                <>
                                    🚀 Launch Collection
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </form>
    );
}
