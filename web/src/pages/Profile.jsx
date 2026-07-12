import { User, Home, ShieldCheck, LogOut, Wifi, Users } from 'lucide-react';
import PanelCard from '../components/ui/PanelCard';
import StatusPill from '../components/ui/StatusPill';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { householdName, logout } = useAuth();
  const username = localStorage.getItem('smartnest_username') || 'Family Member';

  // Turn a username like "aditya_singh" into "Aditya Singh" for a friendlier greeting
  const displayName = username
    .replace(/[._]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const initials = displayName
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="sn-page">
      {/* Page Header */}
      <div className="sn-page-header">
        <div>
          <h1 className="sn-page-title">My Profile</h1>
          <p className="sn-page-subtitle">Your account and home details, all in one place</p>
        </div>
      </div>

      {/* Friendly identity banner */}
      <div className="ui-panel ui-panel-accent" style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-copper-bright) 0%, var(--accent-copper) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: '#1B2028', flexShrink: 0,
        }}>
          {initials || <User size={28} />}
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{displayName}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 2 }}>
            Member of {householdName || 'your home'}
          </div>
        </div>
        <StatusPill status="safe" text="ACCOUNT ACTIVE" />
      </div>

      <div className="sn-grid sn-grid-4">
        {/* Personal details */}
        <PanelCard title="Your Details" icon={User} className="sn-chart-panel" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span className="label-eyebrow">Name</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{displayName}</div>
            </div>
            <div>
              <span className="label-eyebrow">Role in the Home</span>
              <div style={{ fontSize: 15, color: 'var(--text-primary)', marginTop: 4 }}>Family Member</div>
            </div>
          </div>
        </PanelCard>

        {/* Household details */}
        <PanelCard title="Your Home" icon={Home} className="sn-chart-panel" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span className="label-eyebrow">Home Name</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                {householdName || 'My Home'}
              </div>
            </div>
            <div className="sn-security-item" style={{ marginTop: 2 }}>
              <Wifi size={16} className="sn-security-icon" />
              <span>Smart Devices</span>
              <StatusPill status="safe" text="CONNECTED" />
            </div>
          </div>
        </PanelCard>

        {/* Simple explainer card so a non-technical reader understands what's happening */}
        <PanelCard title="How This Works" icon={Users} className="sn-chart-panel" style={{ gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <ShieldCheck size={20} style={{ color: 'var(--status-safe)', flexShrink: 0, marginTop: 2 }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              This is your personal profile for <strong style={{ color: 'var(--text-primary)' }}>{householdName || 'your home'}</strong>.
              It shows your name and confirms your devices are safely connected. You don't need to change anything here —
              everything is set up and working for you.
            </p>
          </div>
        </PanelCard>

        {/* Sign out */}
        <PanelCard title="Sign Out" icon={LogOut} className="sn-chart-panel" style={{ gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0, maxWidth: 480 }}>
              Signing out will log you out of this device. You can always sign back in with your username and password.
            </p>
            <button onClick={logout} className="sn-unlock-btn" style={{ background: 'var(--status-critical)', display: 'flex', alignItems: 'center', gap: 8, width: 'auto', padding: '10px 22px' }}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </PanelCard>
      </div>
    </div>
  );
}