#!/usr/bin/env python3
"""
Synthesizes a short, license-free groove for the Cavaro App Store preview.

  python3 make_score.py <jazz|bossa|soul> <total_seconds> <ending_start_seconds> <out.wav>

10 bars of groove are fitted exactly between 0 and <ending_start_seconds> (the moment the
end card appears); a final chord then rings out to <total_seconds>.
Pure standard library (no numpy), so it is a little slow (~20-40 s).
"""
import array
import math
import random
import sys
import wave

STYLE, TOTAL, ENDING, OUT = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
SR = 44100
N = int((TOTAL + 0.5) * SR)
L = array.array("f", bytes(4 * N))
R = array.array("f", bytes(4 * N))
BARS = 10
BAR = ENDING / BARS
BEAT = BAR / 4
rng = random.Random(7)
TAU = 2 * math.pi


def add(i, l, r):
    if 0 <= i < N:
        L[i] += l
        R[i] += r


def pan_gains(p):  # p in [-1, 1]
    a = (p + 1) * math.pi / 4
    return math.cos(a), math.sin(a)


# ---------------------------------------------------------------- instruments
def epiano(f, t0, dur, vel=0.18, pan=0.0):
    """FM electric piano: bright tine attack mellowing to a warm sustain, with autopan tremolo."""
    i0, n = int(t0 * SR), int((dur + 0.35) * SR)
    gl, gr = pan_gains(pan)
    for k in range(n):
        t = k / SR
        env = (min(1, t / 0.004)) * math.exp(-t / 1.4)
        if t > dur:
            env *= math.exp(-(t - dur) / 0.08)
        idx = 0.25 + 1.6 * math.exp(-t / 0.12)
        s = math.sin(TAU * f * t + idx * math.sin(TAU * f * t))
        s += 0.12 * math.sin(TAU * 4 * f * t) * math.exp(-t / 0.05)  # tine "ping"
        trem = 0.12 * math.sin(TAU * 4.6 * t)
        v = vel * env * s
        add(i0 + k, v * gl * (1 + trem), v * gr * (1 - trem))


def pluck(f, t0, vel=0.22, pan=0.0, decay=0.9965, length=1.6):
    """Karplus-Strong nylon-ish string."""
    i0, n = int(t0 * SR), int(length * SR)
    p = max(2, int(SR / f))
    buf = [rng.uniform(-1, 1) for _ in range(p)]
    # soften the excitation (thumb, not pick)
    for _ in range(2):
        buf = [(buf[j] + buf[j - 1]) * 0.5 for j in range(p)]
    gl, gr = pan_gains(pan)
    j = 0
    for k in range(n):
        a = buf[j]
        nxt = (j + 1) % p
        buf[j] = decay * 0.5 * (a + buf[nxt])
        j = nxt
        env = min(1, k / 40)
        add(i0 + k, vel * a * env * gl, vel * a * env * gr)


def bass(f, t0, dur, vel=0.20):
    """Round upright/electric bass with a soft pluck."""
    i0, n = int(t0 * SR), int((dur + 0.08) * SR)
    for k in range(n):
        t = k / SR
        env = min(1, t / 0.008) * math.exp(-t / 0.9)
        if t > dur:
            env *= math.exp(-(t - dur) / 0.03)
        s = math.sin(TAU * f * t) + 0.55 * math.sin(TAU * 2 * f * t) * math.exp(-t / 0.4) \
            + 0.08 * math.sin(TAU * 3 * f * t) * math.exp(-t / 0.08)
        v = vel * env * s
        add(i0 + k, v, v)


def noise_hit(t0, tau, vel, pan=0.0, hp=0.85, length=None):
    """Filtered noise: brushes, hats, shaker."""
    i0, n = int(t0 * SR), int((length or tau * 6) * SR)
    gl, gr = pan_gains(pan)
    prev_in = prev_out = 0.0
    for k in range(n):
        x = rng.uniform(-1, 1)
        y = hp * (prev_out + x - prev_in)  # one-pole high-pass
        prev_in, prev_out = x, y
        env = min(1, k / 30) * math.exp(-(k / SR) / tau)
        add(i0 + k, vel * y * env * gl, vel * y * env * gr)


