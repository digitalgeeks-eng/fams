const COMMISSION_RATE_BASIS_POINTS = 300;

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
  const normalized = expandExponential(String(value ?? '').trim());
  if (normalized.length > 32 || !/^\d+(?:\.\d*)?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  let cents;
  try {
    cents = BigInt(whole) * 100n + BigInt((fraction.slice(0, 2) + '00').slice(0, 2));
  } catch {
    return null;
  }
  if (fraction[2] && fraction[2] >= '5') cents += 1n;
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return cents;
};

export const calculatePropertyCommission = (price) => {
  const propertyPriceCents = toCents(price);
  if (propertyPriceCents === null) return null;
  const commissionCents = (propertyPriceCents * BigInt(COMMISSION_RATE_BASIS_POINTS) + 5000n) / 10000n;
  return {
    propertyPrice: Number(propertyPriceCents) / 100,
    commissionRate: COMMISSION_RATE_BASIS_POINTS / 10000,
    studentNestCommission: Number(commissionCents) / 100,
    agentAmount: Number(propertyPriceCents - commissionCents) / 100
  };
};

export const formatNairaAmount = (amount) => `₦${Number(amount).toLocaleString('en-NG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;
