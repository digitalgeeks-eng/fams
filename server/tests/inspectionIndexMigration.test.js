import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import RoomInspectionRequest from '../models/RoomInspectionRequest.js';
import {
  assertExecutionApproval,
  assertKnownIndexes,
  assertSafePreflight,
  disableAutomaticModelCreation,
  EXPECTED_DATABASE_NAME,
  getDeclaredIndexDefinitions,
  getDuplicateGroupCounts,
  LEGACY_PENDING_ROOM_INDEX,
  parseMode,
  runIndexMigration
} from '../scripts/migrateRoomInspectionIndexes.js';

const declaredIndexes = getDeclaredIndexDefinitions(RoomInspectionRequest.schema);
const idIndex = { name: '_id_', key: { _id: 1 }, v: 2 };
const expectedRoomIndex = declaredIndexes.find((index) => index.name === 'roomId_1_studentId_1');
const expectedBookingIndex = declaredIndexes.find((index) => index.name === 'activeBookingId_1');

const fakeCollection = ({ indexes = [idIndex], duplicateGroups = [[], []] } = {}) => {
  const pipelines = [];
  const drops = [];
  let currentIndexes = indexes;
  return {
    pipelines,
    drops,
    indexes: async () => currentIndexes,
    setIndexes(nextIndexes) { currentIndexes = nextIndexes; },
    aggregate(pipeline) {
      pipelines.push(pipeline);
      const results = duplicateGroups[pipelines.length - 1];
      return { toArray: async () => results };
    },
    dropIndex: async (name) => { drops.push(name); }
  };
};

test('declared unique inspection indexes retain their partial uniqueness constraints', () => {
  assert.equal(expectedRoomIndex.unique, true);
  assert.deepEqual(expectedRoomIndex.partialFilterExpression, {
    roomId: { $exists: true },
    status: 'pending'
  });
  assert.equal(expectedBookingIndex.unique, true);
  assert.deepEqual(expectedBookingIndex.partialFilterExpression, {
    activeBookingId: { $exists: true }
  });
});

test('accepts the exact legacy index and current declared indexes', () => {
  assert.doesNotThrow(() => assertKnownIndexes(
    [idIndex, { ...LEGACY_PENDING_ROOM_INDEX, v: 2 }, expectedBookingIndex],
    declaredIndexes
  ));
});

test('rejects an unexpected index or a same-name index with incompatible options', () => {
  assert.throws(
    () => assertKnownIndexes(
      [idIndex, { name: 'unexpected_1', key: { unexpected: 1 }, v: 2 }],
      declaredIndexes
    ),
    /unexpected or incompatible index/i
  );
  assert.throws(
    () => assertKnownIndexes(
      [idIndex, { ...LEGACY_PENDING_ROOM_INDEX, partialFilterExpression: { status: 'pending', roomId: { $exists: false } }, v: 2 }],
      declaredIndexes
    ),
    /unexpected or incompatible index/i
  );
});

test('rejects an unexpected target database before any migration can proceed', () => {
  assert.throws(
    () => assertSafePreflight({
      databaseName: 'another-database',
      indexes: [idIndex],
      declaredIndexes,
      duplicateGroups: { activeBookingId: 0, pendingRoomAndStudent: 0 }
    }),
    new RegExp(EXPECTED_DATABASE_NAME)
  );
});

test('defaults to read-only preflight and rejects ambiguous command arguments', () => {
  assert.equal(parseMode([]), 'preflight');
  assert.equal(parseMode(['--preflight']), 'preflight');
  assert.equal(parseMode(['--execute']), 'execute');
  assert.throws(() => parseMode(['--execute', '--preflight']), /either --preflight or --execute/i);
  assert.throws(() => parseMode(['--force']), /either --preflight or --execute/i);
});

test('disables automatic index and collection creation for the migration connection', () => {
  const originalAutoIndex = mongoose.get('autoIndex');
  const originalAutoCreate = mongoose.get('autoCreate');

  try {
    mongoose.set('autoIndex', true);
    mongoose.set('autoCreate', true);
    disableAutomaticModelCreation();
    assert.equal(mongoose.get('autoIndex'), false);
    assert.equal(mongoose.get('autoCreate'), false);
  } finally {
    mongoose.set('autoIndex', originalAutoIndex);
    mongoose.set('autoCreate', originalAutoCreate);
  }
});

