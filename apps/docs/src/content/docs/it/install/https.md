---
title: Metti Kept su HTTPS
description: Perché Kept vuole l'HTTPS, e come ottenerlo - Caddy da compose.full.yaml, Tailscale, NetBird, Twingate, Cloudflare Tunnel o il tuo proxy.
sidebar:
  order: 2
---

Kept funziona anche su HTTP semplice, ma un telefono tratta un indirizzo HTTP semplice come non sicuro, e alcune funzioni smettono di funzionare:

- **la fotocamera** (Kept torna al selettore di file),
- **l'installazione di Kept** nella schermata iniziale, e il suo utilizzo offline da lì,
- **le notifiche push**,
- **la posizione**.

`localhost` è considerato sicuro; un indirizzo LAN su HTTP non lo è. Con un `KEPT_PUBLIC_URL` in `https:`,
Kept marca anche i suoi cookie come `Secure` e invia HSTS; `KEPT_HSTS=off` lo disattiva quando servizi HTTP semplici condividono l'hostname ([HSTS](/it/install/reverse-proxy/#hsts)).

Alcune funzioni Kept le rifiuta direttamente mentre `KEPT_PUBLIC_URL` è impostato su `http:`, anche su `localhost`, perché gestiscono o modificano un segreto: mostrare un valore segreto, un esportazione con valori segreti, aprire i segreti di un'esportazione durante l'importazione, creare un token di accesso nel browser, collegare un'app con OAuth, scaricare il kit di ripristino, e modificare o testare le impostazioni di backup. Un'esportazione senza valori segreti funziona, così come un'importazione senza di essi. Le sessioni sono anche più brevi su HTTP. Mentre Kept è servito su HTTP, la lista di controllo "Per iniziare" nella Home mette "Metti Kept su HTTPS" al primo posto, finché un amministratore non sceglie "Resto sulla mia rete domestica". Tutto ciò che funziona su HTTP semplice, in una tabella: [Kept su una rete domestica](/it/install/home-network/).

## Profilo Caddy di Compose

