import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await client.post('/api/auth/login/', { username, password });
      localStorage.setItem('smartnest_token', data.token);
      
      const { data: households } = await client.get('/api/auth/my-households/');
      if (!households || households.length === 0) {
        throw new Error('No household linked to this account.');
      }
      // First household for now — swap for a picker once multi-household UI exists
      localStorage.setItem('householdId', households[0].id);
      localStorage.setItem('householdName', households[0].name);

      navigate('/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.detail || err.message || 'Login failed. Check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-panel panel-card">
        <div className="auth-brand">
          <span className="auth-brand__dot" />
          <span className="label-eyebrow">SMARTNEST</span>
        </div>
        <h1 className="auth-title">Control Panel Access</h1>
        <p className="auth-subtitle">Sign in to arm, monitor, and manage your home.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-field">
            <span className="label-eyebrow">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="auth-field">
            <span className="label-eyebrow">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Connecting…' : 'Unlock Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}