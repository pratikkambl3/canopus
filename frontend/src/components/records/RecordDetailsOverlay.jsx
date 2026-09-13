import { useEffect } from 'react';
import { useAudio } from '../../context/AudioContext';
import {
  IconPlay, IconPause, IconShuffle, IconPlayCircle, formatTime,
} from '../shared/Icons';

/* ── Vinyl SVG (minimal, monochrome) ── */
function VinylDisc() {
  return (
    <svg viewBox="0 0 200 200" className="vinyl-svg" aria-hidden="true">
      <circle cx="100" cy="100" r="98" fill="#1a1a1a" stroke="#3a3a3a" strokeWidth="1" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="#2a2a2a" strokeWidth="1" />
      <circle cx="100" cy="100" r="70" fill="none" stroke="#2a2a2a" strokeWidth="1" />
      <circle cx="100" cy="100" r="60" fill="none" stroke="#2a2a2a" strokeWidth="1" />
      <circle cx="100" cy="100" r="50" fill="none" stroke="#2a2a2a" strokeWidth="1" />
      <circle cx="100" cy="100" r="40" fill="none" stroke="#2a2a2a" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="30" fill="none" stroke="#2a2a2a" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="20" fill="#F7F4F0" />
      <circle cx="100" cy="100" r="14" fill="#e8e2da" />
      <circle cx="100" cy="100" r="5"  fill="#1a1a1a" />
      <text x="100" y="97" textAnchor="middle" fill="#7A7A7A" fontSize="5" fontFamily="serif" letterSpacing="1.5">CANOPUS</text>
      <text x="100" y="105" textAnchor="middle" fill="#7A7A7A" fontSize="4" fontFamily="serif">●</text>
    </svg>
  );
}

/* ── Track Thumbnail ── */
function TrackThumb({ src, alt, size = 48 }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className="track-row__thumb"
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }
  return (
    <div className="track-row__thumb track-row__thumb--placeholder" style={{ width: size, height: size }}>
      <span aria-hidden="true">♫</span>
    </div>
  );
}

