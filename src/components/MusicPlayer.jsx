import { useState } from 'react';
import { RADIO_STREAM_URL } from '../data/config';

/* ── SVG Icons (inline for zero dependencies) ── */

const IconPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <polygon points="6,3 20,12 6,21" />
  </svg>
);

const IconPause = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="3" width="4" height="18" rx="1" />
    <rect x="15" y="3" width="4" height="18" rx="1" />
  </svg>
);

const IconPrev = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="4" width="3" height="16" rx="1" />
    <polygon points="20,4 8,12 20,20" />
  </svg>
);

const IconNext = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <polygon points="4,4 16,12 4,20" />
    <rect x="18" y="4" width="3" height="16" rx="1" />
  </svg>
);

const IconVolume = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" stroke="none" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const IconVolumeMute = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" stroke="none" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

const IconShuffle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16,3 21,3 21,8" />
    <line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21,16 21,21 16,21" />
    <line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </svg>
);

/* ── Helpers ── */

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ── Component ── */

export default function MusicPlayer({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isShuffled,
  mode,
  radioStatus,
  audioError,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onStartRadio,
  onRetryRadio,
}) {
  const [isDragging, setIsDragging] = useState(false);

  const isRadio = mode === 'radio';
  const progressPercent =
    duration > 0 ? (currentTime / duration) * 100 : 0;

  /* Handle progress bar click */
  const handleProgressClick = (e) => {
    if (isRadio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  /* Handle progress bar drag */
  const handleProgressMouseDown = (e) => {
    if (isRadio) return;
    setIsDragging(true);
    handleProgressClick(e);

    const onMove = (ev) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (ev.clientX - rect.left) / rect.width)
      );
      onSeek(ratio * duration);
    };

    const onUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  /* Determine artwork */
  const artworkSrc = isRadio
    ? (currentTrack?.artwork || null)
    : (currentTrack?.artwork || null);

  /* Radio status text */
  const renderRadioStatus = () => {
    if (radioStatus === 'offline' || (!RADIO_STREAM_URL && !isPlaying)) {
      return (
        <>
          <p className="player__subtitle" style={{ color: 'var(--text-muted)' }}>
            Radio Offline
          </p>
        </>
      );
    }
    if (radioStatus === 'error' || audioError) {
      return (
        <>
          <p className="player__error-text">Unable to connect to the broadcast</p>
          <button
            className="player__retry-btn"
            onClick={() => onRetryRadio(RADIO_STREAM_URL)}
            aria-label="Retry radio connection"
          >
            Retry
          </button>
        </>
      );
    }
    return (
      <>
        <div className="player__status">
          <span className="player__on-air-dot" aria-hidden="true" />
          <span className="player__on-air-text">On Air</span>
        </div>
        <p className="player__subtitle">Broadcasting the sounds of the Golden Era</p>
      </>
    );
  };

  return (
    <div className="player fade-in-player" role="region" aria-label="Music player">
      {/* TOP ROW */}
      <div className="player__top">
        {/* Artwork */}
        <div className="player__artwork-wrap">
          {artworkSrc ? (
            <img
              className={`player__artwork${isPlaying ? ' player__artwork--spinning' : ''}`}
              src={artworkSrc}
              alt={isRadio ? 'Golden Era Radio' : currentTrack?.title}
              loading="lazy"
            />
          ) : (
            <div className={`player__artwork--placeholder${isPlaying ? ' player__artwork--placeholder-spinning' : ''}`} aria-hidden="true">♫</div>
          )}
          {isPlaying && <div className="player__artwork-groove" aria-hidden="true" />}
        </div>

        {/* Info */}
        <div className="player__info">
          <p className="player__title">
            {isRadio ? 'Golden Era Radio' : currentTrack?.title}
          </p>

          {isRadio ? (
            renderRadioStatus()
          ) : (
            <p className="player__meta">
              {currentTrack?.category} · {currentTrack?.bpm} BPM
            </p>
          )}
        </div>

        {/* Volume */}
        <div className="player__volume-section">
          <button
            className="player__vol-btn"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <IconVolumeMute /> : <IconVolume />}
          </button>
          <input
            type="range"
            className="player__volume-slider"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            aria-label="Volume"
            style={{
              background: `linear-gradient(to right, var(--gold) ${(isMuted ? 0 : volume) * 100}%, var(--bg-espresso) ${(isMuted ? 0 : volume) * 100}%)`,
            }}
          />
          <button
            className="player__mute-btn"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            style={{ display: 'none' }}
          >
            {isMuted ? <IconVolumeMute /> : <IconVolume />}
          </button>
        </div>
      </div>

      {/* CONTROLS ROW */}
      <div className="player__controls">
        {!isRadio && (
          <button
            className={`player__ctrl-btn player__ctrl-btn--shuffle ${
              isShuffled ? 'player__ctrl-btn--shuffle-active' : ''
            }`}
            onClick={onToggleShuffle}
            aria-label={isShuffled ? 'Disable shuffle' : 'Enable shuffle'}
            aria-pressed={isShuffled}
          >
            <IconShuffle />
          </button>
        )}

        {!isRadio && (
          <button
            className="player__ctrl-btn"
            onClick={onPrev}
            aria-label="Previous track"
          >
            <IconPrev />
          </button>
        )}

        <button
          className={`player__play-btn${isPlaying ? ' player__play-btn--active' : ''}`}
          onClick={() => {
            if (isRadio && !isPlaying) {
              onStartRadio(RADIO_STREAM_URL);
            } else {
              onTogglePlay();
            }
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <IconPause /> : <IconPlay />}
        </button>

        {!isRadio && (
          <button
            className="player__ctrl-btn"
            onClick={onNext}
            aria-label="Next track"
          >
            <IconNext />
          </button>
        )}
      </div>

      {/* PROGRESS BAR (records only) */}
      {!isRadio && (
        <div className="player__progress-section">
          <span className="player__time">{formatTime(currentTime)}</span>
          <div
            className="player__progress-bar"
            onClick={handleProgressClick}
            onMouseDown={handleProgressMouseDown}
            role="slider"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(currentTime)}
          >
            <div
              className="player__progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="player__time">{formatTime(duration)}</span>
        </div>
      )}
    </div>
  );
}
