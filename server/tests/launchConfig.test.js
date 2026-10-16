import test from 'node:test';
import assert from 'node:assert/strict';
import { getLaunchConfig, getLaunchStatus } from '../utils/launchConfig.js';

const config = getLaunchConfig({
  LAUNCH_MODE_ENABLED: 'true',
  LAUNCH_AT: '2026-10-21T00:00:00+01:00'
});
const launchAtMs = Date.parse(config.launchAt);

test('uses the confirmed Nigerian launch instant', () => {
  assert.equal(config.launchAtMs, Date.parse('2026-10-20T23:00:00.000Z'));
});

test('remains in pre-launch mode before launch', () => {
  for (const offset of [
    -5 * 24 * 60 * 60 * 1000,
    -60 * 60 * 1000,
    -60 * 1000,
    -1000
  ]) {
    assert.equal(getLaunchStatus(launchAtMs + offset, config).launched, false);
  }
});

test('launches at exactly the configured instant and remains launched afterward', () => {
  assert.equal(getLaunchStatus(launchAtMs, config).launched, true);
  assert.equal(getLaunchStatus(launchAtMs + 1000, config).launched, true);
});

test('rejects invalid launch configuration', () => {
  assert.throws(() => getLaunchConfig({ LAUNCH_AT: 'not-a-date' }), /LAUNCH_AT/);
  assert.throws(() => getLaunchConfig({ LAUNCH_MODE_ENABLED: 'yes' }), /LAUNCH_MODE_ENABLED/);
});

test('disabled launch mode opens the site before the configured date', () => {
  const disabledConfig = getLaunchConfig({
    LAUNCH_MODE_ENABLED: 'false',
    LAUNCH_AT: '2026-10-21T00:00:00+01:00'
  });
  assert.equal(getLaunchStatus(launchAtMs - 1000, disabledConfig).launched, true);
});
