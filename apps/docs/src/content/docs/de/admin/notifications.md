---
title: E-Mail, Push und der Kalender-Feed
description: Richte ausgehende E-Mail und Web-Push für einen Kept-Server ein und erfahre, was Betreiber über die privaten Kalender-Links wissen sollten, die Menschen erstellen.
---

Kept erreicht Personen außerhalb der App per **E-Mail**, **Web-Push** an einen Browser oder die installierte App,
**ntfy**, **Telegram** und **Apprise**, sowie einem **Kalender-Feed**, den ihre Kalender-App abonniert. Alles landet auch im
In-App-Benachrichtigungszentrum, das keiner Einrichtung bedarf. Personen wählen aus, was sie erhalten unter
**Einstellungen → Benachrichtigungen** (Erinnerungen und Warnungen → **Öffnen**). Diese Seite ist die Seite des Betreibers.
Jede Variable ist in der [Konfigurationsreferenz](/de/reference/configuration/) aufgeführt.

## E-Mail

| Variable | Was es tut |
|---|---|
| `KEPT_SMTP_URL` | Der SMTP-Server, als `smtp://` oder `smtps://`, mit Anmeldeinformationen, falls er sie benötigt: `smtps://user:password@mail.example.org:465`. |
| `KEPT_SMTP_FROM` | Der Absender jeder E-Mail. Standard: `Kept <no-reply@<your KEPT_PUBLIC_URL host>>`. Die meisten Anbieter senden nur von einer Adresse, die sie verifiziert haben, therefore setze sie. |

Mit Compose trage beide in `.env` ein; `compose.yaml` übergibt sie an `kept` und `migrate`. Bei dem
Helm-Chart nennt `smtp.existingSecret` ein Geheimnis, das `KEPT_SMTP_URL` enthält, und `smtp.from` setzt den
Absender. Kept öffnet pro E-Mail eine Verbindung; nodemailers eigene URL-Optionen (wie `?pool=true`)
werden durch die URL weitergeleitet.

### Wenn `KEPT_SMTP_URL` nicht gesetzt ist

E-Mail wird nur als fällig protokolliert: eine Warnung pro E-Mail, `mail not sent: no mail transport is
configured`, wobei die Art der E-Mail genannt wird, niemals die Adresse, der Link oder das Token. **Admin → Status**
zeigt **E-Mail: Nicht konfiguriert** und die Nachricht **E-Mail ist nicht eingerichtet**. Ohne E-Mail gibt es
keine Anmelde-Links, Passwort-Rücksetzungen, E-Mail-Einladungen, per E-Mail gesendete Warnungen oder Berichte. Einladungen
per Link und Passwörter funktionieren ohne sie, und Erinnerungen erreichen Personen weiterhin per Push und in der App.
**Per E-Mail an mich** und **Erneut senden** im Druck der Inventarliste sind gesperrt, und Eigentümer sowie Administratoren
erhalten einen Link **E-Mail einrichten** zu dieser Seite; die API lehnt `email: true` und Berichtsschedule mit
409 `mail_not_configured` ab.

Wenn E-Mail konfiguriert ist, kann ein Konto dessen Adresse nicht verifiziert ist, keinen Passkey oder eine
Authenticator-App hinzufügen, bis die Adresse verifiziert ist.

### Was Kept sendet

Jede E-Mail wird als Text und HTML in der Sprache des Empfängers gesendet (Englisch, wenn Kept es nicht kennt). Links tragen ihr Token nach `#`, sodass ein E-Mail-Scanner
oder ein Server-Log niemals einen verwendbaren enthält.

- **Anmelden und das Konto**: Anmelde-Links, Passwort-Rücksetzungen, Bestätigen und Verifizieren einer neuen
  E-Mail-Adresse und eine Nachricht an die alte, eine Nachricht, wenn jemand versucht, sich mit einer Adresse
  anzumelden, die bereits ein Konto hat, und eine Benachrichtigung, wenn sich ein Zugangsdaten ändert: das Passwort, ein
  Passkey hinzugefügt oder entfernt, eine externe Anmeldung getrennt, Zwei-Faktor-Authentifizierung eingeschaltet, erneut eingerichtet oder deaktiviert,
  und neue Backup-Codes.
- **Personen und Orte**: E-Mail-Einladungen; an den Besitzer eines Standorts,
  jedes neue Mitglied oder verwaltetes Konto und jede Mitgliedschaft, die ihr Enddatum erreicht.
- **Transparenz**: wenn ein Instanz-Administrator (oder `kept admin`) irgendjemandes Konto
  verändert; und an jeden aktiven Benutzer, wenn die OIDC-Anmeldung der Instanz, ihre ausgehende E-Mail
  oder ihr Standard-KI-Anbieter geändert wird.