export default function RecordDetailsOverlay({ record, onClose }) {
  const { state, actions } = useAudio();

  /* Lock scroll + close on Escape */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const tracks      = record.tracks || [];
  const totalTracks = tracks.length;
  const releaseYear = record.releaseDate ? record.releaseDate.slice(0, 4) : '—';

  /* Enrich tracks: album artwork as fallback, genre from album */
  const enrichedTracks = tracks.map(t => ({
    ...t,
    artworkUrl: t.artworkUrl || record.artworkUrl || null,
    genre: t.genre || record.genre || '',
  }));

  /* Total duration */
  const totalSec = tracks.reduce((sum, t) => sum + (Number(t.duration) || 0), 0);
  const totalDur = totalSec > 0
    ? `${Math.floor(totalSec / 60)}:${String(Math.floor(totalSec % 60)).padStart(2, '0')}`
    : null;

  /* Derived playback state */
  const isRecordActive  = enrichedTracks.some(t => t.id === state.currentTrackId);
  const isRecordPlaying = isRecordActive && state.isPlaying;
  const currentTrackId  = state.currentTrackId;

  const handlePlayAll = () => {
    if (!enrichedTracks.length) return;
    actions.loadTracks(enrichedTracks);
    actions.selectTrack(enrichedTracks[0].id);
  };

  const handleShuffle = (e) => {
    e?.stopPropagation();
    if (!enrichedTracks.length) return;
    actions.loadTracks(enrichedTracks);
    const rand = enrichedTracks[Math.floor(Math.random() * enrichedTracks.length)];
    actions.selectTrack(rand.id);
    actions.toggleShuffle && actions.toggleShuffle();
  };

  const handleTogglePlay = (e) => {
    e?.stopPropagation();
    if (isRecordPlaying) {
      actions.togglePlay();
      return;
    }
    if (isRecordActive) {
      actions.togglePlay();
      return;
    }
    handlePlayAll();
  };

  const handlePlayTrack = (track, e) => {
    e?.stopPropagation();
    if (state.currentTrackId === track.id) {
      actions.togglePlay();
      return;
    }
    if (!isRecordActive) {
      actions.loadTracks(enrichedTracks);
    }
    actions.selectTrack(track.id);
  };

  return (
    <div
      className="album-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Album: ${record.title}`}
    >
      {/* Backdrop */}
      <div
        className="album-overlay__backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="album-overlay__sheet">
        {/* Close */}
        <button className="album-overlay__close" onClick={onClose} aria-label="Close album">
          ×
        </button>

        {/* ── Album Hero ── */}
        <section className="album-hero">
          {/* Artwork + Vinyl */}
          <div className="album-hero__artwork-wrap">
            <div className="album-hero__vinyl" aria-hidden="true">
              <VinylDisc />
            </div>
            <div className="album-hero__cover-shadow">
              {record.artworkUrl ? (
                <img
                  src={record.artworkUrl}
                  alt={record.title}
                  className="album-hero__cover"
                />
              ) : (
                <div className="album-hero__cover album-hero__cover--placeholder">
                  <span>♫</span>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="album-hero__info">
            {record.genre && (
              <p className="album-hero__eyebrow">{record.genre.toUpperCase()}</p>
            )}
            <h1 className="album-hero__title">{record.title}</h1>
            {record.artist && (
              <p className="album-hero__artist">{record.artist}</p>
            )}

            <div className="album-hero__meta">
              {record.genre && <span>{record.genre}</span>}
              {releaseYear !== '—' && <><span className="album-hero__meta-sep">/</span><span>{releaseYear}</span></>}
              {totalTracks > 0 && <><span className="album-hero__meta-sep">/</span><span>{totalTracks} {totalTracks === 1 ? 'TRACK' : 'TRACKS'}</span></>}
            </div>

            {record.description && (
              <p className="album-hero__description">{record.description}</p>
            )}

            <div className="album-hero__actions">
              <button
                id="album-play-btn"
                className="btn-primary album-hero__play-btn"
                onClick={handleTogglePlay}
              >
                {isRecordPlaying ? <IconPause /> : <IconPlay />}
                {isRecordPlaying ? 'PAUSE' : 'PLAY ALBUM'}
              </button>
              <button
                id="album-shuffle-btn"
                className="btn-secondary album-hero__shuffle-btn"
                onClick={handleShuffle}
              >
                <IconShuffle />
                SHUFFLE
              </button>
            </div>

            {isRecordActive && state.error && (
              <p className="album-hero__error" role="alert">
                {state.error}
              </p>
            )}
          </div>

          {/* Album Details sidebar */}
          <aside className="album-hero__details">
            <p className="album-details__heading">ALBUM DETAILS</p>
            <dl className="album-details__list">
              {record.genre && (
                <>
                  <dt className="album-details__label">GENRE</dt>
                  <dd className="album-details__value">{record.genre}</dd>
                </>
              )}
              {releaseYear !== '—' && (
                <>
                  <dt className="album-details__label">RELEASE DATE</dt>
                  <dd className="album-details__value">{releaseYear}</dd>
                </>
              )}
              <dt className="album-details__label">TOTAL TRACKS</dt>
              <dd className="album-details__value">{totalTracks}</dd>
              {totalDur && (
                <>
                  <dt className="album-details__label">DURATION</dt>
                  <dd className="album-details__value">{totalDur}</dd>
                </>
              )}
            </dl>

            {record.description && (
              <>
                <p className="album-details__heading album-details__heading--about">ABOUT THE ALBUM</p>
                <p className="album-details__about">{record.description}</p>
              </>
            )}
          </aside>
        </section>

        {/* ── Tracklist ── */}
        <section className="tracklist-section">
          <div className="tracklist-main">
            {/* Tracklist header */}
            <div className="tracklist-head">
              <span className="tracklist-head__label">TRACKLIST</span>
              <span className="tracklist-head__count">
                {totalTracks} {totalTracks === 1 ? 'TRACK' : 'TRACKS'}
              </span>
            </div>

            {/* Column headers */}
            {tracks.length > 0 && (
              <div className="tracklist-cols" aria-hidden="true">
                <span className="tracklist-cols__num">#</span>
                <span className="tracklist-cols__track">TRACK</span>
                <span className="tracklist-cols__dur">DURATION</span>
              </div>
            )}

            {/* Rows */}
            {tracks.length === 0 ? (
              <p className="tracklist-empty">No tracks in this record.</p>
            ) : (
              <ol className="tracklist" aria-label="Tracklist">
                {tracks.map((track, idx) => {
                  const isActive  = currentTrackId === track.id;
                  const isPlaying = isActive && state.isPlaying;
                  /* Prefer per-track artwork, fall back to album artwork */
                  const thumb = track.artworkUrl || record.artworkUrl || null;

                  return (
                    <li key={track.id} className={`track-row${isActive ? ' track-row--active' : ''}`}>
                      <button
                        className="track-row__btn"
                        onClick={(e) => handlePlayTrack(track, e)}
                        aria-label={`Play ${track.title}`}
                        aria-pressed={isActive}
                      >
                        {/* Number / Playing indicator */}
                        <span className="track-row__num" aria-hidden="true">
                          {isPlaying
                            ? <span className="track-row__bars"><span/><span/><span/></span>
                            : String(idx + 1).padStart(2, '0')
                          }
                        </span>

                        {/* Thumbnail */}
                        <TrackThumb src={thumb} alt={track.title} size={48} />

                        {/* Title + subtitle */}
                        <div className="track-row__info">
                          <p className="track-row__title">{track.title}</p>
                          {(track.originalTitle || track.version || (track.bpm && Number(track.bpm) > 0)) && (
                            <p className="track-row__sub">
                              {[
                                track.originalTitle || track.version,
                                (track.bpm && Number(track.bpm) > 0) ? `${track.bpm} BPM` : null,
                                track.key,
                              ].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {record.artist && (
                            <p className="track-row__artist">{record.artist}</p>
                          )}
                        </div>

                        {/* Duration */}
                        <span className="track-row__dur">
                          {track.duration ? formatTime(track.duration) : '—'}
                        </span>

                        {/* Play icon (visible on hover / active) */}
                        <span className="track-row__play-icon" aria-hidden="true">
                          {isPlaying ? <IconPause /> : <IconPlayCircle />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Vinyl sidebar */}
          <aside className="tracklist-vinyl-aside" aria-hidden="true">
            <div className="tracklist-vinyl__disc">
              <VinylDisc />
            </div>
            <div className="tracklist-vinyl__text">
              <p className="tracklist-vinyl__label">THE RECORDS</p>
              <p className="tracklist-vinyl__tagline"><em>Timeless Music</em></p>
              <p className="tracklist-vinyl__tagline"><em>Never Gets Old</em></p>
            </div>
            <div className="tracklist-vinyl__waveform" aria-hidden="true">
              {Array.from({ length: 16 }).map((_, i) => (
                <span key={i} className="tracklist-vinyl__bar" style={{ height: `${8 + Math.sin(i * 0.8) * 6}px` }} />
              ))}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
