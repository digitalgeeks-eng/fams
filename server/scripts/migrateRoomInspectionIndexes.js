import mongoose from 'mongoose';
import connectDatabase from '../config/db.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXPECTED_DATABASE_NAME = 'fulafia-ams';
export const LEGACY_PENDING_ROOM_INDEX = {
  name: 'roomId_1_studentId_1',
  key: { roomId: 1, studentId: 1 },
  unique: true,
  partialFilterExpression: { status: 'pending' }
};

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
  );
};

const canonicalJson = (value) => JSON.stringify(canonicalize(value));

const getIndexName = (key) => Object.entries(key)
  .map(([field, direction]) => `${field}_${direction}`)
  .join('_');

const normalizeOptions = (options = {}) => Object.fromEntries(
  Object.entries(options)
    .filter(([name]) => !['background', 'name', 'ns', 'v'].includes(name))
    .sort(([first], [second]) => first.localeCompare(second))
);

const normalizedIndex = ({ key, ...options }) => ({
  key: Object.entries(key || {}),
  options: normalizeOptions(options)
});

export const getDeclaredIndexDefinitions = (schema) => schema.indexes().map(([key, options]) => ({
  name: options.name || getIndexName(key),
  key,
  ...normalizeOptions(options)
}));

const isExactLegacyIndex = (index) => (
  index.name === LEGACY_PENDING_ROOM_INDEX.name
  && canonicalJson(normalizedIndex(index)) === canonicalJson(normalizedIndex(LEGACY_PENDING_ROOM_INDEX))
);

export const parseMode = (args) => {
  if (args.length === 0 || (args.length === 1 && args[0] === '--preflight')) return 'preflight';
  if (args.length === 1 && args[0] === '--execute') return 'execute';
  throw new Error('Use either --preflight or --execute.');
};

export const disableAutomaticModelCreation = () => {
  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);
};

export const assertKnownIndexes = (indexes, declaredIndexes) => {
  const allowedIndexes = new Map(declaredIndexes.map((index) => [index.name, index]));
  const names = new Set();

  for (const index of indexes) {
    if (names.has(index.name)) {
      throw new Error(`Duplicate index name detected: ${index.name}`);
    }
    names.add(index.name);

    if (index.name === '_id_') {
      const { key, ...rawOptions } = index;
      const options = normalizeOptions(rawOptions);
      const hasOnlyExpectedOptions = Object.entries(options).every(([name, value]) => name === 'unique' && value === true);
      if (canonicalJson(Object.entries(key || {})) !== canonicalJson([['_id', 1]]) || !hasOnlyExpectedOptions) {
        throw new Error('The _id_ index has an unexpected definition.');
      }
      continue;
    }

    const declaredIndex = allowedIndexes.get(index.name);
    if (declaredIndex && canonicalJson(normalizedIndex(index)) === canonicalJson(normalizedIndex(declaredIndex))) {
      continue;
    }
    if (isExactLegacyIndex(index)) continue;

    throw new Error(`Unexpected or incompatible index detected: ${index.name}`);
  }

  if (!names.has('_id_')) {
    throw new Error('The required _id_ index is missing.');
  }
};

const assertDeclaredIndexesExist = (indexes, declaredIndexes) => {
  assertKnownIndexes(indexes, declaredIndexes);
  const indexesByName = new Map(indexes.map((index) => [index.name, index]));

  for (const declaredIndex of declaredIndexes) {
    const currentIndex = indexesByName.get(declaredIndex.name);
    if (!currentIndex || canonicalJson(normalizedIndex(currentIndex)) !== canonicalJson(normalizedIndex(declaredIndex))) {
      throw new Error(`Expected index was not created with its declared definition: ${declaredIndex.name}`);
    }
  }
  if (indexes.some(isExactLegacyIndex)) {
    throw new Error(`Legacy index was not removed: ${LEGACY_PENDING_ROOM_INDEX.name}`);
  }
};

