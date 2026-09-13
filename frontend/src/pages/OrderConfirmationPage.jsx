/* ================================================================
   CANOPUS — Order Confirmation Page
   Editorial order status & receipt verification page.
   ================================================================ */

import { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { getOrder } from '../services/storeService';
import { IconCheck } from '../components/shared/Icons';

export default function OrderConfirmationPage() {
  const { orderId } = useParams();
  const location    = useLocation();

  const [order, setOrder]     = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!order);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = () => {
    setRefreshing(true);
    getOrder(orderId)
      .then(data => { if (data) setOrder(data); })
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchStatus();
    // Poll status every 15 seconds in case admin approves while user is on page
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [orderId]);

  if (loading && !order) {
    return (
      <main className="confirmation-page page">
        <div className="confirmation-card">
          <p>Loading order details…</p>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="confirmation-page page">
        <div className="confirmation-card">
          <h2>Order Not Found</h2>
          <p>We could not find an order matching this reference.</p>
          <Link to="/products" className="btn-primary">Browse Products</Link>
        </div>
      </main>
    );
  }

  const isPaid     = order.payment_status === 'PAID';
  const isRejected = order.payment_status === 'REJECTED';
  const isPending  = !isPaid && !isRejected;

  return (
    <main className="confirmation-page page">
      <div className="confirmation-card">
        {/* Brand */}
        <p className="confirmation-card__eyebrow">CANOPUS</p>

        {isPaid ? (
          <>
            <div className="confirmation-badge confirmation-badge--paid">
              <IconCheck /> Payment Verified
            </div>
            <h1 className="confirmation-card__title">Your Album Is Ready</h1>
            <p className="confirmation-card__lead">
              Thank you, <strong>{order.customer_name || 'Customer'}</strong>. Your payment has been verified and your download link has been emailed to <strong>{order.customer_email}</strong>.
            </p>
          </>
        ) : isRejected ? (
          <>
            <div className="confirmation-badge confirmation-badge--rejected">
              Verification Unsuccessful
            </div>
            <h1 className="confirmation-card__title">Payment Issue</h1>
            <p className="confirmation-card__lead">
              We were unable to verify your payment reference. Please contact CANOPUS support or place a new order.
            </p>
          </>
        ) : (
          <>
            <div className="confirmation-badge confirmation-badge--pending">
              Pending Verification
            </div>
            <h1 className="confirmation-card__title">Thank You</h1>
            <p className="confirmation-card__lead">
              Your order has been received and is waiting for bank verification.
            </p>
          </>
        )}

        {/* Order Details Receipt Box */}
        <div className="confirmation-receipt">
          <div className="confirmation-receipt__row">
            <span>Order Number</span>
            <strong>#{order.order_number || order.orderNumber}</strong>
          </div>
          <div className="confirmation-receipt__row">
            <span>Customer Email</span>
            <span>{order.customer_email || order.customerEmail}</span>
          </div>
          {order.payment_reference && (
            <div className="confirmation-receipt__row">
              <span>Payment UTR</span>
              <code>{order.payment_reference}</code>
            </div>
          )}
          <div className="confirmation-receipt__row confirmation-receipt__row--total">
            <span>Total Paid</span>
            <strong>₹{order.total_amount || order.totalAmount}</strong>
          </div>
        </div>

        {/* Status explanation */}
        <div className="confirmation-card__notice">
          {isPaid ? (
            <p>
              Please check your inbox (and spam folder) for the secure download link. The link remains active for 7 days.
            </p>
          ) : isRejected ? (
            <p>
              If your payment was debited from your account, please reach out to our team at <strong>orders@canopus.local</strong> with your transaction receipt.
            </p>
          ) : (
            <p>
              Our team manually verifies every UPI reference with our bank statement. Once approved, the album ZIP download link will be dispatched automatically to your email.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="confirmation-card__actions">
          <button
            className="btn-ghost"
            onClick={fetchStatus}
            disabled={refreshing}
          >
            {refreshing ? 'Checking Status…' : 'Refresh Status'}
          </button>
          <Link to="/products" className="btn-secondary">
            Explore More Music
          </Link>
        </div>
      </div>
    </main>
  );
}
