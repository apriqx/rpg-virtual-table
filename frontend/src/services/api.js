import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}`
  : '';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export function resolveUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  return `${API_BASE}${path}`;
}

const auth = {
  register: async (email, username, password) => {
    const res = await api.post('/auth/register', { email, username, password });
    return res.data;
  },
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

const tables = {
  getAll: async () => {
    const res = await api.get('/tables');
    return res.data;
  },
  getOne: async (tableId) => {
    const res = await api.get(`/tables/${tableId}`);
    return res.data;
  },
  create: async (name, description) => {
    const res = await api.post('/tables', { name, description });
    return res.data;
  },
  update: async (tableId, data) => {
    const res = await api.put(`/tables/${tableId}`, data);
    return res.data;
  },
  remove: async (tableId) => {
    const res = await api.delete(`/tables/${tableId}`);
    return res.data;
  },
  addMember: async (tableId, username, role) => {
    const res = await api.post(`/tables/${tableId}/members`, { username, role });
    return res.data;
  },
  removeMember: async (tableId, userId) => {
    const res = await api.delete(`/tables/${tableId}/members/${userId}`);
    return res.data;
  },
  updateMemberRole: async (tableId, userId, role) => {
    const res = await api.put(`/tables/${tableId}/members/${userId}`, { role });
    return res.data;
  },
};

const maps = {
  getAll: async (tableId) => {
    const res = await api.get(`/tables/${tableId}/maps`);
    return res.data;
  },
  getOne: async (tableId, mapId) => {
    const res = await api.get(`/tables/${tableId}/maps/${mapId}`);
    return res.data;
  },
  create: async (tableId, formData) => {
    const res = await api.post(`/tables/${tableId}/maps`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  update: async (tableId, mapId, data) => {
    const res = await api.put(`/tables/${tableId}/maps/${mapId}`, data);
    return res.data;
  },
  remove: async (tableId, mapId) => {
    const res = await api.delete(`/tables/${tableId}/maps/${mapId}`);
    return res.data;
  },
};

const tokens = {
  getAll: async (tableId, mapId) => {
    const res = await api.get(`/tables/${tableId}/maps/${mapId}/tokens`);
    return res.data;
  },
  create: async (tableId, mapId, data) => {
    const res = await api.post(`/tables/${tableId}/maps/${mapId}/tokens`, data);
    return res.data;
  },
  update: async (tableId, mapId, tokenId, data) => {
    const res = await api.put(`/tables/${tableId}/maps/${mapId}/tokens/${tokenId}`, data);
    return res.data;
  },
  remove: async (tableId, mapId, tokenId) => {
    const res = await api.delete(`/tables/${tableId}/maps/${mapId}/tokens/${tokenId}`);
    return res.data;
  },
  setPermissions: async (tableId, mapId, tokenId, permissions) => {
    const res = await api.put(`/tables/${tableId}/maps/${mapId}/tokens/${tokenId}/permissions`, { permissions });
    return res.data;
  },
  getPermissions: async (tableId, mapId, tokenId) => {
    const res = await api.get(`/tables/${tableId}/maps/${mapId}/tokens/${tokenId}/permissions`);
    return res.data;
  },
};

const grid = {
  get: async (tableId, mapId) => {
    const res = await api.get(`/tables/${tableId}/maps/${mapId}/grid`);
    return res.data;
  },
  update: async (tableId, mapId, data) => {
    const res = await api.put(`/tables/${tableId}/maps/${mapId}/grid`, data);
    return res.data;
  },
};

const fog = {
  getAll: async (tableId, mapId) => {
    const res = await api.get(`/tables/${tableId}/maps/${mapId}/fog`);
    return res.data;
  },
  create: async (tableId, mapId, data) => {
    const res = await api.post(`/tables/${tableId}/maps/${mapId}/fog`, data);
    return res.data;
  },
  update: async (tableId, mapId, fogId, data) => {
    const res = await api.put(`/tables/${tableId}/maps/${mapId}/fog/${fogId}`, data);
    return res.data;
  },
  remove: async (tableId, mapId, fogId) => {
    const res = await api.delete(`/tables/${tableId}/maps/${mapId}/fog/${fogId}`);
    return res.data;
  },
  batchUpdate: async (tableId, mapId, regions) => {
    const res = await api.put(`/tables/${tableId}/maps/${mapId}/fog/batch`, { regions });
    return res.data;
  },
};

export default { auth, tables, maps, tokens, grid, fog, resolveUrl };
