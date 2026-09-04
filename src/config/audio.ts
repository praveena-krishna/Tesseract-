/**
 * The score.
 *
 * Everything about the soundtrack that is a decision rather than a mechanism
 * lives here: which piece plays where, how loud, how long it takes to arrive
 * and how long to leave. `src/audio/audioEngine.ts` knows how to play a cue and
 * nothing about which one; `src/audio/useAudioDirector.ts` knows which state of
 * the world means which cue and nothing about how sound is made. This file is
 * the only place either of them takes a number from.
 *
 * The governing idea is that the music follows *where the viewer is*, not what
 * they last clicked. A score that changes track on every click is a slideshow
 * with a soundtrack; this one has beds — one per place in the world — and a
 * small number of moments that rise over a bed and hand it back. Clicking
 * sixteen orbs in a row changes nothing but the depth of the mix.
 */

/* ------------------------------------------------------------------ *
 * The recordings
 * ------------------------------------------------------------------ */

/**
 * The twenty-three tracks, as they sit on disk, and what they measure.
 *
 * None of these numbers is a guess. Every file was decoded to 8 kHz mono PCM
 * with GStreamer and analysed as a half-second RMS envelope, so:
 *
 * - `seconds` is the decoded length, not a bitrate estimate. It agrees with the
 *   frame-header arithmetic to within a hundredth of a second on all 23.
 * - `perceivedDb` is the mean level of the *loud half* of the piece. Quiet
 *   passages are excluded deliberately: a listener sets their volume by what
 *   the music does when it is playing, not by its silences.
 * - `peak` is the true sample peak, measured from a full-rate stereo decode.
 *   It is what says how much a recording may safely be lifted: most of this
 *   album is peak-normalised to about −0.3 dBFS and has nowhere to go, while
 *   Message From Home sits at −16.5 dBFS and has plenty.
 * - `gain` is the trim that brings `perceivedDb` to the cohort mean of −22.0 dB,
 *   clamped to ±10 dB and then **bounded by that headroom** so the product can
 *   never clip. It is the answer to "why did that one suddenly get loud": the
 *   raw spread across this album is **25.3 dB**, from Detach and Stay at −14.1
 *   to Message From Home at −39.4. After the trim it is 7.4 dB, with seventeen
 *   of the twenty-three landing exactly on −22.0. Four are held short of it by
 *   their own peaks — they are already mastered to the ceiling — and the two
 *   quietest hit the ±10 dB clamp. Without this the score would be unusable.
 * - `introEnd` is the first point the smoothed envelope stays 40% of the way up
 *   from its own floor to its own ceiling for four seconds — where the piece
 *   stops being an introduction.
 * - `bodyStart` is stricter and is what the beds actually use: the first point
 *   the piece holds within 3 dB of its own working level for eight seconds,
 *   pulled back if necessary so at least 45 seconds of loop remain. It exists
 *   because opening beds at the top was measured as a mistake — the first
 *   thirty seconds of Dreaming of the Crash come out at −63 dBFS, which is
 *   silence, and Mountains does not arrive until two minutes in.
 * - `peakStart` opens the loudest sustained twenty seconds.
 * - `tailStart` is the last point it rises above its own quarter level; after
 *   this it is decaying, which is where a loop should turn over and where a
 *   fade belongs.
 *
 * What this cannot tell you is where a *phrase* begins. Energy is not metre.
 * Every timestamp derived from these is a defensible place to start, not a
 * musically edited one — see the note on `startTime` below.
 *
 * `file` is a web-safe slug of the release name — `15-stay-reprise.mp3` for
 * `15. S.T.A.Y..mp3` — because these are served by a CDN in production and a
 * path carrying spaces, apostrophes and a doubled dot is a class of failure
 * that looks exactly like the audio not working. The engine still
 * percent-encodes it; do not pre-encode it here.
 *
 * What sits under those names is a 128 kbps CBR re-encode of the 320 kbps
 * release, which is why a quarter of a gigabyte of soundtrack ships as 87 MB.
 * Constant bitrate is deliberate: every cue below opens partway into its
 * recording, and CBR makes that seek byte arithmetic rather than a lookup in a
 * VBR table. Every measurement in this block was taken from the 320 kbps
 * masters and still holds — a decode/re-encode round trip moves the timeline by
 * an encoder-delay frame, about 26 ms.
 */
