import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Writable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import Property from '../models/Property.js';
import PropertyEditHistory from '../models/PropertyEditHistory.js';
import { createProperty, updateProperty } from '../controllers/propertyController.js';
import { PROPERTY_MEDIA_LIMITS, resolvePropertyMediaOrder } from '../utils/propertyMedia.js';

process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';

const makeResponse = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

test('validates media manifests and preserves uploaded order', () => {
  assert.deepEqual(PROPERTY_MEDIA_LIMITS, { images: 15, videos: 5 });
  assert.deepEqual(resolvePropertyMediaOrder('["existing:1","upload:0"]', 2, 1), [
    'existing:1',
    'upload:0'
  ]);
  assert.deepEqual(resolvePropertyMediaOrder(undefined, 2, 1), [
    'existing:0',
    'existing:1',
    'upload:0'
  ]);
  assert.equal(resolvePropertyMediaOrder('not-json', 2, 0), null);
  assert.equal(resolvePropertyMediaOrder('["existing:2"]', 2, 0), null);
  assert.equal(resolvePropertyMediaOrder('["upload:0"]', 0, 2), null);
  assert.equal(resolvePropertyMediaOrder('["upload:0","upload:0"]', 0, 1), null);
});

test('legacy single-image and single-video properties remain valid without migration', () => {
  const legacyProperty = new Property({
    title: 'Legacy media property',
    description: 'A listing using older single-media fields.',
    location: 'Gandu',
    type: 'Single Room',
    price: 100000,
    agentId: '507f1f77bcf86cd799439011',
    image: 'https://cdn.example.test/legacy.jpg',
    video: { url: 'https://cdn.example.test/legacy.mp4' }
  });
  assert.equal(legacyProperty.validateSync(), undefined);
});

test('property creation stores multiple images and videos in the requested order', async () => {
  const originals = {
    create: Property.create,
    uploadStream: cloudinary.uploader.upload_stream
  };
  let imageUpload = 0;
  Property.create = async (data) => data;
  cloudinary.uploader.upload_stream = (options, callback) => {
    const index = options.resource_type === 'image' ? imageUpload++ : 0;
    return new Writable({
      write(chunk, encoding, done) {
        done();
      },
      final(done) {
        callback(null, {
          public_id: `${options.resource_type}-${index}`,
          secure_url: `https://cdn.example.test/${options.resource_type}-${index}`
        });
        done();
      }
    });
  };

  try {
    const response = makeResponse();
    await createProperty({
      body: {
        title: 'Media ordering test',
        description: 'A property with multiple media files.',
        location: 'Gandu',
        type: 'Single Room',
        price: '100000',
        imageOrder: JSON.stringify(['upload:1', 'upload:0']),
        videoOrder: JSON.stringify(['upload:0'])
      },
      files: {
        images: [
          { mimetype: 'image/jpeg', buffer: Buffer.from('image zero') },
          { mimetype: 'image/jpeg', buffer: Buffer.from('image one') }
        ],
        videos: [{ mimetype: 'video/mp4', buffer: Buffer.from('video') }]
      },
      user: { _id: 'agent-media-create', role: 'agent' }
    }, response);

    assert.equal(response.statusCode, 201);
    assert.deepEqual(response.body.data.images.map((item) => item.publicId), ['image-1', 'image-0']);
    assert.deepEqual(response.body.data.videos.map((item) => item.publicId), ['video-0']);
  } finally {
    Property.create = originals.create;
    cloudinary.uploader.upload_stream = originals.uploadStream;
  }
});

