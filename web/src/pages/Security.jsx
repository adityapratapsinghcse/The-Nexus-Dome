import { useState, useEffect } from 'react';
import { Car, DoorOpen, Lock, Unlock, ShieldCheck, Fingerprint } from 'lucide-react';
import PanelCard from '../components/ui/PanelCard';
import StatusPill from '../components/ui/StatusPill';
import client from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';
import GaragePromptModal from '../components/GaragePromptModal';

export default function Safety() {
  const { householdId, householdName } = useAuth();
  const [device, setDevice] = useState(null);
  const [garageStatus, setGarageStatus] = useState('vacant');
  const [doorStatus, setDoorStatus] = useState('locked');
  const [accessLog, setAccessLog] = useState([]);
  const [prompt, setPrompt] = useState(null); // { device_id, alert_id, text }

  const { lastMessage: alertMessage } = useWebSocket('/ws/alerts/', householdId);

  useEffect(() => {
    if (!householdId) return;
    (async () => {
      const devicesRes = await client.get('/api/devices/');
      if (devicesRes.data.length === 0) return;
      const d = devicesRes.data[0];
      setDevice(d);
      setGarageStatus(d.garage_status || 'vacant');
      setDoorStatus(d.door_status || 'locked');

      const accessRes = await client.get(`/api/access/log/?device_id=${d.id}`);
      setAccessLog(accessRes.data.slice(0, 8));
    })();
  }, [householdId]);

  // Live events over the alerts socket
  useEffect(() => {
    if (!alertMessage) return;
    if (alertMessage.kind === 'garage_prompt') {
      setPrompt(alertMessage);
      setGarageStatus('pending');
    }
    if (alertMessage.type === 'rfid_denied' || alertMessage.message?.toLowerCase().includes('door')) {
      // refresh access log tail without a full reload
      setAccessLog((prev) => [{ granted: !alertMessage.type?.includes('denied'), timestamp: new Date().toISOString(), method: 'RFID' }, ...prev].slice(0, 8));
    }
  }, [alertMessage]);

  const respondToPrompt = async (confirm) => {
    if (!prompt) return;
    const { data } = await client.post('/api/commands/garage/confirm/', {
      device_id: prompt.device_id,
      confirm,
    });
    setGarageStatus(data.garage_status);
    setPrompt(null);
  };

  if (!device) return <div className="sn-page-loading">Loading safety…</div>;

  return (
    <div className="sn-page">
      <div className="sn-page-header">
        <div>
          <h1 className="sn-page-title">Safety</h1>
          <p className="sn-page-subtitle">Garage gate and home door, all in one place — {householdName}</p>
        </div>
      </div>

      <div className="sn-grid sn-grid-4">
        {/* Garage */}
        <PanelCard title="Garage Gate" icon={Car} className="sn-chart-panel" style={{ gridColumn: 'span 2' }}>
          <div className="sn-security-item">
            <Car size={16} className="sn-security-icon" />
            <span>Bay status</span>
            <StatusPill
              status={garageStatus === 'occupied' ? 'warning' : garageStatus === 'pending' ? 'critical' : 'safe'}
              text={garageStatus === 'occupied' ? 'OCCUPIED' : garageStatus === 'pending' ? 'AWAITING YOUR ANSWER' : 'VACANT'}
            />
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 10 }}>
            When a vehicle is detected at the gate, you'll get a prompt here (and on your phone) asking whether to open it.
          </p>
        </PanelCard>

        {/* Home door */}
        <PanelCard title="Home Door" icon={DoorOpen} className="sn-chart-panel" style={{ gridColumn: 'span 2' }}>
          <div className="sn-security-item">
            {doorStatus === 'locked' ? <Lock size={16} className="sn-security-icon" /> : <Unlock size={16} className="sn-security-icon" />}
            <span>Front door</span>
            <StatusPill status={doorStatus === 'locked' ? 'safe' : 'warning'} text={doorStatus.toUpperCase()} />
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 10 }}>
            Opens automatically when a registered RFID card is tapped at the door.
          </p>
        </PanelCard>

        {/* Access log — RFID taps, both doors */}
        <PanelCard title="Recent Access" icon={Fingerprint} className="sn-chart-panel" style={{ gridColumn: 'span 4' }}>
          <div className="sn-history-feed">
            {accessLog.length === 0 && <p className="label-eyebrow">No access events yet.</p>}
            {accessLog.map((a, i) => (
              <div key={i} className="sn-history-item">
                <ShieldCheck size={16} className={`sn-history-icon sn-history-${a.granted ? 'safe' : 'critical'}`} />
                <div className="sn-history-text">
                  <span className="sn-history-message">
                    {a.granted ? 'Access granted' : 'Access denied'} — {a.method || 'RFID'}
                  </span>
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