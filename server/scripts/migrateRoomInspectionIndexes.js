import connectDatabase from '../config/db.js';
import RoomInspectionRequest from '../models/RoomInspectionRequest.js';

const migrateRoomInspectionIndexes = async () => {
  await connectDatabase();
  const indexes = await RoomInspectionRequest.collection.indexes();
  const legacyPendingRoomIndex = indexes.find((index) => (
    index.name === 'roomId_1_studentId_1'
    && index.unique
    && index.partialFilterExpression?.status === 'pending'
    && !index.partialFilterExpression?.roomId
  ));

  if (legacyPendingRoomIndex) {
    await RoomInspectionRequest.collection.dropIndex(legacyPendingRoomIndex.name);
  }

  await RoomInspectionRequest.createIndexes();
};

migrateRoomInspectionIndexes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Room inspection index migration failed:', error);
    process.exit(1);
  });
