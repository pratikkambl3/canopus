import { useState, useEffect } from 'react';
import { onAuthChange } from '../services/authService';
import { getTracks } from '../services/tracksService';
import { isFirebaseConfigured } from '../services/firebase';
import AdminLogin from '../components/admin/AdminLogin';
import AdminDashboard from '../components/admin/AdminDashboard';

export default function AdminPage() {
  const [user, setUser]     = useState(undefined); // undefined = loading
  const [tracks, setTracks] = useState([]);

  // Auth state listener
  useEffect(() => {
    const unsub = onAuthChange(u => setUser(u));
    return unsub;
  }, []);

  // Load tracks when authenticated
  useEffect(() => {
    if (!user) return;
    loadTracks();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTracks = () => {
    getTracks().then(setTracks).catch(console.error);
  };

  // Firebase not configured
  if (!isFirebaseConfigured()) {
    return (
      <div className="admin-page">
        <div className="admin-login">
          <div className="admin-login__card">
            <h1 className="admin-login__title">CANOPUS Admin</h1>
            <p className="admin-login__subtitle" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Firebase is not configured. Add your credentials to{' '}
              <code style={{ fontSize: 12, background: 'var(--ivory-mid)', padding: '2px 6px', borderRadius: 2 }}>
                .env.local
              </code>{' '}
              and restart the dev server.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading auth state
  if (user === undefined) {
    return (
      <div className="admin-page">
        <div className="admin-login">
          <p style={{ color: 'var(--text-muted)', fontSize: 14, fontStyle: 'italic' }}>Loading…</p>
        </div>
      </div>
    );
  }

  // Not authenticated → login
  if (!user) {
    return (
      <div className="admin-page">
        <AdminLogin onLogin={loadTracks} />
      </div>
    );
  }

  // Authenticated → dashboard
  return (
    <div className="admin-page">
      <AdminDashboard tracks={tracks} onTracksChange={loadTracks} />
    </div>
  );
}
