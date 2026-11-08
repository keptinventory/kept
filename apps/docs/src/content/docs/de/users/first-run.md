---
title: Deine ersten Minuten
description: Richte mit dem Einrichtungscode ein neues Kept ein, erstelle dein erstes Zuhause, füge Gegenstände hinzu, lade jemanden ein und wähle Sprache und Design.
---

Diese Seite beginnt, sobald Kept läuft und du die Adresse öffnen kannst. Die Installation ist hier beschrieben:
[Installation mit Docker Compose](/de/install/compose/).

## 1. Server mit dem Einrichtungscode beanspruchen

Wenn Kept zum ersten Mal ohne Admin startet, gibt es einen einmaligen Einrichtungscode in den Logs aus, als
`KEPT SETUP CODE: K7Q-2M9`. Die Adresse von Kept zu öffnen führt dich zu **Diese Kept-Instanz einrichten**, in drei Schritten:

1. **Einrichtungscode.** Gib die sechs Zeichen ein. Der Bindestrich ist optional und Groß- und Kleinschreibung spielt keine Rolle. Der Code
   funktioniert nicht mehr, sobald er verwendet wurde. Logs verloren? `kept admin setup-code` stellt einen neuen aus
   ([so geht's unter Compose](/de/install/compose/#3-einrichtung-abschließen)).
2. **Erstes Konto.** Dein Name, deine E-Mail-Adresse und ein Passwort mit mindestens 8 Zeichen. Dieses Konto ist der
   **Instanzadministrator**: es betreibt den Server (Benutzer, Registrierung, Backups). Es kann nicht in jemandes
   Zuhause sehen, es sei denn, es wird eingeladen.
3. **Instanzoptionen.** Ein Schalter: **Jedem mit der Adresse erlauben, ein Konto zu erstellen**. Lass ihn für einen Haushalt
   aus: Leute treten über eine Einladung bei, oder du fügst sie hinzu. Du kannst ihn später in
   Einstellungen → Admin ändern.

**Einrichtung abschließen** bringt dich zu Home.

:::caution[Schließe es sofort ab]
Bis die Einrichtung abgeschlossen ist, könnte jeder, der die Adresse öffnen kann, versuchen, den Server zu beanspruchen.
:::

KI und das Nachschlagen von Barcodes sind nicht Teil der Einrichtung. Kept funktioniert ohne sie, und du kannst die KI später verbinden
([KI-Anbieter](/de/users/ai-providers/)).

## 2. Lies die Checkliste „Erste Schritte“ auf Home

Home öffnet mit **Erste Schritte**, einer Zeile mit deinem Fortschritt und dem nächsten Schritt, ausgerechnet aus dem, was du
wirklich gemacht hast, sodass Schritte sich selbst abhaken. Der Pfeil öffnet die Schritte:

| Schritt | Was es fragt |
|---|---|
| **Kept auf HTTPS umstellen** | Wird dem Instanzadministrator angezeigt, solange Kept über einfaches HTTP ausgeliefert wird. Telefone blockieren die Kamera, das Installieren von Kept, Push-Benachrichtigungen und Standort über HTTP. Siehe [HTTPS](/de/install/https/). |
| **Dein erstes Zuhause erstellen** | Ein Standort, weiter unten. |
| **3 Gegenstände hinzufügen** | Ein paar, die du auf keinen Fall aus den Augen verlieren willst. |
| **Drucke dein erstes Etikett** | Wenn Etiketten in einem Standort aktiv ist. |
| **Jemanden einladen** | Ein Link oder ein QR-Code; niemand braucht eine E-Mail. |
| **KI-Anbieter verbinden** | Wird eingeladenen Mitgliedern nicht angezeigt oder in einem Standort mit dem Basis-Preset. |
| **Auf dem Handy installieren** | Hakt sich selbst ab, wenn du Kept zum ersten Mal über das Symbol auf dem Startbildschirm öffnest. |

**×** blendet sie dauerhaft aus; **Hilfe → Checkliste „Erste Schritte“ → Wieder anzeigen** zeigt sie wieder an. Sie verschwindet von selbst, wenn jeder Schritt erledigt ist. Mehr zu Home in [alltäglicher Nutzung](/de/users/everyday-use/#startseite).

## 3. Erstelle dein erstes Zuhause

Jeder hat von Anfang an den Standort **Persönlich**: er gehört dir allein (keine Mitglieder, Einladungen oder
Teilen-Links) und dort landet eine Erfassung ohne Standort. Benenne ihn unter **Standorteinstellungen →
Allgemein** um, und Kept zeigt den neuen Namen überall. Sobald du einen weiteren Standort hast, kannst du ihn
[verbergen](/de/users/locations/#persönlich-ausblenden) unter **Einstellungen → Profil → Deine Standorte**. Gemeinsame Gegenstände gehören in
einen eigenen Standort. Wähle **Dein erstes Zuhause erstellen** (oder **Neuer Standort** auf Home):

1. **Wie heißt dieser Standort?** Ein Name, wie Home oder Garage, und seine Art: Haus, Wohnung,
   Garage, Lagereinheit, Büro, Ferienhaus oder Sonstiges.
2. **Räume.** Die Vorlage der Art füllt Räume und Plätze; umbenennen, entfernen oder **Raum oder Platz hinzufügen**.
   Jeder Standort hat auch **Ohne Ort** für Gegenstände, die noch keinen Platz haben. **Überspringen** behält nur
   Ohne Ort.
3. **Was erfasst wird.** Drei Voreinstellungen:
   - **Basis**: Gegenstände finden: Räume, Boxen, Etiketten und Suche.
   - **Haushalt**: ergänzt Quittungen und Garantien, Erinnerungen, Ausleihen, Unterlagen und Fahrzeuge.
   - **Erledigen**: ergänzt Kraftstoff, Gegenstände, die zur Neige gehen, Passwörter und Codes, Umzug und
     "ChatGPT oder Claude verbinden".

Zeitzone und Währung kommen aus deinem Browser. Ändere sie und schalte einzelne Module ein oder aus in den
Standorteinstellungen des Standorts (**Allgemein** und **Was erfasst wird**). Ein Modul auszuschalten
blendet es aus; nichts wird gelöscht.

## 4. Füge deinen ersten Gegenstand hinzu

Der schnellste Weg ist **Erfassen**, der mittlere Tab auf dem Handy: richte die Kamera aus, drücke den Auslöser, und
der Gegenstand wird dort gespeichert, wo der Ortschip oben steht. Ein Name ist beim Erfassen optional:
mit einem verbundenen KI-Anbieter benennt Kept ihn anhand des Fotos; ohne einen warten unbenannte Gegenstände im
**Eingang** auf einen Namen. Auf einem Computer fügt **Hier hinzufügen** auf einem Raum oder einer Box über ein Formular einen Gegenstand hinzu.
[Alltägliche Nutzung](/de/users/everyday-use/) deckt Erfassen, Etiketten und den Rest ab.

## 5. Leute einladen

Teilen geschieht pro Standort: jemand, den du zu Home einlädst, sieht Home und sonst nichts von dir.
Nachdem du einen Standort erstellt hast, zeigt Home eine **Leute zu … einladen**-Karte; dieselbe Seite ist unter
**Standorteinstellungen → Mitglieder → Einladen**.

1. Wähle die **Rolle** und unter **Zugriff** **Kein Enddatum** oder **Bis zu einem Datum**. Ihr Zugriff und
   alle Token, die sie erstellen, enden an diesem Datum.
2. **Einladungslink erstellen.** Du erhältst den Link mit **Link kopieren** und einen QR-Code zum Scannen mit ihrem
   Handy. Der Link funktioniert einmalig, 7 Tage lang, und wird unter Mitglieder als ausstehende Einladung angezeigt, bis er
   verwendet wurde; dort kannst du ihn widerrufen.
3. **Per E-Mail senden** funktioniert nur, wenn der Server E-Mail eingerichtet hat (`KEPT_SMTP_URL`).

Die Person öffnet den Link und tritt dann mit ihrem Konto bei oder erstellt eines; solange die Registrierung geschlossen ist,
ist die Einladung der einzige Weg, ein Konto zu erstellen.

### Die Rollen

| Rolle | Was sie in diesem Standort können |
|---|---|
| **Eigentümer** | Alles, einschließlich Zwei-Faktor-Regeln, Übertragung und Löschung. Es gibt einen Eigentümer. |
| **Admin** | Mitglieder und Betrachter einladen und entfernen, Einstellungen und Module, Import und Export, Teilen-Links und Claim-Packs, dauerhaft löschen. Nur der Eigentümer erteilt oder entfernt Admins. |
| **Mitglied** | Gegenstände hinzufügen, bearbeiten, verschieben, ausleihen und in den Papierkorb legen; Messwerte und Serviceeinträge protokollieren; Etiketten drucken; KI-Erfassung nutzen. Geld ist sichtbar. |
| **Betrachter** | Nur anschauen und suchen. Geld ist verborgen, es sei denn, der Standort erlaubt Betrachtern, es zu sehen; der Assistent antwortet, kann aber nichts ändern. |

Die vollständige Matrix ist `MATRIX` in
[`packages/shared/src/roles.ts`](https://github.com/keptinventory/kept/blob/main/packages/shared/src/roles.ts).

### Personen ohne E-Mail

Für ein Kind oder ein Elternteil ohne E-Mail verwendet ein Eigentümer oder Admin **Person ohne E-Mail hinzufügen** auf der
Mitglieder-Seite. Kept erstellt ein **verwaltetes Konto** mit einem Benutzernamen und zeigt einen Einmalcode (er funktioniert
einmalig, für 30 Minuten). Die Person meldet sich mit **Ich habe einen Einmalcode**, ihrem Benutzernamen und dem
Code an und wählt ihr eigenes Passwort; du siehst es nie. Wer das Konto erstellt hat (solange er dort noch
Eigentümer oder Admin ist) oder der Eigentümer dieses Standorts können später einen neuen Code ausstellen, der das
Konto überall abmeldet. Die Person kann eine E-Mail hinzufügen, um das Konto zu übernehmen. Ein verwaltetes Konto kann keinen Standort besitzen, und ein Standort
nimmt höchstens 20 davon auf.

## 6. Sprache und Design

**Einstellungen → Profil → Anzeige** enthält die Anzeigeoptionen des Geräts, die angewendet werden, bevor die Seite gezeichnet wird:

- **Sprache**: العربية, Deutsch, English, Español, Français, Italiano, Українська oder Tiếng Việt.
  Öffne die Liste oder tippe, um eine zu finden: ihren eigenen Namen, ihren Namen auf Englisch oder in der Sprache, die du
  verwendest, und kleine Tippfehler sind in Ordnung (`german`, `deutsch` und `francais` funktionieren alle). Arabisch legt die ganze App von rechts
  nach links aus. Die Anmeldeseiten haben denselben Auswähler. Bis du eine wählst, folgt Kept der Sprache des Browsers. E-Mails und Erinnerungen folgen der Sprache, die du zuletzt gewählt hast.
- **Ziffern auf Arabisch**: Westlich (0123) oder Östlich (٠١٢٣), nur angezeigt, während die Sprache Arabisch ist.
  Kurze IDs und Seriennummern bleiben immer bei westlichen Ziffern.
- **Region**: **Vereinigte Staaten** (Oct 29) oder **Vereinigtes Königreich** (29 Oct, 29/10/2026), nur angezeigt, während die Sprache
  Englisch ist.
- **Beträge** werden so gelesen, wie deine Sprache sie schreibt. Wo das Komma das Dezimalzeichen ist,
  wie im Deutschen, ist `1.234` eintausendzweihundertvierunddreißig und `12,50` zwölfeinhalb. Ein
  Betrag, der sich auf zwei Arten lesen lässt, etwa `0.125`, wird abgelehnt statt geraten.
- **Datumsformat**: **Standard** (29 Oct, mit dem Jahr nur für andere Jahre), 29 Oct 2026,
  29/10/2026 oder 2026-10-29 (so, wie das Vereinigte Königreich sie schreibt). Jede Wahl zeigt das heutige Datum
  auf diese Weise, in deiner Region. Kauf- und
  Garantiedaten zeigen immer das Jahr.
- **Design**: **System** (folgt der hellen oder dunklen Einstellung des Geräts), **Hell** oder **Dunkel**.
- **Inhaltsbreite**: **Zentriert** oder **Volle Breite**, auf Bildschirmen 768 px und breiter.

## 7. Eine Tour machen

**Hilfe → Die Tour** führt dich durch Kept auf den echten Bildschirmen, in kurzen Kapiteln mit drei bis sechs
Schritten:

| Kapitel | Was es zeigt |
|---|---|
| Grundlagen | Home, deine Standorte, Scan, Suche und wo alles andere ist |
| Gegenstände & Plätze | zu einem Standort hinzufügen, was darin ist, und die Seite eines Gegenstands sowie ihre Tabs |
| Graph & 3D-Karte | die Liste · Raster · Graph · Tabelle · Karte umschalten (Tabelle am Computer), der Graph in 2D oder 3D, 3D oder Grundriss, Pins, Etagen und Anordnen, wo ein Raum sich mit dem mitbewegt, was darin ist |
| Erfassen & Eingang | auswählen, was du erfasst, den Auslöser und das Überprüfen dessen, was Kept gelesen hat |
| Scannen | eine Scan-Sitzung: zählen, packen oder verschieben, wo, und was Beenden ändert |
| Suche & Etiketten | das Suchfeld, gespeicherte Ansichten, Auswählen (verschieben, Etiketten drucken, In den Papierkorb verschieben), Etiketten drucken und Scannen, womit du ein leeres Etikett auf einen Ort, den du hast, setzen kannst |
| Umzug | einen Umzug starten, seine Boxen und wo sie sind |
| Ausleihen | was ausgeliehen ist, Zurückgegeben markieren und Ausleihen an einem Gegenstand |
| Zeitpläne & Erinnerungen | ein neuer Zeitplan, was fällig ist, Erledigen und wie Erinnerungen dich erreichen |
| Unterlagen & Garantien | die Unterlagenbibliothek, was abläuft, eine Datei hinzufügen, Schadensfälle |
| Fahrzeuge & Kraftstoff | die Fahrzeugliste, das Protokollieren eines Messwerts oder einer Wartung, die Wartungen, die du öffnen kannst, und Kraftstoff |
| Import & Export | woher ein Import kommt, die Datei und das Exportieren |
| Einstellungen & Teilen | Benachrichtigungen, deine Standorte, Leute einladen, was erfasst wird |

Nur die Kapitel, die du hast, sind aufgelistet: Ein Kapitel eines Moduls wird angezeigt, solange es in einem deiner
Standorte eingeschaltet ist, und ein Betrachter bekommt keine Schritte, die etwas ändern.

- **Oben:** wie viele Kapitel erledigt sind, mit einem dünnen Balken, und **Tour starten**. Sobald einige erledigt sind, steht dort **Tour fortsetzen** und es geht mit dem ersten Kapitel weiter, das du noch nicht abgeschlossen hast.
- **Darunter:** eine kurze Zeile pro Kapitel mit Nummer und Schritten. Tippe auf eine Zeile, um die Tour mit
  diesem Kapitel zu starten. Erledigte Kapitel klappen unter **Erledigt (N)** weg; öffne es, um eines wiederzugeben.
- Die Tour startet aus der Hilfe. Die obere Leiste einer Seite behält ihre eigenen Werkzeuge; das **Sitzung starten** einer
  Scan-Sitzung hat ein kleines **Zeig es mir** für sein Kapitel.
- Das Popover zeigt, wo du bist: "Kapitel 3 von 12 · Schritt 2 von 5".
- **Weiter** geht voran, **Zurück** geht im Kapitel zurück, die Pfeiltasten machen beides, und **Esc**
  oder **×** schließt es.
- Ein letzter Schritt eines Kapitels nennt das nächste: **Weiter** führt direkt hinein, **Hier aufhören**
  beendet die Tour dort. Das letzte Kapitel endet mit **Erledigt**.
- Die Seite funktioniert noch, während die Tour läuft: tippe außerhalb der Hervorhebung. Irgendwohin zu gehen,
  das die Tour nicht geöffnet hat, schließt sie.
- Ein abgeschlossenes Kapitel sagt **Erledigt** auf Hilfe, auf jedem Gerät. Ein Kapitel, das du auf halbem Weg schließt, startet
  beim nächsten Mal mit seinem ersten Schritt.
- Ein Kapitel, das etwas zum Zeigen braucht und nichts findet, erstellt ein eindeutig benanntes Muster, wie
  "Sample: Cordless drill". Wenn die Tour endet, wählst du, ob du es behalten oder verwerfen willst; es berührt nie,
  was du schon hast.
- Die Tour startet nie von selbst.

Ein paar einmalige Hinweise erscheinen auch beim ersten Mal, wenn du Erfassen, Scannen, die vorgeschlagenen Werte des Eingangs
oder Etiketten verwendest.

Nach dem Aktualisieren von Kept zeigt **Neu in Kept** die Highlights dieser Version, einmal pro Version
für jede Person, auf jedem Gerät: eins pro Slide, mit einem Bild oder einem kurzen Clip, seinem Titel und einer
Zeile. **Weiter** und **Zurück**, die Punkte, die Pfeiltasten oder ein Wischen bewegen zwischen ihnen; das **Verstanden**
der letzten Slide legt es weg, und **Hilfe → Was ist neu** zeigt es wieder an. Clips spielen stumm und
können pausiert werden; wenn reduzierte Bewegung eingeschaltet ist, bleiben sie unbewegt, bis du auf **Abspielen** drückst. Offline
zeigt ein Slide anstelle seines Bildes das Symbol seines Abschnitts. Es wird nie auf einem neuen Konto oder über
Erfassen oder Scannen angezeigt. Die Highlights sind in jeder Sprache auf Englisch, mit einem Link zu den vollständigen Release-Notes
auf GitHub.

:::tip[Bewahre die Schlüssel auf]
Bevor der erste KI-Schlüssel, geheime Wert oder Backup, Kept wartet, bis der Instanzadministrator die
[Wiederherstellungs-Kit](/de/admin/recovery-kit/) gespeichert hat (Admin → Status fragt danach). Ohne das Kit kann ein Backup
KI-Schlüssel oder gespeicherte Passwörter auf einem neuen Server nicht wiederherstellen.
:::