Per un nome di dominio che punta a questa macchina, con le porte 80 e 443 raggiungibili da Internet
(Caddy dimostra il dominio a Let's Encrypt o ZeroSSL tramite queste porte). Caddy viene fornito con
`compose.full.yaml`, non con `compose.yaml` ([Caddy e Ollama](/it/install/compose/#caddy-e-ollama)):

```sh
# in .env
COMPOSE_FILE=compose.full.yaml
KEPT_DOMAIN=kept.example.org
KEPT_PUBLIC_URL=https://kept.example.org
```

Caddy legge `docker/caddy/Caddyfile` accanto al file Compose. Un checkout del repository ha
entrambi i file; un'installazione senza di esso li scarica una volta:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.5/compose.full.yaml
mkdir -p docker/caddy
curl -fsSLo docker/caddy/Caddyfile https://raw.githubusercontent.com/keptinventory/kept/v1.14.5/docker/caddy/Caddyfile
docker compose --profile https up -d
```

Senza il file, `docker compose --profile https up -d` si ferma con l'errore "bind source path does not exist". Qualsiasi altro proxy funziona invece; esso inoltra alla porta di Kept, come nelle sezioni seguenti.

Caddy ottiene e rinnova il certificato e inoltra tutto a Kept. Compose dà a Caddy un indirizzo fisso sulla sua rete e passa quell'indirizzo a Kept come `KEPT_TRUSTED_PROXIES`, così Kept crede all'`X-Forwarded-For` di Caddy e a nient'altro. Poi puoi associare l'HTTP semplice solo all'interfaccia di loopback, con `KEPT_HTTP_PORT=127.0.0.1:8080`.

Se `172.29.72.0/24` entra in conflitto con la tua LAN, cambia la sottorete della rete, il suo `ip_range`, l'`ipv4_address` di Caddy e `KEPT_TRUSTED_PROXIES` insieme in `compose.full.yaml`.

## Tailscale

Per un Kept raggiungibile solo dai tuoi dispositivi, senza alcuna porta aperta verso Internet: sulla macchina che esegue Kept, con i certificati HTTPS abilitati per la tua tailnet,

```sh
tailscale serve --bg 8080
```

serve Kept all'indirizzo `https://<machine>.<tailnet>.ts.net` con un certificato reale, a qualsiasi dispositivo sulla tailnet. Imposta `KEPT_PUBLIC_URL` su quell'indirizzo.

Il proxy di Tailscale viene eseguito sulla stessa macchina e si connette a Kept da `127.0.0.1`; Kept considera ogni richiesta proveniente da lì, a meno che non lo si consideri attendibile. Su un'istanza per singolo nucleo familiare, questo rileva solo per [il blocco della configurazione](/it/install/reverse-proxy/#il-blocco-del-setup).

## NetBird

Il reverse proxy di NetBird assegna alla porta di un peer un indirizzo pubblico `https://` con un certificato:

```sh
netbird expose 8080
```

Stampa l'indirizzo. Imposta `KEPT_PUBLIC_URL` su di esso (o sul tuo dominio personalizzato, con
`--with-custom-domain kept.example.org`, da configurare prima in NetBird). L'indirizzo è pubblico salvo che tu scelga **Accesso Solo NetBird** per il servizio nella dashboard, che lo limita ai tuoi peer. Un amministratore dell'account attiva **Peer Esponi** nelle Impostazioni → Clienti prima.

## Twingate

Twingate rende Kept raggiungibile dai tuoi dispositivi senza aprire una porta, ma il certificato è
il tuo: assegna a Kept un nome host su un dominio che possiedi (`kept.example.org`), ottieni un
certificato per esso con una sfida DNS (Caddy, Traefik o cert-manager possono farlo), e aggiungi
quel nome host come risorsa Twingate. Imposta `KEPT_PUBLIC_URL` su `https://kept.example.org`.

## Cloudflare Tunnel

Per un indirizzo pubblico senza porta aperta. Cloudflare serve l'hostname su HTTPS e lo inoltra a
Kept tramite `cloudflared`:

```sh
cloudflared tunnel login
cloudflared tunnel create kept
cloudflared tunnel route dns kept kept.example.org
cloudflared tunnel run kept
```

con `~/.cloudflared/config.yml`:

```yaml
tunnel: kept
credentials-file: <home>/.cloudflared/<tunnel id>.json
ingress:
  - hostname: kept.example.org
    service: http://localhost:8080
  - service: http_status:404
```

Imposta `KEPT_PUBLIC_URL` su `https://kept.example.org`. Cloudflare Access può mettere un processo di autenticazione davanti ad esso. Un indirizzo pubblico è anche ciò di cui un'applicazione web come claude.ai ha bisogno per
[connettersi al server MCP di Kept](/it/users/mcp-clients/#collega-come-connettore-oauth).

`cloudflared`, come gli altri tunnel qui descritti, raggiunge Kept dalla stessa macchina; considera attendibile come indicato in
[proxy inversi](/it/install/reverse-proxy/#fidati-del-proxy-e-solo-del-proxy).

## Il tuo proxy inverso

Qualsiasi proxy che termina TLS e inoltra alla porta 8080 funziona. Leggi
[proxy inversi](/it/install/reverse-proxy/) per le tre impostazioni rilevanti.

## Un certificato fidato solo dai tuoi dispositivi

In una LAN senza dominio, mkcert può creare un certificato
per l'indirizzo della macchina, servito tramite qualsiasi proxy TLS. Ogni telefono deve poi fidarsi del certificato radice di mkcert; su un iPhone ciò significa installarlo come profilo e attivare la fiducia completa in
Impostazioni → Generale → Info → Impostazioni di fiducia dei certificati. Tailscale è solitamente meno impegnativa.
