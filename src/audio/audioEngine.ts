import {
  AUDIO,
  BEDS,
  MOMENTS,
  OST_ROUTE,
  TRACKS,
  type BedId,
  type Cue,
  type MomentId,
  type TrackId,
} from '../config/audio';

/**
 * The transport. One of these exists, and nothing else makes a sound.
 *
 * It knows how to hold a bed, raise a moment over it and give it back, and it
 * knows nothing at all about months, people or difficulties — the director
 * decides what should be playing and this decides how that happens. Keeping the
 * two apart is what stops audio calls from spreading through the scene: there
 * is exactly one caller and exactly one player.
 *
 * Three properties are worth stating because they are the ones that would be
 * easy to lose:
 *
 * - **Nothing is ever audible twice.** A bed is replaced rather than added to,
 *   and a moment takes the room outright rather than layering over it. The only
 *   time two recordings are open at once is the second or two of a crossfade,
 *   which is the crossfade.
 * - **Nothing is created per interaction.** A voice — an element, its source
 *   node and its gain — is built once per track and kept. Clicking sixteen orbs
 *   allocates nothing.
 * - **Nothing here runs on the render thread.** Gains are ramped by the audio
 *   clock, and the one timer in the file ticks four times a second, only while
 *   something bounded is playing.
 */

/* ------------------------------------------------------------------ *
 * Logging
 * ------------------------------------------------------------------ */

const LOGGING =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has(AUDIO.LOG_FLAG);

function log(action: string, detail?: string): void {
  if (!LOGGING) return;
  console.info(`[AUDIO] ${action}${detail ? ` — ${detail}` : ''}`);
}

function warn(message: string): void {
  // Always shown: a track that will not load is worth knowing about even in
  // production, and it is one line rather than a stream.
  console.warn(`[AUDIO] ${message}`);
}

/* ------------------------------------------------------------------ *
 * Voices
 * ------------------------------------------------------------------ */

interface Voice {
  el: HTMLAudioElement;
  gain: GainNode;
  /** Set once the element has been wired into the graph; it can only be done once. */
  wired: boolean;
  /** Whether this recording has failed to load, so it is not retried forever. */
  broken: boolean;
  /**
   * A seek that could not be performed yet, applied the moment it can be.
   *
   * This is not a nicety. Every cue in this score opens partway into its
   * recording, and an element that has not loaded its metadata cannot be
   * seeked — the assignment is dropped or throws. Without somewhere to hold the
   * intention, the first play of every track silently began at zero, which for
   * this album means the first two minutes of an introduction mixed at −60 dBFS.
   * That is indistinguishable from the audio not working at all.
   */
  seekTo: number | null;
}

function urlFor(track: TrackId): string {
  return OST_ROUTE + encodeURIComponent(TRACKS[track].file);
}

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */

interface Playing {
  cue: Cue;
  voice: Voice;
  /** When the transport should stop it, in element time. Infinity for a bed. */
  until: number;
}

const voices = new Map<TrackId, Voice>();

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

let bedId: BedId | null = null;
let bed: Playing | null = null;
let moment: Playing | null = null;
let momentId: MomentId | null = null;

let ducked = false;
/** How far the bed sits back under the moment currently running. */
let eventDuck: number = AUDIO.EVENT_DUCK;
let enabled = true;
let unlocked = false;
let hidden = false;

/** A bed asked for before the browser would let anything play. */
let pendingBed: BedId | null = null;

let ticker: number | null = null;

/* ------------------------------------------------------------------ *
 * The graph
 * ------------------------------------------------------------------ */

function context(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) {
    warn('Web Audio is unavailable; the world runs silent');
    return null;
  }
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = enabled ? AUDIO.MASTER : 0;
    master.connect(ctx.destination);
    return ctx;
  } catch {
    warn('Could not open an audio context; the world runs silent');
    return null;
  }
}

