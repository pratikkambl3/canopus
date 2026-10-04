import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAudio } from '../context/AudioContext';
import { getRecords } from '../services/recordsService';
import { useCharacterImage } from '../services/characterService';
import RadioPlayer from '../components/radio/RadioPlayer';
import OnAirBadge from '../components/radio/OnAirBadge';

export default function RadioPage() {
  const { state, actions } = useAudio();
  const { isPlaying, liveRadioEnabled, tracks, currentTrackId, currentTrack } = state;
  const { characterUrl, setCharacterUrl } = useCharacterImage('home');
  const hasActivePlayer = !!(currentTrack || currentTrackId);

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
    <main className={`radio-page page radio-page--fit ${hasActivePlayer ? 'radio-page--has-player' : ''}`}>
      <style>{`
        @media (min-width: 901px) {
          .radio-page.radio-page--fit {
            height: calc(100vh - var(--header-h));
            min-height: calc(100vh - var(--header-h));
            max-height: calc(100vh - var(--header-h));
            padding-top: 0;
            margin-top: var(--header-h);
            display: grid;
            grid-template-columns: 38% 1fr;
            align-items: stretch;
            overflow-y: auto;
            overflow-x: hidden;
            box-sizing: border-box;
          }

          .radio-page.radio-page--fit.radio-page--has-player,
          body:has(.global-player) .radio-page.radio-page--fit {
            height: calc(100vh - var(--header-h) - var(--global-player-h, 88px));
            min-height: calc(100vh - var(--header-h) - var(--global-player-h, 88px));
            max-height: calc(100vh - var(--header-h) - var(--global-player-h, 88px));
          }

          .radio-page.radio-page--fit .radio-page__character-col {
            position: relative;
            height: 100%;
            min-height: 0;
            display: flex;
            align-items: flex-end;
            justify-content: flex-start;
            overflow: hidden;
          }

          .radio-page.radio-page--fit .radio-page__character-img {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
            object-position: bottom left;
          }

          .radio-page.radio-page--fit .radio-page__content-col {
            min-height: 0;
            height: 100%;
            justify-content: center;
            padding: clamp(10px, 1.8vh, 28px) clamp(24px, 3.5vw, 56px);
            overflow: visible;
          }

          .radio-page.radio-page--fit .radio-hero__eyebrow {
            font-size: 10px;
            margin-bottom: clamp(4px, 0.8vh, 10px);
            letter-spacing: 0.3em;
          }

          .radio-page.radio-page--fit .radio-hero__title {
            font-size: clamp(28px, min(4.2vw, 5.2vh), 60px);
            line-height: 1.05;
            margin-bottom: clamp(4px, 0.8vh, 12px);
          }

          .radio-page.radio-page--fit .radio-hero__rule {
            margin: clamp(4px, 0.8vh, 12px) 0;
            width: 40px;
          }

          .radio-page.radio-page--fit .radio-hero__desc {
            font-size: clamp(11.5px, 0.95vw, 13px);
            line-height: 1.45;
            max-width: 420px;
            margin-bottom: clamp(6px, 1.2vh, 16px);
          }

          .radio-page.radio-page--fit .on-air-badge {
            margin-bottom: clamp(6px, 1.2vh, 16px);
          }

          .radio-page.radio-page--fit .player-card {
            padding: clamp(10px, 1.4vh, 18px) clamp(14px, 1.8vw, 22px);
            margin-bottom: 0;
          }

          .radio-page.radio-page--fit .player-card__label {
            font-size: 8.5px;
            margin-bottom: clamp(4px, 0.8vh, 10px);
            letter-spacing: 0.28em;
          }

          .radio-page.radio-page--fit .player-card__top {
            gap: clamp(10px, 1.2vw, 16px);
            margin-bottom: clamp(6px, 1vh, 12px);
          }

          .radio-page.radio-page--fit .player-card__artwork-wrap {
            width: clamp(44px, 5.2vh, 64px);
            height: clamp(44px, 5.2vh, 64px);
          }

          .radio-page.radio-page--fit .player-card__track-title {
            font-size: clamp(13px, 1.15vw, 15px);
            margin-bottom: 2px;
          }

          .radio-page.radio-page--fit .player-card__version {
            font-size: 10.5px;
          }

          .radio-page.radio-page--fit .player-card__meta-tag {
            font-size: 9.5px;
            padding: 2px 7px;
          }

          .radio-page.radio-page--fit .player-card__progress-section {
            margin-bottom: clamp(4px, 0.8vh, 8px);
          }

          .radio-page.radio-page--fit .player-card__controls {
            margin-top: clamp(2px, 0.6vh, 8px);
          }

          .radio-page.radio-page--fit .hero-actions {
            margin-top: clamp(8px, 1.4vh, 18px);
            gap: 10px;
          }

          .radio-page.radio-page--fit .hero-actions .btn-primary,
          .radio-page.radio-page--fit .hero-actions .btn-secondary {
            padding: clamp(8px, 1.1vh, 12px) clamp(18px, 1.8vw, 28px);
            font-size: 10.5px;
            letter-spacing: 0.2em;
          }
        }
      `}</style>

      {/* Left — Character */}
      <div className="radio-page__character-col">
        <img
          className="radio-page__character-img animate-char"
          src={characterUrl}
          alt="The CANOPUS host — a mysterious figure in a navy pinstripe suit"
          draggable={false}
          onError={() => setCharacterUrl('/canopus-portrait.png')}
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
        <OnAirBadge isPlaying={isPlaying} hasTrack={!!currentTrackId} />

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
