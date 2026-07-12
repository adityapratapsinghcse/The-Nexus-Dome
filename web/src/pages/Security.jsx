import { useState, useEffect, useCallback } from 'react';
import {
  Car, DoorOpen, Lock, Unlock, ShieldCheck, Fingerprint, Radio,
  Wind, Flame, Droplet, Activity, Bell, RefreshCw, XCircle, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react';
import PanelCard from '../components/ui/PanelCard';
import StatusPill from '../components/ui/StatusPill';
import client from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';
import GaragePromptModal from '../components/GaragePromptModal';

// Garage gate is pulse-based on the hardware side (the ESP32 opens the
// servo, then the ack resets state back to 'vacant' once done) — there is
// no persistent "gate is currently standing open" state in the backend, so
// we don't invent one here. 'opening' is the only transitional state.
const GARAGE_STATUS_DISPLAY = {
  vacant: { status: 'safe', text: 'CLOSED' },
  occupied: { status: 'warning', text: 'VEHICLE PRESENT' },
  pending: { status: 'critical', text: 'AWAITING YOUR ANSWER' },
  opening: { status: 'warning', text: 'OPENING…' },
};

function StatCard({ icon: Icon, label, value, sub, status, tint }) {
  const color = tint || { safe: 'var(--status-safe)', warning: 'var(--status-warning)', critical: 'var(--status-critical)' }[status];
  return (
    <PanelCard className="sn-stat-card">
      <div className="sn-stat-icon-circle" style={{ background: `${color}22`, color }}>
        <Icon size={22} />
      </div>
      <div className="sn-stat-card-body">
        <div className="sn-stat-card-label">{label}</div>
        <div className="sn-stat-card-value" style={{ fontSize: 17 }}>{value}</div>
        <div className="sn-stat-card-status" style={{ color }}>{sub}</div>
      </div>
    </PanelCard>
  );
}

function SensorRow({ icon: Icon, label, value, status, unavailable }) {
  return (
    <div className="sn-security-item" style={{ padding: '9px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <Icon size={16} className="sn-security-icon" style={unavailable ? { color: 'var(--text-secondary)' } : undefined} />
      <span>{label}</span>
      {unavailable ? (
        <span className="label-eyebrow" style={{ color: 'var(--text-secondary)' }}>NO SENSOR</span>
      ) : (
        <StatusPill status={status} text={value} />
      )}
    </div>
  );
}

export default function Security() {
  const { householdId, householdName } = useAuth();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);

  const [garageStatus, setGarageStatus] = useState('vacant');
  const [doorStatus, setDoorStatus] = useState('locked');
  const [distanceCm, setDistanceCm] = useState(null);
  const [motion, setMotion] = useState(false);
  const [gas, setGas] = useState(0);
  const [flame, setFlame] = useState(false);
  const [vibration, setVibration] = useState(false);
  const [windowOpen, setWindowOpen] = useState(null); // null = no reading yet ever

  const [accessLog, setAccessLog] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activeAlertCount, setActiveAlertCount] = useState(0);

  const [prompt, setPrompt] = useState(null); // { device_id, alert_id, text }
  const [lockBusy, setLockBusy] = useState(false);
  const [garageBusy, setGarageBusy] = useState(false);

  const { lastMessage: sensorMessage } = useWebSocket('/ws/sensors/', householdId);
  const { lastMessage: alertMessage } = useWebSocket('/ws/alerts/', householdId);

  const fetchAll = useCallback(async () => {
    if (!householdId) return;
    try {
      const devicesRes = await client.get('/api/devices/');
      if (devicesRes.data.length === 0) { setLoading(false); return; }
      const d = devicesRes.data[0];
      setDevice(d);
      setGarageStatus(d.garage_status || 'vacant');
      setDoorStatus(d.door_status || 'locked');

      const [latestRes, accessRes, alertsRes] = await Promise.all([
        client.get(`/api/sensors/latest/?device_id=${d.id}`),
        client.get(`/api/access/log/?device_id=${d.id}`),
        client.get(`/api/alerts/?device_id=${d.id}`),
      ]);

      latestRes.data.forEach((r) => {
        if (r.sensor_type === 'distance') setDistanceCm(r.value);
        if (r.sensor_type === 'motion') setMotion(r.value === 1);
        if (r.sensor_type === 'gas') setGas(r.value);
        if (r.sensor_type === 'flame') setFlame(r.value === 1);
        if (r.sensor_type === 'vibration') setVibration(r.value === 1);
        if (r.sensor_type === 'window') setWindowOpen(r.value === 1);
      });

      setAccessLog(accessRes.data.slice(0, 6));
      setAlerts(alertsRes.data.slice(0, 6));
      setActiveAlertCount(alertsRes.data.filter((a) => !a.is_read).length);
    } catch (err) {
      console.error('Failed to load security data:', err);
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Live sensor bus — feeds the "Alarm & Sensor Status" panel
  useEffect(() => {
    if (!sensorMessage) return;
    if (sensorMessage.distance_cm !== undefined) setDistanceCm(sensorMessage.distance_cm);
    if (sensorMessage.motion !== undefined) setMotion(sensorMessage.motion);
    if (sensorMessage.gas_percent !== undefined) setGas(sensorMessage.gas_percent);
    if (sensorMessage.flame_detected !== undefined) setFlame(sensorMessage.flame_detected);
    if (sensorMessage.vibration_detected !== undefined) setVibration(sensorMessage.vibration_detected);
    if (sensorMessage.window_open !== undefined) setWindowOpen(sensorMessage.window_open);
  }, [sensorMessage]);

  // Live events over the alerts socket: garage prompt/status, door status,
  // and RFID scan results (kind is set server-side by AlertConsumer)
  useEffect(() => {
    if (!alertMessage) return;

    if (alertMessage.kind === 'garage_prompt') {
      setPrompt(alertMessage);
      setGarageStatus('pending');
    }
    if (alertMessage.kind === 'garage_status') {
      setGarageStatus(alertMessage.garage_status);
    }
    if (alertMessage.kind === 'door_status') {
      setDoorStatus(alertMessage.door_status);
    }
    if (alertMessage.kind === 'alert' && alertMessage.type === 'rfid_result') {
      setAccessLog((prev) => [{
        granted: alertMessage.granted,
        rfid_uid: alertMessage.rfid_uid,
        card_label: null,
        method: 'rfid',
        timestamp: new Date().toISOString(),
      }, ...prev].slice(0, 6));
    }
    if (alertMessage.kind === 'alert' && alertMessage.type !== 'rfid_result') {
      setAlerts((prev) => [{
        id: alertMessage.id,
        type: alertMessage.type,
        severity: alertMessage.severity,
        message: alertMessage.message,
        timestamp: alertMessage.timestamp || new Date().toISOString(),
        is_read: false,
      }, ...prev].slice(0, 6));
      setActiveAlertCount((c) => c + 1);
    }
  }, [alertMessage]);

  const respondToPrompt = async (confirm) => {
    if (!prompt) return;
    try {
      const { data } = await client.post('/api/commands/garage/confirm/', {
        device_id: prompt.device_id,
        confirm,
      });
      setGarageStatus(data.garage_status);
    } catch (err) {
      console.error('Garage confirm failed:', err);
    } finally {
      setPrompt(null);
    }
  };

  const manualGarage = async (open) => {
    if (!device || garageBusy) return;
    setGarageBusy(true);
    try {
      const { data } = await client.post('/api/commands/garage/confirm/', {
        device_id: device.id,
        confirm: open,
      });
      setGarageStatus(data.garage_status);
    } catch (err) {
      console.error('Manual garage command failed:', err);
    } finally {
      setGarageBusy(false);
    }
  };

  const setDoorLock = async (locked) => {
    if (!device || lockBusy) return;
    setLockBusy(true);
    const action = locked ? 'lock_door' : 'unlock_door';
    // Optimistic — the real confirmation comes back over the 'door_status'
    // WebSocket event once the ESP32 acks the command. If it never acks
    // (e.g. no hardware connected yet), this optimistic value is what stays.
    setDoorStatus(locked ? 'locked' : 'unlocked');
    try {
      await client.post('/api/commands/send/', { device: device.id, action });
    } catch (err) {
      console.error('Door lock command failed:', err);
      setDoorStatus(locked ? 'unlocked' : 'locked'); // revert
    } finally {
      setLockBusy(false);
    }
  };

  if (loading) return <div className="sn-page-loading">Loading security…</div>;

  if (!device) {
    return (
      <div className="sn-page">
        <h1 className="sn-page-title">Security</h1>
        <p className="sn-page-subtitle">No devices registered yet for {householdName}.</p>
      </div>
    );
  }

  const garageDisplay = GARAGE_STATUS_DISPLAY[garageStatus] || GARAGE_STATUS_DISPLAY.vacant;
  const gasStatus = gas > 50 ? 'critical' : gas > 30 ? 'warning' : 'safe';

  return (
    <div className="sn-page security-page">
      <style>{`
        .security-page-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 20px; gap: 12px; flex-wrap: wrap;
        }
      `}</style>

      {/* NOTE: .sn-security-controls, .sn-security-control-*, .sn-btn-row,
          .sn-btn-solid/.sn-btn-outline, and .sn-distance-readout used to be
          defined right here, scoped to this page only via this <style> tag.
          Since React removes the tag when you navigate away, every other
          page that reused those same class names (Safety's Emergency
          Cutoff/Test Siren buttons, the Notifications page) rendered
          unstyled. They're now permanent global rules in index.css instead. */}

      <div className="security-page-header">
        <div>
          <h1 className="sn-page-title">Security</h1>
          <p className="sn-page-subtitle">Protecting what matters most — {householdName}</p>
        </div>
        <button className="sn-icon-btn" onClick={fetchAll} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Top summary row */}
      <div className="sn-grid sn-grid-5">
        <StatCard
          icon={doorStatus === 'locked' ? Lock : Unlock}
          label="Front Door"
          value={doorStatus === 'locked' ? 'Locked' : 'Unlocked'}
          sub={doorStatus === 'locked' ? 'Secure' : 'Unlocked'}
          status={doorStatus === 'locked' ? 'safe' : 'warning'}
        />
        <StatCard
          icon={Radio}
          label="Motion (PIR)"
          value={motion ? 'Motion' : 'No Motion'}
          sub={motion ? 'Detected' : 'Normal'}
          status={motion ? 'warning' : 'safe'}
        />
        <StatCard
          icon={Car}
          label="Garage Door"
          value={garageDisplay.text[0] + garageDisplay.text.slice(1).toLowerCase()}
          sub={distanceCm !== null ? `Distance: ${Math.round(distanceCm)} cm` : 'No reading yet'}
          status={garageDisplay.status}
        />
        <StatCard
          icon={ShieldCheck}
          label="System"
          value="Monitoring"
          sub="24/7 Active"
          status="safe"
        />
        <StatCard
          icon={Bell}
          label="Active Alerts"
          value={activeAlertCount}
          sub={activeAlertCount === 0 ? 'All Clear' : 'Requires Attention'}
          status={activeAlertCount === 0 ? 'safe' : 'critical'}
        />
      </div>

      <div className="sn-grid sn-grid-3">
        {/* Access Control */}
        <PanelCard title="Access Control" icon={Lock} className="sn-chart-panel">
          <div className="sn-security-controls">
            <div className="sn-security-control-block">
              <div className="sn-security-control-title">Front Door</div>
              <div className="sn-security-control-sub">Main Entrance</div>
              <StatusPill status={doorStatus === 'locked' ? 'safe' : 'warning'} text={doorStatus.toUpperCase()} />
              <div className="sn-btn-row">
                <button className="sn-btn-outline" disabled={lockBusy || doorStatus === 'unlocked'} onClick={() => setDoorLock(false)}>
                  <Unlock size={14} /> Unlock Door
                </button>
                <button className="sn-btn-solid" disabled={lockBusy || doorStatus === 'locked'} onClick={() => setDoorLock(true)}>
                  <Lock size={14} /> Lock Door
                </button>
              </div>
            </div>

            <div className="sn-security-control-block">
              <div className="sn-security-control-title">Garage Door</div>
              <div className="sn-security-control-sub">Main Garage</div>
              <StatusPill status={garageDisplay.status} text={garageDisplay.text} />
              {distanceCm !== null && (
                <div className="sn-distance-readout" style={{ marginTop: 10 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Distance (Ultrasonic Sensor)</span>
                  <b>{Math.round(distanceCm)} cm</b>
                </div>
              )}
              <div className="sn-btn-row">
                <button className="sn-btn-solid" disabled={garageBusy} onClick={() => manualGarage(true)}>
                  <ArrowUpCircle size={14} /> Open Garage
                </button>
                <button className="sn-btn-outline" disabled={garageBusy} onClick={() => manualGarage(false)}>
                  <ArrowDownCircle size={14} /> Close Garage
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
            <span className="label-eyebrow">Recent Access</span>
            <div className="sn-history-feed" style={{ marginTop: 8 }}>
              {accessLog.length === 0 && <p className="label-eyebrow">No access events yet.</p>}
              {accessLog.map((a, i) => (
                <div key={i} className="sn-history-item">
                  {a.granted ? <ShieldCheck size={16} className="sn-history-icon sn-history-safe" /> : <XCircle size={16} className="sn-history-icon sn-history-critical" />}
                  <div className="sn-history-text">
                    <span className="sn-history-message">
                      {a.granted ? 'Access granted' : 'Access denied'}
                      {a.granted && a.card_label ? ` — ${a.card_label}` : a.granted ? '' : ' — Unknown RFID'}
                    </span>
                    <span className="sn-history-time">{new Date(a.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PanelCard>

        {/* Alarm & Sensor Status */}
        <PanelCard title="Alarm & Sensor Status" icon={Bell} className="sn-chart-panel">
          <SensorRow icon={DoorOpen} label="Front Door Sensor" value={windowOpen === null ? 'No data' : windowOpen ? 'Open' : 'Closed'} status={windowOpen ? 'warning' : 'safe'} unavailable={windowOpen === null} />
          <SensorRow icon={Radio} label="Motion Sensor (PIR)" value={motion ? 'Motion' : 'No Motion'} status={motion ? 'warning' : 'safe'} />
          <SensorRow icon={Wind} label="Gas Sensor (MQ-2)" value={`${Math.round(gas)}%`} status={gasStatus} />
          <SensorRow icon={Flame} label="Flame Sensor" value={flame ? 'Fire' : 'No Fire'} status={flame ? 'critical' : 'safe'} />
          <SensorRow icon={Droplet} label="Water Leak Sensor" unavailable />
          <SensorRow icon={Activity} label="Vibration Sensor" value={vibration ? 'Active' : 'Stable'} status={vibration ? 'warning' : 'safe'} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 10 }}>
            Water Leak Sensor isn't wired to any hardware yet — this row will populate once a leak sensor is added to the ESP32 firmware.
          </p>
        </PanelCard>

        {/* Recent Activity — real Alert feed only */}
        <PanelCard title="Recent Activity" icon={Fingerprint} className="sn-chart-panel">
          <div className="sn-history-feed">
            {alerts.length === 0 && <p className="label-eyebrow">No alerts logged yet.</p>}
            {alerts.map((a) => (
              <div key={a.id} className="sn-history-item">
                <Bell size={16} className={`sn-history-icon sn-history-${a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'safe'}`} />
                <div className="sn-history-text">
                  <div className="sn-history-top">
                    <span className="sn-history-type" style={{ fontFamily: 'var(--font-mono)' }}>{a.type?.toUpperCase()}</span>
                    <StatusPill status={a.severity === 'info' ? 'safe' : a.severity} text={a.severity?.toUpperCase()} />
                  </div>
                  <span className="sn-history-message">{a.message}</span>
                  <span className="sn-history-time">{new Date(a.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>

      {prompt && (
        <GaragePromptModal
          text={prompt.text}
          onYes={() => respondToPrompt(true)}
          onNo={() => respondToPrompt(false)}
        />
      )}
    </div>
  );
}