function voiceFor(track: TrackId): Voice | null {
  const audioCtx = context();
  if (!audioCtx || !master) return null;

  const existing = voices.get(track);
  if (existing) return existing;

  const el = new Audio();
  el.src = urlFor(track);
  el.preload = 'none';
  // No `crossOrigin`. The tracks are served same-origin by the `ost-assets`
  // plugin, and setting it would put the fetch in CORS mode for no reason —
  // which, with no Access-Control header on the response, is how a
  // MediaElementSource ends up silently connected to a muted element.
  // The engine loops by seeking, so the element must not also loop on its own —
  // a cue with an endTime would otherwise wrap past it.
  el.loop = false;
  el.addEventListener('error', () => {
    const voice = voices.get(track);
    if (voice) voice.broken = true;
    warn(`Failed to load ${TRACKS[track].file}`);
  });
  // The moment the recording knows how long it is, it can be positioned.
  el.addEventListener('loadedmetadata', () => {
    const voice = voices.get(track);
    if (!voice || voice.seekTo === null) return;
    try {
      voice.el.currentTime = voice.seekTo;
      log('seek', `${TRACKS[track].file} → ${voice.seekTo}s`);
    } catch {
      // Nothing more to try; it plays from wherever it is.
    }
    voice.seekTo = null;
  });

  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  gain.connect(master);

  const voice: Voice = { el, gain, wired: false, broken: false, seekTo: null };
  try {
    audioCtx.createMediaElementSource(el).connect(gain);
    voice.wired = true;
  } catch {
    // Routing failed, which on every browser that matters means the element was
    // already claimed. Fall back to the element's own volume so it is still
    // heard, just without the ramping.
    warn(`Could not route ${TRACKS[track].file} through the mixer`);
  }

  voices.set(track, voice);
  return voice;
}

/** Ramps a voice to a level over a number of seconds, from wherever it is. */
function ramp(voice: Voice, to: number, seconds: number): void {
  const audioCtx = ctx;
  if (!audioCtx) return;
  if (!voice.wired) {
    voice.el.volume = Math.max(0, Math.min(1, to));
    return;
  }
  const now = audioCtx.currentTime;
  const gain = voice.gain.gain;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(to, now + Math.max(0.01, seconds));
}

/**
 * The level a cue should sit at right now.
 *
 * Three things multiply. The cue's place in the loudness hierarchy; the
 * recording's own measured trim, which is what stops Detach arriving 25 dB
 * hotter than Message From Home; and, for a bed, whatever is currently standing
 * in front of it — an event cue pulls it back further than an observed person
 * does, and the two do not stack.
 */
function levelFor(cue: Cue, isBed: boolean): number {
  const trim = TRACKS[cue.track].gain;
  if (!isBed) return cue.volume * trim;
  const under = moment ? eventDuck : ducked ? AUDIO.FOCUS_DUCK : 1;
  return cue.volume * trim * under;
}

function start(voice: Voice, cue: Cue): void {
  if (voice.el.preload === 'none') voice.el.preload = 'auto';

  // HAVE_NOTHING: the length is not known yet, so a seek cannot land. Record it
  // and let `loadedmetadata` apply it — this is the first play of the track,
  // and it is exactly the case that used to start every cue at zero.
  if (voice.el.readyState === 0) {
    voice.seekTo = cue.startTime;
    if (voice.el.preload !== 'auto') voice.el.load();
  } else if (Math.abs(voice.el.currentTime - cue.startTime) > 0.25) {
    try {
      voice.el.currentTime = cue.startTime;
    } catch {
      voice.seekTo = cue.startTime;
    }
  }
  const played = voice.el.play();
  if (played) {
    played.catch(() => {
      // Autoplay refused. The unlock listener will start it on the first
      // gesture; nothing is broken and nothing should be logged loudly.
      log('deferred', 'waiting for a gesture');
    });
  }
}

function stop(voice: Voice): void {
  try {
    voice.el.pause();
  } catch {
    // A paused element that was never played throws on nothing worth catching.
  }
}

