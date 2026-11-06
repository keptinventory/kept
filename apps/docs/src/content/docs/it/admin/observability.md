---
title: Monitoraggio
description: Controlli di salute, la pagina di stato, gli avvisi, le metriche, i log e il tracing e la segnalazione degli errori opzionali.
sidebar:
  order: 12
---

Kept non invia nulla su di sé da nessuna parte, a meno che tu non lo configuri: **nessuna telemetria di alcun tipo**, neanche
conteggi di installazione opt-in.

## Controlli di salute

| Percorso | Risposta |
|---|---|
| `/healthz` | 200 mentre il processo serve HTTP. Per una sonda di liveness. |
| `/readyz` | 200 quando rispondono entrambe le connessioni database del web, altrimenti 503. Per la readiness e il `HEALTHCHECK` proprio dell'immagine. |
| `/version` | la versione, il commit da cui è stata compilata, il repository sorgente e dove si trovano gli avvisi di terze parti (`/notices.txt`, nell'immagine). |

Un container che esegue solo il worker (`KEPT_ROLE=worker`) non serve HTTP. Il `HEALTHCHECK`
dell'immagine segue `KEPT_ROLE`: per il worker verifica che il loop dei job abbia interrogato il
database negli ultimi due minuti (tocca `/tmp/kept-worker-alive` mentre procede), quindi un
deployment separato non richiede override del healthcheck.

## La pagina di stato e gli avvisi

**Admin → Stato** mostra ciò che richiede attenzione: il kit di ripristino, la posta, i job in background falliti, la
scansione dei promemoria e i backup: l'età del backup, l'ultimo drill di ripristino, il versioning del
bucket, lo spazio su disco, il rilascio e le sue migrazioni, il controllo aggiornamenti, HTTPS e
i connettori. Gli avvisi admin raggiungono gli admin dell'istanza nell'app, via mail e via push;
ciascuno si risolve quando la sua causa si risolve.

## Metriche

Imposta `KEPT_METRICS_TOKEN` e `/metrics` serve testo Prometheus alle richieste che lo inviano come bearer
token (`Authorization: Bearer <token>`); senza la variabile, il percorso non esiste. Compose passa la variabile da `.env`.

| Metrica | Cosa |
|---|---|
| `kept_build_info{version, revision}` | sempre 1; la build in esecuzione |
| `kept_process_uptime_seconds` | secondi da quando il processo è partito |
| `kept_process_resident_memory_bytes` | la memoria del processo |
| `kept_db_pool_connections{pool, state}` | connessioni per pool di database: totali, inattive, in attesa |
| `kept_backup_last_success_timestamp_seconds` | quando è terminato l'ultimo backup valido (0 prima del primo) |
| `kept_backup_last_run_status{status}` | 1 per lo stato dell'ultima esecuzione completata, 0 per gli altri |
| `kept_disk_used_ratio{volume}` | quanto sono pieni il disco dei dati e una destinazione di backup su directory |
| `kept_update_available` | 1 quando il controllo aggiornamenti ha visto un rilascio più recente |

Nessuna etichetta contiene mai un percorso o una destinazione. Un database che non risponde lascia fuori le righe
di backup, disco e aggiornamento; lo scrape stesso riesce comunque.

## Log

Righe JSON sullo standard output (`KEPT_LOG_FORMAT=json`, il default), o `pretty` per leggere
`docker compose logs` a occhio; `KEPT_LOG_LEVEL` imposta il livello. Ogni richiesta ha un id, inviato
nel header di risposta `x-request-id`, così un report può essere abbinato alla sua riga di log. I token negli URL
sono redatti dal log, e segreti e password non vengono mai registrati.

## Tracciamento e segnalazione degli errori

Entrambi sono opzionali e disattivati per impostazione predefinita.

- **Tracciamento:** con `OTEL_EXPORTER_OTLP_ENDPOINT` impostato, Kept invia trace OpenTelemetry delle sue richieste HTTP
  e delle query al database al tuo collector. Se non impostato, nessun codice di tracing viene nemmeno caricato, e
  un collector non disponibile non rallenta mai una richiesta.
- **Segnalazione degli errori:** con un DSN compatibile con Sentry in `KEPT_ERROR_DSN`, gli errori non gestiti vengono segnalati con
  l'id e la rotta della richiesta, e mai un corpo della richiesta, un header, una query string, un nome o qualsiasi cosa memorizzata in
  un luogo.
