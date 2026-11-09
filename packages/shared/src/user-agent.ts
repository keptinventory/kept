/** "Safari on iPhone" from a user-agent string. A label for people, never used for decisions: the
 * web names sessions with it, and the server the device in the backup-code mail (#419). */
export type DeviceKind = 'phone' | 'computer';

export function describeUserAgent(ua: string | null): {
  browser: string | null;
  os: string | null;
  kind: DeviceKind;
} {
  if (!ua) return { browser: null, os: null, kind: 'computer' };
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : null;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null;
  const kind: DeviceKind = os === 'iPhone' || os === 'Android' ? 'phone' : 'computer';
  return { browser, os, kind };
}
