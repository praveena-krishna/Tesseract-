import { TIMINGS } from '../config/timings';
import { useWorldStore } from '../store/useWorldStore';

/**
 * The persistent interface: a masthead and a single onboarding line.
 *
 * The brief's rule is that the world is the interface, so this layer names the
 * piece and then gets out of the way. The drag hint retires permanently on the
 * first interaction — once the viewer knows the world responds, the instruction
 * is only clutter.
 */
export function WorldUI() {
  const phase = useWorldStore((state) => state.phase);
  const hasInteracted = useWorldStore((state) => state.hasInteracted);

  return (
    <div
      className="world-ui"
      data-visible={phase === 'ready'}
      style={{ ['--ui-fade' as string]: `${TIMINGS.UI_FADE_MS}ms` }}
    >
      <header className="world-ui__masthead">
        <h1 className="world-ui__title">THE TESSERACT</h1>
        <div className="world-ui__rule" />
        <p className="world-ui__subtitle">16 PEOPLE / 3 MONTHS</p>
      </header>

      <p className="world-ui__hint" data-retired={hasInteracted}>
        DRAG TO EXPLORE
      </p>
    </div>
  );
}
