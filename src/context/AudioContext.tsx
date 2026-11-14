import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { getSoundSettings, saveSoundSettings } from '@/utils/storage';

interface SoundSettings {
  sfxEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
}

interface AudioContextValue {
  sfxEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  toggleSfx: () => void;
  toggleMusic: () => void;
  toggleHaptics: () => void;
  playFlipSound: (pitchIndex?: number) => void;
  playSpecialSound: () => void;
  playVictorySound: () => void;
  playFailSound: () => void;
  playTapSound: () => void;
  triggerHaptic: (type?: 'selection' | 'impactLight' | 'impactMedium' | 'impactHeavy' | 'success' | 'warning' | 'error') => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

const FLIP_SOUND_ASSETS = [
  require('@/../assets/audio/flip_1.wav'),
  require('@/../assets/audio/flip_2.wav'),
  require('@/../assets/audio/flip_3.wav'),
  require('@/../assets/audio/flip_4.wav'),
  require('@/../assets/audio/flip_5.wav'),
];
const SPECIAL_SOUND_ASSET = require('@/../assets/audio/special.wav');
const VICTORY_SOUND_ASSET = require('@/../assets/audio/victory.wav');
const FAIL_SOUND_ASSET = require('@/../assets/audio/fail.wav');
const TAP_SOUND_ASSET = require('@/../assets/audio/tap.wav');
const BGM_ASSET = require('@/../assets/audio/ambient_bgm.wav');

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SoundSettings>({
    sfxEnabled: true,
    musicEnabled: true,
    hapticsEnabled: true,
  });

  const bgmPlayerRef = useRef<AudioPlayer | null>(null);
  const flipPlayersRef = useRef<AudioPlayer[]>([]);
  const specialPlayerRef = useRef<AudioPlayer | null>(null);
  const victoryPlayerRef = useRef<AudioPlayer | null>(null);
  const failPlayerRef = useRef<AudioPlayer | null>(null);
  const tapPlayerRef = useRef<AudioPlayer | null>(null);
  const nextFlipIndexRef = useRef(0);

  // Initialize Audio Mode and load saved settings
  useEffect(() => {
    let isMounted = true;

    async function initAudio() {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
        });
      } catch {
        // Audio mode might fail gracefully on some unsupported environments (e.g. web simulator)
      }

