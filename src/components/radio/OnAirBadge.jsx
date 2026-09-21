export default function OnAirBadge({ isPlaying, hasTrack }) {
  const statusLabel = isPlaying ? 'On Air' : (hasTrack ? 'Paused' : 'Off Air');
  
  return (
    <div className={`on-air-badge${isPlaying ? '' : ' on-air-badge--offline'}`}>
      <span className="on-air-badge__dot" aria-hidden="true" />
      <span className="on-air-badge__label">
        {statusLabel}
      </span>
    </div>
  );
}
