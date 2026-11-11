import math
import struct
import wave
import os

SAMPLE_RATE = 44100

def write_wav(filename, samples, sample_rate=SAMPLE_RATE, channels=1):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(2) # 16-bit
        wav_file.setframerate(sample_rate)
        # convert float samples (-1.0 to 1.0) to 16-bit PCM
        frames = bytearray()
        if channels == 1:
            for s in samples:
                val = max(-1.0, min(1.0, s))
                int_val = int(val * 32767.0)
                frames.extend(struct.pack('<h', int_val))
        elif channels == 2:
            for left, right in samples:
                val_l = max(-1.0, min(1.0, left))
                val_r = max(-1.0, min(1.0, right))
                frames.extend(struct.pack('<hh', int(val_l * 32767.0), int(val_r * 32767.0)))
        wav_file.writeframes(frames)
    print(f"Generated {filename}")

# --- Sound Effect 1: Resonant Wooden / Marimba Tone (Subtree Flip) ---
# Multiple variations / pitches so consecutive flips feel melodically alive (pentatonic)
# A Minor Pentatonic: A3 (220), C4 (261.63), D4 (293.66), E4 (329.63), G4 (392.00)
def generate_chime(filename, base_freq, duration=0.45):
    num_samples = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        # Envelope: crisp exponential decay with subtle initial transient click
        decay = math.exp(-t * 9.0)
        # Harmonics for warm marimba / crystal chime:
        # Fundamental (1.0), gentle octave (2.0), minor 7th / harmonic (3.0)
        s1 = math.sin(2 * math.pi * base_freq * t)
        s2 = 0.35 * math.sin(2 * math.pi * base_freq * 2.0 * t) * math.exp(-t * 14.0)
        s3 = 0.15 * math.sin(2 * math.pi * base_freq * 3.0 * t) * math.exp(-t * 18.0)
        # Subtle click transient in the first 5ms
        click = 0.2 * math.sin(2 * math.pi * 1200 * t) * math.exp(-t * 200.0) if t < 0.02 else 0.0
        
        sample = (s1 + s2 + s3 + click) * decay * 0.75
        samples.append(sample)
    write_wav(filename, samples)

# --- Sound Effect 2: Shimmering Celestial Crystal (Special Move / Single Inversion) ---
def generate_crystal_special(filename, duration=0.6):
    num_samples = int(SAMPLE_RATE * duration)
    samples = []
    freq = 659.25 # E5
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        decay = math.exp(-t * 5.5)
        # Shimmer frequency modulation
        mod = 1.0 + 0.006 * math.sin(2 * math.pi * 12.0 * t)
        s1 = math.sin(2 * math.pi * freq * mod * t)
        s2 = 0.5 * math.sin(2 * math.pi * (freq * 1.5) * mod * t) * math.exp(-t * 7.0)
        s3 = 0.4 * math.sin(2 * math.pi * (freq * 2.0) * mod * t) * math.exp(-t * 9.0)
        s4 = 0.25 * math.sin(2 * math.pi * (freq * 3.0) * mod * t) * math.exp(-t * 12.0)
        sample = (s1 + s2 + s3 + s4) * decay * 0.6
        samples.append(sample)
    write_wav(filename, samples)

# --- Sound Effect 3: Level Complete / Harmonious Bloom ---
def generate_victory(filename, duration=1.6):
    num_samples = int(SAMPLE_RATE * duration)
    samples = []
    # Arpeggio notes in A min9: A4 (440), C5 (523.25), E5 (659.25), B5 (987.77)
    notes = [
        (0.00, 440.00),
        (0.12, 523.25),
        (0.24, 659.25),
        (0.36, 987.77),
    ]
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        sample = 0.0
        for start_t, freq in notes:
            if t >= start_t:
                dt = t - start_t
                env = math.exp(-dt * 3.2)
                # Soft chime
                tone = math.sin(2 * math.pi * freq * dt) + 0.3 * math.sin(2 * math.pi * freq * 2 * dt)
                sample += tone * env * 0.25
        samples.append(min(1.0, max(-1.0, sample)))
    write_wav(filename, samples)

# --- Sound Effect 4: Out of Moves / Damped Resonant Bass ---
def generate_fail(filename, duration=0.8):
    num_samples = int(SAMPLE_RATE * duration)
    samples = []
    base_freq = 95.0 # Low resonant boom
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        decay = math.exp(-t * 4.5)
        # Pitch downward drop
        curr_freq = base_freq * (1.0 - 0.3 * (t / duration))
        s1 = math.sin(2 * math.pi * curr_freq * t)
        s2 = 0.4 * math.sin(2 * math.pi * curr_freq * 2 * t) * math.exp(-t * 8.0)
        sample = (s1 + s2) * decay * 0.75
        samples.append(sample)
    write_wav(filename, samples)

