/* ================================================================
   CANOPUS — Admin Character Panel
   Manage Home & About character images, upload new looks,
   switch active portraits from the gallery, or toggle shuffle mode.
   ================================================================ */

import { useState, useEffect, useRef } from 'react';
import {
  getCharacterSettings,
  updateCharacterSettings,
  uploadCharacterImage,
  resetCharacterSettings,
  deleteCharacterImage,
} from '../../services/characterService';

export default function AdminCharacterPanel() {
  const [settings, setSettings] = useState({
    homeCharacterUrl: '/canopus-portrait.png',
    aboutCharacterUrl: '/canopus-portrait.png',
    shuffleMode: false,
    gallery: ['/canopus-portrait.png'],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Upload modal / form state
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploadTarget, setUploadTarget] = useState('both'); // 'both', 'home', 'about', 'gallery'
  const fileInputRef = useRef(null);

  // Load character settings on mount
  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCharacterSettings();
      setSettings(data);
    } catch (err) {
      setError(err.message || 'Failed to load character settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Handle file select
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WEBP).');
      return;
    }

    setSelectedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setFilePreview(previewUrl);
    setError(null);
  };

  // Clear selected file
  const handleClearSelectedFile = () => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit Upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select an image file to upload.');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const updated = await uploadCharacterImage(selectedFile, uploadTarget);
      setSettings(updated);
      setSuccess(`Character image uploaded and set for ${uploadTarget === 'both' ? 'Home & About' : uploadTarget}!`);
      handleClearSelectedFile();
    } catch (err) {
      setError(err.message || 'Failed to upload character image.');
    } finally {
      setUploading(false);
    }
  };

  // Toggle Shuffle Mode
  const handleToggleShuffle = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const newShuffle = !settings.shuffleMode;
      const updated = await updateCharacterSettings({
        shuffleMode: newShuffle,
      });
      setSettings(updated);
      setSuccess(
        newShuffle
          ? 'Shuffle Mode activated: Visitors will see a random character on each visit!'
          : 'Shuffle Mode disabled: Fixed character assignments are now active.'
      );
    } catch (err) {
      setError(err.message || 'Failed to update shuffle mode.');
    } finally {
      setSaving(false);
    }
  };

  // Assign image from gallery to Home, About, or Both
  const handleSetGalleryImage = async (url, target) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updatePayload = {};
      if (target === 'home' || target === 'both') {
        updatePayload.homeCharacterUrl = url;
      }
      if (target === 'about' || target === 'both') {
        updatePayload.aboutCharacterUrl = url;
      }

      const updated = await updateCharacterSettings(updatePayload);
      setSettings(updated);
      setSuccess(`Character updated for ${target === 'both' ? 'Home & About' : target}!`);
    } catch (err) {
      setError(err.message || 'Failed to update character image.');
    } finally {
      setSaving(false);
    }
  };

  // Reset to default
  const handleReset = async (target) => {
    if (!window.confirm(`Reset ${target} character image to the default CANOPUS host portrait?`)) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updated = await resetCharacterSettings(target);
      setSettings(updated);
      setSuccess(`Reset ${target} character to default portrait.`);
    } catch (err) {
      setError(err.message || 'Failed to reset character image.');
    } finally {
      setSaving(false);
    }
  };

  // Delete from gallery
  const handleDeleteImage = async (url) => {
    if (url === '/canopus-portrait.png') {
      setError('Cannot delete the original default portrait.');
      return;
    }

    if (!window.confirm('Remove this image from your character gallery?')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updated = await deleteCharacterImage(url);
      setSettings(updated);
      setSuccess('Image deleted from character gallery.');
    } catch (err) {
      setError(err.message || 'Failed to delete character image.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-character-panel loading-state">
        <p>Loading character settings…</p>
      </div>
    );
  }

  return (
    <div className="admin-character-panel">
      {/* Panel Header */}
      <div className="admin-character-header">
        <div>
          <h2 className="admin-section-title">Character & Hero Artwork</h2>
          <p className="admin-section-subtitle">
            Upload and assign the mysterious host character images shown on the Home screen and About section.
            Turn on <strong>Shuffle Mode</strong> to give visitors a fresh editorial look on every visit.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="admin-alert admin-alert--error" role="alert">
          <span className="admin-alert__icon">⚠</span>
          <span>{error}</span>
          <button className="admin-alert__close" onClick={() => setError(null)}>×</button>
        </div>
      )}
      {success && (
        <div className="admin-alert admin-alert--success" role="alert">
          <span className="admin-alert__icon">✓</span>
          <span>{success}</span>
          <button className="admin-alert__close" onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      {/* Shuffle Mode Banner */}
      <div className={`admin-character-shuffle-card ${settings.shuffleMode ? 'active' : ''}`}>
        <div className="shuffle-info">
          <div className="shuffle-badge">
            {settings.shuffleMode ? '🎲 SHUFFLE MODE ACTIVE' : '🔒 FIXED ASSIGNMENT MODE'}
          </div>
          <h3 className="shuffle-title">Randomize Look on Every Visit</h3>
          <p className="shuffle-desc">
            {settings.shuffleMode
              ? `Site visitors are currently served a random character from your ${settings.gallery.length} gallery image${settings.gallery.length === 1 ? '' : 's'} on each visit or page refresh.`
              : 'Each page currently displays its specific assigned character image below. Turn this on to randomize the character for every customer visit.'}
          </p>
        </div>
        <button
          type="button"
          className={`btn-primary shuffle-toggle-btn ${settings.shuffleMode ? 'active' : ''}`}
          onClick={handleToggleShuffle}
          disabled={saving || uploading}
        >
          {settings.shuffleMode ? 'Disable Shuffle (Use Fixed)' : 'Enable Random Shuffle'}
        </button>
      </div>

      {/* Live Slots: Home & About */}
      <div className="admin-character-slots-grid">
        {/* Slot 1: Home Radio Screen */}
        <div className="admin-character-slot-card">
          <div className="slot-card-header">
            <div>
              <span className="slot-label">HOME RADIO SCREEN</span>
              <h4 className="slot-title">Hero Character</h4>
            </div>
            <span className={`slot-status-pill ${settings.homeCharacterUrl === '/canopus-portrait.png' ? 'default' : 'custom'}`}>
              {settings.homeCharacterUrl === '/canopus-portrait.png' ? 'DEFAULT PORTRAIT' : 'CUSTOM ART'}
            </span>
          </div>

          <div className="slot-preview-box">
            <img
              src={settings.homeCharacterUrl}
              alt="Home character preview"
              className="slot-preview-img"
              onError={(e) => { e.currentTarget.src = '/canopus-portrait.png'; }}
            />
            {settings.shuffleMode && (
              <div className="slot-shuffle-overlay">
                <span>Shuffling Active</span>
              </div>
            )}
          </div>

          <div className="slot-actions">
            <button
              type="button"
              className="btn-secondary slot-btn"
              onClick={() => handleReset('home')}
              disabled={saving || settings.homeCharacterUrl === '/canopus-portrait.png'}
            >
              Reset to Default
            </button>
            <button
              type="button"
              className="btn-secondary slot-btn"
              onClick={() => handleSetGalleryImage(settings.homeCharacterUrl, 'about')}
              disabled={saving || settings.homeCharacterUrl === settings.aboutCharacterUrl}
              title="Apply this exact image to About page too"
            >
              Copy to About
            </button>
          </div>
        </div>

        {/* Slot 2: About Section */}
        <div className="admin-character-slot-card">
          <div className="slot-card-header">
            <div>
              <span className="slot-label">ABOUT SECTION</span>
              <h4 className="slot-title">Host Portrait</h4>
            </div>
            <span className={`slot-status-pill ${settings.aboutCharacterUrl === '/canopus-portrait.png' ? 'default' : 'custom'}`}>
              {settings.aboutCharacterUrl === '/canopus-portrait.png' ? 'DEFAULT PORTRAIT' : 'CUSTOM ART'}
            </span>
          </div>

          <div className="slot-preview-box">
            <img
              src={settings.aboutCharacterUrl}
              alt="About character preview"
              className="slot-preview-img"
              onError={(e) => { e.currentTarget.src = '/canopus-portrait.png'; }}
            />
            {settings.shuffleMode && (
              <div className="slot-shuffle-overlay">
                <span>Shuffling Active</span>
              </div>
            )}
          </div>

          <div className="slot-actions">
            <button
              type="button"
              className="btn-secondary slot-btn"
              onClick={() => handleReset('about')}
              disabled={saving || settings.aboutCharacterUrl === '/canopus-portrait.png'}
            >
              Reset to Default
            </button>
            <button
              type="button"
              className="btn-secondary slot-btn"
              onClick={() => handleSetGalleryImage(settings.aboutCharacterUrl, 'home')}
              disabled={saving || settings.homeCharacterUrl === settings.aboutCharacterUrl}
              title="Apply this exact image to Home screen too"
            >
              Copy to Home
            </button>
          </div>
        </div>
      </div>

      {/* Upload New Character Form */}
      <div className="admin-character-upload-section">
        <h3 className="upload-section-title">Upload New Character Look</h3>
        <p className="upload-section-desc">
          Upload artwork with a transparent background or light clean backdrop. Supported formats: PNG, JPG, WEBP (up to 25MB).
        </p>

        <form onSubmit={handleUploadSubmit} className="upload-form">
          <div className="upload-dropzone">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
              id="character-file-input"
              className="upload-file-input"
            />
            <label htmlFor="character-file-input" className="upload-dropzone-label">
              {filePreview ? (
                <div className="upload-selected-preview">
                  <img src={filePreview} alt="Selected preview" className="preview-thumb" />
                  <div className="preview-meta">
                    <strong>{selectedFile?.name}</strong>
                    <span>{(selectedFile?.size / (1024 * 1024)).toFixed(2)} MB</span>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={(e) => { e.preventDefault(); handleClearSelectedFile(); }}
                    >
                      Choose different file
                    </button>
                  </div>
                </div>
              ) : (
                <div className="dropzone-empty">
                  <span className="dropzone-icon">📷</span>
                  <strong>Click or drag character image here</strong>
                  <span className="dropzone-sub">PNG with transparent background recommended</span>
                </div>
              )}
            </label>
          </div>

          <div className="upload-options-row">
            <div className="target-select-group">
              <label htmlFor="upload-target-select">Apply Uploaded Image To:</label>
              <select
                id="upload-target-select"
                value={uploadTarget}
                onChange={(e) => setUploadTarget(e.target.value)}
                className="admin-select"
              >
                <option value="both">Both Home & About (Recommended)</option>
                <option value="home">Home Screen Only</option>
                <option value="about">About Section Only</option>
                <option value="gallery">Gallery Pool Only (Do not activate yet)</option>
              </select>
            </div>

            <div className="upload-actions">
              <button
                type="submit"
                className="btn-primary upload-btn"
                disabled={!selectedFile || uploading || saving}
              >
                {uploading ? 'Uploading…' : 'Upload & Apply Character'}
              </button>
              {selectedFile && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleClearSelectedFile}
                  disabled={uploading}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Character Gallery Pool */}
      <div className="admin-character-gallery-section">
        <div className="gallery-header">
          <div>
            <h3 className="gallery-title">Character Gallery ({settings.gallery.length})</h3>
            <p className="gallery-desc">
              All available character looks. Click any button below an artwork to immediately set it for Home, About, or Both.
            </p>
          </div>
        </div>

        <div className="character-gallery-grid">
          {settings.gallery.map((url, index) => {
            const isHomeActive = settings.homeCharacterUrl === url;
            const isAboutActive = settings.aboutCharacterUrl === url;
            const isDefault = url === '/canopus-portrait.png';

            return (
              <div
                key={url}
                className={`gallery-card ${isHomeActive || isAboutActive ? 'is-active' : ''}`}
              >
                <div className="gallery-card__thumb-wrap">
                  <img
                    src={url}
                    alt={`Character ${index + 1}`}
                    className="gallery-card__thumb"
                    onError={(e) => { e.currentTarget.src = '/canopus-portrait.png'; }}
                  />
                  <div className="gallery-card__badges">
                    {isDefault && <span className="gallery-badge badge-default">Default</span>}
                    {isHomeActive && <span className="gallery-badge badge-home">✓ Home</span>}
                    {isAboutActive && <span className="gallery-badge badge-about">✓ About</span>}
                  </div>
                </div>

                <div className="gallery-card__actions">
                  <button
                    type="button"
                    className={`gallery-action-btn ${isHomeActive ? 'current' : ''}`}
                    onClick={() => handleSetGalleryImage(url, 'home')}
                    disabled={saving || isHomeActive}
                  >
                    {isHomeActive ? '● Home Active' : 'Set as Home'}
                  </button>
                  <button
                    type="button"
                    className={`gallery-action-btn ${isAboutActive ? 'current' : ''}`}
                    onClick={() => handleSetGalleryImage(url, 'about')}
                    disabled={saving || isAboutActive}
                  >
                    {isAboutActive ? '● About Active' : 'Set as About'}
                  </button>
                  <button
                    type="button"
                    className={`gallery-action-btn ${isHomeActive && isAboutActive ? 'current' : ''}`}
                    onClick={() => handleSetGalleryImage(url, 'both')}
                    disabled={saving || (isHomeActive && isAboutActive)}
                  >
                    Set Both
                  </button>
                  {!isDefault && (
                    <button
                      type="button"
                      className="gallery-action-btn delete-btn"
                      onClick={() => handleDeleteImage(url)}
                      disabled={saving}
                      title="Delete this image"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
