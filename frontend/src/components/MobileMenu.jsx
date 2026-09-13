export default function MobileMenu({ onClose, onNavClick }) {
  return (
    <div className="mobile-menu" role="dialog" aria-label="Navigation menu">
      <button
        className="mobile-menu__close"
        onClick={onClose}
        aria-label="Close menu"
      >
        ×
      </button>

      <button
        className="mobile-menu__link"
        onClick={() => { onNavClick('radio'); onClose(); }}
      >
        Radio
      </button>
      <button
        className="mobile-menu__link"
        onClick={() => { onNavClick('records'); onClose(); }}
      >
        The Records
      </button>
      <button
        className="mobile-menu__link"
        onClick={() => { onNavClick('about'); onClose(); }}
      >
        About
      </button>
      <button
        className="mobile-menu__link"
        onClick={() => { onNavClick('club'); onClose(); }}
      >
        Enter the Club
      </button>
    </div>
  );
}
