import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useAudioPlayer — Custom hook wrapping HTML5 Audio API.
 * Manages play/pause, seek, volume, mute, shuffle, prev/next,
 * and auto-advance on track completion.
 */
export default function useAudioPlayer(tracks) {
  const audioRef = useRef(null);

  // ---------- state ----------
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [mode, setMode] = useState('radio'); // 'radio' | 'records'
  const [radioStatus, setRadioStatus] = useState('idle'); // 'idle' | 'playing' | 'error' | 'offline'
  const [audioError, setAudioError] = useState(false);

  const currentTrack = tracks[currentTrackIndex] || tracks[0];

  // ---------- ensure audio element ----------
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
      audioRef.current.preload = 'metadata';
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // ---------- event wiring ----------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setAudioError(false);
    };
    const onEnded = () => {
      if (mode === 'records') {
        playNext();
      } else {
        setIsPlaying(false);
      }
    };
    const onError = () => {
      setAudioError(true);
      setIsPlaying(false);
      if (mode === 'radio') {
        setRadioStatus('error');
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [mode, currentTrackIndex, isShuffled]);

  // ---------- play ----------
  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (mode === 'records') {
      const track = tracks[currentTrackIndex];
      if (audio.src !== window.location.origin + track.audioUrl &&
          audio.src !== track.audioUrl) {
        audio.src = track.audioUrl;
        audio.load();
      }
    }

    const promise = audio.play();
    if (promise) {
      promise.then(() => {
        setIsPlaying(true);
        setAudioError(false);
        if (mode === 'radio') setRadioStatus('playing');
      }).catch(() => {
        setAudioError(true);
        if (mode === 'radio') setRadioStatus('error');
      });
    }
  }, [mode, currentTrackIndex, tracks]);

  // ---------- pause ----------
  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
    if (mode === 'radio') setRadioStatus('idle');
  }, [mode]);

  // ---------- toggle ----------
  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  // ---------- load track ----------
  const loadTrack = useCallback((index, autoPlay = true) => {
    const audio = audioRef.current;
    if (!audio) return;

    const idx = ((index % tracks.length) + tracks.length) % tracks.length;
    setCurrentTrackIndex(idx);
    setMode('records');

    audio.src = tracks[idx].audioUrl;
    audio.load();
    setCurrentTime(0);
    setDuration(0);
    setAudioError(false);

    if (autoPlay) {
      const p = audio.play();
      if (p) {
        p.then(() => setIsPlaying(true))
         .catch(() => setAudioError(true));
      }
    }
  }, [tracks]);

  // ---------- prev / next ----------
  const playNext = useCallback(() => {
    if (isShuffled) {
      let nextIdx;
      do { nextIdx = Math.floor(Math.random() * tracks.length); }
      while (nextIdx === currentTrackIndex && tracks.length > 1);
      loadTrack(nextIdx);
    } else {
      loadTrack(currentTrackIndex + 1);
    }
  }, [currentTrackIndex, isShuffled, tracks, loadTrack]);

  const playPrev = useCallback(() => {
    const audio = audioRef.current;
    // If more than 3s in, restart current track
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    loadTrack(currentTrackIndex - 1);
  }, [currentTrackIndex, loadTrack]);

  // ---------- seek ----------
  const seek = useCallback((time) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  // ---------- volume ----------
  const setVolume = useCallback((v) => {
    const audio = audioRef.current;
    if (!audio) return;
    const vol = Math.max(0, Math.min(1, v));
    audio.volume = vol;
    setVolumeState(vol);
    if (vol > 0 && isMuted) {
      audio.muted = false;
      setIsMuted(false);
    }
  }, [isMuted]);

  // ---------- mute ----------
  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // ---------- shuffle ----------
  const toggleShuffle = useCallback(() => {
    setIsShuffled(prev => !prev);
  }, []);

  // ---------- radio ----------
  const startRadio = useCallback((streamUrl) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!streamUrl) {
      setRadioStatus('offline');
      setMode('radio');
      return;
    }

    setMode('radio');
    audio.src = streamUrl;
    audio.load();
    setCurrentTime(0);
    setDuration(0);
    setAudioError(false);

    const p = audio.play();
    if (p) {
      p.then(() => {
        setIsPlaying(true);
        setRadioStatus('playing');
      }).catch(() => {
        setRadioStatus('error');
      });
    }
  }, []);

  const retryRadio = useCallback((streamUrl) => {
    setRadioStatus('idle');
    setAudioError(false);
    startRadio(streamUrl);
  }, [startRadio]);

  return {
    // state
    currentTrack,
    currentTrackIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffled,
    mode,
    radioStatus,
    audioError,
    // actions
    play,
    pause,
    togglePlay,
    loadTrack,
    playNext,
    playPrev,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    startRadio,
    retryRadio,
    setMode,
  };
}
