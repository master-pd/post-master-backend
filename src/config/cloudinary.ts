import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Storage configuration for videos
const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'post-master/videos',
      resource_type: 'video',
      format: file.mimetype.split('/')[1],
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
      chunk_size: 6000000, // 6MB chunks
      eager: [
        { width: 300, height: 300, crop: 'pad', audio_codec: 'none' },
        { width: 160, height: 100, crop: 'crop', gravity: 'south', audio_codec: 'none' }
      ],
      eager_async: true,
      eager_notification_url: `${process.env.BACKEND_URL}/api/v1/webhooks/cloudinary`
    };
  }
});

// Storage configuration for images
const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'post-master/images',
      resource_type: 'auto',
      format: file.mimetype.split('/')[1],
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
      transformation: [
        { width: 1000, height: 1000, crop: 'limit' },
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    };
  }
});

// Multer upload instances
export const uploadVideo = multer({
  storage: videoStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-flv', 'video/webm'];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  }
});

export const uploadImage = multer({
  storage: imageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

// Cloudinary utility functions
export const deleteFromCloudinary = async (publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    throw new Error(`Failed to delete from Cloudinary: ${error}`);
  }
};

export const getCloudinaryUrl = (publicId: string, transformations: any[] = []) => {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: transformations
  });
};

export { cloudinary };