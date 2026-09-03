import { useState } from 'react';
import { audioEngine } from '../audio/audioEngine';
import { useWorldStore } from '../store/useWorldStore';

/**
 * The whole of the soundtrack's interface.
 *
 * There is no player, no track name, no scrubber and no volume slider, because
 * none of those are things this world is about — a transport bar across the
 * bottom would be the clearest possible signal that you are looking at a web
 * page with music on it rather than at a place. One word, in the same
 * typographic language as every other control, saying which of two states the
 * score is in and switching it.
 *
 * It is a mute rather than a stop: the score keeps running underneath, so
 * turning it back on rejoins where the world has got to instead of restarting
 * whatever was playing when it went quiet.
 */
export function SoundToggle() {
  const phase = useWorldStore((state) => state.phase);
  const [on, setOn] = useState(() => audioEngine.isEnabled());

  return (
    <div className="sound-toggle" data-visible={phase === 'ready'}>
      <button
        type="button"
        className="sound-toggle__button"
        aria-pressed={on}
        onClick={() => {
          const next = !on;
          audioEngine.setEnabled(next);
          setOn(next);
        }}
        title={on ? 'Silence the score' : 'Bring the score back'}
      >
        <span className="sound-toggle__mark" data-on={on} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {on ? 'Sound' : 'Silent'}
      </button>
    </div>
  );
}
