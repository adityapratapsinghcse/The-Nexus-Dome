import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  // FIX: this used to read `const { user } = useAuth()`, but AuthContext never
  // exposes a `user` field (only token/householdId/householdName) — `user` was
  // always undefined, so the `if (!user || !user.householdId) return;` guard
  // below fired on every render and the WebSocket was NEVER opened. The bell
  // and toasts silently never received a single live alert. Fixed by using
  // householdId directly, and by reusing the same useWebSocket hook every
  // other page already uses (it sends the required ?token= auth param that
  // this custom socket was also missing).
  const { householdId } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  const { lastMessage } = useWebSocket('/ws/alerts/', householdId);
  const seenIds = useRef(new Set());

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    if (!lastMessage || lastMessage.kind !== 'alert') return;
    // rfid_result carries granted/denied info but isn't a persisted Alert
    // unless denied — only surface it if the backend actually created one.
    if (lastMessage.type === 'rfid_result' && lastMessage.id === null) return;

    if (lastMessage.id != null) {
      if (seenIds.current.has(lastMessage.id)) return;
      seenIds.current.add(lastMessage.id);
    }

    const newAlert = {
      id: lastMessage.id,
      type: lastMessage.type,
      severity: lastMessage.severity || (lastMessage.type === 'rfid_result' ? 'warning' : 'info'),
      message: lastMessage.message,
      created_at: lastMessage.timestamp || new Date().toISOString(),
    };

    setAlerts((prev) => [newAlert, ...prev].slice(0, 30));
    setUnreadCount((prev) => prev + 1);
    addToast(newAlert.message, newAlert.severity === 'critical' || newAlert.severity === 'high' ? 'danger' : 'warning');
  }, [lastMessage]);

  const clearUnread = () => setUnreadCount(0);

  return (
    <NotificationContext.Provider value={{ alerts, unreadCount, toasts, clearUnread, addToast }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);