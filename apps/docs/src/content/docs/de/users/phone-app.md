---
title: Kept auf dem Handy
description: Kept auf dem Home-Bildschirm installieren, was ohne Verbindung funktioniert, wie Synchronisierung und Konflikte aussehen, die Kamera, die App-Sperre und Benachrichtigungen.
---

Kept hat keine App-Store-App. Es ist eine Web-App, die du aus dem Browser installierst (eine PWA): sie öffnet sich über ein eigenes Symbol, im Vollbild, speichert eine Kopie deines Inventars auf dem Telefon und funktioniert offline. Alles auf dieser Seite braucht Kept über **HTTPS**: über normales HTTP blockieren Telefone Kamera, Installation, Push-Benachrichtigungen und Standort ([HTTPS](/de/install/https/)).

## Installieren

**Auf dem Handy installieren** in der Checkliste auf Home und **Hilfe → Auf dem Handy installieren** zeigen die Schritte für dein Gerät:

| Gerät | Schritte |
|---|---|
| iPhone, iPad | In Safari tippe auf **Teilen**, dann **Zum Home-Bildschirm hinzufügen**, dann **Hinzufügen**. Öffne Kept über das neue Symbol. |
| Android | Öffne das Menü des Browsers (die drei Punkte), tippe auf **App installieren** oder **Zum Home-Bildschirm hinzufügen** und öffne Kept über das neue Symbol. |
| Computer | In Chrome oder Edge das Installationssymbol am Ende der Adressleiste oder **Kept installieren** im Menü. In Safari auf dem Mac **Ablage › Zum Dock hinzufügen**. |

Der Checklistenpunkt setzt sich selbst, sobald du Kept zum ersten Mal über das Symbol öffnest. Wenn eine neue Version bereit ist, zeigt Kept **Eine neue Version ist bereit** mit **Neu laden**; es lädt sich niemals von selbst neu, solange gerade etwas hochgeladen wird oder eine Erfassung geöffnet ist.

## Was offline funktioniert

Das Telefon speichert eine Kopie jedes Standorts, zu dem du gehörst, und aktualisiert sie bei jeder Synchronisierung. Offline-Antworten geben **zum Stand der letzten Synchronisierung** und die Uhrzeit an.

| Funktioniert offline | Braucht eine Verbindung |
|---|---|
| Standorte, Räume, Boxen und Dinge durchsuchen | Details eines Dings bearbeiten, Einstellungen, Verwaltung |
| Suche, beschriftet **Auf diesem Telefon** | Der Assistent und KI-Benennung |
| Erfassen, verschieben, als gesehen markieren, nicht hier | Importe, Exporte und Berichte |
| Messung protokollieren, Raum oder Platz hinzufügen | Service protokollieren (enthält Geldbeträge) |
| Boxkontrolle, für eine Box, die einmal online geöffnet wurde | Alles mit Geldbeträgen oder geheimen Werten |
| Label scannen, leeres Label beanspruchen | |

Die Kopie enthält niemals geheime Werte oder Kontaktangaben von Personen. Geldbeträge und Dokumente bleiben vom Telefon fern, es sei denn, du hältst einen Standort offline hinter der App-Sperre (unten). Beim Abmelden wird die Kopie dieser Person vom Telefon entfernt.

## Synchronisierung, wie du sie siehst

Was du offline tust, landet in einer Warteschlange und wird gesendet, sobald das Telefon wieder online ist. Eine Zeile unter dem Kopfbereich erscheint nur, wenn etwas mitzuteilen ist:

- **Offline, 12 warten auf Sync**, oder **Offline, zum Stand des letzten Syncs, 14:02**.
- Neue Dinge zeigen **ID ausstehend**, bis der Server ihnen ihre Kurz-ID gibt; ihre Labels können gedruckt werden, sobald sie angekommen ist (Labels bietet **Ausstehende Labels drucken**).
- **Auf dem iPhone bewegt sich die Warteschlange nur, solange Kept geöffnet ist**: die Zeile zeigt **Öffnen, um Synchronisierung abzuschließen (12)**. Lass Kept einen Moment geöffnet auf dem Bildschirm, wenn du wieder online bist.
- **Kept aktualisieren, um Synchronisierung abzuschließen** bedeutet, dass der Server neuer ist als die App: neu laden. Die Warteschlange bleibt erhalten.
- **Dieser Browser kann Kepts Offline-Kopie nach wochenlanger Nichtbenutzung löschen**: das Telefon hat Kept keinen dauerhaften Speicher gegeben. Öffne Kept ab und zu, damit es synchronisiert.

**Wenn eine Änderung nicht angewendet werden kann.** Wenn jemand anderes ein Ding gelöscht, verschoben oder entfernt hat, während du offline warst, wird deine Änderung daran verworfen und die Zeile sagt das, zum Beispiel "Eine Änderung konnte nicht angewendet werden: Der Bohrer wurde von Alfred gelöscht", mit **Wiederherstellen**, um es erneut zu versuchen. Andere Änderungen, die eine Entscheidung brauchen, landen im **Eingang** ("2 Änderungen brauchen einen Blick").

**Wenn ihr beide dasselbe Ding online bearbeitet**, führt Kept die Felder zusammen, die nur einer von euch geändert hat, und fragt nach dem Rest: **Meine Version behalten**, **Andere Version behalten** oder **Bearbeiten**.

