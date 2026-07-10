import { useState, useEffect, useCallback } from 'react';
import { Thermometer, Droplets, Wind, Flame, ShieldAlert, Car, Power, Lightbulb, Fan, Unlock, Activity, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function Dashboard() {
  const { householdName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sysStatus, setSysStatus] = useState('OFFLINE');
  
  // Real-time sensor state map
  const [metrics, setMetrics] = useState({
    temperature: 0, humidity: 0,
    gas_percent: 0, flame_detected: false,
    car_detected: false, water_leak: false,
    motion: false, is_dark: false, current_amps: 0.0
  });

  // Actuator hardware states
  const [controls, setControls] = useState({
    light_on: false,
    fan_on: false,
    door_unlocked: false
  });

  // Fetch latest data from the Django Backend
  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await client.get('/api/sensors/latest/');
      if (res.data && res.data.length > 0) {
        setMetrics(res.data[0]); // Assuming backend returns an array of latest readings
        setSysStatus('ONLINE');
      }
    } catch (err) {
      setSysStatus('OFFLINE');
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 3 seconds for live dashboard updates
  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  // Command Execution Bus
  const dispatchCommand = async (actuator, actionName) => {
    // Optimistic UI update for instantaneous feel
    setControls(prev => ({ ...prev, [actuator]: !prev[actuator] }));
    
    try {
      await client.post('/api/commands/send/', {
        device_id: 1, // Main ESP32 ID
        action: actionName
      });
    } catch (err) {
      // Revert if command fails
      console.error("Hardware command failed", err);
      setControls(prev => ({ ...prev, [actuator]: !prev[actuator] }));
    }
  };

  // Reusable CSS for Needle Gauges
  const renderDial = (value, max, label, unit, color) => {
    const percentage = Math.min(Math.max(value / max, 0), 1) * 100;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div style={{
          position: 'relative', width: '90px', height: '90px', borderRadius: '50%',
          background: `conic-gradient(${color} ${percentage}%, #232A33 ${percentage}%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.3)'
        }}>
          <div style={{ 
            width: '74px', height: '74px', borderRadius: '50%', background: '#12161B', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <span style={{ fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '1.1rem', fontWeight: 'bold' }}>{value.toFixed(1)}</span>
            <span style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3', fontSize: '0.6rem' }}>{unit}</span>
          </div>
        </div>
        <span style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3', fontSize: '0.75rem', letterSpacing: '0.05em' }}>{label}</span>
      </div>
    );
  };

  return (
    <div className="sn-page" style={{ paddingBottom: '40px' }}>
      
      {/* Dynamic Hardware Toggles CSS */}
      <style>{`
        .hw-toggle {
          appearance: none; width: 44px; height: 24px; background: #12161B;
          border-radius: 12px; position: relative; cursor: pointer; outline: none;
          border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.6);
        }
        .hw-toggle::after {
          content: ''; position: absolute; top: 2px; left: 2px;
          width: 18px; height: 18px; background: #8C95A3; borderRadius: 50%;
          transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .hw-toggle:checked { background: rgba(198, 129, 63, 0.2); border-color: #C6813F; }
        .hw-toggle:checked::after { transform: translateX(20px); background: #C6813F; }
        
        .panel-card {
          background: #1B2028; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px; padding: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        }
      `}</style>

      {/* Global Telemetry Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope', color: '#EDEFF3', fontSize: '1.8rem', margin: '0 0 8px 0' }}>Main Control Matrix</h1>
          <p style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3', margin: 0, fontSize: '0.85rem' }}>
            DOME: {householdName?.toUpperCase() || 'THE NEXUS'} // TERMINAL_ACTIVE
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#12161B', padding: '8px 16px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <Activity size={16} style={{ color: sysStatus === 'ONLINE' ? '#4CAF7D' : '#E15554' }} />
          <span style={{ fontFamily: 'JetBrains Mono', color: sysStatus === 'ONLINE' ? '#4CAF7D' : '#E15554', fontSize: '0.85rem', fontWeight: 'bold' }}>
            {sysStatus}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* MODULE 1: Analog Instrumentation (Dials) */}
        <div className="panel-card" style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', gap: '20px' }}>
          {renderDial(metrics.temperature, 50, 'TEMP_CORE', '°C', '#E0A868')}
          {renderDial(metrics.humidity, 100, 'ATMOS_HUMIDITY', '%', '#4CAF7D')}
          {renderDial(metrics.gas_percent, 100, 'MQ2_GAS_LVL', '%', metrics.gas_percent > 40 ? '#E15554' : '#C6813F')}
          {renderDial(metrics.current_amps, 5, 'POWER_DRAW', 'AMP', '#8C95A3')}
        </div>

        {/* MODULE 2: Security & Access (Front Gate & Garage) */}
        <div className="panel-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
            <Unlock size={18} style={{ color: '#C6813F' }} />
            <span style={{ fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.9rem' }}>PERIMETER_SECURITY</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#12161B', padding: '16px', borderRadius: '6px' }}>
              <div>
                <span style={{ display: 'block', fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.85rem' }}>FRONT_GATE_SERVO</span>
                <span style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3', fontSize: '0.7rem' }}>RFID / Remote Override</span>
              </div>
              <button 
                onClick={() => dispatchCommand('door_unlocked', 'unlock_door')}
                style={{ 
                  background: controls.door_unlocked ? '#4CAF7D' : '#232A33', color: '#EDEFF3', border: '1px solid rgba(255,255,255,0.1)',
                  padding: '8px 16px', borderRadius: '4px', fontFamily: 'JetBrains Mono', cursor: 'pointer', fontSize: '0.8rem', transition: '0.2s'
                }}>
                {controls.door_unlocked ? 'OPEN' : 'LOCKED'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#12161B', padding: '16px', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Car size={20} style={{ color: metrics.car_detected ? '#C6813F' : '#8C95A3' }} />
                <div>
                  <span style={{ display: 'block', fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.85rem' }}>GARAGE_BAY_SONAR</span>
                  <span style={{ fontFamily: 'JetBrains Mono', color: metrics.car_detected ? '#C6813F' : '#8C95A3', fontSize: '0.7rem' }}>
                    {metrics.car_detected ? 'VEHICLE_PRESENT' : 'BAY_CLEAR'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODULE 3: Environment Controls (Actuator Relays) */}
        <div className="panel-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
            <Zap size={18} style={{ color: '#C6813F' }} />
            <span style={{ fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.9rem' }}>RELAY_ACTUATORS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#12161B', padding: '16px', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Lightbulb size={20} style={{ color: controls.light_on ? '#E0A868' : '#8C95A3' }} />
                <span style={{ fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.85rem' }}>MAIN_LIGHTING</span>
              </div>
              <input 
                type="checkbox" 
                className="hw-toggle" 
                checked={controls.light_on} 
                onChange={(e) => dispatchCommand('light_on', e.target.checked ? 'light_on' : 'light_off')} 
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#12161B', padding: '16px', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Fan size={20} style={{ color: controls.fan_on ? '#4CAF7D' : '#8C95A3' }} />
                <span style={{ fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.85rem' }}>HVAC_FAN_L298N</span>
              </div>
              <input 
                type="checkbox" 
                className="hw-toggle" 
                checked={controls.fan_on} 
                onChange={(e) => dispatchCommand('fan_on', e.target.checked ? 'fan_on' : 'fan_off')} 
              />
            </div>
          </div>
        </div>

        {/* MODULE 4: Hazard & Safety Matrix */}
        <div className="panel-card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
            <ShieldAlert size={18} style={{ color: '#E15554' }} />
            <span style={{ fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.9rem' }}>HAZARD_DETECTION_BUS</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: metrics.flame_detected ? 'rgba(225,85,84,0.1)' : '#12161B', padding: '16px', borderRadius: '6px', border: metrics.flame_detected ? '1px solid #E15554' : '1px solid rgba(255,255,255,0.05)' }}>
              <Flame size={24} style={{ color: metrics.flame_detected ? '#E15554' : '#8C95A3' }} />
              <div>
                <span style={{ display: 'block', fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.85rem' }}>KITCHEN_FLAME</span>
                <span style={{ fontFamily: 'JetBrains Mono', color: metrics.flame_detected ? '#E15554' : '#4CAF7D', fontSize: '0.75rem' }}>{metrics.flame_detected ? 'CRITICAL_FIRE' : 'SAFE'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: metrics.water_leak ? 'rgba(225,85,84,0.1)' : '#12161B', padding: '16px', borderRadius: '6px', border: metrics.water_leak ? '1px solid #E15554' : '1px solid rgba(255,255,255,0.05)' }}>
              <Droplets size={24} style={{ color: metrics.water_leak ? '#E15554' : '#8C95A3' }} />
              <div>
                <span style={{ display: 'block', fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.85rem' }}>TANK_LEAK_SENSOR</span>
                <span style={{ fontFamily: 'JetBrains Mono', color: metrics.water_leak ? '#E15554' : '#4CAF7D', fontSize: '0.75rem' }}>{metrics.water_leak ? 'LEAK_DETECTED' : 'DRY'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: metrics.motion ? 'rgba(198,129,63,0.1)' : '#12161B', padding: '16px', borderRadius: '6px', border: metrics.motion ? '1px solid #C6813F' : '1px solid rgba(255,255,255,0.05)' }}>
              <Activity size={24} style={{ color: metrics.motion ? '#C6813F' : '#8C95A3' }} />
              <div>
                <span style={{ display: 'block', fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.85rem' }}>ROOM_PIR_MOTION</span>
                <span style={{ fontFamily: 'JetBrains Mono', color: metrics.motion ? '#C6813F' : '#8C95A3', fontSize: '0.75rem' }}>{metrics.motion ? 'MOTION_ACTIVE' : 'IDLE'}</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}