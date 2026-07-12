import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame, Wind, Activity, AlertTriangle, Bell, CheckCircle2, Radio,
  Thermometer, DoorOpen, Zap, Droplet, Car, ShieldAlert, Power, Volume2,
  RefreshCw, CheckCheck, ChevronRight,
} from 'lucide-react';
import PanelCard from '../components/ui/PanelCard';
import StatusPill from '../components/ui/StatusPill';
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

function StatCard({ icon: Icon, label, value, sub, status }) {
  const color = { safe: 'var(--status-safe)', warning: 'var(--status-warning)', critical: 'var(--status-critical)' }[status];
  return (
    <PanelCard className="sn-stat-card">
      <div className="sn-stat-icon-circle" style={{ background: `${color}22`, color }}>
        <Icon size={22} />
      </div>
      <div className="sn-stat-card-body">
        <div className="sn-stat-card-label">{label}</div>
        <div className="sn-stat-card-value">{value}</div>
        <div className="sn-stat-card-status" style={{ color }}>{sub}</div>
      </div>
    </PanelCard>
  );
}

export default function Safety() {
  const { householdId, householdName } = useAuth();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);

  const [motion, setMotion] = useState(false);
  const [gas, setGas] = useState(null);
  const [flame, setFlame] = useState(false);
  const [temperature, setTemperature] = useState(null);
  const [vibration, setVibration] = useState(false);
  const [cutoffOn, setCutoffOn] = useState(false);

  const [alerts, setAlerts] = useState([]);      // recent, for Recent Activity
  const [unresolvedAlerts, setUnresolvedAlerts] = useState([]); // is_read=false, for Active Alerts panel

  const [sirenActive, setSirenActive] = useState(false);
  const [cutoffBusy, setCutoffBusy] = useState(false);

  const { lastMessage: sensorMessage } = useWebSocket('/ws/sensors/', householdId);
  const { lastMessage: alertMessage } = useWebSocket('/ws/alerts/', householdId);

  const fetchAll = useCallback(async () => {
    if (!householdId) return;
    try {
      const devicesRes = await client.get('/api/devices/');
      if (devicesRes.data.length === 0) { setLoading(false); return; }
      const d = devicesRes.data[0];
      setDevice(d);

      const [latestRes, allAlertsRes, unreadRes] = await Promise.all([
        client.get(`/api/sensors/latest/?device_id=${d.id}`),
        client.get(`/api/alerts/?device_id=${d.id}`),
        client.get(`/api/alerts/?device_id=${d.id}&is_read=false`),
      ]);

      latestRes.data.forEach((r) => {
        if (r.sensor_type === 'motion') setMotion(r.value === 1);
        if (r.sensor_type === 'gas') setGas({ value: r.value, unit: r.unit });
        if (r.sensor_type === 'flame') setFlame(r.value === 1);
        if (r.sensor_type === 'temperature') setTemperature({ value: r.value, unit: r.unit });
        if (r.sensor_type === 'vibration') setVibration(r.value === 1);
        if (r.sensor_type === 'cutoff_relay') setCutoffOn(r.value === 1);
      });

      setAlerts(allAlertsRes.data.slice(0, 8));
      setUnresolvedAlerts(unreadRes.data);
    } catch (err) {
      console.error('Failed to load safety data:', err);
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!sensorMessage) return;
    if (sensorMessage.motion !== undefined) setMotion(sensorMessage.motion);
    if (sensorMessage.gas_percent !== undefined) setGas({ value: sensorMessage.gas_percent, unit: '%' });
    if (sensorMessage.flame_detected !== undefined) setFlame(sensorMessage.flame_detected);
    if (sensorMessage.temperature !== undefined) setTemperature({ value: sensorMessage.temperature, unit: 'C' });
    if (sensorMessage.vibration_detected !== undefined) setVibration(sensorMessage.vibration_detected);
    if (sensorMessage.cutoff_on !== undefined) setCutoffOn(sensorMessage.cutoff_on);
  }, [sensorMessage]);

  useEffect(() => {
    if (!alertMessage || alertMessage.kind !== 'alert' || alertMessage.type === 'rfid_result') return;
    const newAlert = {
      id: alertMessage.id,
      type: alertMessage.type,
      severity: alertMessage.severity,
      message: alertMessage.message,
      timestamp: alertMessage.timestamp || new Date().toISOString(),
      is_read: false,
    };
    setAlerts((prev) => [newAlert, ...prev].slice(0, 8));
    setUnresolvedAlerts((prev) => [newAlert, ...prev]);
  }, [alertMessage]);

  const toggleCutoff = async () => {
    if (!device || cutoffBusy) return;
    setCutoffBusy(true);
    const next = !cutoffOn;
    setCutoffOn(next); // optimistic — no ack loop exists for this relay yet
    try {
      await client.post('/api/commands/send/', { device: device.id, action: next ? 'cutoff_on' : 'cutoff_off' });
    } catch (err) {
      console.error('Cutoff command failed:', err);
      setCutoffOn(!next);
    } finally {
      setCutoffBusy(false);
    }
  };

  const testSiren = async () => {
    if (!device) return;
    const next = !sirenActive;
    setSirenActive(next); // manual test trigger, fire-and-forget — no backend siren-state field exists
    try {
      await client.post('/api/commands/send/', { device: device.id, action: next ? 'siren_on' : 'siren_off' });
    } catch (err) {
      console.error('Siren command failed:', err);
    }
  };

  const acknowledgeAll = async () => {
    try {
      await Promise.all(unresolvedAlerts.map((a) => client.post('/api/alerts/read/', { alert_id: a.id })));
      setUnresolvedAlerts([]);
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    } catch (err) {
      console.error('Failed to acknowledge alerts:', err);
    }
  };

  if (loading) return <div className="sn-page-loading">Loading safety…</div>;

  if (!device) {
    return (
      <div className="sn-page">
        <h1 className="sn-page-title">Safety & Alarms</h1>
        <p className="sn-page-subtitle">No devices registered yet for {householdName}.</p>
      </div>
    );
  }

  // Visual coding for the "All Sensors Status" list — binary Normal/Alert,
  // matching the same gas thresholds already used elsewhere in this app.
  const gasState = gas === null ? null : gas.value > 30 ? 'critical' : 'safe';
  const warningCount = unresolvedAlerts.filter((a) => a.severity === 'warning').length;

  const sensorRows = [
    { key: 'motion', icon: Radio, label: 'PIR Motion Sensor', ready: true, alert: motion, text: motion ? 'Motion Detected' : 'No Motion' },
    { key: 'gas', icon: Wind, label: 'Gas Sensor (MQ-2)', ready: gas !== null, alert: gasState === 'critical', text: gas !== null ? `${Math.round(gas.value)}${gas.unit}` : 'No data' },
    { key: 'flame', icon: Flame, label: 'Flame Sensor', ready: true, alert: flame, text: flame ? 'Flame Detected' : 'No Fire' },
    { key: 'temperature', icon: Thermometer, label: 'Temperature (DHT22)', ready: temperature !== null, alert: false, text: temperature !== null ? `${Math.round(temperature.value)}°${temperature.unit}` : 'No data' },
    { key: 'vibration', icon: Activity, label: 'Vibration / Earthquake Sensor', ready: true, alert: vibration, text: vibration ? 'Vibration Detected' : 'Stable' },
  ];
  const normalSensorCount = sensorRows.filter((s) => s.ready && !s.alert).length;
  const totalSensorCount = sensorRows.filter((s) => s.ready).length;

  const allSecure = unresolvedAlerts.length === 0;

  return (
    <div className="sn-page">
      <style>{`
        .safety-alert-card {
          display: flex; gap: 12px; padding: 14px 16px; border-radius: 10px;
          background: var(--bg-deep); border-left: 3px solid var(--status-warning);
          margin-bottom: 10px;
        }
        .safety-alert-card.critical { border-left-color: var(--status-critical); }
        .safety-alert-card-body { flex: 1; min-width: 0; }
        .safety-alert-card-top { display: flex; justify-content: space-between; gap: 10px; }
        .safety-alert-card-title { font-weight: 700; font-size: 13.5px; }
        .safety-alert-card-msg { font-size: 12.5px; color: var(--text-secondary); margin-top: 2px; }
        .safety-alert-card-meta { display: flex; justify-content: space-between; margin-top: 8px; font-size: 11.5px; color: var(--text-secondary); }
        .safety-sensor-row {
          display: flex; align-items: center; gap: 10px; padding: 10px 0;
          border-bottom: 1px solid var(--border-subtle); font-size: 13.5px;
        }
        .safety-sensor-row:last-child { border-bottom: none; }
        .safety-sensor-row > span:first-of-type { flex: 1; }
        .safety-status-hero { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 10px 0 18px; }
        .safety-quad { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 16px; }
        .safety-quad-item { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
        .safety-quad-label { font-size: 11px; color: var(--text-secondary); }
        .safety-quad-value { font-size: 12.5px; font-weight: 700; }
        @media (max-width: 700px) { .safety-quad { grid-template-columns: repeat(2, 1fr); } }
      `}</style>

      <div className="sn-page-header">
        <div>
          <h1 className="sn-page-title">Safety & Alarms</h1>
          <p className="sn-page-subtitle">Monitor safety sensors and system alerts in real-time — {householdName}</p>
        </div>
        <button className="sn-icon-btn" onClick={fetchAll} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Top stat row */}
      <div className="sn-grid sn-grid-4">
        <StatCard icon={AlertTriangle} label="Active Alerts" value={unresolvedAlerts.length} sub={unresolvedAlerts.length === 0 ? 'All Clear' : 'Requires Attention'} status={unresolvedAlerts.length === 0 ? 'safe' : 'critical'} />
        <StatCard icon={Bell} label="Warning Alerts" value={warningCount} sub="Monitor" status={warningCount === 0 ? 'safe' : 'warning'} />
        <StatCard icon={CheckCircle2} label="Normal" value={normalSensorCount} sub="All Good" status="safe" />
        <StatCard icon={Radio} label="Total Sensors" value={totalSensorCount} sub={device.is_online ? 'Online' : 'Offline'} status={device.is_online ? 'safe' : 'critical'} />
      </div>

      <div className="sn-grid sn-grid-140">
        {/* Active Alerts */}
        <PanelCard title="Active Alerts" icon={Bell} className="sn-chart-panel">
          {unresolvedAlerts.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, textAlign: 'center', padding: '20px 0' }}>
              No active alerts. Everything's quiet.
            </p>
          ) : (
            unresolvedAlerts.slice(0, 4).map((a) => {
              const Icon = ALERT_ICON[a.type] || AlertTriangle;
              return (
                <div key={a.id} className={`safety-alert-card ${a.severity === 'critical' ? 'critical' : ''}`}>
                  <Icon size={18} style={{ color: a.severity === 'critical' ? 'var(--status-critical)' : 'var(--status-warning)', flexShrink: 0, marginTop: 2 }} />
                  <div className="safety-alert-card-body">
                    <div className="safety-alert-card-top">
                      <span className="safety-alert-card-title">{a.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                    </div>
                    <div className="safety-alert-card-msg">{a.message}</div>
                    <div className="safety-alert-card-meta">
                      <span>Location: {device.location || 'Unspecified'}</span>
                      <span>{timeAgo(a.timestamp)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {unresolvedAlerts.length > 4 && (
            <button
              className="sn-btn-outline"
              style={{ width: '100%', marginTop: 6, justifyContent: 'center' }}
              onClick={() => navigate('/notifications')}
            >
              View {unresolvedAlerts.length - 4} more <ChevronRight size={14} />
            </button>
          )}
          {unresolvedAlerts.length > 0 && (
            <button className="sn-btn-outline" style={{ width: '100%', marginTop: 6, justifyContent: 'center' }} onClick={acknowledgeAll}>
              <CheckCheck size={14} /> Acknowledge All
            </button>
          )}
        </PanelCard>

        {/* All Sensors Status */}
        <PanelCard title="All Sensors Status" icon={CheckCircle2} className="sn-chart-panel">
          {sensorRows.map((s) => (
            <div key={s.key} className="safety-sensor-row">
              <s.icon size={16} className="sn-security-icon" />
              <span>{s.label}</span>
              {s.ready ? (
                <StatusPill status={s.alert ? 'critical' : 'safe'} text={s.alert ? 'ALERT' : 'NORMAL'} />
              ) : (
                <span className="label-eyebrow" style={{ color: 'var(--text-secondary)' }}>NO DATA</span>
              )}
              <span style={{ width: 110, textAlign: 'right', color: 'var(--text-secondary)', fontSize: 12.5 }}>{s.text}</span>
            </div>
          ))}
        </PanelCard>
      </div>

      <div className="sn-grid sn-grid-2">
        {/* System Status */}
        <PanelCard title="System Status" icon={ShieldAlert} className="sn-chart-panel">
          <div className="safety-status-hero">
            <div style={{
              width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: allSecure ? 'rgba(76,175,125,0.14)' : 'rgba(225,85,84,0.14)', marginBottom: 10,
            }}>
              <CheckCircle2 size={30} style={{ color: allSecure ? 'var(--status-safe)' : 'var(--status-critical)' }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: allSecure ? 'var(--status-safe)' : 'var(--status-critical)' }}>
              {allSecure ? 'All Systems Secure' : `${unresolvedAlerts.length} Alert${unresolvedAlerts.length > 1 ? 's' : ''} Need Attention`}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>
              {allSecure ? 'Your home is safe and all systems are operating normally.' : 'Review the Active Alerts panel above.'}
            </span>
          </div>

          {/* Real quad — replaces screenshot's fabricated "Alarms Armed / Response Enabled /
              Backup Online" with fields that actually exist on the backend: always-on
              monitoring, real board connectivity, the real cutoff relay state (with a
              working toggle), and the real last-sync timestamp. */}
          <div className="safety-quad">
            <div className="safety-quad-item">
              <ShieldAlert size={18} style={{ color: 'var(--status-safe)' }} />
              <span className="safety-quad-label">Monitoring</span>
              <span className="safety-quad-value">24/7 Active</span>
            </div>
            <div className="safety-quad-item">
              <Radio size={18} style={{ color: device.is_online ? 'var(--status-safe)' : 'var(--status-critical)' }} />
              <span className="safety-quad-label">Board</span>
              <span className="safety-quad-value">{device.is_online ? 'Online' : 'Offline'}</span>
            </div>
            <div className="safety-quad-item">
              <Power size={18} style={{ color: cutoffOn ? 'var(--status-critical)' : 'var(--status-safe)' }} />
              <span className="safety-quad-label">Cutoff Relay</span>
              <span className="safety-quad-value">{cutoffOn ? 'Engaged' : 'Nominal'}</span>
            </div>
            <div className="safety-quad-item">
              <CheckCircle2 size={18} style={{ color: 'var(--text-secondary)' }} />
              <span className="safety-quad-label">Last Sync</span>
              <span className="safety-quad-value">{device.last_seen ? timeAgo(device.last_seen) : 'Never'}</span>
            </div>
          </div>

          <div className="sn-btn-row">
            <button className="sn-btn-outline" disabled={cutoffBusy} onClick={toggleCutoff}>
              <Power size={14} /> {cutoffOn ? 'Restore Power' : 'Emergency Cutoff'}
            </button>
            <button className="sn-btn-outline" onClick={testSiren}>
              <Volume2 size={14} /> {sirenActive ? 'Stop Siren' : 'Test Siren'}
            </button>
          </div>
        </PanelCard>

        {/* Recent Activity */}
        <PanelCard title="Recent Activity" icon={Activity} className="sn-chart-panel">
          <div className="sn-history-feed">
            {alerts.length === 0 && <p className="label-eyebrow">No activity logged yet.</p>}
            {alerts.map((a) => {
              const Icon = ALERT_ICON[a.type] || AlertTriangle;
              return (
                <div key={a.id} className="sn-history-item">
                  <Icon size={16} className={`sn-history-icon sn-history-${a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'safe'}`} />
                  <div className="sn-history-text">
                    <span className="sn-history-message">{a.message}</span>
                    <span className="sn-history-time">{timeAgo(a.timestamp)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </PanelCard>
      </div>

      <div className="sn-home-banner" style={{ background: 'linear-gradient(120deg, rgba(76,175,125,0.12), rgba(76,175,125,0.03))', borderColor: 'rgba(76,175,125,0.25)' }}>
        <div className="sn-home-banner-left">
          <div className="sn-home-banner-icon" style={{ background: 'rgba(76,175,125,0.18)', color: 'var(--status-safe)' }}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <div className="sn-home-banner-title">The Nexus Dome is actively monitoring your home for any safety threats.</div>
            <div className="sn-home-banner-sub">You'll be notified immediately in case of any critical alerts.</div>
          </div>
        </div>
      </div>
    </div>
  );
}