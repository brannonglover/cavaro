#!/bin/zsh
# Builds the Cavaro App Store preview from simulator captures.
#   build_preview.sh <clips_dir> <gfx_dir> <out.mp4> [jazz|bossa|soul|ambient|<audio file>]
# clips: s1_home s2_humidors s3_detail s3b_match s4_journal s5_taste s6_collection (.mp4, 1320x2868 simctl captures)
# gfx:   bg.png mask.png frame.png cap_1..7.png end.png (from render_gfx.swift)
# score: jazz (default) / bossa / soul are synthesized by make_score.py; ambient is the original pad bed.
#
# Output meets App Store app-preview specs: 886x1920 portrait, 30 fps, H.264 High,
# AAC stereo 256 kbps 48 kHz, under 30 s.
set -euo pipefail
CLIPS=$1; GFX=$2; OUT=$3; STYLE=${4:-jazz}
HERE=${0:A:h}
WORK=$(mktemp -d "${TMPDIR:-/tmp}/cavaro-preview.XXXXXX")
FPS=30; XF=0.4

# scene: clip  in  out  hold(sec)  caption
SCENES=(
  "s1_home       0.40 2.77 0.70 1"
  "s2_humidors   0.60 4.45 0.30 2"
  "s3_detail     0.70 5.51 0.25 3"
  "s3b_match     0.80 5.77 0.80 4"
  "s4_journal    1.00 3.52 0.55 5"
  "s5_taste      1.00 3.46 0.60 6"
  "s6_collection 3.00 5.55 0.60 7"
)

i=0
DURS=()
for s in "${SCENES[@]}"; do
  read -r clip tin tout hold cap <<<"$s"
  i=$((i+1))
  ffmpeg -v error -y \
    -i "$CLIPS/$clip.mp4" \
    -loop 1 -framerate $FPS -i "$GFX/bg.png" \
    -loop 1 -framerate $FPS -i "$GFX/mask.png" \
    -loop 1 -framerate $FPS -i "$GFX/frame.png" \
    -loop 1 -framerate $FPS -i "$GFX/cap_$cap.png" \
    -filter_complex "
      [0:v]trim=start=${tin}:end=${tout},setpts=PTS-STARTPTS,fps=$FPS,
           tpad=stop_mode=clone:stop_duration=${hold},
           scale=644:1400:flags=lanczos,format=rgba[f];
      [2:v]format=gray[m];
      [f][m]alphamerge[fm];
      [1:v][fm]overlay=121:452:shortest=1[a];
      [a][3:v]overlay=shortest=1[b];
      [b][4:v]overlay=shortest=1,format=yuv420p[v]" \
    -map "[v]" -t $(printf %.3f $((tout - tin + hold))) -r $FPS -c:v libx264 -preset slow -crf 12 "$WORK/scene$i.mp4"
  DURS+=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$WORK/scene$i.mp4")
  echo "scene$i ($clip) ${DURS[-1]}s"
done

# End card: 3 s, gentle push-in on the logo card
ffmpeg -v error -y -loop 1 -framerate $FPS -i "$GFX/end.png" \
  -vf "scale=1772:3840,zoompan=z='1+0.035*on/(3*$FPS)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=3*${FPS}:s=886x1920:fps=${FPS},format=yuv420p" \
  -frames:v $((3*FPS)) -c:v libx264 -preset slow -crf 12 "$WORK/scene8.mp4"
DURS+=3.0
N=8

# Crossfade chain
inputs=(); for k in $(seq 1 $N); do inputs+=(-i "$WORK/scene$k.mp4"); done
filter=""; prev="[0:v]"; offset=0
for k in $(seq 1 $((N-1))); do
  d=${DURS[$k]}
  offset=$(printf "%.3f" $((offset + d - XF)))
  out="[x$k]"; [[ $k -eq $((N-1)) ]] && out="[vx]"
  filter+="${prev}[${k}:v]xfade=transition=fade:duration=${XF}:offset=${offset}${out};"
  prev="[x$k]"
done
TOTAL=$(printf "%.3f" $((offset + ${DURS[$N]})))
# fade up from black at the start
filter+="[vx]fade=t=in:st=0:d=0.5,format=yuv420p[v]"
ffmpeg -v error -y "${inputs[@]}" -filter_complex "$filter" -map "[v]" -r $FPS \
  -c:v libx264 -preset slow -crf 14 "$WORK/video.mp4"
echo "video total ${TOTAL}s"

