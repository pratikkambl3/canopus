import { useAudio } from '../context/AudioContext';
import { useCharacterImage } from '../services/characterService';

export default function AboutPage() {
  const { state } = useAudio();
  const { characterUrl, setCharacterUrl } = useCharacterImage('about');
  const hasActivePlayer = !!(state?.currentTrack || state?.currentTrackId);

  return (
    <div className={`about-page page about-page--fit ${hasActivePlayer ? 'about-page--has-player' : ''}`}>
      <style>{`
        @media (min-width: 901px) {
          .about-page.about-page--fit {
            height: calc(100vh - var(--header-h));
            min-height: calc(100vh - var(--header-h));
            max-height: calc(100vh - var(--header-h));
            padding-top: 0;
            margin-top: var(--header-h);
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            align-items: stretch;
            overflow-y: auto;
            overflow-x: hidden;
            box-sizing: border-box;
          }

          .about-page.about-page--fit.about-page--has-player,
          body:has(.global-player) .about-page.about-page--fit {
            height: calc(100vh - var(--header-h) - var(--global-player-h, 88px));
            min-height: calc(100vh - var(--header-h) - var(--global-player-h, 88px));
            max-height: calc(100vh - var(--header-h) - var(--global-player-h, 88px));
          }

          /* Left Column: Content fits comfortably without overflowing */
          .about-page.about-page--fit .about-page__content {
            min-height: 0;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: clamp(16px, 3vh, 48px) clamp(28px, 4vw, 64px);
            overflow: visible;
          }

          .about-page.about-page--fit .about-page__eyebrow {
            font-size: 10px;
            letter-spacing: 0.3em;
            margin-bottom: clamp(6px, 1.2vh, 16px);
          }

          .about-page.about-page--fit .about-page__title {
            font-size: clamp(34px, min(5vw, 6.2vh), 68px);
            line-height: 1;
            margin-bottom: clamp(8px, 1.6vh, 20px);
            letter-spacing: -0.01em;
          }

          .about-page.about-page--fit .about-page__rule {
            width: 36px;
            height: 1px;
            margin-bottom: clamp(8px, 1.6vh, 18px);
          }

          .about-page.about-page--fit .about-page__body {
            font-size: clamp(12.5px, 1.05vw, 14.5px);
            line-height: 1.65;
            letter-spacing: 0.015em;
            max-width: 520px;
            margin-bottom: clamp(10px, 1.8vh, 24px);
          }

          .about-page.about-page--fit .about-page__body p + p {
            margin-top: clamp(6px, 1.2vh, 12px);
          }

          .about-page.about-page--fit .about-page__tagline {
            font-size: clamp(13.5px, 1.15vw, 17px);
            letter-spacing: 0.02em;
          }

          /* Right Column: Character is 100% visible from head to toe */
          .about-page.about-page--fit .about-page__image-col {
            position: relative;
            height: 100%;
            min-height: 0;
            max-height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: clamp(8px, 1.5vh, 20px) clamp(12px, 2vw, 28px);
            overflow: hidden;
          }

          .about-page.about-page--fit .about-page__character {
            position: relative;
            width: 100%;
            height: 100%;
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            object-position: center bottom;
            mix-blend-mode: multiply;
          }
        }
      `}</style>

      {/* Left — Text content */}
      <div className="about-page__content">
        <p className="about-page__eyebrow">About</p>

        <h1 className="about-page__title">CANOPUS</h1>

        <div className="about-page__rule" />

        <div className="about-page__body">
          <p>
            A private digital radio station for nostalgic Indian music, rebuilt for the modern club
            — presented through a mysterious editorial universe led by its masked host.
          </p>
          <p>
            Every record in the CANOPUS archive is an original production: experimental flips,
            retro tech house interpretations and electronic reinterpretations of songs from
            India's golden era of cinema and music.
          </p>
          <p>
            The music is created by reimagining beloved classics through a contemporary production
            lens — preserving the soul of the original while giving it a new life on the floor.
          </p>
        </div>

        <p className="about-page__tagline">
          Retro records, reimagined.
        </p>
      </div>

      {/* Right — Character */}
      <div className="about-page__image-col">
        <img
          className="about-page__character"
          src={characterUrl}
          alt="The CANOPUS host"
          draggable={false}
          onError={() => setCharacterUrl('/canopus-portrait.png')}
        />
      </div>
    </div>
  );
}
