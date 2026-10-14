export const formatInspectionFee = (fee) => {
  if (fee === null || fee === undefined || fee === '') return null;
  const amount = Number(fee);
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (amount === 0) return 'Free Inspection';
  return `₦${amount.toLocaleString('en-NG')}`;
};
