import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_URL || '';

let socket = null;

export function connectSocket(token) {
  if (socket?.connected) return socket;

  socket = io(API_BASE, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect_error', (err) => {
    console.warn('Erro de conexao socket:', err.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

export function onSocket(event, handler) {
  if (!socket) return () => {};
  socket.on(event, handler);
  return () => {
    socket?.off(event, handler);
  };
}

export function offSocket(event) {
  socket?.off(event);
}

export function emitSocket(event, ...args) {
  socket?.emit(event, ...args);
}
