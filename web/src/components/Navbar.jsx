import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldCheck,
  Thermometer,
  AlertTriangle,
  Zap,
  Users,
  UserCircle,
  Menu,
  X,
  LogOut,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './NotificationBell';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/security', label: 'Security', icon: ShieldCheck },
  { to: '/climate', label: 'Climate', icon: Thermometer },
  { to: '/safety', label: 'Safety', icon: AlertTriangle },
  { to: '/energy', label: 'Energy', icon: Zap },
  { to: '/household', label: 'Household', icon: Users },
  { to: '/profile', label: 'Profile', icon: UserCircle },
];

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { logout, householdName } = useAuth();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setDrawerOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <>
      <header className="sn-topbar">
        {/* Mobile Menu Button */}
        <button
          className="sn-hamburger"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={22} />
        </button>

        {/* Logo */}
        <div className="sn-brand-row">
          <div className="sn-brand-dot" />
          <span className="sn-brand">SMARTNEST</span>
        </div>

        {/* Desktop Navigation */}
        <nav className="sn-toplinks">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `sn-toplink${isActive ? ' sn-toplink-active' : ''}`
              }
            >
              <Icon size={16} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Right Section */}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {/* Notification Bell */}
          <NotificationBell />

          {/* Household Name */}
          <span className="label-eyebrow">{householdName}</span>

          {/* Logout */}
          <button
            className="sn-hamburger"
            onClick={logout}
            aria-label="Logout"
            style={{ display: 'flex' }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Drawer Backdrop */}
      <div
        className={`sn-backdrop${
          drawerOpen ? ' sn-backdrop-visible' : ''
        }`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Mobile Drawer */}
      <aside
        className={`sn-drawer${
          drawerOpen ? ' sn-drawer-open' : ''
        }`}
      >
        <div className="sn-drawer-header">
          <div className="sn-brand-row">
            <div className="sn-brand-dot" />
            <span className="sn-brand">SMARTNEST</span>
          </div>

          <button
            className="sn-hamburger"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>

        <div
          className="label-eyebrow"
          style={{
            padding: '0 16px',
            margin: '8px 0',
          }}
        >
          Control Panel
        </div>

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

        {/* Drawer Footer */}
        <div
          style={{
            marginTop: 'auto',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span className="label-eyebrow">{householdName}</span>

          <button
            className="sn-hamburger"
            onClick={logout}
            aria-label="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}