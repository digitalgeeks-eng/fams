import multer from 'multer';
import path from 'path';

const imageStorage = multer.memoryStorage();

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
  storage: imageStorage,
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
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: paymentProofFilter
});

export const uploadVideos = multer({
  storage: imageStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: videoFilter
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
  storage: imageStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: fileFilter
});
