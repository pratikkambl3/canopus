import { useState, useRef, useEffect } from 'react';
import ThemeSelector from './ThemeSelector';
import { ONLINE_COUNT } from '../data/config';

const THEMES = [
  { id: 'golden-era', label: 'Golden Era' },
  { id: 'midnight-vinyl', label: 'Midnight Vinyl' },
  { id: 'sepia-lounge', label: 'Sepia Lounge' },
  { id: 'ivory-club', label: 'Ivory Club' },
  { id: 'canopus', label: 'Canopus' },
];

export default function Header({
  currentTheme,
  onThemeChange,
  onNavClick,
  onMenuOpen,
  isPlaying = false,
  currentTrack = null,
  mode = 'radio',
}) {
  const [themeOpen, setThemeOpen] = useState(false);
  const themeBtnRef = useRef(null);

  // Close theme selector when clicking outside
  useEffect(() => {
    if (!themeOpen) return;
    const handler = (e) => {
      if (themeBtnRef.current && !themeBtnRef.current.contains(e.target)) {
        setThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [themeOpen]);

  const currentThemeLabel =
    THEMES.find((t) => t.id === currentTheme)?.label || 'Golden Era';

  /* Now-playing label */
  const nowPlayingLabel = isPlaying
    ? mode === 'radio'
      ? 'Golden Era Radio'
      : currentTrack?.title || null
    : null;

  return (
    <header className="header fade-in-header">
      {/* LEFT */}
      <div className="header__left">
        <div className="header__emblem" aria-hidden="true">
          <div className="header__emblem-inner" />
        </div>
        <span className="header__brand-name">Golden Era</span>
        <div className="header__divider" aria-hidden="true" />
        <div className="header__online">
          <span className="header__online-dot" aria-hidden="true" />
          <span>{ONLINE_COUNT} online</span>
        </div>

        {/* Now Playing Ticker */}
        {nowPlayingLabel && (
          <div className="header__now-playing" aria-live="polite" aria-label={`Now playing: ${nowPlayingLabel}`}>
            <div className="header__now-playing-bars" aria-hidden="true">
              <span className="header__bar" />
              <span className="header__bar" />
              <span className="header__bar" />
              <span className="header__bar" />
            </div>
            <span className="header__now-playing-text">{nowPlayingLabel}</span>
          </div>
        )}
      </div>

      {/* CENTER */}
      <div className="header__center" ref={themeBtnRef}>
        <button
          className="header__theme-btn"
          onClick={() => setThemeOpen(!themeOpen)}
          aria-expanded={themeOpen}
          aria-label="Change theme"
        >
          Change Theme
          <span className="header__theme-chevron" aria-hidden="true">▾</span>
        </button>

        {themeOpen && (
          <ThemeSelector
            themes={THEMES}
            current={currentTheme}
            onSelect={(id) => {
              onThemeChange(id);
              setThemeOpen(false);
            }}
          />
        )}
      </div>

      {/* RIGHT */}
      <nav className="header__right" aria-label="Main navigation">
        <button
          className="header__nav-link"
          onClick={() => onNavClick('radio')}
          aria-label="Radio"
        >
          Radio
        </button>
        <button
          className="header__nav-link"
          onClick={() => onNavClick('records')}
          aria-label="The Records"
        >
          The Records
        </button>
        <button
          className="header__nav-link"
          onClick={() => onNavClick('about')}
          aria-label="About"
        >
          About
        </button>
        <button
          className="header__cta"
          onClick={() => onNavClick('club')}
          aria-label="Enter the Club"
        >
          Enter the Club
        </button>
      </nav>

      {/* MOBILE MENU BUTTON */}
      <button
        className="header__menu-btn"
        onClick={onMenuOpen}
        aria-label="Open menu"
      >
        <span className="header__menu-line" />
        <span className="header__menu-line" />
        <span className="header__menu-line" />
      </button>
    </header>
  );
}