test('editing media preserves selected order, removes only deselected items and protects shared assets', async () => {
  const originals = {
    findById: Property.findById,
    findByIdAndUpdate: Property.findByIdAndUpdate,
    exists: Property.exists,
    historyCreate: PropertyEditHistory.create,
    uploadStream: cloudinary.uploader.upload_stream,
    destroy: cloudinary.uploader.destroy
  };
  const property = {
    _id: 'property-media-test',
    agentId: { toString: () => 'agent-media-test' },
    price: 100000,
    location: 'Gandu',
    locationCategory: 'Gandu',
    images: [
      {
        url: 'https://cdn.example.test/shared.jpg',
        publicId: 'fulafia-ams/properties/images/shared',
        resourceType: 'image'
      },
      { url: 'https://cdn.example.test/keep.jpg', publicId: 'keep-image', resourceType: 'image' }
    ],
    videos: [{ url: 'https://cdn.example.test/tour.mp4', publicId: 'keep-video', resourceType: 'video' }],
    adminContact: {},
    toObject() {
      return { ...this };
    }
  };
  let updates;
  let deleteCalls = 0;
  let deletedPublicId;
  Property.findById = async () => property;
  Property.findByIdAndUpdate = async (id, value) => {
    updates = value;
    return { ...property, ...value, images: value.images, videos: value.videos, toObject: property.toObject };
  };
  Property.exists = async () => true;
  PropertyEditHistory.create = async () => {};
  cloudinary.uploader.upload_stream = (options, callback) => new Writable({
    write(chunk, encoding, done) {
      done();
    },
    final(done) {
      callback(null, {
        public_id: 'uploaded-image',
        secure_url: 'https://cdn.example.test/uploaded.jpg'
      });
      done();
    }
  });
  cloudinary.uploader.destroy = async (publicId) => {
    deleteCalls += 1;
    deletedPublicId = publicId;
    return { result: 'ok' };
  };

  try {
    const response = makeResponse();
    await updateProperty({
      params: { id: property._id },
      body: {
        imageOrder: JSON.stringify(['existing:1', 'upload:0']),
        videoOrder: JSON.stringify(['existing:0'])
      },
      files: { images: [{ mimetype: 'image/jpeg', buffer: Buffer.from('synthetic image') }] },
      user: { _id: 'agent-media-test', role: 'agent' }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(updates.images.map((item) => item.publicId), ['keep-image', 'uploaded-image']);
    assert.deepEqual(updates.videos.map((item) => item.publicId), ['keep-video']);
    assert.deepEqual(updates.$unset, { image: '', video: '' });
    assert.equal(deleteCalls, 0);
  } finally {
    Property.findById = originals.findById;
    Property.findByIdAndUpdate = originals.findByIdAndUpdate;
    Property.exists = originals.exists;
    PropertyEditHistory.create = originals.historyCreate;
    cloudinary.uploader.upload_stream = originals.uploadStream;
    cloudinary.uploader.destroy = originals.destroy;
  }
});

test('deletes only removed assets from the managed Cloudinary folder when unreferenced', async () => {
  const originals = {
    findById: Property.findById,
    findByIdAndUpdate: Property.findByIdAndUpdate,
    exists: Property.exists,
    historyCreate: PropertyEditHistory.create,
    destroy: cloudinary.uploader.destroy
  };
  const keptImage = {
    url: 'https://cdn.example.test/cover.jpg',
    publicId: 'fulafia-ams/properties/images/cover',
    resourceType: 'image'
  };
  const removedImage = {
    url: 'https://cdn.example.test/other.jpg',
    publicId: 'fulafia-ams/properties/images/other',
    resourceType: 'image'
  };
  const property = {
    _id: 'property-reorder-test',
    agentId: { toString: () => 'agent-reorder-test' },
    price: 100000,
    location: 'Gandu',
    locationCategory: 'Gandu',
    images: [keptImage, removedImage],
    videos: [],
    adminContact: {},
    toObject() {
      return { ...this };
    }
  };
  let deleteCalls = 0;
  let deletedPublicId;
  let updates;
  Property.findById = async () => property;
  Property.findByIdAndUpdate = async (id, value) => {
    updates = value;
    return {
      ...property,
      ...value,
      images: value.images,
      videos: value.videos,
      toObject: property.toObject
    };
  };
  Property.exists = async () => false;
  PropertyEditHistory.create = async () => {};
  cloudinary.uploader.destroy = async (publicId) => {
    deleteCalls += 1;
    deletedPublicId = publicId;
    return { result: 'ok' };
  };

  try {
    const response = makeResponse();
    await updateProperty({
      params: { id: property._id },
      body: { imageOrder: JSON.stringify(['existing:0']), videoOrder: '[]' },
      user: { _id: 'agent-reorder-test', role: 'agent' }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(updatesForResponse(response).images.map((item) => item.publicId), [keptImage.publicId]);
    assert.equal(deleteCalls, 1);
    assert.equal(deletedPublicId, removedImage.publicId);
  } finally {
    Property.findById = originals.findById;
    Property.findByIdAndUpdate = originals.findByIdAndUpdate;
    Property.exists = originals.exists;
    PropertyEditHistory.create = originals.historyCreate;
    cloudinary.uploader.destroy = originals.destroy;
  }
});

const updatesForResponse = (response) => response.body.data;
