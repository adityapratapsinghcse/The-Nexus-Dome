import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useAndroidBackButton } from './native/useAndroidBackButton';
import { NotificationProvider } from './context/NotificationContext';
import { ToastContainer } from './components/ToastContainer';

import Navbar from './components/Navbar';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Climate from './pages/Climate';
import Safety from './pages/Safety';
import Security from './pages/Security';
import Energy from './pages/Energy';
import Household from './pages/Household';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';

function ProtectedLayout({ children }) {
  const { token, loading } = useAuth();

  if (loading) {
    return <div className="sn-page-loading">Loading...</div>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="sn-shell">
      <Navbar />
      <main className="sn-main">
        {children}
      </main>
    </div>
  );
}

function AppRoutes() {
  useAndroidBackButton();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedLayout>
            <Dashboard />
          </ProtectedLayout>
        }
      />

      <Route
        path="/climate"
        element={
          <ProtectedLayout>
            <Climate />
          </ProtectedLayout>
        }
      />

      <Route
        path="/safety"
        element={
          <ProtectedLayout>
            <Safety />
          </ProtectedLayout>
        }
      />

      <Route
        path="/security"
        element={
          <ProtectedLayout>
            <Security />
          </ProtectedLayout>
        }
      />

      <Route
        path="/energy"
        element={
          <ProtectedLayout>
            <Energy />
          </ProtectedLayout>
        }
      />

      <Route
        path="/household"
        element={
          <ProtectedLayout>
            <Household />
          </ProtectedLayout>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedLayout>
            <Profile />
          </ProtectedLayout>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedLayout>
            <Settings />
          </ProtectedLayout>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedLayout>
            <Notifications />
          </ProtectedLayout>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppRoutes />
        <ToastContainer />
      </NotificationProvider>
    </AuthProvider>
  );
}