def kick(t0, vel=0.35):
    i0, n = int(t0 * SR), int(0.35 * SR)
    ph = 0.0
    for k in range(n):
        t = k / SR
        f = 48 + 60 * math.exp(-t / 0.04)
        ph += TAU * f / SR
        v = vel * math.sin(ph) * math.exp(-t / 0.13)
        add(i0 + k, v, v)


def clave(t0, vel=0.16, pan=0.25):
    i0, n = int(t0 * SR), int(0.12 * SR)
    gl, gr = pan_gains(pan)
    for k in range(n):
        t = k / SR
        v = vel * math.sin(TAU * 2350 * t) * math.exp(-t / 0.018)
        add(i0 + k, v * gl, v * gr)


# ---------------------------------------------------------------- harmony (F major)
NOTE = {n: 440 * 2 ** ((i - 9) / 12) for i, n in enumerate(
    ["C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4"])}


def hz(name):
    letter, octave = name[:-1], int(name[-1])
    return NOTE[letter + "4"] * 2 ** (octave - 4)


# (bass root, chord third, fifth, voicing)
CH = {
    "Fmaj9": ("F2", "A2", "C3", ["A3", "C4", "E4", "G4"]),
    "Dm9":   ("D2", "F2", "A2", ["F3", "A3", "C4", "E4"]),
    "Gm9":   ("G2", "A#2", "D3", ["A#3", "D4", "F4", "A4"]),
    "C13":   ("C2", "E2", "G2", ["E3", "A#3", "D4", "A4"]),
    "C7b9":  ("C2", "E2", "G2", ["E3", "A#3", "C#4", "G4"]),
    "Am7":   ("A2", "C3", "E3", ["G3", "C4", "E4", "A4"]),
    "D7":    ("D2", "F#2", "A2", ["F#3", "C4", "E4", "A4"]),
}
# each bar: one or two chords (two = 2 beats each)
PROG = [["Fmaj9"], ["Dm9"], ["Gm9"], ["C13"], ["Fmaj9"], ["Dm9"], ["Gm9"], ["C7b9"],
        ["Am7", "D7"], ["Gm9", "C13"]]


def chord_at(bar, beat):
    seg = PROG[bar]
    return seg[0] if len(seg) == 1 or beat < 2 else seg[1]


def next_root(bar, beat):
    b, bt = (bar, 2) if len(PROG[bar]) == 2 and beat < 2 else (bar + 1, 0)
    name = "Fmaj9" if b >= BARS else chord_at(b, bt)
    return hz(CH[name][0])


def humanize(t, amt=0.006):
    return t + rng.uniform(-amt, amt)


# ---------------------------------------------------------------- styles
def jazz():
    swing = 2 / 3  # swung 8th position within a beat
    for bar in range(BARS):
        b0 = bar * BAR
        # walking bass: root, 3rd, 5th, chromatic approach into the next chord
        for beat in range(4):
            name = chord_at(bar, beat)
            root, third, fifth, _ = CH[name]
            local = beat % 2 if len(PROG[bar]) == 2 else beat
            if local == 0:
                f = hz(root)
            elif local == 1 and len(PROG[bar]) == 2:
                f = next_root(bar, beat) * 2 ** (-1 / 12)
            elif local == 1:
                f = hz(third)
            elif local == 2:
                f = hz(fifth)
            else:
                f = next_root(bar, beat) * 2 ** (1 / 12 if rng.random() < 0.5 else -1 / 12)
            bass(f, humanize(b0 + beat * BEAT), BEAT * 0.92)
        # Rhodes comping: Charleston rhythm, anticipation on even bars
        hits = [(0.0, 0.7), (1 + swing, 1.2)] if bar % 2 == 0 else [(0.0, 0.5), (2 + swing, 0.6), (3 + swing, 0.9)]
        for pos, length in hits:
            name = chord_at(bar, int(pos))
            if bar % 2 == 1 and pos > 3:  # anticipate next bar's chord
                name = "Fmaj9" if bar + 1 >= BARS else chord_at(bar + 1, 0)
            for i, note in enumerate(CH[name][3]):
                epiano(hz(note), humanize(b0 + pos * BEAT + i * 0.004), length * BEAT,
                       vel=0.26, pan=-0.35 + i * 0.22)
        # brushes / ride: ding, ding-da ding, ding-da
        for beat in range(4):
            noise_hit(humanize(b0 + beat * BEAT), 0.07, 0.16, pan=0.45, hp=0.97, length=0.35)
            if beat in (1, 3):
                noise_hit(humanize(b0 + (beat + swing) * BEAT), 0.04, 0.11, pan=0.45, hp=0.97, length=0.2)
                noise_hit(humanize(b0 + beat * BEAT), 0.025, 0.08, pan=-0.2, hp=0.97, length=0.12)  # hat foot
            if beat in (0, 2):
                kick(humanize(b0 + beat * BEAT), vel=0.10)