export const TRACKS = {
  DREAMING_OF_THE_CRASH: {
    file: "01-dreaming-of-the-crash.mp3",
    seconds: 235.91,
    gain: 0.681,
    peak: 0.9516,
    perceivedDb: -18.7,
    bodyStart: 116.0,
    introEnd: 114.0,
    peakStart: 162.0,
    tailStart: 231.0,
  },
  CORNFIELD_CHASE: {
    file: "02-cornfield-chase.mp3",
    seconds: 127.03,
    gain: 0.593,
    peak: 0.9791,
    perceivedDb: -17.5,
    bodyStart: 66.5,
    introEnd: 38.0,
    peakStart: 99.0,
    tailStart: 122.0,
  },
  DUST: {
    file: "03-dust.mp3",
    seconds: 341.45,
    gain: 0.878,
    peak: 0.9418,
    perceivedDb: -20.9,
    bodyStart: 135.5,
    introEnd: 63.0,
    peakStart: 309.0,
    tailStart: 334.0,
  },
  DAY_ONE: {
    file: "04-day-one.mp3",
    seconds: 199.5,
    gain: 1.145,
    peak: 0.777,
    perceivedDb: -24.9,
    bodyStart: 130.5,
    introEnd: 48.0,
    peakStart: 165.5,
    tailStart: 193.0,
  },
  STAY: {
    file: "05-stay.mp3",
    seconds: 412.5,
    gain: 0.401,
    peak: 0.968,
    perceivedDb: -14.1,
    bodyStart: 161.0,
    introEnd: 96.0,
    peakStart: 344.0,
    tailStart: 407.5,
  },
  MESSAGE_FROM_HOME: {
    file: "06-message-from-home.mp3",
    seconds: 100.94,
    gain: 3.162,
    peak: 0.1505,
    perceivedDb: -39.4,
    bodyStart: 9.5,
    introEnd: 14.0,
    peakStart: 60.0,
    tailStart: 95.0,
  },
  THE_WORMHOLE: {
    file: "07-the-wormhole.mp3",
    seconds: 90.64,
    gain: 0.681,
    peak: 0.9656,
    perceivedDb: -18.7,
    bodyStart: 39.0,
    introEnd: 18.0,
    peakStart: 61.5,
    tailStart: 84.0,
  },
  MOUNTAINS: {
    file: "08-mountains.mp3",
    seconds: 219.17,
    gain: 0.529,
    peak: 0.9816,
    perceivedDb: -16.5,
    bodyStart: 121.5,
    introEnd: 13.0,
    peakStart: 186.0,
    tailStart: 214.5,
  },
  AFRAID_OF_TIME: {
    file: "09-afraid-of-time.mp3",
    seconds: 152.74,
    gain: 3.162,
    peak: 0.1674,
    perceivedDb: -39.3,
    bodyStart: 42.5,
    introEnd: 19.5,
    peakStart: 56.5,
    tailStart: 140.5,
  },
  A_PLACE_AMONG_THE_STARS: {
    file: "10-a-place-among-the-stars.mp3",
    seconds: 207.18,
    gain: 1.118,
    peak: 0.7126,
    perceivedDb: -23.0,
    bodyStart: 122.0,
    introEnd: 87.0,
    peakStart: 157.0,
    tailStart: 202.0,
  },
  RUNNING_OUT: {
    file: "11-running-out.mp3",
    seconds: 117.32,
    gain: 1.473,
    peak: 0.516,
    perceivedDb: -25.4,
    bodyStart: 0.0,
    introEnd: 0.0,
    peakStart: 0.0,
    tailStart: 106.5,
  },
  IM_GOING_HOME: {
    file: "12-im-going-home.mp3",
    seconds: 348.6,
    gain: 0.942,
    peak: 0.9452,
    perceivedDb: -25.1,
    bodyStart: 165.5,
    introEnd: 97.5,
    peakStart: 175.0,
    tailStart: 336.0,
  },
  COWARD: {
    file: "13-coward.mp3",
    seconds: 506.96,
    gain: 0.415,
    peak: 1.0,
    perceivedDb: -14.4,
    bodyStart: 242.5,
    introEnd: 40.0,
    peakStart: 394.0,
    tailStart: 502.0,
  },
  DETACH: {
    file: "14-detach.mp3",
    seconds: 402.26,
    gain: 0.401,
    peak: 0.9712,
    perceivedDb: -14.1,
    bodyStart: 180.5,
    introEnd: 51.5,
    peakStart: 262.5,
    tailStart: 368.0,
  },
  STAY_REPRISE: {
    file: "15-stay-reprise.mp3",
    seconds: 383.58,
    gain: 0.8,
    peak: 0.9537,
    perceivedDb: -20.1,
    bodyStart: 160.0,
    introEnd: 97.5,
    peakStart: 255.0,
    tailStart: 364.5,
  },
  WHERE_WERE_GOING: {
    file: "16-where-were-going.mp3",
    seconds: 461.35,
    gain: 0.921,
    peak: 0.9662,
    perceivedDb: -22.9,
    bodyStart: 138.5,
    introEnd: 87.0,
    peakStart: 433.0,
    tailStart: 455.5,
  },
  FIRST_STEP: {
    file: "17-first-step.mp3",
    seconds: 107.83,
    gain: 0.8,
    peak: 0.9495,
    perceivedDb: -20.1,
    bodyStart: 51.5,
    introEnd: 36.0,
    peakStart: 76.5,
    tailStart: 103.5,
  },
  FLYING_DRONE: {
    file: "18-flying-drone.mp3",
    seconds: 113.24,
    gain: 0.756,
    peak: 0.7585,
    perceivedDb: -19.6,
    bodyStart: 44.0,
    introEnd: 0.0,
    peakStart: 72.5,
    tailStart: 94.0,
  },
  ATMOSPHERIC_ENTRY: {
    file: "19-atmospheric-entry.mp3",
    seconds: 101.07,
    gain: 0.535,
    peak: 0.4796,
    perceivedDb: -16.6,
    bodyStart: 7.0,
    introEnd: 2.5,
    peakStart: 12.5,
    tailStart: 84.5,
  },
  NO_NEED_TO_COME_BACK: {
    file: "20-no-need-to-come-back.mp3",
    seconds: 272.98,
    gain: 0.936,
    peak: 0.9508,
    perceivedDb: -25.8,
    bodyStart: 1.5,
    introEnd: 0.0,
    peakStart: 169.0,
    tailStart: 272.5,
  },
  IMPERFECT_LOCK: {
    file: "21-imperfect-lock.mp3",
    seconds: 414.98,
    gain: 0.593,
    peak: 0.9518,
    perceivedDb: -17.5,
    bodyStart: 109.0,
    introEnd: 82.5,
    peakStart: 249.0,
    tailStart: 408.5,
  },
  WHAT_HAPPENS_NOW: {
    file: "22-what-happens-now.mp3",
    seconds: 146.26,
    gain: 0.764,
    peak: 0.7198,
    perceivedDb: -19.7,
    bodyStart: 24.5,
    introEnd: 4.5,
    peakStart: 33.5,
    tailStart: 112.5,
  },
  DO_NOT_GO_GENTLE: {
    file: "23-do-not-go-gentle.mp3",
    seconds: 99.19,
    gain: 3.162,
    peak: 0.2742,
    perceivedDb: -32.5,
    bodyStart: 17.5,
    introEnd: 0.0,
    peakStart: 19.0,
    tailStart: 84.5,
  },
} as const;

