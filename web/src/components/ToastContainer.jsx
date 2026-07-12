import React from 'react';
import { useNotifications } from '../context/NotificationContext';

export const ToastContainer = () => {
    const { toasts } = useNotifications();

    return (
        <div className="fixed bottom-5 right-5 z-50 space-y-3 pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`pointer-events-auto flex items-center p-4 rounded-lg shadow-2xl border min-w-[300px] max-w-md transform transition-all duration-300 animate-slide-in ${
                        toast.type === 'danger' 
                            ? 'bg-red-900/90 text-red-100 border-red-700' 
                            : 'bg-yellow-900/90 text-yellow-100 border-yellow-700'
                    }`}
                >
                    <div className="mr-3">
                        {toast.type === 'danger' ? '🚨' : '⚠️'}
                    </div>
                    <div className="text-sm font-medium">{toast.message}</div>
                </div>
            ))}
        </div>
    );
};