def bossa():
    for bar in range(BARS):
        b0 = bar * BAR
        e = BEAT / 2  # straight 8ths
        # bossa bass: root (dotted quarter), fifth, fifth, root
        for pos, which in [(0, 0), (3, 2), (4, 2), (7, 0)]:
            name = chord_at(bar, pos // 2)
            root, _, fifth, _ = CH[name]
            f = hz(root) if which == 0 else hz(fifth) / 2 if hz(fifth) > 140 else hz(fifth)
            bass(f, humanize(b0 + pos * e), e * (2.6 if pos in (0, 4) else 0.9), vel=0.20)
            kick(humanize(b0 + pos * e), vel=0.08 if pos in (0, 4) else 0.05)
        # nylon guitar comping (Joao Gilberto-style syncopation, alternating bars)
        pattern = [0, 2, 3, 5, 6] if bar % 2 == 0 else [1, 3, 4, 6]
        for pos in pattern:
            name = chord_at(bar, pos // 2)
            for i, note in enumerate(CH[name][3]):
                pluck(hz(note), humanize(b0 + pos * e + i * 0.007), vel=0.42, pan=-0.3 + i * 0.12,
                      length=e * 1.9 / 1.0)
        # clave (2-3 bossa clave across two bars) and shaker 16ths
        for pos in ([2, 5] if bar % 2 == 0 else [0, 3, 6]):
            clave(humanize(b0 + pos * e, 0.003))
        for s in range(16):
            noise_hit(humanize(b0 + s * e / 2, 0.003), 0.03, 0.050 if s % 4 == 2 else 0.026,
                      pan=0.5, hp=0.97, length=0.08)


def ending():
    """Final Fmaj9 rings out over the logo card."""
    t = ENDING
    bass(hz("F2"), t, TOTAL - t, vel=0.22)
    bass(hz("F1") * 2, t, TOTAL - t, vel=0.15)
    voicing = ["A3", "C4", "E4", "G4", "C5"]
    for i, note in enumerate(voicing):
        if STYLE in ("jazz", "soul"):
            epiano(hz(note), t + i * 0.035, TOTAL - t, vel=0.2, pan=-0.4 + i * 0.2)
        else:
            pluck(hz(note), t + i * 0.06, vel=0.3, pan=-0.4 + i * 0.2, decay=0.9985, length=TOTAL - t + 0.3)
    noise_hit(t, 0.6, 0.025, pan=0.45, hp=0.97, length=3.0)  # soft cymbal / shaker swell
    if STYLE == "soul":
        lead(hz("F5"), t, TOTAL - t - 0.6, vel=0.15, bend=True)
        noise_hit(t, 0.9, 0.06, pan=-0.3, hp=0.95, length=3.0)  # crash
        snare(t, vel=0.18)
    kick(t, vel=0.10)



# ---------------------------------------------------------------- neo-soul / pop-jazz
def snare(t0, vel=0.25, pan=0.05):
    """Tight snare: tonal body + bright noise, layered with a short clap."""
    i0, n = int(t0 * SR), int(0.35 * SR)
    gl, gr = pan_gains(pan)
    prev_in = prev_out = 0.0
    for k in range(n):
        t = k / SR
        x = rng.uniform(-1, 1)
        y = 0.8 * (prev_out + x - prev_in)
        prev_in, prev_out = x, y
        body = math.sin(TAU * 185 * t) * math.exp(-t / 0.05)
        v = vel * (0.6 * body + 0.9 * y * math.exp(-t / 0.11))
        add(i0 + k, v * gl, v * gr)
    for j, d in enumerate((0.0, 0.011, 0.022)):  # clap flams
        noise_hit(t0 - 0.01 + d, 0.012 if j < 2 else 0.07, vel * 0.55, pan=-0.1, hp=0.9, length=0.25)


def soul_bass(f, t0, dur, vel=0.2):
    """Finger bass with a little tube drive so it speaks on small speakers."""
    i0, n = int(t0 * SR), int((dur + 0.05) * SR)
    for k in range(n):
        t = k / SR
        env = min(1, t / 0.006) * math.exp(-t / 0.7)
        if t > dur:
            env *= math.exp(-(t - dur) / 0.02)
        s = math.sin(TAU * f * t) + 0.6 * math.sin(TAU * 2 * f * t) + 0.25 * math.sin(TAU * 3 * f * t) * math.exp(-t / 0.1)
        v = vel * env * math.tanh(1.6 * s) / 1.2
        add(i0 + k, v, v)


def lead(f, t0, dur, vel=0.16, pan=0.0, bend=False):
    """Breathy sax-like lead: rich harmonics, delayed vibrato, optional scoop into the note."""
    i0, n = int(t0 * SR), int((dur + 0.12) * SR)
    gl, gr = pan_gains(pan)
    ph = 0.0
    amps = [1 / (h ** 1.35) for h in range(1, 9)]
    for k in range(n):
        t = k / SR
        env = min(1, t / 0.03)
        if t > dur:
            env *= math.exp(-(t - dur) / 0.04)
        vib = 1 + 0.0045 * math.sin(TAU * 5.4 * t) * min(1, max(0, (t - 0.18) / 0.2))
        scoop = 2 ** (-1.2 / 12 * math.exp(-t / 0.05)) if bend else 1
        ph += TAU * f * vib * scoop / SR
        bright = 0.55 + 0.45 * math.exp(-t / 0.25)
        s = 0.0
        for h, a in enumerate(amps, start=1):
            s += a * (bright ** (h - 1)) * math.sin(h * ph)
        s += 0.04 * rng.uniform(-1, 1) * env  # breath
        v = vel * env * s
        add(i0 + k, v * gl, v * gr)


SOUL_CH = {  # bass root, fifth, Rhodes voicing
    "Bbmaj9": ("A#1", "F2", ["A3", "C4", "D4", "F4"]),
    "Am9":    ("A1", "E2", ["C4", "E4", "G4", "B4"]),
    "Dm9":    ("D2", "A2", ["F3", "A3", "C4", "E4"]),
    "Gm9":    ("G1", "D2", ["A#3", "D4", "F4", "A4"]),
    "C13":    ("C2", "G2", ["E3", "A#3", "D4", "A4"]),
    "C13sus": ("C2", "G2", ["F3", "A#3", "D4", "G4"]),
    "D7#9":   ("D2", "A2", ["F#3", "C4", "F4", "A4"]),
    "Fmaj9":  ("F1", "C2", ["A3", "C4", "E4", "G4"]),
}
SOUL_PROG = [["Bbmaj9"], ["Am9"], ["Dm9"], ["Gm9", "C13"], ["Bbmaj9"], ["Am9", "D7#9"],
             ["Gm9"], ["C13sus", "C13"], ["Bbmaj9", "Am9"], ["Gm9", "C13"]]
# hook: (bar, 16th step, length in 16ths, note, scoop)
HOOK = [
    (0, 2, 2, "C5", 0), (0, 4, 2, "D5", 0), (0, 6, 6, "F5", 1), (0, 12, 2, "E5", 0), (0, 14, 2, "D5", 0),
    (1, 0, 6, "C5", 0), (1, 8, 2, "A4", 0), (1, 10, 2, "C5", 0), (1, 12, 4, "D5", 1),
    (2, 0, 3, "F5", 0), (2, 3, 1, "E5", 0), (2, 4, 5, "D5", 0), (2, 10, 2, "C5", 0), (2, 12, 4, "A4", 0),
    (3, 0, 4, "A#4", 1), (3, 4, 2, "A4", 0), (3, 6, 2, "G4", 0), (3, 10, 2, "A4", 0), (3, 12, 4, "C5", 1),
    (4, 2, 2, "C5", 0), (4, 4, 2, "D5", 0), (4, 6, 6, "F5", 1), (4, 12, 2, "G5", 0), (4, 14, 2, "F5", 0),
    (5, 0, 6, "E5", 0), (5, 8, 2, "C5", 0), (5, 10, 2, "D5", 0), (5, 12, 4, "F#5", 1),
    (6, 0, 3, "F5", 0), (6, 3, 1, "D5", 0), (6, 4, 4, "A#4", 0), (6, 10, 2, "C5", 0), (6, 12, 4, "D5", 0),
    (7, 0, 4, "F5", 1), (7, 4, 2, "D5", 0), (7, 6, 2, "C5", 0), (7, 8, 6, "E5", 1),
    (8, 0, 2, "F5", 0), (8, 2, 2, "G5", 0), (8, 4, 4, "A5", 1), (8, 8, 2, "G5", 0), (8, 10, 2, "F5", 0), (8, 12, 4, "E5", 0),
    (9, 0, 4, "D5", 1), (9, 4, 2, "E5", 0), (9, 6, 2, "F5", 0), (9, 8, 2, "G5", 0), (9, 10, 2, "A5", 0), (9, 12, 4, "G5", 1),
]


def soul():
    st = BAR / 16  # 16th
    lazy = 0.16 * st  # laid-back swing on the off 16ths

    def at(step):
        return step * st + (lazy if step % 2 else 0)

    def chord(bar, step):
        seg = SOUL_PROG[bar] if bar < BARS else ["Fmaj9"]
        return seg[0] if len(seg) == 1 or step < 8 else seg[1]

    for bar in range(BARS):
        b0 = bar * BAR
        # drums
        for step in range(16):
            accent = 1.0 if step % 4 == 0 else 0.75 if step % 2 == 0 else 0.45
            if not (bar % 2 == 1 and step == 14):
                noise_hit(humanize(b0 + at(step), 0.003), 0.03, 0.07 * accent, pan=0.35, hp=0.97, length=0.12)
        if bar % 2 == 1:
            noise_hit(humanize(b0 + at(14), 0.003), 0.18, 0.07, pan=0.35, hp=0.97, length=0.5)  # open hat
        for step in ([0, 6, 10] if bar % 2 == 0 else [0, 3, 10, 13]):
            kick(humanize(b0 + at(step), 0.003), vel=0.34 if step == 0 else 0.26)
        for step in (4, 12):
            snare(humanize(b0 + at(step), 0.003), vel=0.26)
        for step in (7, 15):
            snare(humanize(b0 + at(step), 0.004), vel=0.05)  # ghost notes
        # bass: syncopated finger line
        for step, kind, length in [(0, "R", 3), (3, "R", 1), (6, "O", 2), (8, "R", 2), (10, "5", 2), (13, "R", 1), (14, "A", 2)]:
            name = chord(bar, step)
            root, fifth, _ = SOUL_CH[name]
            if kind == "R":
                f = hz(root)
            elif kind == "O":
                f = hz(root) * 2
            elif kind == "5":
                f = hz(fifth)
            else:
                nxt = hz(SOUL_CH[chord(bar + 1, 0)][0])
                f = nxt * 2 ** ((1 if rng.random() < 0.5 else -1) / 12)
            soul_bass(f, humanize(b0 + at(step)), length * st * 0.95)
        # Rhodes comping with a chromatic slide into bars 3 and 7
        if bar in (2, 6):
            for i, note in enumerate(SOUL_CH[chord(bar, 0)][2]):
                epiano(hz(note) * 2 ** (-1 / 12), humanize(b0 - st * 0.6 + i * 0.003), st * 0.5, vel=0.14,
                       pan=-0.35 + i * 0.22)
        for step, length in [(0, 5), (6, 1.5), (10, 3), (14, 2)]:
            name = chord(bar, step) if step < 14 else chord(bar + 1, 0)
            for i, note in enumerate(SOUL_CH[name][2]):
                epiano(hz(note), humanize(b0 + at(step) + i * 0.004), length * st, vel=0.21,
                       pan=-0.35 + i * 0.22)
    # the hook
    for bar, step, length, note, bend in HOOK:
        lead(hz(note), humanize(bar * BAR + at(step), 0.008), length * st * 0.92, vel=0.15, bend=bool(bend))


{"jazz": jazz, "bossa": bossa, "soul": soul}[STYLE]()
ending()

peak = max(max(abs(x) for x in L), max(abs(x) for x in R)) or 1
g = 0.89 / peak
frames = array.array("h", bytes(4 * N))
for i in range(N):
    frames[2 * i] = int(L[i] * g * 32767)
    frames[2 * i + 1] = int(R[i] * g * 32767)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(frames.tobytes())
print(f"{STYLE}: {TOTAL:.2f}s, bar {BAR:.3f}s ({240 / BAR:.1f} bpm) -> {OUT}")
