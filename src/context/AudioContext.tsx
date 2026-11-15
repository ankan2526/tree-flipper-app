import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer, AudioStatus } from 'expo-audio';
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
  triggerHaptic: (
    type?: 'selection' | 'impactLight' | 'impactMedium' | 'impactHeavy' | 'success' | 'warning' | 'error',
  ) => void;
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
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

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
          interruptionMode: 'mixWithOthers',
          interruptionModeAndroid: 'mixWithOthers',
        });
      } catch {
        // Audio mode might fail gracefully on unsupported environments
      }

      try {
        const saved = await getSoundSettings();
        if (isMounted) {
          setSettings(saved);
        }
      } catch {}

      if (isMounted) {
        setIsSettingsLoaded(true);
      }
    }

    initAudio();

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize BGM player (playback waits until saved settings are loaded)
  useEffect(() => {
    try {
      const bgmPlayer = createAudioPlayer(BGM_ASSET);
      bgmPlayer.loop = true;
      bgmPlayer.volume = 0.9;
      bgmPlayerRef.current = bgmPlayer;
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

  // Handle BGM playback once settings are loaded and whenever musicEnabled changes
  useEffect(() => {
    if (!isSettingsLoaded) return;
    const bgm = bgmPlayerRef.current;
    if (!bgm) return;

    try {
      if (settings.musicEnabled) {
        bgm.play();
      } else {
        bgm.pause();
      }
    } catch {}
  }, [settings.musicEnabled, isSettingsLoaded]);

  // Preload SFX players and run a muted warm-up pass to prime Android's AudioTrack
  useEffect(() => {
    let isCleanedUp = false;
    const subscriptions: { remove: () => void }[] = [];
    const fallbackTimers: ReturnType<typeof setTimeout>[] = [];

    const createWarmedUpPlayer = (
      asset: Parameters<typeof createAudioPlayer>[0],
      targetVolume: number,
    ): AudioPlayer => {
      const player = createAudioPlayer(asset);
      player.muted = true;
      player.volume = 0;

      let warmupFinished = false;

      const finishWarmup = (sub?: { remove: () => void }) => {
        if (warmupFinished || isCleanedUp) return;
        warmupFinished = true;

        try {
          sub?.remove();
        } catch {}

        try {
          // Pause before unmuting so longer clips never leak audio if fallback fires
          player.pause();
          player.volume = targetVolume;
          player.muted = false;
        } catch {}
      };

      const sub = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
        if (isCleanedUp || warmupFinished) return;

        if (status.playbackState === 'ended') {
          finishWarmup(sub);
        } else if (status.isLoaded && status.playbackState === 'ready' && !status.playing) {
          try {
            player.play();
          } catch {}
        }
      });

      subscriptions.push(sub);

      try {
        player.play();
      } catch {}

      const fallbackTimer = setTimeout(() => {
        finishWarmup(sub);
      }, 2500);
      fallbackTimers.push(fallbackTimer);

      return player;
    };

    try {
      flipPlayersRef.current = FLIP_SOUND_ASSETS.map((asset) => createWarmedUpPlayer(asset, 0.7));
      specialPlayerRef.current = createWarmedUpPlayer(SPECIAL_SOUND_ASSET, 0.8);
      victoryPlayerRef.current = createWarmedUpPlayer(VICTORY_SOUND_ASSET, 0.85);
      failPlayerRef.current = createWarmedUpPlayer(FAIL_SOUND_ASSET, 0.8);
      tapPlayerRef.current = createWarmedUpPlayer(TAP_SOUND_ASSET, 0.5);
    } catch (e) {
      console.warn('Failed to preload SFX players:', e);
    }

    return () => {
      isCleanedUp = true;
      fallbackTimers.forEach((timer) => clearTimeout(timer));
      subscriptions.forEach((sub) => {
        try {
          sub.remove();
        } catch {}
      });

      flipPlayersRef.current.forEach((p) => {
        try {
          p.release();
        } catch {}
      });
      flipPlayersRef.current = [];

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
    async (player: AudioPlayer | null) => {
      if (!settings.sfxEnabled || !player) return;
      try {
        player.muted = false;
        await player.seekTo(0);
        player.play();
      } catch {
        try {
          player.play();
        } catch (fallbackErr) {
          console.warn('[SFX] Playback error:', fallbackErr);
        }
      }
    },
    [settings.sfxEnabled],
  );

  const triggerHaptic = useCallback(
    (
      type:
        | 'selection'
        | 'impactLight'
        | 'impactMedium'
        | 'impactHeavy'
        | 'success'
        | 'warning'
        | 'error' = 'impactLight',
    ) => {
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