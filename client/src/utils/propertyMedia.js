export const MAX_PROPERTY_IMAGES = 15;
export const MAX_PROPERTY_VIDEOS = 5;
export const MAX_PROPERTY_MEDIA_FILE_SIZE = 100 * 1024 * 1024;
export const MAX_PROPERTY_MEDIA_REQUEST_SIZE = 200 * 1024 * 1024;
export const MAX_ROOM_MEDIA_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_ROOM_IMAGES = 5;
export const MAX_ROOM_VIDEOS = 2;

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif', 'svg', 'ico']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'avi', 'mov', 'mkv', 'webm']);

export const getMediaUrl = (media) => {
  const value = typeof media === 'string'
    ? media
    : media && typeof media === 'object'
      ? media.url || media.secure_url || media.src || media.path
      : '';
  if (typeof value !== 'string') return '';

  const url = value.trim();
  if (!url || url.startsWith('//') || /^(javascript|data|vbscript):/i.test(url)) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('/') || !/^[a-z][a-z\d+.-]*:/i.test(url)) return url;
  return '';
};

export const getEditablePropertyMedia = (property, kind) => {
  const media = Array.isArray(property?.[kind]) ? property[kind] : [];
  const legacyField = kind === 'images' ? 'image' : 'video';
  const candidates = [
    ...(property?.[legacyField] !== undefined && property[legacyField] !== null
      ? [property[legacyField]]
      : []),
    ...media
  ];
  const seen = new Set();
  return candidates.flatMap((value, sourceIndex) => {
    const identity = value && typeof value === 'object'
      ? value.publicId || value.public_id || value.url || value.secure_url
      : value;
    const key = typeof identity === 'string' ? identity : JSON.stringify(value);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ media: value, sourceIndex: seen.size - 1 }];
  });
};

export const getValidPropertyMedia = (property, kind) => {
  const seen = new Set();
  return getEditablePropertyMedia(property, kind).filter(({ media }) => {
    const url = getMediaUrl(media);
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
};

const getExtension = (file) => String(file?.name || '').split('.').pop().toLowerCase();

export const validatePropertyMediaFiles = (images, videos) => {
  if (images.length > MAX_PROPERTY_IMAGES) return `Choose no more than ${MAX_PROPERTY_IMAGES} images at a time.`;
  if (videos.length > MAX_PROPERTY_VIDEOS) return `Choose no more than ${MAX_PROPERTY_VIDEOS} videos at a time.`;
  if ([...images, ...videos].reduce((total, file) => total + file.size, 0) > MAX_PROPERTY_MEDIA_REQUEST_SIZE) {
    return 'The selected property media exceeds the 200 MB total upload limit.';
  }

  for (const file of images) {
    if (!IMAGE_EXTENSIONS.has(getExtension(file)) || !file.type?.startsWith('image/')) {
      return `${file.name} is not a supported image file.`;
    }
    if (file.size > MAX_PROPERTY_MEDIA_FILE_SIZE) return `${file.name} is larger than the 100 MB per-file limit.`;
  }

  for (const file of videos) {
    if (!VIDEO_EXTENSIONS.has(getExtension(file)) || !file.type?.startsWith('video/')) {
      return `${file.name} is not a supported video file.`;
    }
    if (file.size > MAX_PROPERTY_MEDIA_FILE_SIZE) return `${file.name} is larger than the 100 MB per-file limit.`;
  }

  return null;
};

export const validateRoomMediaFiles = (images, videos) => {
  if (images.length > MAX_ROOM_IMAGES) return `Choose no more than ${MAX_ROOM_IMAGES} room images at a time.`;
  if (videos.length > MAX_ROOM_VIDEOS) return `Choose no more than ${MAX_ROOM_VIDEOS} room videos at a time.`;
  for (const file of [...images, ...videos]) {
    if (file.size > MAX_ROOM_MEDIA_FILE_SIZE) return `${file.name} is larger than the 10 MB room-media limit.`;
  }
  return validatePropertyMediaFiles(images, videos);
};

export const createMediaOrder = (existingItems, newItems, coverKey) => {
  const orderedExisting = [...existingItems];
  const orderedNew = [...newItems];
  const coverExistingIndex = orderedExisting.findIndex((item) => item.key === coverKey);
  const coverNewIndex = orderedNew.findIndex((item) => item.key === coverKey);

  if (coverExistingIndex > 0) orderedExisting.unshift(orderedExisting.splice(coverExistingIndex, 1)[0]);
  if (coverNewIndex >= 0) {
    const cover = orderedNew.splice(coverNewIndex, 1)[0];
    return [
      `upload:${cover.index}`,
      ...orderedExisting.map((item) => `existing:${item.sourceIndex}`),
      ...orderedNew.map((item) => `upload:${item.index}`)
    ];
  }

  return [
    ...orderedExisting.map((item) => `existing:${item.sourceIndex}`),
    ...orderedNew.map((item) => `upload:${item.index}`)
  ];
};

export const getWrappedMediaIndex = (index, direction, count) => (
  count > 0 ? (index + direction + count) % count : 0
);
