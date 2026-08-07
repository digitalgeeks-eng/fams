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
