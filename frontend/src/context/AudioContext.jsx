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
  const ids = tracks.filter(t => t && t.audioUrl).map(t => t.id);
  if (!shuffleEnabled) return ids;
  const others = ids.filter(id => id !== currentId);
  return [currentId, ...shuffleArray(others)];
}

function generateLiveRadioQueue(tracks, lastTrackId) {
  const valid = tracks.filter(t => t && t.audioUrl);
  const ids = valid.map(t => t.id);
  if (ids.length <= 1) return ids;

  let newQueue;
  let attempts = 0;
  do {
    newQueue = shuffleArray(ids);
    attempts++;
  } while (newQueue[0] === lastTrackId && attempts < 10);

  if (newQueue[0] === lastTrackId && newQueue.length > 1) {
    [newQueue[0], newQueue[newQueue.length - 1]] = [newQueue[newQueue.length - 1], newQueue[0]];
  }

  return newQueue;
}

/* ── Initial State ── */

const initialState = {
  tracks: [],
  radioTracks: [],
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

    case 'LOAD_RADIO_POOL': {
      const allTracks = action.payload || [];
      const validTracks = allTracks.filter(t => t && t.audioUrl);
      const radioTracks = validTracks.length ? validTracks : allTracks;

      // If active tracks are empty or live radio is active, initialize active playlist from radio pool
      if (!state.tracks.length || state.liveRadioEnabled) {
        const queue = generateLiveRadioQueue(radioTracks, state.currentTrackId);
        const currentTrackId = state.currentTrackId && radioTracks.some(t => t.id === state.currentTrackId)
          ? state.currentTrackId
          : (queue[0] || null);
        const queueIndex = Math.max(0, queue.indexOf(currentTrackId));
        return {
          ...state,
          radioTracks,
          tracks: radioTracks,
          queue,
          queueIndex,
          currentTrackId,
          error: null,
        };
      }

      return {
        ...state,
        radioTracks,
      };
    }

    case 'LOAD_TRACKS': {
      const tracks = action.payload;
      if (!tracks.length) return { ...state, tracks, error: null };
      const queue = tracks.map(t => t.id);
      const currentTrackId = tracks.some(t => t.id === state.currentTrackId)
        ? state.currentTrackId
        : queue[0];
      const queueIndex = Math.max(0, queue.indexOf(currentTrackId));
      return { ...state, tracks, queue, queueIndex, currentTrackId, error: null, liveRadioEnabled: false };
    }

    case 'START_LIVE_RADIO': {
      const pool = (state.radioTracks.length ? state.radioTracks : state.tracks).filter(t => t && t.audioUrl);
      if (!pool.length) return state;
      const queue = generateLiveRadioQueue(pool, state.currentTrackId);
      return {
        ...state,
        tracks: pool,
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
        const pool = state.radioTracks.length ? state.radioTracks : state.tracks;
        const others = pool.filter(t => t.audioUrl).map(t => t.id).filter(tId => tId !== id);
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
      if (!state.isPlaying && !state.currentTrackId) {
        const pool = (state.radioTracks.length ? state.radioTracks : state.tracks).filter(t => t && t.audioUrl);
        if (pool.length) {
          const queue = generateLiveRadioQueue(pool, null);
          return {
            ...state,
            tracks: pool,
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
      const pool = state.liveRadioEnabled && state.radioTracks.length ? state.radioTracks : state.tracks;
      const shuffleEnabled = !state.shuffleEnabled;
      const queue = buildQueue(pool, state.currentTrackId, shuffleEnabled);
      const queueIndex = Math.max(0, queue.indexOf(state.currentTrackId));
      return { ...state, shuffleEnabled, queue, queueIndex };
    }

    case 'NEXT': {
      const pool = (state.liveRadioEnabled && state.radioTracks.length ? state.radioTracks : state.tracks).filter(t => t && t.audioUrl);
      if (!pool.length) return state;

      let queue = state.queue;
      let nextIndex = state.queueIndex + 1;

      if (nextIndex >= queue.length || !queue.length) {
        // End of queue: regenerate randomized queue
        queue = generateLiveRadioQueue(pool, state.currentTrackId);
        nextIndex = 0;
      }

      let nextId = queue[nextIndex];
      // Ensure we don't repeat the same track if multiple are available
      if (nextId === state.currentTrackId && pool.length > 1) {
        const different = queue.filter(id => id !== state.currentTrackId);
        if (different.length) {
          nextId = different[0];
          nextIndex = queue.indexOf(nextId);
        }
      }

      return {
        ...state,
        tracks: pool,
        queue,
        queueIndex: nextIndex,
        currentTrackId: nextId,
        isPlaying: true,
        currentTime: 0,
        duration: 0,
        error: null,
      };
    }

    case 'PREV': {
      if (!state.queue.length) return state;
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
      const allPool = state.tracks.concat(state.radioTracks.filter(rt => !state.tracks.some(t => t.id === rt.id)));
      const track = allPool.find(t => t.id === state.currentTrackId);
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
  }, [state.currentTrackId, state.isPlaying, state.tracks, state.radioTracks]);

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

  /* ── Auto-skip on error (auto-advance so radio never stalls) ── */
  useEffect(() => {
    if (state.error) {
      const timer = setTimeout(() => {
        dispatch({ type: 'NEXT' });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [state.error]);

  /* ── Actions ── */

  const actions = {
    loadTracks: useCallback((tracks) => {
      dispatch({ type: 'LOAD_TRACKS', payload: tracks });
    }, []),

    loadRadioPool: useCallback((tracks) => {
      dispatch({ type: 'LOAD_RADIO_POOL', payload: tracks });
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

  const allPool = state.tracks.concat(state.radioTracks.filter(rt => !state.tracks.some(t => t.id === rt.id)));
  const currentTrack = allPool.find(t => t.id === state.currentTrackId) ?? null;

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
