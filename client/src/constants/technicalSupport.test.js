import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TECHNICAL_SUPPORT_CALL_HREF,
  TECHNICAL_SUPPORT_MESSAGE,
  TECHNICAL_SUPPORT_PHONE,
  TECHNICAL_SUPPORT_WHATSAPP_HREF,
  TECHNICAL_SUPPORT_WHATSAPP
} from './technicalSupport.js';

test('technical support links use the official phone and WhatsApp contact', () => {
  assert.equal(TECHNICAL_SUPPORT_PHONE, '08106083399');
  assert.equal(TECHNICAL_SUPPORT_CALL_HREF, 'tel:08106083399');

  const whatsappUrl = new URL(TECHNICAL_SUPPORT_WHATSAPP_HREF);
  assert.equal(whatsappUrl.origin, 'https://wa.me');
  assert.equal(whatsappUrl.pathname, `/${TECHNICAL_SUPPORT_WHATSAPP}`);
  assert.equal(whatsappUrl.search, `?text=${encodeURIComponent(TECHNICAL_SUPPORT_MESSAGE)}`);
  assert.equal(whatsappUrl.searchParams.get('text'), TECHNICAL_SUPPORT_MESSAGE);
});
