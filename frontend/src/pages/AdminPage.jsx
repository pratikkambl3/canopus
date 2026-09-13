import { useState, useEffect } from 'react';
import { onAuthChange, signOut } from '../services/authService';
import { getRecords } from '../services/recordsService';
import AdminLogin from '../components/admin/AdminLogin';
import AdminDashboard from '../components/admin/AdminDashboard';

export default function AdminPage() {
  const [user, setUser]     = useState(undefined); // undefined = loading
  const [records, setRecords] = useState([]);

  // Auth state listener — mirrors the Firebase onAuthStateChanged API
  useEffect(() => {
    const unsub = onAuthChange(u => setUser(u));
    return unsub;
  }, []);

  // Load records when authenticated
  useEffect(() => {
    if (!user) return;
    loadRecords();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRecords = () => {
    getRecords().then(setRecords).catch(console.error);
  };

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
        <AdminLogin onLogin={loadRecords} />
      </div>
    );
  }

  // Authenticated → dashboard
  return (
    <div className="admin-page">
      <AdminDashboard records={records} onRecordsChange={loadRecords} />
    </div>
  );
}
