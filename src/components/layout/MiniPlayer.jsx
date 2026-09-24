import { useAudio } from '../../context/AudioContext';
import { IconPlay, IconPause, IconPrev, IconNext, formatTime } from '../shared/Icons';

export default function MiniPlayer() {
  const { state, actions } = useAudio();
  const { currentTrack, isPlaying, currentTime, duration } = state;

  // Only show when a track is loaded
  if (!currentTrack) return null;

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="mini-player" role="region" aria-label="Now Playing">
      {/* Progress line at top */}
      <div
        className="mini-player__progress"
        style={{ width: `${progressPct}%` }}
        aria-hidden="true"
      />

      {/* Artwork */}
      {currentTrack.artworkUrl ? (
        <img
          className="mini-player__artwork"
          src={currentTrack.artworkUrl}
          alt={currentTrack.title}
          loading="lazy"
        />
      ) : (
        <div className="mini-player__artwork" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B0A8A0', fontSize: 14 }}>
          ♫
        </div>
      )}

      {/* Info */}
      <div className="mini-player__info">
        <p className="mini-player__title">{currentTrack.title}</p>
        <p className="mini-player__version">{currentTrack.version}</p>
      </div>

      {/* Controls */}
      <div className="mini-player__controls">
        <button
          className="mini-player__ctrl"
          onClick={actions.prev}
          aria-label="Previous track"
        >
          <IconPrev />
        </button>

        <button
          className="mini-player__play"
          onClick={actions.togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <IconPause /> : <IconPlay />}
        </button>

        <button
          className="mini-player__ctrl"
          onClick={actions.next}
          aria-label="Next track"
        >
          <IconNext />
        </button>
      </div>
    </div>
  );
}
