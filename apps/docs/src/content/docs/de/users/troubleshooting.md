---
title: Häufige Probleme
description: "Anmeldung, Synchronisierung, Kamera, Labels, KI und Offline-Nutzung: was du siehst und was zu tun ist."
---

Probleme, die dir bei der Nutzung von Kept begegnen können. Probleme beim Betrieb des Servers findest du unter [Fehlerbehebung](/de/admin/troubleshooting/).

## Anmeldung

### Ich habe mein Passwort vergessen

Auf der Anmeldeseite gib deine E-Mail-Adresse ein und wähle **Passwort vergessen?**. Kept sendet dir einen Link, um ein neues Passwort zu setzen; er funktioniert einmal, eine Stunde lang. Nichts angekommen: prüfe Spam, oder frage die Person, die dein Kept betreibt, ob E-Mail eingerichtet ist. Ohne E-Mail kann ein Instanz-Admin über den Server einen einmaligen Reset-Link mit `kept admin reset-password` ausstellen ([die CLI](/de/admin/cli/)).

Ein verwaltetes Konto (ein Benutzername, keine E-Mail) bekommt stattdessen einen neuen einmaligen Code von der Person, die das Konto erstellt hat, oder vom Standort-Eigentümer ([Personen ohne E-Mail](/de/users/first-run/#personen-ohne-e-mail)).

### Ein Anmeldelink funktioniert nicht

Ein Link aus **Anmeldelink per E-Mail senden** funktioniert einmal, 15 Minuten lang: fordere einen neuen an. Ein Link, der gesendet wurde, bevor dein Kept auf 1.14.0 aktualisiert wurde, funktioniert gar nicht mehr, und ebenso eine Google- oder OIDC-Anmeldung, die vorher gestartet wurde ([Aktualisierungen](/de/admin/upgrades/#anmeldelinks-1140)).

### Mein Passkey funktioniert nicht

- **Passkeys benötigen HTTPS.** Auf einer einfachen `http://`-Adresse bietet der Browser keine ([Kept im Heimnetzwerk](/de/install/home-network/)).
- **Ein Passkey liegt auf dem Gerät, auf dem er erstellt wurde**, oder in deinem Passwortmanager, wenn er synchronisiert ist. Auf einem anderen Gerät meldest du dich auf anderem Weg an (dein Passwort oder **Anmeldelink per E-Mail senden**), und fügst dort in **Einstellungen → Anmeldung und Sicherheit** einen Passkey hinzu.
- **„Dieser Passkey ist keiner, mit dem sich dieses Konto anmeldet“**: der Browser hat etwas anderes angeboten, zum Beispiel die App-Sperre eines Geräts, womit du dich nicht anmelden kannst. Melde dich auf anderem Weg an.

Mehr unter [Anmeldung und Sicherheit](/de/users/sign-in-security/).

### Ich habe mein Telefon oder meine Backup-Codes verloren

Ein Backup-Code ist der zweite Schritt nach deinem Passwort, anstelle des 6-stelligen Codes der Authenticator-App. Jeder funktioniert einmal.

- **Immer noch irgendwo angemeldet:** **Einstellungen → Anmeldung und Sicherheit**. **Neue Backup-Codes** macht zehn neue (die alten funktionieren nicht mehr); **Neu einrichten** überträgt Zwei-Faktor auf ein neues Telefon.
- **Ausgesperrt, ohne Backup-Codes:** frage einen Instanz-Admin. **Zwei-Faktor zurücksetzen** unter **Instanz-Admin → Benutzer** stoppt deinen Authenticator und die Backup-Codes, und du richtest Zwei-Faktor bei deiner nächsten Anmeldung neu ein.

### „Dein Konto wird am … gelöscht“

Du hast das Löschen des Kontos angefordert, und es wartet 30 Tage; bis dahin öffnet in Kept nichts anderes. **Konto behalten** stoppt das Löschen und stellt das Konto so wieder her, wie es war. Siehe [die FAQ](/de/users/faq/#wie-lösche-ich-mein-konto).

## Synchronisierung

### Aufnahmen von meinem Telefon werden nicht angezeigt

Eine Aufnahme wird zuerst auf dem Telefon gespeichert und gesendet, wenn das Telefon synchronisiert.

- **Auf dem iPhone bewegt sich die Warteschlange nur, solange Kept geöffnet ist.** Die Zeile unter dem Header sagt **Öffnen, um die Synchronisierung abzuschließen** mit einer Zahl: Lass Kept einen Moment auf dem Bildschirm, während du online bist.
- **Ohne Namen** wartet eine Aufnahme im **Eingang**. **Fotos zum Prüfen** auf der Startseite zeigt sie.

### Die Suche sagt „Auf diesem Telefon, Stand letzter Synchronisierung“

Die Antwort kam aus der eigenen Kopie des Telefons, weil du offline bist. Verbinde dich neu und ziehe dann zum Aktualisieren nach unten.

### Eine offline gemachte Änderung wurde nicht angewendet

Wenn jemand anderes ein Ding gelöscht, verschoben oder entfernt hat, während du offline warst, wird deine Änderung daran verworfen, und die Zeile sagt das, mit **Wiederherstellen**, um es erneut zu versuchen. Andere Änderungen, die eine Entscheidung brauchen, gehen in den **Eingang**. Siehe [Synchronisierung, wie du sie siehst](/de/users/phone-app/#synchronisierung-wie-du-sie-siehst).

### Die Synchronisierung scheint festzuhängen

- Ziehe zum Aktualisieren nach unten oder schließe Kept und öffne es erneut.
- **Kept aktualisieren, um die Synchronisierung abzuschließen**: der Server ist neuer als die App. Neu laden; die Warteschlange bleibt erhalten.
- Immer noch festgefahren: **Einstellungen → Diagnose** prüft Offline-Unterstützung und Speicher und kopiert einen Bericht. Sende ihn an die Person, die dein Kept betreibt.

## Kamera und Aufnahme

### Die Kamera öffnet sich nicht

Telefone erlauben die Kamera nur auf einer HTTPS-Adresse. Über einfaches `http://` weicht Aufnahme auf die Auswahl von Dateien aus. Die Installation von Kept, die Offline-Nutzung und Push-Benachrichtigungen benötigen ebenfalls HTTPS. Was über einfaches HTTP funktioniert und zwei Wege, zu Hause HTTPS hinzuzufügen: [Kept im Heimnetzwerk](/de/install/home-network/).

Mit HTTPS und trotzdem blockiert, sagt dir Kept, wie du die Kamera im Browser freigibst.

### Die KI hat mein Ding nicht benannt

Ohne KI warten Aufnahmen im **Eingang** auf einen Namen: benenne sie dort, oder siehe [KI](#ki) unten.

### Die KI hat es falsch benannt

Was die KI ausfüllt, ist ein Vorschlag. Öffne das Objekt und korrigiere Name, Marke, Modell oder Typ.

## Etiketten

### Ein Label lässt sich nicht scannen

Stelle sicher, dass das Label flach und gut beleuchtet ist, und reinige die Kamera. **Code eingeben** nimmt die sechs Zeichen unter dem QR-Code, mit oder ohne Bindestrich. Ein abgenutztes Label wird mit dem gleichen Code neu gedruckt ([Kurz-IDs und Labels](/de/users/short-ids/)). Ein Label auf schmalem Etikettendrucker-Band hat keinen QR-Code: halte **Scannen** auf seiner gedruckten Kurz-ID, oder gib sie ein ([einen Code ohne QR-Code scannen](/de/users/short-ids/#scannen-eines-codes-ohne-qr-code)).

Zeigt **Scannen** die Meldung **Kept kann hier nicht scannen**, weil der Scanner nicht gestartet ist, tippe auf **Erneut versuchen**: Kamera und Scanner starten neu, ohne dass du die App schließen musst.

## KI

### „Warten auf einen KI-Anbieter“

Für diesen Standort ist kein Anbieter verbunden. Arbeit in einem Standort wird über den Schlüssel seines Eigentümers bezahlt, daher verbindet der Eigentümer einen in **Einstellungen → KI**, oder ein Instanz-Admin setzt für den Server einen in **Admin → KI**. Mitglieder und Betrachter können für den Standort einer anderen Person keinen verbinden: die Zeile sagt, einen Admin zu fragen. Siehe [KI-Anbieter](/de/users/ai-providers/#wo-der-schlüssel-landet).

### Die KI ist in einem Standort aus

Ein Eigentümer oder Admin hat sie ausgeschaltet: **Standorteinstellungen → Was erfasst wird**, unter **KI in diesem Standort**, der Schalter **KI-Aufnahme und Assistent**. Wenn du sie wieder einschaltest, kommt die KI dort zurück.

### „KI pausiert“

Eine monatliche Grenze wurde erreicht, oder jemand hat **KI pausieren** gewählt. Aufnahmen werden weiter gespeichert; das Benennen wartet und setzt mit KI fort. Wer die Grenze gesetzt hat, bekommt **Jetzt fortsetzen**. Grenzen sind unter **Einstellungen → KI → Erweitert → Limits** ([Limits und Pausieren](/de/users/ai-providers/#limits-und-pausieren)).

### Die KI kostet zu viel

Setze ein monatliches Limit unter **Einstellungen → KI → Erweitert → Limits**, wähle ein günstigeres Modell unter **Erweitert → Modelle**, oder betreibe ein lokales Modell mit [Ollama](/de/admin/ollama/).

## Offline

### Etwas funktioniert nicht offline

Offline arbeiten erfordert, dass Kept von einer HTTPS-Adresse installiert ist. Browsing, Suche und Aufnahme funktionieren ohne Verbindung; das Bearbeiten von Details, der Assistent, Berichte, die Karte, der Graph und alles mit Geld brauchen eine. Die vollständige Liste: [was offline funktioniert](/de/users/phone-app/#was-offline-funktioniert).

## Hilfe erhalten

- **Fragen und Ideen:** [Discussions](https://github.com/keptinventory/kept/discussions)
- **Ein Fehler:** [ein Issue](https://github.com/keptinventory/kept/issues/new/choose), mit dem, was du getan hast, und was du gesehen hast
- **Hilfe auf Discord:** [der Kept-Server](https://discord.gg/g4WCXPfuNv), in #help: ein Problem pro Beitrag, deine Kept-Version und wie du sie betreibst (Docker Compose, Kubernetes), was passiert ist, und Logs mit unkenntlich gemachten Geheimnissen und persönlichen Details
- **Ein Sicherheitsproblem:** privat, niemals in einem öffentlichen Issue ([SECURITY.md](https://github.com/keptinventory/kept/blob/main/SECURITY.md))
