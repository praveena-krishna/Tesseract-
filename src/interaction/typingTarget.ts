/**
 * Whether a key event was aimed at somewhere text is being entered.
 *
 * Every key in this experience is bound to the window, and that is the right
 * binding for the world: the subject is a canvas, and a canvas has nothing
 * inside it for keyboard focus to land on. It becomes the wrong binding the
 * moment a text field exists. Typing a name with a digit in it would cross into
 * another dimensional layer, the arrow keys used to walk a list of results
 * would orbit the camera underneath it, and Escape would step the viewer out of
 * the month they are standing in rather than closing what they opened.
 *
 * So the world's handlers ask this first and stand down while somebody types.
 */
export function isTypingTarget(event: Event): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
