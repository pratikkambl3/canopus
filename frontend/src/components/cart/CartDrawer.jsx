/* ================================================================
   CANOPUS — Cart Drawer Component
   Minimalist, warm ivory slide-out cart panel.
   ================================================================ */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { IconClose } from '../shared/Icons';

export default function CartDrawer() {
  const { cartItems, isCartOpen, closeCart, removeFromCart, cartTotal, cartCount, refreshCartPrices } = useCart();
  const navigate = useNavigate();

  // Refresh latest prices from server whenever cart drawer opens
  useEffect(() => {
    if (isCartOpen && refreshCartPrices) {
      refreshCartPrices();
    }
  }, [isCartOpen, refreshCartPrices]);

  // Close on Escape key
  useEffect(() => {
    if (!isCartOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeCart();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCartOpen, closeCart]);

  if (!isCartOpen) return null;

  const handleCheckout = () => {
    closeCart();
    navigate('/checkout');
  };

  return (
    <div className="cart-overlay" role="dialog" aria-modal="true" aria-label="Shopping Cart">
      {/* Backdrop */}
      <div className="cart-overlay__backdrop" onClick={closeCart} />

      {/* Drawer */}
      <div className="cart-drawer">
        <div className="cart-drawer__header">
          <div className="cart-drawer__title-wrap">
            <span className="cart-drawer__eyebrow">YOUR SELECTION</span>
            <h2 className="cart-drawer__title">Cart ({cartCount})</h2>
          </div>
          <button className="cart-drawer__close" onClick={closeCart} aria-label="Close cart">
            <IconClose />
          </button>
        </div>

        {cartItems.length === 0 ? (
          <div className="cart-drawer__empty">
            <p className="cart-drawer__empty-text">Your cart is currently empty.</p>
            <p className="cart-drawer__empty-sub">Explore the digital collection to add albums.</p>
            <button
              className="btn-secondary"
              onClick={() => { closeCart(); navigate('/products'); }}
            >
              Browse Products
            </button>
          </div>
        ) : (
          <>
            <div className="cart-drawer__items" role="list">
              {cartItems.map(item => (
                <div key={item.id} className="cart-item" role="listitem">
                  <div className="cart-item__artwork-wrap">
                    {item.artworkUrl ? (
                      <img src={item.artworkUrl} alt={item.title} className="cart-item__artwork" />
                    ) : (
                      <div className="cart-item__artwork cart-item__artwork--placeholder">♫</div>
                    )}
                  </div>

                  <div className="cart-item__info">
                    <h4 className="cart-item__title">{item.title}</h4>
                    {item.artist && <p className="cart-item__artist">{item.artist}</p>}
                    <p className="cart-item__format">Digital Album · ZIP Download</p>
                    <span className="cart-item__price">₹{item.price}</span>
                  </div>

                  <button
                    className="cart-item__remove"
                    onClick={() => removeFromCart(item.id)}
                    aria-label={`Remove ${item.title} from cart`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="cart-drawer__footer">
              <div className="cart-drawer__summary">
                <div className="cart-drawer__row">
                  <span>Subtotal</span>
                  <span>₹{cartTotal}</span>
                </div>
                <div className="cart-drawer__row cart-drawer__row--total">
                  <span>Total</span>
                  <strong>₹{cartTotal}</strong>
                </div>
              </div>

              <button
                className="btn-primary cart-drawer__checkout-btn"
                onClick={handleCheckout}
              >
                Proceed to Checkout — ₹{cartTotal}
              </button>

              <p className="cart-drawer__note">
                Immediate email delivery upon manual UPI payment verification.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