export type TrackId = keyof typeof TRACKS;

/** Where the `ost-assets` plugin in `vite.config.ts` publishes the folder. */
export const OST_ROUTE = '/ost/';

/* ------------------------------------------------------------------ *
 * The mechanism
 * ------------------------------------------------------------------ */

export const AUDIO = {
  /**
   * The ceiling every cue is scaled by, and the only thing the toggle changes.
   *
   * Held well under one. These are orchestral recordings mastered for a cinema
   * and the world they play over is quiet; at full scale the score stops being
   * the room the visualization sits in and becomes the subject.
   */
  MASTER: 0.85,

  /**
   * The loudness hierarchy, applied on top of each track's measured trim.
   *
   * Because `TRACKS[…].gain` has already flattened the 25 dB spread between
   * these recordings, these numbers do what they say: they set how far forward
   * a thing sits, rather than accidentally encoding which track was mastered
   * hottest.
   */
  LEVEL: {
    /** A place. Meant to be inhabited, not listened to. */
    BACKGROUND: 0.72,
    /** A person or a reading being examined. Slightly closer. */
    FOCUS: 0.68,
    /** Difficulty. Forward enough to be felt, never enough to alarm. */
    TENSION: 0.76,
    /** Passages between places. The loudest routine thing in the piece. */
    TRANSITION: 0.86,
    /** Something being resolved, or the end of the whole thing. */
    RESOLUTION: 0.92,
  },

  /**
   * Three crossfade lengths, because three different things happen.
   *
   * Using one figure for all of them was the flaw in the first pass: a change
   * of person is a small adjustment and should feel immediate, while a change
   * of month accompanies a camera passage that takes seconds and must not
   * finish before it does.
   */
  FADE: {
    /** Choosing a person, or opening their reading. Quick. */
    FOCUS: 1.4,
    /** A month, or a lens. Longer than any camera move it accompanies. */
    SCENE: 3.2,
    /** The opening, and the end of the journey. */
    EMOTIONAL: 5.5,
  },

  /** Seconds the first bed of the session takes to arrive out of silence. */
  OPENING_FADE_IN: 6,

  /** Seconds a moment takes to rise over the bed. */
  MOMENT_FADE_IN: 1.4,
  /** Seconds a moment takes to hand the bed back. */
  MOMENT_FADE_OUT: 2.8,

  /**
   * What the bed drops to while somebody is being observed.
   *
   * This is the whole of what selecting a person does to the score, and that is
   * the point: sixteen vessels clicked in a row must not be sixteen restarts.
   * The mix moves closer instead — a fifth quieter, so the room recedes and the
   * person is what is left.
   */
  FOCUS_DUCK: 0.8,

  /**
   * What the bed drops to underneath an event cue.
   *
   * Not to nothing. The bed staying audible under the moment is what makes the
   * moment feel like something happening *in* a place rather than a cut to
   * somewhere else, and it is what lets the bed come back without a seam. Two
   * things play at once here and that is deliberate; nothing else ever does.
   */
  EVENT_DUCK: 0.42,

  /**
   * How far the bed is pulled back under a difficulty cue, by how much that
   * difficulty was judged to have cost.
   *
   * The intensity is carried by how far forward the cue sits, not by how loud
   * it is — every cue is already loudness-matched, so raising the volume for a
   * high-impact difficulty would simply be a jolt. Pulling the room back
   * further instead makes it more present without making it louder, which is
   * the difference between tension and alarm.
   *
   * Fragment size remains the primary encoding of impact. This is reinforcement.
   */
  SEVERITY_DUCK: {
    low: 0.62,
    medium: 0.5,
    high: 0.38,
  } as Record<string, number>,

  /** Seconds either duck takes. Short enough to feel like part of the click. */
  DUCK_EASE: 0.8,

  /**
   * Seconds a bed dips through its own loop point.
   *
   * Beds loop, and a track that wraps with a hard cut announces its own length
   * — you hear the file end rather than the place continue. So the last stretch
   * is faded down, the transport seeks back to `startTime`, and it comes up
   * again over the same interval. Every bed turns over at its measured
   * `tailStart`, so the loop happens where the music is already decaying rather
   * than in the middle of a phrase.
   */
  LOOP_FADE: 4,

  /**
   * How often the transport is inspected, in milliseconds.
   *
   * One timer for the whole engine, and only while something is playing. Gains
   * are ramped by the audio clock rather than by this, so the interval decides
   * when a loop turns over and when a moment ends, and nothing else. It is
   * never in the path of anything the eye can see.
   */
  TICK_MS: 250,

  /**
   * What is fetched before it is asked for.
   *
   * The opening piece and all three month themes are eager: the veil lifts onto
   * the first, and entering a month is the first thing anybody does. The
   * passage, the challenge cues and the resolution follow once the world is
   * idle. The remaining fourteen are fetched when their cue fires, which over a
   * local server is imperceptible and keeps the opening from dragging a quarter
   * of a gigabyte behind it.
   */
  EAGER: [
    'DREAMING_OF_THE_CRASH',
    'FIRST_STEP',
    'CORNFIELD_CHASE',
    'WHERE_WERE_GOING',
  ] as TrackId[],
  WARM: [
    'A_PLACE_AMONG_THE_STARS',
    'THE_WORMHOLE',
    'DAY_ONE',
    'DUST',
    'AFRAID_OF_TIME',
    'IM_GOING_HOME',
    'COWARD',
  ] as TrackId[],
  /** Milliseconds after the world is ready before the warm set is fetched. */
  WARM_DELAY_MS: 4000,

  /** `?auditsound` in the URL turns the transport log and the readout on. */
  LOG_FLAG: 'auditsound',
} as const;

