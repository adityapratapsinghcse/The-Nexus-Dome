import { useState, useEffect } from 'react';
import { Flame, Wind, Droplet, Activity, Siren, Power, ShieldAlert, AlertTriangle, Volume2, RefreshCw } from 'lucide-react';
import PanelCard from '../components/ui/PanelCard';
import DialGauge from '../components/ui/DialGauge';
import StatusPill from '../components/ui/StatusPill';
import LiveDot from '../components/ui/LiveDot';
import client from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';

export default function Safety() {
  const { householdId } = useAuth();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gas, setGas] = useState(0);
  const [flame, setFlame] = useState(false);
  const [waterLeak, setWaterLeak] = useState(false);
  const [current, setCurrent] = useState(0);
  const [vibration, setVibration] = useState(false);
  const [waveform, setWaveform] = useState(Array(40).fill(9.8));
  const [history, setHistory] = useState([]);
  const [cutoffOn, setCutoffOn] = useState(false);

  // New interactive safety features
  const [alarmSirenActive, setAlarmSirenActive] = useState(false);

  const { lastMessage } = useWebSocket('/ws/sensors/', householdId);
  const { lastMessage: alertMessage } = useWebSocket('/ws/alerts/', householdId);

  const fetchSafetyData = async () => {
    if (!householdId) return;
    try {
      const devicesRes = await client.get('/api/devices/');
      if (devicesRes.data.length === 0) { setLoading(false); return; }
      const primaryDevice = devicesRes.data[0];
      setDevice(primaryDevice);

      const [latestRes, alertsRes] = await Promise.all([
        client.get(`/api/sensors/latest/?device_id=${primaryDevice.id}`),
        client.get(`/api/alerts/?device_id=${primaryDevice.id}`),
      ]);
      latestRes.data.forEach((r) => {
        if (r.sensor_type === 'gas') setGas(r.value);
        if (r.sensor_type === 'flame') setFlame(r.value === 1);
        if (r.sensor_type === 'water') setWaterLeak(r.value === 1);
        if (r.sensor_type === 'current') setCurrent(r.value);
        if (r.sensor_type === 'vibration') setVibration(r.value === 1);
        if (r.sensor_type === 'cutoff_relay') setCutoffOn(r.value === 1);
      });
      setHistory(alertsRes.data.slice(0, 10));
    } catch (err) {
      console.error('Failed to load safety data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSafetyState();
  }, [householdId]);

  const fetchSafetyState = () => {
    fetchSafetyData();
  };

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.gas_percent !== undefined) setGas(lastMessage.gas_percent);
    if (lastMessage.flame_detected !== undefined) setFlame(lastMessage.flame_detected);
    if (lastMessage.water_leak !== undefined) setWaterLeak(lastMessage.water_leak);
    if (lastMessage.current_amps !== undefined) setCurrent(lastMessage.current_amps);
    if (lastMessage.vibration_detected !== undefined) setVibration(lastMessage.vibration_detected);
    if (lastMessage.cutoff_on !== undefined) setCutoffOn(lastMessage.cutoff_on);
    if (lastMessage.vibration_deviation !== undefined) {
      setWaveform((prev) => [...prev.slice(1), 9.8 + lastMessage.vibration_deviation]);
    }
  }, [lastMessage]);

  useEffect(() => {
    if (!alertMessage) return;
    setHistory((h) => [{
      id: alertMessage.id || Date.now(),
      type: alertMessage.type || 'SYSTEM_ALERT',
      severity: alertMessage.severity || 'critical',
      message: alertMessage.message || 'Safety threshold crossed.',
      timestamp: new Date().toISOString(),
    }, ...h].slice(0, 10));
  }, [alertMessage]);

  const toggleCutoff = async () => {
    if (!device) return;
    const nextState = !cutoffOn;
    setCutoffOn(nextState);
    try {
      await client.post('/api/commands/send/', {
        device: device.id,
        action: nextState ? 'cutoff_on' : 'cutoff_off'
      });
    } catch (err) {
      setCutoffOn(!nextState);
      console.error('Failed to toggle cutoff relay:', err);
    }
  };

  const handleTestSiren = async () => {
    const nextSirenState = !alarmSirenActive;
    setAlarmSirenActive(nextSirenState);
    try {
      await client.post('/api/commands/send/', {
        device: device.id,
        action: nextSirenState ? 'siren_on' : 'siren_off'
      });
    } catch (err) {
      console.error('Siren command failed:', err);
    }
  };

  const emergencyCutoff = cutoffOn;
  const waveformPath = waveform.map((v, i) => `${(i / (waveform.length - 1)) * 300},${60 - (v - 9.8) * 15}`).join(' L ');

  if (loading) return <div className="sn-page-loading">Syncing safety bus nodes...</div>;

  if (!device) {
    return (
      <div className="sn-page">
        <h1 className="sn-page-title">Safety Systems</h1>
        <p className="sn-page-subtitle">No safety monitors discovered. Register your ESP32 main board to initialize hazard monitoring.</p>
      </div>
    );
  }

  return (
    <div className="sn-page safety-page">
      <style>{`
        .safety-page {
          padding: 20px;
        }

        .glass-panel {
          background: rgba(27, 32, 40, 0.7); 
          backdrop-filter: blur(25px); 
          -webkit-backdrop-filter: blur(25px);
          border: 1px solid rgba(255, 255, 255, 0.06); 
          border-radius: 16px; 
          padding: 24px;
          box-shadow: 0 16px 36px rgba(0,0,0,0.35); 
          display: flex; 
          flex-direction: column;
        }

        .stat-grid-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }
        @media (max-width: 900px) {
          .stat-grid-row {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .telemetry-stat-card {
          background: rgba(18, 22, 27, 0.55);
          border: 1px solid rgba(255,255,255,0.03);
          border-radius: 12px;
          padding: 16px;
        }
        .stat-row-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 10px;
        }
        .stat-value {
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .safety-layout-main {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        @media (max-width: 900px) {
          .safety-layout-main {
            grid-template-columns: 1fr;
          }
        }

        /* Oscilloscope retro CRT green grid screen */
        .oscilloscope-screen-box {
          background: #06090c;
          border: 1px solid rgba(198,129,63,0.15);
          border-radius: 12px;
          padding: 16px;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
          position: relative;
        }
        .oscilloscope-grid {
          background: #020305;
          border: 1px solid rgba(255,255,255,0.03);
          border-radius: 6px;
          height: 140px;
          position: relative;
          padding: 8px;
          overflow: hidden;
        }
        .oscilloscope-grid::before {
          content: '';
          position: absolute;
          inset: 0;
          background-size: 20px 20px;
          background-image: 
            linear-gradient(to right, rgba(198,129,63,0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(198,129,63,0.05) 1px, transparent 1px);
        }
        .oscilloscope-waveform {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        /* Large glowing cutoff breaker switch button */
        .cutoff-layout {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 0;
          gap: 16px;
        }
        .btn-cutoff-breaker {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          background: var(--bg-deep);
          border: 4px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
        }
        .btn-cutoff-breaker:hover {
          border-color: var(--status-critical);
          color: var(--status-critical);
        }
        .btn-cutoff-breaker.active {
          background: var(--status-critical);
          border-color: #fff;
          color: #fff;
          box-shadow: 0 0 25px var(--status-critical), inset 0 2px 5px rgba(0,0,0,0.4);
        }

        /* Alarm Siren Toggle switch */
        .siren-override-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-deep);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          padding: 16px;
          margin-top: 14px;
        }
        .siren-btn-override {
          background: var(--bg-panel-raised);
          border: 1px solid rgba(255,255,255,0.1);
          color: var(--text-secondary);
          padding: 6px 14px;
          border-radius: 6px;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .siren-btn-override.active {
          background: var(--status-warning);
          color: var(--bg-deep);
          border-color: var(--status-warning);
          box-shadow: 0 0 12px rgba(232, 163, 61, 0.35);
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <div className="sn-page-header">
            <h1 className="sn-page-title">Safety & Alarms</h1>
            <div className="sn-live-indicator">
              <LiveDot color={emergencyCutoff || alarmSirenActive ? 'var(--status-critical)' : 'var(--status-safe)'} />
              <span className="label-eyebrow" style={{ color: emergencyCutoff || alarmSirenActive ? 'var(--status-critical)' : 'var(--status-safe)' }}>
                {emergencyCutoff ? 'EMERGENCY SHUTDOWN ACTIVE' : alarmSirenActive ? 'SIREN ACTIVE' : 'ALL PERIPHERALS NOMINAL'}
              </span>
            </div>
          </div>
          <p className="sn-page-subtitle readout">{device.name} // NODE_HAZARD_BUS_MONITOR_ON</p>
        </div>
        <button className="sn-icon-btn" onClick={fetchSafetyState} title="Sync Safety Bus">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Stats row */}
      <div className="stat-grid-row">
        <div className="telemetry-stat-card">
          <span className="label-eyebrow">Gas (MQ-2)</span>
          <div className="stat-row-inner">
            <span className="stat-value readout">{Math.round(gas)}<span className="sn-stat-unit">%</span></span>
            <StatusPill status={gas > 50 ? 'critical' : gas > 30 ? 'warning' : 'safe'} />
          </div>
        </div>

        <div className="telemetry-stat-card">
          <span className="label-eyebrow">Flame status</span>
          <div className="stat-row-inner">
            <span className="stat-value readout">{flame ? 'Fire' : 'Clear'}</span>
            <StatusPill status={flame ? 'critical' : 'safe'} text={flame ? 'FIRE' : 'CLEAR'} />
          </div>
        </div>

        <div className="telemetry-stat-card">
          <span className="label-eyebrow">Water Leak</span>
          <div className="stat-row-inner">
            <span className="stat-value readout">{waterLeak ? 'Leak' : 'Dry'}</span>
            <StatusPill status={waterLeak ? 'critical' : 'safe'} text={waterLeak ? 'LEAK' : 'DRY'} />
          </div>
        </div>

        <div className="telemetry-stat-card">
          <span className="label-eyebrow">MPU6050 Motion</span>
          <div className="stat-row-inner">
            <span className="stat-value readout">{vibration ? 'Active' : 'Stable'}</span>
            <StatusPill status={vibration ? 'warning' : 'safe'} text={vibration ? 'VIBE' : 'STABLE'} />
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="safety-layout-main">
        
        {/* Left Side: Emergency Interrupter / Cutoff */}
        <PanelCard 
          title="Emergency Power Cutoff Switch" 
          icon={Power} 
          accent 
          className={emergencyCutoff ? 'sn-cutoff-active' : ''}
        >
          <div className="cutoff-layout">
            <button 
              onClick={toggleCutoff} 
              className={`btn-cutoff-breaker ${emergencyCutoff ? 'active' : ''}`}
            >
              <Power size={36} />
            </button>
            <span className="sn-cutoff-status" style={{ color: emergencyCutoff ? 'var(--status-critical)' : 'var(--status-safe)' }}>
              {emergencyCutoff ? 'POWER TERMINATED' : 'BUS RELAY CLOSED (NOMINAL)'}
            </span>
            <p className="sn-cutoff-hint">
              Bypasses electrical grid feed. Automatically triggers if air gas concentration crossings exceed 55%, flame registers, or ammeter draw crosses 3.2A.
            </p>
          </div>

          {/* Siren Test Override Option */}
          <div className="siren-override-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Volume2 size={20} style={{ color: alarmSirenActive ? 'var(--status-warning)' : 'var(--text-secondary)' }} />
              <div>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem' }}>Ecosystem Siren override</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Flashes warning buzzer</span>
              </div>
            </div>
            <button 
              onClick={handleTestSiren}
              className={`siren-btn-override ${alarmSirenActive ? 'active' : ''}`}
            >
              <Power size={12} />
              <span>{alarmSirenActive ? 'ACTIVE' : 'TEST'}</span>
            </button>
          </div>

          <div className="sn-gauge-row" style={{ marginTop: '20px' }}>
            <DialGauge value={gas} max={100} unit="%" label="Gas AQI" thresholds={{ warning: 30, critical: 55 }} size={96} />
            <DialGauge value={current} max={5} unit="A" label="Current Draw" thresholds={{ warning: 2.5, critical: 3.2 }} size={96} />
          </div>
        </PanelCard>

        {/* Right Side: Oscilloscope vibration magnitude screen */}
        <section className="oscilloscope-screen-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={16} style={{ color: 'var(--accent-copper-bright)' }} />
            <span className="label-eyebrow" style={{ color: 'var(--text-primary)' }}>Seismograph CRT Signal (MPU6050)</span>
          </div>

          <div className="oscilloscope-grid">
            <svg viewBox="0 0 300 80" className="oscilloscope-waveform">
              <line x1="0" y1="40" x2="300" y2="40" stroke="rgba(198,129,63,0.15)" strokeDasharray="3 3" />
              <polyline
                points={waveformPath}
                fill="none"
                stroke={vibration ? 'var(--status-critical)' : 'var(--accent-copper-bright)'}
                strokeWidth="2.5"
                style={{ transition: 'stroke 0.2s ease', filter: 'drop-shadow(0 0 4px var(--accent-copper-bright))' }}
              />
            </svg>
          </div>
          <p className="sn-waveform-caption" style={{ margin: 0 }}>
            Real-time magnitude deviation vector readouts streaming from local 3-axis MPU6050 accelerometer sensor.
          </p>
        </section>

      </div>

      {/* Alarm History log */}
      <PanelCard title="Security & Safety alarm feed log" icon={Siren}>
        <div className="sn-history-feed">
          {history.length === 0 ? (
            <p className="sn-page-subtitle" style={{ textAlign: 'center', padding: '20px 0' }}>
              No critical alerts reported.
            </p>
          ) : (
            history.map((h) => (
              <div key={h.id} className="sn-history-item">
                <ShieldAlert size={18} className={`sn-history-icon sn-history-${h.severity || 'info'}`} />
                <div className="sn-history-text">
                  <div className="sn-history-top">
                    <span className="sn-history-type" style={{ fontFamily: 'var(--font-mono)' }}>{h.type?.toUpperCase()}</span>
                    <StatusPill status={h.severity === 'info' ? 'safe' : h.severity} text={h.severity?.toUpperCase()} />
                  </div>
                  <span className="sn-history-message">{h.message}</span>
                  <span className="sn-history-time">{new Date(h.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </PanelCard>

    </div>
  );
}