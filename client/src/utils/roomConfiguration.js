export const ROOM_CONFIGURATION_FIELDS = [
  'title',
  'type',
  'description',
  'price',
  'billingPeriod',
  'toilet',
  'shower',
  'kitchen',
  'waterSource',
  'waterAvailable',
  'electricity',
  'facilities',
  'floorSection'
];

export const applyRoomConfiguration = (room, values, selectedFields = ROOM_CONFIGURATION_FIELDS) => {
  const next = { ...room };
  for (const field of selectedFields) {
    if (ROOM_CONFIGURATION_FIELDS.includes(field) && values[field] !== undefined) {
      next[field] = values[field];
    }
  }
  return next;
};

export const getRoomConfiguration = (room) => Object.fromEntries(
  ROOM_CONFIGURATION_FIELDS
    .filter((field) => room[field] !== undefined)
    .map((field) => [field, room[field]])
);

export const hasRoomConfigurationChanges = (room, values, selectedFields) => selectedFields.some((field) => (
  ROOM_CONFIGURATION_FIELDS.includes(field)
  && values[field] !== undefined
  && JSON.stringify(room[field] ?? null) !== JSON.stringify(values[field] ?? null)
));
