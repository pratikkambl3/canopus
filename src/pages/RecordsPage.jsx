import { useEffect, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { getTracks } from '../services/tracksService';
import RecordsList from '../components/records/RecordsList';
import MiniPlayer from '../components/layout/MiniPlayer';

export default function RecordsPage() {
  const { state, actions } = useAudio();
  const [tracks, setTracks] = useState(state.tracks);
  const [loading, setLoading] = useState(state.tracks.length === 0);

  useEffect(() => {
    if (state.tracks.length > 0) {
      setTracks(state.tracks);
      setLoading(false);
      return;
    }
    setLoading(true);
    getTracks().then(t => {
      setTracks(t);
      actions.loadTracks(t);
    }).catch(console.error).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="records-page page">
      {loading ? (
        <div style={{ padding: '120px 64px', color: 'var(--text-muted)', fontSize: 14, fontStyle: 'italic' }}>
          Loading records…
        </div>
      ) : (
        <RecordsList tracks={tracks} />
      )}

      {/* Persistent mini player */}
      <MiniPlayer />
    </div>
  );
}