/* ------------------------------------------------------------------ *
 * The tick
 * ------------------------------------------------------------------ */

/**
 * Turns a bed over at its end, and takes a moment away at its.
 *
 * Beds are looped here rather than by `el.loop` because a cue may be bounded at
 * both ends, and because a hard wrap is audible. The last stretch is faded down
 * and the head faded back up, so the seam is a breath rather than a cut.
 */
function tick(): void {
  const audioCtx = ctx;
  if (!audioCtx) return;

  if (moment) {
    const { cue, voice, until } = moment;
    if (voice.el.currentTime >= until - cue.fadeOut) {
      ramp(voice, 0, cue.fadeOut);
    }
    if (voice.el.currentTime >= until || voice.el.ended) {
      endMoment();
    }
  }

  if (bed) {
    const { cue, voice, until } = bed;
    const end = Number.isFinite(until) ? until : voice.el.duration || Infinity;
    if (!Number.isFinite(end)) return;
    const remaining = end - voice.el.currentTime;
    if (remaining <= AUDIO.LOOP_FADE && remaining > 0) {
      ramp(voice, 0, remaining);
    } else if (remaining <= 0 || voice.el.ended) {
      if (!cue.loop) return;
      try {
        voice.el.currentTime = cue.startTime;
      } catch {
        // Nothing to do: the element will restart from wherever it can.
      }
      start(voice, cue);
      ramp(voice, levelFor(cue, true), AUDIO.LOOP_FADE);
    }
  }
}

function ensureTicker(): void {
  if (ticker !== null) return;
  ticker = window.setInterval(tick, AUDIO.TICK_MS);
}

function releaseTicker(): void {
  if (ticker === null) return;
  if (bed || moment) return;
  window.clearInterval(ticker);
  ticker = null;
}

/* ------------------------------------------------------------------ *
 * Moments
 * ------------------------------------------------------------------ */

function endMoment(): void {
  if (!moment) return;
  stop(moment.voice);
  moment = null;
  momentId = null;
  eventDuck = AUDIO.EVENT_DUCK;

  // The bed never stopped — it was pulled back underneath. So this is a lift
  // rather than a restart, and the place carries on from exactly where it got
  // to while the moment was in front of it.
  if (bed) {
    start(bed.voice, bed.cue);
    ramp(bed.voice, levelFor(bed.cue, true), AUDIO.MOMENT_FADE_OUT);
  }
  releaseTicker();
}

/* ------------------------------------------------------------------ *
 * The public transport
 * ------------------------------------------------------------------ */

/**
 * Opens the audio context on a real gesture and starts whatever was waiting.
 *
 * Every browser worth supporting refuses to make a sound until the page has
 * been touched, so the opening bed is asked for the moment the veil lifts and
 * held here until it is allowed. No prompt, no button, no explanation: the
 * viewer's first click on the world is the permission.
 */
function unlock(): void {
  const audioCtx = context();
  if (!audioCtx) return;
  // Also the recovery path. Browsers suspend a context for reasons of their
  // own — a tab left in the background, a device changing output — so this
  // stays armed for the life of the session rather than firing once.
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => undefined);
  }
  if (unlocked) return;
  unlocked = true;
  log('unlocked');

  if (pendingBed) {
    const wanted = pendingBed;
    pendingBed = null;
    bedId = null;
    setBed(wanted);
  } else if (bed) {
    start(bed.voice, bed.cue);
  }
}

/**
 * Puts the world in a place, musically.
 *
 * Idempotent by design and that is most of the point: the director recomputes
 * the scene on every store change, and asking for the bed that is already
 * playing has to be free. Passing null fades out and leaves silence.
 */
