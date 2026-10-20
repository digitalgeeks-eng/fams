export const ROOM_TYPES = ['Single Room', 'Self-Contain', 'Room and Parlour', 'Mini Flat', 'Other'];
export const ROOM_STATUSES = ['available', 'reserved', 'occupied', 'unavailable'];
export const ROOM_FACILITY_STATES = ['private', 'shared', 'none', 'unknown'];
export const ROOM_WATER_SOURCES = ['tap', 'borehole', 'well', 'other', 'unavailable', 'unknown'];

export const validateRoomInput = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Enter valid room information.';
  const roomNumber = String(input.roomNumber || '').trim().toUpperCase();
  if (!roomNumber || roomNumber.length > 40) return 'Each room must have a label of 1 to 40 characters.';
  if (!ROOM_TYPES.includes(input.type)) return `Select a supported room type for ${roomNumber}.`;
  if (input.price === undefined || input.price === null || String(input.price).trim() === '') return `Enter a rent for ${roomNumber}.`;
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0 || price > Number.MAX_SAFE_INTEGER) return `Enter a valid non-negative rent for ${roomNumber}.`;
  if (input.billingPeriod !== undefined && !['yearly', 'monthly', 'weekly', 'daily'].includes(input.billingPeriod)) return `Select a valid rent period for ${roomNumber}.`;
  if (input.status !== undefined && !ROOM_STATUSES.includes(input.status)) return `Select a valid availability status for ${roomNumber}.`;
  for (const field of ['toilet', 'shower', 'kitchen']) {
    if (input[field] !== undefined && !ROOM_FACILITY_STATES.includes(input[field])) return `Select a valid ${field} configuration for ${roomNumber}.`;
  }
  if (input.waterSource !== undefined && !ROOM_WATER_SOURCES.includes(input.waterSource)) return `Select a valid water source for ${roomNumber}.`;
  if (input.waterAvailable !== undefined && input.waterAvailable !== null && typeof input.waterAvailable !== 'boolean') return `Select a valid water availability for ${roomNumber}.`;
  if (input.electricity !== undefined && input.electricity !== null && typeof input.electricity !== 'boolean') return `Select a valid electricity availability for ${roomNumber}.`;
  for (const field of ['facilities', 'images', 'videos']) {
    if (input[field] !== undefined && !Array.isArray(input[field])) return `${field} must be a list for ${roomNumber}.`;
  }
  if ((input.facilities || []).some((item) => String(item).trim().length > 80)) return `A facility name is too long for ${roomNumber}.`;
  if (String(input.title || '').length > 120 || String(input.description || '').length > 2000
    || String(input.statusReason || '').length > 500 || String(input.floorSection || '').length > 80) {
    return `One or more room details are too long for ${roomNumber}.`;
  }
  return null;
};

export const isRoomInspectionEligible = (property, room, now = new Date()) => Boolean(
  property
  && room
  && property.managementMode === 'multi_room'
  && property.approvalStatus === 'approved'
  && !property.isDeleted
  && !property.isUnavailable
  && property.availabilityStatus !== 'not_available'
  && (!property.visibleUntil || new Date(property.visibleUntil) > now)
  && room.status === 'available'
  && room.isActive
);
