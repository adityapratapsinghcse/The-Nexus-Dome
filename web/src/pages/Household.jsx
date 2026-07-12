import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Crown, User as UserIcon, Check, X, Search, Terminal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function Household() {
  const { householdId, householdName } = useAuth();
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [myRole, setMyRole] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!householdId) return;
    try {
      const res = await client.get('/api/auth/household-members/', {
        params: { household_id: householdId },
      });
      
      // Now that the backend sends 'is_active', this filter works perfectly
      setMembers(res.data.filter(m => m.is_active || m.role === 'owner'));
      setRequests(res.data.filter(m => m.is_active === false && m.role !== 'owner'));
      
      const me = res.data.find((m) => m.username === localStorage.getItem('smartnest_username'));
      setMyRole(me?.role ?? null);
    } catch (err) {
      setMsg({ type: 'error', text: 'CRITICAL: Data transmission bus query failed.' });
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live Autocomplete Effect
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        try {
          const res = await client.get(`/api/auth/search-users/?q=${searchQuery}`);
          setSearchResults(res.data);
          setShowDropdown(true);
        } catch (err) {
          console.error("Search failed. Check if /api/auth/search-users/ is in Django urls.py", err);
        }
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      // Note: Owners adding someone directly makes them instantly ACTIVE. 
      // Link Members registering from the login page creates PENDING requests.
      await client.post('/api/auth/invite/', {
        household_id: householdId,
        username: searchQuery.trim(),
      });
      setMsg({ type: 'ok', text: `PROVISIONED: ${searchQuery} active.` });
      setSearchQuery('');
      setShowDropdown(false);
      loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Execution link dropped.' });
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async (membershipId, action) => {
    try {
      await client.post('/api/auth/handle-request/', { membership_id: membershipId, action });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const isOwner = myRole === 'owner';

  return (
    <div className="sn-page" style={{ color: '#EDEFF3', boxSizing: 'border-box' }}>
      <div className="sn-page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="sn-page-title" style={{ fontFamily: 'Manrope', fontSize: '1.6rem', margin: 0 }}>Household Access Control</h1>
          <p className="sn-page-subtitle" style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3', margin: '4px 0 0 0', fontSize: '0.8rem' }}>
            NODE: {householdName?.toUpperCase()} // DOME_ID: {householdId}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        {/* Active Operators Box */}
        <div className="ui-panel" style={{ background: '#1B2028', border: '1px solid rgba(255,255,255,0.07)', padding: '20px', borderRadius: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '12px', marginBottom: '16px' }}>
            <Users size={16} style={{ color: '#C6813F' }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.85rem', letterSpacing: '0.05em' }}>ACTIVE_DOME_OPERATORS</span>
          </div>

          {loading ? (
            <p style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3', fontSize: '0.8rem' }}>BUS_READING...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {members.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', padding: '12px', background: '#232A33', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {m.role === 'owner' ? <Crown size={15} style={{ color: '#E0A868' }} /> : <UserIcon size={15} style={{ color: '#8C95A3' }} />}
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.9rem' }}>{m.username}</span>
                  </div>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', background: '#12161B', padding: '2px 6px', borderRadius: '3px', color: '#C6813F' }}>
                    {m.role.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Access Provisioning Box - OVERFLOW VISIBLE ADDED HERE */}
        <div className="ui-panel" style={{ background: '#1B2028', border: '1px solid rgba(255,255,255,0.07)', padding: '20px', borderRadius: '6px', position: 'relative', overflow: 'visible' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '12px', marginBottom: '16px' }}>
            <UserPlus size={16} style={{ color: '#C6813F' }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.85rem', letterSpacing: '0.05em' }}>DIRECT_PROVISION_NODE</span>
          </div>

          {isOwner ? (
            <form onSubmit={handleInvite} style={{ position: 'relative' }} autoComplete="off">
              <label style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3', fontSize: '0.7rem', display: 'block', marginBottom: '6px' }}>TARGET_USER_SEARCH</label>
              
              <div style={{ display: 'flex', alignItems: 'center', background: '#12161B', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '2px 10px', position: 'relative' }}>
                <Search size={14} style={{ color: '#8C95A3', marginRight: '8px' }} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { if(searchResults.length > 0) setShowDropdown(true); }}
                  placeholder="Type username..."
                  required
                  style={{ width: '100%', background: 'none', border: 0, padding: '8px 0', color: '#EDEFF3', fontFamily: 'JetBrains Mono', outline: 'none' }}
                />
              </div>

              {/* Floating Dropdown - Higher Z-Index */}
              {showDropdown && searchResults.length > 0 && (
                <div style={{ 
                  position: 'absolute', top: '65px', left: '0', right: '0', 
                  background: '#232A33', border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: '4px', zIndex: 9999, boxShadow: '0 12px 32px rgba(0,0,0,0.6)'
                }}>
                  {searchResults.map(u => (
                    <div 
                      key={u.id} 
                      onClick={() => { setSearchQuery(u.username); setShowDropdown(false); }} 
                      style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono', color: '#EDEFF3', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.target.style.background = '#12161B'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      {u.username}
                    </div>
                  ))}
                </div>
              )}

              <button style={{ width: '100%', marginTop: '16px', background: '#C6813F', color: '#EDEFF3', border: 0, padding: '12px', fontFamily: 'JetBrains Mono', cursor: 'pointer', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }} disabled={busy}>
                {busy ? 'SYNCHRONIZING...' : 'AUTHORIZE_OPERATOR'}
              </button>
            </form>
          ) : (
            <p style={{ fontFamily: 'Manrope', color: '#E8A33D', fontSize: '0.85rem', margin: 0 }}>
              Read-only terminal profile. Invite provisioning locked for current permission ring.
            </p>
          )}

          {msg && <p style={{ marginTop: '12px', fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: msg.type === 'ok' ? '#4CAF7D' : '#E15554', margin: '12px 0 0 0' }}>{msg.text}</p>}
        </div>
      </div>

      {/* Access Requests Matrix Breaker */}
      {isOwner && (
        <div className="ui-panel" style={{ background: '#1B2028', border: '1px solid rgba(255,255,255,0.07)', padding: '20px', borderRadius: '6px', marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '12px', marginBottom: '16px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: requests.length > 0 ? '#E15554' : '#4CAF7D', display: 'inline-block' }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.85rem', letterSpacing: '0.05em' }}>PENDING_BUS_LINK_REQUESTS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {requests.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#232A33', padding: '12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ fontFamily: 'JetBrains Mono', color: '#EDEFF3', fontSize: '0.85rem' }}><Terminal size={12} style={{ display: 'inline', marginRight: 6, color: '#C6813F' }} />{r.username} // INBOUND_REQ_LINK</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleAction(r.id, 'approve')} style={{ background: '#4CAF7D', color: '#EDEFF3', border: 0, padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Check size={14} /></button>
                  <button onClick={() => handleAction(r.id, 'deny')} style={{ background: '#E15554', color: '#EDEFF3', border: 0, padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={14} /></button>
                </div>
              </div>
            ))}
            {requests.length === 0 && <p style={{ fontFamily: 'JetBrains Mono', color: '#8C95A3', fontSize: '0.75rem', margin: 0 }}>NO_INBOUND_REQUESTS_DETECTED</p>}
          </div>
        </div>
      )}
    </div>
  );
}