import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAudio } from '../context/AudioContext';
import { getRecords } from '../services/recordsService';
import RadioPlayer from '../components/radio/RadioPlayer';
import OnAirBadge from '../components/radio/OnAirBadge';

export default function RadioPage() {
  const { state, actions } = useAudio();
  const { isPlaying, liveRadioEnabled, tracks, currentTrackId } = state;

  // Load all tracks from all records into radio pool
  useEffect(() => {
    getRecords().then(records => {
      // Flatten all tracks; attach artist and album artwork fallback
      const allTracks = records.flatMap(r =>
        (r.tracks || []).map(t => ({
          ...t,
          artist: t.artist || r.artist || '',
          albumTitle: r.title,
          // Per-track artwork → album artwork → null
          artworkUrl: t.artworkUrl || r.artworkUrl || null,
          // Attach genre from the parent record for the player card metadata
          genre: t.genre || r.genre || '',
        }))
      );
      actions.loadRadioPool(allTracks);
    }).catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="radio-page page">
      {/* Left — Character */}
      <div className="radio-page__character-col">
        <img
          className="radio-page__character-img animate-char"
          src="/canopus-portrait.png"
          alt="The CANOPUS host — a mysterious figure in a navy pinstripe suit"
          draggable={false}
        />
      </div>

      {/* Right — Content */}
      <div className="radio-page__content-col animate-content">
        {/* Eyebrow */}
        <p className="radio-hero__eyebrow">CANOPUS Radio</p>

        {/* Title */}
        <h1 className="radio-hero__title">
          Golden Era,<br />
          <em style={{ fontStyle: 'italic', fontWeight: 400 }}>Reimagined.</em>
        </h1>

        <div className="radio-hero__rule" />

        {/* Tagline */}
        <p className="radio-hero__desc">
          Experimental flips, electronic reinterpretations and nostalgic Indian sounds
          — broadcast live from CANOPUS.
        </p>

        {/* ON AIR */}
        <OnAirBadge isPlaying={isPlaying} hasTrack={!!currentTrackId} onlineCount="1.2K" />

        {/* Player */}
        <RadioPlayer />

        {/* CTAs */}
        <div className="hero-actions">
          {tracks.length === 0 ? (
            <button className="btn-primary" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
              NO RECORDS AVAILABLE
            </button>
          ) : (
          <button
            className="btn-primary"
            onClick={() => {
              if (isPlaying) {
                actions.togglePlay();
              } else {
                // Always start live radio (random shuffle through all records)
                actions.startLiveRadio();
              }
            }}
            aria-label={isPlaying ? 'Pause radio' : 'Play radio — random shuffle'}
          >
            {isPlaying ? 'Pause' : 'Play Radio'}
          </button>
          )}
          <Link to="/records" className="btn-secondary">
            Explore Records
          </Link>
        </div>
      </div>
    </main>
  );
}
