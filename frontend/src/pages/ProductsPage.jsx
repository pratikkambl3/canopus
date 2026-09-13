/* ================================================================
   CANOPUS — Products Store Page
   Minimal, luxury editorial digital album store.
   ================================================================ */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProducts } from '../services/storeService';
import { useCart } from '../context/CartContext';
import { useAudio } from '../context/AudioContext';
import { usePreviewPlayer } from '../hooks/usePreviewPlayer';
import { IconCheck, IconBag, IconPlay, IconPause, formatTime } from '../components/shared/Icons';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch]     = useState('');

  const { addToCart, isInCart, openCart } = useCart();
  const { state: audioState, actions: audioActions } = useAudio();
  const { activePreview, togglePreview } = usePreviewPlayer(30);

  useEffect(() => {
    getProducts()
      .then(data => setProducts(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const genres = ['All', ...Array.from(new Set(products.map(p => p.genre).filter(Boolean)))];

  const filtered = products.filter(p => {
    const matchesGenre = activeFilter === 'All' || p.genre?.toLowerCase() === activeFilter.toLowerCase();
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.title?.toLowerCase().includes(q) ||
      p.artist?.toLowerCase().includes(q) ||
      p.genre?.toLowerCase().includes(q);
    return matchesGenre && matchesSearch;
  });

  return (
    <main className="products-page page">
      {/* Header */}
      <section className="products-header">
        <div className="products-header__left">
          <p className="products-header__eyebrow">CANOPUS</p>
          <h1 className="products-header__title">Products</h1>
          <p className="products-header__tagline">
            <em>Take the music home. Explore the CANOPUS collection of timeless sounds, carefully curated and available as digital albums.</em>
          </p>
        </div>

        <div className="products-header__controls">
          {/* Genre filter */}
          {genres.length > 1 && (
            <div className="record-filters" role="group" aria-label="Filter products by genre">
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
            placeholder="Search digital albums…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search digital albums"
          />
        </div>
      </section>

      {/* Grid */}
      <section className="products-grid-section" aria-label="Digital products catalog">
        {loading ? (
          <p className="products-loading">Loading collection…</p>
        ) : filtered.length === 0 ? (
          <div className="products-empty">
            <p className="products-empty__title">
              {products.length === 0
                ? 'No digital albums are currently available for purchase.'
                : 'No albums match your search.'}
            </p>
            <p className="products-empty__sub">
              {products.length === 0
                ? 'New curated editions will be released soon.'
                : 'Try adjusting your search query or genre filter.'}
            </p>
          </div>
        ) : (
          <div className="products-grid">
            {filtered.map(product => {
              const inCart = isInCart(product.id);
              const trackCount = product.trackCount || product.tracks?.length || 0;
              const isThisPreview = activePreview.productId === product.id;
              const isPreviewPlaying = isThisPreview && activePreview.isPlaying;
              const isPreviewLoading = isThisPreview && activePreview.loading;
              const previewCurTime = isThisPreview ? activePreview.currentTime : 0;
              const previewMaxTime = product.previewDuration || (isThisPreview ? activePreview.maxDuration : 30);
              const previewPercent = Math.min(100, Math.max(0, (previewCurTime / previewMaxTime) * 100));

              return (
                <article key={product.id} className="product-card">
                  {/* Artwork Container */}
                  <Link to={`/products/${product.id}`} className="product-card__artwork-link" aria-label={`View ${product.title}`}>
                    <div className="product-card__artwork-wrap">
                      {product.artworkUrl ? (
                        <img
                          src={product.artworkUrl}
                          alt={product.title}
                          className="product-card__artwork"
                          loading="lazy"
                        />
                      ) : (
                        <div className="product-card__artwork product-card__artwork--placeholder">
                          <span>♫</span>
                        </div>
                      )}
                      <span className="product-card__badge">Digital Album</span>
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="product-card__info">
                    <Link to={`/products/${product.id}`} className="product-card__title-link">
                      <h3 className="product-card__title">{product.title}</h3>
                    </Link>
                    {product.artist && (
                      <p className="product-card__artist">{product.artist}</p>
                    )}
                    <p className="product-card__meta">
                      {[product.genre, product.releaseYear, trackCount > 0 ? `${trackCount} tracks` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>

                    {(product.description || product.productDescription) && (
                      <p className="product-card__description">
                        {product.description || product.productDescription}
                      </p>
                    )}

                    {/* Limited Audio Preview */}
                    <div className="product-card__preview">
                      <button
                        type="button"
                        className={`btn-preview product-card__preview-btn${isPreviewPlaying ? ' is-playing' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (audioState?.isPlaying) audioActions.pause();
                          togglePreview(product.id, product.firstTrackId || product.tracks?.[0]?.id, product.previewDuration);
                        }}
                        aria-label={isPreviewPlaying ? `Pause preview of ${product.title}` : `Play preview of ${product.title}`}
                      >
                        <span className="btn-preview__icon">
                          {isPreviewLoading ? (
                            <span className="preview-spinner" />
                          ) : isPreviewPlaying ? (
                            <IconPause />
                          ) : (
                            <IconPlay />
                          )}
                        </span>
                        <span className="btn-preview__label">
                          {isPreviewLoading ? (
                            'Loading preview…'
                          ) : isPreviewPlaying ? (
                            `Preview ${formatTime(previewCurTime)} / ${formatTime(previewMaxTime)}`
                          ) : (
                            `Play Preview (${product.previewDuration || 30}s)`
                          )}
                        </span>
                      </button>

                      {isPreviewPlaying && (
                        <div className="product-card__preview-progress-track">
                          <div
                            className="product-card__preview-progress-bar"
                            style={{ width: `${previewPercent}%` }}
                          />
                        </div>
                      )}

                      {isThisPreview && activePreview.error && (
                        <p className="product-card__preview-error">{activePreview.error}</p>
                      )}
                    </div>

                    <div className="product-card__footer">
                      <div className="product-card__price-wrap">
                        <span className="product-card__price-label">Price</span>
                        <span className="product-card__price">₹{product.price}</span>
                      </div>

                      <div className="product-card__actions">
                        <button
                          type="button"
                          className={`btn-primary product-card__add-btn${inCart ? ' product-card__add-btn--incart' : ''}`}
                          onClick={() => {
                            if (inCart) {
                              openCart();
                            } else {
                              addToCart(product);
                            }
                          }}
                          aria-label={inCart ? `${product.title} is in cart (view cart)` : `Add ${product.title} to cart`}
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
                        <Link to={`/products/${product.id}`} className="btn-secondary product-card__view-btn">
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

