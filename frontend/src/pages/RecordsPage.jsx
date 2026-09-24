import { useEffect, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { getRecords } from '../services/recordsService';
import RecordsList from '../components/records/RecordsList';

export default function RecordsPage() {
  const { state, actions } = useAudio();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecords()
      .then(r => setRecords(r))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="records-page page">
      {loading ? (
        <div style={{ padding: '120px 64px', color: 'var(--text-muted)', fontSize: 14, fontStyle: 'italic' }}>
          Loading records…
        </div>
      ) : (
        <RecordsList records={records} />
      )}
    </div>
  );
}
