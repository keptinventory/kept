/**
 * A button the tour adds to driver.js's footer: Back, and Stop here at a chapter's end. Only the
 * generic footer-button class: driver.js's own delegated click handler matches the next, prev and
 * close classes, and these are none of them.
 */
export function tourFooterButton(
  kind: 'back' | 'stop',
  label: string,
  onPress: () => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'driver-popover-footer-btn';
  button.dataset.tourBtn = kind;
  button.textContent = label;
  button.addEventListener('click', (e) => {
    e.preventDefault();
    onPress();
  });
  return button;
}
