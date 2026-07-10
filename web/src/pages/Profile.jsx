import { UserCircle, Home, Shield, LogOut, Terminal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { householdName, logout } = useAuth();
  const username = localStorage.getItem('smartnest_username') || 'OPERATOR_ALPHA';

  return (
    <div className="sn-page">
      {/* Page Header */}
      <div className="sn-page-header">
        <div>
          <h1 className="sn-page-title" style={{ fontFamily: 'Manrope' }}>User Profile</h1>
          <p className="sn-page-subtitle" style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3' }}>
            SYSTEM: IDENTITY / INTERFACE MODULE
          </p>
        </div>
      </div>

      <div className="sn-grid sn-grid-4" style={{ marginTop: 24 }}>
        {/* Account Meta Panel */}
        <div className="ui-panel" style={{ gridColumn: 'span 2', background: '#1B2028', border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
          <div className="ui-panel-header" style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 12, marginBottom: 16 }}>
            <UserCircle size={16} style={{ color: '#C6813F' }} />
            <span style={{ fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.85rem', letterSpacing: '0.05em' }}>ACCOUNT_METADATA</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <span style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3', fontSize: '0.75rem', display: 'block' }}>OPERATOR_UID</span>
              <span style={{ fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '1.1rem', fontWeight: 600 }}>{username}</span>
            </div>
            <div>
              <span style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3', fontSize: '0.75rem', display: 'block' }}>SECURITY_ACCESS_LEVEL</span>
              <span style={{ fontFamily: 'JetBrains Mono', color: '#4CAF7D', fontSize: '0.85rem', letterSpacing: '0.05em' }}>LEVEL_4_ROOT_EXEC</span>
            </div>
          </div>
        </div>

        {/* Assigned Dome Info */}
        <div className="ui-panel" style={{ gridColumn: 'span 2', background: '#1B2028', border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
          <div className="ui-panel-header" style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 12, marginBottom: 16 }}>
            <Home size={16} style={{ color: '#C6813F' }} />
            <span style={{ fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.85rem', letterSpacing: '0.05em' }}>HARDWARE_DOME_ENV</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <span style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3', fontSize: '0.75rem', display: 'block' }}>ASSIGNED_DOME_ALIAS</span>
              <span style={{ fontFamily: 'Manrope', color: '#EDEFF3', fontSize: '1.1rem', fontWeight: 500 }}>{householdName || 'The Nexus Dome'}</span>
            </div>
            <div>
              <span style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3', fontSize: '0.75rem', display: 'block' }}>HARDWARE_LINK_MODE</span>
              <span style={{ fontFamily: 'JetBrains Mono', color: '#E0A868', fontSize: '0.85rem' }}>DUAL_BOARD (ESP32+UNO_SLAVE)</span>
            </div>
          </div>
        </div>

        {/* System Terminal Sessions / Actions */}
        <div className="ui-panel" style={{ gridColumn: 'span 4', background: '#1B2028', border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
          <div className="ui-panel-header" style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 12, marginBottom: 16 }}>
            <Shield size={16} style={{ color: '#C6813F' }} />
            <span style={{ fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.85rem', letterSpacing: '0.05em' }}>SESSION_TERMINATION</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Terminal size={20} style={{ color: '#8C95A3' }} />
              <p style={{ fontFamily: 'Manrope', color: '#8C95A3', fontSize: '0.85rem', margin: 0 }}>
                Flushing session tokens invalidates active local device keys and resets the real-time interface socket loops.
              </p>
            </div>

            <button 
              onClick={logout} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8,
                background: '#E15554', 
                color: '#EDEFF3', 
                border: 0, 
                padding: '10px 20px', 
                fontFamily: 'JetBrains Mono', 
                borderRadius: 4, 
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              <LogOut size={16} /> FLUSH_SESSION
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}