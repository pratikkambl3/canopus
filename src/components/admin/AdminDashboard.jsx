import { useState } from 'react';
import { deleteTrack } from '../../services/tracksService';
import { signOut } from '../../services/authService';
import AddRecordForm from './AddRecordForm';

export default function AdminDashboard({ tracks, onTracksChange }) {
  const [showForm, setShowForm] = useState(false);
  const [editTrack, setEditTrack] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record permanently?')) return;
    setDeleting(id);
    try {
      await deleteTrack(id);
      onTracksChange();
    } catch (e) {
      alert('Delete failed. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (track) => {
    setEditTrack(track);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditTrack(null);
    onTracksChange();
  };

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-dashboard__header">
        <h1 className="admin-dashboard__title">Records</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-primary" onClick={() => { setEditTrack(null); setShowForm(true); }}>
            + Add Record
          </button>
          <button
            className="btn-ghost"
            onClick={signOut}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Track list */}
      {tracks.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 14 }}>
          No records yet. Add your first record.
        </p>
      ) : (
        tracks.map(track => (
          <div className="admin-track-row" key={track.id}>
            {track.artworkUrl ? (
              <img className="admin-track-row__thumb" src={track.artworkUrl} alt={track.title} loading="lazy" />
            ) : (
              <div
                className="admin-track-row__thumb"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ivory-mid)', color: 'var(--text-faint)', fontSize: 14 }}
              >
                ♫
              </div>
            )}
            <div className="admin-track-row__info">
              <h4>{track.title}</h4>
              <p>{track.version} · {track.genre} · {track.bpm} BPM</p>
            </div>
            <div className="admin-track-row__actions">
              <button className="btn-ghost" onClick={() => handleEdit(track)}>Edit</button>
              <button
                className="btn-danger"
                onClick={() => handleDelete(track.id)}
                disabled={deleting === track.id}
              >
                {deleting === track.id ? '…' : 'Delete'}
              </button>
            </div>
          </div>
        ))
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) handleFormClose(); }}>
          <div className="modal">
            <div className="modal__header">
              <h2 className="modal__title">{editTrack ? 'Edit Record' : 'Add Record'}</h2>
              <button className="modal__close" onClick={handleFormClose} aria-label="Close">×</button>
            </div>
            <AddRecordForm
              initialData={editTrack}
              onSuccess={handleFormClose}
              onCancel={handleFormClose}
            />
          </div>
        </div>
      )}
    </div>
  );
}
