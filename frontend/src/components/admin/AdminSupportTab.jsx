/* ================================================================
   CANOPUS — Admin Support Tab
   Manage customer support inquiries, status transitions, and communications.
   ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import { getSupportQueries, updateSupportQueryStatus } from '../../services/supportService';

export default function AdminSupportTab() {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState(null);

  const fetchQueries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSupportQueries(statusFilter);
      setQueries(data);
    } catch (err) {
      console.error('[AdminSupport] Fetch failed:', err);
      setError(err.message || 'Failed to load support inquiries.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      const updated = await updateSupportQueryStatus(id, newStatus);
      setQueries(prev => prev.map(q => q.id === id ? { ...q, status: updated.status } : q));
      if (selectedQuery?.id === id) {
        setSelectedQuery(prev => ({ ...prev, status: updated.status }));
      }
    } catch (err) {
      console.error('[AdminSupport] Update status failed:', err);
      alert(err.message || 'Failed to update query status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Open':
        return 'badge--open';
      case 'In Progress':
        return 'badge--progress';
      case 'Resolved':
        return 'badge--resolved';
      default:
        return '';
    }
  };

  return (
    <div className="admin-support-tab">
      {/* Header & Controls */}
      <div className="admin-support-header">
        <div>
          <h2 className="admin-section-title">Customer Support Queries</h2>
          <p className="admin-section-sub">
            Review incoming inquiries, track customer communication, and update issue resolutions.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="admin-support-filters" role="group" aria-label="Filter queries by status">
          {['ALL', 'Open', 'In Progress', 'Resolved'].map(filter => (
            <button
              key={filter}
              type="button"
              className={`filter-tab-btn${statusFilter === filter ? ' active' : ''}`}
              onClick={() => setStatusFilter(filter)}
            >
              {filter}
            </button>
          ))}
          <button
            type="button"
            className="btn-secondary admin-refresh-btn"
            onClick={fetchQueries}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-error-notice" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="admin-loading">Loading support queries…</div>
      ) : queries.length === 0 ? (
        <div className="admin-empty-card">
          <p>No support queries found for filter "{statusFilter}".</p>
        </div>
      ) : (
        <div className="admin-support-table-wrap">
          <table className="admin-support-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {queries.map(q => {
                const dateStr = new Date(q.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr key={q.id} className="admin-support-row">
                    <td className="support-cell-id">#{q.id}</td>
                    <td className="support-cell-date">{dateStr}</td>
                    <td className="support-cell-customer">
                      <strong>{q.name}</strong>
                      <span className="support-subtext">{q.email}</span>
                      {q.phone && <span className="support-subtext">{q.phone}</span>}
                    </td>
                    <td className="support-cell-subject">
                      <button
                        type="button"
                        className="support-subject-link"
                        onClick={() => setSelectedQuery(q)}
                      >
                        {q.subject}
                      </button>
                      <p className="support-msg-preview">
                        {q.message.length > 80 ? `${q.message.slice(0, 80)}…` : q.message}
                      </p>
                    </td>
                    <td className="support-cell-status">
                      <span className={`support-status-badge ${getStatusBadgeClass(q.status)}`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="support-cell-actions">
                      <select
                        className="support-status-select"
                        value={q.status}
                        onChange={(e) => handleStatusChange(q.id, e.target.value)}
                        disabled={updatingId === q.id}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal / Overlay */}
      {selectedQuery && (
        <div className="admin-modal-overlay" onClick={() => setSelectedQuery(null)}>
          <div className="admin-modal-content" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Support Query #{selectedQuery.id}</h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setSelectedQuery(null)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="modal-info-grid">
                <div>
                  <label>Customer Name</label>
                  <p><strong>{selectedQuery.name}</strong></p>
                </div>
                <div>
                  <label>Email Address</label>
                  <p><a href={`mailto:${selectedQuery.email}`}>{selectedQuery.email}</a></p>
                </div>
                <div>
                  <label>Phone Number</label>
                  <p>{selectedQuery.phone || 'Not provided'}</p>
                </div>
                <div>
                  <label>Submitted At</label>
                  <p>{new Date(selectedQuery.createdAt).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <label>Current Status</label>
                  <p>
                    <span className={`support-status-badge ${getStatusBadgeClass(selectedQuery.status)}`}>
                      {selectedQuery.status}
                    </span>
                  </p>
                </div>
              </div>

              <div className="modal-message-section">
                <label>Subject</label>
                <h4 className="modal-subject-title">{selectedQuery.subject}</h4>

                <label>Customer Message</label>
                <div className="modal-message-box">
                  {selectedQuery.message}
                </div>
              </div>

              <div className="modal-actions-bar">
                <span>Update Status:</span>
                <div className="modal-status-buttons">
                  {['Open', 'In Progress', 'Resolved'].map(st => (
                    <button
                      key={st}
                      type="button"
                      className={`btn-sm-status${selectedQuery.status === st ? ' active' : ''}`}
                      onClick={() => handleStatusChange(selectedQuery.id, st)}
                      disabled={updatingId === selectedQuery.id || selectedQuery.status === st}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
