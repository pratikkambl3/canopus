export default function ClubOverlay({ onClose, onNavClick }) {
  return (
    <div className="overlay" role="dialog" aria-label="Welcome to Golden Era">
      <div className="overlay__backdrop" onClick={onClose} />

      <button
        className="overlay__close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>

      <div className="overlay__content">
        <h2 className="overlay__title">Welcome to Golden Era</h2>
        <p className="overlay__subtitle">redefined by Canopus</p>

        <p className="overlay__text">
          A digital listening room for the sounds that defined an era.
          Settle in. The music is waiting.
        </p>

        <div className="overlay__actions">
          <button
            className="overlay__action-btn"
            onClick={() => { onNavClick('radio'); onClose(); }}
            aria-label="Enter Radio"
          >
            Enter Radio
          </button>
          <button
            className="overlay__action-btn"
            onClick={() => { onNavClick('records'); onClose(); }}
            aria-label="Explore Records"
          >
            Explore Records
          </button>
        </div>
      </div>
    </div>
  );
}
