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
  const { householdId, householdName } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  const { lastMessage } = useWebSocket('/ws/alerts/', householdId);
  const seenIds = useRef(new Set());
  const baseTitle = useRef(document.title);

  // FIX: nothing in this file (or anywhere else in the codebase — grepped
  // for `new Notification` / `Notification.requestPermission`, zero hits)
  // ever asked for browser notification permission or called the Web
  // Notifications API. Toasts only rendered inside <ToastContainer/>, which
  // is only visible while this exact browser tab is focused, so any alert
  // that arrived while the user was on a different tab, a different app, or
  // had the window minimized was invisible - "notifications aren't showing
  // up" on web. This asks once per browser and fires a real OS-level popup.
  useEffect(() => {
    if (!householdId) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [householdId]);

  // Badge the tab title so an unread count is visible even without
  // switching back to this tab or granting OS notification permission.
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) ${baseTitle.current}` : baseTitle.current;
  }, [unreadCount]);

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

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(householdName ? `SmartNest - ${householdName}` : 'SmartNest', {
          body: newAlert.message,
          icon: '/icon-192.png',
          tag: newAlert.id != null ? String(newAlert.id) : undefined, // dedupes if the same alert re-broadcasts
        });
      } catch {
        // Notification constructor can throw on some mobile browsers even
        // when permission is 'granted' (e.g. Android Chrome wants the
        // Service Worker Notifications API instead) - never let that break
        // the in-app toast/alert list above.
      }
    }
  }, [lastMessage]);

  const clearUnread = () => setUnreadCount(0);

  return (
    <NotificationContext.Provider value={{ alerts, unreadCount, toasts, clearUnread, addToast }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);