/* ------------------------------------------------------------------ *
 * The cues
 * ------------------------------------------------------------------ */

export interface Cue {
  track: TrackId;
  /**
   * Where in the recording the cue begins.
   *
   * Beds open at the top, because they loop and are heard for minutes: their
   * introductions are the breathing room, not dead air to be skipped.
   *
   * Moments do not. A moment is six to twenty seconds long, and several of
   * these pieces spend their first minute and a half almost silent — twelve
   * seconds from the top of `I'm Going Home` is room tone, not a resolution. So
   * every moment starts at a landmark the analysis found in that specific
   * recording: `introEnd` where the cue should feel like something beginning,
   * `peakStart` where it should feel like something arriving.
   *
   * **These are measured, not phrased.** The envelope knows where the energy
   * is; it does not know where the bar line is, so a cue may open a beat or two
   * off. That is the one thing in this file that needs a human ear, and this is
   * the field to nudge when you use one.
   */
  startTime: number;
  /**
   * Where it ends.
   *
   * On a bed this is the measured `tailStart` — the point after which the piece
   * is only decaying — so the loop turns over there instead of sitting through
   * the fade to silence and restarting from nothing.
   *
   * On a moment it is what makes it a moment rather than a new soundtrack.
   */
  endTime?: number;
  /** From `AUDIO.LEVEL`, then scaled by the track's measured gain and the master. */
  volume: number;
  /** Beds loop. Moments never do — they end and give the bed back. */
  loop: boolean;
  fadeIn: number;
  fadeOut: number;
  /** For the log and the readout. Not read by the engine. */
  purpose: string;
}

