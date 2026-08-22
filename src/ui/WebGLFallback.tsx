/**
 * Shown when the browser cannot give us a WebGL2 context.
 *
 * It keeps the same typographic system as the world so the experience degrades
 * into something composed rather than into a browser error.
 */
export function WebGLFallback() {
  return (
    <main className="fallback">
      <h1 className="fallback__title">THE TESSERACT</h1>
      <p className="fallback__body">
        This experience is rendered in real time and requires WebGL 2. Your
        browser or device has not made a 3D context available. Enabling hardware
        acceleration, or opening this page in a current desktop browser, will
        restore it.
      </p>
    </main>
  );
}
