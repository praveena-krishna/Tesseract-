import { useEffect, useState } from 'react';
import { audioEngine, type AudioSnapshot } from '../audio/audioEngine';
import { AUDIO } from '../config/audio';

/** How often the readout samples the transport. Four times a second is plenty. */
const SAMPLE_MS = 250;

/**
 * What the score is doing, for whoever is tuning it.
 *
 * Mounted only under `?auditsound`, and it reads the transport rather than
 * subscribing to anything: the gain values it shows are the live ones off the
 * audio graph, so a crossfade can be watched happening instead of inferred. It
 * holds no state the rest of the application can see and it never renders in
 * ordinary use.
 *
 * It exists because the one thing that cannot be checked from the code is
 * whether the right piece is playing at the right moment, and the second best
 * thing to hearing it is watching the numbers move.
 */
export function AudioAudit() {
  const [shot, setShot] = useState<AudioSnapshot | null>(null);

  useEffect(() => {
    if (!audioEngine.auditing()) return;
    const id = window.setInterval(() => setShot(audioEngine.snapshot()), SAMPLE_MS);
    return () => window.clearInterval(id);
  }, []);

  if (!audioEngine.auditing() || !shot) return null;

  const line = (label: string, value: string) => (
    <div className="audio-audit__row" key={label}>
      <span className="audio-audit__key">{label}</span>
      <span className="audio-audit__value">{value}</span>
    </div>
  );

  const played = (
    part: AudioSnapshot['bed'],
  ): string =>
    part
      ? `${part.id} · ${part.track} · ${part.at}s${part.until >= 0 ? `/${part.until}s` : ''} · ${part.live}→${part.target}`
      : '—';

  return (
    <aside className="audio-audit" aria-hidden="true">
      <p className="audio-audit__title">Audio · ?{AUDIO.LOG_FLAG}</p>
      {line('context', `${shot.contextState}${shot.unlocked ? ' · unlocked' : ' · locked'}`)}
      {line('master', `${shot.master}${shot.enabled ? '' : ' (muted)'}`)}
      {line('bed', played(shot.bed))}
      {line('moment', played(shot.moment))}
      {line('ducked', shot.ducked ? `yes · ${AUDIO.FOCUS_DUCK}` : 'no')}
      {line('crossfading', shot.crossfading ? 'yes' : 'no')}
      {line('voices', `${shot.voices} built · ${shot.sounding} sounding`)}
    </aside>
  );
}
