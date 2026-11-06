---
title: Überwachung
description: Gesundheitsprüfungen, die Statusseite, Warnungen, Metriken, Logs und optionales Tracing und Fehlerberichterstattung.
sidebar:
  order: 12
---

Kept sendet nichts über sich selbst irgendwohin, es sei denn, du richtest es ein: **keine Telemetrie jeglicher Art**, nicht
einmal Opt-in-Installationszahlen.

## Gesundheitsprüfungen

| Pfad | Antwortet |
|---|---|
| `/healthz` | 200, solange der Prozess HTTP bereitstellt. Für einen Liveness-Probe. |
| `/readyz` | 200, wenn beide Datenbankverbindungen des Webs antworten, sonst 503. Für Readiness und den eigenen `HEALTHCHECK` des Images. |
| `/version` | die Version, der Commit, aus dem es gebaut wurde, das Quell-Repository und wo sich die Drittanbieter-Hinweise befinden (`/notices.txt` im Image). |

Ein Container, der nur den Worker ausführt (`KEPT_ROLE=worker`), stellt kein HTTP bereit. Der `HEALTHCHECK` des Images folgt `KEPT_ROLE`: Für den Worker prüft er, dass die Job-Schleife die Datenbank innerhalb der letzten zwei Minuten abgefragt hat (dabei berührt er `/tmp/kept-worker-alive`), sodass eine aufgeteilte Bereitstellung keine Healthcheck-Überschreibung braucht.

## Statusseite und Warnungen

**Admin → Status** zeigt, was Aufmerksamkeit braucht: den Wiederherstellungskit, Mail, fehlgeschlagene Hintergrundjobs, den
Erinnerungsscan und Backups: das Alter des Backups, die letzte Wiederherstellungsübung, Bucket-Versionierung, Festplatten-
speicher, das Release und seine Migrationen, die Update-Prüfung, HTTPS und die Connectors. Admin-Warnungen
erreichen Instanz-Admins in der App, per Mail und per Push; jede wird aufgelöst, wenn ihre Ursache beseitigt ist.

## Metriken

Setze `KEPT_METRICS_TOKEN` und `/metrics` liefert Prometheus-Text an Anfragen, die ihn als Bearer-
Token senden (`Authorization: Bearer <token>`); ohne die Variable existiert der Pfad nicht. Compose reicht die Variable aus `.env` durch.

| Metrik | Was |
|---|---|
| `kept_build_info{version, revision}` | immer 1; der laufende Build |
| `kept_process_uptime_seconds` | Sekunden seit Start des Prozesses |
| `kept_process_resident_memory_bytes` | der Speicher des Prozesses |
| `kept_db_pool_connections{pool, state}` | Verbindungen pro Datenbank-Pool: gesamt, inaktiv, wartend |
| `kept_backup_last_success_timestamp_seconds` | wann das letzte gute Backup abgeschlossen war (0 vor dem ersten) |
| `kept_backup_last_run_status{status}` | 1 für den Status des zuletzt abgeschlossenen Runs, 0 für die anderen |
| `kept_disk_used_ratio{volume}` | wie voll die Datenfestplatte und ein Verzeichnis-Backup-Ziel sind |
| `kept_update_available` | 1, wenn die Update-Prüfung ein neueres Release gesehen hat |

Kein Label enthält je einen Pfad oder ein Ziel. Wenn eine Datenbank nicht antworten kann, fehlen die Backup-, Festplatten- und Update-Zeilen; der Scrape selbst gelingt trotzdem.

## Logs

JSON-Zeilen auf der Standardausgabe (`KEPT_LOG_FORMAT=json`, der Standard), oder `pretty` für die Ansicht von
`docker compose logs`; `KEPT_LOG_LEVEL` setzt das Level. Jede Anfrage hat eine ID, die im
Antwort-Header `x-request-id` zurückgesendet wird, damit ein Report seiner Logzeile zugeordnet werden kann. Tokens in URLs
werden aus dem Log geschwärzt, und Secrets und Passwörter werden nie geloggt.

## Tracing und Fehlerberichterstattung

Beides ist optional und standardmäßig aus.

- **Tracing:** Mit gesetztem `OTEL_EXPORTER_OTLP_ENDPOINT` sendet Kept OpenTelemetry-Traces seiner HTTP-
Anfragen und Datenbankabfragen an deinen Collector. Ist die Variable nicht gesetzt, wird noch nicht einmal Tracing-Code geladen, und ein nicht erreichbarer Collector verlangsamt nie eine Anfrage.
- **Fehlerberichterstattung:** Mit einem Sentry-kompatiblen DSN in `KEPT_ERROR_DSN` werden nicht behandelte Fehler mit Anfrage-
ID und Route gemeldet, und niemals ein Anfragebody, Header, Query-String, Name oder etwas, das in einem Speicherort gespeichert ist.
