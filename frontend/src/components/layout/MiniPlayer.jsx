import { useState, useRef, useCallback } from 'react';
import { useAudio } from '../../context/AudioContext';
import {
  IconPlay, IconPause, IconPrev, IconNext,
  IconFastForward, IconRewind,
  IconShuffle, IconVolume, IconVolumeMute,
  formatTime,
} from '../shared/Icons';

/* ── Seek-bar with full mouse & touch drag support ── */
function SeekBar({ currentTime, duration, onSeek }) {
  const barRef = useRef(null);
  const dragging = useRef(false);

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const posFromEvent = useCallback((e) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleMouseDown = (e) => {
    if (!duration) return;
    dragging.current = true;
    onSeek(posFromEvent(e) * duration);

    const onMove = (ev) => {
      if (dragging.current) onSeek(posFromEvent(ev) * duration);
    };
    const onUp = (ev) => {
      if (dragging.current) {
        onSeek(posFromEvent(ev) * duration);
        dragging.current = false;
      }
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleTouchStart = (e) => {
    if (!duration) return;
    dragging.current = true;
    onSeek(posFromEvent(e) * duration);

    const onTouchMove = (ev) => {
      if (dragging.current) onSeek(posFromEvent(ev) * duration);
    };
    const onTouchEnd = (ev) => {
      if (dragging.current) {
        if (ev.changedTouches && ev.changedTouches[0]) {
          onSeek(posFromEvent(ev.changedTouches[0]) * duration);
        }
        dragging.current = false;
      }
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
  };

  return (
    <div
      ref={barRef}
      className="gp-seek"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      role="slider"
      aria-label="Playback position"
      aria-valuemin={0}
      aria-valuemax={Math.floor(duration) || 0}
      aria-valuenow={Math.floor(currentTime) || 0}
      tabIndex={0}
      onKeyDown={(e) => {
        if (!duration) return;
        if (e.key === 'ArrowRight') onSeek(Math.min(duration, currentTime + 5));
        if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentTime - 5));
      }}
    >
      <div className="gp-seek__fill" style={{ width: `${pct}%` }} />
      <div className="gp-seek__thumb" style={{ left: `${pct}%` }} />
    </div>
  );
}

/* ── Volume control ── */
function VolumeControl({ volume, isMuted, onVolumeChange, onToggleMute }) {
  const [hovered, setHovered] = useState(false);
  const displayVol = isMuted ? 0 : volume;

  return (
    <div
      className="gp-vol"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="gp-icon-btn"
        onClick={onToggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <IconVolumeMute /> : <IconVolume />}
      </button>
      <div className={`gp-vol__slider-wrap${hovered ? ' gp-vol__slider-wrap--open' : ''}`}>
        <input
          type="range"
          className="gp-vol__slider"
          min="0"
          max="1"
          step="0.02"
          value={displayVol}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          aria-label="Volume"
          style={{
            background: `linear-gradient(to right, var(--text-primary) ${displayVol * 100}%, var(--ivory-dark) ${displayVol * 100}%)`,
          }}
        />
      </div>
    </div>
  );
}

/* ── Marquee title for long names ── */
function TrackTitle({ title }) {
  return (
    <div className="gp-track-title">
      <span className="gp-track-title__text">{title}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   GLOBAL PLAYER — main component
   Appears at the bottom of the screen whenever a track is loaded.
   Supports touch-friendly mobile layout with scrub bar & fast forward.
   ══════════════════════════════════════════════════════════════════ */
export default function MiniPlayer() {
  const { state, actions } = useAudio();
  const {
    currentTrack, isPlaying, currentTime, duration,
    volume, isMuted, shuffleEnabled,
  } = state;

  const topBarRef = useRef(null);

  /* Don't render if nothing is loaded */
  if (!currentTrack) return null;

  const artworkSrc = currentTrack.artworkUrl || currentTrack.artwork || null;

  /* Quick Seek Actions */
  const handleFastForward = (e) => {
    e?.stopPropagation();
    if (duration > 0) {
      actions.seek(Math.min(duration, currentTime + 10));
    }
  };

  const handleRewind = (e) => {
    e?.stopPropagation();
    actions.seek(Math.max(0, currentTime - 10));
  };

  /* Interactive Top Bar scrub */
  const handleTopClick = (e) => {
    if (!duration || !topBarRef.current) return;
    const rect = topBarRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    actions.seek(ratio * duration);
  };

  return (
    <div className="global-player" role="region" aria-label="Now Playing">
      {/* Top interactive hairline seek bar */}
      <div
        ref={topBarRef}
        className="global-player__top-bar"
        onClick={handleTopClick}
        onTouchStart={handleTopClick}
        role="slider"
        aria-label="Fast seek track"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration) || 0}
        aria-valuenow={Math.floor(currentTime) || 0}
      >
        <div
          className="global-player__top-progress"
          style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
          aria-hidden="true"
        />
      </div>

      <div className="global-player__inner">
        {/* LEFT / ROW 2 LEFT — Artwork + Track info */}
        <div className="global-player__track">
          <div className="global-player__artwork-wrap">
            {artworkSrc ? (
              <img
                className={`global-player__artwork${isPlaying ? ' global-player__artwork--spin' : ''}`}
                src={artworkSrc}
                alt={currentTrack.title}
                loading="lazy"
              />
            ) : (
              <div className={`global-player__artwork global-player__artwork--placeholder${isPlaying ? ' global-player__artwork--spin' : ''}`}>
                ♫
              </div>
            )}
          </div>

          <div className="global-player__info">
            <TrackTitle title={currentTrack.title} />
            <p className="global-player__meta">
              {[currentTrack.artist || 'CANOPUS', currentTrack.version || currentTrack.originalTitle, currentTrack.bpm ? `${currentTrack.bpm} BPM` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>

        {/* CENTER ROW 1 / MOBILE ROW 2 RIGHT — Controls */}
        <div className="global-player__controls">
          <button
            type="button"
            className={`gp-icon-btn gp-shuffle-btn${shuffleEnabled ? ' gp-shuffle-btn--active' : ''}`}
            onClick={actions.toggleShuffle}
            aria-label={shuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'}
            aria-pressed={shuffleEnabled}
            title="Shuffle"
          >
            <IconShuffle />
          </button>

          <button
            type="button"
            className="gp-icon-btn gp-skip-btn"
            onClick={actions.prev}
            aria-label="Previous track"
            title="Previous track"
          >
            <IconPrev />
          </button>

          <button
            type="button"
            className="gp-icon-btn gp-ff-btn"
            onClick={handleRewind}
            aria-label="Rewind 10 seconds"
            title="Rewind 10s"
          >
            <IconRewind />
          </button>

          <button
            type="button"
            className={`gp-play-btn${isPlaying ? ' gp-play-btn--active' : ''}`}
            onClick={actions.togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <IconPause /> : <IconPlay />}
          </button>

          <button
            type="button"
            className="gp-icon-btn gp-ff-btn"
            onClick={handleFastForward}
            aria-label="Fast forward 10 seconds"
            title="Fast forward 10s"
          >
            <IconFastForward />
          </button>

          <button
            type="button"
            className="gp-icon-btn gp-skip-btn"
            onClick={actions.next}
            aria-label="Next track"
            title="Next track"
          >
            <IconNext />
          </button>
        </div>

        {/* CENTER ROW 2 / MOBILE ROW 1 — Interactive seek bar with live time */}
        <div className="global-player__seek-row">
          <span className="gp-time">{formatTime(currentTime)}</span>
          <SeekBar
            currentTime={currentTime}
            duration={duration}
            onSeek={actions.seek}
          />
          <span className="gp-time">{formatTime(duration)}</span>
        </div>

        {/* RIGHT — Volume */}
        <div className="global-player__right">
          <VolumeControl
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={actions.setVolume}
            onToggleMute={actions.toggleMute}
          />
        </div>
      </div>
    </div>
  );
}
