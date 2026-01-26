const cloudinary = require("../config/cloudinary");

/**
 * Upload base64 image to Cloudinary
 * @param {string} base64Image - Base64 encoded image string
 * @param {string} folder - Folder name in Cloudinary (e.g., 'products', 'categories')
 * @returns {Promise<string>} - Cloudinary URL
 */
const uploadImage = async (base64Image, folder = "smart") => {
  try {
    // If it's already a Cloudinary URL, return as is
    if (
      base64Image.startsWith("http://") ||
      base64Image.startsWith("https://")
    ) {
      return base64Image;
    }

    // If it's not a base64 image, return as is
    if (!base64Image.startsWith("data:image")) {
      return base64Image;
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: folder,
      resource_type: "image",
      transformation: [
        { width: 800, height: 800, crop: "limit" }, // Limit size
        { quality: "auto" }, // Auto optimize quality
        { fetch_format: "auto" }, // Auto format (webp, etc.)
      ],
    });

    return result.secure_url;
  } catch (error) {
    console.error("Error uploading image to Cloudinary:", error);
    throw new Error("Không thể upload ảnh: " + error.message);
  }
};

/**
 * Delete image from Cloudinary by URL
 * @param {string} imageUrl - Cloudinary image URL
 */
const deleteImage = async (imageUrl) => {
  try {
    if (!imageUrl || !imageUrl.includes("cloudinary")) {
      return;
    }

    // Extract public_id from URL
    const parts = imageUrl.split("/");
    const filenameWithExt = parts[parts.length - 1];
    const folder = parts[parts.length - 2];
    const filename = filenameWithExt.split(".")[0];
    const publicId = `${folder}/${filename}`;

    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
  }
};

module.exports = { uploadImage, deleteImage };
