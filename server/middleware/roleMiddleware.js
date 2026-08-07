export const authorizeRoles = (...allowedRoles) => {
  const normalizedRoles = allowedRoles.map((role) => role.toLowerCase());
  return (req, res, next) => {
    const userRole = req.user?.role?.toLowerCase();
    if (!req.user || !userRole || !normalizedRoles.includes(userRole)) {
      res.status(403);
      throw new Error('Access denied: insufficient privileges');
    }
    next();
  };
};
