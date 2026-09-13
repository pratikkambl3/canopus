export default function RecordsOverlay({ tracks, onSelectTrack, onClose, currentTrackIndex, isPlaying, mode }) {
  const isRecordsMode = mode === 'records';

  return (
    <div className="records-overlay" role="dialog" aria-label="The Records">
      <div className="records-overlay__backdrop" onClick={onClose} />

      <button
        className="overlay__close"
        onClick={onClose}
        aria-label="Close records"
      >
        ×
      </button>

      <div className="records-overlay__content">
        <h2 className="records-overlay__title">The Records</h2>
        <p className="records-overlay__subtitle">
          A curated collection from the Golden Era
        </p>

        <div className="records-grid">
          {tracks.map((track, idx) => {
            const isActive = isRecordsMode && idx === currentTrackIndex;
            return (
              <button
                key={track.id}
                className={`record-card${isActive ? ' record-card--active' : ''}`}
                onClick={() => {
                  onSelectTrack(idx);
                  onClose();
                }}
                aria-label={`Play ${track.title}`}
                aria-pressed={isActive}
              >
                <div className="record-card__artwork-wrap">
                  {track.artwork ? (
                    <img
                      className={`record-card__artwork${isActive && isPlaying ? ' record-card__artwork--spinning' : ''}`}
                      src={track.artwork}
                      alt={track.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="record-card__artwork--placeholder" aria-hidden="true">♫</div>
                  )}

                  {/* Play icon overlay on hover / now playing indicator */}
                  <div className="record-card__hover-overlay" aria-hidden="true">
                    {isActive && isPlaying ? (
                      <div className="record-card__playing-bars">
                        <span /><span /><span /><span />
                      </div>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="record-card__play-icon">
                        <polygon points="6,3 20,12 6,21" />
                      </svg>
                    )}
                  </div>
                </div>
                <p className="record-card__title">{track.title}</p>
                <p className="record-card__meta">
                  {track.category} · {track.bpm} BPM
                </p>
                <p className="record-card__year">{track.year}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
