import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

const hasCloudinaryConfig = () => Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

const configureCloudinary = () => {
  if (!hasCloudinaryConfig()) {
    throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
};

export const uploadBufferToCloudinary = (buffer, { folder, resourceType = 'auto' } = {}) => {
  configureCloudinary();

  const uploadOptions = {
    folder,
    resource_type: resourceType
  };
  if (resourceType === 'image') {
    uploadOptions.quality = 'auto';
    uploadOptions.fetch_format = 'auto';
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => (error ? reject(error) : resolve(result))
    );
    uploadStream.end(buffer);
  });
};

export const deleteCloudinaryAsset = async (publicId, resourceType = 'image') => {
  if (!publicId || !hasCloudinaryConfig()) return;
  configureCloudinary();
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

export const isCloudinaryConfigured = hasCloudinaryConfig;