/**
 * The beds: one per place the viewer can be.
 *
 * Resolved by `sceneFor()` in the director, which walks a precedence list — the
 * most specific reading of the world wins. Changing which piece plays in a
 * place is a one-word edit here; changing *when* a place is reached is an edit
 * to that list.
 */
export const BEDS = {
  /** Before anything has been touched. The structure, revealing itself. */
  OPENING: {
    track: 'DREAMING_OF_THE_CRASH',
    startTime: TRACKS.DREAMING_OF_THE_CRASH.bodyStart,
    endTime: TRACKS.DREAMING_OF_THE_CRASH.tailStart,
    volume: AUDIO.LEVEL.BACKGROUND,
    loop: true,
    fadeIn: AUDIO.OPENING_FADE_IN,
    fadeOut: AUDIO.FADE.SCENE,
    purpose: 'The veil lifts and the tesseract is there. Nothing has been chosen yet.',
  },

  /** Outside the structure, once the viewer has begun to move around it. */
  OVERVIEW: {
    track: 'A_PLACE_AMONG_THE_STARS',
    startTime: TRACKS.A_PLACE_AMONG_THE_STARS.bodyStart,
    endTime: TRACKS.A_PLACE_AMONG_THE_STARS.tailStart,
    volume: AUDIO.LEVEL.BACKGROUND,
    loop: true,
    fadeIn: AUDIO.FADE.SCENE,
    fadeOut: AUDIO.FADE.SCENE,
    purpose: 'The whole three-month structure from outside. The outside has its own identity.',
  },

  /** Outside again, after every difficulty in the cohort has been worked through. */
  OVERVIEW_AFTER: {
    track: 'WHAT_HAPPENS_NOW',
    startTime: TRACKS.WHAT_HAPPENS_NOW.bodyStart,
    endTime: TRACKS.WHAT_HAPPENS_NOW.tailStart,
    volume: AUDIO.LEVEL.BACKGROUND,
    loop: true,
    fadeIn: AUDIO.FADE.EMOTIONAL,
    fadeOut: AUDIO.FADE.SCENE,
    purpose: 'The same vantage point, after the training has been seen through.',
  },

  /* -- the three acts ------------------------------------------------ */

  MONTH_1: {
    track: 'FIRST_STEP',
    startTime: TRACKS.FIRST_STEP.bodyStart,
    endTime: TRACKS.FIRST_STEP.tailStart,
    volume: AUDIO.LEVEL.BACKGROUND,
    loop: true,
    fadeIn: AUDIO.FADE.SCENE,
    fadeOut: AUDIO.FADE.SCENE,
    purpose: 'Month 1 — learning begins. The innermost box, the sixteen inside it.',
  },
  MONTH_2: {
    track: 'CORNFIELD_CHASE',
    startTime: TRACKS.CORNFIELD_CHASE.bodyStart,
    endTime: TRACKS.CORNFIELD_CHASE.tailStart,
    volume: AUDIO.LEVEL.BACKGROUND,
    loop: true,
    fadeIn: AUDIO.FADE.SCENE,
    fadeOut: AUDIO.FADE.SCENE,
    purpose: 'Month 2 — the teams gather and the five projects take shape.',
  },
  MONTH_3: {
    track: 'WHERE_WERE_GOING',
    startTime: TRACKS.WHERE_WERE_GOING.bodyStart,
    endTime: TRACKS.WHERE_WERE_GOING.tailStart,
    volume: AUDIO.LEVEL.BACKGROUND,
    loop: true,
    fadeIn: AUDIO.FADE.SCENE,
    fadeOut: AUDIO.FADE.SCENE,
    purpose: 'Month 3 — the last stage of the journey.',
  },

  /* -- what is being read, which outranks which month it is read in --- */

  /**
   * Somebody is being observed.
   *
   * The same piece in all three months and for all sixteen people, which is the
   * rule that keeps this from becoming a jukebox: moving the selection from one
   * vessel to the next is the same place, so nothing restarts. Only the depth
   * of the mix moves, and that is the focus duck.
   */
  PERSON: {
    track: 'DAY_ONE',
    startTime: TRACKS.DAY_ONE.bodyStart,
    endTime: TRACKS.DAY_ONE.tailStart,
    volume: AUDIO.LEVEL.FOCUS,
    loop: true,
    fadeIn: AUDIO.FADE.FOCUS,
    fadeOut: AUDIO.FADE.FOCUS,
    purpose: 'One of the sixteen, chosen. The camera has come in to observe them.',
  },

  /** The classes lens with nobody held: what the cohort liked, all at once. */
  LEARNING: {
    track: 'DAY_ONE',
    startTime: TRACKS.DAY_ONE.bodyStart,
    endTime: TRACKS.DAY_ONE.tailStart,
    volume: AUDIO.LEVEL.BACKGROUND,
    loop: true,
    fadeIn: AUDIO.FADE.SCENE,
    fadeOut: AUDIO.FADE.SCENE,
    purpose: 'The classes lens across all sixteen. Same piece as PERSON, so moving between them is seamless.',
  },

  /**
   * One person's learning, in Month 1.
   *
   * The deepest the world goes into an individual: their vessel, the classes
   * they named orbiting it, and the key beside them naming those. The one
   * reading that is genuinely about a person rather than a cohort.
   */
  PERSON_LEARNING: {
    track: 'STAY',
    startTime: TRACKS.STAY.bodyStart,
    endTime: TRACKS.STAY.tailStart,
    volume: AUDIO.LEVEL.FOCUS,
    loop: true,
    fadeIn: AUDIO.FADE.FOCUS,
    fadeOut: AUDIO.FADE.SCENE,
    purpose: 'A person held under the classes lens — what they, particularly, liked.',
  },

  /** Month 2, teams lens — gravity pulling the sixteen into five. */
  TEAMS: {
    track: 'FLYING_DRONE',
    startTime: TRACKS.FLYING_DRONE.bodyStart,
    endTime: TRACKS.FLYING_DRONE.tailStart,
    volume: AUDIO.LEVEL.BACKGROUND,
    loop: true,
    fadeIn: AUDIO.FADE.SCENE,
    fadeOut: AUDIO.FADE.SCENE,
    purpose: 'The teams lens. Active and dimensional, like the gathering it accompanies.',
  },

  /**
   * Month 2, projects lens — the largest assembly in the piece.
   *
   * Also the slowest: gravity holds for two and a half seconds, ramps over four
   * more, and each project figure assembles only once its own team has
   * gathered. This is the one cue whose job is to make that wait read as
   * arrival rather than as lag.
   */
  PROJECTS: {
    track: 'MOUNTAINS',
    startTime: TRACKS.MOUNTAINS.bodyStart,
    endTime: TRACKS.MOUNTAINS.tailStart,
    volume: AUDIO.LEVEL.BACKGROUND,
    loop: true,
    fadeIn: AUDIO.FADE.SCENE,
    fadeOut: AUDIO.FADE.SCENE,
    purpose: 'The projects lens. The biggest thing the world builds, and the slowest.',
  },

  /** Month 3, challenges lens, nobody held: everything the cohort ran into. */
  CHALLENGES: {
    track: 'DUST',
    startTime: TRACKS.DUST.bodyStart,
    endTime: TRACKS.DUST.tailStart,
    volume: AUDIO.LEVEL.TENSION,
    loop: true,
    fadeIn: AUDIO.FADE.SCENE,
    fadeOut: AUDIO.FADE.SCENE,
    purpose: 'The whole field of difficulties at once, settled over everybody.',
  },

  /** Month 3, challenges lens, one person held. */
  PERSON_CHALLENGES: {
    track: 'AFRAID_OF_TIME',
    startTime: TRACKS.AFRAID_OF_TIME.bodyStart,
    endTime: TRACKS.AFRAID_OF_TIME.tailStart,
    volume: AUDIO.LEVEL.TENSION,
    loop: true,
    fadeIn: AUDIO.FADE.FOCUS,
    fadeOut: AUDIO.FADE.SCENE,
    purpose: 'One person and their difficulties. Unstable, and about time running.',
  },

  /**
   * The same reading, when the person held still carries a difficulty this
   * project judged high impact.
   *
   * Selective on purpose. Not "they have several" — several small difficulties
   * is not the same fact as one that stopped them learning, and the score must
   * not claim it is. It also drops away the moment that difficulty is worked
   * through, so the intensity reports a live state rather than a label. The
   * step up from PERSON_CHALLENGES is one level, not a jolt.
   */
  SEVERE: {
    track: 'RUNNING_OUT',
    startTime: TRACKS.RUNNING_OUT.bodyStart,
    endTime: TRACKS.RUNNING_OUT.tailStart,
    volume: AUDIO.LEVEL.TENSION,
    loop: true,
    fadeIn: AUDIO.FADE.SCENE,
    fadeOut: AUDIO.FADE.SCENE,
    purpose: 'A person still carrying a high-impact difficulty. The one intensity cue.',
  },

  /**
   * Month 3, Databricks lens.
   *
   * Month 3 rather than Month 1: `MEDALLION.MONTH` is 2, and the lens shows raw
   * learning worked up into knowledge — a thread from the core to each person,
   * weighted by what they rated the class. A message from home is that picture.
   */
  KNOWLEDGE: {
    track: 'MESSAGE_FROM_HOME',
    startTime: TRACKS.MESSAGE_FROM_HOME.bodyStart,
    endTime: TRACKS.MESSAGE_FROM_HOME.tailStart,
    volume: AUDIO.LEVEL.BACKGROUND,
    loop: true,
    fadeIn: AUDIO.FADE.SCENE,
    fadeOut: AUDIO.FADE.SCENE,
    purpose: 'The knowledge core, sending a thread of its own weight to each person.',
  },

  /** Every difficulty in the cohort worked through, seen from inside a month. */
  JOURNEY_COMPLETE: {
    track: 'NO_NEED_TO_COME_BACK',
    startTime: TRACKS.NO_NEED_TO_COME_BACK.bodyStart,
    endTime: TRACKS.NO_NEED_TO_COME_BACK.tailStart,
    volume: AUDIO.LEVEL.RESOLUTION,
    loop: true,
    fadeIn: AUDIO.FADE.EMOTIONAL,
    fadeOut: AUDIO.FADE.EMOTIONAL,
    purpose: 'Every difficulty in the cohort behind them. The conclusion.',
  },
} as const satisfies Record<string, Cue>;

