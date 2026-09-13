import { useState, useRef, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAudio } from '../../context/AudioContext';
import { useCart } from '../../context/CartContext';
import { IconMenu, IconClose, IconBag } from '../shared/Icons';

export default function Header() {
  const { state } = useAudio();
  const { cartCount, openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const isLive = state.isPlaying;

  // Close mobile menu on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [menuOpen]);

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <>
      <header className="header" role="banner">
        {/* Wordmark */}
        <Link to="/" className="header__wordmark" aria-label="CANOPUS — Home">
          CANOPUS
        </Link>

        {/* Desktop nav */}
        <nav className="header__nav" aria-label="Main navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `header__nav-link${isActive ? ' active' : ''}`
            }
          >
            Radio
          </NavLink>
          <NavLink
            to="/records"
            className={({ isActive }) =>
              `header__nav-link${isActive ? ' active' : ''}`
            }
          >
            The Records
          </NavLink>
          <NavLink
            to="/products"
            className={({ isActive }) =>
              `header__nav-link${isActive ? ' active' : ''}`
            }
          >
            Products
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              `header__nav-link${isActive ? ' active' : ''}`
            }
          >
            About
          </NavLink>
          <NavLink
            to="/support"
            className={({ isActive }) =>
              `header__nav-link${isActive ? ' active' : ''}`
            }
          >
            Support
          </NavLink>
        </nav>

        {/* Right side: Cart + Status + Mobile menu */}
        <div className="header__right">
          {/* Cart button */}
          <button
            className="header__cart-btn"
            onClick={openCart}
            aria-label={`Shopping cart with ${cartCount} items`}
          >
            <IconBag />
            {cartCount > 0 && (
              <span className="header__cart-badge" aria-hidden="true">
                {cartCount}
              </span>
            )}
          </button>

          {/* Online status */}
          {isLive && (
            <div className="header__status" aria-live="polite">
              <span className="header__status-dot" aria-hidden="true" />
              <span>On Air</span>
            </div>
          )}

          {/* Mobile menu button */}
          <button
            className="header__mobile-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <span className="header__mobile-line" />
            <span className="header__mobile-line" />
            <span className="header__mobile-line" />
          </button>
        </div>
      </header>

      {/* Mobile Nav Overlay */}
      {menuOpen && (
        <div className="mobile-nav" role="dialog" aria-label="Navigation menu" aria-modal="true">
          <button
            className="mobile-nav__close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            <IconClose />
          </button>
          <Link
            to="/"
            className="mobile-nav__link"
            onClick={() => setMenuOpen(false)}
          >
            Radio
          </Link>
          <Link
            to="/records"
            className="mobile-nav__link"
            onClick={() => setMenuOpen(false)}
          >
            The Records
          </Link>
          <Link
            to="/products"
            className="mobile-nav__link"
            onClick={() => setMenuOpen(false)}
          >
            Products
          </Link>
          <Link
            to="/about"
            className="mobile-nav__link"
            onClick={() => setMenuOpen(false)}
          >
            About
          </Link>
          <Link
            to="/support"
            className="mobile-nav__link"
            onClick={() => setMenuOpen(false)}
          >
            Support
          </Link>
        </div>
      )}
    </>
  );
}
