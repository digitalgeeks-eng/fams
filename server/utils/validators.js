export const validateRequired = (fields, body) => {
  const missing = [];
  fields.forEach((key) => {
    if (body[key] === undefined || body[key] === null || body[key] === '') {
      missing.push(key);
    }
  });
  return missing;
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePasswordStrength = (password) => {
  return password && password.length >= 6;
};

export const validateBankAccountNumber = (value) => {
  if (value === undefined || value === null || value === '') return true;
  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) return false;
  if (normalized.length !== 10) return false;
  return true;
};

export const validateBankDetails = ({ accountNumber, bankName, accountName }) => {
  const normalized = {
    accountNumber: typeof accountNumber === 'string' ? accountNumber.trim() : '',
    bankName: typeof bankName === 'string' ? bankName.trim() : '',
    accountName: typeof accountName === 'string' ? accountName.trim() : ''
  };

  const hasAnyBankInfo = Object.values(normalized).some(Boolean);
  if (!hasAnyBankInfo) {
    return { valid: true, normalized };
  }

  if (!normalized.accountNumber || !normalized.bankName || !normalized.accountName) {
    return {
      valid: false,
      message: 'Please complete all bank information fields or leave them all empty.'
    };
  }

  if (!validateBankAccountNumber(normalized.accountNumber)) {
    return {
      valid: false,
      message: 'Account number must be a valid 10-digit Nigerian bank account number.'
    };
  }

  if (normalized.bankName.length > 100) {
    return {
      valid: false,
      message: 'Bank name is too long.'
    };
  }

  if (normalized.accountName.length > 200) {
    return {
      valid: false,
      message: 'Account name is too long.'
    };
  }

  return { valid: true, normalized };
};
