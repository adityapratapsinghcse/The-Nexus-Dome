import { useState, useEffect, useCallback } from 'react';
import {
  User, Home, ShieldCheck, LogOut, Wifi, WifiOff, Users, Cpu,
  CreditCard, Clock, Activity, ShieldAlert, DoorOpen,
} from 'lucide-react';
import PanelCard from '../components/ui/PanelCard';
import StatusPill from '../components/ui/StatusPill';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const OFFLINE_THRESHOLD_MS = 60 * 1000;

export default function Profile() {
  const { householdId, householdName, logout } = useAuth();
  const username = localStorage.getItem('smartnest_username') || 'Family Member';

  const displayName = username
    .replace(/[._]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const initials = displayName
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState(null); // { role, joined_at, is_active }
  const [devices, setDevices] = useState([]);
  const [rfidCards, setRfidCards] = useState([]);
  const [accessLog, setAccessLog] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const loadAll = useCallback(async () => {
    if (!householdId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [membersRes, devicesRes, cardsRes] = await Promise.all([
        client.get(`/api/auth/household-members/?household_id=${householdId}`),
        client.get('/api/devices/'),
        client.get('/api/access/cards/'),
      ]);

      const self = membersRes.data.find((m) => m.username === username);
      setMembership(self || null);
      setDevices(devicesRes.data);
      setRfidCards(cardsRes.data);

      // Access log and alerts depend on having a primary device
      if (devicesRes.data.length > 0) {
        const primaryDevice = devicesRes.data[0];
        const [accessRes, alertsRes] = await Promise.all([
          client.get(`/api/access/log/?device_id=${primaryDevice.id}`).catch(() => ({ data: [] })),
          client.get('/api/alerts/?is_read=false').catch(() => ({ data: [] })),
        ]);
        setAccessLog(accessRes.data.slice(0, 5));
        setRecentAlerts(alertsRes.data.slice(0, 5));
      }
    } catch (err) {
      console.error('Failed to load profile data:', err);
      setError('Could not load some profile data. Household membership info may be incomplete.');
    } finally {
      setLoading(false);
    }
  }, [householdId, username]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading) return <div className="sn-page-loading">Loading profile…</div>;

  const primaryDevice = devices[0] || null;
  const deviceOnline = primaryDevice?.last_seen
    && (now - new Date(primaryDevice.last_seen).getTime()) < OFFLINE_THRESHOLD_MS;

  const roleLabel = membership?.role
    ? membership.role.charAt(0).toUpperCase() + membership.role.slice(1)
    : 'Unknown — could not confirm from household-members';

  const joinedLabel = membership?.joined_at
    ? new Date(membership.joined_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '--';

  // Merge access log + alerts into one feed, newest first
  const activityItems = [
    ...accessLog.map((a) => ({
      kind: 'access',
      key: `access-${a.id}`,
      timestamp: a.timestamp,
      granted: a.granted,
      label: a.granted ? 'Access granted at Main Gate' : 'Access denied at Main Gate',
    })),
    ...recentAlerts.map((a) => ({
      kind: 'alert',
      key: `alert-${a.id}`,
      timestamp: a.timestamp || a.created_at,
      severity: a.severity,
      label: a.message,
    })),
  ]
    .filter((i) => i.timestamp)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 6);

  return (
    <div className="sn-page profile-page">
      <div className="sn-page-header">
        <div>
          <h1 className="sn-page-title">My Profile</h1>
          <p className="sn-page-subtitle">Your account and home details, all in one place</p>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(232,163,61,0.1)', border: '1px solid rgba(232,163,61,0.3)',
          borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--status-warning)',
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Identity banner */}
      <div className="ui-panel ui-panel-accent profile-identity-banner">
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-copper-bright) 0%, var(--accent-copper) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: '#1B2028', flexShrink: 0,
        }}>
          {initials || <User size={28} />}
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{displayName}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 2 }}>
            Member of {householdName || 'your home'}
          </div>
        </div>
        <StatusPill
          status={membership?.is_active === false ? 'warning' : 'safe'}
          text={membership?.is_active === false ? 'PENDING APPROVAL' : 'ACCOUNT ACTIVE'}
        />
      </div>

      <div className="sn-grid sn-grid-4">
        {/* Personal details */}
        <PanelCard title="Your Details" icon={User} className="sn-chart-panel" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span className="label-eyebrow">Name</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{displayName}</div>
            </div>
            <div>
              <span className="label-eyebrow">Role in the Home</span>
              <div style={{ fontSize: 15, color: 'var(--text-primary)', marginTop: 4 }}>{roleLabel}</div>
            </div>
            <div>
              <span className="label-eyebrow">Member Since</span>
              <div style={{ fontSize: 15, color: 'var(--text-primary)', marginTop: 4 }}>{joinedLabel}</div>
            </div>
          </div>
        </PanelCard>

        {/* Household + connectivity */}
        <PanelCard title="Your Home" icon={Home} className="sn-chart-panel" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span className="label-eyebrow">Home Name</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                {householdName || 'My Home'}
              </div>
            </div>
            <div className="sn-security-item" style={{ marginTop: 2 }}>
              <Cpu size={16} className="sn-security-icon" />
              <span>{primaryDevice ? primaryDevice.name : 'No board registered'}</span>
              {primaryDevice ? (
                <StatusPill status={deviceOnline ? 'safe' : 'critical'} text={deviceOnline ? 'ONLINE' : 'OFFLINE'} />
              ) : (
                <StatusPill status="warning" text="NONE" />
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {devices.length} board{devices.length !== 1 ? 's' : ''} registered to this home
            </div>
          </div>
        </PanelCard>

        {/* RFID access — household-wide, not per-user (no user link on the card model) */}
        <PanelCard title="Household Access Cards" icon={CreditCard} className="sn-chart-panel" style={{ gridColumn: 'span 2' }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 12 }}>
            RFID cards aren't tied to individual accounts yet — this is every card enrolled on the household's reader.
          </p>
          {rfidCards.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No cards enrolled yet.</p>
          )}
          {rfidCards.map((c) => (
            <div key={c.id} className="sn-access-item">
              <CreditCard size={16} className={c.is_active ? 'sn-access-icon-ok' : 'sn-access-icon-fail'} />
              <div className="sn-access-details">
                <span className="sn-access-uid">{c.label || c.uid}</span>
                <span className="sn-access-time">{c.is_active ? 'Active' : 'Revoked'}</span>
              </div>
            </div>
          ))}
        </PanelCard>

        {/* Last gate access */}
        <PanelCard title="Last Gate Access" icon={DoorOpen} className="sn-chart-panel" style={{ gridColumn: 'span 2' }}>
          {accessLog.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No access events recorded yet.</p>
          )}
          {accessLog.slice(0, 1).map((a) => (
            <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <StatusPill status={a.granted ? 'safe' : 'critical'} text={a.granted ? 'ACCESS GRANTED' : 'ACCESS DENIED'} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {new Date(a.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </PanelCard>
        {/* Explainer */}
        <PanelCard title="How This Works" icon={Users} className="sn-chart-panel" style={{ gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <ShieldCheck size={20} style={{ color: 'var(--status-safe)', flexShrink: 0, marginTop: 2 }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              This is your personal profile for <strong style={{ color: 'var(--text-primary)' }}>{householdName || 'your home'}</strong>.
              It shows your name, role, and confirms your home's devices are connected.
            </p>
          </div>
        </PanelCard>

        {/* Sign out */}
        <PanelCard title="Sign Out" icon={LogOut} className="sn-chart-panel" style={{ gridColumn: 'span 4' }}>
          <div className="profile-signout-row">
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0, maxWidth: 480 }}>
              Signing out will log you out of this device. You can always sign back in with your username and password.
            </p>
            <button onClick={logout} className="sn-unlock-btn" style={{ background: 'var(--status-critical)', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px' }}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </PanelCard>
      </div>
    </div>
  );
}