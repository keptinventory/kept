import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appHref,
  hashHref,
  homeAssistantHref,
  ingressBase,
  installIngressPrefixing,
  publicOrigin,
  routerBasepath,
  underIngress,
  withBase,
  withBaseDeep,
} from './base-path';

// Home Assistant ingress (D273): the server sends the page with `<base href="<prefix>/">` and a
// `kept-ingress` meta tag; everything the page asks the server for goes under that prefix. On every
// other install the page has `<base href="/">` and nothing here changes a URL.

const PREFIX = '/api/hassio_ingress/Xy7_dT9-kLmN0pQrStUvWxYz0123456789abcdEFGH';

function page(opts: { ingress: boolean; publicUrl?: string }) {
  document.head.innerHTML = opts.ingress
    ? `<base href="${PREFIX}/" /><meta name="kept-ingress" content="1" />${
        opts.publicUrl ? `<meta name="kept-public-url" content="${opts.publicUrl}" />` : ''
      }`
    : '<base href="/" />';
}

afterEach(() => {
  document.head.innerHTML = '';
});

describe('outside ingress (every normal install)', () => {
  beforeEach(() => page({ ingress: false }));

  it('changes nothing', () => {
    expect(underIngress()).toBe(false);
    expect(ingressBase()).toBe('');
    expect(routerBasepath()).toBe('/');
    expect(appHref('/things/abc')).toBe('/things/abc');
    expect(withBase('/api/v1/me')).toBe('/api/v1/me');
    const json = { thumbUrl: '/f/abc', nested: [{ url: '/f/def' }] };
    expect(withBaseDeep(json)).toBe(json);
    expect(publicOrigin()).toBe(window.location.origin);
    // Kept's own address isn't Home Assistant's: no link to one of its pages.
    expect(homeAssistantHref('/config/backup')).toBeNull();
  });

  it('links to a section of this page, not the home page <base href> points at', () => {
    history.replaceState(null, '', '/things/abc?tab=1');
    expect(hashHref('thing-history')).toBe('/things/abc?tab=1#thing-history');
    // What a bare "#x" would resolve to under <base href="/">: the home page.
    expect(new URL('#x', document.baseURI).pathname).toBe('/');
    expect(new URL(hashHref('x'), document.baseURI).pathname).toBe('/things/abc');
  });

  it('installs no fetch or XMLHttpRequest wrapper', () => {
    const before = window.fetch;
    const open = XMLHttpRequest.prototype.open;
    installIngressPrefixing();
    expect(window.fetch).toBe(before);
    expect(XMLHttpRequest.prototype.open).toBe(open);
  });
});

describe('under ingress', () => {
  beforeEach(() => page({ ingress: true, publicUrl: 'http://homeassistant.local:8080' }));

  it('puts an in-app path under the prefix for a raw history push', () => {
    expect(appHref('/')).toBe(`${PREFIX}/`);
    expect(appHref('/things/abc#x')).toBe(`${PREFIX}/things/abc#x`);
  });

  it('reads the prefix from <base href>', () => {
    expect(underIngress()).toBe(true);
    expect(ingressBase()).toBe(PREFIX);
    expect(routerBasepath()).toBe(PREFIX);
  });

  it('puts root-relative server paths under the prefix, and nothing else', () => {
    expect(withBase('/api/v1/me')).toBe(`${PREFIX}/api/v1/me`);
    expect(withBase('/f/token?x=1')).toBe(`${PREFIX}/f/token?x=1`);
    expect(withBase('/version')).toBe(`${PREFIX}/version`);
    // Already under it, another host, protocol-relative or relative: left alone.
    expect(withBase(`${PREFIX}/api/v1/me`)).toBe(`${PREFIX}/api/v1/me`);
    expect(withBase('https://cdn.example/x.js')).toBe('https://cdn.example/x.js');
    expect(withBase('//evil.example/x')).toBe('//evil.example/x');
    expect(withBase('assets/x.js')).toBe('assets/x.js');
    expect(withBase('blob:http://x/y')).toBe('blob:http://x/y');
  });

  it('prefixes the server’s own file URLs inside a JSON body', () => {
    const body = {
      thumbUrl: '/f/abc',
      name: 'Drill /f/ in the name stays',
      list: [{ url: '/f/def', other: 42, none: null }],
      external: 'https://s3.example/f/x',
    };
    expect(withBaseDeep(body)).toEqual({
      thumbUrl: `${PREFIX}/f/abc`,
      name: 'Drill /f/ in the name stays',
      list: [{ url: `${PREFIX}/f/def`, other: 42, none: null }],
      external: 'https://s3.example/f/x',
    });
  });

  it('links to a section of this page under the prefix', () => {
    history.replaceState(null, '', `${PREFIX}/settings/ai`);
    expect(hashHref('ai-key')).toBe(`${PREFIX}/settings/ai#ai-key`);
    expect(new URL(hashHref('ai-key'), document.baseURI).pathname).toBe(`${PREFIX}/settings/ai`);
  });

  it('names Kept’s own address for links people copy, not Home Assistant’s', () => {
    expect(publicOrigin()).toBe('http://homeassistant.local:8080');
  });

  it('links to a page of Home Assistant’s own at its origin, outside the prefix', () => {
    const href = homeAssistantHref('/config/backup');
    expect(href).toBe(`${window.location.origin}/config/backup`);
    expect(new URL(href ?? '').pathname.startsWith(PREFIX)).toBe(false);
  });

  it('wraps fetch and XMLHttpRequest so every server path goes under the prefix', async () => {
    const calls: unknown[] = [];
    const opened: unknown[] = [];
    const realFetch = window.fetch;
    const realOpen = XMLHttpRequest.prototype.open;
    window.fetch = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(input);
      return new Response('{}');
    }) as typeof fetch;
    XMLHttpRequest.prototype.open = ((method: string, url: string | URL) => {
      opened.push([method, url]);
    }) as typeof XMLHttpRequest.prototype.open;
    try {
      installIngressPrefixing();
      await fetch('/api/v1/me');
      await fetch(new URL('https://elsewhere.example/a'));
      expect(calls).toEqual([`${PREFIX}/api/v1/me`, new URL('https://elsewhere.example/a')]);
      new XMLHttpRequest().open('PUT', '/api/v1/files/1');
      expect(opened).toEqual([['PUT', `${PREFIX}/api/v1/files/1`]]);
      // Installing twice wraps once.
      const wrapped = window.fetch;
      installIngressPrefixing();
      expect(window.fetch).toBe(wrapped);
    } finally {
      window.fetch = realFetch;
      XMLHttpRequest.prototype.open = realOpen;
    }
  });
});
