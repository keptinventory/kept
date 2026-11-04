---
title: Behind a reverse proxy
description: The settings that matter when Kept sits behind nginx, Traefik, Caddy or another proxy - trusted addresses, upload sizes, which hostname to use, the address error and HSTS.
sidebar:
  order: 3
---

Kept listens on port 8080 and speaks plain HTTP; the proxy in front of it terminates TLS. Point the
proxy at port 8080, set `KEPT_PUBLIC_URL` to the address people open, and check the things
below. Compose's own [Caddy profile](/install/https/#composes-caddy-profile) already does the first
three.

## Trust the proxy, and only the proxy

Kept rate-limits sign-in, setup codes and other sensitive requests **per client address**. Behind a
proxy, the client's address arrives in `X-Forwarded-For`, which anyone can write. Kept believes it
only from the addresses in `KEPT_TRUSTED_PROXIES`:

```sh
KEPT_TRUSTED_PROXIES=10.0.0.5            # one proxy
KEPT_TRUSTED_PROXIES=10.0.0.5,10.0.1.0/24  # several, or a range
```

Kept walks `X-Forwarded-For` from the right and stops at the first address it doesn't trust: that is
the client. Empty (the default), the socket's address is the client. List the proxy's address as
Kept sees it (on Docker's network, the proxy container's address, not the host's), and nothing
that a stranger could send requests from.

With Compose, put it in `.env` next to `compose.yaml`. Before 1.14.5, `compose.yaml` set its own
value and a line in `.env` never reached Kept; on those versions set it for the `kept` service in a
`compose.override.yaml`. With `compose.full.yaml`'s Caddy, leave it empty (Caddy's address is the
default) or keep `172.29.72.200` in the list.

### The setup lockout

Wrong setup codes lock out the address that sent them for a while, and many wrong codes lock out
the whole instance. If the proxy isn't in `KEPT_TRUSTED_PROXIES`, every visitor shares the proxy's
address, so one person's guesses lock everyone out. `kept admin setup-code` issues a new code and
lifts the instance-wide lockout, but not a per-address one: that one ends on its own.

## Let uploads through

The proxy must accept a request body at least as large as Kept does, and should not buffer uploads
it doesn't need to:

| Upload | Kept's limit |
|---|---|
| A photo, receipt or document | `KEPT_MAX_FILE_MB`, 25 MB by default; streamed, refused with 413 before it is read when too large |
| A CSV import | 8 MB |

Most proxies' default is smaller (nginx's `client_max_body_size`, for instance); raise it to at
least `KEPT_MAX_FILE_MB`. Timeouts should allow a large upload over a slow phone connection.

## Give Kept its own hostname

Serve Kept on a hostname whose parent domain has no sites you don't control, or on a domain of its
own. Over HTTPS Kept's session cookie is `__Secure-` prefixed, which still lets a page on a
**sibling** subdomain (`other.example.org` beside `kept.example.org`) set a cookie for
`example.org` that browsers also send to Kept. A sibling run by someone else could use that to
fixate a session. Your own other services on sibling subdomains are fine.

## "This Kept is set up for …"

The app says "This Kept is set up for *address*. Open it there." when it is opened at another
address than `KEPT_PUBLIC_URL`.

- **Why:** Kept accepts writes only from the address in `KEPT_PUBLIC_URL`, by the browser's
  `Origin`: scheme, host and port, exactly. The proxy plays no part; its own address and
  `X-Forwarded-*` headers don't change it.
- **Fix:** set `KEPT_PUBLIC_URL` to exactly the address people open (`https://kept.example.org`,
  not the proxy's upstream `http://kept:8080`), and restart Kept.
- **More than one address:** `KEPT_EXTRA_ADDRESSES` lists the others, and each must also reach
  Kept through your proxy ([More than one address](/install/home-network/#more-than-one-address)).

More in [Troubleshooting](/admin/troubleshooting/#this-kept-is-set-up-for--or-the-request-did-not-come-from-this-site).

## HSTS

With an `https:` `KEPT_PUBLIC_URL`, Kept sends `Strict-Transport-Security: max-age=31536000`:
browsers then open this hostname only over https, for a year. Over `http:` it sends nothing.

- **Whole hostname, every port:** a browser applies the policy to the hostname, not to Kept's
  port. A plain-http service on the same name, such as `http://server.lan:8081` beside Kept on
  `https://server.lan`, is then forced to https and stops loading. Browsers ignore HSTS from an IP
  address.
- **Turn it off:** set `KEPT_HSTS=off` when other plain-http services share Kept's hostname, and
  restart. Kept then sends `max-age=0`, so a browser that stored the policy forgets it on its next
  https visit to Kept. Leaving the header out wouldn't clear it.
- **Your proxy:** if it adds its own `Strict-Transport-Security` header, turn that off there too.
- **Preloaded domains:** under a top-level domain on the browsers' HSTS preload list, such as
  `.dev` or `.app`, every name is https only, whatever Kept sends.

### Clear a stored policy by hand

When Kept is no longer reachable over https, `max-age=0` can't reach the browser. Clear the
hostname in each browser that visited it:

- **Chrome, Edge and other Chromium browsers:** open `chrome://net-internals/#hsts` (in Edge,
  `edge://net-internals/#hsts`), enter the hostname under **Delete domain security policies**, and
  choose **Delete**.
- **Firefox:** History → Manage History, find the site, right-click it and choose **Forget About
  This Site**. This also removes its history, cookies and saved logins.
- **Safari on a Mac:** has no page for HSTS. Remove the site's data (Settings → Privacy → Manage
  Website Data, select it, **Remove**); if plain http still turns into https, clear the history too
  (History → Clear History).
- **Safari on an iPhone or iPad:** Settings → Apps → Safari (Settings → Safari before iOS 18) →
  Advanced → Website Data, find the site and delete it; if that isn't enough, **Clear History and
  Website Data** on the Safari page.
