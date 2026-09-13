import MiniPlayer from '../components/layout/MiniPlayer';

export default function AboutPage() {
  return (
    <div className="about-page page">
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
          src="/canopus-portrait.png"
          alt="The CANOPUS host"
          draggable={false}
        />
      </div>

      {/* Persistent mini player */}
      <MiniPlayer />
    </div>
  );
}
