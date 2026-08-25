import { PREDEFINED_LOCATIONS, LEGACY_LOCATION_ALIASES } from './locations.js';

export const ADMIN_ROLES = ['super_admin', 'location_admin'];
export const ADMIN_LOCATIONS = [...PREDEFINED_LOCATIONS, 'Other'];

export const normalizeAdminLocation = (location) => {
  const value = String(location || '').trim();
  const alias = Object.keys(LEGACY_LOCATION_ALIASES).find((key) => key.toLowerCase() === value.toLowerCase());
  if (alias) return LEGACY_LOCATION_ALIASES[alias];
  return ADMIN_LOCATIONS.find((item) => item.toLowerCase() === value.toLowerCase()) || null;
};

export const isSuperAdmin = (user) => user?.role === 'admin' && (user.adminRole || 'super_admin') === 'super_admin';

export const getAdminPropertyFilter = (user) => {
  if (isSuperAdmin(user)) return {};
  const assignedLocation = normalizeAdminLocation(user?.assignedLocation);
  if (!assignedLocation) return { _id: null };
  const legacyValues = Object.entries(LEGACY_LOCATION_ALIASES)
    .filter(([, canonical]) => canonical === assignedLocation)
    .map(([legacy]) => legacy);
  const locationValues = assignedLocation === 'Other' ? [] : [assignedLocation, ...legacyValues];
  return {
    $or: [
      { locationCategory: assignedLocation },
      ...(locationValues.length ? [{ location: { $in: locationValues } }] : [{ locationCategory: { $exists: false }, location: { $nin: ADMIN_LOCATIONS.filter((item) => item !== 'Other').flatMap((item) => [item, ...Object.keys(LEGACY_LOCATION_ALIASES).filter((key) => LEGACY_LOCATION_ALIASES[key] === item)]) } }])
    ]
  };
};

export const assertAdminPropertyAccess = (user, property) => {
  if (isSuperAdmin(user)) return true;
  const assignedLocation = normalizeAdminLocation(user?.assignedLocation);
  const category = normalizeAdminLocation(property?.locationCategory);
  if (category) return category === assignedLocation;
  if (assignedLocation === 'Other') return !ADMIN_LOCATIONS.slice(0, -1).some((item) => item.toLowerCase() === String(property?.location || '').trim().toLowerCase());
  return assignedLocation === normalizeAdminLocation(property?.location);
};

export const adminAccessMessage = 'You do not have permission to manage properties outside your assigned location.';
