import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createMediaOrder,
  getEditablePropertyMedia,
  getMediaUrl,
  getValidPropertyMedia,
  getWrappedMediaIndex,
  validatePropertyMediaFiles,
  validateRoomMediaFiles
} from './propertyMedia.js';

test('normalizes array and legacy image/video records while ignoring invalid URLs', () => {
  const property = {
    images: [{ url: 'https://cdn.example.test/cover.jpg' }, 'javascript:alert(1)', { url: 'relative/photo.jpg' }],
    image: { secure_url: 'https://cdn.example.test/cover.jpg' },
    videos: [{ secure_url: 'https://cdn.example.test/tour.mp4' }],
    video: 'data:video/mp4,invalid'
  };

  assert.equal(getMediaUrl({ url: 'javascript:alert(1)' }), '');
  assert.deepEqual(getValidPropertyMedia(property, 'images').map(({ media }) => getMediaUrl(media)), [
    'https://cdn.example.test/cover.jpg',
    'relative/photo.jpg'
  ]);
  assert.deepEqual(getValidPropertyMedia(property, 'videos').map(({ media }) => getMediaUrl(media)), [
    'https://cdn.example.test/tour.mp4'
  ]);
  assert.equal(getEditablePropertyMedia(property, 'images').at(-1).sourceIndex, 2);
});

test('orders retained and uploaded media with the selected new cover first', () => {
  const existing = [
    { key: 'saved-0', sourceIndex: 0 },
    { key: 'saved-1', sourceIndex: 1 }
  ];
  const added = [
    { key: 'new-0', index: 0 },
    { key: 'new-1', index: 1 }
  ];

  assert.deepEqual(createMediaOrder(existing, added, 'new-1'), [
    'upload:1',
    'existing:0',
    'existing:1',
    'upload:0'
  ]);
  assert.deepEqual(createMediaOrder(existing, added, 'saved-1'), [
    'existing:1',
    'existing:0',
    'upload:0',
    'upload:1'
  ]);
});

test('gallery navigation wraps in both directions and handles an empty collection', () => {
  assert.equal(getWrappedMediaIndex(0, -1, 4), 3);
  assert.equal(getWrappedMediaIndex(3, 1, 4), 0);
  assert.equal(getWrappedMediaIndex(0, 1, 0), 0);
});

test('validates upload types, per-file size and server-aligned per-request counts', () => {
  const image = { name: 'room.jpg', type: 'image/jpeg', size: 1024 };
  const video = { name: 'tour.mp4', type: 'video/mp4', size: 2048 };
  assert.equal(validatePropertyMediaFiles([image], [video]), null);
  assert.match(validatePropertyMediaFiles([{ ...image, name: 'script.svg', type: 'image/svg+xml', size: 101 * 1024 * 1024 }], []), /100 MB/);
  assert.match(validatePropertyMediaFiles([{ ...image, type: 'text/plain' }], []), /supported image/);
  assert.match(validatePropertyMediaFiles([], [{ ...video, name: 'tour.exe' }]), /supported video/);
  assert.match(validatePropertyMediaFiles(Array.from({ length: 16 }, () => image), []), /no more than 15 images/);
  assert.match(validatePropertyMediaFiles([], Array.from({ length: 6 }, () => video)), /no more than 5 videos/);
  assert.match(validatePropertyMediaFiles(
    Array.from({ length: 3 }, (_, index) => ({ ...image, name: `room-${index}.jpg`, size: 80 * 1024 * 1024 })),
    []
  ), /200 MB total upload limit/);
});

test('enforces the smaller room-media request limits', () => {
  const image = { name: 'room.jpg', type: 'image/jpeg', size: 1024 };
  const video = { name: 'room.mp4', type: 'video/mp4', size: 1024 };
  assert.equal(validateRoomMediaFiles([image], [video]), null);
  assert.match(validateRoomMediaFiles(Array.from({ length: 6 }, () => image), []), /no more than 5 room images/);
  assert.match(validateRoomMediaFiles([], Array.from({ length: 3 }, () => video)), /no more than 2 room videos/);
  assert.match(validateRoomMediaFiles([{ ...image, size: 11 * 1024 * 1024 }], []), /10 MB room-media limit/);
});
