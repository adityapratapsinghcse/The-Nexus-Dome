import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import DialGauge from '../components/DialGauge';
import ToggleSwitch from '../components/ToggleSwitch';

export default function Dashboard() {
  const householdId = localStorage.getItem('householdId');
  const householdName = localStorage.getItem('householdName');

  const [readings, setReadings] = useState(null);   // latest snapshot from REST
  const [alerts, setAlerts] = useState([]);
  const [actuators, setActuators] = useState({
    relay_light: false,
    relay_fan: false,
    relay_cutoff: false,
    door_lock: false,
  });
  const [loadError, setLoadError] = useState('');

  const { lastMessage: sensorMsg, status: sensorStatus } = useWebSocket('/ws/sensors/', householdId);
  const { lastMessage: alertMsg, status: alertStatus } = useWebSocket('/ws/alerts/', householdId);

  // Initial load on mount
  useEffect(() => {
    if (!householdId) return;
    client
      .get('/api/sensors/latest/')
      .then(({ data }) => setReadings(data))
      .catch(() => setLoadError('Could not load initial sensor snapshot.'));

    client
      .get('/api/alerts/')
      .then(({ data }) => setAlerts(data.slice(0, 8)))
      .catch(() => {});
  }, [householdId]);

  // Merge live WS pushes over the REST snapshot
  useEffect(() => {
    if (sensorMsg?.data) {
      setReadings((prev) => ({ ...prev, ...sensorMsg.data }));
    }
  }, [sensorMsg]);

  useEffect(() => {
    if (alertMsg?.data) {
      setAlerts((prev) => [alertMsg.data, ...prev].slice(0, 8));
    }
  }, [alertMsg]);

  const connectionLabel = useMemo(() => {
    if (sensorStatus === 'open') return { text: 'LIVE', tone: 'safe' };
    if (sensorStatus === 'connecting') return { text: 'CONNECTING', tone: 'warning' };
    return { text: 'OFFLINE', tone: 'critical' };
  }, [sensorStatus]);

  function toggleActuator(key) {
    setActuators((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // TODO: no /command/ endpoint exists yet for this project (see handoff gap list) —
      // wire this to POST /api/devices/<id>/command/ once that view is built.
      // client.post(`/api/devices/${deviceId}/command/`, { actuator: key, state: next[key] });
      return next;
    });
  }

  if (!householdId) {
    return (
      <div className="dash-empty panel-card">
        <p>No household session found.</p>
        <a href="/login" className="btn-primary">Go to Login</a>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div>
          <span className="label-eyebrow">HOUSEHOLD</span>
          <h1 className="dash-title">{householdName || 'My Home'}</h1>
        </div>
        <div className={`conn-pill conn-pill--${connectionLabel.tone}`}>
          <span className="conn-pill__dot" />
          {connectionLabel.text}
        </div>
      </header>

      {loadError && <div className="auth-error">{loadError}</div>}

      {/* ANALOG READINGS — dial gauges */}
      <section className="panel-section">
        <h2 className="label-eyebrow panel-section__title">Live Readings</h2>
        <div className="gauge-row">
          <DialGauge
            label="TEMPERATURE"
            value={readings?.temperature ?? 0}
            min={0}
            max={50}
            unit="°C"
            thresholds={{ warning: 32, critical: 40 }}
          />
          <DialGauge
            label="HUMIDITY"
            value={readings?.humidity ?? 0}
            min={0}
            max={100}
            unit="%"
            thresholds={{ warning: 70, critical: 85 }}
          />
          <DialGauge
            label="GAS LEVEL"
            value={readings?.gas_level ?? 0}
            min={0}
            max={100}
            unit="%"
            thresholds={{ warning: 40, critical: 70 }}
          />
          <DialGauge
            label="CURRENT DRAW"
            value={readings?.current ?? 0}
            min={0}
            max={20}
            unit="A"
            thresholds={{ warning: 12, critical: 16 }}
          />
        </div>
      </section>

      {/* DIGITAL / STATUS READOUTS */}
      <section className="panel-section">
        <h2 className="label-eyebrow panel-section__title">Sensor Status</h2>
        <div className="status-grid">
          <StatusCard label="MOTION" value={readings?.pir ? 'DETECTED' : 'CLEAR'} tone={readings?.pir ? 'warning' : 'safe'} />
          <StatusCard label="DOOR / WINDOW" value={readings?.reed ? 'OPEN' : 'CLOSED'} tone={readings?.reed ? 'warning' : 'safe'} />
          <StatusCard label="WATER LEAK" value={readings?.water_leak ? 'LEAK' : 'DRY'} tone={readings?.water_leak ? 'critical' : 'safe'} />
          <StatusCard label="FLAME" value={readings?.flame ? 'DETECTED' : 'NONE'} tone={readings?.flame ? 'critical' : 'safe'} />
        </div>
      </section>

      {/* ACTUATOR CONTROLS — breaker toggles */}
      <section className="panel-section">
        <h2 className="label-eyebrow panel-section__title">Actuators</h2>
        <div className="breaker-panel panel-card">
          <ToggleSwitch label="LIVING ROOM LIGHT" sublabel="Relay 1" checked={actuators.relay_light} onChange={() => toggleActuator('relay_light')} />
          <ToggleSwitch label="EXHAUST FAN" sublabel="Relay 2" checked={actuators.relay_fan} onChange={() => toggleActuator('relay_fan')} />
          <ToggleSwitch label="MAIN POWER CUTOFF" sublabel="Relay 3 — Safety" checked={actuators.relay_cutoff} onChange={() => toggleActuator('relay_cutoff')} variant="cutoff" />
          <ToggleSwitch label="DOOR LOCK" sublabel="Servo Actuator" checked={actuators.door_lock} onChange={() => toggleActuator('door_lock')} variant="lock" />
        </div>
      </section>

      {/* ALERTS FEED */}
      <section className="panel-section">
        <h2 className="label-eyebrow panel-section__title">
          Recent Alerts {alertStatus !== 'open' && <span className="conn-pill conn-pill--warning" style={{ marginLeft: 8 }}>WS {alertStatus}</span>}
        </h2>
        <div className="alert-feed panel-card">
          {alerts.length === 0 && <p className="text-secondary">No alerts yet.</p>}
          {alerts.map((a, i) => (
            <div key={a.id ?? i} className={`alert-row alert-row--${a.severity || 'safe'}`}>
              <span className="alert-row__dot" />
              <span className="alert-row__msg">{a.message || a.type}</span>
              <span className="readout alert-row__time">
                {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : ''}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusCard({ label, value, tone }) {
  return (
    <div className={`status-card panel-card status-card--${tone}`}>
      <span className="label-eyebrow">{label}</span>
      <span className="readout status-card__value">{value}</span>
    </div>
  );
}