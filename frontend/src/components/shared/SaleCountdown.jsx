/* ================================================================
   CANOPUS -- SaleCountdown
   Displays a live countdown timer for limited-time sale offers.
   ================================================================ */

import { useState, useEffect, useRef } from 'react';

function calcTimeLeft(endsAt) {
  if (!endsAt) return null;
  const diff = Math.max(0, Math.floor((new Date(endsAt) - Date.now()) / 1000));
  if (diff === 0) return null;
  const days  = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins  = Math.floor((diff % 3600) / 60);
  const secs  = diff % 60;
  return { days, hours, mins, secs, total: diff };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export default function SaleCountdown({ endsAt, onExpired, className = '' }) {
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(endsAt));
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!endsAt) return;
    setTimeLeft(calcTimeLeft(endsAt));

    intervalRef.current = setInterval(() => {
      const tl = calcTimeLeft(endsAt);
      setTimeLeft(tl);
      if (!tl) {
        clearInterval(intervalRef.current);
        onExpired && onExpired();
      }
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [endsAt, onExpired]);

  if (!endsAt) return null;
  if (!timeLeft) return null;

  return (
    <div className={`sale-countdown ${className}`}>
      <span className="sale-countdown__label">
        <span className="sale-countdown__icon" aria-hidden="true">⏱</span> Ends in
      </span>
      <div className="sale-countdown__clock">
        {timeLeft.days > 0 && (
          <>
            <div className="sale-countdown__unit">
              <span className="sale-countdown__digit">{timeLeft.days}</span>
              <span className="sale-countdown__suffix">d</span>
            </div>
            <span className="sale-countdown__colon">:</span>
          </>
        )}
        <div className="sale-countdown__unit">
          <span className="sale-countdown__digit">{pad(timeLeft.hours)}</span>
          <span className="sale-countdown__suffix">h</span>
        </div>
        <span className="sale-countdown__colon">:</span>
        <div className="sale-countdown__unit">
          <span className="sale-countdown__digit">{pad(timeLeft.mins)}</span>
          <span className="sale-countdown__suffix">m</span>
        </div>
        <span className="sale-countdown__colon">:</span>
        <div className="sale-countdown__unit">
          <span className="sale-countdown__digit">{pad(timeLeft.secs)}</span>
          <span className="sale-countdown__suffix">s</span>
        </div>
      </div>
    </div>
  );
}