**Beim Abmelden mit ungesendeten Erfassungen** wirst du zuerst gewarnt: Das Abmelden löscht Erfassungen, die noch nicht synchronisiert sind. Wenn deine Sitzung abläuft, gibt das Telefon seine Kopie deines Inventars frei, behält aber deine ungesendeten Erfassungen gesperrt, bis du dich wieder anmeldest. Wenn sich jemand anderes an diesem Telefon anmeldet, sagt Kept, wie viele Erfassungen von einem anderen Konto warten, und löscht sie erst, wenn diese Person zustimmt.

## Kamera, Galerie und Scannen

- **Erfassen** hält die Kamera für einen Schuss nach dem anderen offen. **Galerie** wählt mehrere Fotos auf einmal aus; jedes wird zu einem Entwurf. Wenn die Kamera blockiert ist, sagt Kept, wie du sie freigibst, und bei normalem HTTP fällt Erfassen auf die Dateiauswahl zurück.
- iPhone-Fotos im HEIC-Format werden als Originale behalten; wenn eines nicht vorschaubar ist, steht **Vorschau nicht verfügbar** dabei und es wird niemals abgelehnt.
- **An Kept teilen**: auf Android und in Chrome auf dem Desktop erscheint die installierte App im Teilen-Menü, sodass eine Quittung oder ein PDF aus einer anderen App in Erfassen landet. Das iPhone lässt Web-Apps nicht im Teilen-Menü erscheinen: speichere die Datei und benutze dann **Galerie** in Erfassen.
- **Scannen** liest Kept-Labels und Produkt-Barcodes, auch offline, aus der Kopie auf dem Telefon, sowie Data Matrix-, Code 39-, Code 93-, ITF-, Codabar-, PDF417- und Aztec-Codes; eine Seriennummer oder Bestandsnummer öffnet ihr Ding, wenn du online bist. Die vollständige Liste: [Kurz-IDs und Labels](/de/users/everyday-use/#kurz-ids-und-etiketten).
- **Vorschlagen, wo ich bin**, ein Schalter im Ortsauswähler von Erfassen, vergleicht deine Position mit den Positionen deiner Standorte direkt auf dem Telefon und schlägt den vor, an dem du bist: höchstens 150 m von seiner Position, bei zweien den näheren. Deine Position wird nie gesendet oder gespeichert. Ein Eigentümer oder Admin legt die Position eines Standorts in **Standorteinstellungen → Allgemein → Position** fest ([Seine Position](/de/users/locations/#seine-position)); ein Standort ohne Position wird nie vorgeschlagen.
- **Diktieren** füllt den Namen per Stimme, wo der Browser das unterstützt.

**Einstellungen → Diagnose** prüft Kamera, Offline-Unterstützung und Speicher und kopiert einen Bericht über das, was gefunden wurde.

## Die App-Sperre

**Einstellungen → Dieses Gerät → App-Sperre** sperrt Kept auf diesem Telefon mit einer PIN von 6 bis 12 Ziffern und mit **Mit Face ID oder Fingerabdruck entsperren**, wo das Telefon dich verifizieren kann. Mit aktivierter Sperre fragt Kept beim Kaltstart und nach 5 Minuten Ausblenden oder Inaktivität, online oder offline.

Face ID oder Fingerabdruck entsperrt hier Kept nur auf diesem Gerät; er meldet dich nie an. Um dich mit Face ID oder Fingerabdruck anzumelden, füge einen Passkey in [Anmeldung und Sicherheit](/de/users/sign-in-security/) hinzu.

- Zehn falsche PINs hintereinander entfernen Kepts Kopie von diesem Telefon und melden dich ab, wobei deine eigenen ungesendeten Erfassungen erhalten bleiben. **Vergessen? Abmelden und neu anmelden** macht dasselbe.
- Die Sperre hält jemanden fern, der das Telefon in der Hand hat. Sie hält nicht jemanden auf, der den Speicher des Browsers kopiert hat, beim Ausprobieren von PINs; die Einstellungsseite sagt das.

**Offline verfügbar halten**, auf derselben Seite, fügt die Preise und Dokumente eines Standorts zur Kopie auf dem Telefon hinzu, verschlüsselt hinter der Sperre. Es braucht die App-Sperre aktiv, zeigt zuerst die Downloadgröße und warnt, dass jeder, der Kept auf dem Telefon entsperrt, sie sieht. Ein Gerät behält so höchstens 250 MB, mit Dateien bis zu 25 MB je.

## Benachrichtigungen

In **Einstellungen → Profil → Benachrichtigungen**, unter **Dieses Gerät**, schaltet **Aktivieren** Push ein: Erinnerungen tauchen auf, auch wenn Kept geschlossen ist. **Testen** sendet eine, um es zu prüfen.

- **iPhone und iPad** liefern Push nur an die installierte App: füge Kept zum Home-Bildschirm hinzu, öffne es von dort und aktiviere es. Bis dahin können Erinnerungen per E-Mail kommen.
- Push braucht HTTPS. Wenn der Server keine Möglichkeit hat, Push zu senden, oder der Browser ihn nicht empfangen kann, sagt die Seite das; E-Mail und das Benachrichtigungscenter funktionieren weiterhin.
- Ruhezeiten halten Push und E-Mail zurück, bis sie enden. Was jeder Standort sendet und wie, wird in [alltäglicher Nutzung](/de/users/everyday-use/#erinnerungen-und-benachrichtigungen) behandelt.
