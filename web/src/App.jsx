import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useAndroidBackButton } from './native/useAndroidBackButton';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Security from './pages/Security';
import Climate from './pages/Climate';
import Safety from './pages/Safety';
import Energy from './pages/Energy';

function ProtectedLayout({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="sn-page-loading">Loading…</div>;
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div>
      <Navbar />
      <main style={{ padding: '24px', boxSizing: 'border-box' }}>{children}</main>
    </div>
  );
}

function AppRoutes() {
  useAndroidBackButton();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
      <Route path="/security" element={<ProtectedLayout><Security /></ProtectedLayout>} />
      <Route path="/climate" element={<ProtectedLayout><Climate /></ProtectedLayout>} />
      <Route path="/safety" element={<ProtectedLayout><Safety /></ProtectedLayout>} />
      <Route path="/energy" element={<ProtectedLayout><Energy /></ProtectedLayout>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;