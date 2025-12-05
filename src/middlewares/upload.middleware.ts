import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadVideo, uploadImage } from '../config/cloudinary';
import { logger } from '../utils/logger';

// Ensure upload directory exists
const ensureUploadDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Local storage configuration (fallback)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    ensureUploadDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-flv', 'video/webm', 'video/mpeg']
  };

  const fileType = file.mimetype.split('/')[0];
  
  if (fileType === 'image' && allowedTypes.image.includes(file.mimetype)) {
    cb(null, true);
  } else if (fileType === 'video' && allowedTypes.video.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: images (JPEG, PNG, GIF, WebP) and videos (MP4, MOV, AVI, FLV, WebM, MPEG)`));
  }
};

// Local upload instance (fallback)
export const localUpload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 1
  },
  fileFilter
});

// Error handling wrapper
const handleUpload = (uploadMiddleware: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              message: 'File too large. Maximum size is 100MB.'
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              success: false,
              message: 'Too many files. Maximum 1 file allowed.'
            });
          }
          return res.status(400).json({
            success: false,
            message: `Upload error: ${err.message}`
          });
        }
        
        if (err.message) {
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }
        
        logger.error('Upload error:', err);
        return res.status(500).json({
          success: false,
          message: 'File upload failed.'
        });
      }
      
      next();
    });
  };
};

// Cloudinary upload middlewares
export const uploadVideoMiddleware = handleUpload(uploadVideo.single('video'));
export const uploadImageMiddleware = handleUpload(uploadImage.single('image'));

// Multiple files upload (for future use)
export const uploadMultipleImages = handleUpload(uploadImage.array('images', 10));
export const uploadMultipleVideos = handleUpload(uploadVideo.array('videos', 5));

// Mixed upload (video + thumbnail)
export const uploadVideoWithThumbnail = handleUpload(uploadVideo.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]));

// File type checker
export const checkFileType = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: 'No file uploaded.'
    });
    return;
  }

  const file = req.file as Express.Multer.File & { location?: string; path?: string };
  
  // Check if file was uploaded to Cloudinary
  if (file.location) {
    req.body.fileUrl = file.location;
    req.body.filePublicId = file.filename; // Cloudinary public_id
    req.body.fileType = file.mimetype.split('/')[0];
    req.body.fileSize = file.size;
  } else if (file.path) {
    // Local file
    req.body.filePath = file.path;
    req.body.fileType = file.mimetype.split('/')[0];
    req.body.fileSize = file.size;
  }
  
  next();
};

// Clean up local files after upload
export const cleanupLocalFiles = (req: Request, res: Response, next: NextFunction): void => {
  if (req.file && req.file.path && !req.file.location) {
    // This is a local file, schedule cleanup
    const filePath = req.file.path;
    
    // Clean up after response is sent
    res.on('finish', () => {
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) {
            logger.error('Failed to cleanup local file:', err);
          }
        });
      }
    });
  }
  
  next();
};