function setBed(next: BedId | null): void {
  if (next === bedId) return;
  const previous = bedId;
  bedId = next;

  if (!next) {
    if (bed) {
      ramp(bed.voice, 0, bed.cue.fadeOut);
      const leaving = bed.voice;
      window.setTimeout(() => stop(leaving), bed.cue.fadeOut * 1000);
      bed = null;
    }
    releaseTicker();
    log('bed', 'silence');
    return;
  }

  // Widened to `Cue`: the literal types of the individual beds do not carry
  // the optional fields, and this is read as a cue rather than as that one bed.
  const cue: Cue = BEDS[next];
  log('bed', `${next} → ${TRACKS[cue.track].file}${previous ? ` (from ${previous})` : ''}`);

  if (!unlocked) {
    // Remember it rather than start it: the browser would refuse, and a bed
    // that was refused would never be retried.
    pendingBed = next;
  }

  const voice = voiceFor(cue.track);
  if (!voice || voice.broken) return;

  // Out with the old, under the new. Both ramps run at once, which is what
  // makes it a crossfade rather than a gap.
  if (bed && bed.voice !== voice) {
    const leaving = bed;
    ramp(leaving.voice, 0, cue.fadeIn);
    window.setTimeout(() => {
      if (bed?.voice !== leaving.voice) stop(leaving.voice);
    }, cue.fadeIn * 1000);
  }

  bed = { cue, voice, until: cue.endTime ?? Infinity };

  // While a moment holds the room the new bed is prepared but not raised; the
  // moment hands it the room when it finishes.
  if (moment) return;

  if (unlocked) {
    start(voice, cue);
    ramp(voice, levelFor(cue, true), cue.fadeIn);
  }
  ensureTicker();
}

/**
 * Raises a bounded cue over the bed, then gives the bed back.
 *
 * `seconds` overrides the configured length for the one cue whose duration is
 * dictated by something on screen — the dimensional turn, which runs for as
 * long as the structure is turning.
 */
function playMoment(id: MomentId, seconds?: number, under?: number): void {
  if (!unlocked || !enabled) return;

  const cue: Cue = MOMENTS[id];
  const voice = voiceFor(cue.track);
  if (!voice || voice.broken) return;

  // A moment already running is not interrupted by another of the same kind —
  // clicking through three difficulties in a row should not machine-gun the
  // same eight bars.
  if (momentId === id && moment) return;

  if (moment) endMoment();

  const until = Math.min(
    cue.startTime + (seconds ?? (cue.endTime ?? Infinity) - cue.startTime),
    TRACKS[cue.track].seconds,
  );

  log('moment', `${id} → ${TRACKS[cue.track].file} (${(until - cue.startTime).toFixed(1)}s)`);

  moment = { cue, voice, until };
  momentId = id;
  eventDuck = under ?? AUDIO.EVENT_DUCK;

  // The bed is pulled back underneath rather than stopped. Two recordings play
  // at once here and nowhere else, which is what makes the moment read as
  // something happening in a place rather than a cut to another one — and it is
  // what lets the place come back without a seam.
  if (bed) ramp(bed.voice, levelFor(bed.cue, true), cue.fadeIn);
  // Positioning is `start`'s job: it knows to defer the seek until the
  // recording has metadata, which on a cue's first play it never does.
  start(voice, cue);
  ramp(voice, cue.volume, cue.fadeIn);
  ensureTicker();
}

/** Pulls the bed back while somebody is being observed, and releases it after. */
function setDucked(next: boolean): void {
  if (next === ducked) return;
  ducked = next;
  // Safe to apply under a moment: `levelFor` takes the deeper of the two ducks
  // rather than compounding them, so a person chosen mid-cue cannot bury it.
  if (bed) ramp(bed.voice, levelFor(bed.cue, true), AUDIO.DUCK_EASE);
}

/** The on/off control, and the only thing that touches the master. */
function setEnabled(next: boolean): void {
  enabled = next;
  if (!master || !ctx) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(next ? AUDIO.MASTER : 0, now + AUDIO.DUCK_EASE);
  log('sound', next ? 'on' : 'off');
}

