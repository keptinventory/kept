---
title: Sicherheitsmodell
description: Was eine betreibende Person darüber wissen sollte, wie Kept Haushalte getrennt hält, Geheimnisse versiegelt, Menschen anmeldet und was den Server verlässt.
---

Diese Seite ist die Zusammenfassung des Bedrohungsmodells von Kept und der Mechanismen dahinter für betreibende Personen. Die Entwicklerseiten gehen tiefer: [Row-Level Security](/de/developers/rls/), [Anmeldung](/de/developers/auth/) und [die Architektur](/de/developers/architecture/).

## Haushalte werden durch die Datenbank voneinander getrennt gehalten

Kept verbindet sich mit vier Anmeldungen mit Postgres, von denen jede nur das darf, was ihre Aufgabe erfordert:

| Anmeldung | Genutzt von | Was sie darf |
|---|---|---|
| `kept_owner` | `kept migrate`, `kept admin`, die nächtliche Sicherung | besitzt das Schema; wird nie zum Bedienen einer Anfrage verwendet |
| `kept_app` | jede Web-Anfrage, Instanz-Admin-Routen eingeschlossen | liest und schreibt App-Tabellen, immer unter Row-Level Security (`NOBYPASSRLS`, `FORCE` RLS auf jeder Tabelle) |
| `kept_auth` | Anmeldung (Better Auth) | nur sein eigenes `auth`-Schema |
| `kept_system` | Hintergrundjobs, die Haushalte übergreifen (Erinnerungsscan, Aufbewahrung), der Setup-Code | nur explizite Systemrichtlinien |

Jede Anfrage läuft in einer Transaktion, die die angemeldete Person benennt, und jede Richtlinie fragt eine Funktion, zu welchen Orten diese Person gehört. Ist keine Person gesetzt, geben die Richtlinien nichts zurück, sodass ein Codepfad, der den Bereich vergisst, standardmäßig nichts erhält und sicher fehlschlägt. Ein schema-weiter Lecktest prüft die Anfrage-, Auth- und Worker-Pfade. Die Details stehen bei [Row-Level Security](/de/developers/rls/).

