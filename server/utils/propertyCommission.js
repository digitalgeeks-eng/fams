const COMMISSION_RATE_BASIS_POINTS = 300;
const MAX_SAFE_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

const expandExponential = (value) => {
  const match = value.match(/^(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/);
  if (!match) return value;

  const [, whole, fraction = '', exponentText] = match;
  if (Math.abs(Number(exponentText)) > 20) return value;
  const digits = `${whole}${fraction}`;
  const decimalPosition = whole.length + Number(exponentText);
  if (decimalPosition <= 0) return `0.${'0'.repeat(-decimalPosition)}${digits}`;
  if (decimalPosition >= digits.length) return `${digits}${'0'.repeat(decimalPosition - digits.length)}`;
  return `${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
};

const toCents = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;

  const normalized = expandExponential(String(value).trim());
  if (normalized.length > 32) return null;
  const match = normalized.match(/^(\d+)(?:\.(\d*))?$/);
  if (!match) return null;

  const [, whole, fraction = ''] = match;
  let cents = BigInt(whole) * 100n + BigInt((fraction.slice(0, 2) + '00').slice(0, 2));
  if (fraction[2] && fraction[2] >= '5') cents += 1n;
  return cents <= MAX_SAFE_CENTS ? cents : null;
};

export const calculatePropertyCommission = (price, rateBasisPoints = COMMISSION_RATE_BASIS_POINTS) => {
  const propertyPriceCents = toCents(price);
  if (propertyPriceCents === null || !Number.isInteger(rateBasisPoints)
    || rateBasisPoints < 0 || rateBasisPoints > 10000) return null;

  const commissionCents = (propertyPriceCents * BigInt(rateBasisPoints) + 5000n) / 10000n;
  const agentCents = propertyPriceCents - commissionCents;
  return {
    propertyPrice: Number(propertyPriceCents) / 100,
    commissionRate: rateBasisPoints / 10000,
    studentNestCommission: Number(commissionCents) / 100,
    agentAmount: Number(agentCents) / 100
  };
};
