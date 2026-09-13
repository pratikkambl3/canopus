import { useRef } from 'react';
import { useAudio } from '../../context/AudioContext';
import OnAirBadge from './OnAirBadge';
import {
  IconPlay, IconPause, IconPrev, IconNext,
  IconShuffle, IconVolume, IconVolumeMute, formatTime,
} from '../shared/Icons';

export default function RadioPlayer() {
  const { state, actions } = useAudio();
  const {
    currentTrack, isPlaying, currentTime, duration,
    volume, isMuted, shuffleEnabled, error,
  } = state;

  const progressRef = useRef(null);
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  /* Progress bar interactions */
  const handleProgressClick = (e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    actions.seek(ratio * duration);
  };

  const handleProgressMouseDown = (e) => {
    if (!duration) return;
    handleProgressClick(e);
    const onMove = (ev) => {
      const rect = progressRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      actions.seek(ratio * duration);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="player-card animate-player" role="region" aria-label="Music player">
      {/* Label */}
      <p className="player-card__label">Now Playing</p>

      {/* Top: artwork + info */}
      <div className="player-card__top">
        {/* Artwork */}
        <div className="player-card__artwork-wrap">
          {currentTrack?.artworkUrl ? (
            <img
              className="player-card__artwork"
              src={currentTrack.artworkUrl}
              alt={currentTrack.title}
              loading="lazy"
              key={currentTrack.id}
            />
          ) : (
            <div className="player-card__artwork-placeholder" aria-hidden="true">♫</div>
          )}
        </div>

        {/* Info */}
        <div className="player-card__info">
          <p className="player-card__track-title">
            {currentTrack?.title ?? 'Select a record'}
          </p>
          {currentTrack?.artist && (
            <p className="player-card__artist" style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 4px', fontWeight: 500 }}>
              {currentTrack.artist}
            </p>
          )}
          <p className="player-card__version">
            {currentTrack?.version || currentTrack?.albumTitle || 'CANOPUS'}
          </p>
          {currentTrack && (
            <div className="player-card__meta">
              {currentTrack.genre && <span className="player-card__meta-tag">{currentTrack.genre}</span>}
              {currentTrack.bpm && Number(currentTrack.bpm) > 0 ? (
                <span className="player-card__meta-tag">{currentTrack.bpm} BPM</span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <p className="player-card__error">{error}</p>
      )}

      {/* Progress bar */}
      <div className="player-card__progress-section">
        <div
          className="player-card__progress-bar"
          ref={progressRef}
          onClick={handleProgressClick}
          onMouseDown={handleProgressMouseDown}
          role="slider"
          aria-label="Playback position"
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration)}
          aria-valuenow={Math.floor(currentTime)}
          tabIndex={0}
        >
          <div
            className="player-card__progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="player-card__times">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="player-card__controls">
        {/* Shuffle */}
        <button
          className={`player-card__ctrl-btn${shuffleEnabled ? ' player-card__ctrl-btn--active' : ''}`}
          onClick={actions.toggleShuffle}
          aria-label={shuffleEnabled ? 'Disable shuffle' : 'Enable shuffle'}
          aria-pressed={shuffleEnabled}
        >
          <IconShuffle />
        </button>

        {/* Center controls */}
        <div className="player-card__controls-center">
          <button
            className="player-card__ctrl-btn"
            onClick={actions.prev}
            aria-label="Previous track"
          >
            <IconPrev />
          </button>

          <button
            className="player-card__play-btn"
            onClick={() => {
              if (isPlaying) {
                actions.togglePlay();
              } else if (!state.currentTrackId || !state.liveRadioEnabled) {
                actions.startLiveRadio();
              } else {
                actions.togglePlay();
              }
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <IconPause /> : <IconPlay />}
          </button>

          <button
            className="player-card__ctrl-btn"
            onClick={actions.next}
            aria-label="Next track"
          >
            <IconNext />
          </button>
        </div>

        {/* Volume */}
        <div className="player-card__vol">
          <button
            className="player-card__ctrl-btn"
            onClick={actions.toggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <IconVolumeMute /> : <IconVolume />}
          </button>
          <input
            type="range"
            className="player-card__vol-slider"
            min={0}
            max={1}
            step={0.02}
            value={isMuted ? 0 : volume}
            onChange={(e) => actions.setVolume(parseFloat(e.target.value))}
            aria-label="Adjust volume"
          />
        </div>
      </div>
    </div>
  );
}
