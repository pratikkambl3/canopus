import { useState, useId } from 'react';
import { addTrack, updateTrack } from '../../services/tracksService';
import { uploadAudio, uploadArtwork } from '../../services/storageService';
import { isFirebaseConfigured } from '../../services/firebase';

const GENRES = ['Experimental', 'Tech House', 'Remix'];

const emptyForm = {
  title: '',
  originalTitle: '',
  version: '',
  genre: 'Experimental',
  bpm: '',
  key: '',
  releaseDate: '',
  featured: false,
};

export default function AddRecordForm({ initialData, onSuccess, onCancel }) {
  const uid = useId();
  const isEdit = !!initialData;

  const [form, setForm] = useState(() =>
    isEdit
      ? {
          title: initialData.title ?? '',
          originalTitle: initialData.originalTitle ?? '',
          version: initialData.version ?? '',
          genre: initialData.genre ?? 'Experimental',
          bpm: initialData.bpm ?? '',
          key: initialData.key ?? '',
          releaseDate: initialData.releaseDate ?? '',
          featured: initialData.featured ?? false,
        }
      : emptyForm
  );

  const [audioFile, setAudioFile]     = useState(null);
  const [artworkFile, setArtworkFile] = useState(null);
  const [audioProgress, setAudioProgress]   = useState(0);
  const [artworkProgress, setArtworkProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      let artworkUrl = isEdit ? initialData.artworkUrl : null;
      let audioUrl   = isEdit ? initialData.audioUrl   : null;

      const trackId = isEdit ? initialData.id : `track-${Date.now()}`;

      if (!isFirebaseConfigured()) {
        setError('Firebase is not configured. Add your credentials to .env.local.');
        setSaving(false);
        return;
      }

      // Upload artwork
      if (artworkFile) {
        artworkUrl = await uploadArtwork(trackId, artworkFile, setArtworkProgress);
      }
      // Upload audio
      if (audioFile) {
        audioUrl = await uploadAudio(trackId, audioFile, setAudioProgress);
      }

      const data = {
        ...form,
        bpm: parseInt(form.bpm, 10) || 0,
        artworkUrl,
        audioUrl,
      };

      if (isEdit) {
        await updateTrack(initialData.id, data);
      } else {
        await addTrack({ id: trackId, ...data });
      }

      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to save record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-field">
        <label htmlFor={`${uid}-title`}>Track Title *</label>
        <input id={`${uid}-title`} value={form.title} onChange={set('title')} required />
      </div>

      <div className="form-field">
        <label htmlFor={`${uid}-orig`}>Original Title</label>
        <input id={`${uid}-orig`} value={form.originalTitle} onChange={set('originalTitle')} />
      </div>

      <div className="form-field">
        <label htmlFor={`${uid}-version`}>CANOPUS Version</label>
        <input id={`${uid}-version`} value={form.version} onChange={set('version')} placeholder="Canopus Experimental Flip" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-field">
          <label htmlFor={`${uid}-genre`}>Genre</label>
          <select id={`${uid}-genre`} value={form.genre} onChange={set('genre')}>
            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor={`${uid}-bpm`}>BPM</label>
          <input id={`${uid}-bpm`} type="number" min={60} max={200} value={form.bpm} onChange={set('bpm')} />
        </div>
        <div className="form-field">
          <label htmlFor={`${uid}-key`}>Key</label>
          <input id={`${uid}-key`} value={form.key} onChange={set('key')} placeholder="B Minor" />
        </div>
        <div className="form-field">
          <label htmlFor={`${uid}-date`}>Release Date</label>
          <input id={`${uid}-date`} type="date" value={form.releaseDate} onChange={set('releaseDate')} />
        </div>
      </div>

      {/* Artwork upload */}
      <div className="form-field">
        <label>Artwork</label>
        <label className="file-upload" htmlFor={`${uid}-artwork`}>
          <input
            id={`${uid}-artwork`}
            type="file"
            accept="image/*"
            onChange={e => setArtworkFile(e.target.files[0])}
          />
          <p className="file-upload__text">Click to upload artwork (JPG, PNG, WebP)</p>
          {artworkFile && <p className="file-upload__name">{artworkFile.name}</p>}
          {artworkProgress > 0 && artworkProgress < 100 && (
            <p className="file-upload__name">{artworkProgress}%</p>
          )}
        </label>
      </div>

      {/* Audio upload */}
      <div className="form-field">
        <label>Audio File</label>
        <label className="file-upload" htmlFor={`${uid}-audio`}>
          <input
            id={`${uid}-audio`}
            type="file"
            accept="audio/*"
            onChange={e => setAudioFile(e.target.files[0])}
          />
          <p className="file-upload__text">Click to upload MP3 or WAV</p>
          {audioFile && <p className="file-upload__name">{audioFile.name}</p>}
          {audioProgress > 0 && audioProgress < 100 && (
            <p className="file-upload__name">{audioProgress}%</p>
          )}
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <input
          type="checkbox"
          id={`${uid}-featured`}
          checked={form.featured}
          onChange={set('featured')}
          style={{ width: 16, height: 16 }}
        />
        <label htmlFor={`${uid}-featured`} style={{ fontSize: 12, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
          Featured track
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div style={{ display: 'flex', gap: 12 }}>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Publish Record'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
