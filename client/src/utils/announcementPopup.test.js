import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANNOUNCEMENT_DISMISSED_KEY,
  hasDismissedAnnouncement,
  rememberAnnouncementDismissal
} from './announcementPopup.js';

test('announcement stays dismissed for the current session storage lifetime', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };

  assert.equal(hasDismissedAnnouncement(storage), false);
  rememberAnnouncementDismissal(storage);
  assert.equal(values.get(ANNOUNCEMENT_DISMISSED_KEY), 'true');
  assert.equal(hasDismissedAnnouncement(storage), true);
});
