import { useState, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Thermometer, Droplets, Fan, Wind, Sun, Minus, Plus, RefreshCw, Layers } from 'lucide-react';
import PanelCard from '../components/ui/PanelCard';
import DialGauge from '../components/ui/DialGauge';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import StatusPill from '../components/ui/StatusPill';
import client from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';

export default function Climate() {
  const { householdId } = useAuth();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTemp, setCurrentTemp] = useState(null);
  const [humidity, setHumidity] = useState(null);
  const [targetTemp, setTargetTemp] = useState(24);
  const [fanOn, setFanOn] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [history, setHistory] = useState([]);
  const dialRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  // New interactive features
  const [profileMode, setProfileMode] = useState('comfort'); // 'eco' | 'comfort' | 'performance'
  const [fanSpeed, setFanSpeed] = useState(2); // 0: Off, 1: Low, 2: Med, 3: High

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

  useEffect(() => {
    fetchClimateData();
  }, [householdId]);

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
    if (newTemp >= 16 && newTemp <= 32) {
      setTargetTemp(newTemp);
      setAutoMode(false);
    }
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

  // Adjust Target Temp based on active profiles
  const applyProfile = (mode) => {
    setProfileMode(mode);
    setAutoMode(false);
    if (mode === 'eco') {
      setTargetTemp(26.5);
    } else if (mode === 'comfort') {
      setTargetTemp(22.5);
    } else if (mode === 'performance') {
      setTargetTemp(19.0);
    }
  };

  const handleFanSpeedChange = (speed) => {
    setFanSpeed(speed);
    setAutoMode(false);
    sendCommand(`fan_speed_${speed}`);
  };

  const comfortIndex = currentTemp !== null
    ? Math.max(0, 100 - Math.abs(currentTemp - 23) * 8 - Math.abs((humidity ?? 50) - 50) * 0.6)
    : 0;

  // Spin speed mapping for visual fan animation
  const animationDurationMap = ['0s', '4s', '1.5s', '0.4s'];

  if (loading) return <div className="sn-page-loading">Initializing climate systems...</div>;

  if (!device) {
    return (
      <div className="sn-page">
        <h1 className="sn-page-title">Climate</h1>
        <p className="sn-page-subtitle">No climate controller discovered. Verify DHT22 mappings on your ESP32 main board.</p>
      </div>
    );
  }

  return (
    <div className="sn-page climate-page">
      <style>{`
        .climate-page {
          padding: 20px;
        }
        .climate-layout-main {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        @media (max-width: 900px) {
          .climate-layout-main {
            grid-template-columns: 1fr;
          }
        }

        /* Profile modes switch */
        .profile-mode-selector {
          display: flex;
          background: var(--bg-deep);
          padding: 4px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.04);
          margin-bottom: 18px;
          width: 100%;
        }
        .profile-btn {
          flex: 1;
          padding: 8px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .profile-btn.active {
          background: var(--accent-copper);
          color: var(--bg-deep);
          box-shadow: 0 0 10px rgba(198, 129, 63, 0.2);
        }

        /* Spinning Fan visual */
        .fan-speed-visual-panel {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-deep);
          border: 1px solid rgba(255,255,255,0.03);
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

        .fan-keys-row {
          display: flex;
          gap: 6px;
          margin-top: 10px;
        }
        .btn-speed-select {
          flex: 1;
          background: var(--bg-deep);
          border: 1px solid rgba(255,255,255,0.04);
          color: var(--text-secondary);
          padding: 8px 0;
          border-radius: 6px;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-speed-select.active {
          border-color: var(--accent-copper);
          background: rgba(198, 129, 63, 0.12);
          color: var(--accent-copper-bright);
        }

        .comfort-stat-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 16px 0;
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <div className="sn-page-header">
            <h1 className="sn-page-title">Climate Control</h1>
            <div className="sn-live-indicator">
              <StatusPill status={autoMode ? 'safe' : 'warning'} text={autoMode ? 'AUTO MODE' : 'MANUAL OVERRIDE'} />
            </div>
          </div>
          <p className="sn-page-subtitle readout">{device.name} // DHT22_HYGROMETER_INTEGRATED</p>
        </div>
        <button className="sn-icon-btn" onClick={fetchClimateData} title="Sync Climate Data">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Main layout grids */}
      <div className="climate-layout-main">
        
        {/* Left hand circular Thermostat */}
        <PanelCard title="System Thermostat" icon={Thermometer} accent className="sn-thermostat-panel">
          
          {/* Profile Switch Tab Bar */}
          <div className="profile-mode-selector">
            <button 
              onClick={() => applyProfile('eco')}
              className={`profile-btn ${profileMode === 'eco' ? 'active' : ''}`}
            >
              ECO PROFILE (26.5°)
            </button>
            <button 
              onClick={() => applyProfile('comfort')}
              className={`profile-btn ${profileMode === 'comfort' ? 'active' : ''}`}
            >
              COMFORT (22.5°)
            </button>
            <button 
              onClick={() => applyProfile('performance')}
              className={`profile-btn ${profileMode === 'performance' ? 'active' : ''}`}
            >
              PERFORMANCE (19.0°)
            </button>
          </div>

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
              <span className="sn-thermostat-current">Current: {currentTemp ?? '—'}°C</span>
            </div>
          </div>

          <div className="sn-thermostat-controls">
            <button className="sn-temp-btn" onClick={() => { setTargetTemp((t) => Math.max(16, t - 0.5)); setAutoMode(false); }}><Minus size={16} /></button>
            <span className="sn-drag-hint">Drag dial boundary to set manually</span>
            <button className="sn-temp-btn" onClick={() => { setTargetTemp((t) => Math.min(32, t + 0.5)); setAutoMode(false); }}><Plus size={16} /></button>
          </div>
          <button className="sn-auto-btn" onClick={() => { setAutoMode(true); setProfileMode('comfort'); setTargetTemp(24); }}>Reset to Standard Auto</button>
        </PanelCard>

        {/* Right hand side metrics */}
        <div className="sn-climate-side">
          <PanelCard title="Ambient Humidity" icon={Droplets}>
            <div className="sn-stat-row">
              <span className="readout sn-stat-value">{humidity !== null ? Math.round(humidity) : '—'}<span className="sn-stat-unit">%</span></span>
              <StatusPill status={humidity > 70 ? 'warning' : 'safe'} />
            </div>
          </PanelCard>
          
          <PanelCard title="Thermodynamic Comfort" icon={Sun}>
            <div className="comfort-stat-card">
              <DialGauge value={comfortIndex} max={100} unit="" label="Comfort Index" size={110} thresholds={{ warning: 101, critical: 101 }} />
            </div>
          </PanelCard>
        </div>

      </div>

      {/* Auxiliary Fan ventilation Speed & charts */}
      <div className="sn-dashboard-lower" style={{ gridTemplateColumns: '1fr 1fr' }}>
        
        {/* Animated mechanical Fan selector card */}
        <PanelCard title="Ventilation Control" icon={Fan}>
          <ToggleSwitch
            label="Auxiliary Ventilation Fan"
            icon={Fan}
            checked={fanOn}
            onChange={(v) => { setAutoMode(false); sendCommand(v ? 'fan_on' : 'fan_off'); }}
          />

          <div className="fan-speed-visual-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Fan 
                size={22} 
                className="fan-rotator-icon" 
                style={{ 
                  animationDuration: fanOn ? animationDurationMap[fanSpeed] : '0s',
                  animationName: fanOn ? 'spin' : 'none'
                }} 
              />
              <div>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem' }}>Visual Fan Rotor Speed</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Status: {fanOn ? 'ACTIVE' : 'STANDBY'}</span>
              </div>
            </div>
          </div>

          <div className="sn-fan-speed">
            <span className="label-eyebrow">Motor Duty Cycle (Speed)</span>
            <div className="fan-keys-row">
              {[0, 1, 2, 3].map((lvl) => {
                const labels = ['OFF', 'MIN', 'MED', 'MAX'];
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
            Fan operations update the physical L298N driver board registers via serial transmission. Autonomic thermostatic cooling triggers dynamically on-node.
          </p>
        </PanelCard>

        {/* Temperature chart history */}
        <PanelCard title="Live Temperature trend" icon={Thermometer}>
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
              Waiting for DHT22 log buffers to compile temperature trend curves.
            </p>
          )}
        </PanelCard>
      </div>

    </div>
  );
}