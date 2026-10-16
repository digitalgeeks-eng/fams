export const DEFAULT_LAUNCH_AT = '2026-10-21T00:00:00+01:00';

export const getLaunchConfig = (env = process.env) => {
  const enabledValue = env.LAUNCH_MODE_ENABLED;
  if (enabledValue !== undefined && !['true', 'false'].includes(enabledValue.toLowerCase())) {
    throw new Error('LAUNCH_MODE_ENABLED must be either true or false.');
  }

  const launchAt = env.LAUNCH_AT || DEFAULT_LAUNCH_AT;
  const launchAtMs = Date.parse(launchAt);
  if (!Number.isFinite(launchAtMs)) {
    throw new Error('LAUNCH_AT must be a valid ISO 8601 date and time.');
  }

  return {
    enabled: enabledValue === undefined ? true : enabledValue.toLowerCase() === 'true',
    launchAt,
    launchAtMs
  };
};

export const getLaunchStatus = (now, config) => {
  const serverTime = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(serverTime.getTime())) {
    throw new Error('A valid server time is required to determine launch status.');
  }

  const launched = !config.enabled || serverTime.getTime() >= config.launchAtMs;
  return {
    launchModeEnabled: config.enabled,
    launchAt: config.launchAt,
    serverTime: serverTime.toISOString(),
    launched
  };
};
