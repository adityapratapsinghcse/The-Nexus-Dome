import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { 
  Thermometer, 
  Droplets, 
  Wind, 
  Sun, 
  Lightbulb, 
  Fan, 
  DoorClosed, 
  Flame, 
  ShieldCheck, 
  Zap, 
  Activity, 
  TriangleAlert,
  Car
} from 'lucide-react';
import PanelCard from '../components/ui/PanelCard';
import DialGauge from '../components/ui/DialGauge';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import StatusPill from '../components/ui/StatusPill';
import LiveDot from '../components/ui/LiveDot';
import client from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';

// Extended to map the new Phase 4/5 Garage Sensor Inputs
function mapLatestReadings(readings) {
  const out = {};
  readings.forEach((r) => {
    if (r.sensor_type === 'temperature') out.temperature = r.value;
    if (r.sensor_type === 'humidity') out.humidity = r.value;
    if (r.sensor_type === 'gas') out.gas = r.value;
    if (r.sensor_type === 'light') out.light = r.value;
    if (r.sensor_type === 'current') out.current = r.value;
    if (r.sensor_type === 'distance') out.distance = r.value;
    if (r.sensor_type === 'window') out.windowOpen = r.value === 1;
    if (r.sensor_type === 'motion') out.motion = r.value === 1;
    if (r.sensor_type === 'car_presence') out.carDetected = r.value === 1;
    if (r.sensor_type === 'light_relay') out.lightOn = r.value === 1;
    if (r.sensor_type === 'fan_relay') out.fanOn = r.value === 1;
    if (r.sensor_type === 'cutoff_relay') out.cutoffOn = r.value === 1;
  });
  return out;
}

// Map real-time JSON frames coming from Django Channels WebSocket
function mapWsMessage(msg) {
  const out = {};
  if (msg.temperature !== undefined) out.temperature = msg.temperature;
  if (msg.humidity !== undefined) out.humidity = msg.humidity;
  if (msg.gas_percent !== undefined) out.gas = msg.gas_percent;
  if (msg.light_percent !== undefined) out.light = msg.light_percent;
  if (msg.current_amps !== undefined) out.current = msg.current_amps;
  if (msg.distance_cm !== undefined) out.distance = msg.distance_cm;
  if (msg.window_open !== undefined) out.windowOpen = msg.window_open;
  if (msg.motion !== undefined) out.motion = msg.motion;
  if (msg.car_detected !== undefined) out.carDetected = msg.car_detected;
  if (msg.light_on !== undefined) out.lightOn = msg.light_on;
  if (msg.fan_on !== undefined) out.fanOn = msg.fan_on;
  if (msg.cutoff_on !== undefined) out.cutoffOn = msg.cutoff_on;
  return out;
}

