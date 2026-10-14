export const normalizeNigerianPhoneNumber = (value) => {
  if (typeof value !== 'string') return null;
  const phone = value.trim();
  return /^(?:0[789][01]\d{8}|\+234[789][01]\d{8})$/.test(phone) ? phone : null;
};

export const getPropertyContactNumber = (property) => {
  const contact = property?.adminContact;
  if (!contact) return '';
  if (contact.contactPhone !== undefined && contact.contactPhone !== null) return contact.contactPhone;
  return contact.whatsapp || contact.phone || '';
};

export const hasConflictingLegacyContactNumbers = (property) => {
  const phone = property?.adminContact?.phone?.trim();
  const whatsapp = property?.adminContact?.whatsapp?.trim();
  return Boolean(phone && whatsapp && phone !== whatsapp);
};
