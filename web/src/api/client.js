import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('smartnest_token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

export default client;