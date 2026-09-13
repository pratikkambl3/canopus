import { useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { IconPlay, IconPlayCircle } from '../shared/Icons';
import { formatTime } from '../shared/Icons';

const GENRES = ['All', 'Experimental', 'Tech House', 'Remix'];

export default function RecordsList({ tracks }) {
  const { state, actions } = useAudio();
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = tracks.filter(t => {
    const matchesGenre =
      activeFilter === 'All' || t.genre.toLowerCase() === activeFilter.toLowerCase();
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.originalTitle.toLowerCase().includes(q) ||
      t.version.toLowerCase().includes(q) ||
      t.genre.toLowerCase().includes(q);
    return matchesGenre && matchesSearch;
  });

  return (
    <>
      {/* Header + Filters */}
      <div className="records-header">
        <div className="records-header__left">
          <p className="records-header__eyebrow">CANOPUS</p>
          <h1 className="records-header__title">The Records</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end' }}>
          <div className="record-filters" role="group" aria-label="Filter by genre">
            {GENRES.map(g => (
              <button
                key={g}
                className={`record-filter-btn${activeFilter === g ? ' active' : ''}`}
                onClick={() => setActiveFilter(g)}
                aria-pressed={activeFilter === g}
              >
                {g}
              </button>
            ))}
          </div>
          <input
            type="search"
            placeholder="Search records…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search records"
            style={{
              padding: '8px 14px',
              fontSize: 12,
              letterSpacing: '0.06em',
              border: '1px solid var(--border-mid)',
              borderRadius: 2,
              background: 'transparent',
              color: 'var(--text-primary)',
              outline: 'none',
              width: 200,
            }}
          />
        </div>
      </div>

      {/* List */}
      <div className="records-list" role="list" aria-label="Track catalogue">
        {filtered.length === 0 ? (
          <p className="records-list__empty">
            {tracks.length === 0
              ? 'No records available yet.'
              : 'No records match your search.'}
          </p>
        ) : (
          filtered.map((track, idx) => (
            <RecordRow
              key={track.id}
              track={track}
              index={idx}
              isActive={state.currentTrackId === track.id}
              isPlaying={state.isPlaying && state.currentTrackId === track.id}
              onSelect={() => actions.selectTrack(track.id)}
            />
          ))
        )}
      </div>
    </>
  );
}

function RecordRow({ track, index, isActive, isPlaying, onSelect }) {
  const num = String(index + 1).padStart(2, '0');
  return (
    <button
      className={`record-row${isActive ? ' active' : ''}`}
      onClick={onSelect}
      role="listitem"
      aria-label={`Play ${track.title} — ${track.version}`}
      aria-pressed={isActive}
    >
      <span className="record-row__number" aria-hidden="true">{num}</span>

      {/* Artwork */}
      <div className="record-row__artwork-wrap">
        {track.artworkUrl ? (
          <img
            className="record-row__artwork"
            src={track.artworkUrl}
            alt={track.title}
            loading="lazy"
          />
        ) : (
          <div className="record-row__artwork-placeholder" aria-hidden="true">♫</div>
        )}
        <div className="record-row__play-overlay" aria-hidden="true">
          {isPlaying ? (
            <span style={{ fontSize: 9, letterSpacing: '0.12em', color: '#fff', textTransform: 'uppercase' }}>
              ▌▌
            </span>
          ) : (
            <IconPlayCircle />
          )}
        </div>
      </div>

      {/* Info */}
      <div className="record-row__info">
        <p className="record-row__title">{track.title}</p>
        <p className="record-row__version">{track.version}</p>
      </div>

      {/* Tags */}
      <div className="record-row__tags">
        <span className="record-row__tag">{track.genre}</span>
        <span className="record-row__tag">{track.bpm} BPM</span>
        {track.key && <span className="record-row__tag">{track.key}</span>}
      </div>

      {/* Duration */}
      <span className="record-row__duration">{formatTime(track.duration)}</span>
    </button>
  );
}
