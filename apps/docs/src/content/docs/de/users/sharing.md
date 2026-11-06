---
title: Einen Standort teilen
description: "Lade Personen mit einer Rolle und einem Enddatum ein, teile Links für schreibgeschützten Zugriff und drucke eine Liste auf Papier aus."
---

Ein Standort wird geteilt, indem Personen dazu eingeladen werden, jeweils mit einer Rolle und einem optionalen Enddatum.
Dein
persönlicher Standort wird niemals geteilt: er hat keine Mitglieder, Einladungen oder Teilen-Links.

Diese Seite behandelt Einladungen, Rollen, geteilte Links und Drucken.

## Personen einladen

Die Karte **Personen einladen zu …** auf Home erscheint nachdem du einen Standort erstellt hast.
Die gleiche Seite befindet sich unter **Standorteinstellungen → Mitglieder → Einladen**.

1. Wähle die **Rolle**, und unter **Zugriff** entweder **Kein Enddatum** oder **Bis zu einem Datum**. Ihr
   Zugriff endet an diesem Datum, und alle Tokens, die sie für die API erstellt haben, hören damit auf.
2. **Einladungslink erstellen**. Der Link funktioniert einmalig für 7 Tage. Zeige den QR-Code zum Scannen mit ihrem
   Telefon an, oder kopiere den Link. Eine ausstehende Einladung wird unter **Mitglieder** angezeigt, bis sie verwendet wird, und du kannst
   sie dort widerrufen.
3. **Per E-Mail senden** funktioniert nur, wenn der Server E-Mail eingerichtet hat.

Jemand ohne E-Mail-Adresse kann trotzdem ein Konto erhalten: Eigentümer und Administratoren fügen eines hinzu über
**Standorteinstellungen → Mitglieder → Person ohne E-Mail hinzufügen**. Es wird zu einem verwalteten Konto — Kept
erstellt eine Adresse dafür, die keine E-Mails empfangen kann, legt sein Passwort mit einem Rücksetzungscode fest, und der
Eigentümer wird über jedes neue Konto informiert.

Jeder außer dem Eigentümer kann **Diesen Standort verlassen**. Ein Instanz-Administrator kann kein Innere eines Standorts sehen,
es sei denn, er wurde dazu eingeladen.

## Rollen

| Rolle | Was sie in diesem Standort tun können |
|---|---|
| **Eigentümer** | Alles, einschließlich Zwei-Faktor-Regeln, Übertragung und Löschung. Es gibt einen Eigentümer. |
| **Administrator** | Einladen und entfernen von Mitgliedern und Betrachtern, Einstellungen und Module ändern, Import und Export, Teil-Links erstellen und Anspruchspakete beanspruchen, dauerhaft löschen. Nur der Eigentümer kann Administratoren ernennen oder entfernen. |
| **Mitglied** | Hinzufügen, bearbeiten, bewegen, verleihen und löschen von Dingen; Messwerte und Wartungen protokollieren; Etiketten drucken; KI-Erfassung verwenden. Geld ist sichtbar. |
| **Betrachter** | Nur suchen und anschauen. Geld ist versteckt, außer der Standort erlaubt Betrachtern, es zu sehen. Der Assistent antwortet aber kann nichts ändern. |

## Geteilte Links

Geteilte Links zeigen jemandem ohne Konto, was in einer Box, einem Ort oder einer Suche enthalten ist, schreibgeschützt.
Eigentümer und Administratoren erstellen einen wie folgt:

- **Aktionen → Einen Link nur zum Ansehen teilen** einer Box.
- Der Abschnitt **Verwalten** des Ortes.
- **Diese Liste teilen** bei Suche: Eine Suche, gefiltert auf einen Standort, ohne Zustand- oder Preis-Filter.

Wähle, wie lange es funktioniert: ein Tag, eine Woche, 30 Tage (Standard), 90 Tage oder ein Jahr. Der Link
wird einmal angezeigt, also kopiere ihn danach.

### Was sie sehen

Name, Foto, Typ, Standort, Menge, Zustand und Notizen jedes Dings, alphabetisch von A bis Z. Nie Preise,
Seriennummern, geheime Felder, Personen, Leihgaben oder Dokumente. Dinge im Müll, Entwürfe und Dinge,
die du verkauft oder verloren hast, werden nicht angezeigt.

### Es bleibt aktuell

Die Seite zeigt die Box, den Ort oder die Suche wie sie ist, wenn sie geöffnet wird. Der Link einer Suche entspricht ihren Wörtern sowie Ort, Typ und Tag-Filtern.

### Links verwalten

**Standorteinstellungen → Geteilte Links** zeigt jeden Link mit seinem Status und wie oft er geöffnet wurde.

- **Vorschau als Empfänger** zeigt die Seite wie der Empfänger sie sieht.
- **Widerrufen** beendet sie sofort.
- Ein Link endet auch, wenn er abläuft, oder wenn die Person, die ihn erstellt hat, den Standort nicht mehr betreibt.

## Eine Liste drucken

Um jemandem eine Liste auf Papier zu geben, drucke sie. **Inventar drucken** an einem Standort erzeugt ein PDF seiner
Dinge, gruppiert nach Ort, mit Fotos und kurzen IDs. Preise erscheinen nur für Personen, die Geld sehen
können. Wer den Standort sehen kann, kann eines erstellen.

**Per E-Mail an mich** sendet ebenfalls das PDF per E-Mail, sobald es bereit ist, und **Erneut senden** sendet den gesamten
Standort jeden Montag oder am 1. des Monats. Einstellungen → Mein → Benachrichtigungen listet diese auf und
stoppt sie. Ein Bericht über 10 MB wird nicht angehängt: drucke ihn stattdessen aus Kept statt.

## Verwandte

- [Deine ersten Minuten](/de/users/first-run/#5-leute-einladen) zum Einladen von Personen während der Einrichtung.
- [Alltagsnutzung](/de/users/everyday-use/) für das größere Bild.
- [Sets und Übergaben](/de/users/kits/) zum Verleihen von Dingen.
