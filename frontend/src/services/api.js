import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}` : '';

const api = axios.create({ baseURL: `${API_BASE}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => { if (error.response && error.response.status === 401) { localStorage.removeItem('token'); window.location.assign('/login'); } return Promise.reject(error); },
);

export function resolveUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  return `${API_BASE}${path}`;
}

const auth = { register: async (email, username, password) => { const r = await api.post('/auth/register', { email, username, password }); return r.data; }, login: async (email, password) => { const r = await api.post('/auth/login', { email, password }); return r.data; }, getMe: async () => { const r = await api.get('/auth/me'); return r.data; }, };

const tables = { getAll: async () => { const r = await api.get('/tables'); return r.data; }, getOne: async (tableId) => { const r = await api.get(`/tables/${tableId}`); return r.data; }, create: async (name, description) => { const r = await api.post('/tables', { name, description }); return r.data; }, update: async (tableId, data) => { const r = await api.put(`/tables/${tableId}`, data); return r.data; }, remove: async (tableId) => { const r = await api.delete(`/tables/${tableId}`); return r.data; }, addMember: async (tableId, username, role) => { const r = await api.post(`/tables/${tableId}/members`, { username, role }); return r.data; }, removeMember: async (tableId, userId) => { const r = await api.delete(`/tables/${tableId}/members/${userId}`); return r.data; }, updateMemberRole: async (tableId, userId, role) => { const r = await api.put(`/tables/${tableId}/members/${userId}`, { role }); return r.data; }, muteMember: async (tableId, userId, muted) => { const r = await api.put(`/tables/${tableId}/members/${userId}/mute`, { muted }); return r.data; }, spotlight: async (tableId, tokenId, x, y) => { const r = await api.post(`/tables/${tableId}/spotlight`, { tokenId, x, y }); return r.data; }, exportTable: async (tableId) => { const r = await api.get(`/tables/${tableId}/export`); return r.data; }, importTable: async (tableId, data) => { const r = await api.post(`/tables/${tableId}/import`, data); return r.data; }, };

const maps = { getAll: async (tableId) => { const r = await api.get(`/tables/${tableId}/maps`); return r.data; }, getOne: async (tableId, mapId) => { const r = await api.get(`/tables/${tableId}/maps/${mapId}`); return r.data; }, create: async (tableId, formData) => { const r = await api.post(`/tables/${tableId}/maps`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }); return r.data; }, update: async (tableId, mapId, data) => { const r = await api.put(`/tables/${tableId}/maps/${mapId}`, data); return r.data; }, remove: async (tableId, mapId) => { const r = await api.delete(`/tables/${tableId}/maps/${mapId}`); return r.data; }, };

const tokens = { getAll: async (tableId, mapId) => { const r = await api.get(`/tables/${tableId}/maps/${mapId}/tokens`); return r.data; }, create: async (tableId, mapId, data) => { const r = await api.post(`/tables/${tableId}/maps/${mapId}/tokens`, data); return r.data; }, update: async (tableId, mapId, tokenId, data) => { const r = await api.put(`/tables/${tableId}/maps/${mapId}/tokens/${tokenId}`, data); return r.data; }, remove: async (tableId, mapId, tokenId) => { const r = await api.delete(`/tables/${tableId}/maps/${mapId}/tokens/${tokenId}`); return r.data; }, setPermissions: async (tableId, mapId, tokenId, permissions) => { const r = await api.put(`/tables/${tableId}/maps/${mapId}/tokens/${tokenId}/permissions`, { permissions }); return r.data; }, getPermissions: async (tableId, mapId, tokenId) => { const r = await api.get(`/tables/${tableId}/maps/${mapId}/tokens/${tokenId}/permissions`); return r.data; }, };

const grid = { get: async (tableId, mapId) => { const r = await api.get(`/tables/${tableId}/maps/${mapId}/grid`); return r.data; }, update: async (tableId, mapId, data) => { const r = await api.put(`/tables/${tableId}/maps/${mapId}/grid`, data); return r.data; }, };

const fog = { getAll: async (tableId, mapId) => { const r = await api.get(`/tables/${tableId}/maps/${mapId}/fog`); return r.data; }, create: async (tableId, mapId, data) => { const r = await api.post(`/tables/${tableId}/maps/${mapId}/fog`, data); return r.data; }, update: async (tableId, mapId, fogId, data) => { const r = await api.put(`/tables/${tableId}/maps/${mapId}/fog/${fogId}`, data); return r.data; }, remove: async (tableId, mapId, fogId) => { const r = await api.delete(`/tables/${tableId}/maps/${mapId}/fog/${fogId}`); return r.data; }, batchUpdate: async (tableId, mapId, regions) => { const r = await api.put(`/tables/${tableId}/maps/${mapId}/fog/batch`, { regions }); return r.data; }, };

const chat = { getMessages: async (tableId) => { const r = await api.get(`/tables/${tableId}/chat`); return r.data; }, send: async (tableId, data) => { const r = await api.post(`/tables/${tableId}/chat`, data); return r.data; }, clear: async (tableId) => { const r = await api.delete(`/tables/${tableId}/chat`); return r.data; }, };

const characters = {
  getAll: async (tableId) => { const r = await api.get(`/tables/${tableId}/characters`); return r.data; },
  getOne: async (tableId, characterId) => { const r = await api.get(`/tables/${tableId}/characters/${characterId}`); return r.data; },
  create: async (tableId, data) => { const r = await api.post(`/tables/${tableId}/characters`, data); return r.data; },
  update: async (tableId, characterId, data) => { const r = await api.put(`/tables/${tableId}/characters/${characterId}`, data); return r.data; },
  remove: async (tableId, characterId) => { const r = await api.delete(`/tables/${tableId}/characters/${characterId}`); return r.data; },
};

const drawings = {
  getAll: async (tableId, mapId) => { const r = await api.get(`/tables/${tableId}/maps/${mapId}/drawings`); return r.data; },
  create: async (tableId, mapId, data) => { const r = await api.post(`/tables/${tableId}/maps/${mapId}/drawings`, data); return r.data; },
  remove: async (tableId, mapId, drawingId) => { const r = await api.delete(`/tables/${tableId}/maps/${mapId}/drawings/${drawingId}`); return r.data; },
  clear: async (tableId, mapId) => { const r = await api.delete(`/tables/${tableId}/maps/${mapId}/drawings`); return r.data; },
};

const annotations = {
  getAll: async (tableId, mapId) => { const r = await api.get(`/tables/${tableId}/maps/${mapId}/annotations`); return r.data; },
  create: async (tableId, mapId, data) => { const r = await api.post(`/tables/${tableId}/maps/${mapId}/annotations`, data); return r.data; },
  update: async (tableId, mapId, annotationId, data) => { const r = await api.put(`/tables/${tableId}/maps/${mapId}/annotations/${annotationId}`, data); return r.data; },
  remove: async (tableId, mapId, annotationId) => { const r = await api.delete(`/tables/${tableId}/maps/${mapId}/annotations/${annotationId}`); return r.data; },
};

const uploads = { create: (file) => { const fd = new FormData(); fd.append('image', file); return api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data); } };

export default { auth, tables, maps, tokens, grid, fog, chat, characters, drawings, annotations, uploads, resolveUrl };