import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Crown, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function Household() {
  const { householdId, householdName } = useAuth();
  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [inviteUsername, setInviteUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'ok' | 'error', text }
  const [loading, setLoading] = useState(true);

  const loadMembers = useCallback(async () => {
    if (!householdId) return;
    try {
      const res = await client.get('/api/auth/household-members/', {
        params: { household_id: householdId },
      });
      setMembers(res.data);
      const me = res.data.find((m) => m.username === localStorage.getItem('smartnest_username'));
      setMyRole(me?.role ?? null);
    } catch (err) {
      console.error("Household fetch error:", err);
      // Capture detailed DRF error if available, otherwise general message
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || 'HTTP_ERROR: ' + err.message;
      setMsg({ type: 'error', text: `FAIL: ${errorMsg}` });
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await client.post('/api/auth/invite/', {
        household_id: householdId,
        username: inviteUsername.trim(),
      });
      setMsg({ type: 'ok', text: `${inviteUsername} successfully added to the household.` });
      setInviteUsername('');
      loadMembers();
    } catch (err) {
      setMsg({
        type: 'error',
        text: err.response?.data?.error || 'Could not add member. Ensure they have registered their account first.'
      });
    } finally {
      setBusy(false);
    }
  };

  const isOwner = myRole === 'owner';

  return (
    <div className="sn-page">
      <div className="sn-page-header">
        <div>
          <h1 className="sn-page-title" style={{ fontFamily: 'Manrope' }}>Household Access</h1>
          <p className="sn-page-subtitle" style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3' }}>
            PANEL: {householdName?.toUpperCase()} // MEMBERS CONTROL
          </p>
        </div>
      </div>

      <div className="sn-grid sn-grid-4" style={{ marginTop: 24 }}>
        {/* Members List Panel */}
        <div className="ui-panel" style={{ gridColumn: 'span 2', background: '#1B2028', border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
          <div className="ui-panel-header" style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 12, marginBottom: 16 }}>
            <Users size={16} style={{ color: '#C6813F' }} />
            <span style={{ fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.85rem', letterSpacing: '0.05em' }}>REGISTERED_MEMBERS</span>
          </div>

          {loading ? (
            <p style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3', fontSize: '0.8rem' }}>LOADING_DATA...</p>
          ) : (
            <div className="sn-access-log" style={{ display: 'flex', flexDirection: 'col', gap: 12 }}>
              {members.map((m) => (
                <div className="sn-access-item" key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#232A33', borderRadius: 4 }}>
                  {m.role === 'owner' ? (
                    <Crown size={16} style={{ color: '#E0A868' }} />
                  ) : (
                    <UserIcon size={16} style={{ color: '#8C95A3' }} />
                  )}
                  <div className="sn-access-details" style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="sn-access-uid" style={{ fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.9rem' }}>{m.username}</span>
                    <span className="sn-access-time" style={{ fontFamily: 'Manrope', color: '#8C95A3', fontSize: '0.75rem' }}>
                      Role: {m.role} · System access granted
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Provisioning/Invite Panel */}
        <div className="ui-panel" style={{ gridColumn: 'span 2', background: '#1B2028', border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
          <div className="ui-panel-header" style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 12, marginBottom: 16 }}>
            <UserPlus size={16} style={{ color: '#C6813F' }} />
            <span style={{ fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.85rem', letterSpacing: '0.05em' }}>PROVISION_ACCESS</span>
          </div>

          {isOwner ? (
            <form onSubmit={handleInvite} className="sn-login-form">
              <label className="sn-login-label" style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3', fontSize: '0.75rem', display: 'block', marginBottom: 6 }}>
                TARGET_USERNAME
              </label>
              <input
                className="sn-login-input"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                placeholder="Enter registered username"
                required
                style={{ width: '100%', background: '#12161B', border: '1px solid rgba(255,255,255,0.07)', padding: 10, color: '#EDEFF3', fontFamily: 'JetBrains Mono', borderRadius: 4 }}
              />
              <button className="sn-unlock-btn" style={{ width: '100%', marginTop: 12, background: '#C6813F', color: '#EDEFF3', border: 0, padding: 10, fontFamily: 'JetBrains Mono', borderRadius: 4, cursor: 'pointer' }} disabled={busy}>
                {busy ? 'COMMITTING_TRANSACTION...' : 'GRANT_ACCESS'}
              </button>
            </form>
          ) : (
            <p style={{ fontFamily: 'Manrope', color: '#E8A33D', fontSize: '0.85rem' }}>
              Read-only view. Only the primary hardware installer (Owner) can authorize new security profiles.
            </p>
          )}

          {msg && (
            <p style={{ marginTop: 12, fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: msg.type === 'ok' ? '#4CAF7D' : '#E15554' }}>
              {msg.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}