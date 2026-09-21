import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProduct } from '../services/storeService';
import { useCart } from '../context/CartContext';
import { useAudio } from '../context/AudioContext';
import {
  IconPlay, IconPause, IconPlayCircle, IconBag, IconCheck, formatTime,
} from '../components/shared/Icons';
import IntegratedPlayer from '../components/shared/IntegratedPlayer';

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

export default function ProductDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  const { addToCart, isInCart } = useCart();
  const { state: audioState, actions: audioActions } = useAudio();

  useEffect(() => {
    window.scrollTo(0, 0);
    getProduct(id)
      .then(p => setProduct(p))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="product-detail-page page">
        <div className="product-detail__loading">Loading album…</div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="product-detail-page page">
        <div className="product-detail__empty">
          <h2>Album not found</h2>
          <p>This product may no longer be available in our collection.</p>
          <Link to="/products" className="btn-secondary">Return to Products</Link>
        </div>
      </main>
    );
  }

  const tracks = product.tracks || [];
  const inCart = isInCart(product.id);

  /* Enrich tracks for unified audio context playback */
  const enrichedTracks = tracks.map((t, idx) => ({
    id: t.id || `${product.id}-track-${idx}`,
    title: t.title,
    originalTitle: t.originalTitle,
    version: t.version,
    bpm: (t.bpm && Number(t.bpm) > 0) ? Number(t.bpm) : null,
    key: t.key,
    duration: t.duration || null,
    artworkUrl: t.artworkUrl || product.artworkUrl || null,
    audioUrl: t.audioUrl || t.previewUrl || `/api/products/${product.id}/preview?trackId=${t.id}`,
    artist: product.artist || 'CANOPUS',
    albumTitle: product.title,
    productId: product.id,
    genre: product.genre || '',
  }));

  const isProductActive  = enrichedTracks.some(t => t.id === audioState.currentTrackId);
  const isProductPlaying = isProductActive && audioState.isPlaying;

  const previewTrackId = product.previewTrackId || product.firstTrackId || tracks[0]?.id || null;
  const isHeroActive  = audioState.currentTrackId === (previewTrackId || enrichedTracks[0]?.id);
  const isHeroPlaying = isHeroActive && audioState.isPlaying;
  const heroCurTime   = isHeroActive ? audioState.currentTime : 0;
  const heroTrack     = tracks.find(t => t.id === previewTrackId) || tracks[0];
  const heroMaxTime   = isHeroActive && audioState.duration > 0
    ? audioState.duration
    : ((heroTrack?.duration && Number(heroTrack.duration) > 0) ? Number(heroTrack.duration) : 0);

  const handleHeroPreview = () => {
    if (!enrichedTracks.length) return;
    const targetId = previewTrackId || enrichedTracks[0].id;
    if (audioState.currentTrackId === targetId) {
      audioActions.togglePlay();
      return;
    }
    if (!isProductActive) {
      audioActions.loadTracks(enrichedTracks);
    }
    audioActions.selectTrack(targetId);
  };

  const handleTrackPreview = (trackId, e) => {
    e?.stopPropagation();
    if (audioState.currentTrackId === trackId) {
      audioActions.togglePlay();
      return;
    }
    if (!isProductActive) {
      audioActions.loadTracks(enrichedTracks);
    }
    audioActions.selectTrack(trackId);
  };

  const handlePlayAll = () => {
    if (!enrichedTracks.length) return;
    audioActions.loadTracks(enrichedTracks);
    audioActions.selectTrack(enrichedTracks[0].id);
  };

  const handleBuyNow = () => {
    addToCart(product);
    navigate('/checkout');
  };


  return (
    <main className="product-detail-page page">
      {/* Breadcrumb */}
      <nav className="product-detail__breadcrumb" aria-label="Breadcrumb">
        <Link to="/products">Products</Link>
        <span>/</span>
        <span>{product.title}</span>
      </nav>

      {/* Main Hero: 3-column editorial grid */}
      <section className="product-hero">
        {/* Left: Artwork + Vinyl */}
        <div className="product-hero__artwork-col">
          <div className="product-hero__artwork-wrap">
            <div className="product-hero__vinyl" aria-hidden="true">
              <VinylDisc />
            </div>
            <div className="product-hero__cover-shadow">
              {product.artworkUrl ? (
                <img src={product.artworkUrl} alt={product.title} className="product-hero__cover" />
              ) : (
                <div className="product-hero__cover product-hero__cover--placeholder">♫</div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Title, artist, metadata, actions */}
        <div className="product-hero__info-col">
          <p className="product-hero__eyebrow">DIGITAL ALBUM</p>
          <h1 className="product-hero__title">{product.title}</h1>
          {product.artist && <p className="product-hero__artist">{product.artist}</p>}

          <div className="product-hero__meta">
            {product.genre && <span>{product.genre}</span>}
            {product.releaseYear && <><span className="product-hero__meta-sep">/</span><span>{product.releaseYear}</span></>}
            {tracks.length > 0 && <><span className="product-hero__meta-sep">/</span><span>{tracks.length} {tracks.length === 1 ? 'TRACK' : 'TRACKS'}</span></>}
          </div>

          <p className="product-hero__description">
            {product.productDescription || product.description || 'Mastered high-fidelity audio release from the CANOPUS archives.'}
          </p>

          <div className="product-hero__price-box">
            <span className="product-hero__price-label">Price</span>
            <span className="product-hero__price">₹{product.price}</span>
          </div>

          <div className="product-hero__actions">
            {tracks.length > 0 && product.previewEnabled !== false && (
              <button
                type="button"
                className={`btn-preview product-hero__preview-btn${isHeroPlaying ? ' is-playing' : ''}`}
                onClick={handleHeroPreview}
                aria-label={isHeroPlaying ? 'Pause preview' : 'Play preview'}
              >
                <span className="btn-preview__icon">
                  {isHeroPlaying ? (
                    <IconPause />
                  ) : (
                    <IconPlay />
                  )}
                </span>
                <span className="btn-preview__label">
                  {isHeroPlaying
                    ? `Playing ${formatTime(heroCurTime)}${heroMaxTime > 0 ? ` / ${formatTime(heroMaxTime)}` : ''}`
                    : `Play Preview${product.previewTrack?.title ? `: ${product.previewTrack.title}` : ''}`}
                </span>
              </button>
            )}

            <button
              type="button"
              className={`btn-primary product-hero__add-btn${inCart ? ' product-hero__add-btn--incart' : ''}`}
              onClick={() => addToCart(product)}
            >
              {inCart ? (
                <>
                  <IconCheck /> In Cart
                </>
              ) : (
                <>
                  <IconBag /> Add to Cart
                </>
              )}
            </button>

            <button
              type="button"
              className="btn-secondary product-hero__buynow-btn"
              onClick={handleBuyNow}
            >
              Buy Now
            </button>
          </div>
        </div>

        {/* Right: Specifications panel */}
        <aside className="product-hero__specs-col">
          <div className="product-specs">
            <p className="product-specs__heading">DIGITAL ALBUM</p>
            <dl className="product-specs__list">
              <dt className="product-specs__label">FORMAT</dt>
              <dd className="product-specs__value">ZIP Download</dd>

              <dt className="product-specs__label">DELIVERY</dt>
              <dd className="product-specs__value">Email Link</dd>

              <dt className="product-specs__label">AUDIO</dt>
              <dd className="product-specs__value">Original High-Quality</dd>

              <dt className="product-specs__label">TRACKS</dt>
              <dd className="product-specs__value">{tracks.length}</dd>

              <dt className="product-specs__label">PREVIEW</dt>
              <dd className="product-specs__value">
                Full Track
              </dd>

              <dt className="product-specs__label">PRICE</dt>
              <dd className="product-specs__value">₹{product.price}</dd>
            </dl>

            <div className="product-specs__note">
              Digital album. Secure download link delivered to your email address immediately after payment verification.
            </div>
          </div>
        </aside>
      </section>

      {/* Track Preview Section */}
      <section className="product-tracks-section">
        <div className="product-tracks__header">
          <div className="product-tracks__header-left">
            <h2 className="product-tracks__title">
              {product.previewEnabled === false ? 'Tracklist' : 'Tracklist Preview'}
            </h2>
            {isProductActive && (
              <span className="product-tracks__active-pill">
                <span className="tracklist-head__pulse" />
                {isProductPlaying ? 'NOW PLAYING' : 'AUDIO READY'}
              </span>
            )}
          </div>
          <div className="product-tracks__header-right">
            {tracks.length > 1 && (
              <button
                type="button"
                className="btn-secondary btn-sm product-tracks__playall-btn"
                onClick={handlePlayAll}
              >
                <IconPlay /> Play All
              </button>
            )}
            <span className="product-tracks__count">{tracks.length} {tracks.length === 1 ? 'Track' : 'Tracks'}</span>
          </div>
        </div>

        {/* Integrated Player Console inside Product Section */}
        {isProductActive && (
          <div className="product-tracks__player-wrap">
            <IntegratedPlayer
              variant="inline"
              subtitle={`${product.title}${product.artist ? ` · ${product.artist}` : ''}`}
            />
          </div>
        )}

        {tracks.length === 0 ? (
          <p className="product-tracks__empty">No tracks available.</p>
        ) : (
          <ol className="product-tracklist" aria-label="Album tracks">
            {tracks.map((track, idx) => {
              const isTrackActive  = audioState.currentTrackId === track.id;
              const isTrackPlaying = isTrackActive && audioState.isPlaying;
              const thumb = track.artworkUrl || product.artworkUrl || null;

              return (
                <li key={track.id} className={`product-track-row${isTrackActive ? ' active' : ''}`}>
                  <button
                    type="button"
                    className="product-track-row__btn"
                    onClick={(e) => handleTrackPreview(track.id, e)}
                    aria-label={`Play ${track.title}`}
                  >
                    <span className="product-track-row__num">
                      {isTrackPlaying ? (
                        <span className="track-row__bars"><span/><span/><span/></span>
                      ) : (
                        String(idx + 1).padStart(2, '0')
                      )}
                    </span>

                    {thumb ? (
                      <img src={thumb} alt={track.title} className="product-track-row__thumb" loading="lazy" />
                    ) : (
                      <div className="product-track-row__thumb product-track-row__thumb--placeholder">♫</div>
                    )}

                    <div className="product-track-row__info">
                      <p className="product-track-row__title">{track.title}</p>
                      {track.originalTitle && <p className="product-track-row__sub">{track.originalTitle}</p>}
                    </div>

                    {track.bpm && Number(track.bpm) > 0 && (
                      <span className="product-track-row__bpm">{track.bpm} BPM</span>
                    )}

                    <span className="product-track-row__dur">
                      {isTrackPlaying
                        ? `${formatTime(audioState.currentTime)} / ${formatTime(track.duration || audioState.duration || 0)}`
                        : track.duration
                        ? formatTime(track.duration)
                        : '—'}
                    </span>

                    <span className="product-track-row__icon" aria-hidden="true">
                      {isTrackPlaying ? (
                        <IconPause />
                      ) : (
                        <IconPlayCircle />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
