import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ExternalLink } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(iso).toLocaleDateString();
}

export const NotificationBell = () => {
  const { alerts, unreadCount, clearUnread } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const rootRef = useRef(null);

  // Close on outside click so it behaves like the rest of the app's dropdowns.
  useEffect(() => {
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggleDropdown = () => {
    setIsOpen((v) => !v);
    if (!isOpen) clearUnread();
  };

  const goToAll = () => {
    setIsOpen(false);
    navigate('/notifications');
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={toggleDropdown}
        className="sn-icon-btn"
        aria-label="Notifications"
        style={{ position: 'relative' }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16,
            padding: '0 4px', borderRadius: 999, fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--status-critical)', color: '#fff', lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', right: 0, marginTop: 8, width: 320, maxWidth: '85vw',
          background: 'var(--bg-panel, var(--bg-deep))', border: '1px solid var(--border-subtle)',
          borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.4)', zIndex: 100,
          maxHeight: 380, overflowY: 'auto',
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
            fontWeight: 700, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>Notifications</span>
            {unreadCount > 0 && <span style={{ fontSize: 11, color: 'var(--accent-copper-bright)' }}>New alerts live</span>}
          </div>

          {alerts.length === 0 ? (
            <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12.5 }}>
              All clear! No active notifications.
            </div>
          ) : (
            alerts.slice(0, 4).map((alert) => (
              <div key={alert.id ?? alert.created_at} style={{
                padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)',
                borderLeft: `3px solid ${alert.severity === 'critical' || alert.severity === 'high' ? 'var(--status-critical)' : 'var(--status-warning)'}`,
              }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, margin: 0 }}>{alert.message}</p>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{timeAgo(alert.created_at)}</span>
              </div>
            ))
          )}

          <button
            onClick={goToAll}
            className="sn-btn-outline"
            style={{ width: 'calc(100% - 20px)', margin: 10, justifyContent: 'center' }}
          >
            View all notifications <ExternalLink size={13} />
          </button>
        </div>
      )}
    </div>
  );
};