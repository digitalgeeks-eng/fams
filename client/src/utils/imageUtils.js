import { getBackendBaseUrl } from '../services/api.js';

export const getImageUrl = (image) => {
  if (!image) return 'https://via.placeholder.com/400x300';
  if (typeof image === 'object' && image.url) image = image.url;
  const normalizedImage = String(image).replace(/\\/g, '/').trim();
  if (normalizedImage.startsWith('http://') || normalizedImage.startsWith('https://')) return normalizedImage;
  const normalized = normalizedImage.startsWith('/') ? normalizedImage.slice(1) : normalizedImage;
  return `${getBackendBaseUrl()}/${normalized}`;
};
