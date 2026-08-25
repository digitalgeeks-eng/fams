export const PREDEFINED_LOCATIONS = [
  'Gandu',
  'Maraba',
  'Gimare',
  'Bukan Kota',
  'Akunza',
  'Tudun Kauri'
];

export const LEGACY_LOCATION_ALIASES = {
  Mararaba: 'Maraba',
  'Bukan Koto': 'Bukan Kota'
};

export const normalizePropertyLocation = ({ location, customLocation }) => {
  const selectedLocation = String(location || '').trim();
  if (selectedLocation.toLowerCase() === 'other') {
    const custom = String(customLocation || '').trim();
    if (!custom) return null;
    const customAlias = Object.keys(LEGACY_LOCATION_ALIASES).find((key) => key.toLowerCase() === custom.toLowerCase());
    if (customAlias) return LEGACY_LOCATION_ALIASES[customAlias];
    const predefinedCustom = PREDEFINED_LOCATIONS.find((item) => item.toLowerCase() === custom.toLowerCase());
    return predefinedCustom || custom;
  }

  if (!selectedLocation) return null;
  const alias = Object.keys(LEGACY_LOCATION_ALIASES).find((key) => key.toLowerCase() === selectedLocation.toLowerCase());
  if (alias) return LEGACY_LOCATION_ALIASES[alias];
  const predefined = PREDEFINED_LOCATIONS.find((item) => item.toLowerCase() === selectedLocation.toLowerCase());
  return predefined || null;
};