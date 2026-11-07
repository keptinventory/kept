---
title: Einen Standort teilen
description: "Lade Personen mit einer Rolle und einem Enddatum ein, teile Links für schreibgeschützten Zugriff und drucke eine Liste auf Papier aus."
---

Ein Standort wird geteilt, indem Personen dazu eingeladen werden, jeweils mit einer Rolle und einem optionalen Enddatum.
Dein persönlicher Standort wird niemals geteilt: Er hat keine Mitglieder, Einladungen oder geteilten Links.

Diese Seite behandelt Einladungen, Rollen, geteilte Links und Drucken.

## Personen einladen

Die Karte **Leute zu … einladen** auf Start erscheint, nachdem du einen Standort erstellt hast.
Die gleiche Seite befindet sich unter **Standorteinstellungen → Mitglieder → Einladen**.

1. Wähle die **Rolle**, und unter **Zugriff** entweder **Kein Enddatum** oder **Bis zu einem Datum**. Ihr
   Zugriff endet an diesem Datum, und alle Tokens, die sie für die API erstellt haben, hören damit auf.
2. **Einladungslink erstellen**. Der Link funktioniert einmalig für 7 Tage. Zeige den QR-Code zum Scannen mit ihrem
   Telefon an, oder kopiere den Link. Eine ausstehende Einladung wird unter **Mitglieder** angezeigt, bis sie verwendet wird, und du kannst
   sie dort widerrufen.
3. **Per E-Mail senden** funktioniert nur, wenn der Server E-Mail eingerichtet hat.

Jemand ohne E-Mail-Adresse kann trotzdem ein Konto erhalten: Eigentümer und Admins fügen eines hinzu über
**Standorteinstellungen → Mitglieder → Person ohne E-Mail hinzufügen**. Es wird zu einem verwalteten Konto — Kept
erstellt eine Adresse dafür, die keine E-Mails empfangen kann, legt sein Passwort mit einem Rücksetzcode fest, und der
Eigentümer wird über jedes neue Konto informiert.

Jeder außer dem Eigentümer kann **Diesen Standort verlassen**. Ein Instanz-Admin kann nicht in ein Zuhause hineinsehen,
es sei denn, er wurde dazu eingeladen.

## Rollen

| Rolle | Was sie in diesem Standort tun können |
|---|---|
| **Eigentümer** | Alles, einschließlich Zwei-Faktor-Regeln, Übertragung und Löschung. Es gibt genau einen Eigentümer. |
| **Admin** | Mitglieder und Betrachter einladen und entfernen, Einstellungen und Module ändern, importieren und exportieren, geteilte Links und Schadenspakete erstellen, endgültig löschen. Nur der Eigentümer kann Admins ernennen oder entfernen. |
| **Mitglied** | Gegenstände hinzufügen, bearbeiten, verschieben, verleihen und in den Papierkorb legen; Zählerstände und Wartungen eintragen; Etiketten drucken; KI-Erfassung verwenden. Geld ist sichtbar. |
| **Betrachter** | Nur suchen und anschauen. Geld ist versteckt, außer der Standort erlaubt Betrachtern, es zu sehen. Der Assistent antwortet, kann aber nichts ändern. |

## Geteilte Links

Geteilte Links zeigen jemandem ohne Konto, was in einer Box, einem Ort oder einer Suche enthalten ist, schreibgeschützt.
Eigentümer und Admins erstellen einen so:

- Bei einer Box **Aktionen → Einen Link nur zum Ansehen teilen**.
- Der Abschnitt **Verwalten** des Ortes.
- **Diese Liste teilen** bei Suche: Eine Suche, gefiltert auf einen Standort, ohne Status- oder Preisfilter.

Wähle, wie lange es funktioniert: ein Tag, eine Woche, 30 Tage (Standard), 90 Tage oder ein Jahr. Der Link
wird einmal angezeigt, also kopiere ihn sofort.

### Was sie sehen

Name, Foto und Typ jedes Gegenstands, wo er ist, Menge, Zustand und Notizen, von A bis Z. Nie Preise,
Seriennummern, geheime Felder, Personen, Leihgaben oder Dokumente. Gegenstände im Papierkorb, Entwürfe und Gegenstände,
die du verkauft oder verloren hast, werden nicht angezeigt.

### Es bleibt aktuell

Die Seite zeigt die Box, den Ort oder die Suche so, wie sie beim Öffnen ist. Der Link einer Suche berücksichtigt ihre Suchwörter sowie ihre Ort-, Typ- und Tag-Filter.

### Links verwalten

**Standorteinstellungen → Geteilte Links** zeigt jeden Link mit seinem Status und wie oft er geöffnet wurde.

- **Vorschau als Empfänger** zeigt die Seite so, wie der Empfänger sie sieht.
- **Widerrufen** beendet ihn sofort.
- Ein Link endet auch, wenn er abläuft, oder wenn die Person, die ihn erstellt hat, den Standort nicht mehr verwaltet.

## Eine Liste drucken

Um jemandem eine Liste auf Papier zu geben, drucke sie. **Inventar drucken** an einem Standort erzeugt ein PDF seiner
Gegenstände, gruppiert nach Ort, mit Fotos und kurzen IDs. Preise erscheinen nur für Personen, die Geld sehen
können. Wer den Standort sehen kann, kann eines erstellen.

**Per E-Mail an mich** sendet ebenfalls das PDF per E-Mail, sobald es bereit ist, und **Erneut senden** sendet den gesamten
Standort jeden Montag oder am 1. des Monats. Einstellungen → Profil → Benachrichtigungen listet diese auf und
stoppt sie. Ein Bericht über 10 MB wird nicht angehängt: drucke ihn stattdessen aus Kept.

## Verwandte

- [Deine ersten Minuten](/de/users/first-run/#5-leute-einladen) zum Einladen von Personen während der Einrichtung.
- [Tägliche Nutzung](/de/users/everyday-use/) für den Gesamtüberblick.
- [Sets und Verleih](/de/users/kits/) zum Verleihen von Gegenständen.
