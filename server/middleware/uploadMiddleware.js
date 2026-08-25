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

const hasImageSignature = (buffer) => {
  if (!buffer || buffer.length < 12) return false;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isGif = buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a';
  const isWebp = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  const isBmp = buffer.subarray(0, 2).toString('ascii') === 'BM';
  const isTiff = buffer.subarray(0, 4).toString('ascii') === 'II*\x00' || buffer.subarray(0, 4).toString('ascii') === 'MM\x00*';
  const text = buffer.subarray(0, 4096).toString('utf8').toLowerCase();
  const isSafeSvg = text.includes('<svg') && !text.includes('<script') && !text.includes('onload=');
  return isJpeg || isPng || isGif || isWebp || isBmp || isTiff || isSafeSvg;
};

const hasVideoSignature = (buffer) => {
  if (!buffer || buffer.length < 12) return false;
  const brand = buffer.subarray(8, 12).toString('ascii');
  const isMp4OrMov = buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  const isWebmOrMkv = buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  const isAvi = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'AVI ';
  return isMp4OrMov || isWebmOrMkv || isAvi || brand === 'qt  ';
};

const hasPdfSignature = (buffer) => buffer?.subarray(0, 5).toString('ascii') === '%PDF-';

export const validateUploadedFiles = (req, res, next) => {
  const files = [
    ...(req.file ? [req.file] : []),
    ...Object.values(req.files || {}).flat()
  ];
  const invalid = files.some((file) => {
    if (file.mimetype === 'application/pdf') return hasPdfSignature(file.buffer);
    if (file.mimetype.startsWith('video/')) return hasVideoSignature(file.buffer);
    return hasImageSignature(file.buffer);
  });
  if (!invalid) return next();
  return res.status(400).json({ message: 'Uploaded file content does not match an allowed image, video, or PDF type.' });
};
