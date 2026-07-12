import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings as SettingsIcon, Cpu, Shield, Bell, Thermometer, Zap,
  Plus, Copy, Check, X, RefreshCw, Trash2, Download, LogOut,
  AlertTriangle, Wifi, WifiOff, Clock, HelpCircle,
} from 'lucide-react';
import PanelCard from '../components/ui/PanelCard';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const OFFLINE_THRESHOLD_MS = 60 * 1000;

const LS_KEYS = {
  tempUnit: 'smartnest_pref_temp_unit',
  energyUnit: 'smartnest_pref_energy_unit',
  autoLock: 'smartnest_pref_auto_lock',
  autoLockSeconds: 'smartnest_pref_auto_lock_secs',
  sessionTimeout: 'smartnest_pref_session_timeout_mins',
};

function readLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

/* ---------------- Small reusable UI bits ---------------- */

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 42, height: 24, borderRadius: 999, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? 'var(--status-safe)' : 'var(--border-subtle)',
        position: 'relative', flexShrink: 0, opacity: disabled ? 0.5 : 1, transition: 'background 0.15s',
      }}
    >
      <span
        style={{
          position: 'absolute', top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: '50%',
          background: '#fff', transition: 'left 0.15s',
        }}
      />
    </button>
  );
}

function PrefRow({ icon: Icon, label, sub, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      padding: '12px 0', borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {Icon && <Icon size={17} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{label}</div>
          {sub && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</div>}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function SegButton({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            padding: '6px 14px', fontSize: 13, border: 'none', cursor: 'pointer',
            background: value === opt.value ? 'var(--accent-copper-bright)' : 'transparent',
            color: value === opt.value ? '#1a1208' : 'var(--text-secondary)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Add Device modal ---------------- */

function AddDeviceModal({ householdId, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('esp32');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Device name is required.'); return; }
    if (!householdId) { setError('No household on this account — cannot create a device.'); return; }
    setSaving(true);
    setError(null);
    try {
      // FIX: backend's device_list_create requires `household` in the body
      // and checks it against request.user.memberships — omitting it
      // (previous version) always failed with a 403 "not your household".
      const res = await client.post('/api/devices/', {
        household: householdId,
        name: name.trim(),
        type,
        location: location.trim(),
      });
      setCreated(res.data);
    } catch (err) {
      setError(
        err.response?.data
          ? JSON.stringify(err.response.data)
          : 'Failed to create device.'
      );
    } finally {
      setSaving(false);
    }
  };

  const copyKey = () => {
    if (!created?.device_key) return;
    navigator.clipboard.writeText(created.device_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'var(--bg-panel-raised)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, padding: 24, width: '100%', maxWidth: 440,
      }}>
        {!created ? (
          <form onSubmit={submit}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Add a Board</h3>
              <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>

            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Board type</label>
            <SegButton
              options={[{ value: 'esp32', label: 'ESP32' }, { value: 'arduino_uno', label: 'Arduino UNO' }]}
              value={type}
              onChange={setType}
            />

            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', margin: '14px 0 4px' }}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main ESP32"
              style={inputStyle}
            />

            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', margin: '14px 0 4px' }}>Location (optional)</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Living Room / Main Panel"
              style={inputStyle}
            />

            {error && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--status-critical)' }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: 18, width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                background: 'var(--accent-copper-bright)', color: '#1a1208', fontWeight: 600,
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              {saving ? 'Creating…' : 'Create Device'}
            </button>
          </form>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Check size={18} color="var(--status-safe)" />
              <h3 style={{ margin: 0, fontSize: 16 }}>Device created</h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Copy this key now — it's shown once. Paste it into your ESP32 firmware as <code>DEVICE_KEY</code> so it can authenticate to <code>/api/sensors/data/</code>.
            </p>
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-panel)',
              border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 10px',
            }}>
              <code style={{ fontSize: 12, wordBreak: 'break-all', flex: 1 }}>{created.device_key}</code>
              <button type="button" onClick={copyKey} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                {copied ? <Check size={16} color="var(--status-safe)" /> : <Copy size={16} />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => onCreated(created)}
              style={{
                marginTop: 18, width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                background: 'var(--accent-copper-bright)', color: '#1a1208', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)',
  background: 'var(--bg-panel)', color: 'var(--text-primary)', fontSize: 14, outline: 'none',
};

/* ---------------- Main page ---------------- */

export default function Settings() {
  const { householdId, householdName, logout } = useAuth();

  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState(null);

  const [tempUnit, setTempUnit] = useState(readLS(LS_KEYS.tempUnit, 'C'));
  const [energyUnit, setEnergyUnit] = useState(readLS(LS_KEYS.energyUnit, 'kWh'));
  const [autoLock, setAutoLock] = useState(readLS(LS_KEYS.autoLock, 'false') === 'true');
  const [autoLockSecs, setAutoLockSecs] = useState(Number(readLS(LS_KEYS.autoLockSeconds, '30')));
  const [sessionTimeout, setSessionTimeout] = useState(Number(readLS(LS_KEYS.sessionTimeout, '15')));

  const idleTimer = useRef(null);

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    try {
      const res = await client.get('/api/devices/');
      setDevices(res.data);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { localStorage.setItem(LS_KEYS.tempUnit, tempUnit); }, [tempUnit]);
  useEffect(() => { localStorage.setItem(LS_KEYS.energyUnit, energyUnit); }, [energyUnit]);
  useEffect(() => { localStorage.setItem(LS_KEYS.autoLock, String(autoLock)); }, [autoLock]);
  useEffect(() => { localStorage.setItem(LS_KEYS.autoLockSeconds, String(autoLockSecs)); }, [autoLockSecs]);
  useEffect(() => { localStorage.setItem(LS_KEYS.sessionTimeout, String(sessionTimeout)); }, [sessionTimeout]);

  useEffect(() => {
    const resetTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (sessionTimeout <= 0) return;
      idleTimer.current = setTimeout(() => {
        logout();
      }, sessionTimeout * 60 * 1000);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));
    resetTimer();
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [sessionTimeout, logout]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const sendRestart = async (deviceId) => {
    try {
      await client.post('/api/commands/send/', { device: deviceId, action: 'restart' });
      showToast('Restart command sent — confirm the board reboots. If it does not, your firmware needs a handler for the "restart" action.');
    } catch (err) {
      showToast('Failed to send restart command.');
    }
  };

  const exportData = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      household: { id: householdId, name: householdName },
      devices,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartnest-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported current device data.');
  };

  const clearCache = () => {
    loadDevices();
    showToast('Refetched live data from the backend.');
  };

  return (
    <div className="sn-page">
      <h1 className="sn-page-title">Settings</h1>
      <p className="sn-page-subtitle">Manage devices and system preferences</p>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, background: 'var(--bg-panel-raised)',
          border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 16px',
          maxWidth: 340, fontSize: 13, zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}

      {showAddModal && (
        <AddDeviceModal
          householdId={householdId}
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); loadDevices(); }}
        />
      )}

      <div className="sn-grid sn-grid-3" style={{ marginBottom: 20 }}>
        <PanelCard title="Device Settings" icon={Cpu}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            {devices.length} board{devices.length !== 1 ? 's' : ''} registered
          </p>
        </PanelCard>
        <PanelCard title="Preferences" icon={Thermometer}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Units and defaults</p>
        </PanelCard>
        <PanelCard title="Security & Session" icon={Shield}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Auto-lock and timeout</p>
        </PanelCard>
      </div>

      <PanelCard title="Device Settings" icon={Cpu} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span className="label-eyebrow">Connected devices and integrations</span>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
              border: 'none', background: 'var(--accent-copper-bright)', color: '#1a1208',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            <Plus size={15} /> Add Board
          </button>
        </div>

        {loadingDevices && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading devices…</p>}

        {!loadingDevices && devices.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            No boards registered yet. Add one to get its device key for your firmware.
          </p>
        )}

        {devices.map((d) => {
          const online = d.last_seen && (now - new Date(d.last_seen).getTime()) < OFFLINE_THRESHOLD_MS;
          return (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '12px 0', borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                {online ? <Wifi size={17} color="var(--status-safe)" /> : <WifiOff size={17} color="var(--text-secondary)" />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14 }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {d.type === 'esp32' ? 'ESP32' : 'Arduino UNO'}{d.location ? ` · ${d.location}` : ''}
                    {' · '}
                    {d.last_seen ? `Last seen ${new Date(d.last_seen).toLocaleString()}` : 'Never reported in'}
                  </div>
                </div>
              </div>
              {d.type === 'esp32' && (
                <button
                  onClick={() => sendRestart(d.id)}
                  title="Send restart command"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 7,
                    border: '1px solid var(--border-subtle)', background: 'transparent',
                    color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  <RefreshCw size={13} /> Restart
                </button>
              )}
            </div>
          );
        })}
      </PanelCard>

      <PanelCard title="System Information" icon={SettingsIcon} style={{ marginBottom: 20 }}>
        <PrefRow icon={SettingsIcon} label="Household" sub="Your registered home">
          <span style={{ fontSize: 14 }}>{householdName || '—'}</span>
        </PrefRow>
        <PrefRow icon={SettingsIcon} label="System ID" sub="Household ID used in API calls">
          <span style={{ fontSize: 14, fontFamily: 'monospace' }}>{householdId ?? '—'}</span>
        </PrefRow>
        <PrefRow icon={Cpu} label="Registered boards" sub="ESP32 + Arduino count">
          <span style={{ fontSize: 14 }}>{devices.length}</span>
        </PrefRow>
      </PanelCard>

      <PanelCard title="Display Preferences" icon={Thermometer} style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 10 }}>
          Stored on this browser only. Dashboard, Climate, and Energy pages currently render in °C / kWh regardless of this
          setting — wiring it through those pages is a follow-up step, not done yet.
        </p>
        <PrefRow icon={Thermometer} label="Temperature Unit">
          <SegButton
            options={[{ value: 'C', label: '°C' }, { value: 'F', label: '°F' }]}
            value={tempUnit}
            onChange={setTempUnit}
          />
        </PrefRow>
        <PrefRow icon={Zap} label="Energy Unit">
          <SegButton
            options={[{ value: 'kWh', label: 'kWh' }, { value: 'W', label: 'W' }]}
            value={energyUnit}
            onChange={setEnergyUnit}
          />
        </PrefRow>
      </PanelCard>

      <PanelCard title="Security & Session" icon={Shield} style={{ marginBottom: 20 }}>
        <PrefRow
          icon={AlertTriangle}
          label="Auto-Lock Front Door"
          sub={autoLock ? `Locks ${autoLockSecs}s after you unlock it, while this tab stays open` : 'Off'}
        >
          <Toggle checked={autoLock} onChange={setAutoLock} />
        </PrefRow>
        {autoLock && (
          <PrefRow icon={Clock} label="Auto-Lock Delay (seconds)">
            <input
              type="number"
              min={5}
              max={300}
              value={autoLockSecs}
              onChange={(e) => setAutoLockSecs(Number(e.target.value))}
              style={{ ...inputStyle, width: 90, padding: '6px 10px' }}
            />
          </PrefRow>
        )}
        <PrefRow icon={Clock} label="Session Timeout" sub="Auto sign-out after inactivity (0 = disabled)">
          <input
            type="number"
            min={0}
            max={180}
            value={sessionTimeout}
            onChange={(e) => setSessionTimeout(Number(e.target.value))}
            style={{ ...inputStyle, width: 90, padding: '6px 10px' }}
          />
        </PrefRow>
      </PanelCard>

      <PanelCard title="Data" icon={Download} style={{ marginBottom: 20 }}>
        <PrefRow icon={Download} label="Export Data" sub="Download your current devices as JSON">
          <button onClick={exportData} style={quietBtn}>Export</button>
        </PrefRow>
        <PrefRow icon={RefreshCw} label="Refresh Cache" sub="Refetch live data from the backend">
          <button onClick={clearCache} style={quietBtn}>Refresh</button>
        </PrefRow>
        <PrefRow icon={LogOut} label="Sign Out" sub="Log out of this device">
          <button onClick={logout} style={{ ...quietBtn, color: 'var(--status-critical)', borderColor: 'rgba(225,85,84,0.35)' }}>
            Sign Out
          </button>
        </PrefRow>
      </PanelCard>

      <PanelCard title="Help" icon={HelpCircle}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          Two-Factor Authentication, OTA firmware updates, and cloud backup aren't built yet — they're not shown here
          rather than shown as fake toggles that don't do anything.
        </p>
      </PanelCard>
    </div>
  );
}

const quietBtn = {
  padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border-subtle)',
  background: 'transparent', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
};