if [[ -f $STYLE ]]; then
  # Pre-edited audio file (e.g. audio/score-trumpet-jazz-27s.wav): already timed and leveled.
  ffmpeg -v error -y -i "$STYLE" -af "apad=whole_dur=${TOTAL},atrim=0:${TOTAL}" -ar 48000 -ac 2 "$WORK/score.wav"
elif [[ $STYLE != ambient ]]; then
  # Groove score: 10 bars fitted to end exactly as the end card appears, final chord rings out.
  ENDCARD=$(printf "%.3f" $((TOTAL - ${DURS[$N]})))
  python3 "$HERE/make_score.py" "$STYLE" "$TOTAL" "$ENDCARD" "$WORK/score_raw.wav"
  ffmpeg -v error -y -i "$WORK/score_raw.wav" -af "
    aecho=0.85:0.5:45|95:0.18|0.10,
    atrim=0:$TOTAL,afade=t=in:d=0.4,afade=t=out:st=$(printf %.2f $((TOTAL-2.2))):d=2.2,
    loudnorm=I=-16:TP=-1.5:LRA=9" -ar 48000 -ac 2 "$WORK/score.wav"
else
# Ambient score: warm detuned pads over a slow 4-chord progression, soft room echo.
pad() { # freqs... -> aevalsrc expression (stereo, slightly different detune per channel)
  local l="" r=""
  for f in "$@"; do
    l+="+0.55*sin(2*PI*$f*t)+0.35*sin(2*PI*$f*1.0035*t)+0.08*sin(4*PI*$f*t)"
    r+="+0.55*sin(2*PI*$f*1.0018*t)+0.35*sin(2*PI*$f*0.9968*t)+0.08*sin(4*PI*$f*1.001*t)"
  done
  echo "(0.06*(0.85+0.15*sin(2*PI*0.18*t))*(${l#+}))|(0.06*(0.85+0.15*sin(2*PI*0.21*t+1))*(${r#+}))"
}
SEG=8.2; AXF=1.6
CH1=$(pad 73.42 146.83 220.00 277.18 329.63 369.99)   # Dmaj9
CH2=$(pad 61.74 123.47 185.00 220.00 277.18 293.66)   # Bm9
CH3=$(pad 49.00  98.00 146.83 185.00 246.94 277.18)   # Gmaj7(#11 colour)
CH4=$(pad 55.00 110.00 164.81 246.94 293.66 369.99)   # A6sus
k=0
for ch in "$CH1" "$CH2" "$CH3" "$CH4"; do
  k=$((k+1))
  ffmpeg -v error -y -f lavfi -i "aevalsrc='$ch':s=48000:d=$SEG" \
    -af "afade=t=in:d=1.2,afade=t=out:st=$(printf %.2f $((SEG-1.2))):d=1.2" "$WORK/ch$k.wav"
done
ffmpeg -v error -y -i "$WORK/ch1.wav" -i "$WORK/ch2.wav" -i "$WORK/ch3.wav" -i "$WORK/ch4.wav" \
  -f lavfi -i "anoisesrc=color=brown:amplitude=0.02:d=40:r=48000" \
  -filter_complex "
    [0][1]acrossfade=d=${AXF}[a1];[a1][2]acrossfade=d=${AXF}[a2];[a2][3]acrossfade=d=${AXF}[pad];
    [4]lowpass=f=500,pan=stereo|c0=c0|c1=c0,volume=0.6[room];
    [pad][room]amix=inputs=2:duration=first:normalize=0,
    lowpass=f=2400,aecho=0.8:0.6:80|170|290:0.30|0.22|0.15,
    atrim=0:$TOTAL,afade=t=in:d=1.5,afade=t=out:st=$(printf %.2f $((TOTAL-2.5))):d=2.5,
    loudnorm=I=-20:TP=-2:LRA=7" \
  -ar 48000 -ac 2 "$WORK/score.wav"
fi

ffmpeg -v error -y -i "$WORK/video.mp4" -i "$WORK/score.wav" \
  -map 0:v -map 1:a -c:v libx264 -profile:v high -level 4.2 -pix_fmt yuv420p -preset slow \
  -b:v 10M -maxrate 12M -bufsize 20M -r $FPS -g 30 \
  -c:a aac -b:a 256k -ar 48000 -ac 2 -shortest -movflags +faststart "$OUT"
rm -rf "$WORK"
ffprobe -v error -show_entries stream=codec_name,profile,width,height,r_frame_rate,sample_rate,channels,bit_rate:format=duration,size -of compact "$OUT"
