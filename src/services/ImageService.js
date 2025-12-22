/**
 * ImageService - Client-side image processing for Vision API
 * Handles resize, compression, and base64 encoding
 */

class ImageService {
    /**
     * Resize image to fit within max dimensions while maintaining aspect ratio
     * @param {File} file - Image file from input
     * @param {number} maxWidth - Maximum width (default 1024)
     * @param {number} maxHeight - Maximum height (default 1024)
     * @returns {Promise<string>} Base64 encoded image data
     */
    async resizeImage(file, maxWidth = 1024, maxHeight = 1024) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();

                img.onload = () => {
                    // Calculate new dimensions maintaining aspect ratio
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth || height > maxHeight) {
                        const aspectRatio = width / height;

                        if (width > height) {
                            width = maxWidth;
                            height = maxWidth / aspectRatio;
                        } else {
                            height = maxHeight;
                            width = maxHeight * aspectRatio;
                        }
                    }

                    // Create canvas and draw resized image
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to base64 (JPEG for smaller size)
                    const base64 = canvas.toDataURL('image/jpeg', 0.85);
                    resolve(base64);
                };

                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Prepare image for Vision API
     * @param {File} file - Image file
     * @returns {Promise<Object>} Object with base64 data and metadata
     */
    async prepareForVision(file) {
        try {
            const base64 = await this.resizeImage(file);

            return {
                data: base64,
                mimeType: 'image/jpeg',
                fileName: file.name,
                originalSize: file.size,
                processedSize: Math.round((base64.length * 3) / 4) // Approximate size
            };
        } catch (error) {
            console.error('Image preparation failed:', error);
            throw error;
        }
    }

    /**
     * Validate image file
     * @param {File} file - File to validate
     * @returns {boolean} True if valid
     */
    validateImage(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (!validTypes.includes(file.type)) {
            throw new Error('Invalid file type. Please upload JPEG, PNG, or WebP.');
        }

        if (file.size > maxSize) {
            throw new Error('File too large. Maximum size is 10MB.');
        }

        return true;
    }
}

export const imageService = new ImageService();
