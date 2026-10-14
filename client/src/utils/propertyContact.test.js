import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLegacyContactConflict, getPropertyContactPhone } from './propertyContact.js';

test('prefers a property contact number while preserving and reporting differing legacy values', () => {
  const contact = {
    phone: '08011112222',
    whatsapp: '08106083399'
  };
  assert.equal(getPropertyContactPhone(contact), '08106083399');
  assert.deepEqual(getLegacyContactConflict(contact), {
    phone: '08011112222',
    whatsapp: '08106083399'
  });
  assert.equal(contact.phone, '08011112222');
  assert.equal(contact.whatsapp, '08106083399');
});

test('an explicitly cleared canonical number does not reveal old legacy values in edit UI', () => {
  const contact = {
    contactPhone: '',
    phone: '08011112222',
    whatsapp: '08106083399'
  };
  assert.equal(getPropertyContactPhone(contact), '');
  assert.ok(getLegacyContactConflict(contact));
});
