export const getPropertyContactPhone = (contact) => {
  if (!contact) return '';
  if (contact.contactPhone !== undefined && contact.contactPhone !== null) return contact.contactPhone;
  return contact.whatsapp || contact.phone || '';
};

export const getLegacyContactConflict = (contact) => {
  const phone = contact?.phone?.trim() || '';
  const whatsapp = contact?.whatsapp?.trim() || '';
  return phone && whatsapp && phone !== whatsapp ? { phone, whatsapp } : null;
};
