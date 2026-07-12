import { useState, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Thermometer, Droplets, Fan, Sun, Minus, Plus, RefreshCw } from 'lucide-react';
import PanelCard from '../components/ui/PanelCard';
import DialGauge from '../components/ui/DialGauge';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import StatusPill from '../components/ui/StatusPill';
import client from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';

const TARGET_TEMP_DEBOUNCE_MS = 800;

export default function Climate() {
  const { householdId } = useAuth();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTemp, setCurrentTemp] = useState(null);
  const [humidity, setHumidity] = useState(null);
  const [targetTemp, setTargetTemp] = useState(24);
  const [targetSent, setTargetSent] = useState(null); // last value actually sent as a Command
  const [fanOn, setFanOn] = useState(false);
  const [fanSpeed, setFanSpeed] = useState(2); // 0: Off, 1: Low, 2: Med, 3: High
  const [history, setHistory] = useState([]);
  const dialRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const debounceRef = useRef(null);

  const { lastMessage } = useWebSocket('/ws/sensors/', householdId);

  const fetchClimateData = async () => {
    if (!householdId) return;
    try {
      const devicesRes = await client.get('/api/devices/');
      if (devicesRes.data.length === 0) { setLoading(false); return; }
      const primaryDevice = devicesRes.data[0];
      setDevice(primaryDevice);

      const [tempHistRes, latestRes] = await Promise.all([
        client.get(`/api/sensors/history/?device_id=${primaryDevice.id}&sensor_type=temperature&limit=24`),
        client.get(`/api/sensors/latest/?device_id=${primaryDevice.id}`),
      ]);
      const chartData = tempHistRes.data.slice().reverse().map((r) => ({
        time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        temp: r.value,
      }));
      setHistory(chartData);

      latestRes.data.forEach((r) => {
        if (r.sensor_type === 'temperature') setCurrentTemp(r.value);
        if (r.sensor_type === 'humidity') setHumidity(r.value);
        if (r.sensor_type === 'fan_relay') setFanOn(r.value === 1);
      });
    } catch (err) {
      console.error('Failed to load climate data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClimateData(); }, [householdId]);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.temperature !== undefined) {
      setCurrentTemp(lastMessage.temperature);
      setHistory((prev) => [...prev.slice(-23), {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        temp: lastMessage.temperature,
      }]);
    }
    if (lastMessage.humidity !== undefined) setHumidity(lastMessage.humidity);
    if (lastMessage.fan_on !== undefined) setFanOn(lastMessage.fan_on);
  }, [lastMessage]);

  const sendCommand = async (action, payload = {}) => {
    if (!device) return;
    try {
      await client.post('/api/commands/send/', { device: device.id, action, payload });
    } catch (err) {
      console.error('Command failed to send:', err);
    }
  };

  // Debounced so dragging the dial doesn't fire a Command on every pixel of movement —
  // only sends once the value settles for TARGET_TEMP_DEBOUNCE_MS.
  const scheduleTargetSend = useCallback((temp) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      sendCommand('set_target_temp', { temp });
      setTargetSent(temp);
    }, TARGET_TEMP_DEBOUNCE_MS);
  }, [device]);

  const updateTarget = (temp) => {
    setTargetTemp(temp);
    scheduleTargetSend(temp);
  };

  const angleFromTemp = (temp) => -135 + ((temp - 16) / 16) * 270;
  const tempFromAngle = (angle) => Math.round((16 + ((angle + 135) / 270) * 16) * 2) / 2;

  const handleDialInteraction = useCallback((clientX, clientY) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let angle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI) + 90;
    if (angle > 180) angle -= 360;
    const clamped = Math.max(-135, Math.min(135, angle));
    const newTemp = tempFromAngle(clamped);
    if (newTemp >= 16 && newTemp <= 32) updateTarget(newTemp);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const point = e.touches ? e.touches[0] : e;
      handleDialInteraction(point.clientX, point.clientY);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, handleDialInteraction]);

  const handleFanSpeedChange = (speed) => {
    setFanSpeed(speed);
    sendCommand(`fan_speed_${speed}`);
  };

  // Comfort index is a formula over two real sensor readings (temp + humidity),
  // same category as a "feels like" figure — not a fabricated sensor.
  const comfortIndex = currentTemp !== null
    ? Math.max(0, 100 - Math.abs(currentTemp - 23) * 8 - Math.abs((humidity ?? 50) - 50) * 0.6)
    : null;

  const animationDurationMap = ['0s', '4s', '1.5s', '0.4s'];

  if (loading) return <div className="sn-page-loading">Loading climate data…</div>;

  if (!device) {
    return (
      <div className="sn-page">
        <h1 className="sn-page-title">Climate</h1>
        <p className="sn-page-subtitle">No devices found yet. Add an ESP32 board under Settings to get started.</p>
      </div>
    );
  }

  return (
    <div className="sn-page climate-page">
      <style>{`
        .climate-page { padding: 20px; }
        .climate-layout-main {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        @media (max-width: 900px) {
          .climate-layout-main { grid-template-columns: 1fr; }
        }
        .fan-speed-visual-panel {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-panel-raised);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 16px;
          margin-top: 14px;
        }
        .fan-rotator-icon {
          animation: spin linear infinite;
          transform-origin: center;
          color: var(--accent-copper-bright);
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .fan-keys-row { display: flex; gap: 6px; margin-top: 10px; }
        .btn-speed-select {
          flex: 1;
          background: var(--bg-panel-raised);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          padding: 8px 0;
          border-radius: 6px;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-speed-select:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-speed-select.active {
          border-color: var(--accent-copper);
          background: rgba(198, 129, 63, 0.12);
          color: var(--accent-copper-bright);
        }
        .comfort-stat-card { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px 0; }
        .target-note {
          font-size: 11.5px;
          color: var(--text-secondary);
          text-align: center;
          margin-top: 10px;
          max-width: 280px;
          margin-left: auto;
          margin-right: auto;
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <div className="sn-page-header">
            <h1 className="sn-page-title">Climate Control</h1>
            <div className="sn-live-indicator">
              <StatusPill status={device.is_online ? 'safe' : 'critical'} text={device.is_online ? 'DHT22 ONLINE' : 'DEVICE OFFLINE'} />
            </div>
          </div>
          <p className="sn-page-subtitle">{device.name}</p>
        </div>
        <button className="sn-icon-btn" onClick={fetchClimateData} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="climate-layout-main">
        <PanelCard title="Target Temperature" icon={Thermometer} accent className="sn-thermostat-panel">
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 14px' }}>
            This sets a preference sent to your board — there's no automatic heating/cooling loop built yet,
            so nothing reacts to it on its own until your firmware implements one.
          </p>

          <div
            className="sn-thermostat"
            ref={dialRef}
            onMouseDown={(e) => { setDragging(true); handleDialInteraction(e.clientX, e.clientY); }}
            onTouchStart={(e) => { setDragging(true); const t = e.touches[0]; handleDialInteraction(t.clientX, t.clientY); }}
          >
            <svg viewBox="0 0 240 240" className="sn-thermostat-svg">
              <circle cx="120" cy="120" r="100" fill="none" stroke="var(--bg-panel-raised)" strokeWidth="14"
                strokeDasharray={`${2 * Math.PI * 100 * 0.75} ${2 * Math.PI * 100}`}
                transform="rotate(135 120 120)" strokeLinecap="round" />
              <circle cx="120" cy="120" r="100" fill="none" stroke="var(--accent-copper)" strokeWidth="14"
                strokeDasharray={`${2 * Math.PI * 100 * 0.75 * ((targetTemp - 16) / 16)} ${2 * Math.PI * 100}`}
                transform="rotate(135 120 120)" strokeLinecap="round"
                style={{ transition: dragging ? 'none' : 'stroke-dasharray 0.3s ease' }} />
              <circle
                cx={120 + 100 * Math.cos((angleFromTemp(targetTemp) - 90) * Math.PI / 180)}
                cy={120 + 100 * Math.sin((angleFromTemp(targetTemp) - 90) * Math.PI / 180)}
                r="10" fill="var(--accent-copper-bright)" stroke="#12161B" strokeWidth="3"
                style={{ cursor: 'grab', transition: dragging ? 'none' : 'all 0.3s ease' }}
              />
            </svg>
            <div className="sn-thermostat-center">
              <span className="readout sn-thermostat-target">{targetTemp}°</span>
              <span className="label-eyebrow">Target</span>
              <span className="sn-thermostat-current">Current: {currentTemp ?? '--'}°C</span>
            </div>
          </div>

          <div className="sn-thermostat-controls">
            <button className="sn-temp-btn" onClick={() => updateTarget(Math.max(16, targetTemp - 0.5))}><Minus size={16} /></button>
            <span className="sn-drag-hint">Drag dial or use +/-</span>
            <button className="sn-temp-btn" onClick={() => updateTarget(Math.min(32, targetTemp + 0.5))}><Plus size={16} /></button>
          </div>

          <p className="target-note">
            {targetSent === targetTemp
              ? `Sent to ${device.name} as a command.`
              : 'Saving in a moment…'}
          </p>
        </PanelCard>

        <div className="sn-climate-side">
          <PanelCard title="Ambient Humidity" icon={Droplets}>
            <div className="sn-stat-row">
              <span className="readout sn-stat-value">{humidity !== null ? Math.round(humidity) : '--'}<span className="sn-stat-unit">%</span></span>
              <StatusPill
                status={humidity == null ? 'warning' : humidity > 70 ? 'warning' : 'safe'}
                text={humidity == null ? 'NO DATA' : humidity > 70 ? 'HUMID' : 'NORMAL'}
              />
            </div>
          </PanelCard>

          <PanelCard title="Comfort Index" icon={Sun}>
            <div className="comfort-stat-card">
              <DialGauge
                value={comfortIndex ?? 0}
                max={100} unit="" label="Comfort Index" size={110}
                thresholds={{ warning: 101, critical: 101 }}
              />
              {comfortIndex === null && (
                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 8 }}>
                  Needs a temperature reading first.
                </p>
              )}
            </div>
          </PanelCard>
        </div>
      </div>

      <div className="sn-grid sn-grid-2">
        <PanelCard title="Ventilation Control" icon={Fan}>
          <ToggleSwitch
            label="Ceiling Fan (L298N)"
            icon={Fan}
            checked={fanOn}
            onChange={(v) => sendCommand(v ? 'fan_on' : 'fan_off')}
          />

          <div className="fan-speed-visual-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Fan
                size={22}
                className="fan-rotator-icon"
                style={{
                  animationDuration: fanOn ? animationDurationMap[fanSpeed] : '0s',
                  animationName: fanOn ? 'spin' : 'none',
                }}
              />
              <div>
                <span style={{ display: 'block', fontWeight: 600, fontSize: 13.5 }}>Fan (visual only)</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Status: {fanOn ? 'Running' : 'Stopped'}</span>
              </div>
            </div>
          </div>

          <div className="sn-fan-speed">
            <span className="label-eyebrow">Speed (PWM via ENA)</span>
            <div className="fan-keys-row">
              {[0, 1, 2, 3].map((lvl) => {
                const labels = ['OFF', 'LOW', 'MED', 'HIGH'];
                return (
                  <button
                    key={lvl}
                    disabled={!fanOn}
                    onClick={() => handleFanSpeedChange(lvl)}
                    className={`btn-speed-select ${fanSpeed === lvl ? 'active' : ''}`}
                  >
                    {labels[lvl]}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="sn-auto-note">
            Sends `fan_speed_0..3` commands — your firmware needs a handler mapping these to an ENA duty cycle;
            not confirmed to exist yet.
          </p>
        </PanelCard>

        <PanelCard title="Temperature Trend" icon={Thermometer}>
          {history.length > 1 ? (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-copper-bright)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--accent-copper-bright)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-panel-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }} labelStyle={{ color: 'var(--text-secondary)' }} />
                <Area type="monotone" dataKey="temp" stroke="var(--accent-copper-bright)" strokeWidth={2} fill="url(#tempGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="sn-page-subtitle" style={{ textAlign: 'center', padding: '60px 0' }}>
              Waiting for enough DHT22 readings to plot a trend.
            </p>
          )}
        </PanelCard>
      </div>
    </div>
  );
}