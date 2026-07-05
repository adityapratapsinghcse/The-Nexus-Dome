import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Security from './pages/Security';
import Climate from './pages/Climate';
import Safety from './pages/Safety';
import Energy from './pages/Energy';

function RequireAuth({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const isLoggedIn = !!localStorage.getItem('token');
  return (
    <>
      {isLoggedIn && <Navbar />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/security" element={<RequireAuth><Security /></RequireAuth>} />
        <Route path="/climate" element={<RequireAuth><Climate /></RequireAuth>} />
        <Route path="/safety" element={<RequireAuth><Safety /></RequireAuth>} />
        <Route path="/energy" element={<RequireAuth><Energy /></RequireAuth>} />
        <Route path="*" element={<Navigate to={isLoggedIn ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </>
  );
}