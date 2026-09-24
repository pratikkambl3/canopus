/* ================================================================
   CANOPUS — Digital Download Landing Page
   Secure, cross-platform album download with vinyl styling,
   direct stream trigger, and OS-specific instructions.
   ================================================================ */

import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { IconCheck, IconDownload, IconCopy } from '../components/shared/Icons';

export default function DownloadPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadTriggered, setDownloadTriggered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState('mac'); // 'mac' | 'windows' | 'mobile'

  const hasAutoTriggered = useRef(false);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (_) {
      return dateStr;
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    setError(null);

    fetch(`/api/download/${token}/info`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.valid) {
          throw new Error(json.error || 'Download link not found or has expired.');
        }
        setData(json);
        setLoading(false);

        // Auto-trigger download once seamlessly on first page load
        if (!hasAutoTriggered.current) {
          hasAutoTriggered.current = true;
          // Slight delay so the user sees the page render before the browser triggers download
          setTimeout(() => {
            triggerFileDownload(token);
          }, 800);
        }
      })
      .catch((err) => {
        setError(err.message || 'Unable to verify download link.');
        setLoading(false);
      });
  }, [token]);

  const triggerFileDownload = (tk) => {
    setDownloadTriggered(true);
    const downloadUrl = `/api/download/${tk}`;
    
    // Create hidden link and click to initiate trusted browser download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyDirectLink = () => {
    const fullUrl = `${window.location.origin}/api/download/${token}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    } else {
      const input = document.createElement('input');
      input.value = fullUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return (
      <main className="confirmation-page page">
        <div className="confirmation-card" style={{ maxWidth: 540 }}>
          <p className="confirmation-card__eyebrow">CANOPUS SECURE ARCHIVE</p>
          <div style={{ margin: '40px 0' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                border: '2px solid var(--border-mid, #e8e2da)',
                borderTopColor: 'var(--text-primary, #1a1a1a)',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 20px',
              }}
            />
            <p style={{ color: 'var(--text-secondary, #666)', fontSize: 14 }}>
              Preparing your digital master…
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="confirmation-page page">
        <div className="confirmation-card" style={{ maxWidth: 560 }}>
          <p className="confirmation-card__eyebrow">CANOPUS ARCHIVE</p>
          <div className="confirmation-badge confirmation-badge--rejected">
            Link Unavailable
          </div>
          <h1 className="confirmation-card__title">Unable to Download</h1>
          <p className="confirmation-card__lead" style={{ color: '#b91c1c' }}>
            {error || 'This download link has expired or reached its maximum usage limit.'}
          </p>
          <div className="confirmation-card__notice">
            <p>
              Download links remain valid for 7 days from payment verification. If you need a new link or purchased this album recently, please reach out to our team with your order reference.
            </p>
          </div>
          <div className="confirmation-card__actions" style={{ marginTop: 24 }}>
            <Link to="/support" className="btn-primary" style={{ textDecoration: 'none' }}>
              Contact Support
            </Link>
            <Link to="/products" className="btn-secondary" style={{ textDecoration: 'none' }}>
              Browse Store
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="confirmation-page page" style={{ padding: '40px 20px' }}>
      <div className="confirmation-card" style={{ maxWidth: 680, textAlign: 'left' }}>
        
        {/* Top Header Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <p className="confirmation-card__eyebrow" style={{ margin: 0 }}>CANOPUS · DIGITAL MASTER</p>
          <div className="confirmation-badge confirmation-badge--paid" style={{ margin: 0 }}>
            <IconCheck /> Ready to Download
          </div>
        </div>

        {/* Album Showcase Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(140px, 180px) 1fr',
            gap: 24,
            alignItems: 'center',
            background: 'var(--ivory-warm, #f7f4f0)',
            border: '1px solid var(--border, #e8e2da)',
            padding: 24,
            borderRadius: 4,
            marginBottom: 24,
          }}
        >
          {/* Artwork Showcase with Vinyl Disk Silhouette */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1' }}>
            {/* Vinyl record peek effect */}
            <div
              style={{
                position: 'absolute',
                top: 4,
                right: -12,
                width: '92%',
                height: '92%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, #1a1a1a 30%, #2b2b2b 35%, #111111 60%, #1e1e1e 70%, #0d0d0d 100%)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '32%',
                  height: '32%',
                  borderRadius: '50%',
                  background: '#d4af37',
                  border: '3px solid #111',
                }}
              />
            </div>

            {/* Artwork Cover */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                zIndex: 2,
                borderRadius: 2,
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                background: '#222',
              }}
            >
              {data.artworkUrl ? (
                <img
                  src={data.artworkUrl}
                  alt={data.albumTitle}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#888',
                    fontFamily: 'Playfair Display, Georgia, serif',
                    fontSize: 20,
                  }}
                >
                  CANOPUS
                </div>
              )}
            </div>
          </div>

          {/* Details Column */}
          <div>
            <span
              style={{
                display: 'inline-block',
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-muted, #7a7a7a)',
                marginBottom: 6,
                fontWeight: 600,
              }}
            >
              {data.genre || 'Digital Album Archive'}
            </span>
            <h1
              style={{
                fontFamily: 'var(--font-display, Playfair Display, Georgia, serif)',
                fontSize: 24,
                lineHeight: 1.2,
                margin: '0 0 6px',
                color: 'var(--text-primary, #1a1a1a)',
              }}
            >
              {data.albumTitle}
            </h1>
            {data.artist && (
              <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-secondary, #444)', fontWeight: 500 }}>
                by {data.artist}
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: 'var(--text-muted, #7a7a7a)' }}>
              <span>Format: <strong>ZIP Archive</strong></span>
              {data.fileSize ? <span>Size: <strong>{formatBytes(data.fileSize)}</strong></span> : null}
              {data.orderNumber && <span>Order: <strong>#{data.orderNumber}</strong></span>}
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <button
            onClick={() => triggerFileDownload(token)}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '16px 28px',
              fontSize: 14,
              letterSpacing: '0.14em',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: 'pointer',
              borderRadius: 3,
            }}
          >
            <span style={{ width: 18, height: 18 }}><IconDownload /></span>
            Download Album (.ZIP)
          </button>

          {downloadTriggered && (
            <p
              style={{
                margin: '12px 0 0',
                fontSize: 13,
                color: '#15803d',
                background: '#f0fdf4',
                padding: '8px 12px',
                borderRadius: 4,
                border: '1px solid #bbf7d0',
              }}
            >
              ✓ Download initiated! Check your browser&apos;s download tray or folder.
            </p>
          )}
        </div>

        {/* Direct Link & Secondary Fallbacks */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            padding: '14px 18px',
            background: 'var(--ivory, #fff)',
            border: '1px solid var(--border-mid, #e8e2da)',
            borderRadius: 3,
            marginBottom: 24,
            fontSize: 13,
          }}
        >
          <div>
            <span style={{ color: 'var(--text-secondary, #666)' }}>Direct File URL: </span>
            <a
              href={`/api/download/${token}`}
              download={data.fileName || 'album.zip'}
              style={{ color: 'var(--text-primary, #1a1a1a)', fontWeight: 600, textDecoration: 'underline' }}
            >
              Direct Download (.ZIP)
            </a>
          </div>

          <button
            onClick={copyDirectLink}
            style={{
              background: 'none',
              border: '1px solid var(--border-mid, #d4cecb)',
              padding: '6px 12px',
              borderRadius: 2,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              color: 'var(--text-primary, #1a1a1a)',
            }}
          >
            <span style={{ width: 14, height: 14 }}><IconCopy /></span>
            {copied ? 'Copied!' : 'Copy Direct Link'}
          </button>
        </div>

        {/* Device & OS Download Guide Tabs */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border, #e8e2da)', marginBottom: 16 }}>
            <button
              onClick={() => setActiveHelpTab('mac')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeHelpTab === 'mac' ? '2px solid var(--text-primary, #1a1a1a)' : '2px solid transparent',
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: activeHelpTab === 'mac' ? 600 : 400,
                color: activeHelpTab === 'mac' ? 'var(--text-primary, #1a1a1a)' : 'var(--text-muted, #7a7a7a)',
                cursor: 'pointer',
              }}
            >
               Mac (macOS)
            </button>
            <button
              onClick={() => setActiveHelpTab('windows')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeHelpTab === 'windows' ? '2px solid var(--text-primary, #1a1a1a)' : '2px solid transparent',
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: activeHelpTab === 'windows' ? 600 : 400,
                color: activeHelpTab === 'windows' ? 'var(--text-primary, #1a1a1a)' : 'var(--text-muted, #7a7a7a)',
                cursor: 'pointer',
              }}
            >
              ⊞ Windows
            </button>
            <button
              onClick={() => setActiveHelpTab('mobile')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeHelpTab === 'mobile' ? '2px solid var(--text-primary, #1a1a1a)' : '2px solid transparent',
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: activeHelpTab === 'mobile' ? 600 : 400,
                color: activeHelpTab === 'mobile' ? 'var(--text-primary, #1a1a1a)' : 'var(--text-muted, #7a7a7a)',
                cursor: 'pointer',
              }}
            >
              📱 Mobile (iOS / Android)
            </button>
          </div>

          <div
            style={{
              background: 'var(--ivory-warm, #f7f4f0)',
              padding: 16,
              borderRadius: 3,
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--text-secondary, #444)',
            }}
          >
            {activeHelpTab === 'mac' && (
              <div>
                <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--text-primary, #1a1a1a)' }}>
                  Downloading on Mac (Safari / Chrome):
                </p>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Click the <strong>Download Album (.ZIP)</strong> button above.</li>
                  <li>If Safari shows <em>&ldquo;Do you want to allow downloads on this site?&rdquo;</em>, click <strong>Allow</strong>.</li>
                  <li>Find the ZIP file in your <strong>Downloads</strong> folder (or Finder ⌥⌘L) and double-click to automatically decompress into high-res MP3/WAV tracks and album art.</li>
                  <li>Drag the unzipped folder straight into Apple Music or your favorite player.</li>
                </ol>
              </div>
            )}

            {activeHelpTab === 'windows' && (
              <div>
                <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--text-primary, #1a1a1a)' }}>
                  Downloading on Windows (Chrome / Edge):
                </p>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Click <strong>Download Album (.ZIP)</strong> above. The file will save to your <strong>Downloads</strong> folder.</li>
                  <li>If Edge displays a security download warning, click the three dots (&hellip;) &rarr; select <strong>Keep</strong> &rarr; <strong>Keep anyway</strong>.</li>
                  <li>Open File Explorer, right-click the downloaded <code>.zip</code> file, and choose <strong>Extract All&hellip;</strong>.</li>
                  <li>Enjoy your high-fidelity music on Windows Media Player, VLC, or Foobar2000.</li>
                </ol>
              </div>
            )}

            {activeHelpTab === 'mobile' && (
              <div>
                <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--text-primary, #1a1a1a)' }}>
                  Downloading on iPhone, iPad & Android:
                </p>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li><strong>iPhone / iPad:</strong> Tap Download &rarr; Open the native <strong>Files</strong> app &rarr; <strong>Downloads</strong>. Tap the <code>.zip</code> file once to extract the songs.</li>
                  <li><strong>Android:</strong> Open your <strong>Files</strong> or <strong>My Files</strong> app &rarr; Tap the downloaded ZIP &rarr; Tap <strong>Extract</strong>.</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Security & Access Notice */}
        <div className="confirmation-card__notice" style={{ margin: 0 }}>
          <p style={{ margin: 0 }}>
            This secure token is valid until <strong>{formatDate(data.expiresAt)}</strong>. 
            Remaining downloads: <strong>{data.downloadsRemaining ?? (data.maxDownloads - data.downloadCount)}</strong> of {data.maxDownloads}. 
            Need help? Reply to your order email or visit our <Link to="/support" style={{ color: 'inherit', textDecoration: 'underline' }}>support page</Link>.
          </p>
        </div>

        {/* Footer Navigation */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {data.orderId ? (
            <Link
              to={`/order-confirmation/${data.orderId}`}
              className="btn-ghost"
              style={{ textDecoration: 'none', fontSize: 13 }}
            >
              View Order Receipt
            </Link>
          ) : (
            <div />
          )}

          <Link
            to="/products"
            className="btn-secondary"
            style={{ textDecoration: 'none', fontSize: 13 }}
          >
            Explore More Releases
          </Link>
        </div>

      </div>
    </main>
  );
}
