/** The build's release and its slides (whats-new-plugin.ts). */
declare module 'virtual:kept-whats-new' {
  const release: { version: string; slides: import('./highlights').Slide[] };
  export default release;
}