- **Erinnerungen**: ein überfälliges Item sofort, die tägliche Zusammenfassung, ein Kanal-Test,
  und eine Nachricht, wenn der eigene Webhook einer Person ständig fehlschlägt.
- **KI**: eine monatliche Obergrenze, die 80 % oder 100 % erreicht, und die optionale monatliche KI-Zusammenfassung.
- **An Instanz-Administratoren**: Administrator-Warnungen, höchstens einmal täglich pro Warnung
  ([die Statusseite und Warnungen](/de/admin/observability/#statusseite-und-warnungen)).

### Ändern des E-Mail-Servers

Kept vergleicht den SMTP-Host und den Absender mit dem, was es beim letzten Start gesehen hatte, niemals das
Passwort. Wenn sich einer davon geändert hat, wird die Änderung protokolliert und jeder aktive Benutzer wird über den
neuen Weg informiert. Der erste Start mit konfigurierter E-Mail zeichnet sie nur auf.

## Web-Push

Push benötigt **keine Schlüssel von dir**. Beim ersten Start generiert Kept ein VAPID-Schlüsselpaar und speichert es in
der Datenbank, der private Schlüssel wird mit `KEPT_SECRET_KEY` versiegelt. Um dein eigenes Paar zu verwenden, setzen
beide:

| Variable | Was es tut |
|---|---|
| `KEPT_VAPID_PUBLIC_KEY` | Der öffentliche Schlüssel: unpadded base64url von 65 Byte, wie es web-push's `generateVAPIDKeys()` schreibt. |
| `KEPT_VAPID_PRIVATE_KEY` | Sein privater Anteil (32 Byte, gleiche Kodierung). Nie protokolliert. Das Setzen eines ohne den anderen hält Kept beim Start auf. |
| `KEPT_VAPID_SUBJECT` | Wen Push-Dienste kontaktieren dürfen: eine `https:`-URL oder eine `mailto:`-Adresse. Standard: `KEPT_PUBLIC_URL`, wenn es `https` ist, sonst `mailto:` die `KEPT_SMTP_FROM`-Adresse. |

Push ist **nicht verfügbar**, wenn:

- `KEPT_PUBLIC_URL` ist nur `http` (nicht auf localhost): Browser abonnieren nur auf einer sicheren
  Seite. Personen sehen „Push benötigt HTTPS.“ ([HTTPS](/de/install/https/))
- es gibt kein Subject: keine `KEPT_VAPID_SUBJECT`, keine `https`-öffentliche URL und keine `KEPT_SMTP_FROM`.
  Personen sehen „Push ist auf diesem Server nicht eingerichtet.“

E-Mail und das Benachrichtigungszentrum funktionieren unabhängig davon trotzdem.

Personen schalten Push pro Gerät mit **Aktivieren** unter **Wie Kept Sie erreicht** ein, nachdem der
Browser danach fragt. **Auf iPhone und iPad funktionieren Benachrichtigungen nur über die installierte
App**: Kept sagt das so und bietet **So installierst du** ([die Telefon-App](/de/users/phone-app/)).

Was den Server verlässt: Kept sendet jedes Push über HTTPS an den Push-Dienst, den der Browser
abonniert hat, sodass es ausgehenden Internetzugang benötigt; private und lokale Adressen werden abgelehnt.
Ein Push trägt einen Titel, eine Textzeile und einen Link, unter 3 KB, niemals Geld oder Kontaktdetails.
Der Push-Dienst hält es bis zu einem Tag, während ein Gerät offline ist. Ein Abonnement, das der Dienst
als weg gemeldet hat, wird gelöscht.

:::caution[Verlust des Schlüssels]
Wenn der gespeicherte private Schlüssel nicht geöffnet werden kann, weil der geheime Schlüssel,
mit dem er versiegelt war, verloren ist, erzeugt Kept ein neues Paar und löscht jedes Push-Abonnement.
Alles andere bleibt erhalten: Personen schalten Push auf jedem Gerät erneut ein. Bewahre [das Wiederherstellungskit](/de/admin/recovery-kit/) auf und dies passiert niemals bei einer
Wiederherstellung oder einer [Serververschiebung](/de/admin/move-server/).
:::

## ntfy und Telegram

Personen fügen diese selbst in Einstellungen → Ich → Benachrichtigungen hinzu; auf dem Server
muss nichts konfiguriert werden. Kept sendet an den JSON-Endpunkt eines ntfy-Servers und an die
Bot-API von Telegram (`api.telegram.org`), jeweils gleichzeitig und über denselben Schutz wie bei
Webhooks: ein ntfy-Server auf einer privaten Adresse funktioniert nur, wenn **Private Adressen erlauben**
aktiviert ist (Admin → Einstellungen), und Weiterleitungen werden abgelehnt. Ihre Einstellungen (ein
ntfy-Thema und -Token, ein Telegram-Bot-Token) sind wie ein Webhook-Geheimnis verschlüsselt und
unterliegen der [Schlüsselrotation](/de/admin/recovery-kit/). Ein fehlgeschlagener Sendeverlauf wird mit
der Erinnerung wiederholt und markiert den Kanal als „Failing seit“; der nächste erfolgreiche Sendeverlauf
hebt diese Markierung auf. Administrator-Warnungen gehen nicht an sie.

## Apprise

[Apprise](https://github.com/caronc/apprise) erreicht Discord, Slack, Matrix, Signal, Pushover und
über 100 weitere Dienste. Kept kommuniziert mit einem **Apprise API**-Server, den du neben ihm
ausführst, und bietet **Apprise hinzufügen** Personen nur an, wenn `KEPT_APPRISE_URL` auf einen zeigt:

```yaml
# compose.yaml, beside the kept service
  apprise:
    image: caronc/apprise:2.0.0
    restart: unless-stopped

# and in the kept service's environment
KEPT_APPRISE_URL: http://apprise:8000
```

- Jede Person fügt ihre eigenen **Apprise-URLs** hinzu (eine oder mehrere, wie `discord://…` oder
  `mailto://…`). Sie sind wie ein Webhook-Geheimnis verschlüsselt, werden nie wieder angezeigt und
  unterliegen der [Schlüsselrotation](/de/admin/recovery-kit/).
- Kept verwendet die zustandslose `POST /notify/` der Apprise API und sendet die URLs mit jeder
  Nachricht, sodass der Apprise-Server nichts behält. Er wird absichtlich in deinem privaten Netzwerk
  erreicht, wobei Weiterleitungen abgelehnt werden.
- Generische `json://`, `xml://` und `form://` URLs der Apprise API (und ihre `s`-Formen) können auf
  jeden Host zeigen, einschließlich Maschinen in deinem Netzwerk, daher lehnt Kept sie ab, außer
  **Private Adressen erlauben** ist aktiviert (Admin → Einstellungen).
- Ein fehlgeschlagener Sendeverlauf (Apprise antwortet 424, wenn ein Dienst ablehnt) wird mit der
  Erinnerung wiederholt und markiert den Kanal als „Failing seit“. Administrator-Warnungen gehen nicht
  an Apprise.

## Der Kalender-Feed

Jede Person kann einen privaten iCal-Link von dem erstellen, was fällig ist und was abläuft, in
**Einstellungen → Benachrichtigungen → Kalender-Feed → Link erstellen**. Auf dem Server muss nichts
konfiguriert werden.

- **Was es enthält**: Ganztägige Ereignisse von einem Monat zurück bis zu 13 Monaten vorwärts, über
  die Standorte der Person hinweg: Titel, Platzpfade, Standortnamen und ein Link zu Kept. Nie Geld,
  Geheimnisse, Notizen oder Kontaktdetails von jemandem. Nur die Arten, die die Person über irgendeinen
  Kanal erhält, und nichts von einem Teil von Kept, den ein Standort deaktiviert hat. Standorte, die
  Zwei-Faktor-Authentifizierung erfordern, werden ausgelassen.
- **Der Link**: `https://kept.example.org/cal/<token>.ics`, einmal gezeigt. Kept speichert nur den
  SHA-256-Hash des Tokens und entfernt ihn aus den Anfragesprotokollen. Er wird aus `KEPT_PUBLIC_URL`
  erstellt, wenn er angelegt wird, sodass ein Link, der vor einer Adressänderung erstellt wurde,
  weiterhin auf die alte Adresse zeigt.
- **Wer es lesen kann**: Jeder, der den Link besitzt, ohne sich anzumelden. Ein unbekannter oder
  widerrufener Link, oder einer, der einem deaktivierten Konto gehört, antwortet mit 404, ohne zu
  sagen, welcher. Jeder Link kann 60 Mal pro Minute abgerufen werden.
- **Widerruf**: **Widerrufen** am Link beendet ihn endgültig; abonnierte Kalender hören auf zu aktualisieren.
  Die Liste behält die widerrufene Zeile bei und zeigt an, wann jeder aktive Link zuletzt abgerufen
  wurde. Eine Person kann höchstens 3 aktive Links besitzen.

Google Kalender holt den Link von den Servern von Google ab, sodass er dort nur funktioniert, wenn
Kept vom Internet aus erreichbar ist.
