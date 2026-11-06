---
title: Fahrzeuge und Maschinen
description: "Protokolliere Messwerte, Dienstleistungen und Treibstoff für alles Gemessene: Autos, Generatoren, Kessel. Zeitpläne nach Datum oder nach Messwert, Standardtermine, vom-Vorrat-Verbrauchsmaterialien und ein Verlaufsbericht."
---

Kept verfolgt alles mit einem Messwerterfassungsgerät: ein Auto, einen Generator, einen Kessel, einen Rasenmäher. Etwas, dessen Typ messwertbasiert ist, erhält **Zähler**: Ablesungen, Dienstleistungen und Zeitpläne. **Fahrzeuge** (Haushalt- und Vollausstattung-Voreinstellungen) sammelt alle Fahrzeuge an einem Ort, jeweils mit Registern für Übersicht, Ablesungen, Dienstleistungen, Dokumente, Kosten und bei der Vollausstattung auch Treibstoff.

Diese Seite behandelt das Erfassen von Ablesungen und Dienstleistungen, Zeitpläne, Treibstoff und den Verlaufsbericht. Für die Kartenformen, die ein Fahrzeug tragen kann, siehe [Kartenformen](/de/users/map-shapes/).

## Erfassen einer Ablesung

Eine Ablesung funktioniert von zu Hause aus, vom Fahrzeug und offline. Eine Ablesung, die nicht zwischen ihren Nachbarn passt, wird abgelehnt, und Kept sagt warum. Ein Dashboard-Foto schließt sich den Nachweis-Fotos des Fahrzeugs an.

## Erfassen einer Dienstleistung

Eine Dienstleistungsaufzeichnung hält den Besuch in der Werkstatt fest:

- **Datum** und die **Ablesung** zum Zeitpunkt.
- **Die Werkstatt** und **die Rechnung**. KI kann die Positionen aus der Rechnung ausfüllen.
- **Positionen** mit ihren Kosten.
- **Abgeschlossene Zeitpläne**: der Neustart setzt ihre Anzahl zurück.
- **Aus dem Vorrat**-Zeilen (siehe unten).
- **Notizen**.

Auf der Registerkarte **Dienstleistungen** eines Fahrzeugs tippe auf eine Dienstleistung, um sie zu öffnen: alles, was sie enthält, einschließlich Notizen.

- **Bearbeiten** öffnet das gleiche Formular, vorausgefüllt. Das Speichern der Änderungen ändert nur das, was du geändert hast.
- **Löschen** fragt zuerst nach, dann bietet **Rückgängig machen** an. Seine Zeilen und die Rechnung gehen damit mit; die von ihr abgeschlossenen Zeitpläne zählen ab der Dienstleistung vorher.
- Wer kann: die Person, die sie protokolliert hat, und der Besitzer und die Administratoren des Standorts. Ein Betrachter kann sie öffnen, aber nicht ändern.
- Eine noch eingelesene Rechnung ist ein **Entwurf**: **Eintrag abschließen** oder **Entwurf verwerfen**.

## Aus dem Vorrat

Wenn Verbrauchsmaterialien für den Standort aktiviert ist, kann eine Dienstleistungsposition ein Verbrauchsmaterial aus dem gleichen Standort auswählen: den Ölfilter auf dem Regal.

- Das Speichern nimmt die Menge der Position (1, wenn die Menge leer ist) vom Bestand des Verbrauchsmaterials weg.
- Kept verweigert mehr als vorhanden ist.
- Das Bearbeiten der Position, das Entfernen davon, das Löschen der Dienstleistung oder das Rückgängigmachen eines dieser Schritte stellt den Bestand wieder her.
- Eine noch eingelesene Rechnung nimmt nichts weg, bis du sie speicherst.

Der **Verlauf** des Verbrauchsmaterials zeigt die Verwendung an, mit einem Link zur Dienstleistung.