Was das für Sie bedeutet: Der bedienende Container hält nie die Anmeldung des Eigentümers, es sei denn, Sie geben ihm eine für Sicherungen ([Sicherungen](/de/admin/backups/#aktivieren)). Ein Instanz-Admin hat **keinen Zugriff innerhalb der App** auf die Orte anderer Personen; eine betreibende Person mit Datenbankzugriff kann das umgehen, weshalb die Datenbank selbst dem Server privat bleiben muss.

## Schlüssel und Verschlüsselung

- **`KEPT_SECRET_KEY`** versiegelt alle geheimen Werte: geheime Felder an Dingen, KI-Schlüssel, Einstellungen für Benachrichtigungskanäle, Webhook-Geheimnisse, Passwörter von E-Mail-Eingangs-Postfächern, Paperless-ngx-API-Token, den privaten Web-Push-Schlüssel, das Sicherungspasswort. AES-256-GCM mit einem Daten-Schlüssel pro Zeile, jedes Chiffrat an seine Tabelle, Zeile und Feld gebunden, sodass eines nicht durch ein anderes ausgetauscht werden kann.
- **`KEPT_AUTH_SECRET`** signiert Sitzungen und Token. Es ist getrennt, damit beide einzeln rotiert werden können.
- **Wird beim ersten Start erzeugt**, wenn beide unset sind, in das Konfigurations-Volume (niemals in das Daten-Volume), mit einer Protokollzeile, die den Ort angibt. Setzen Sie sie selbst mit `kept admin gen-key`; der Start verweigert einen Schlüssel, der kürzer als 32 Byte ist, und einen, der ohne den anderen gesetzt ist.
- **Keiner von beiden ist in der Datenbank oder in der Sicherung.** Halten Sie [das Wiederherstellungs-Kit](/de/admin/recovery-kit/) bereit. Ohne den geheimen Schlüssel bringt eine Wiederherstellung alles zurück außer geheimen Werten und KI-Schlüsseln.
- **Rotation:** `kept admin rotate-key` macht einen neuen Schlüssel zum aktuellen und packt jeden versiegelten Wert neu ein; der alte Schlüssel wird als zurückgezogene Version behalten, damit ältere Sicherungen noch öffnen. `--resume` beendet einen unterbrochenen Lauf, `--drop <version>` entfernt einen zurückgezogenen Schlüssel, den nichts nutzt ([die CLI](/de/admin/cli/#befehle)).
- **Postfach-Passwörter sind nur schreibbar:** Server, Benutzername und Passwort eines E-Mail-Eingangs-Postfachs werden zusammen versiegelt; die Seite zeigt Server und Benutzernamen, niemals das Passwort.
- **KI-Schlüssel sind nur schreibbar:** Nach dem Speichern zeigt Kept nur die letzten vier Zeichen an.
- **Paperless-ngx-Token sind nur schreibbar:** Die Paperless-Adresse und das Token eines Ortes werden zusammen versiegelt; die Seite zeigt die Adresse, niemals das Token, und der Browser spricht nie direkt mit Paperless darüber. Miniaturansichten und Downloads laufen über Kept, nach Kepts eigener Zugriffsprüfung.

## Anmelden

Kept verwendet Better Auth für seine eigene Anmeldung und sein Schema. Womit sich ein Konto anmelden kann:

- **E-Mail und Passwort.** Ein Passwort-Reset meldet das Konto überall ab, und der Eigentümer wird per Mail benachrichtigt, wenn sich Anmeldedaten ändern.
- **Passkeys**, registriert für den Hostnamen von `KEPT_PUBLIC_URL`. Jeder muss seinen Benutzer verifizieren (Face ID, ein Fingerabdruck, eine PIN) und auffindbar sein.
- **Zwei-Faktor** mit einer Authenticator-App (TOTP) oder einem Passkey, der den Benutzer verifiziert hat. Ein per E-Mail verschickter Einmal-Code ist niemals ein zweiter Faktor. Der Eigentümer eines Ortes kann Zwei-Faktor für alle dort verlangen. Konten ohne Passwort können die Authenticator-App ebenfalls nutzen.
- **Einstellungen → Anmeldung und Sicherheit** fügt Passkeys hinzu, benennt sie um und entfernt sie, und schaltet die Authenticator-App ein, erstellt neue Backup-Codes, richtet sie neu ein und schaltet sie aus ([Anmeldung und Sicherheit](/de/users/sign-in-security/)). Jede Änderung verlangt das Passwort oder eine Anmeldung in den letzten zehn Minuten bei einem Konto ohne Passwort, und meldet alle anderen Geräte ab (Umbenennung ausgenommen). Der Server verweigert das Entfernen der letzten Einstiegsmöglichkeit und das Ausschalten von Zwei-Faktor, während ein Ort es verlangt und das Konto keinen Passkey hat. Die erneute Einrichtung der App lässt das alte Geheimnis funktionieren, bis ein Code der neuen als bewiesen gilt.
- **Magic Links** für bestehende Konten (keine offene Anmeldung), 15 Minuten gültig. Versendete Token reisen im `#fragment` des Links und werden durch ein POST von der Seite eingelöst, sodass ein Mail-Scanner, der Links öffnet, sie nicht verbrauchen kann; gespeichert wird nur ein Hash.
- **Benutzernamen** für verwaltete Konten (Personen ohne E-Mail-Adresse).
- **OIDC**, wenn `KEPT_OIDC_ISSUER` und `KEPT_OIDC_CLIENT_ID` gesetzt sind ([Konfiguration](/de/reference/configuration/)). Eine externe Identität wird nie mit einem Konto verknüpft, nur weil die E-Mail übereinstimmt; eine neue Person kommt durch Einladung herein oder über eine erlaubte Domain oder Gruppe. Die Token des Identity Providers werden nie gespeichert.
- **Google**, wenn `KEPT_GOOGLE_CLIENT_ID` und `KEPT_GOOGLE_CLIENT_SECRET` gesetzt sind, mit der Weiterleitungs-URI, die Admin → Status zeigt. Dieselben Regeln wie bei OIDC, nur dass niemand über eine Domain hineinkommt: nur ein bestehendes Konto, das Google verknüpft hat, oder eine eingeladene Person.
- **Verknüpfen und Entknüpfen** einer externen Anmeldung geschehen in Einstellungen → Ich → Anmeldemethoden. Verknüpfen verlangt eine Anmeldung in den letzten zehn Minuten; Entknüpfen verlangt das Passwort (oder jene kürzliche Anmeldung bei einem Konto ohne Passwort). Ein Konto behält mindestens eine Einstiegsmöglichkeit.

**Sitzungen** dauern 30 Tage über HTTPS, verlängert einmal pro Nutzungstag, mit Cookies mit `Secure` und `__Secure-`-Präfix. Über unverschlüsseltes HTTP dauern sie 12 Stunden und werden nie verlängert, und Kept verweigert Aktionen, die ein Geheimnis offenbaren oder ändern ([HTTPS](/de/install/https/)). Sensible Aktionen verlangen erneut das Passwort oder eine Anmeldung in den letzten zehn Minuten; das Erneuern einer Anmeldung setzt diese zehn Minuten nicht zurück.

`KEPT_HTTP_SIGN_IN_DAYS` (1 bis 30, standardmäßig unset) lässt diejenigen, die den Server betreiben, eine Anmeldung über unverschlüsseltes HTTP so viele Tage dauern wie angegeben, erneuert bei Nutzung. Es ist die einzige Einstellung, die dies lockert, kann nicht in der App geändert werden und wirkt über HTTPS nicht. Geheimnisse bleiben über HTTP verweigert, die zehn Minuten bleiben, und Abmelden überall beendet weiterhin jede Anmeldung. Der Preis: über unverschlüsseltes HTTP kann ein Anmelde-Cookie von jeder kopiert werden, die den Datenverkehr sehen kann, und mit aktivierter Einstellung bleibt ein kopiertes so lange nutzbar, wie es genutzt wird, bis sich dieses Gerät abmeldet oder die anderen Geräte abgemeldet werden ([In Ihrem Netzwerk bleiben](/de/install/home-network/#bleiben-in-deinem-heimnetz)).

**Anfragen von anderen Seiten** werden verweigert: Ein Schreiben, das Kepts Cookie trägt, muss von der Origin von `KEPT_PUBLIC_URL` kommen, sonst gibt es 403, bevor die Sitzung überhaupt gelesen wird. Dasselbe gilt für die Erstinstallation, die noch kein Cookie hat, bevor ihr Setup-Code probiert wird.

`KEPT_EXTRA_ADDRESSES` (standardmäßig unset) lässt diejenigen, die den Server betreiben, weitere genaue Origins auflisten, die als Kept gelten. Sie werden beim Start einmal gelesen und ganz mit der `Origin` des Browsers verglichen; `Host` und `X-Forwarded-*` spielen keine Rolle. Ein Platzhalter oder eine Mischung aus `http` und `https` stoppt den Start. Die Verweigerung nennt `KEPT_PUBLIC_URL` und niemals die Liste. Passkeys, externe Anmeldungen, OAuth und alle Links bleiben bei `KEPT_PUBLIC_URL`: ein Passkey wird gegen diese Adresse geprüft, egal was die Anfrage sagt. Der Preis: Eine Seite, die unter einer gelisteten Adresse ausgeliefert wird, kann für den angemeldeten Benutzer handeln ([Mehr als eine Adresse](/de/install/home-network/#mehr-als-eine-adresse)).

Die Seiten werden mit einer Content-Security-Policy `default-src 'self'` ausgeliefert, dürfen nicht in Frames eingebettet werden, und erhalten HSTS, wenn die öffentliche URL HTTPS ist, es sei denn `KEPT_HSTS=off` ([HSTS](/de/install/reverse-proxy/#hsts)).

## Ratenbegrenzungen

Wie ausgeliefert:

| Was | Grenze |
|---|---|
| Anmeldeversuche | 5 pro Minute pro Adresse; pro Konto und Adresse 20 pro Stunde, mit Verzögerungen, die nach dem vierten Fehlversuch wachsen (bis zu 5 Minuten) statt einer Sperrung |
| Andere Auth-Routen | 100 pro Minute pro Adresse und Route |
| API und MCP, pro Token | 120 Lesen und 30 Schreiben pro Minute |
| Passwort-Reset und Magic Link | 3 pro Stunde pro Konto |
| Seite eines geteilten Links | 60 Aufrufe pro Minute pro Link |

Grenzen werden in der Datenbank gehalten, sodass Replikas sie teilen. Die Adresse des Clients kommt aus dem Socket oder nur aus `X-Forwarded-For`, wenn die Verbindung von einer Adresse in `KEPT_TRUSTED_PROXIES` stammt ([Reverse Proxies](/de/install/reverse-proxy/#vertraue-dem-proxy--und-nur-dem-proxy)).

## Ausgehende Anfragen (SSRF)

Kept holt nur Adressen, die jemand konfiguriert hat: die Basis-URL eines KI-Anbieters, Webhooks, Push, einen OIDC-Issuer, Metadaten eines OAuth-Clients, einen Homebox-Server zum Importieren, Barcode-Abfragen, die Update-Prüfung, ein E-Mail-Eingangs-Postfach eines Ortes (IMAP) und das Paperless-ngx eines Ortes. Alle gehen durch dieselbe Schutzroutine ([`apps/server/src/net/ssrf.ts`](https://github.com/keptinventory/kept/blob/main/apps/server/src/net/ssrf.ts)):

- die Adresse wird **beim Verbindungsaufbau** geprüft, nachdem der Name aufgelöst wurde, sodass ein Name, der sich zwischen Prüfung und Anfrage ändert, nicht durchrutschen kann;
- private, Loopback-, Link-Local (einschließlich der Cloud-Metadaten-Adresse), Carrier-Grade-NAT-, Multicast- und reservierte Bereiche werden verweigert, IPv4 und IPv6;
- Weiterleitungen werden verweigert, sodass ein öffentlicher Host die Anfrage nicht nach innen zurückleiten kann.

Eine verweigerte Adresse ist `400 private_address`. Auf einem selbst gehosteten Server kann ein Instanz-Admin private Adressen erlauben (**Admin → Einstellungen → Private Adressen erlauben**), was ein Anbieter in Ihrem eigenen Netzwerk, wie [Ollama](/de/admin/ollama/), benötigt. Standardmäßig ist es aus.

## Feindliche Eingaben

Importe und Uploads werden als feindlich behandelt. Die Standardwerte:

| Grenze | Standard |
|---|---|
| Import-ZIP | 5 GB unkomprimiert, 100:1-Kompression pro Eintrag, 200.000 Einträge, keine Symlinks |
| Bilder | bis zu 100 Megapixel dekodiert, jeweils eines unter 3 GB RAM oder einem Container-Limit unter 3 GB |
| PDFs | in einem Kindprozess geparst, 20 s und 256 MB |
| Uploads | `KEPT_MAX_FILE_MB` (standardmäßig 25 MB), vor dem Lesen des Bodys verweigert |

Gespeicherte Dateien werden über einen signierten Fünf-Minuten-Link auf einem Pfad abgerufen, der keine Sitzung liest, mit `nosniff` und einer Richtlinie `default-src 'none'; sandbox`, und als Download, es sei denn, die Datei ist eines von Kepts eigenen neu kodierten JPEGs. Exportierte CSV-Zellen, die wie eine Formel beginnen, werden neutralisiert.

## Was den Server verlässt

- **Nichts über Kept selbst.** Es gibt keine Telemetrie irgendeiner Art; die Telemetrie der Anmeldebibliothek ist ausgeschaltet. Tracing und Fehlerberichte gehen nur an einen Collector, den Sie setzen ([Überwachung](/de/admin/observability/#tracing-und-fehlerberichterstattung)).
- **Die Update-Prüfung ist standardmäßig aus.** Wenn an, fragt sie GitHub einmal am Tag nach dem neuesten Release und sendet nichts als die Anfrage ([Upgrades](/de/admin/upgrades/#wissen-dass-es-eine-neue-version-gibt)).
- **Was ein KI-Anbieter sieht**, wenn ein Ort einen nutzt: Fotos als neu kodierte Kopie mit entferntem EXIF und XMP (Kept verweigert das Senden eines Bildes, das sie noch hat), den festen Prompt und die Sprachen des Ortes für die Extraktion, die Frage und die Werkzeugergebnisse, die die Rolle des Fragenden für den Assistenten zulässt, und beschreibende Felder für die semantische Suche. **Niemals geheime Werte**, und niemals Geld für die Suche. Kepts eigene Aufzeichnung jedes Aufrufs speichert Token und Kosten, niemals den Prompt, das Bild, die Antwort oder den Schlüssel. Siehe [KI-Anbieter](/de/users/ai-providers/).
- **Geteilte Links** (`/s/<token>`) sind die eine Seite, die jede ohne Anmeldung öffnen kann. Der Token sind 32 zufällige Bytes, einmal angezeigt und als SHA-256 gespeichert; er gelangt nie in eine Protokollzeile. Die Seite wird über eine Datenbankfunktion gelesen, die den Hash des Tokens nimmt und nur Namen, Typen, wo die Dinge sind, Mengen, Zustand, Notizen und Fotos zurückgibt, für die geteilte Box, den Ort oder die Suche in diesem Ort. Fotos sind Vorschauen mit entferntem GPS, als signierte Fünf-Minuten-URLs, und nur für diese Dinge. Ein Link stoppt, wenn er widerrufen oder abgelaufen ist oder sein Ersteller den Ort nicht mehr verwaltet; er wird bei jedem Aufruf geprüft.
- **Sicherungen** sind restic-Snapshots, die mit einem Passwort von mindestens 12 Zeichen verschlüsselt werden, bevor sie den Server verlassen; ohne Passwort gibt es keine Sicherung ([Sicherungen](/de/admin/backups/)).

## Melden einer Sicherheitslücke

Verwenden Sie GitHubs **private vulnerability reporting** im Repository (der Tab **Sicherheit** → **Report a vulnerability**); es ist der einzige Kanal, und es gibt keine Sicherheits-E-Mail-Adresse. Öffnen Sie kein öffentliches Issue. [SECURITY.md](https://github.com/keptinventory/kept/blob/main/SECURITY.md) enthält die Details und die unterstützten Versionen, die ab 1.0 gelten. Um zu prüfen, dass ein Image das vom Maintainer gebaute ist, siehe [Release verifizieren](/de/admin/verify-release/).
