/* ================================================================
   CANOPUS — Integrated Player Component
   High-fidelity audio controller designed for embedding inside
   RecordDetailsOverlay ('overlay') and ProductDetailsPage ('inline').
   Provides seamless seeking, track navigation, fast-forwarding,
   and visual feedback across all devices including mobile phones.
   ================================================================ */

import { useState, useRef, useCallback, memo } from 'react';
import { useAudio } from '../../context/AudioContext';
import {
  IconPlay, IconPause, IconPrev, IconNext,
  IconFastForward, IconRewind,
  IconShuffle, IconVolume, IconVolumeMute,
  formatTime,
} from './Icons';

/* ── Interactive Seek Bar with Mouse & Touch Drag Support ── */
function SeekBar({ currentTime, duration, onSeek, className = '' }) {
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
      className={`int-seek ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      role="slider"
      aria-label="Seek track"
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
      <div className="int-seek__track">
        <div className="int-seek__fill" style={{ width: `${pct}%` }} />
        <div className="int-seek__thumb" style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Volume Control ── */
function VolumeControl({ volume, isMuted, onVolumeChange, onToggleMute }) {
  const [hovered, setHovered] = useState(false);
  const displayVol = isMuted ? 0 : volume;

  return (
    <div
      className="int-vol"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="int-icon-btn int-vol__btn"
        onClick={onToggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <IconVolumeMute /> : <IconVolume />}
      </button>
      <div className={`int-vol__slider-wrap${hovered ? ' int-vol__slider-wrap--open' : ''}`}>
        <input
          type="range"
          className="int-vol__slider"
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

/* ── Animated Equalizer Wave Bars ── */
function EqualizerBars({ isPlaying }) {
  return (
    <span className={`int-eq${isPlaying ? ' int-eq--playing' : ''}`} aria-hidden="true">
      <span /><span /><span /><span />
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
   IntegratedPlayer Component
   Props:
   - variant: 'overlay' (fixed inside record modal) or 'inline' (editorial product card)
   - subtitle: optional custom subtitle or section title
   ══════════════════════════════════════════════════════════════════ */
function IntegratedPlayerComponent({ variant = 'overlay', subtitle = null }) {
  const { state, actions } = useAudio();
  const {
    currentTrack, isPlaying, currentTime, duration,
    volume, isMuted, shuffleEnabled,
  } = state;

  if (!currentTrack) return null;

  const artworkSrc = currentTrack.artworkUrl || currentTrack.artwork || null;

  const metaParts = [
    currentTrack.artist || 'CANOPUS',
    currentTrack.version || currentTrack.originalTitle,
    currentTrack.bpm && Number(currentTrack.bpm) > 0 ? `${currentTrack.bpm} BPM` : null,
    currentTrack.key,
  ].filter(Boolean);

  /* Quick seek actions */
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

  /* ─────────────────────────────────────────────────────────
     VARIANT A: 'inline' (embedded inside ProductDetailsPage)
     ───────────────────────────────────────────────────────── */
  if (variant === 'inline') {
    return (
      <aside
        className="int-player int-player--inline"
        role="region"
        aria-label="Integrated Player Console"
      >

        {/* Card Header */}
        <div className="int-player__header">
          <div className="int-player__header-left">
            <span className="int-badge">
              <EqualizerBars isPlaying={isPlaying} />
              {isPlaying ? 'NOW PLAYING' : 'AUDIO READY'}
            </span>
            <span className="int-badge-label">
              {subtitle || currentTrack.albumTitle || 'CANOPUS ARCHIVE'}
            </span>
          </div>
          <div className="int-player__header-right">
            <span className="int-time-pill">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Seek Bar Row */}
        <div className="int-player__seek-row">
          <span className="int-time-text">{formatTime(currentTime)}</span>
          <SeekBar
            currentTime={currentTime}
            duration={duration}
            onSeek={actions.seek}
          />
          <span className="int-time-text">{formatTime(duration)}</span>
        </div>

        {/* Card Main Row: Track Details + Controls + Volume */}
        <div className="int-player__main-row">
          {/* Left: Artwork + Track details */}
          <div className="int-player__track">
            <div className="int-player__art-wrap">
              {artworkSrc ? (
                <img
                  src={artworkSrc}
                  alt={currentTrack.title}
                  className={`int-player__art${isPlaying ? ' int-player__art--spin' : ''}`}
                  loading="lazy"
                />
              ) : (
                <div className={`int-player__art int-player__art--placeholder${isPlaying ? ' int-player__art--spin' : ''}`}>
                  ♫
                </div>
              )}
            </div>
            <div className="int-player__info">
              <p className="int-player__title">{currentTrack.title}</p>
              {metaParts.length > 0 && (
                <p className="int-player__meta">{metaParts.join(' · ')}</p>
              )}
            </div>
          </div>

          {/* Controls: Prev, Rewind 10s, Play/Pause, Fast-Forward 10s, Next, Shuffle */}
          <div className="int-player__controls">
            <button
              type="button"
              className={`int-icon-btn int-shuffle-btn${shuffleEnabled ? ' int-shuffle-btn--active' : ''}`}
              onClick={actions.toggleShuffle}
              aria-label={shuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'}
              aria-pressed={shuffleEnabled}
              title="Shuffle"
            >
              <IconShuffle />
            </button>

            <button
              type="button"
              className="int-icon-btn int-skip-btn"
              onClick={actions.prev}
              aria-label="Previous track"
              title="Previous track"
            >
              <IconPrev />
            </button>

            <button
              type="button"
              className="int-icon-btn int-ff-btn"
              onClick={handleRewind}
              aria-label="Rewind 10 seconds"
              title="Rewind 10s"
            >
              <IconRewind />
            </button>

            <button
              type="button"
              className={`int-play-btn${isPlaying ? ' int-play-btn--active' : ''}`}
              onClick={actions.togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <IconPause /> : <IconPlay />}
            </button>

            <button
              type="button"
              className="int-icon-btn int-ff-btn"
              onClick={handleFastForward}
              aria-label="Fast forward 10 seconds"
              title="Fast forward 10s"
            >
              <IconFastForward />
            </button>

            <button
              type="button"
              className="int-icon-btn int-skip-btn"
              onClick={actions.next}
              aria-label="Next track"
              title="Next track"
            >
              <IconNext />
            </button>
          </div>

          {/* Right: Volume */}
          <div className="int-player__right">
            <VolumeControl
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={actions.setVolume}
              onToggleMute={actions.toggleMute}
            />
          </div>
        </div>
      </aside>
    );
  }

  /* ─────────────────────────────────────────────────────────
     VARIANT B: 'overlay' (docked inside RecordDetailsOverlay)
     ───────────────────────────────────────────────────────── */
  return (
    <div
      className="int-player int-player--overlay"
      role="region"
      aria-label="Record Player Console"
    >

      <div className="int-player__overlay-inner">
        {/* Left / Row 2 Left: Artwork + Track details */}
        <div className="int-player__track">
          <div className="int-player__art-wrap">
            {artworkSrc ? (
              <img
                src={artworkSrc}
                alt={currentTrack.title}
                className={`int-player__art${isPlaying ? ' int-player__art--spin' : ''}`}
                loading="lazy"
              />
            ) : (
              <div className={`int-player__art int-player__art--placeholder${isPlaying ? ' int-player__art--spin' : ''}`}>
                ♫
              </div>
            )}
          </div>
          <div className="int-player__info">
            <div className="int-player__eyebrow-row">
              <EqualizerBars isPlaying={isPlaying} />
              <span className="int-player__status">
                {isPlaying ? 'RECORD PLAYING' : 'RECORD PAUSED'}
              </span>
            </div>
            <p className="int-player__title">{currentTrack.title}</p>
            {metaParts.length > 0 && (
              <p className="int-player__meta">{metaParts.join(' · ')}</p>
            )}
          </div>
        </div>

        {/* Center Row 1 / Row 2 Right: Controls */}
        <div className="int-player__controls">
          <button
            type="button"
            className={`int-icon-btn int-shuffle-btn${shuffleEnabled ? ' int-shuffle-btn--active' : ''}`}
            onClick={actions.toggleShuffle}
            aria-label={shuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'}
            aria-pressed={shuffleEnabled}
            title="Shuffle"
          >
            <IconShuffle />
          </button>

          <button
            type="button"
            className="int-icon-btn int-skip-btn"
            onClick={actions.prev}
            aria-label="Previous track"
            title="Previous track"
          >
            <IconPrev />
          </button>

          <button
            type="button"
            className="int-icon-btn int-ff-btn"
            onClick={handleRewind}
            aria-label="Rewind 10 seconds"
            title="Rewind 10s"
          >
            <IconRewind />
          </button>

          <button
            type="button"
            className={`int-play-btn${isPlaying ? ' int-play-btn--active' : ''}`}
            onClick={actions.togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <IconPause /> : <IconPlay />}
          </button>

          <button
            type="button"
            className="int-icon-btn int-ff-btn"
            onClick={handleFastForward}
            aria-label="Fast forward 10 seconds"
            title="Fast forward 10s"
          >
            <IconFastForward />
          </button>

          <button
            type="button"
            className="int-icon-btn int-skip-btn"
            onClick={actions.next}
            aria-label="Next track"
            title="Next track"
          >
            <IconNext />
          </button>
        </div>

        {/* Center Row 2 / Row 1 Full Width: Seek Bar */}
        <div className="int-player__seek-row">
          <span className="int-time-text">{formatTime(currentTime)}</span>
          <SeekBar
            currentTime={currentTime}
            duration={duration}
            onSeek={actions.seek}
          />
          <span className="int-time-text">{formatTime(duration)}</span>
        </div>

        {/* Right: Volume */}
        <div className="int-player__right">
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

export default memo(IntegratedPlayerComponent);
