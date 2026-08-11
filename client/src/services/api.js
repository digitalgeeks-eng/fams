import axios from 'axios';

const apiBaseUrl =
  import.meta.env.VITE_API_URL || 'https://fams-d30v.onrender.com/api';

const backendBaseUrl =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('amsToken');

  config.headers = config.headers || {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data instanceof FormData) {
    if (config.headers['Content-Type']) {
      delete config.headers['Content-Type'];
    }
  }

  return config;
});

export const getBackendBaseUrl = () => backendBaseUrl;

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export default api;