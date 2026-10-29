export const persistAuthSession = (data, { storage, setAuthToken, setUser }) => {
  storage.setItem('amsToken', data.token);
  setAuthToken(data.token);
  setUser(data.user);
};

export const getAuthenticatedHomePath = (role, studentDestination) => {
  if (role === 'student'
    && typeof studentDestination === 'string'
    && studentDestination.startsWith('/properties/')) {
    return studentDestination;
  }
  if (role === 'admin') return '/admin';
  if (role === 'agent') return '/agent';
  return '/student';
};
