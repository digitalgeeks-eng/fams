export const PROPERTY_MEDIA_LIMITS = Object.freeze({
  images: 15,
  videos: 5
});

export const PROPERTY_MEDIA_MAX_FILE_SIZE = 100 * 1024 * 1024;

export const getStoredPropertyMedia = (property, kind) => {
  const legacyField = kind === 'images' ? 'image' : 'video';
  const candidates = [
    ...(property?.[legacyField] !== undefined && property[legacyField] !== null ? [property[legacyField]] : []),
    ...(Array.isArray(property?.[kind]) ? property[kind] : [])
  ];
  const seen = new Set();
  return candidates.filter((media) => {
    const identity = media && typeof media === 'object'
      ? media.publicId || media.public_id || media.url || media.secure_url
      : media;
    const key = typeof identity === 'string' ? identity : JSON.stringify(media);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const resolvePropertyMediaOrder = (manifest, existingCount, uploadCount) => {
  if (manifest === undefined || manifest === null || manifest === '') {
    return [
      ...Array.from({ length: existingCount }, (_, index) => `existing:${index}`),
      ...Array.from({ length: uploadCount }, (_, index) => `upload:${index}`)
    ];
  }

  let entries = manifest;
  if (typeof entries === 'string') {
    try {
      entries = JSON.parse(entries);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(entries)) return null;

  const seen = new Set();
  const uploadIndexes = new Set();
  for (const entry of entries) {
    if (typeof entry !== 'string') return null;
    const match = entry.match(/^(existing|upload):(0|[1-9]\d*)$/);
    if (!match || seen.has(entry)) return null;
    const index = Number(match[2]);
    const isExisting = match[1] === 'existing';
    if (isExisting ? index >= existingCount : index >= uploadCount) return null;
    if (!isExisting) uploadIndexes.add(index);
    seen.add(entry);
  }

  if (uploadIndexes.size !== uploadCount) return null;
  return entries;
};

export const getCloudinaryPublicId = (media) => (
  media && typeof media === 'object'
    && typeof (media.publicId || media.public_id) === 'string'
    ? media.publicId || media.public_id
    : null
);
