/* ================================================================
   CANOPUS — Global Audio Context
   Single Audio element, persists across all page navigations.
   useReducer manages all state; useEffects sync to the DOM.
   ================================================================ */

import {
  createContext, useContext, useReducer,
  useRef, useEffect, useCallback,
} from 'react';

/* ── Helpers ── */

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQueue(tracks, currentId, shuffleEnabled) {
  const ids = tracks.map(t => t.id);
  if (!shuffleEnabled) return ids;
  const others = ids.filter(id => id !== currentId);
  return [currentId, ...shuffleArray(others)];
}

function generateLiveRadioQueue(tracks, lastTrackId) {
  const ids = tracks.map(t => t.id);
  if (ids.length <= 1) return ids;
  
  let newQueue;
  do {
    newQueue = shuffleArray(ids);
  } while (newQueue[0] === lastTrackId);
  
  return newQueue;
}

/* ── Initial State ── */

const initialState = {
  tracks: [],
  currentTrackId: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  shuffleEnabled: false,
  liveRadioEnabled: false,
  queue: [],
  queueIndex: 0,
  error: null,
};

/* ── Reducer ── */

function reducer(state, action) {
  switch (action.type) {

    case 'LOAD_TRACKS': {
      const tracks = action.payload;
      if (!tracks.length) return { ...state, tracks, error: null };
      const queue = tracks.map(t => t.id);
      const currentTrackId = tracks.some(t => t.id === state.currentTrackId)
        ? state.currentTrackId
        : queue[0];
      const queueIndex = Math.max(0, queue.indexOf(currentTrackId));
      return { ...state, tracks, queue, queueIndex, currentTrackId, error: null };
    }

    case 'START_LIVE_RADIO': {
      if (!state.tracks.length) return state;
      const queue = generateLiveRadioQueue(state.tracks, state.currentTrackId);
      return {
        ...state,
        liveRadioEnabled: true,
        shuffleEnabled: true,
        queue,
        queueIndex: 0,
        currentTrackId: queue[0],
        isPlaying: true,
        currentTime: 0,
        duration: 0,
        error: null,
      };
    }

    case 'SELECT_TRACK': {
      const { id } = action.payload;
      let queue;
      let queueIndex;
      if (state.liveRadioEnabled) {
        // Keep live radio on, start playing this track, queue rest behind it
        const others = state.tracks.map(t => t.id).filter(tId => tId !== id);
        queue = [id, ...shuffleArray(others)];
        queueIndex = 0;
      } else {
        queue = buildQueue(state.tracks, id, state.shuffleEnabled);
        queueIndex = Math.max(0, queue.indexOf(id));
      }
      return {
        ...state,
        currentTrackId: id,
        isPlaying: true,
        liveRadioEnabled: false,
        queue,
        queueIndex,
        currentTime: 0,
        duration: 0,
        error: null,
      };
    }

    case 'PLAY':
      return { ...state, isPlaying: true, error: null };

    case 'PAUSE':
      return { ...state, isPlaying: false };

    case 'TOGGLE_PLAY': {
      if (!state.isPlaying && !state.currentTrackId && state.tracks.length) {
        // Start from first track
        const id = state.queue[0] || state.tracks[0].id;
        return {
          ...state,
          currentTrackId: id,
          isPlaying: true,
          currentTime: 0,
          duration: 0,
          error: null,
        };
      }
      return {
        ...state,
        isPlaying: !state.isPlaying,
        error: !state.isPlaying ? null : state.error,
      };
    }

    case 'SET_TIME':
      return { ...state, currentTime: action.payload };

    case 'SET_DURATION':
      return { ...state, duration: action.payload };

    case 'SET_VOLUME':
      return { ...state, volume: Math.max(0, Math.min(1, action.payload)) };

    case 'TOGGLE_MUTE':
      return { ...state, isMuted: !state.isMuted };

    case 'TOGGLE_SHUFFLE': {
      const shuffleEnabled = !state.shuffleEnabled;
      const queue = buildQueue(state.tracks, state.currentTrackId, shuffleEnabled);
      const queueIndex = Math.max(0, queue.indexOf(state.currentTrackId));
      return { ...state, shuffleEnabled, queue, queueIndex };
    }

    case 'NEXT': {
      if (!state.queue.length) return state;
      let nextIndex = state.queueIndex + 1;
      let queue = state.queue;

      if (nextIndex >= queue.length) {
        // End of queue
        if (state.liveRadioEnabled) {
          queue = generateLiveRadioQueue(state.tracks, state.currentTrackId);
          nextIndex = 0;
        } else if (state.shuffleEnabled) {
          queue = shuffleArray(state.tracks.map(t => t.id));
          nextIndex = 0;
        } else {
          nextIndex = 0;
        }
      }

      return {
        ...state,
        queue,
        queueIndex: nextIndex,
        currentTrackId: queue[nextIndex],
        isPlaying: true,
        currentTime: 0,
        duration: 0,
        error: null,
      };
    }

    case 'PREV': {
      if (!state.queue.length) return state;
      // If > 5s played, go to start of current track (handled in action)
      const prevIndex = Math.max(0, state.queueIndex - 1);
      return {
        ...state,
        queueIndex: prevIndex,
        currentTrackId: state.queue[prevIndex],
        isPlaying: true,
        currentTime: 0,
        duration: 0,
        error: null,
      };
    }

    case 'RESTART_CURRENT':
      return { ...state, currentTime: 0 };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isPlaying: false };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

/* ── Context ── */

const AudioCtx = createContext(null);

export function AudioProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const audioRef = useRef(null);
  // Track previous values to avoid redundant DOM operations
  const prevTrackIdRef  = useRef(null);
  const prevIsPlayingRef = useRef(false);

  /* ── Create audio element once ── */
  useEffect(() => {
    const audio = new Audio();
    audio.volume = state.volume;
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onTime     = () => dispatch({ type: 'SET_TIME',     payload: audio.currentTime });
    const onMeta     = () => dispatch({ type: 'SET_DURATION', payload: audio.duration });
    const onEnded    = () => dispatch({ type: 'NEXT' });
    const onError    = () => {
      if (!audio.src || audio.src === window.location.href) return;
      dispatch({ type: 'SET_ERROR', payload: 'Unable to play this record.' });
    };

    audio.addEventListener('timeupdate',     onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended',          onEnded);
    audio.addEventListener('error',          onError);

    return () => {
      audio.removeEventListener('timeupdate',     onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended',          onEnded);
      audio.removeEventListener('error',          onError);
      audio.pause();
      audio.src = '';
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Unified sync: track change & play/pause ── */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const trackChanged = state.currentTrackId !== prevTrackIdRef.current;
    const playChanged  = state.isPlaying !== prevIsPlayingRef.current;

    if (!trackChanged && !playChanged) return;

    if (trackChanged) {
      prevTrackIdRef.current = state.currentTrackId;
      const track = state.tracks.find(t => t.id === state.currentTrackId);
      if (track && track.audioUrl) {
        try {
          const targetUrl = new URL(track.audioUrl, window.location.href).href;
          if (audio.src !== targetUrl) {
            audio.src = track.audioUrl;
            audio.load();
          }
        } catch {
          audio.src = track.audioUrl;
          audio.load();
        }
      } else {
        audio.src = '';
        if (state.currentTrackId) {
          dispatch({ type: 'SET_ERROR', payload: 'Audio file not yet available for this record.' });
        }
        return;
      }
    }

    prevIsPlayingRef.current = state.isPlaying;

    if (state.isPlaying) {
      const p = audio.play();
      if (p !== undefined) {
        p.catch((err) => {
          if (err.name === 'AbortError') return; // Normal when switching tracks or rapid click
          console.warn('[AudioContext] play() error:', err);
          dispatch({ type: 'SET_ERROR', payload: 'Unable to play this record.' });
        });
      }
    } else {
      audio.pause();
    }
  }, [state.currentTrackId, state.isPlaying, state.tracks]);

  /* ── Sync volume / mute ── */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = state.isMuted ? 0 : state.volume;
  }, [state.volume, state.isMuted]);

  /* ── Seek (RESTART_CURRENT) ── */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state.currentTime === 0 && audio.currentTime > 1) {
      audio.currentTime = 0;
    }
  }, [state.currentTime]);

  /* ── Auto-skip on error for Live Radio ── */
  useEffect(() => {
    if (state.error && state.liveRadioEnabled) {
      const timer = setTimeout(() => {
        dispatch({ type: 'NEXT' });
      }, 3000); // Wait 3s so the user can see the error briefly
      return () => clearTimeout(timer);
    }
  }, [state.error, state.liveRadioEnabled]);

  /* ── Actions ── */

  const actions = {
    loadTracks: useCallback((tracks) => {
      dispatch({ type: 'LOAD_TRACKS', payload: tracks });
    }, []),

    selectTrack: useCallback((id) => {
      dispatch({ type: 'SELECT_TRACK', payload: { id } });
    }, []),

    startLiveRadio: useCallback(() => {
      dispatch({ type: 'START_LIVE_RADIO' });
    }, []),

    togglePlay: useCallback(() => {
      dispatch({ type: 'TOGGLE_PLAY' });
    }, []),

    next: useCallback(() => {
      dispatch({ type: 'NEXT' });
    }, []),

    prev: useCallback(() => {
      const audio = audioRef.current;
      if (audio && audio.currentTime > 5) {
        audio.currentTime = 0;
        dispatch({ type: 'RESTART_CURRENT' });
      } else {
        dispatch({ type: 'PREV' });
      }
    }, []),

    seek: useCallback((time) => {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = time;
        dispatch({ type: 'SET_TIME', payload: time });
      }
    }, []),

    setVolume: useCallback((v) => {
      dispatch({ type: 'SET_VOLUME', payload: v });
    }, []),

    toggleMute: useCallback(() => {
      dispatch({ type: 'TOGGLE_MUTE' });
    }, []),

    toggleShuffle: useCallback(() => {
      dispatch({ type: 'TOGGLE_SHUFFLE' });
    }, []),

    clearError: useCallback(() => {
      dispatch({ type: 'CLEAR_ERROR' });
    }, []),
  };

  const currentTrack = state.tracks.find(t => t.id === state.currentTrackId) ?? null;

  return (
    <AudioCtx.Provider value={{ state: { ...state, currentTrack }, actions }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error('useAudio must be used inside <AudioProvider>');
  return ctx;
}
