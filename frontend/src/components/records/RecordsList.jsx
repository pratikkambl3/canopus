import { useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import RecordDetailsOverlay from './RecordDetailsOverlay';

export default function RecordsList({ records }) {
  const { state, actions } = useAudio();
  const [search, setSearch]           = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedRecord, setSelectedRecord] = useState(null);

  /* Build genre list dynamically from actual records */
  const genres = ['All', ...Array.from(new Set(records.map(r => r.genre).filter(Boolean)))];

  const filtered = records.filter(r => {
    const matchesGenre =
      activeFilter === 'All' || r.genre?.toLowerCase() === activeFilter.toLowerCase();
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.title?.toLowerCase().includes(q) ||
      r.genre?.toLowerCase().includes(q) ||
      r.artist?.toLowerCase().includes(q);
    return matchesGenre && matchesSearch;
  });

  const handlePlayRecord = (record) => {
    const tracks = record.tracks || [];
    if (!tracks.length) return;
    const enrichedTracks = tracks.map(t => ({
      ...t,
      artworkUrl: t.artworkUrl || record.artworkUrl || null,
      genre: t.genre || record.genre || '',
    }));
    const isThisRecordActive = enrichedTracks.some(t => t.id === state.currentTrackId);
    if (isThisRecordActive) {
      actions.togglePlay();
      return;
    }
    actions.loadTracks(enrichedTracks);
    actions.selectTrack(enrichedTracks[0].id);
  };

  return (
    <>
      {/* Page header */}
      <div className="records-header">
        <div className="records-header__left">
          <p className="records-header__eyebrow">CANOPUS</p>
          <h1 className="records-header__title">The Records</h1>
          <p className="records-header__tagline">
            <em>Timeless music, carefully curated.</em>
          </p>
        </div>

        <div className="records-header__controls">
          {/* Genre filter */}
          {genres.length > 1 && (
            <div className="record-filters" role="group" aria-label="Filter by genre">
              {genres.map(g => (
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
          )}

          {/* Search */}
          <input
            type="search"
            className="records-search"
            placeholder="Search albums…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search albums"
          />
        </div>
      </div>

      {/* Album grid */}
      <div className="records-grid-section" role="list" aria-label="Album catalogue">
        {filtered.length === 0 ? (
          <p className="records-list__empty">
            {records.length === 0
              ? 'No records available yet.'
              : 'No records match your search.'}
          </p>
        ) : (
          filtered.map(record => {
            const tracks = record.tracks || [];
            const isThisRecordActive = tracks.some(t => t.id === state.currentTrackId);
            const isPlayingThisRecord = isThisRecordActive && state.isPlaying;

            return (
              <RecordCard
                key={record.id}
                record={record}
                onClick={() => setSelectedRecord(record)}
                onPlayRecord={() => handlePlayRecord(record)}
                isPlayingThisRecord={isPlayingThisRecord}
              />
            );
          })
        )}
      </div>

      {/* Album detail overlay */}
      {selectedRecord && (
        <RecordDetailsOverlay
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </>
  );
}

function RecordCard({ record, onClick, onPlayRecord, isPlayingThisRecord }) {
  const trackCount = record.tracks?.length || 0;
  const releaseYear = record.releaseDate ? record.releaseDate.slice(0, 4) : null;

  return (
    <article
      className="record-card"
      role="listitem"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Open ${record.title}`}
    >
      <div className="record-card__btn">
        {/* Artwork */}
        <div className="record-card__artwork-wrap">
          {record.artworkUrl ? (
            <img
              className="record-card__artwork"
              src={record.artworkUrl}
              alt={record.title}
              loading="lazy"
            />
          ) : (
            <div className="record-card__artwork record-card__artwork--placeholder">
              <span aria-hidden="true">♫</span>
            </div>
          )}
          {/* Hover play overlay */}
          <div className="record-card__hover-overlay">
            <button
              type="button"
              className="record-card__play-circle"
              onClick={(e) => {
                e.stopPropagation();
                onPlayRecord();
              }}
              aria-label={isPlayingThisRecord ? `Pause ${record.title}` : `Play ${record.title}`}
            >
              {isPlayingThisRecord ? (
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                  <polygon points="6,3 20,12 6,21" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="record-card__info">
          <h3 className="record-card__title">{record.title}</h3>
          {record.artist && (
            <p className="record-card__artist">{record.artist}</p>
          )}
          <p className="record-card__meta">
            {[record.genre, releaseYear, trackCount > 0 ? `${trackCount} tracks` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>
    </article>
  );
}
