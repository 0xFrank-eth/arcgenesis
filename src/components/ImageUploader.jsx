import React, { useState, useRef, useCallback } from 'react';

export function ImageUploader({ onImageSelect, currentImage, isUploading, error }) {
    const [isDragging, setIsDragging] = useState(false);
    const [preview, setPreview] = useState(currentImage || null);
    const [fileError, setFileError] = useState(null);
    const fileInputRef = useRef(null);

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    const validateFile = (file) => {
        if (!ALLOWED_TYPES.includes(file.type)) {
            return 'Invalid file type. Please use JPG, PNG, GIF, or WebP.';
        }
        if (file.size > MAX_FILE_SIZE) {
            return 'File too large. Maximum size is 10MB.';
        }
        return null;
    };

    const handleFile = useCallback((file) => {
        setFileError(null);

        const validationError = validateFile(file);
        if (validationError) {
            setFileError(validationError);
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setPreview(e.target.result);
        };
        reader.readAsDataURL(file);

        // Pass file to parent
        onImageSelect(file);
    }, [onImageSelect]);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFile(file);
        }
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleInputChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    };

    const handleRemove = (e) => {
        e.stopPropagation();
        setPreview(null);
        setFileError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onImageSelect(null);
    };

    return (
        <div className="image-uploader">
            <label className="uploader-label">Collection Image</label>

            <div
                className={`upload-zone ${isDragging ? 'dragging' : ''} ${preview ? 'has-image' : ''} ${isUploading ? 'uploading' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleClick}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_TYPES.join(',')}
                    onChange={handleInputChange}
                    className="upload-input"
                />

                {preview ? (
                    <div className="preview-container">
                        <img src={preview} alt="Preview" className="preview-image" />
                        <div className="preview-overlay">
                            {isUploading ? (
                                <div className="upload-progress">
                                    <div className="spinner"></div>
                                    <span>Uploading to IPFS...</span>
                                </div>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="btn-change"
                                        onClick={handleClick}
                                    >
                                        Change Image
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-remove"
                                        onClick={handleRemove}
                                    >
                                        ✕
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="upload-placeholder">
                        <div className="upload-icon">🖼️</div>
                        <div className="upload-text">
                            <span className="upload-primary">
                                {isDragging ? 'Drop image here' : 'Click or drag to upload'}
                            </span>
                            <span className="upload-secondary">
                                JPG, PNG, GIF, WebP • Max 10MB
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {(fileError || error) && (
                <span className="error-text">{fileError || error}</span>
            )}

            <span className="input-hint">
                This image will be the cover of your NFT collection and shown across the platform.
            </span>
        </div>
    );
}
