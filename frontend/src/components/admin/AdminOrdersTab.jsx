/* ================================================================
   CANOPUS — Admin Orders Tab
   Review customer orders, verify UTR payments, approve orders to
   dispatch secure download links, and manage digital fulfillments.
   ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import { getOrders, approveOrder, rejectOrder, resendOrderEmail } from '../../services/adminStoreService';
import { IconCheck, IconCopy } from '../shared/Icons';

export default function AdminOrdersTab() {
  const [orders, setOrders]       = useState([]);
  const [filter, setFilter]       = useState('ALL'); // ALL, PENDING, PAID, REJECTED
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [actionId, setActionId]   = useState(null); // id currently being approved/rejected
  const [toast, setToast]         = useState(null);
  const [copiedUtr, setCopiedUtr] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrders(filter);
      setOrders(data);
    } catch (err) {
      setError(err.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleApprove = async (order) => {
    if (!window.confirm(`Approve payment of ₹${order.total_amount} for Order #${order.order_number}? This will generate download tokens and dispatch the album ZIP to ${order.customer_email}.`)) {
      return;
    }
    setActionId(order.id);
    try {
      await approveOrder(order.id);
      showToast(`Order #${order.order_number} approved and download links dispatched.`);
      loadOrders();
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (order) => {
    const reason = window.prompt(`Enter rejection reason for Order #${order.order_number}:`, 'Payment reference (UTR) could not be verified.');
    if (reason === null) return;
    setActionId(order.id);
    try {
      await rejectOrder(order.id, reason);
      showToast(`Order #${order.order_number} marked as rejected.`, 'info');
      loadOrders();
    } catch (err) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setActionId(null);
    }
  };

  const handleResend = async (order) => {
    setActionId(order.id);
    try {
      await resendOrderEmail(order.id);
      showToast(`Download link email resent to ${order.customer_email}.`);
    } catch (err) {
      alert(`Resend error: ${err.message}`);
    } finally {
      setActionId(null);
    }
  };

  const handleCopyUtr = (utr) => {
    if (!utr) return;
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  // Stats
  const totalRevenue = orders
    .filter(o => o.payment_status === 'PAID')
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const pendingCount = orders.filter(o => o.payment_status === 'PENDING').length;

  return (
    <div className="admin-orders-tab">
      {/* Toast */}
      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)}>×</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="admin-orders-kpis">
        <div className="admin-kpi-card">
          <span className="admin-kpi-card__label">Pending Review</span>
          <span className="admin-kpi-card__value" style={{ color: pendingCount > 0 ? '#b45309' : 'inherit' }}>
            {pendingCount}
          </span>
        </div>
        <div className="admin-kpi-card">
          <span className="admin-kpi-card__label">Total Orders</span>
          <span className="admin-kpi-card__value">{orders.length}</span>
        </div>
        <div className="admin-kpi-card">
          <span className="admin-kpi-card__label">Verified Revenue</span>
          <span className="admin-kpi-card__value">₹{totalRevenue.toLocaleString()}</span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="admin-orders-controls">
        <div className="admin-orders-filters">
          {['ALL', 'PENDING', 'PAID', 'REJECTED'].map((f) => (
            <button
              key={f}
              className={`filter-pill${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <button className="btn-ghost" onClick={loadOrders} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="alert-error" style={{ marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Table / List */}
      {loading && orders.length === 0 ? (
        <div className="admin-loading-state">Loading customer orders…</div>
      ) : orders.length === 0 ? (
        <div className="admin-empty-state">
          <p>No orders found matching this filter.</p>
        </div>
      ) : (
        <div className="admin-orders-table-wrap">
          <table className="admin-orders-table">
            <thead>
              <tr>
                <th>Order # & Date</th>
                <th>Customer</th>
                <th>Albums</th>
                <th>Total</th>
                <th>Payment Ref (UTR)</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isBusy = actionId === order.id;
                const formattedDate = new Date(order.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr key={order.id} className={`order-row order-row--${order.payment_status.toLowerCase()}`}>
                    <td>
                      <div className="order-number">{order.order_number}</div>
                      <div className="order-date">{formattedDate}</div>
                    </td>
                    <td>
                      <div className="order-customer-name">{order.customer_name}</div>
                      <div className="order-customer-contact">
                        <a href={`mailto:${order.customer_email}`}>{order.customer_email}</a>
                        {order.customer_phone && <span> · {order.customer_phone}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="order-items-summary">
                        {order.items && order.items.length > 0 ? (
                          order.items.map((item, i) => (
                            <span key={i} className="order-item-badge">
                              {item.title_snapshot}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="order-amount">₹{order.total_amount}</div>
                    </td>
                    <td>
                      {order.payment_reference ? (
                        <div className="order-utr-box">
                          <code>{order.payment_reference}</code>
                          <button
                            type="button"
                            className="btn-icon-copy"
                            onClick={() => handleCopyUtr(order.payment_reference)}
                            title="Copy UTR reference"
                          >
                            {copiedUtr === order.payment_reference ? <IconCheck /> : <IconCopy />}
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-faint)' }}>None</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge status-badge--${order.payment_status.toLowerCase()}`}>
                        {order.payment_status}
                      </span>
                      {order.payment_status === 'REJECTED' && order.admin_notes && (
                        <div className="order-rejection-note" title={order.admin_notes}>
                          {order.admin_notes}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="order-row-actions">
                        {order.payment_status === 'PENDING' && (
                          <>
                            <button
                              className="btn-primary btn-sm"
                              onClick={() => handleApprove(order)}
                              disabled={isBusy}
                            >
                              {isBusy ? 'Processing…' : 'Approve & Send'}
                            </button>
                            <button
                              className="btn-danger btn-sm"
                              onClick={() => handleReject(order)}
                              disabled={isBusy}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {order.payment_status === 'PAID' && (
                          <button
                            className="btn-ghost btn-sm"
                            onClick={() => handleResend(order)}
                            disabled={isBusy}
                            title="Resend email with download links"
                          >
                            {isBusy ? 'Sending…' : 'Resend Email'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
