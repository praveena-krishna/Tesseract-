#!/usr/bin/env bash
#
# Rebuilds ost/ from the 320 kbps release.
#
# Only needed if a track changes or ost/ is lost — its output is tracked, because
# production serves flat files and a track that is not in the build output is a
# 404, and a 404 is silence. The 320 kbps masters are NOT tracked; recover them
# from git history before b4fd358 if this needs to run on a fresh checkout.
#
# Two decisions are load-bearing:
#
#   - 128 kbps rather than 320. These are beds under a 3D scene at MASTER 0.85;
#     the difference is inaudible there and it takes 216 MB down to 87 MB, which
#     is the difference between a cue opening now and a cue opening in a moment.
#   - CBR rather than VBR. Every cue in this score opens partway into its
#     recording, and constant bitrate makes seeking to 116.0s byte arithmetic
#     instead of a lookup in a Xing table.
#
# Filenames become web-safe slugs — `15. S.T.A.Y..mp3` to `15-stay-reprise.mp3`.
# A CDN path carrying spaces, apostrophes and a doubled dot is a class of failure
# indistinguishable from the audio simply not working. The slugs here must stay
# in step with the `file` fields in src/config/audio.ts.
#
# Needs GStreamer: gst-launch-1.0 with mpegaudioparse, mpg123audiodec, lamemp3enc.
set -u
cd "$(dirname "$0")/.." || exit 1
SRC="Hans Zimmer - Interstellar OST (Deluxe) 2014 [MP3 @ 320 kbps]"
DST="ost"
mkdir -p "$DST"

map=(
"01. Dreaming of the Crash.mp3|01-dreaming-of-the-crash.mp3"
"02. Cornfield Chase.mp3|02-cornfield-chase.mp3"
"03. Dust.mp3|03-dust.mp3"
"04. Day One.mp3|04-day-one.mp3"
"05. Stay.mp3|05-stay.mp3"
"06. Message From Home.mp3|06-message-from-home.mp3"
"07. The Wormhole.mp3|07-the-wormhole.mp3"
"08. Mountains.mp3|08-mountains.mp3"
"09. Afraid of Time.mp3|09-afraid-of-time.mp3"
"10. A Place Among the Stars.mp3|10-a-place-among-the-stars.mp3"
"11. Running Out.mp3|11-running-out.mp3"
"12. I'm Going Home.mp3|12-im-going-home.mp3"
"13. Coward.mp3|13-coward.mp3"
"14. Detach.mp3|14-detach.mp3"
"15. S.T.A.Y..mp3|15-stay-reprise.mp3"
"16. Where We're Going.mp3|16-where-were-going.mp3"
"17. First Step.mp3|17-first-step.mp3"
"18. Flying Drone.mp3|18-flying-drone.mp3"
"19. Atmospheric Entry.mp3|19-atmospheric-entry.mp3"
"20. No Need To Come Back.mp3|20-no-need-to-come-back.mp3"
"21. Imperfect Lock.mp3|21-imperfect-lock.mp3"
"22. What Happens Now.mp3|22-what-happens-now.mp3"
"23. Do Not Go Gentle Into That Good Night.mp3|23-do-not-go-gentle.mp3"
)

fail=0
for entry in "${map[@]}"; do
  in="$SRC/${entry%%|*}"
  out="$DST/${entry##*|}"
  if [ ! -f "$in" ]; then echo "MISSING SOURCE: $in"; fail=1; continue; fi
  gst-launch-1.0 -q \
    filesrc location="$in" ! mpegaudioparse ! mpg123audiodec \
    ! audioconvert ! audioresample \
    ! lamemp3enc target=bitrate bitrate=128 cbr=true ! xingmux ! id3v2mux \
    ! filesink location="$out" >/dev/null 2>&1
  if [ $? -ne 0 ] || [ ! -s "$out" ]; then echo "FAILED: $out"; fail=1; continue; fi
  printf "ok  %-40s %s\n" "${entry##*|}" "$(du -h "$out" | cut -f1)"
done
echo "---"
echo "files: $(ls -1 "$DST" | wc -l)  total: $(du -sh "$DST" | cut -f1)"
exit $fail
