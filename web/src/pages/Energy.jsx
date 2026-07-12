import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Zap, IndianRupee, TrendingUp, Sparkles, Sliders, Play, RefreshCw, AlertCircle } from 'lucide-react';
import PanelCard from '../components/ui/PanelCard';
import DialGauge from '../components/ui/DialGauge';
import StatusPill from '../components/ui/StatusPill';
import client from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';

export default function Energy() {
  const { householdId } = useAuth();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentDraw, setCurrentDraw] = useState(0);
  const [summary, setSummary] = useState({ today_kwh: 0, week_total_kwh: 0, daily_breakdown: [], has_data: false });

  // New interactive parameters
  const [tariffRate, setTariffRate] = useState(7.5); // Custom cost per kWh
  const [applianceHours, setApplianceHours] = useState({
    ac: 4,      // Air Conditioner: 1500W
    fan: 8,     // Ceiling Fan: 75W
    lights: 6,  // LED Lights: 50W
    fridge: 24, // Refrigerator: 200W
    pump: 0.5   // Water Pump: 750W
  });

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
      setSummary(summaryRes.data);
    } catch (err) {
      console.error('Failed to load energy data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnergyData();
  }, [householdId]);

  useEffect(() => {
    if (lastMessage?.current_amps !== undefined) setCurrentDraw(lastMessage.current_amps);
  }, [lastMessage]);

  // Handle custom appliance load calculations
  const calculateApplianceLoad = () => {
    const acKwh = (1500 * applianceHours.ac) / 1000;
    const fanKwh = (75 * applianceHours.fan) / 1000;
    const lightsKwh = (50 * applianceHours.lights) / 1000;
    const fridgeKwh = (200 * applianceHours.fridge) / 1000;
    const pumpKwh = (750 * applianceHours.pump) / 1000;
    
    const totalDailyKwh = acKwh + fanKwh + lightsKwh + fridgeKwh + pumpKwh;
    const monthlyCost = totalDailyKwh * 30 * tariffRate;
    return {
      dailyKwh: totalDailyKwh,
      monthlyCost: monthlyCost,
      acShare: (acKwh / totalDailyKwh) * 100 || 0,
      fanShare: (fanKwh / totalDailyKwh) * 100 || 0,
      lightsShare: (lightsKwh / totalDailyKwh) * 100 || 0,
      fridgeShare: (fridgeKwh / totalDailyKwh) * 100 || 0,
      pumpShare: (pumpKwh / totalDailyKwh) * 100 || 0
    };
  };

  const calculatedLoad = calculateApplianceLoad();
  const currentWatts = currentDraw * 230;
  
  // Real-time projected cost
  const realTimeMonthEstimate = summary.today_kwh > 0 ? (summary.today_kwh * 30 * tariffRate) : calculatedLoad.monthlyCost;

  const handleSliderChange = (appliance, value) => {
    setApplianceHours(prev => ({ ...prev, [appliance]: Number(value) }));
  };

  if (loading) return <div className="sn-page-loading">Initializing power grid shunts...</div>;

  if (!device) {
    return (
      <div className="sn-page">
        <h1 className="sn-page-title">Energy</h1>
        <p className="sn-page-subtitle">No operational energy shunts discovered. Register an ACS712 board to log load telemetry.</p>
      </div>
    );
  }

  return (
    <div className="sn-page energy-page">
      <style>{`
        .energy-page {
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

        .energy-layout-main {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        @media (max-width: 900px) {
          .energy-layout-main {
            grid-template-columns: 1fr;
          }
        }

        /* Appliance matrix slider grid */
        .appliance-simulator-panel {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .appliance-slider-row {
          background: var(--bg-deep);
          border: 1px solid rgba(255,255,255,0.03);
          border-radius: 8px;
          padding: 12px;
        }
        .appliance-slider-meta {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-bottom: 6px;
        }
        .appliance-val-read {
          font-family: var(--font-mono);
          color: var(--accent-copper-bright);
          font-weight: 700;
        }

        /* Tariff modifier tool */
        .tariff-calibration-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-deep);
          border: 1px solid rgba(255,255,255,0.04);
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
          min-width: 50px;
          text-align: right;
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <div className="sn-page-header">
            <h1 className="sn-page-title">Energy Command Panel</h1>
            <div className="sn-live-indicator">
              <StatusPill status="safe" text="ACS712 SHUNT ACTIVE" />
            </div>
          </div>
          <p className="sn-page-subtitle readout">{device.name} // NODE_POWER_BUS_EST_OK</p>
        </div>
        <button className="sn-icon-btn" onClick={fetchEnergyData} title="Sync Energy Data">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Stats Row */}
      <div className="stat-grid-row">
        <div className="telemetry-stat-card">
          <span className="label-eyebrow">ACS712 Amps</span>
          <div className="stat-row-inner">
            <span className="stat-value readout">{currentDraw.toFixed(2)}<span className="sn-stat-unit">A</span></span>
            <StatusPill status={currentDraw > 3.2 ? 'critical' : currentDraw > 2.2 ? 'warning' : 'safe'} text={currentDraw > 3.2 ? 'OVERLOAD' : 'NOMINAL'} />
          </div>
        </div>

        <div className="telemetry-stat-card">
          <span className="label-eyebrow">Load Watts (Est.)</span>
          <div className="stat-row-inner">
            <span className="stat-value readout">{Math.round(currentWatts)}<span className="sn-stat-unit">W</span></span>
            <StatusPill status="safe" text="GRID OK" />
          </div>
        </div>

        <div className="telemetry-stat-card">
          <span className="label-eyebrow">Today Sum</span>
          <div className="stat-row-inner">
            <span className="stat-value readout">{summary.today_kwh > 0 ? summary.today_kwh.toFixed(2) : calculatedLoad.dailyKwh.toFixed(2)}<span className="sn-stat-unit">kWh</span></span>
            <StatusPill status="safe" text="SHUNTS OK" />
          </div>
        </div>

        <div className="telemetry-stat-card">
          <span className="label-eyebrow">Tariff Cost (Est.)</span>
          <div className="stat-row-inner">
            <span className="stat-value readout">₹{Math.round(realTimeMonthEstimate)}</span>
            <StatusPill status="safe" text="MONTHLY" />
          </div>
        </div>
      </div>

      {/* Tariff Calibration Slider Tool */}
      <div className="tariff-calibration-box">
        <span className="label-eyebrow" style={{ color: 'var(--text-primary)' }}>Electric Tariff Rate</span>
        <input 
          type="range" 
          min="4" 
          max="15" 
          step="0.5" 
          value={tariffRate} 
          onChange={(e) => setTariffRate(Number(e.target.value))} 
          className="input-tariff-slider" 
        />
        <span className="tariff-rate-read">₹{tariffRate.toFixed(2)}/kWh</span>
      </div>

      {/* Main Layout Grid */}
      <div className="energy-layout-main">
        
        {/* Left Side: Dynamic Appliance Load Simulator */}
        <PanelCard title="Appliance Load Duty Cycle Matrix" icon={Sliders}>
          <div className="appliance-simulator-panel">
            <p className="sn-page-subtitle" style={{ fontSize: '0.75rem', lineHeight: 1.4, margin: '0 0 4px' }}>
              Simulates daily appliance runtime hours to calculate estimated power grid share and monthly overhead budget.
            </p>

            <div className="appliance-slider-row">
              <div className="appliance-slider-meta">
                <span>Air Conditioner (1.5 Ton AC - 1500W)</span>
                <span className="appliance-val-read">{applianceHours.ac} hrs</span>
              </div>
              <input 
                type="range" min="0" max="24" step="0.5" 
                value={applianceHours.ac} 
                onChange={(e) => handleSliderChange('ac', e.target.value)} 
                style={{ width: '100%', accentColor: 'var(--accent-copper)' }} 
              />
            </div>

            <div className="appliance-slider-row">
              <div className="appliance-slider-meta">
                <span>Ceiling Cooling Fan (75W)</span>
                <span className="appliance-val-read">{applianceHours.fan} hrs</span>
              </div>
              <input 
                type="range" min="0" max="24" step="0.5" 
                value={applianceHours.fan} 
                onChange={(e) => handleSliderChange('fan', e.target.value)} 
                style={{ width: '100%', accentColor: 'var(--accent-copper)' }} 
              />
            </div>

            <div className="appliance-slider-row">
              <div className="appliance-slider-meta">
                <span>Ecosystem Lights (50W total LED)</span>
                <span className="appliance-val-read">{applianceHours.lights} hrs</span>
              </div>
              <input 
                type="range" min="0" max="24" step="0.5" 
                value={applianceHours.lights} 
                onChange={(e) => handleSliderChange('lights', e.target.value)} 
                style={{ width: '100%', accentColor: 'var(--accent-copper)' }} 
              />
            </div>

            <div className="appliance-slider-row">
              <div className="appliance-slider-meta">
                <span>Refrigerator (200W constant cycle)</span>
                <span className="appliance-val-read">{applianceHours.fridge} hrs</span>
              </div>
              <input 
                type="range" min="0" max="24" step="1" 
                value={applianceHours.fridge} 
                onChange={(e) => handleSliderChange('fridge', e.target.value)} 
                style={{ width: '100%', accentColor: 'var(--accent-copper)' }} 
              />
            </div>
          </div>
        </PanelCard>

        {/* Right Side: Usage Trend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Live dial gauge ammeter */}
          <PanelCard title="Transducer Ammeter Dial" icon={Zap} accent>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
              <DialGauge value={currentDraw} max={5} unit="A" label="ACS712 Amps" size={120} thresholds={{ warning: 2.5, critical: 3.2 }} />
            </div>
          </PanelCard>

          {/* 7-Day Usage Recharts Chart */}
          <PanelCard title="7-Day Consumption Log" icon={TrendingUp}>
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
                    <Bar dataKey="kwh" fill="var(--accent-copper-bright)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="sn-week-total">
                  <span>Weekly Accumulative Tally</span>
                  <span className="readout">{summary.week_total_kwh.toFixed(2)} kWh</span>
                </div>
              </>
            ) : (
              <p className="sn-page-subtitle" style={{ textAlign: 'center', padding: '40px 0' }}>
                Accumulating ACS712 telemetry data to plot daily consumption logs...
              </p>
            )}
          </PanelCard>

        </div>

      </div>

      {/* AI forecast section */}
      <PanelCard title="AI Load Predictive forecaster" icon={Sparkles} className="sn-ml-placeholder">
        <div className="sn-ml-placeholder-content">
          <Sparkles size={28} className="sn-ml-placeholder-icon" />
          <div>
            <p className="sn-ml-placeholder-title">Linear Regression Predictive Model</p>
            <p className="sn-ml-placeholder-desc">
              ML modules trigger training operations automatically once 14 consecutive observation days compile to database shunts. Forecaster maps monthly tariff estimations, peak-load warnings, and logs anomalies.
            </p>
          </div>
        </div>
      </PanelCard>

    </div>
  );
}