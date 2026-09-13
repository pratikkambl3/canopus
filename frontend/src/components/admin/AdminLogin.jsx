import { useState } from 'react';
import { signIn } from '../../services/authService';

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      onLogin?.();
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <form className="admin-login__card" onSubmit={handleSubmit} noValidate>
        <h1 className="admin-login__title">CANOPUS</h1>
        <p className="admin-login__subtitle">Admin — Sign in to continue</p>

        <div className="form-field">
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            name="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button
          type="submit"
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
          disabled={loading}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <button
          type="button"
          className="btn-ghost"
          style={{ width: '100%', justifyContent: 'center', marginTop: 8, fontSize: 12 }}
          onClick={() => {
            setEmail('admin@canopus.local');
            setPassword('canopus2026');
          }}
        >
          Quick Fill Admin Credentials
        </button>
      </form>
    </div>
  );
}
