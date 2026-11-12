---
title: Glossar
description: "Die Wörter, die Kept auf eigene Art verwendet, in einfacher Sprache."
---

Kept verwendet einige Wörter auf eigene Art. Diese Seite erklärt, was jedes bedeutet und wo du mehr lesen kannst.

## A

**Admin**: eine Rolle in einem Standort. Kann Mitglieder und Betrachter einladen und entfernen, Einstellungen und
Module ändern, importieren und exportieren, Freigabelinks und Schadenspakete erstellen und endgültig löschen. Nur der
Eigentümer ernennt oder entfernt Admins. [Die Rollen](/de/users/first-run/#die-rollen)

**KI-Anbieter**: der Dienst, den Kept aufruft, um Gegenstände auf Fotos zu benennen, Belege zu lesen, den
Assistenten zu betreiben und, mit einem Embeddings-Modell, nach Bedeutung zu suchen: Groq, OpenAI, Anthropic, Google,
OpenRouter oder ein OpenAI-kompatibler Server wie Ollama. Du bringst deinen eigenen Schlüssel mit.
[KI-Anbieter](/de/users/ai-providers/)

## B

**Sicherung**: ein nächtlicher restic-Snapshot der Datenbank, der Dateien und einer lesbaren Kopie, verschlüsselt
mit einem Passwort, das du wählst, und an eine andere Festplatte, einen S3-Bucket oder einen SFTP-Server geschickt.
[Sicherungen](/de/admin/backups/)

Kiste: siehe Behälter.

## C

**Erfassen**: das Hinzufügen eines Gegenstands durch ein Foto. Mit einem KI-Anbieter benennt Kept ihn anhand des Fotos;
ohne einen wartet es im Eingang auf einen Namen.

**Schadenspaket**: ein ZIP des Versicherungsberichts mit jedem Beleg, jeder Rechnung, jedem Foto und jeder Seriennummer zu
einem Vorfall, durch einen Download-Link mit dem Versicherer geteilt. [Berichte](/de/users/reports/)

**Fach**: ein Platz in einem Möbelstück, das aus einer Ortsvorlage gemacht ist: ein Würfel, ein Regalbrett oder eine
Schublade, mit eigenem Namen, Etikett und, wenn du magst, eigenem Code. Fächer nebeneinander können zu einem
zusammengelegt und wieder geteilt werden.
[Möbel mit Fächern](/de/users/locations/#möbel-mit-fächern)

**Zustandsprotokoll**: eine Aufzeichnung darüber, wie eine Mietwohnung beim Einzug und beim Auszug war, für einen Streit
um die Kaution. [Zustandsprotokolle](/de/users/condition-reports/)

**Verbrauchsmaterial**: ein Gegenstand, der nach Menge gezählt wird, z. B. Schrauben, Öl oder Batterien, mit einem
Minimum, das eine Erinnerung bei niedrigem Bestand auslöst. Ein Service kann einen **Aus dem Vorrat** nehmen.

**Behälter**: ein Gegenstand, der andere Gegenstände hält, z. B. eine Kiste oder eine Tasche. Behälter lassen sich
verschachteln, eine Kiste in einer Kiste auf einem Regal. Ein Behälter ist ein Gegenstand, kein Ort.

**Zählen**: einen Ort zählen oder eine Kiste gegen das prüfen, was Kept dort erwartet. Jedes Zählen wird behalten, mit
dem, was gefunden wurde, und was fehlte. Auch als Bestandsaufnahme bezeichnet.
[Zählen und Bestandsaufnahmen](/de/users/counts/)

## D

**Entwurf**: ein Ding, das Erfassen ohne Namen gespeichert hat und das noch nicht übernommen ist. Es wartet im Eingang, bis es übernommen oder verworfen wird. [Erfassen und der Eingang](/de/users/everyday-use/#erfassen-und-der-eingang)

## F

**Möbel**: eine Ortsart für Aufbewahrungsmöbel, die mit ihren Fächern in einem Schritt hinzugefügt wird: ein
Würfelregal, ein Bücherregal, eine Kommode. Möbel, die auf der Karte eingezeichnet sind, z. B. ein Schreibtisch, sind
stattdessen ein Gegenstand mit einer Form. [Möbel mit Fächern](/de/users/locations/#möbel-mit-fächern)

## G

**Graph**: eines der Layouts eines Standorts: seine Etagen, Räume, Kisten und Gegenstände als Knoten und Verbindungen, in
2D oder 3D, mit Markierungen für das, was Aufmerksamkeit braucht. [Der Graph](/de/users/graph/)

## H

**Übergabe**: eine Kiste mit allem Inhalt verleihen: ein Datensatz mit einer Zeile für die Kiste und einer für jeden
Gegenstand darin, jeder kommt einzeln zurück. [Kits und Übergaben](/de/users/kits/)

## I

**Eingang**: wo Gegenstände auf dich warten: Erfassungen ohne Namen, was die KI gelesen hat und angesehen werden muss,
Belege aus E-Mail-Eingang, Zählerstände, die seltsam aussehen, und Telefonänderungen, die eine Entscheidung brauchen.

**Vorfall**: ein Einbruch, Brand, Überschwemmung oder Verlust mit den betroffenen Gegenständen.
[Berichte](/de/users/reports/#vorfälle-und-schadenpakete)

**Instanz**: ein laufender Kept-Server mit seinen Konten und Standorten.

**Instanz-Admin**: eine Person, die den Server betreibt: Benutzer, Anmeldung, Sicherungen. Ein Instanz-Admin kann nicht
in einen Standort hineinsehen, wenn er nicht eingeladen ist.

**Versicherungsbericht**: ein PDF und eine CSV mit jedem Gegenstand samt Foto, Marke, Modell, Seriennummer, Kaufdatum,
Preis, aktuellem Wert und Belegen, mit Summen pro Ort und pro Währung.
[Berichte](/de/users/reports/#versicherungsbericht)

## K

**Kit**: ein Behälter mit einer Stückliste dessen, was hineingehören sollte. Nimmst du ein Teil heraus, verleihst oder
verlierst es, weiß das Kit trotzdem Bescheid. [Kits und Übergaben](/de/users/kits/#sets)

## L

**Etikettenmaterial**: worauf Etiketten gedruckt werden: ein A4- oder Letter-Bogen, eine Etikettendrucker-Rolle oder
Etikettiergerät-Band. Schmales Band (9 und 12 mm) hat keinen Platz für einen QR-Code; **Scannen** liest stattdessen die
gedruckte Kurz-ID. [Drucken](/de/users/short-ids/#drucken)

**Layout**: wie die Seite eines Standorts dessen Inhalt zeigt: **Liste**, **Raster**, **Graph**, **Tabelle** (am Computer)
oder **Karte**. Kept merkt sich die Wahl pro Standort auf jedem Gerät.
[Standorte, Räume und Kisten](/de/users/locations/)

**Verleihen**: festhalten, dass ein Gegenstand oder ein Teil einer Menge bei jemandem ist, mit Fälligkeitsdatum, Zustand
und Fotos.

**Standort**: ein Zuhause, eine Garage, eine Lagerbox, ein Büro oder ein anderer Ort, an dem du Dinge aufbewahrst. Jeder
hat eigene Mitglieder, Rollen, Module, Zeitzone und Währung.

## M

**Verwaltetes Konto**: ein Konto mit Benutzername und ohne E-Mail, für ein Kind oder ein Elternteil, angelegt von einem
Standort-Eigentümer oder einem Admin. Ein Standort hat höchstens 20.
[Personen ohne E-Mail](/de/users/first-run/#personen-ohne-e-mail)

**Karte**: eines der Layouts eines Standorts: der Standort in 3D, Etage für Etage, mit seinen Räumen, Regalen und Kisten,
die Mitglieder und höher anordnen. [Die Standortkarte](/de/users/location-map/)

**MCP** (Model Context Protocol): wie eine KI-App wie Claude mit Kept verbunden wird, um Gegenstände zu finden und zu
ändern, innerhalb deiner Rolle. [Einen KI-Client verbinden](/de/users/mcp-clients/)

**Zähler**: Zählerstände, Services und Zeitpläne für einen Gegenstand, dessen Typ einen Zähler hat: ein Auto, ein
Generator, ein Boiler. [Fahrzeuge und Maschinen](/de/users/vehicles/)

**Mitglied**: eine Rolle in einem Standort. Kann Gegenstände hinzufügen, bearbeiten, verschieben, verleihen und wegwerfen,
Zählerstände und Services erfassen, Etiketten drucken und KI-Erfassung nutzen. Geld ist sichtbar.

**Modul**: ein Teil von Kept, der pro Standort ein- oder ausgeschaltet wird, z. B. Verleihen oder Fahrzeuge.
[Module und Voreinstellungen](/de/users/modules/)

## N

**Braucht dich**: die Zähler der Startseite dessen, was Aufmerksamkeit will: Überfällig, Fällig, Läuft ab, Verliehen,
Ungewiss und Niedriger Bestand. [Startseite](/de/users/home/)

## O

**Eigentümer**: die Rolle, die einen Standort hält. Alles, was ein Admin kann, plus Zwei-Faktor-Regeln, Übergabe und
Löschung. Es gibt einen Eigentümer.

## P

**Persönlicher Standort**: dein eigener Standort, mit deinem Konto erstellt. Er wird nie geteilt: keine Mitglieder, keine
Einladungen und keine Freigabelinks. Du kannst ihn [ausblenden](/de/users/locations/#persönlich-ausblenden), sobald du einen anderen
hast.

**Ort**: ein Raum oder ein Platz in einem Standort: eine Etage, ein Raum, ein Regal, eine Schublade. Eine Kiste ist ein
Behälter, kein Ort.

**Ortsvorlage**: Möbel und ihre Fächer als ein Rezept: das Layout (Würfel waagerecht und senkrecht, Regalbretter oder
Schubladen), die Arten, die Namen und ein Code-Muster. Kept hat Würfelregale, ein Bücherregal, eine Kommode und ein
Regalsystem; ein Konto fügt unter **Einstellungen → Konto → Vorlagen → Möbel** eigene hinzu.
[Möbel mit Fächern](/de/users/locations/#möbel-mit-fächern)

**Voreinstellung**: die Menge der Module, mit der ein Standort startet: Essentials, Household oder Complete.
[Module und Voreinstellungen](/de/users/modules/)

## R

**Zählerstand**: der Wert eines Zählers in einem Moment, z. B. ein Kilometerstand oder ein Betriebsstundenzähler.

**Wiederherstellungskit**: die Schlüssel des Servers, das Repository der Sicherung und die Zugangsdaten sowie die
Wiederherstellungsschritte, zum Ausdrucken oder Speichern irgendwo außerhalb des Servers. Ohne es kann eine Sicherung
KI-Schlüssel oder gespeicherte Passwörter nicht zurückbringen. [Das Wiederherstellungskit](/de/admin/recovery-kit/)

**RLS** (zeilenbasierte Sicherheit): die Datenbankregeln, die Standorte voneinander trennen: jede Anfrage sieht nur, was
die angemeldete Person sehen darf. [Zeilenbasierte Sicherheit](/de/developers/rls/)

## S

**Zeitplan**: etwas, das wieder zu tun ist, nach Datum oder nach Zählerstand, z. B. ein Ölwechsel.
[Erinnerungen](/de/users/reminders/)

**Geheimfeld**: ein Feld an einem Gegenstand, z. B. ein WLAN-Passwort oder ein Türcode, verschlüsselt gespeichert und
verborgen, bis jemand mit Berechtigung es zeigt. Jede Anzeige wird protokolliert.

**Freigabelink**: ein schreibgeschützter Link zu dem, was in einer Kiste, einem Ort oder einer Suche ist, für jemanden
ohne Konto. [Freigabelinks](/de/users/sharing/#geteilte-links)

**Kurz-ID**: der sechsstellige Code, den jeder Gegenstand und jeder Ort hat, wie `7KQ-4MZ`, gedruckt auf seinem Etikett.
[Kurz-IDs und Etiketten](/de/users/short-ids/)

**Bestandsaufnahme**: siehe Zählen.

## T

**Band**: das amberfarbene Etikettenband, das ein Code trägt, sobald er ein gedrucktes Etikett hat. Etikettiergerät-Band
ist Etikettenmaterial. [Kurz-IDs und Etiketten](/de/users/short-ids/)

**Gegenstand**: alles, worüber du den Überblick behältst: eine Bohrmaschine, ein Auto, eine Kiste mit Kabeln.

**Papierkorb**: wo weggelegte Gegenstände 30 Tage warten. Mitglieder und höher stellen sie wieder her; Admins löschen sie
endgültig.

## U

**Ohne Ort**: der Platz, den jeder Standort für Gegenstände ohne Ort hat.

## V

**Fahrzeug**: ein Gegenstand, dessen Typ Fahrzeug oder ein Typ darunter ist: ein Auto, ein Motorrad, ein Fahrrad, ein
Generator. Fahrzeuge bekommen Zählerstände, Services und Zeitpläne sowie Kraftstoff bei Complete. Ein Boiler hat Zähler,
ist aber kein Fahrzeug. [Fahrzeuge und Maschinen](/de/users/vehicles/)

**Betrachter**: eine Rolle in einem Standort. Kann nur schauen und suchen. Geld ist versteckt, es sei denn, der Standort
lässt Betrachter es sehen; der Assistent antwortet, kann aber nichts ändern.

## W

**Was ist neu**: die Karte nach einer Aktualisierung von Kept, mit den Highlights dieser Version, einmal pro Person;
**Hilfe** zeigt sie wieder. [Eine Tour machen](/de/users/first-run/#7-eine-tour-machen)

## Verwandtes

- [Deine ersten Minuten](/de/users/first-run/) für den Einstieg.
- [Häufig gestellte Fragen](/de/users/faq/) für übliche Fragen.