# --- Sound Effect 5: Subtle UI Tap ---
def generate_tap(filename, duration=0.08):
    num_samples = int(SAMPLE_RATE * duration)
    samples = []
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        decay = math.exp(-t * 80.0)
        tone = math.sin(2 * math.pi * 580 * t) + 0.3 * math.sin(2 * math.pi * 840 * t)
        sample = tone * decay * 0.45
        samples.append(sample)
    write_wav(filename, samples)

# --- Duet-Inspired Ambient Background Music (Hypnotic, Loopable stereo soundtrack) ---
def generate_ambient_loop(filename, duration_beats=16, bpm=78):
    beat_duration = 60.0 / bpm
    total_duration = duration_beats * beat_duration
    total_samples = int(SAMPLE_RATE * total_duration)
    samples = []
    
    # Chord progression: A minor -> F maj7 -> C maj -> G6
    # Hypnotic warm drone chords (filtered saws / multiple detuned sines)
    chords = [
        # Chord 1: Am (A2, E3, A3, C4)
        [110.0, 164.81, 220.0, 261.63],
        # Chord 2: Fmaj7 (F2, C3, E3, A3)
        [87.31, 130.81, 164.81, 220.0],
        # Chord 3: C (C2, G2, E3, G3)
        [65.41, 97.99, 164.81, 196.0],
        # Chord 4: Em/G (G2, B2, E3, B3)
        [98.0, 123.47, 164.81, 246.94],
    ]
    chord_duration = total_duration / len(chords)
    
    # 16-step rhythmic arp pattern in A minor
    arp_notes = [
        440.0, 523.25, 659.25, 523.25,
        783.99, 659.25, 523.25, 440.0,
        392.0, 523.25, 659.25, 783.99,
        659.25, 523.25, 440.0, 329.63
    ]
    step_duration = total_duration / len(arp_notes)
    
    for i in range(total_samples):
        t = i / SAMPLE_RATE
        
        # 1. Warm Ambient Drone
        chord_idx = int(t / chord_duration) % len(chords)
        active_chord = chords[chord_idx]
        
        # Smooth crossfade between chords
        local_t = t % chord_duration
        pad_env = math.sin(math.pi * (local_t / chord_duration)) ** 0.5
        
        pad_l = 0.0
        pad_r = 0.0
        for f in active_chord:
            # Gentle detune
            d1 = math.sin(2 * math.pi * f * 1.002 * t)
            d2 = math.sin(2 * math.pi * f * 0.998 * t)
            pad_l += (d1 + 0.4 * d2) * 0.06
            pad_r += (0.4 * d1 + d2) * 0.06
        
        pad_l *= pad_env
        pad_r *= pad_env
        
        # 2. Subtle rhythmic pulse (soft kick on every beat: 0.1s decay)
        beat_t = (t % beat_duration)
        pulse = math.sin(2 * math.pi * 55.0 * math.exp(-beat_t * 20.0) * beat_t) * math.exp(-beat_t * 9.0) * 0.18
        
        # 3. Hypnotic Duet-style Pluck Arpeggio
        step_idx = int(t / step_duration) % len(arp_notes)
        note_freq = arp_notes[step_idx]
        step_t = t % step_duration
        
        # Pluck envelope
        pluck_env = math.exp(-step_t * 7.5)
        pluck = (math.sin(2 * math.pi * note_freq * step_t) + 
                 0.25 * math.sin(2 * math.pi * note_freq * 2 * step_t) * math.exp(-step_t * 14.0)) * pluck_env * 0.12
        
        # Stereo panning for the arp
        pan = math.sin(2 * math.pi * (t / (total_duration * 0.5)))
        arp_l = pluck * (0.5 - 0.3 * pan)
        arp_r = pluck * (0.5 + 0.3 * pan)
        
        # 4. Master Mix
        left = pad_l + pulse * 0.6 + arp_l
        right = pad_r + pulse * 0.6 + arp_r
        
        # Master limiter
        left = max(-0.95, min(0.95, left))
        right = max(-0.95, min(0.95, right))
        
        samples.append((left, right))
        
    write_wav(filename, samples, channels=2)

def main():
    out_dir = "assets/audio"
    # Flip pitches (Pentatonic tones)
    generate_chime(f"{out_dir}/flip_1.wav", 220.0) # A3
    generate_chime(f"{out_dir}/flip_2.wav", 261.63) # C4
    generate_chime(f"{out_dir}/flip_3.wav", 293.66) # D4
    generate_chime(f"{out_dir}/flip_4.wav", 329.63) # E4
    generate_chime(f"{out_dir}/flip_5.wav", 392.00) # G4
    
    generate_crystal_special(f"{out_dir}/special.wav")
    generate_victory(f"{out_dir}/victory.wav")
    generate_fail(f"{out_dir}/fail.wav")
    generate_tap(f"{out_dir}/tap.wav")
    generate_ambient_loop(f"{out_dir}/ambient_bgm.wav")

if __name__ == "__main__":
    main()

