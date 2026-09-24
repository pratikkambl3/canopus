export default function AboutOverlay({ onClose, onNavClick }) {
  return (
    <div className="overlay" role="dialog" aria-label="About Golden Era">
      <div className="overlay__backdrop" onClick={onClose} />

      <button
        className="overlay__close"
        onClick={onClose}
        aria-label="Close about"
      >
        ×
      </button>

      <div className="overlay__content">
        <h2 className="overlay__title">Golden Era</h2>
        <p className="overlay__subtitle">redefined by Canopus</p>

        <p className="overlay__text">
          A private digital listening room celebrating the sounds, records
          and atmosphere of India's Golden Era. Step inside a world where
          every note carries the warmth of a bygone time, and every record
          tells a story worth hearing again.
        </p>

        <div className="overlay__nav-links">
          <button
            className="overlay__nav-link"
            onClick={() => { onNavClick('radio'); onClose(); }}
          >
            Radio
          </button>
          <button
            className="overlay__nav-link"
            onClick={() => { onNavClick('records'); onClose(); }}
          >
            Records
          </button>
          <button
            className="overlay__nav-link"
            onClick={() => { onNavClick('listen'); onClose(); }}
          >
            Listen
          </button>
        </div>
      </div>
    </div>
  );
}