export const getDuplicateGroupCounts = async (collection) => {
  const [activeBookingResult, pendingRoomResult] = await Promise.all([
    collection.aggregate([
      { $match: { activeBookingId: { $exists: true } } },
      { $group: { _id: '$activeBookingId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'duplicateGroups' }
    ], { maxTimeMS: 15000 }).toArray(),
    collection.aggregate([
      { $match: { roomId: { $exists: true }, status: 'pending' } },
      { $group: { _id: { roomId: '$roomId', studentId: '$studentId' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'duplicateGroups' }
    ], { maxTimeMS: 15000 }).toArray()
  ]);

  return {
    activeBookingId: activeBookingResult[0]?.duplicateGroups || 0,
    pendingRoomAndStudent: pendingRoomResult[0]?.duplicateGroups || 0
  };
};

export const assertSafePreflight = ({ databaseName, indexes, declaredIndexes, duplicateGroups }) => {
  if (databaseName !== EXPECTED_DATABASE_NAME) {
    throw new Error(`Refusing database operation: expected ${EXPECTED_DATABASE_NAME}, received ${databaseName || '(unset)'}.`);
  }
  assertKnownIndexes(indexes, declaredIndexes);
  if (duplicateGroups.activeBookingId > 0 || duplicateGroups.pendingRoomAndStudent > 0) {
    throw new Error(
      `Duplicate inspection groups prevent unique index creation (activeBookingId: ${duplicateGroups.activeBookingId}, pending room/student: ${duplicateGroups.pendingRoomAndStudent}).`
    );
  }
};

export const assertExecutionApproval = (environment = process.env) => {
  if (environment.MIGRATION_WRITES_PAUSED !== 'true') {
    throw new Error('Set MIGRATION_WRITES_PAUSED=true only after booking, inspection, and payment writes are paused.');
  }
  if (environment.MIGRATION_BACKUP_VERIFIED !== 'true') {
    throw new Error('Set MIGRATION_BACKUP_VERIFIED=true only after a restorable backup has been verified.');
  }
  if (environment.MIGRATION_EXPECTED_DATABASE !== EXPECTED_DATABASE_NAME) {
    throw new Error(`Set MIGRATION_EXPECTED_DATABASE=${EXPECTED_DATABASE_NAME} after verifying the intended target.`);
  }
};

export const runIndexMigration = async ({ collection, createIndexes, declaredIndexes, databaseName }) => {
  const indexes = await collection.indexes();
  const duplicateGroups = await getDuplicateGroupCounts(collection);
  assertSafePreflight({ databaseName, indexes, declaredIndexes, duplicateGroups });

  const legacyIndex = indexes.find(isExactLegacyIndex);
  if (legacyIndex) await collection.dropIndex(LEGACY_PENDING_ROOM_INDEX.name);
  await createIndexes();
  const migratedIndexes = await collection.indexes();
  assertDeclaredIndexesExist(migratedIndexes, declaredIndexes);

  return {
    droppedLegacyIndex: Boolean(legacyIndex),
    verifiedIndexes: declaredIndexes.map((index) => index.name)
  };
};

const run = async (mode) => {
  if (!['preflight', 'execute'].includes(mode)) {
    throw new Error('Use --preflight or --execute.');
  }
  if (mode === 'execute') assertExecutionApproval();

  disableAutomaticModelCreation();
  await connectDatabase({ autoIndex: false, autoCreate: false });

  try {
    const { default: RoomInspectionRequest } = await import('../models/RoomInspectionRequest.js');
    const collection = RoomInspectionRequest.collection;
    const declaredIndexes = getDeclaredIndexDefinitions(RoomInspectionRequest.schema);
    const indexes = await collection.indexes();
    const duplicateGroups = await getDuplicateGroupCounts(collection);
    assertSafePreflight({
      databaseName: mongoose.connection.name,
      indexes,
      declaredIndexes,
      duplicateGroups
    });

    const report = {
      host: mongoose.connection.host,
      database: mongoose.connection.name,
      collection: collection.collectionName,
      indexes: indexes.map((index) => ({
        name: index.name,
        key: index.key,
        ...normalizeOptions(index)
      })),
      duplicateGroups,
      safeToMigrate: true
    };

    if (mode === 'preflight') {
      console.log(JSON.stringify({ mode, ...report }, null, 2));
      return;
    }

    const result = await runIndexMigration({
      collection,
      createIndexes: () => RoomInspectionRequest.createIndexes(),
      declaredIndexes,
      databaseName: mongoose.connection.name
    });
    console.log(JSON.stringify({ mode, ...report, ...result }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
};

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  Promise.resolve()
    .then(() => run(parseMode(process.argv.slice(2))))
    .catch((error) => {
      console.error('Room inspection index operation failed:', error.message);
      process.exitCode = 1;
    });
}
