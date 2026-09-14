/* ================================================================
   CANOPUS — usePreviewPlayer Hook
   Dedicated, secure limited-duration audio preview controller.
   Ensures single active preview, enforces server-bounded duration limits,
   and provides loading/progress state for UI controls.
   ================================================================ */

import { useState, useRef, useEffect, useCallback } from 'react';

export function usePreviewPlayer(defaultDuration = null) {
  const [activePreview, setActivePreview] = useState({
    productId: null,
    trackId: null,
    isPlaying: false,
    loading: false,
    currentTime: 0,
    duration: 0,
    maxDuration: defaultDuration,
    error: null,
  });

  const audioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onTime = () => {
      setActivePreview(prev => {
        if (!prev.isPlaying) return prev;
        if (prev.maxDuration && Number(prev.maxDuration) > 0 && audio.currentTime >= prev.maxDuration) {
          audio.pause();
          audio.currentTime = 0;
          return { ...prev, isPlaying: false, currentTime: 0 };
        }
        return {
          ...prev,
          currentTime: audio.currentTime,
          duration: audio.duration || prev.duration || 0,
        };
      });
    };

    const onMeta = () => {
      setActivePreview(prev => ({
        ...prev,
        duration: audio.duration || prev.duration || 0,
      }));
    };

    const onCanPlay = () => {
      setActivePreview(prev => ({ ...prev, loading: false }));
    };

    const onEnded = () => {
      setActivePreview(prev => ({ ...prev, isPlaying: false, currentTime: 0, loading: false }));
    };

    const onError = () => {
      if (!audio.src || audio.src === window.location.href) return;
      setActivePreview(prev => ({
        ...prev,
        isPlaying: false,
        loading: false,
        error: 'Preview audio unavailable for this track.',
      }));
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.src = '';
    };
  }, []);

  const togglePreview = useCallback((productId, trackId, previewDuration) => {
    const audio = audioRef.current;
    if (!audio) return;

    let dur = null;
    if (previewDuration && Number(previewDuration) > 0) {
      dur = Number(previewDuration);
    } else if (defaultDuration && Number(defaultDuration) > 0) {
      dur = Number(defaultDuration);
    }

    setActivePreview(prev => {
      const isSame = prev.productId === productId && prev.trackId === trackId;
      if (isSame && prev.isPlaying) {
        audio.pause();
        return { ...prev, isPlaying: false };
      }

      if (isSame && !prev.isPlaying && audio.src) {
        audio.play().catch(() => {});
        return { ...prev, isPlaying: true, error: null };
      }

      // New track preview
      const BASE = import.meta.env.VITE_API_URL || '/api';
      const previewUrl = `${BASE}/products/${productId}/preview${trackId ? `?trackId=${trackId}` : ''}`;
      
      audio.pause();
      audio.currentTime = 0;
      audio.src = previewUrl;
      audio.load();
      audio.play().catch(err => {
        if (err.name !== 'AbortError') {
          console.warn('[usePreviewPlayer] Play error:', err);
        }
      });

      return {
        productId,
        trackId,
        isPlaying: true,
        loading: true,
        currentTime: 0,
        duration: 0,
        maxDuration: dur,
        error: null,
      };
    });
  }, [defaultDuration]);

  const stopPreview = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setActivePreview(prev => ({ ...prev, isPlaying: false, currentTime: 0, loading: false }));
  }, []);

  return {
    activePreview,
    togglePreview,
    stopPreview,
  };
}