      try {
        const saved = await getSoundSettings();
        if (isMounted) {
          setSettings(saved);
        }
      } catch {}
    }

    initAudio();

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize and manage BGM player
  useEffect(() => {
    try {
      const bgmPlayer = createAudioPlayer(BGM_ASSET);
      bgmPlayer.loop = true;
      bgmPlayer.volume = 0.9;
      bgmPlayerRef.current = bgmPlayer;

      if (settings.musicEnabled) {
        bgmPlayer.play();
      }
    } catch (e) {
      console.warn('Failed to initialize BGM player:', e);
    }

    return () => {
      if (bgmPlayerRef.current) {
        try {
          bgmPlayerRef.current.pause();
          bgmPlayerRef.current.release();
        } catch {}
        bgmPlayerRef.current = null;
      }
    };
  }, []);

  // Handle music toggle reactions
  useEffect(() => {
    const bgm = bgmPlayerRef.current;
    if (!bgm) return;
    try {
      if (settings.musicEnabled) {
        bgm.play();
      } else {
        bgm.pause();
      }
    } catch {}
  }, [settings.musicEnabled]);

  // Preload SFX players for low latency
  useEffect(() => {
    try {
      flipPlayersRef.current = FLIP_SOUND_ASSETS.map((asset) => {
        const p = createAudioPlayer(asset);
        p.volume = 0.7;
        return p;
      });
      specialPlayerRef.current = createAudioPlayer(SPECIAL_SOUND_ASSET);
      if (specialPlayerRef.current) specialPlayerRef.current.volume = 0.8;

      victoryPlayerRef.current = createAudioPlayer(VICTORY_SOUND_ASSET);
      if (victoryPlayerRef.current) victoryPlayerRef.current.volume = 0.85;

      failPlayerRef.current = createAudioPlayer(FAIL_SOUND_ASSET);
      if (failPlayerRef.current) failPlayerRef.current.volume = 0.8;

      tapPlayerRef.current = createAudioPlayer(TAP_SOUND_ASSET);
      if (tapPlayerRef.current) tapPlayerRef.current.volume = 0.5;
    } catch (e) {
      console.warn('Failed to preload SFX players:', e);
    }

    return () => {
      flipPlayersRef.current.forEach((p) => {
        try {
          p.release();
        } catch {}
      });
      [specialPlayerRef, victoryPlayerRef, failPlayerRef, tapPlayerRef].forEach((ref) => {
        if (ref.current) {
          try {
            ref.current.release();
          } catch {}
          ref.current = null;
        }
      });
    };
  }, []);

  const playSoundEffect = useCallback(
    (player: AudioPlayer | null) => {
      if (!settings.sfxEnabled || !player) return;
      try {
        player.seekTo(0);
        player.play();
      } catch (err) {
        // Fallback for re-play attempt
        try {
          player.play();
        } catch {}
      }
    },
    [settings.sfxEnabled],
  );

  const triggerHaptic = useCallback(
    (type: 'selection' | 'impactLight' | 'impactMedium' | 'impactHeavy' | 'success' | 'warning' | 'error' = 'impactLight') => {
      if (!settings.hapticsEnabled) return;
      try {
        switch (type) {
          case 'selection':
            Haptics.selectionAsync();
            break;
          case 'impactLight':
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'impactMedium':
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'impactHeavy':
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
          case 'success':
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
          case 'warning':
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            break;
          case 'error':
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
        }
      } catch {}
    },
    [settings.hapticsEnabled],
  );

  // Flip plays through harmonic pentatonic notes for consecutive actions
  const playFlipSound = useCallback(
    (pitchIndex?: number) => {
      if (flipPlayersRef.current.length === 0) return;
      const idx =
        typeof pitchIndex === 'number'
          ? Math.abs(pitchIndex) % flipPlayersRef.current.length
          : nextFlipIndexRef.current % flipPlayersRef.current.length;

      nextFlipIndexRef.current = (nextFlipIndexRef.current + 1) % flipPlayersRef.current.length;
      playSoundEffect(flipPlayersRef.current[idx]);
      triggerHaptic('impactLight');
    },
    [playSoundEffect, triggerHaptic],
  );

  const playSpecialSound = useCallback(() => {
    playSoundEffect(specialPlayerRef.current);
    triggerHaptic('impactMedium');
  }, [playSoundEffect, triggerHaptic]);

  const playVictorySound = useCallback(() => {
    playSoundEffect(victoryPlayerRef.current);
    triggerHaptic('success');
  }, [playSoundEffect, triggerHaptic]);

  const playFailSound = useCallback(() => {
    playSoundEffect(failPlayerRef.current);
    triggerHaptic('error');
  }, [playSoundEffect, triggerHaptic]);

  const playTapSound = useCallback(() => {
    playSoundEffect(tapPlayerRef.current);
    triggerHaptic('selection');
  }, [playSoundEffect, triggerHaptic]);

  const toggleSfx = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, sfxEnabled: !prev.sfxEnabled };
      saveSoundSettings(next);
      return next;
    });
  }, []);

  const toggleMusic = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, musicEnabled: !prev.musicEnabled };
      saveSoundSettings(next);
      return next;
    });
  }, []);

  const toggleHaptics = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, hapticsEnabled: !prev.hapticsEnabled };
      saveSoundSettings(next);
      return next;
    });
  }, []);

  return (
    <AudioContext.Provider
      value={{
        sfxEnabled: settings.sfxEnabled,
        musicEnabled: settings.musicEnabled,
        hapticsEnabled: settings.hapticsEnabled,
        toggleSfx,
        toggleMusic,
        toggleHaptics,
        playFlipSound,
        playSpecialSound,
        playVictorySound,
        playFailSound,
        playTapSound,
        triggerHaptic,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return ctx;
}