test('requires execution acknowledgements for paused writes, verified backup, and target database', () => {
  assert.throws(() => assertExecutionApproval({}), /writes are paused/i);
  assert.throws(
    () => assertExecutionApproval({ MIGRATION_WRITES_PAUSED: 'true' }),
    /backup has been verified/i
  );
  assert.throws(
    () => assertExecutionApproval({
      MIGRATION_WRITES_PAUSED: 'true',
      MIGRATION_BACKUP_VERIFIED: 'true',
      MIGRATION_EXPECTED_DATABASE: 'another-database'
    }),
    /MIGRATION_EXPECTED_DATABASE=fulafia-ams/i
  );
  assert.doesNotThrow(() => assertExecutionApproval({
    MIGRATION_WRITES_PAUSED: 'true',
    MIGRATION_BACKUP_VERIFIED: 'true',
    MIGRATION_EXPECTED_DATABASE: EXPECTED_DATABASE_NAME
  }));
});

test('duplicate detection groups present active booking references and pending room/student pairs', async () => {
  const collection = fakeCollection({
    duplicateGroups: [[{ duplicateGroups: 2 }], [{ duplicateGroups: 1 }]]
  });

  assert.deepEqual(await getDuplicateGroupCounts(collection), {
    activeBookingId: 2,
    pendingRoomAndStudent: 1
  });
  assert.deepEqual(collection.pipelines[0][0], {
    $match: { activeBookingId: { $exists: true } }
  });
  assert.deepEqual(collection.pipelines[1][0], {
    $match: { roomId: { $exists: true }, status: 'pending' }
  });
});

test('refuses duplicate groups without dropping indexes or creating replacements', async () => {
  const collection = fakeCollection({
    indexes: [idIndex, { ...LEGACY_PENDING_ROOM_INDEX, v: 2 }],
    duplicateGroups: [[{ duplicateGroups: 1 }], []]
  });
  let createCalled = false;

  await assert.rejects(
    runIndexMigration({
      collection,
      createIndexes: async () => { createCalled = true; },
      declaredIndexes,
      databaseName: EXPECTED_DATABASE_NAME
    }),
    /duplicate inspection groups/i
  );
  assert.deepEqual(collection.drops, []);
  assert.equal(createCalled, false);
});

test('refuses unexpected indexes without dropping or creating indexes', async () => {
  const collection = fakeCollection({
    indexes: [idIndex, { name: 'unexpected_1', key: { unexpected: 1 }, v: 2 }]
  });
  let createCalled = false;

  await assert.rejects(
    runIndexMigration({
      collection,
      createIndexes: async () => { createCalled = true; },
      declaredIndexes,
      databaseName: EXPECTED_DATABASE_NAME
    }),
    /unexpected or incompatible index/i
  );
  assert.deepEqual(collection.drops, []);
  assert.equal(createCalled, false);
});

test('refuses a wrong database without dropping or creating indexes', async () => {
  const collection = fakeCollection();
  let createCalled = false;

  await assert.rejects(
    runIndexMigration({
      collection,
      createIndexes: async () => { createCalled = true; },
      declaredIndexes,
      databaseName: 'not-fulafia-ams'
    }),
    /expected fulafia-ams/i
  );
  assert.deepEqual(collection.drops, []);
  assert.equal(createCalled, false);
});

test('drops only the exact legacy index and creates declared indexes after safe checks', async () => {
  const collection = fakeCollection({
    indexes: [idIndex, { ...LEGACY_PENDING_ROOM_INDEX, v: 2 }]
  });
  let createCalled = false;

  const result = await runIndexMigration({
    collection,
    createIndexes: async () => {
      createCalled = true;
      collection.setIndexes([idIndex, ...declaredIndexes]);
    },
    declaredIndexes,
    databaseName: EXPECTED_DATABASE_NAME
  });

  assert.deepEqual(collection.drops, [LEGACY_PENDING_ROOM_INDEX.name]);
  assert.equal(createCalled, true);
  assert.equal(result.droppedLegacyIndex, true);
  assert.ok(result.verifiedIndexes.includes('activeBookingId_1'));
});

test('fails verification if declared indexes are not present after the create step', async () => {
  const collection = fakeCollection();

  await assert.rejects(
    runIndexMigration({
      collection,
      createIndexes: async () => {},
      declaredIndexes,
      databaseName: EXPECTED_DATABASE_NAME
    }),
    /expected index was not created/i
  );
});
