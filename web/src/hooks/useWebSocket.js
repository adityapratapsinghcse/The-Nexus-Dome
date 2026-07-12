import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebSocket(path, householdId) {
  const [lastMessage, setLastMessage] = useState(null);
  const [status, setStatus] = useState('connecting');
  const wsRef = useRef(null);
  const reconnectDelay = useRef(1000);

  const connect = useCallback(() => {
    if (!householdId) return;

    const token = localStorage.getItem('smartnest_token');
    const wsBase = import.meta.env.VITE_WS_BASE_URL;
    const url = `${wsBase}${path}${householdId}/?token=${token}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('open');
      reconnectDelay.current = 1000;
    };

    ws.onmessage = (event) => {
      try {
        setLastMessage(JSON.parse(event.data));
      } catch {
        setLastMessage(event.data);
      }
    };

    ws.onclose = (event) => {
      setStatus('closed');
      if (event.code === 4401) return;

      setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 15000);
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = () => ws.close();
  }, [path, householdId]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  return { lastMessage, status };
}