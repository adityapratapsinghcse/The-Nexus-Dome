import React, { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';

export const NotificationBell = () => {
    const { alerts, unreadCount, clearUnread } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
        if (!isOpen) clearUnread();
    };

    return (
        <div className="relative dropdown-container">
            <button onClick={toggleDropdown} className="relative p-2 text-gray-300 hover:text-white focus:outline-none">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-gray-800 rounded-lg shadow-xl py-2 z-50 border border-gray-700 max-h-96 overflow-y-auto">
                    <div className="px-4 py-2 border-b border-gray-700 font-bold text-white flex justify-between items-center">
                        <span>Notifications</span>
                        {unreadCount > 0 && <span className="text-xs text-indigo-400">New alerts live</span>}
                    </div>
                    {alerts.length === 0 ? (
                        <div className="px-4 py-6 text-center text-gray-500 text-sm">All clear! No active notifications.</div>
                    ) : (
                        alerts.map((alert) => (
                            <div key={alert.id} className={`px-4 py-3 border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${alert.severity === 'high' ? 'border-l-4 border-l-red-500' : ''}`}>
                                <p className="text-sm text-gray-200 font-medium">{alert.message}</p>
                                <span className="text-xs text-gray-500">{new Date(alert.created_at).toLocaleTimeString()}</span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};