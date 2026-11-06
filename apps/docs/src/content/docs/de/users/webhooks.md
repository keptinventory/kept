---
title: Webhooks
description: "Signierte POSTs an deinen eigenen Server bei Änderungen: die Ereignisse, der Inhalt, die Signatur prüfen, Zustellungen und Wiederholungen sowie das Geheimnis."
---

Ein **Webhook** ist Kept, das bei einer Änderung an einem Standort an eine von dir gewählte Adresse postet: ein Gegenstand wird hinzugefügt, verschoben oder weggeworfen, eine Messung wird erfasst, eine Erinnerung fällt an. Jeder POST ist signiert, damit dein Server erkennen kann, dass er von Kept kommt. Er enthält IDs und die Namen der geänderten Felder, nie deren Werte: um den Gegenstand selbst zu sehen, holt sich dein Server ihn über die [API](/api/) mit seinem eigenen Token.

Eigentümer und Admins verwalten die Webhooks eines Standorts in **Standorteinstellungen → Webhooks**: **Webhook hinzufügen**, die Adresse und die Ereignisse, auf die er reagiert. **Einstellungen → Verbindungen** listet die Webhooks, die du über deine Standorte hinweg verwaltest.

## Die Ereignisse

| Ereignis | Wann gesendet |
|---|---|
| `thing.created` | Ein Gegenstand wird hinzugefügt |
| `thing.updated` | Ein Gegenstand wird geändert |
| `thing.moved` | Ein Gegenstand wird verschoben |
| `thing.trashed` | Ein Gegenstand landet im Papierkorb |
| `thing.restored` | Ein Gegenstand wird aus dem Papierkorb zurückgeholt |
| `thing.lifecycle_changed` | Der Zustand eines Gegenstands ändert sich, etwa verloren oder verkauft |
| `reading.logged` | Eine Messung wird erfasst |
| `reminder.due` | Eine Erinnerung ist fällig |

Jedes Payload hat dieselben Felder:

```json
{
  "id": "evt_…",
  "event": "thing.updated",
  "occurred_at": "2026-10-03T09:12:44.000Z",
  "location_id": "…",
  "entity": { "type": "thing", "id": "…" },
  "changed_fields": ["…"],
  "actor": { "type": "user", "id": "…" }
}
```

`entity.type` ist `thing`, `reading` oder `reminder` (`webhook` bei einem Test); `changed_fields` nennt die Felder, die ein Schreibvorgang geändert hat, und ist bei einer Erinnerung leer; `actor.type` ist `user`, `token` oder `system`.

**Test senden** sendet ein `ping`-Ereignis, das einmalig und nicht wiederholt wird, und zeigt den Status, mit dem dein Server geantwortet hat: der schnellste Weg, eine neue Adresse zu prüfen.

## Die Signatur prüfen

Jede Zustellung enthält einen `Kept-Signature`-Header:

```
Kept-Signature: t=1792700000,v1=<64 hex characters>
```

`t` ist der Zeitpunkt der Signatur (Unix-Sekunden). `v1` ist ein HMAC-SHA256 mit dem Geheimnis des Webhooks von `<t>.<body>`: der Zeitstempel, ein Punkt und dann der exakte Request-Body. Dein Server berechnet denselben HMAC, vergleicht ihn in konstanter Zeit mit `v1` und lehnt ein altes `t` ab (älter als fünf Minuten zum Beispiel). Der Dialog des Geheimnisses enthält ein fertiges Snippet **Eine Zustellung prüfen (Node.js)**.

## Das Geheimnis

Das Signatur-Geheimnis wird nur einmal angezeigt, wenn der Webhook angelegt wird: kopiere es dann. Kept bewahrt es versiegelt zum Signieren auf und zeigt es nie wieder an. Verloren? **Neues Geheimnis** erzeugt ein weiteres; das bisherige funktioniert sofort nicht mehr, sodass Zustellungen nicht verifiziert werden können, bis dein Server das neue hat.

## Zustellungen

Jeder Webhook listet unter **Zustellungen** die letzten 30 Tage, neueste zuerst: eine Zeile pro Zustellung mit ihrem Zustand, dem Status, mit dem dein Server geantwortet hat (oder keinem), und der Anzahl der Versuche.

- **Wartet auf Versand**: in der Warteschlange.
- **Zugestellt**: dein Server hat mit einem 2xx-Status geantwortet.
- **Fehlgeschlagen, erneuter Versuch**: jede andere Antwort, keine Antwort innerhalb von 10 Sekunden oder eine Weiterleitung (Kept folgt Weiterleitungen nicht). Kept versucht es erneut.
- **Aufgegeben**: alle 10 Versuche über etwa 24 Stunden sind fehlgeschlagen.

Pro Standort gehen höchstens 10 Zustellungen pro Sekunde raus, damit ein Schub von Änderungen deinen Server nicht überschwemmt.

Wenn eine Zustellung aufgibt, wird der Webhook mit diesem Datum als **Fehlgeschlagen seit** markiert und Instanz-Admins erhalten einen Hinweis. Er sendet weiter; die nächste Zustellung, die durchkommt, löscht die Markierung.

Ein Webhook wird auf **Aus** gestellt, wenn ein Eigentümer oder Admin ihn ausschaltet, oder wenn die Person, die ihn angelegt hat, nicht mehr Admin des Standorts ist. Das Löschen ist endgültig: Kept sendet nicht mehr an ihn und seine Zustellungen werden vergessen.

## Dein eigener Webhook für Erinnerungen

Unabhängig von den Webhooks eines Standorts kannst du unter **Einstellungen → Profil → Benachrichtigungen** einen Webhook als einen deiner eigenen Kanäle hinzufügen, neben E-Mail, Push, ntfy, Telegram und Apprise ([Erinnerungen](/de/users/reminders/)). Er erhält einen POST pro Erinnerung (`reminder.due`) mit IDs, der Art der Erinnerung, dem Quelltyp und dem Fälligkeitsdatum, dem Gegenstand, Ort oder Standort, um den es geht, und einem Link zurück zu Kept: keine Namen oder Werte. Er wird auf die gleiche Weise signiert, mit einem Geheimnis, das einmalig angezeigt wird.

Ein fehlgeschlagener Versand wird bis zu 10-mal über etwa 24 Stunden wiederholt; kommt keiner durch, wird der Kanal als **Fehlgeschlagen seit** markiert und Kept schickt dir einmalig eine E-Mail. **Testen** sendet sofort einen. Du kannst bis zu fünf haben.

## Adressen in deinem eigenen Netzwerk

Kept verweigert das Posten an private Adressen (wie `192.168.x.x`), sodass ein Webhook nicht auf einen Router oder einen anderen Dienst im Netzwerk des Servers zielen kann. Ein Instanz-Admin kann sie in **Admin → Registrierung** freigeben (**Private Adressen erlauben**), für einen von dir selbst betriebenen Empfänger, etwa Home Assistant. Derselbe Schalter lässt einen KI-Anbieter, einen Homebox-Import und eine OIDC-Anmeldung dieses Netzwerk erreichen, also aktiviere ihn bewusst, wer solche hinzufügen kann. Siehe das [Sicherheitsmodell](/de/admin/security-model/#ausgehende-anfragen-ssrf).