export type BedId = keyof typeof BEDS;

/**
 * The moments: bounded cues that rise over a ducked bed and hand it back.
 *
 * Every one is `loop: false` with an `endTime`, so none can become the
 * soundtrack, and every one opens at a landmark the analysis found rather than
 * at the top of its file.
 */
export const MOMENTS = {
  /**
   * The four-dimensional turn between months.
   *
   * The one cue whose length is not a taste call: it runs exactly as long as
   * the turn does — seven seconds a revolution, one revolution per month
   * boundary crossed — and the director passes the real figure. It opens at
   * `introEnd`, where the piece has started to move, so a five-second passage
   * is not five seconds of room tone.
   */
  DIMENSIONAL_TURN: {
    track: 'THE_WORMHOLE',
    startTime: TRACKS.THE_WORMHOLE.bodyStart,
    endTime: TRACKS.THE_WORMHOLE.bodyStart + 14,
    volume: AUDIO.LEVEL.TRANSITION,
    loop: false,
    fadeIn: 1.2,
    fadeOut: 2.4,
    purpose: 'The structure turning itself inside out on the way to another month.',
  },

  /** Leaving a month for the overview. Short — going out is not a journey. */
  DETACHING: {
    track: 'DETACH',
    startTime: TRACKS.DETACH.bodyStart,
    endTime: TRACKS.DETACH.bodyStart + 7,
    volume: AUDIO.LEVEL.TRANSITION,
    loop: false,
    fadeIn: 1,
    fadeOut: AUDIO.MOMENT_FADE_OUT,
    purpose: 'Withdrawing from a layer, back to the whole structure.',
  },

  /**
   * The search reaching across the structure and landing on somebody.
   *
   * Opens at `peakStart`, not `introEnd`: this cue is an arrival, and the
   * arrival is the loud part.
   */
  ARRIVAL: {
    track: 'ATMOSPHERIC_ENTRY',
    startTime: TRACKS.ATMOSPHERIC_ENTRY.peakStart,
    endTime: TRACKS.ATMOSPHERIC_ENTRY.peakStart + 8,
    volume: AUDIO.LEVEL.TRANSITION,
    loop: false,
    fadeIn: 1,
    fadeOut: AUDIO.MOMENT_FADE_OUT,
    purpose: 'A person reached for by name, arrived at rather than clicked on.',
  },

  /** A difficulty taken up: not-started becomes in-progress. */
  CHALLENGE_ENGAGED: {
    track: 'COWARD',
    startTime: TRACKS.COWARD.bodyStart,
    endTime: TRACKS.COWARD.bodyStart + 8,
    volume: AUDIO.LEVEL.TENSION,
    loop: false,
    fadeIn: AUDIO.MOMENT_FADE_IN,
    fadeOut: AUDIO.MOMENT_FADE_OUT,
    purpose: 'Turning to face a difficulty for the first time.',
  },

  /**
   * A difficulty worked through: in-progress becomes overcome.
   *
   * Opens at `peakStart` — 175 s into a five-and-three-quarter-minute piece
   * whose first ninety seconds are nearly silent. Twelve seconds from the top
   * would have been room tone where the release belongs.
   */
  CHALLENGE_RESOLVED: {
    track: 'IM_GOING_HOME',
    startTime: TRACKS.IM_GOING_HOME.peakStart,
    endTime: TRACKS.IM_GOING_HOME.peakStart + 12,
    volume: AUDIO.LEVEL.RESOLUTION,
    loop: false,
    fadeIn: AUDIO.MOMENT_FADE_IN,
    fadeOut: AUDIO.MOMENT_FADE_OUT,
    purpose: 'The fragment stabilises, the cracks close and the vessel brightens.',
  },

  /** A difficulty reset: overcome becomes not-started again. */
  CHALLENGE_UNDONE: {
    track: 'IMPERFECT_LOCK',
    startTime: TRACKS.IMPERFECT_LOCK.bodyStart,
    endTime: TRACKS.IMPERFECT_LOCK.bodyStart + 6,
    volume: AUDIO.LEVEL.TENSION,
    loop: false,
    fadeIn: 1,
    fadeOut: 2,
    purpose: 'A resolution taken back. Something that was closed is open again.',
  },

  /** The last of one person's difficulties worked through. */
  GROWTH: {
    track: 'STAY_REPRISE',
    startTime: TRACKS.STAY_REPRISE.peakStart,
    endTime: TRACKS.STAY_REPRISE.peakStart + 14,
    volume: AUDIO.LEVEL.RESOLUTION,
    loop: false,
    fadeIn: AUDIO.MOMENT_FADE_IN,
    fadeOut: AUDIO.MOMENT_FADE_OUT,
    purpose: 'One person with nothing left unresolved. The growth glow, in sound.',
  },

  /** Leaving the last month with nothing left unresolved. */
  EXIT: {
    track: 'DO_NOT_GO_GENTLE',
    startTime: TRACKS.DO_NOT_GO_GENTLE.peakStart,
    endTime: TRACKS.DO_NOT_GO_GENTLE.peakStart + 20,
    volume: AUDIO.LEVEL.RESOLUTION,
    loop: false,
    fadeIn: 1.5,
    fadeOut: 3,
    purpose: 'The end of the experience. Never played for anything smaller.',
  },
} as const satisfies Record<string, Cue>;

export type MomentId = keyof typeof MOMENTS;

/** Every cue in one table, which is what the engine is handed. */
export const CUES: Record<string, Cue> = { ...BEDS, ...MOMENTS };
