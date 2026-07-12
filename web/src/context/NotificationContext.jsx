import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const [alerts, setAlerts] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [toasts, setToasts] = useState([]);

    const addToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    };

    useEffect(() => {
        // If there is no logged-in user or household yet (like on the login page), DO NOTHING safely
        if (!user || !user.householdId) {
            return;
        }
        const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
        // Fallback logic if window.location.host includes a port, safely point to your Django backend port (8000)
        const backendHost = window.location.host.includes('5173') 
            ? window.location.hostname + ':8000' 
            : window.location.host;
        const wsUrl = `${wsScheme}://${backendHost}/ws/alerts/`;
        const socket = new WebSocket(wsUrl);

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.message) {
                const newAlert = data.message;
                setAlerts((prev) => [newAlert, ...prev]);
                setUnreadCount((prev) => prev + 1);
                addToast(newAlert.message, newAlert.severity === 'high' ? 'danger' : 'warning');
            }
        };

        socket.onerror = (err) => console.error("Alert WebSocket Error:", err);
        
        return () => socket.close();
    }, [user]);

    const clearUnread = () => setUnreadCount(0);

    return (
        <NotificationContext.Provider value={{ alerts, unreadCount, toasts, clearUnread, addToast }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => useContext(NotificationContext);