Der Assistent und MCP-Clients können eine Dienstleistung auf die gleiche Weise protokollieren („verbrauchte 4,5 Liter Motoröl“). Die Bestätigungskarte des Assistenten zeigt jede **Aus dem Vorrat**-Zeile an, bevor etwas bewegt wird.

## Zeitpläne

Ein Zeitplan ist eine Erinnerung, etwas erneut zu tun, entweder nach Datum oder nach Messwert.

- **Standardtermine hinzufügen** fügt die üblichen hinzu: Ölwechsel, Reifenrotation, Bremsflüssigkeit, Luftfilter.
- **Einmalig** (ein Datum, keine Wiederholung) wird einmal erledigt, nachdem du es abgeschlossen hast. Es lässt Fällig und Überfällig zurück, und **Zeitpläne** listet es als **Erledigt** mit dem Tag auf. Hebe die Abschlussannahme auf, oder lösche diesen Dienst, und es ist wieder fällig.
- Fällige und überfällige Zeitpläne erscheinen in Home unter **Braucht dich**, sowie im Kalender-Feed und im Benachrichtigungszentrum. Siehe Erinnerungen und Benachrichtigungen.

## Treibstoff (Vollausstattung-Voreinstellung)

Bei der Vollausstattung-Voreinstellung registriert der **Treibstoff**-Tab jede Tankfüllung. Das Formular fragt nach der **Menge** (in deiner Einheit: Liter, Gallonen oder einer Ladung in kWh für ein Elektrofahrzeug) und dem **Kosten**; der Preis pro Einheit wird daraus berechnet, nicht eingegeben. Es beinhaltet auch das Datum und die Uhrzeit, **Voller Tank** oder **Teilweise**, den Kilometerstand (optional, überprüft anhand der Ablesungen davor und danach), ein Foto des Kilometerstands, den Tankquittenzettel, eine Notiz und die Tankstelle – eine neue Tankstelle wird zu deinen Lieferanten hinzugefügt, wenn du speicherst. **Ich habe davor eine Tankfüllung vergessen** kennzeichnet eine Lücke, sodass der Verbrauch richtig bleibt: der Verbrauch wird von einer vollen Tankfüllung zur nächsten gemessen und zeigt sich erneut nach zwei vollen Tankfüllungen mit Kilometerstand-Ablesungen.

## Einheiten

- **Kilometerzähler**: der Kilometerstand eines neuen Fahrzeugs zählt in **km**; der Zähler eines Generators zählt Stunden. Die Einheit eines Zählers kann nach seiner Erstellung bisher nicht geändert werden.
- **Ablesungen und Treibstoffmengen** werden genau wie eingegeben beibehalten und nie umgerechnet.
- **Treibstoffverbrauch** wird als L/100 km angezeigt, oder kWh/100 km bei einer Ladung; pro Stunde bei einem Stundenmesser.

## Kosten

Die Registerkarte **Kosten** eines Fahrzeugs zeigt seine Treibstoff-, Dienstleistungs- und Gebührenkosten an. Einsichten zeigen die gleichen Zahlen für alle deine Fahrzeuge unter **Fahrzeugkosten** an.

## Lesen einer Registrierungskarte

Im Etikettenmodus liest **Karte lesen** eine Registrierungskarte: VIN, Kennzeichen und Ablaufdatum der Zulassung.

## Verlaufsbericht

**Verlaufsbericht** erzeugt ein PDF für einen Zeitraum: Ablesungs-Historie mit Nachweis-Fotos, Dienstleistungen mit ihren Rechnungen, Treibstoff und Dokumenten, und Kosten nur dort, wo du Geld sehen kannst.

## Verwandtes

- [Alltägliche Nutzung](/de/users/everyday-use/) für das größere Bild.
- [Bestände und Inventuren](/de/users/counts/) für im Lager gespeicherte Verbrauchsmaterialien.
- [KI-Anbieter](/de/users/ai-providers/) für das Lesen von Rechnungen und Karten.
