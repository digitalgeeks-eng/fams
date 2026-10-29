import { createContext, useContext, useEffect, useState } from 'react';
import api, { setAuthToken } from '../services/api.js';
import { persistAuthSession } from '../utils/authSession.js';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('amsToken');
    if (token) {
      setAuthToken(token);
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data.data);
          setError(null);
        })
        .catch((err) => {
          console.error('Auth me failed:', err);
          localStorage.removeItem('amsToken');
          setAuthToken(null);
          setError('Session expired. Please login again.');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials) => {
    try {
      const response = await api.post('/auth/login', credentials);
      persistAuthSession(response.data.data, { storage: localStorage, setAuthToken, setUser });
      setError(null);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Login failed. Please try again.';
      setError(errorMsg);
      throw err;
    }
  };

  const register = async (payload) => {
    try {
      const response = await api.post('/auth/register', payload);
      setError(null);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(errorMsg);
      throw err;
    }
  };

  const completeRegistration = async (credentials) => {
    try {
      const response = await api.post('/auth/verify-registration', credentials);
      persistAuthSession(response.data.data, { storage: localStorage, setAuthToken, setUser });
      setError(null);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Unable to verify your email. Please try again.';
      setError(errorMsg);
      throw err;
    }
  };

  const loginWithGoogle = async (credential) => {
    try {
      const response = await api.post('/auth/google', { credential });
      persistAuthSession(response.data.data, { storage: localStorage, setAuthToken, setUser });
      setError(null);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Google sign-in failed. Please try again.';
      setError(errorMsg);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('amsToken');
    setAuthToken(null);
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, loginWithGoogle, register, completeRegistration, logout, setError, clearError: () => setError(null) }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);
