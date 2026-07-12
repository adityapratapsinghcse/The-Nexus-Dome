import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Zap, TrendingUp, Sparkles, RefreshCw, Lightbulb, Fan } from 'lucide-react';
import PanelCard from '../components/ui/PanelCard';
import DialGauge from '../components/ui/DialGauge';
import StatusPill from '../components/ui/StatusPill';
import client from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';

const MAINS_VOLTAGE = 230; // same assumption backend's energy_summary already makes

export default function Energy() {
  const { householdId } = useAuth();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentDraw, setCurrentDraw] = useState(null); // null = not seen yet, not "0 A"
  const [summary, setSummary] = useState({ today_kwh: 0, week_total_kwh: 0, daily_breakdown: [], has_data: false });
  const [lightOn, setLightOn] = useState(null);
  const [fanOn, setFanOn] = useState(null);
  const [tariffRate, setTariffRate] = useState(7.5); // user-adjustable estimate, never a real billing rate

  const { lastMessage } = useWebSocket('/ws/sensors/', householdId);

  const fetchEnergyData = async () => {
    if (!householdId) return;
    try {
      const devicesRes = await client.get('/api/devices/');
      if (devicesRes.data.length === 0) { setLoading(false); return; }
      const primaryDevice = devicesRes.data[0];
      setDevice(primaryDevice);

      const [latestRes, summaryRes] = await Promise.all([
        client.get(`/api/sensors/latest/?device_id=${primaryDevice.id}`),
        client.get(`/api/energy/summary/?device_id=${primaryDevice.id}`),
      ]);

      const currentReading = latestRes.data.find((r) => r.sensor_type === 'current');
      if (currentReading) setCurrentDraw(currentReading.value);

      const lightReading = latestRes.data.find((r) => r.sensor_type === 'light_relay');
      if (lightReading) setLightOn(lightReading.value === 1);

      const fanReading = latestRes.data.find((r) => r.sensor_type === 'fan_relay');
      if (fanReading) setFanOn(fanReading.value === 1);

      setSummary(summaryRes.data);
    } catch (err) {
      console.error('Failed to load energy data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEnergyData(); }, [householdId]);

  useEffect(() => {
    if (lastMessage?.current_amps !== undefined) setCurrentDraw(lastMessage.current_amps);
    if (lastMessage?.light_on !== undefined) setLightOn(lastMessage.light_on);
    if (lastMessage?.fan_on !== undefined) setFanOn(lastMessage.fan_on);
  }, [lastMessage]);

  const sendCommand = async (action) => {
    if (!device) return;
    try {
      await client.post('/api/commands/send/', { device: device.id, action });
    } catch (err) {
      console.error('Command failed to send:', err);
    }
  };

  const toggleLight = () => {
    setLightOn((prev) => !prev);
    sendCommand(lightOn ? 'light_off' : 'light_on');
  };
  const toggleFan = () => {
    setFanOn((prev) => !prev);
    sendCommand(fanOn ? 'fan_off' : 'fan_on');
  };

  const currentWatts = currentDraw != null ? currentDraw * MAINS_VOLTAGE : null;

  // Extrapolated from real 7-day data — explicitly labeled as an estimate, never blended
  // silently into a "measured" figure the way the old appliance simulator did.
  const monthlyEstimate = summary.has_data ? (summary.week_total_kwh / 7) * 30 * tariffRate : null;

  if (loading) return <div className="sn-page-loading">Loading energy data…</div>;

  if (!device) {
    return (
      <div className="sn-page">
        <h1 className="sn-page-title">Energy</h1>
        <p className="sn-page-subtitle">No devices found yet. Add an ESP32 board under Settings to get started.</p>
      </div>
    );
  }

  return (
    <div className="sn-page energy-page">
      <style>{`
        .stat-grid-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }
        @media (max-width: 900px) {
          .stat-grid-row { grid-template-columns: repeat(2, 1fr); }
        }
        .telemetry-stat-card {
          background: var(--bg-panel);
          border: 1px solid var(--border-subtle);
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
        .energy-layout-main {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        @media (max-width: 900px) {
          .energy-layout-main { grid-template-columns: 1fr; }
        }
        .tariff-calibration-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-panel-raised);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
        }
        .input-tariff-slider {
          flex: 1;
          margin: 0 16px;
          accent-color: var(--accent-copper);
          cursor: pointer;
        }
        .tariff-rate-read {
          font-family: var(--font-mono);
          color: var(--accent-copper-bright);
          font-weight: 700;
          font-size: 0.95rem;
          min-width: 60px;
          text-align: right;
        }
        .appliance-quick-row {
          display: flex;
          gap: 12px;
        }
        .appliance-quick-tile {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg-panel-raised);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          padding: 12px;
          cursor: pointer;
          color: inherit;
          font: inherit;
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <div className="sn-page-header">
            <h1 className="sn-page-title">Energy</h1>
            <div className="sn-live-indicator">
              <StatusPill status={device.is_online ? 'safe' : 'critical'} text={device.is_online ? 'ESP32 ONLINE' : 'ESP32 OFFLINE'} />
            </div>
          </div>
          <p className="sn-page-subtitle">{device.name} — live from ACS712</p>
        </div>
        <button className="sn-icon-btn" onClick={fetchEnergyData} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Stats — every value here is real or explicitly marked as unavailable */}
      <div className="stat-grid-row">
        <div className="telemetry-stat-card">
          <span className="label-eyebrow">Current (ACS712)</span>
          <div className="stat-row-inner">
            <span className="stat-value readout">{currentDraw != null ? currentDraw.toFixed(2) : '--'}<span className="sn-stat-unit">A</span></span>
            <StatusPill
              status={currentDraw == null ? 'warning' : currentDraw > 3.2 ? 'critical' : currentDraw > 2.2 ? 'warning' : 'safe'}
              text={currentDraw == null ? 'NO DATA' : currentDraw > 3.2 ? 'OVERLOAD' : 'NORMAL'}
            />
          </div>
        </div>

        <div className="telemetry-stat-card">
          <span className="label-eyebrow">Power Draw (Est.)</span>
          <div className="stat-row-inner">
            <span className="stat-value readout">{currentWatts != null ? Math.round(currentWatts) : '--'}<span className="sn-stat-unit">W</span></span>
            <StatusPill status={currentWatts == null ? 'warning' : 'safe'} text={currentWatts == null ? 'NO DATA' : `${MAINS_VOLTAGE}V ASSUMED`} />
          </div>
        </div>

        <div className="telemetry-stat-card">
          <span className="label-eyebrow">Today's Energy</span>
          <div className="stat-row-inner">
            <span className="stat-value readout">{summary.has_data ? summary.today_kwh.toFixed(2) : '--'}<span className="sn-stat-unit">kWh</span></span>
            <StatusPill status={summary.has_data ? 'safe' : 'warning'} text={summary.has_data ? 'MEASURED' : 'NO DATA YET'} />
          </div>
        </div>

        <div className="telemetry-stat-card">
          <span className="label-eyebrow">Est. Monthly Cost</span>
          <div className="stat-row-inner">
            <span className="stat-value readout">{monthlyEstimate != null ? `₹${Math.round(monthlyEstimate)}` : '--'}</span>
            <StatusPill status="warning" text="ESTIMATE" />
          </div>
        </div>
      </div>

      {/* Tariff — clearly a what-if slider, never blended into "measured" figures */}
      <div className="tariff-calibration-box">
        <span className="label-eyebrow" style={{ color: 'var(--text-primary)' }}>Electric Tariff Rate (your input, not a real utility rate)</span>
        <input
          type="range" min="4" max="15" step="0.5"
          value={tariffRate}
          onChange={(e) => setTariffRate(Number(e.target.value))}
          className="input-tariff-slider"
        />
        <span className="tariff-rate-read">₹{tariffRate.toFixed(2)}/kWh</span>
      </div>

      <div className="energy-layout-main">
        {/* Left: real relay controls only */}
        <PanelCard title="Connected Appliances" icon={Zap}>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 0, marginBottom: 14 }}>
            Only relay-controlled loads are shown — one ACS712 measures total house current, not per-appliance draw.
          </p>
          <div className="appliance-quick-row">
            <button className="appliance-quick-tile" onClick={toggleLight}>
              <Lightbulb size={18} style={{ color: lightOn ? 'var(--status-warning)' : 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>Room Lights</div>
                <span className="ui-pill" style={{
                  color: lightOn ? 'var(--status-safe)' : 'var(--text-secondary)',
                  borderColor: lightOn ? 'rgba(76,175,125,0.3)' : 'var(--border-subtle)',
                  background: lightOn ? 'rgba(76,175,125,0.1)' : 'transparent',
                }}>
                  {lightOn == null ? '--' : lightOn ? 'ON' : 'OFF'}
                </span>
              </div>
            </button>

            <button className="appliance-quick-tile" onClick={toggleFan}>
              <Fan size={18} style={{ color: fanOn ? 'var(--accent-info)' : 'var(--text-secondary)' }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>Cooling Fan</div>
                <span className="ui-pill" style={{
                  color: fanOn ? 'var(--status-safe)' : 'var(--text-secondary)',
                  borderColor: fanOn ? 'rgba(76,175,125,0.3)' : 'var(--border-subtle)',
                  background: fanOn ? 'rgba(76,175,125,0.1)' : 'transparent',
                }}>
                  {fanOn == null ? '--' : fanOn ? 'ON' : 'OFF'}
                </span>
              </div>
            </button>
          </div>
        </PanelCard>

        {/* Right: gauge + chart, unchanged from before, both already real */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <PanelCard title="Live Ammeter" icon={Zap} accent>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
              <DialGauge value={currentDraw ?? 0} max={5} unit="A" label="ACS712 Amps" size={120} thresholds={{ warning: 2.5, critical: 3.2 }} />
            </div>
          </PanelCard>

          <PanelCard title="7-Day Consumption" icon={TrendingUp}>
            {summary.daily_breakdown && summary.daily_breakdown.some((d) => d.kwh > 0) ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={summary.daily_breakdown}>
                    <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-panel-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                      labelStyle={{ color: 'var(--text-secondary)' }}
                      formatter={(value) => [`${value} kWh`, 'Usage']}
                    />
                    <Bar dataKey="kwh" fill="var(--accent-copper-bright)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="sn-week-total">
                  <span>Weekly Total</span>
                  <span className="readout">{summary.week_total_kwh.toFixed(2)} kWh</span>
                </div>
              </>
            ) : (
              <p className="sn-page-subtitle" style={{ textAlign: 'center', padding: '40px 0' }}>
                No consumption data yet — this fills in as the ESP32 reports ACS712 readings.
              </p>
            )}
          </PanelCard>
        </div>
      </div>

      <PanelCard title="AI Load Forecasting" icon={Sparkles} className="sn-ml-placeholder">
        <div className="sn-ml-placeholder-content">
          <Sparkles size={28} className="sn-ml-placeholder-icon" />
          <div>
            <p className="sn-ml-placeholder-title">Coming in Phase 7</p>
            <p className="sn-ml-placeholder-desc">
              Not built yet — needs sustained daily current data before any prediction model would be meaningful.
              Currently no ML pipeline exists beyond the empty prediction-log model in your `ml` app.
            </p>
          </div>
        </div>
      </PanelCard>
    </div>
  );
}