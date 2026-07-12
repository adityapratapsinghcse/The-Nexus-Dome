import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame, Wind, Activity, AlertTriangle, Bell, CheckCircle2, Radio,
  DoorOpen, Zap, Droplet, Car, ShieldAlert, RefreshCw, ArrowLeft, Check,
} from 'lucide-react';
import PanelCard from '../components/ui/PanelCard';
import client from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';

const ALERT_ICON = {
  fire: Flame, gas_leak: Wind, water_low: Droplet, overcurrent: Zap,
  intrusion: Radio, window_open: DoorOpen, vibration: Activity,
  rfid_denied: ShieldAlert, car_detected: Car, system: AlertTriangle,
};

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Notifications() {
  const { householdId } = useAuth();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [markingId, setMarkingId] = useState(null);

  const { lastMessage: alertMessage } = useWebSocket('/ws/alerts/', householdId);

  const fetchAll = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    try {
      const devicesRes = await client.get('/api/devices/');
      if (devicesRes.data.length === 0) { setLoading(false); return; }
      const d = devicesRes.data[0];
      setDevice(d);
      const res = await client.get(`/api/alerts/?device_id=${d.id}`);
      setAlerts(res.data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!alertMessage || alertMessage.kind !== 'alert' || alertMessage.type === 'rfid_result') return;
    setAlerts((prev) => [{
      id: alertMessage.id,
      type: alertMessage.type,
      severity: alertMessage.severity,
      message: alertMessage.message,
      timestamp: alertMessage.timestamp || new Date().toISOString(),
      is_read: false,
    }, ...prev]);
  }, [alertMessage]);

  const markRead = async (id) => {
    setMarkingId(id);
    try {
      await client.post('/api/alerts/read/', { alert_id: id });
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
    } catch (err) {
      console.error('Failed to mark alert read:', err);
    } finally {
      setMarkingId(null);
    }
  };

  const markAllRead = async () => {
    const unread = alerts.filter((a) => !a.is_read);
    try {
      await Promise.all(unread.map((a) => client.post('/api/alerts/read/', { alert_id: a.id })));
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const visible = useMemo(
    () => (filter === 'unread' ? alerts.filter((a) => !a.is_read) : alerts),
    [alerts, filter]
  );
  const unreadCount = alerts.filter((a) => !a.is_read).length;

  if (loading) return <div className="sn-page-loading">Loading notifications…</div>;

  return (
    <div className="sn-page">
      <style>{`
        .notif-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
        .notif-tab {
          padding: 7px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 600;
          background: var(--bg-deep); border: 1px solid var(--border-subtle);
          color: var(--text-secondary); cursor: pointer;
        }
        .notif-tab.active { color: #fff; background: var(--accent-copper-bright, var(--status-warning)); border-color: transparent; }
        .notif-row {
          display: flex; gap: 12px; padding: 14px 16px; border-radius: 10px;
          background: var(--bg-deep); border-left: 3px solid var(--status-warning);
          margin-bottom: 10px; align-items: flex-start;
        }
        .notif-row.critical { border-left-color: var(--status-critical); }
        .notif-row.read { opacity: 0.55; border-left-color: var(--border-subtle); }
        .notif-body { flex: 1; min-width: 0; }
        .notif-title { font-weight: 700; font-size: 13.5px; }
        .notif-msg { font-size: 12.5px; color: var(--text-secondary); margin-top: 2px; }
        .notif-meta { font-size: 11.5px; color: var(--text-secondary); margin-top: 8px; }
        @media (max-width: 560px) {
          .notif-row { flex-wrap: wrap; }
        }
      `}</style>

      <div className="sn-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="sn-icon-btn" onClick={() => navigate(-1)} title="Back">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="sn-page-title">Notifications</h1>
            <p className="sn-page-subtitle">All alerts for {device?.name || 'your home'}</p>
          </div>
        </div>
        <button className="sn-icon-btn" onClick={fetchAll} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      <PanelCard title="All Alerts" icon={Bell} className="sn-chart-panel">
        <div className="notif-tabs">
          <button className={`notif-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            All ({alerts.length})
          </button>
          <button className={`notif-tab ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>
            Unread ({unreadCount})
          </button>
          {unreadCount > 0 && (
            <button className="sn-btn-outline" style={{ marginLeft: 'auto' }} onClick={markAllRead}>
              <Check size={14} /> Mark all read
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, textAlign: 'center', padding: '30px 0' }}>
            {filter === 'unread' ? 'No unread alerts.' : 'No alerts yet.'}
          </p>
        ) : (
          visible.map((a) => {
            const Icon = ALERT_ICON[a.type] || AlertTriangle;
            return (
              <div key={a.id} className={`notif-row ${a.severity === 'critical' ? 'critical' : ''} ${a.is_read ? 'read' : ''}`}>
                <Icon size={18} style={{ color: a.severity === 'critical' ? 'var(--status-critical)' : 'var(--status-warning)', flexShrink: 0, marginTop: 2 }} />
                <div className="notif-body">
                  <div className="notif-title">{a.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</div>
                  <div className="notif-msg">{a.message}</div>
                  <div className="notif-meta">{timeAgo(a.timestamp)}{a.is_read ? ' · Read' : ''}</div>
                </div>
                {!a.is_read && (
                  <button
                    className="sn-icon-btn"
                    disabled={markingId === a.id}
                    onClick={() => markRead(a.id)}
                    title="Mark as read"
                  >
                    <Check size={14} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </PanelCard>
    </div>
  );
}