function isEnabled(): boolean {
  return enabled;
}

/**
 * Fetches a track's first bytes so the cue that needs it opens immediately.
 *
 * `preload = 'auto'` rather than a fetch into memory: the element streams, so
 * this warms the connection and the head of the file without decoding a
 * six-minute recording into the heap.
 */
function preload(tracks: readonly TrackId[]): void {
  for (const track of tracks) {
    const voice = voiceFor(track);
    if (!voice || voice.broken) continue;
    if (voice.el.preload !== 'auto') {
      voice.el.preload = 'auto';
      voice.el.load();
    }
  }
}

/**
 * Stands the whole transport down when the tab goes away, and brings back
 * exactly what was playing when it returns.
 */
function setHidden(next: boolean): void {
  if (next === hidden) return;
  hidden = next;
  if (!ctx) return;
  if (next) {
    ctx.suspend().catch(() => undefined);
  } else if (enabled) {
    ctx.resume().catch(() => undefined);
  }
}

/** Stops everything and lets go of every element. For teardown only. */
function dispose(): void {
  if (ticker !== null) window.clearInterval(ticker);
  ticker = null;
  for (const voice of voices.values()) {
    stop(voice);
    voice.el.removeAttribute('src');
    try {
      voice.el.load();
    } catch {
      // Nothing to release.
    }
  }
  voices.clear();
  bed = null;
  bedId = null;
  moment = null;
  momentId = null;
  ctx?.close().catch(() => undefined);
  ctx = null;
  master = null;
  unlocked = false;
}

/** Whether the transport log and the on-screen readout are on. */
const AUDITING = LOGGING;

export interface AudioSnapshot {
  enabled: boolean;
  unlocked: boolean;
  contextState: string;
  ducked: boolean;
  master: number;
  bed: { id: string; track: string; target: number; live: number; at: number; until: number } | null;
  moment: { id: string; track: string; target: number; live: number; at: number; until: number } | null;
  /** True while any gain is still travelling toward its target. */
  crossfading: boolean;
  voices: number;
  /** How many elements are actually not paused. Should be 1, or 2 mid-cue. */
  sounding: number;
}

/**
 * Everything the readout shows, read live rather than mirrored into React.
 *
 * `live` is the gain node's instantaneous value, so a crossfade can be watched
 * happening instead of inferred from a flag.
 */
function snapshot(): AudioSnapshot {
  const read = (playing: Playing | null, id: string | null) =>
    playing && id
      ? {
          id,
          track: TRACKS[playing.cue.track].file,
          target: Number(levelFor(playing.cue, playing === bed).toFixed(3)),
          live: Number((playing.voice.wired ? playing.voice.gain.gain.value : playing.voice.el.volume).toFixed(3)),
          at: Number(playing.voice.el.currentTime.toFixed(1)),
          until: Number.isFinite(playing.until) ? Number(playing.until.toFixed(1)) : -1,
        }
      : null;

  const bedRead = read(bed, bedId);
  const momentRead = read(moment, momentId);
  let sounding = 0;
  for (const voice of voices.values()) if (!voice.el.paused) sounding += 1;

  return {
    enabled,
    unlocked,
    contextState: ctx?.state ?? 'none',
    ducked,
    master: Number((master?.gain.value ?? 0).toFixed(3)),
    bed: bedRead,
    moment: momentRead,
    crossfading:
      (!!bedRead && Math.abs(bedRead.live - bedRead.target) > 0.01) ||
      (!!momentRead && Math.abs(momentRead.live - momentRead.target) > 0.01),
    voices: voices.size,
    sounding,
  };
}

export const audioEngine = {
  unlock,
  setBed,
  playMoment,
  setDucked,
  setEnabled,
  isEnabled,
  preload,
  setHidden,
  dispose,
  snapshot,
  /** Whether `?auditsound` was passed, so the readout knows to mount. */
  auditing: () => AUDITING,
};