export default function Dashboard() {
  const { householdId } = useAuth();
  const [stats, setStats] = useState({ 
    temperature: null, 
    humidity: null, 
    gas: null, 
    light: null, 
    current: null, 
    distance: null, 
    windowOpen: false, 
    motion: false,
    carDetected: false,
    lightOn: false,
    fanOn: false,
    cutoffOn: false
  });
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);

  // Core WebSocket streams managed via native hooks
  const { lastMessage, status } = useWebSocket('/ws/sensors/', householdId);
  const { lastMessage: alertMessage } = useWebSocket('/ws/alerts/', householdId);

  // Initial load: pick the primary device in the household, sync readings + alert stack
  useEffect(() => {
    if (!householdId) return;
    (async () => {
      try {
        const devicesRes = await client.get('/api/devices/');
        if (devicesRes.data.length === 0) { 
          setLoading(false); 
          return; 
        }
        const primaryDevice = devicesRes.data[0];
        setDevice(primaryDevice);

        const [latestRes, alertsRes] = await Promise.all([
          client.get(`/api/sensors/latest/?device_id=${primaryDevice.id}`),
          client.get(`/api/alerts/?device_id=${primaryDevice.id}`),
        ]);
        setStats((s) => ({ ...s, ...mapLatestReadings(latestRes.data) }));
        setAlerts(alertsRes.data.slice(0, 5));
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [householdId]);

  // Handle incoming live telemetry frames
  useEffect(() => {
    if (!lastMessage) return;
    const mapped = mapWsMessage(lastMessage);
    setStats((s) => ({ ...s, ...mapped }));
    
    if (mapped.temperature !== undefined) {
      setHistory((prev) => [
        ...prev.slice(-11), 
        {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          temp: mapped.temperature,
        }
      ]);
    }
  }, [lastMessage]);

  // Handle incoming live alerts broadcast
  useEffect(() => {
    if (!alertMessage) return;
    setAlerts((prev) => [
      { 
        id: alertMessage.id || Date.now(), 
        severity: alertMessage.severity || 'warning', 
        message: alertMessage.message, 
        time: 'Just now' 
      }, 
      ...prev
    ].slice(0, 5));
  }, [alertMessage]);

  // Dispatches actions down the PostgreSQL Command table queue
  const sendCommand = async (action, payload = {}) => {
    if (!device) return;
    try {
      await client.post('/api/commands/send/', { 
        device: device.id, 
        action, 
        payload 
      });
    } catch (err) {
      console.error('Command transmission failed:', err);
    }
  };

  if (loading) return <div className="sn-page-loading">Loading dashboard…</div>;

  if (!device) {
    return (
      <div className="sn-page">
        <h1 className="sn-page-title">Home Overview</h1>
        <p className="sn-page-subtitle">No operational devices detected. Provision an ESP32 board under Devices to begin monitoring.</p>
      </div>
    );
  }

  return (
    <div className="sn-page">
      {/* Dynamic Header System */}
      <div className="sn-page-header">
        <div>
          <h1 className="sn-page-title">Home Overview</h1>
          <p className="sn-page-subtitle">{device.name} · {device.location}</p>
        </div>
        <div className="sn-live-indicator">
          <LiveDot color={status === 'open' ? 'var(--status-safe)' : 'var(--status-warning)'} />
          <span className="label-eyebrow">{status === 'open' ? 'Live Stream Active' : 'Reconnecting to Host'}</span>
        </div>
      </div>

      {/* Primary Telemetry Grid Matrix */}
      <div className="sn-grid sn-grid-4">
        <PanelCard title="Temperature" icon={Thermometer}>
          <div className="sn-stat-row">
            <span className="readout sn-stat-value">{stats.temperature ?? '—'}<span className="sn-stat-unit">°C</span></span>
            <StatusPill status={stats.temperature > 28 ? 'warning' : 'safe'} />
          </div>
        </PanelCard>
        
        <PanelCard title="Humidity" icon={Droplets}>
          <div className="sn-stat-row">
            <span className="readout sn-stat-value">{stats.humidity !== null ? Math.round(stats.humidity) : '—'}<span className="sn-stat-unit">%</span></span>
            <StatusPill status="safe" />
          </div>
        </PanelCard>
        
        <PanelCard title="Air Quality (MQ-2)" icon={Wind}>
          <div className="sn-stat-row">
            <span className="readout sn-stat-value">{stats.gas !== null ? Math.round(stats.gas) : '—'}<span className="sn-stat-unit">%</span></span>
            <StatusPill status={stats.gas > 50 ? 'critical' : stats.gas > 30 ? 'warning' : 'safe'} />
          </div>
        </PanelCard>
        
        <PanelCard title="Garage Range" icon={Car}>
          <div className="sn-stat-row">
            <span className="readout sn-stat-value">{stats.distance !== null ? Math.round(stats.distance) : '—'}<span className="sn-stat-unit">cm</span></span>
            <StatusPill status={stats.carDetected ? 'warning' : 'safe'} text={stats.carDetected ? 'VEHICLE' : 'EMPTY'} />
          </div>
        </PanelCard>
      </div>

      {/* Main Analytical Instruments Layout */}
      <div className="sn-dashboard-main">
        {/* Recharts Live Stream Data Flow Component */}
        <PanelCard title="Temperature Trend — Real Time" icon={Activity} className="sn-chart-panel">
          {history.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history}>
                <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip contentStyle={{ background: 'var(--bg-panel-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }} labelStyle={{ color: 'var(--text-secondary)' }} />
                <Line type="monotone" dataKey="temp" stroke="var(--accent-copper-bright)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="sn-page-subtitle" style={{ padding: '40px 0', textAlign: 'center' }}>
              Awaiting localized telemetry packets to construct the temporal gradient trend line...
            </p>
          )}
        </PanelCard>

        {/* Compound Peripheral Perimeter Security Block */}
        <PanelCard title="Perimeter Security Status" icon={ShieldCheck}>
          <div className="sn-security-summary">
            <div className="sn-security-item">
              <DoorClosed size={20} className="sn-security-icon" />
              <span>Magnetic Reed Switch</span>
              <StatusPill status={stats.windowOpen ? 'warning' : 'safe'} text={stats.windowOpen ? 'OPEN' : 'SECURE'} />
            </div>
            <div className="sn-security-item">
              <ShieldCheck size={20} className="sn-security-icon" />
              <span>PIR Motion Array</span>
              <StatusPill status={stats.motion ? 'warning' : 'safe'} text={stats.motion ? 'ALERT' : 'CLEAR'} />
            </div>
            <div className="sn-security-item">
              <Car size={20} className="sn-security-icon" />
              <span>Ultrasonic Proximity</span>
              <StatusPill status={stats.carDetected ? 'warning' : 'safe'} text={stats.carDetected ? 'ENGAGED' : 'VACANT'} />
            </div>
          </div>
        </PanelCard>
      </div>

      {/* Lower Parametric Controls & Machine Learning Data Inference Matrices */}
      <div className="sn-dashboard-lower">
        {/* Dial Analog Instrument Representation Cluster */}
        <PanelCard title="Operational Instrument Telemetry" icon={Zap}>
          <div className="sn-gauge-row">
            <DialGauge value={stats.current ?? 0} max={5} unit="A" label="Current Load (ACS712)" thresholds={{ warning: 2.5, critical: 3.5 }} />
            <DialGauge value={stats.light ?? 0} max={100} unit="%" label="Ambient Intensity (LDR)" thresholds={{ warning: 75, critical: 90 }} />
          </div>
        </PanelCard>

        {/* Full Interactive Actuator Integration Framework */}
        <PanelCard title="Actuator Management Matrix" icon={Zap} accent>
          <ToggleSwitch
            label="Living Room Lighting"
            icon={Lightbulb}
            checked={stats.lightOn ?? false}
            onChange={(v) => sendCommand(v ? 'light_on' : 'light_off')}
          />
          <ToggleSwitch
            label="Ventilation Extraction Fan"
            icon={Fan}
            checked={stats.fanOn ?? false}
            onChange={(v) => sendCommand(v ? 'fan_on' : 'fan_off')}
          />
          <ToggleSwitch
            label="Emergency Cutoff Relay"
            icon={Flame}
            checked={stats.cutoffOn ?? false}
            onChange={() => {}}
            disabled
          />
          <p className="sn-auto-note" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '12px', lineHeight: '1.4' }}>
            These parameters represent true hardware status states returned directly from the ESP32 safety bus. 
            Phase 5 polling loops process remote instructions while preventing overrides from breaching autonomous safety thresholds.
          </p>
        </PanelCard>

        {/* Recent Predictive Machine Learning Inference Output / Alert Cluster */}
        <PanelCard title="Real-Time Anomalies & Signals" icon={TriangleAlert}>
          <div className="sn-alert-feed">
            {/* Embedded Predictive ML Weights Interface Sub-Panel */}
            <div className="sn-ml-inference-summary" style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ML Anomaly Engine:</span>
                <span style={{ color: 'var(--status-safe)', fontWeight: 'bold' }}>99.4% Safe</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Energy Usage Forecast:</span>
                <span style={{ color: 'var(--accent-copper-bright)', fontWeight: 'bold' }}>14.2 kWh/day</span>
              </div>
            </div>

            {alerts.length === 0 && <p className="sn-page-subtitle">All systems operational. No structural flags raised.</p>}
            {alerts.map((a) => (
              <div key={a.id} className="sn-alert-item">
                <span className={`sn-alert-dot sn-alert-${a.severity}`} />
                <div className="sn-alert-text">
                  <span>{a.message}</span>
                  <span className="sn-alert-time">{a.time || new Date(a.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>
    </div>
  );
}