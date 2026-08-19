import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = path.basename(file.originalname).replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
    cb(null, `${timestamp}-${safeName}`);
  }
});

const imageFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|gif|webp|bmp|tiff|tif|svg|ico/;
  const allowedMimeTypes = /^image\//;
  const ext = path.extname(file.originalname).toLowerCase();
  const valid = allowedExtensions.test(ext) && allowedMimeTypes.test(file.mimetype);
  if (valid) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpg, jpeg, png, gif, webp, bmp, tiff, svg, ico, etc.)')); 
  }
};

const videoFilter = (req, file, cb) => {
  const allowedTypes = /mp4|avi|mov|mkv|webm/;
  const ext = path.extname(file.originalname).toLowerCase();
  const valid = allowedTypes.test(ext) && allowedTypes.test(file.mimetype);
  if (valid) {
    cb(null, true);
  } else {
    cb(new Error('Only mp4, avi, mov, mkv and webm files are allowed for videos')); 
  }
};

// Separate multers for specific file types
export const uploadImages = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: imageFilter
});

const paymentProofFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|pdf/;
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  const valid = allowedExtensions.test(ext) && allowedMimeTypes.includes(file.mimetype);
  if (valid) {
    cb(null, true);
  } else {
    cb(new Error('Payment proof must be a JPG, JPEG, PNG, or PDF file'));
  }
};

export const uploadPaymentProofFile = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: paymentProofFilter
});

export const uploadVideos = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: videoFilter
});

// Combined multer for handling images and videos in one request
const combinedStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, '-').toLowerCase();
    cb(null, `${timestamp}-${safeName}`);
  }
});

const fileFilter = (req, file, cb) => {
  const imageExtensions = /jpeg|jpg|png|gif|webp|bmp|tiff|tif|svg|ico/;
  const videoExtensions = /mp4|avi|mov|mkv|webm/;
  const imageMimes = /^image\//;
  const videoMimes = /^video\//;
  
  const ext = path.extname(file.originalname).toLowerCase();
  const isValidImage = imageExtensions.test(ext) && imageMimes.test(file.mimetype);
  const isValidVideo = videoExtensions.test(ext) && videoMimes.test(file.mimetype);
  
  if (isValidImage || isValidVideo) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed'));
  }
};

export const uploadPropertyMedia = multer({
  storage: combinedStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: fileFilter
});
