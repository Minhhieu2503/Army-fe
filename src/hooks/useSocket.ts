import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Dynamically resolve backend host in local networks
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const envApiUrl = import.meta.env.VITE_API_URL;
    // If running in development, default to port 5000 or production URL
    const backendUrl = envApiUrl 
      ? envApiUrl 
      : (hostname === 'localhost' || hostname === '127.0.0.1'
        ? `${protocol}//localhost:5000`
        : 'https://army-be.onrender.com');

    console.log(`Connecting socket to: ${backendUrl}`);
    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected successfully!');
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Không thể kết nối đến máy chủ.');
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const emit = (event: string, data: any) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn(`Cannot emit event '${event}', socket is not connected.`);
    }
  };

  const on = (event: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  };

  const off = (event: string, callback?: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    error,
    emit,
    on,
    off
  };
};
export type UseSocketReturn = ReturnType<typeof useSocket>;
