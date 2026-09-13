import { useState, useId } from 'react';

const GENRES = ['Experimental', 'Tech House', 'Remix', 'Bollywood', 'Pop', 'Rock', 'Jazz', 'Electronic', 'Hip Hop', 'Country'];

const emptyTrack = () => ({
  title:        '',
  originalTitle: '',
  version:      '',
  bpm:          '',
  key:          '',
  audioFile:    null,
  audioUrl:     '',
  artworkFile:  null,
  artworkUrl:   '',
  artworkPreview: null,
});

export default function AddRecordForm({ initialData, onSuccess, onCancel }) {
  const uid    = useId();
  const isEdit = !!initialData;

  const [form, setForm] = useState(() =>
    isEdit
      ? {
          title:       initialData.title       ?? '',
          genre:       initialData.genre       ?? 'Experimental',
          releaseDate: initialData.releaseDate ?? '',
          artist:      initialData.artist      ?? '',
          description: initialData.description ?? '',
          featured:    initialData.featured    ?? false,
          price:       initialData.price ?? initialData.product_price ?? 0,
        }
      : {
          title: '', genre: 'Experimental', releaseDate: '',
          artist: '', description: '', featured: false,
          price: 0,
        }
  );

  const [artworkFile, setArtworkFile]       = useState(null);
  const [artworkPreview, setArtworkPreview] = useState(isEdit ? initialData.artworkUrl || null : null);

  /* Tracks state — seeded from existing tracks when editing */
  const [tracks, setTracks] = useState(() => {
    if (isEdit && initialData.tracks?.length > 0) {
      return initialData.tracks.map(t => ({
        id:           t.id,
        title:        t.title        ?? '',
        originalTitle: t.originalTitle ?? '',
        version:      t.version      ?? '',
        bpm:          (t.bpm && Number(t.bpm) > 0) ? t.bpm : '',
        key:          t.key          ?? '',
        audioFile:    null,
        audioUrl:     t.audioUrl     ?? '',
        artworkFile:  null,
        artworkUrl:   t.artworkUrl   ?? '',
        artworkPreview: t.artworkUrl || null,
      }));
    }
    return [emptyTrack()];
  });

  const [progress, setProgress] = useState(0);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState('');

  /* Form field updater */
  const set = field => e => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [field]: val }));
  };

  /* Album artwork */
  const handleAlbumArtwork = e => {
    const file = e.target.files[0];
    if (!file) return;
    setArtworkFile(file);
    setArtworkPreview(URL.createObjectURL(file));
  };

  /* Track field updater */
  const updateTrack = (index, field, val) => {
    setTracks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  /* Per-track artwork */
  const handleTrackArtwork = (index, file) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setTracks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], artworkFile: file, artworkPreview: preview };
      return next;
    });
  };

  const removeTrackArtwork = index => {
    setTracks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], artworkFile: null, artworkUrl: '', artworkPreview: null };
      return next;
    });
  };

  const addTrackSlot    = () => setTracks(prev => [...prev, emptyTrack()]);
  const removeTrackSlot = idx => setTracks(prev => prev.filter((_, i) => i !== idx));

  /* ── Submit ── */
  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Record title is required.'); return; }
    if (tracks.length === 0) { setError('Please add at least one track.'); return; }

    setError(''); setSaving(true); setSuccess(false); setProgress(0);

    try {
      const formData = new FormData();
      const recordId = isEdit ? initialData.id : `record-${Date.now()}`;

      formData.append('id',          recordId);
      formData.append('title',       form.title);
      formData.append('genre',       form.genre);
      formData.append('releaseDate', form.releaseDate);
      formData.append('featured',    form.featured);
      formData.append('price',       String(form.price || 0));
      formData.append('artist',      form.artist || '');
      formData.append('description', form.description || '');

      if (isEdit && initialData.artworkUrl) formData.append('artworkUrl', initialData.artworkUrl);
      if (artworkFile) formData.append('artworkFile', artworkFile);

      /* Build tracks payload — track both audio and artwork file indices */
      let audioFileIdx   = 0;
      let artworkFileIdx = 0;

      const tracksData = tracks.map(t => {
        const parsedBpm = parseInt(t.bpm, 10);
        const validBpm = !isNaN(parsedBpm) && parsedBpm > 0 ? parsedBpm : null;

        const payload = {
          id:           t.id,
          title:        t.title,
          originalTitle: t.originalTitle,
          version:      t.version,
          bpm:          validBpm,
          key:          t.key,
          audioUrl:     t.audioUrl,
          artworkUrl:   t.artworkUrl,
        };

        if (t.audioFile) {
          formData.append('audioFiles', t.audioFile);
          payload.audioFileIndex = audioFileIdx++;
        }
        if (t.artworkFile) {
          formData.append('trackArtworkFiles', t.artworkFile);
          payload.artworkFileIndex = artworkFileIdx++;
        }

        return payload;
      });

      formData.append('tracksData', JSON.stringify(tracksData));

      /* XHR for upload progress */
      await new Promise((resolve, reject) => {
        const xhr   = new XMLHttpRequest();
        const BASE  = import.meta.env.VITE_API_URL || '/api';
        const token = localStorage.getItem('canopus_token');

        xhr.upload.addEventListener('progress', ev => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try {
              const { error: msg } = JSON.parse(xhr.responseText);
              reject(new Error(msg || `Save failed: ${xhr.status}`));
            } catch { reject(new Error(`Save failed: ${xhr.status}`)); }
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network error.')));

        const url = isEdit
          ? `${BASE}/records/${initialData.id}`
          : `${BASE}/records`;
        xhr.open(isEdit ? 'PUT' : 'POST', url);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });

      setSuccess(true);
      setTimeout(() => onSuccess(), 1200);
    } catch (err) {
      setError(err.message || 'Failed to save record.');
      setSaving(false);
      setProgress(0);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* ── Record Details ── */}
      <h3 className="admin-section-heading">Record Details</h3>

      <div className="form-field">
        <label htmlFor={`${uid}-title`}>Record Title *</label>
        <input id={`${uid}-title`} value={form.title} onChange={set('title')} required placeholder="Album or EP Name" />
      </div>

      <div className="form-field">
        <label htmlFor={`${uid}-artist`}>Artist Name</label>
        <input id={`${uid}-artist`} value={form.artist} onChange={set('artist')} placeholder="Artist or Artists" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-field">
          <label htmlFor={`${uid}-genre`}>Genre</label>
          <select id={`${uid}-genre`} value={form.genre} onChange={set('genre')}>
            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor={`${uid}-date`}>Release Date</label>
          <input id={`${uid}-date`} type="date" value={form.releaseDate} onChange={set('releaseDate')} />
        </div>
      </div>

      <div className="form-field">
        <label htmlFor={`${uid}-desc`}>Album Description</label>
        <textarea
          id={`${uid}-desc`}
          value={form.description}
          onChange={set('description')}
          placeholder="A short description about this album…"
          rows={3}
        />
      </div>

      {/* Album Artwork */}
      <div className="form-field">
        <label>Album Artwork</label>
        <div className="artwork-upload-row">
          {artworkPreview && (
            <div className="artwork-preview">
              <img src={artworkPreview} alt="Album artwork preview" />
            </div>
          )}
          <label className="file-upload" htmlFor={`${uid}-artwork`} style={{ flex: 1 }}>
            <input
              id={`${uid}-artwork`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAlbumArtwork}
            />
            <p className="file-upload__text">
              {artworkPreview ? 'Click to replace artwork' : 'Click to upload artwork (JPG, PNG, WebP)'}
            </p>
            {artworkFile && <p className="file-upload__name">{artworkFile.name}</p>}
          </label>
        </div>
      </div>

      {/* Digital Store Price & Featured */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24, alignItems: 'center' }}>
        <div className="form-field">
          <label htmlFor={`${uid}-price`}>Digital Store Price (₹ INR)</label>
          <input
            id={`${uid}-price`}
            type="number"
            min="0"
            step="1"
            value={form.price}
            onChange={set('price')}
            placeholder="e.g. 199"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 18 }}>
          <input
            type="checkbox"
            id={`${uid}-featured`}
            checked={form.featured}
            onChange={set('featured')}
            style={{ width: 16, height: 16 }}
          />
          <label htmlFor={`${uid}-featured`} style={{ fontSize: 12, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
            Featured record
          </label>
        </div>
      </div>

      {/* ── Tracks ── */}
      <h3 className="admin-section-heading">Tracks</h3>

      {tracks.map((t, idx) => (
        <div key={idx} className="admin-track-editor">
          <div className="admin-track-editor__header">
            <strong className="admin-track-editor__num">Track {idx + 1}</strong>
            {tracks.length > 1 && (
              <button
                type="button"
                className="admin-track-editor__remove"
                onClick={() => removeTrackSlot(idx)}
              >
                Remove
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-field">
              <label>Track Title *</label>
              <input
                value={t.title}
                onChange={e => updateTrack(idx, 'title', e.target.value)}
                required
                placeholder="Song name"
              />
            </div>
            <div className="form-field">
              <label>Artist / Version</label>
              <input
                value={t.version}
                onChange={e => updateTrack(idx, 'version', e.target.value)}
                placeholder="Mix, Flip, Remix…"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-field">
              <label>BPM</label>
              <input
                type="number"
                value={t.bpm}
                onChange={e => updateTrack(idx, 'bpm', e.target.value)}
                min={0} max={300}
              />
            </div>
            <div className="form-field">
              <label>Key</label>
              <input
                value={t.key}
                onChange={e => updateTrack(idx, 'key', e.target.value)}
                placeholder="B Minor"
              />
            </div>
          </div>

          {/* Track Artwork */}
          <div className="form-field">
            <label>Track Artwork <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(optional — unique image for this song)</span></label>
            <div className="artwork-upload-row">
              {t.artworkPreview ? (
                <div className="artwork-preview">
                  <img src={t.artworkPreview} alt={`Track ${idx + 1} artwork`} />
                  <button
                    type="button"
                    className="artwork-preview__remove"
                    onClick={() => removeTrackArtwork(idx)}
                    aria-label="Remove track artwork"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="artwork-preview artwork-preview--empty">
                  <span>♫</span>
                </div>
              )}
              <label className="file-upload" style={{ flex: 1 }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => handleTrackArtwork(idx, e.target.files[0])}
                />
                <p className="file-upload__text">
                  {t.artworkPreview ? 'Click to replace track image' : 'Upload track image (JPG, PNG, WebP)'}
                </p>
                {t.artworkFile && <p className="file-upload__name">{t.artworkFile.name}</p>}
              </label>
            </div>
          </div>

          {/* Audio File */}
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label>Audio File</label>
            <label className="file-upload">
              <input
                type="file"
                accept="audio/*"
                onChange={e => updateTrack(idx, 'audioFile', e.target.files[0])}
              />
              <p className="file-upload__text">Click to upload MP3 or WAV</p>
              {t.audioFile ? (
                <p className="file-upload__name">{t.audioFile.name}</p>
              ) : t.audioUrl ? (
                <p className="file-upload__name">✓ Existing audio file attached</p>
              ) : null}
            </label>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addTrackSlot}
        className="admin-add-track-btn"
      >
        + Add Another Track
      </button>

      {/* Upload progress */}
      {saving && progress > 0 && (
        <div className="upload-progress">
          <div className="upload-progress__bar">
            <div className="upload-progress__fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="upload-progress__label">
            {progress < 100 ? `Uploading… ${progress}%` : 'Processing…'}
          </p>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button type="submit" className="btn-primary" disabled={saving || success}>
          {success
            ? '✓ Saved!'
            : saving
              ? (progress > 0 && progress < 100 ? `Uploading ${progress}%…` : 'Saving…')
              : isEdit ? 'Save Changes' : 'Publish Record'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
