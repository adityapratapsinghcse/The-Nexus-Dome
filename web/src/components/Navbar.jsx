import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ShieldCheck, Thermometer, AlertTriangle, Zap,
  Users, UserCircle, Menu, X, LogOut, HomeIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './NotificationBell';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/climate', label: 'Climate', icon: Thermometer },
  { to: '/safety', label: 'Safety', icon: AlertTriangle },
  { to: '/energy', label: 'Energy', icon: Zap },
  { to: '/household', label: 'Household', icon: Users },
  { to: '/profile', label: 'Profile', icon: UserCircle },
];

function initialsFrom(name) {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
}

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { logout, householdName } = useAuth();
  const username = localStorage.getItem('smartnest_username') || 'Operator';

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900) setDrawerOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {/* ===== Desktop Sidebar ===== */}
      <aside className="sn-sidebar">
        <div className="sn-sidebar-brand">
          <div className="sn-brand-mark">
            <HomeIcon size={16} strokeWidth={2.5} />
          </div>
          <div>
            <span className="sn-brand">THE NEXUS DOME</span>
            <span className="sn-brand-sub">CONTROL PANEL</span>
          </div>
        </div>

        <div className="sn-sidebar-eyebrow">
          <span className="label-eyebrow">Navigation</span>
        </div>

        <nav className="sn-sidebar-nav">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `sn-sidebar-link${isActive ? ' sn-sidebar-link-active' : ''}`
              }
            >
              <Icon size={17} strokeWidth={2} />
              <span className="sn-sidebar-link-label">{label}</span>
              <span className="sn-sidebar-link-dot" />
            </NavLink>
          ))}
        </nav>

        <div className="sn-sidebar-footer">
          <div className="sn-sidebar-avatar">{initialsFrom(username)}</div>
          <div className="sn-sidebar-footer-text">
            <span className="sn-sidebar-footer-name">{username}</span>
            <span className="sn-sidebar-footer-role">{householdName || 'No household'}</span>
          </div>
          <button className="sn-sidebar-logout" onClick={logout} aria-label="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ===== Mobile Top Bar ===== */}
      <header className="sn-topbar">
        <button className="sn-hamburger" onClick={() => setDrawerOpen(true)} aria-label="Open navigation menu">
          <Menu size={22} />
        </button>

        <div className="sn-brand-row">
          <div className="sn-brand-mark" style={{ width: 24, height: 24 }}>
            <HomeIcon size={13} strokeWidth={2.5} />
          </div>
          <span className="sn-brand" style={{ fontSize: 13 }}>NEXUS DOME</span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <NotificationBell />
        </div>
      </header>

      {/* ===== Mobile Drawer ===== */}
      <div
        className={`sn-backdrop${drawerOpen ? ' sn-backdrop-visible' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`sn-drawer${drawerOpen ? ' sn-drawer-open' : ''}`}>
        <div className="sn-drawer-header">
          <div className="sn-brand-row">
            <div className="sn-brand-mark" style={{ width: 26, height: 26 }}>
              <HomeIcon size={14} strokeWidth={2.5} />
            </div>
            <span className="sn-brand" style={{ fontSize: 13 }}>NEXUS DOME</span>
          </div>
          <button className="sn-hamburger" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
            <X size={22} />
          </button>
        </div>

        <div className="label-eyebrow" style={{ padding: '14px 16px 4px' }}>Navigation</div>

        <nav className="sn-drawerlinks">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `sn-drawerlink${isActive ? ' sn-drawerlink-active' : ''}`
              }
            >
              <Icon size={18} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sn-sidebar-footer" style={{ marginTop: 'auto' }}>
          <div className="sn-sidebar-avatar">{initialsFrom(username)}</div>
          <div className="sn-sidebar-footer-text">
            <span className="sn-sidebar-footer-name">{username}</span>
            <span className="sn-sidebar-footer-role">{householdName || 'No household'}</span>
          </div>
          <button className="sn-sidebar-logout" onClick={logout} aria-label="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}