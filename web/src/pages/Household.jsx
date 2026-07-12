import { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, Crown, User as UserIcon, Check, X, Search,
  Cpu, Clock, ShieldCheck,
} from 'lucide-react';
import PanelCard from '../components/ui/PanelCard';
import StatusPill from '../components/ui/StatusPill';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function Household() {
  const { householdId, householdName } = useAuth();
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [deviceCount, setDeviceCount] = useState(null); // null = not loaded yet, don't show a fake 0

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!householdId) return;
    try {
      const [membersRes, devicesRes] = await Promise.all([
        client.get('/api/auth/household-members/', { params: { household_id: householdId } }),
        client.get('/api/devices/').catch(() => ({ data: [] })),
      ]);

      setMembers(membersRes.data.filter((m) => m.is_active || m.role === 'owner'));
      setRequests(membersRes.data.filter((m) => m.is_active === false && m.role !== 'owner'));
      setDeviceCount(devicesRes.data.length);

      const me = membersRes.data.find((m) => m.username === localStorage.getItem('smartnest_username'));
      setMyRole(me?.role ?? null);
    } catch (err) {
      setMsg({ type: 'error', text: 'Could not load household data. Try refreshing.' });
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        try {
          const res = await client.get(`/api/auth/search-users/?q=${searchQuery}`);
          setSearchResults(res.data);
          setShowDropdown(true);
        } catch (err) {
          console.error('Search failed:', err);
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
      // Note: owners adding someone directly makes them instantly active.
      // Users who self-register as "member" and target this owner instead
      // land in `requests` below as pending, via register_split.
      await client.post('/api/auth/invite/', {
        household_id: householdId,
        username: searchQuery.trim(),
      });
      setMsg({ type: 'ok', text: `${searchQuery} added to the household.` });
      setSearchQuery('');
      setShowDropdown(false);
      loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to add member.' });
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

  if (loading) return <div className="sn-page-loading">Loading household…</div>;

  return (
    <div className="sn-page">
      <div className="sn-page-header">
        <div>
          <h1 className="sn-page-title">Household Access</h1>
          <p className="sn-page-subtitle">
            {householdName || 'Your home'} · {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Stat cards — all real counts, no fabricated "online" or fixed device numbers */}
      <div className="sn-grid sn-grid-4">
        <PanelCard className="sn-stat-card">
          <div className="sn-stat-icon-circle" style={{ background: 'rgba(198,129,63,0.18)', color: 'var(--accent-copper-bright)' }}>
            <Users size={20} />
          </div>
          <div className="sn-stat-card-body">
            <div className="sn-stat-card-label">Total Members</div>
            <div className="sn-stat-card-value">{members.length}</div>
          </div>
        </PanelCard>

        <PanelCard className="sn-stat-card">
          <div className="sn-stat-icon-circle" style={{ background: 'rgba(76,175,125,0.18)', color: 'var(--status-safe)' }}>
            <ShieldCheck size={20} />
          </div>
          <div className="sn-stat-card-body">
            <div className="sn-stat-card-label">Active Members</div>
            <div className="sn-stat-card-value">{members.filter((m) => m.is_active !== false).length}</div>
          </div>
        </PanelCard>

        <PanelCard className="sn-stat-card">
          <div className="sn-stat-icon-circle" style={{ background: requests.length > 0 ? 'rgba(232,163,61,0.18)' : 'rgba(140,149,163,0.15)', color: requests.length > 0 ? 'var(--status-warning)' : 'var(--text-secondary)' }}>
            <Clock size={20} />
          </div>
          <div className="sn-stat-card-body">
            <div className="sn-stat-card-label">Pending Requests</div>
            <div className="sn-stat-card-value">{requests.length}</div>
          </div>
        </PanelCard>

        <PanelCard className="sn-stat-card">
          <div className="sn-stat-icon-circle" style={{ background: 'rgba(79,163,209,0.18)', color: 'var(--accent-info)' }}>
            <Cpu size={20} />
          </div>
          <div className="sn-stat-card-body">
            <div className="sn-stat-card-label">Registered Boards</div>
            <div className="sn-stat-card-value">{deviceCount ?? '--'}</div>
          </div>
        </PanelCard>
      </div>

      <div className="sn-grid sn-grid-11">
        {/* Active members */}
        <PanelCard title="Active Home Operators" icon={Users}>
          {members.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No members yet.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map((m) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', background: 'var(--bg-panel-raised)', borderRadius: 8,
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {m.role === 'owner'
                    ? <Crown size={15} style={{ color: 'var(--accent-copper-bright)' }} />
                    : <UserIcon size={15} style={{ color: 'var(--text-secondary)' }} />}
                  <span style={{ fontSize: 14 }}>{m.username}</span>
                </div>
                <StatusPill
                  status={m.role === 'owner' ? 'safe' : 'safe'}
                  text={m.role.toUpperCase()}
                />
              </div>
            ))}
          </div>
        </PanelCard>

        {/* Invite */}
        <PanelCard title="Add a Member" icon={UserPlus}>
          {isOwner ? (
            <form onSubmit={handleInvite} style={{ position: 'relative' }} autoComplete="off">
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Search by username
              </label>
              <div style={{
                display: 'flex', alignItems: 'center', background: 'var(--bg-panel-raised)',
                border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '2px 12px',
              }}>
                <Search size={14} style={{ color: 'var(--text-secondary)', marginRight: 8, flexShrink: 0 }} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                  placeholder="Type a username..."
                  required
                  style={{
                    width: '100%', background: 'none', border: 0, padding: '9px 0',
                    color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none', fontSize: 14,
                  }}
                />
              </div>

              {showDropdown && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: 62, left: 0, right: 0, background: 'var(--bg-panel-raised)',
                  border: '1px solid var(--border-subtle)', borderRadius: 8, zIndex: 50,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                }}>
                  {searchResults.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => { setSearchQuery(u.username); setShowDropdown(false); }}
                      style={{
                        padding: '10px 14px', color: 'var(--text-primary)', cursor: 'pointer',
                        borderBottom: '1px solid var(--border-subtle)', fontSize: 13.5,
                      }}
                    >
                      {u.username}
                    </div>
                  ))}
                </div>
              )}

              <button
                disabled={busy}
                style={{
                  width: '100%', marginTop: 14, background: 'var(--accent-copper-bright)', color: '#1a1208',
                  border: 0, padding: '11px 0', fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
                  borderRadius: 8, fontSize: 13,
                }}
              >
                {busy ? 'Adding…' : 'Add to Household'}
              </button>
            </form>
          ) : (
            <p style={{ color: 'var(--status-warning)', fontSize: 13.5, margin: 0 }}>
              Only the household owner can add members.
            </p>
          )}

          {msg && (
            <p style={{
              marginTop: 12, fontSize: 12.5, margin: '12px 0 0 0',
              color: msg.type === 'ok' ? 'var(--status-safe)' : 'var(--status-critical)',
            }}>
              {msg.text}
            </p>
          )}

          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 14, marginBottom: 0 }}>
            This only works for users who already have an account — there's no email invite link yet.
            To join without an existing account, someone registers separately as a "member" targeting your username,
            and their request appears below for you to approve.
          </p>
        </PanelCard>
      </div>

      {/* Pending requests */}
      {isOwner && (
        <PanelCard title="Pending Join Requests" icon={Clock} style={{ marginBottom: 20 }}>
          {requests.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>No pending requests.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {requests.map((r) => (
                <div key={r.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'var(--bg-panel-raised)', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                }}>
                  <span style={{ fontSize: 14 }}>{r.username}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleAction(r.id, 'approve')}
                      style={{
                        background: 'var(--status-safe)', color: '#0E1A14', border: 0, padding: '6px 10px',
                        borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center',
                      }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => handleAction(r.id, 'deny')}
                      style={{
                        background: 'var(--status-critical)', color: '#2A0E0E', border: 0, padding: '6px 10px',
                        borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center',
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      )}

      {/* Honest note replacing the fake permissions matrix */}
      <PanelCard title="Access Levels" icon={ShieldCheck}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
          Roles are currently Owner or Member only — there's no per-feature permissions matrix (Access Gate,
          Control Devices, Admin Access, etc.) in the backend yet. Owners can add and approve members; members
          can view and use the dashboard the same as owners otherwise.
        </p>
      </PanelCard>
    </div>
  );
}