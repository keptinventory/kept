---
title: Fahrzeuge und Maschinen
description: "Protokolliere Messwerte, Wartungen und Kraftstoff für alles Gemessene: Autos, Generatoren, Kessel. Zeitpläne nach Datum oder nach Messwert, Standardtermine, vom-Vorrat-Verbrauchsmaterialien und ein Verlaufsbericht."
---

Kept verfolgt alles mit einem Zähler: ein Auto, einen Generator, einen Kessel, einen Rasenmäher. Etwas, dessen Typ messwertbasiert ist, erhält **Zähler**: Ablesungen, Wartungen und Zeitpläne. **Fahrzeuge** (Haushalt- und Vollausstattung-Voreinstellungen) sammelt alle Fahrzeuge an einem Ort, jeweils mit Registern für Übersicht, Ablesungen, Wartungen, Dokumente, Kosten und bei der Vollausstattung auch Kraftstoff.

Diese Seite behandelt das Erfassen von Ablesungen und Wartungen, Zeitpläne, Kraftstoff und den Verlaufsbericht. Für die Kartenformen, die ein Fahrzeug tragen kann, siehe [Kartenformen](/de/users/map-shapes/).

## Erfassen einer Ablesung

Eine Ablesung funktioniert von zu Hause aus, vom Fahrzeug und offline. Eine Ablesung, die nicht zwischen ihren Nachbarn passt, wird abgelehnt, und Kept sagt warum. Ein Dashboard-Foto schließt sich den Nachweis-Fotos des Fahrzeugs an.

## Erfassen einer Wartung

Ein Wartungseintrag hält den Besuch in der Werkstatt fest:

- **Datum** und die **Ablesung** zum Zeitpunkt.
- **Die Werkstatt** und **die Rechnung**. KI kann die Positionen aus der Rechnung ausfüllen.
- **Positionen** mit ihren Kosten.
- **Abgeschlossene Zeitpläne**: der Neustart setzt ihre Anzahl zurück.
- **Aus dem Vorrat**-Zeilen (siehe unten).
- **Notizen**.

Auf der Registerkarte **Wartungen** eines Fahrzeugs tippe auf eine Wartung, um sie zu öffnen: alles, was sie enthält, einschließlich Notizen.

- **Bearbeiten** öffnet das gleiche Formular, vorausgefüllt. Das Speichern der Änderungen ändert nur das, was du geändert hast.
- **Löschen** fragt zuerst nach, dann bietet **Rückgängig machen** an. Seine Zeilen und die Rechnung gehen damit mit; die von ihr abgeschlossenen Zeitpläne zählen ab der Wartung vorher.
- Wer kann: die Person, die sie protokolliert hat, und der Besitzer und die Administratoren des Standorts. Ein Betrachter kann sie öffnen, aber nicht ändern.
- Eine noch eingelesene Rechnung ist ein **Entwurf**: **Eintrag abschließen** oder **Entwurf verwerfen**.

## Aus dem Vorrat

Wenn Verbrauchsmaterialien für den Standort aktiviert ist, kann eine Wartungsposition ein Verbrauchsmaterial aus dem gleichen Standort auswählen: den Ölfilter auf dem Regal.

- Das Speichern nimmt die Menge der Position (1, wenn die Menge leer ist) vom Bestand des Verbrauchsmaterials weg.
- Kept verweigert mehr als vorhanden ist.
- Das Bearbeiten der Position, das Entfernen davon, das Löschen der Wartung oder das Rückgängigmachen eines dieser Schritte stellt den Bestand wieder her.
- Eine noch eingelesene Rechnung nimmt nichts weg, bis du sie speicherst.

Der **Verlauf** des Verbrauchsmaterials zeigt die Verwendung an, mit einem Link zur Wartung.

Der Assistent und MCP-Clients können eine Wartung auf die gleiche Weise protokollieren („verbrauchte 4,5 Liter Motoröl“). Die Bestätigungskarte des Assistenten zeigt jede **Aus dem Vorrat**-Zeile an, bevor etwas bewegt wird.

## Zeitpläne

Ein Zeitplan ist eine Erinnerung, etwas erneut zu tun, entweder nach Datum oder nach Messwert.

- **Standardtermine hinzufügen** fügt die üblichen hinzu: Ölwechsel, Reifenrotation, Bremsflüssigkeit, Luftfilter.
- **Einmalig** (ein Datum, keine Wiederholung) wird einmal erledigt, nachdem du es abgeschlossen hast. Es lässt Fällig und Überfällig zurück, und **Zeitpläne** listet es als **Erledigt** mit dem Tag auf. Hebe die Abschlussannahme auf, oder lösche diesen Dienst, und es ist wieder fällig.
- Fällige und überfällige Zeitpläne erscheinen in Home unter **Braucht dich**, sowie im Kalender-Feed und im Benachrichtigungszentrum. Siehe Erinnerungen und Benachrichtigungen.

## Tanken (Vollausstattung-Voreinstellung)

Bei der Vollausstattung-Voreinstellung registriert der **Tanken**-Tab jede Tankfüllung. Das Formular fragt nach der **Menge** (in deiner Einheit: Liter, Gallonen oder einer Ladung in kWh für ein Elektrofahrzeug) und dem **Kosten**; der Preis pro Einheit wird daraus berechnet, nicht eingegeben. Es beinhaltet auch das Datum und die Uhrzeit, **Voller Tank** oder **Teilweise**, den Kilometerstand (optional, überprüft anhand der Ablesungen davor und danach), ein Foto des Kilometerstands, den Tankquittenzettel, eine Notiz und die Tankstelle – eine neue Tankstelle wird zu deinen Lieferanten hinzugefügt, wenn du speicherst. **Ich habe davor eine Tankfüllung vergessen** kennzeichnet eine Lücke, sodass der Verbrauch richtig bleibt: der Verbrauch wird von einer vollen Tankfüllung zur nächsten gemessen und zeigt sich erneut nach zwei vollen Tankfüllungen mit Kilometerstand-Ablesungen.

## Einheiten

- **Kilometerzähler**: der Kilometerzähler eines neuen Fahrzeugs zählt in **km**, oder in **mi**, wenn deine Einstellung **Einheiten** (Einstellungen → Profil → Anzeige) auf **Imperial** steht. Der Zähler eines Generators zählt Stunden.
- **Einheit ändern**: Besitzer und Admins finden es auf der Kilometerzähler-Karte der Übersicht und an einem Zähler auf der Seite eines Dings. Ein Kilometerzähler wechselt auf eine von zwei Arten zwischen km und mi:
  - **Nur umbenennen**: die Ablesungen waren immer schon in der neuen Einheit. Jeder Wert bleibt, wie er ist.
  - **Zählerstände umrechnen**: jede Ablesung (auch die, die auf Prüfung warten), der Versatz nach einem Tausch, das Tageslimit und die Zeitpläne, die am Kilometerzähler laufen (alle so viele km, die Vorwarnung davor, die Ablesung, ab der er zählt, und ein Aufschieben bis zu einer Ablesung), werden mit 1 mi = 1,609344 km umgerechnet, auf das Tausendstel.

  Bevor du speicherst, zeigt Kept, wie viele Ablesungen sich ändern, und die letzte davor und danach. Die Änderung steht im Verlauf des Fahrzeugs als **Zählereinheit geändert**, und die Meldung danach bietet **Rückgängig machen** an, das jeden Wert genau zurücksetzt. Rückgängig machen wird abgelehnt, mit Begründung, sobald sich seitdem etwas am Zähler geändert hat: eine Ablesung erfasst, behalten oder bearbeitet, oder ein Zeitplan geändert. Ein Stundenmesser oder ein eigener Zähler kann nur umbenannt werden.
- **Ablesungen und Kraftstoffmengen** werden wie eingegeben beibehalten. Nur **Zählerstände umrechnen** ändert eine Ablesung, und das lässt sich rückgängig machen. Kraftstoffmengen (Liter, Gallonen, kWh) werden nie umgerechnet.
- **Kraftstoffverbrauch** folgt deiner Einstellung **Einheiten**, egal in welcher Einheit der Kilometerzähler zählt: **L/100 km**, oder **kWh/100 km** bei einer Ladung, im metrischen System; **mpg** (US-Gallonen) oder **mi/kWh** im imperialen. Bei einem Stundenmesser ist er pro Stunde, in der eingegebenen Einheit. Das PDF des Verlaufsberichts folgt der Einstellung der Person, die ihn erstellt.
- **Ein Dashboard-Foto in der anderen Einheit**: wenn das Foto Meilen zeigt und der Kilometerzähler km zählt, oder umgekehrt, wartet die Ablesung im **Eingang**, wie jede Foto-Ablesung. Ihre Karte sagt, was das Foto zeigte, und gibt den Wert in der Einheit des Kilometerzählers an, mit einer Schaltfläche, um ihn zu übernehmen. Nichts wird umgerechnet, bevor du wählst.

## Kosten

Die Registerkarte **Kosten** eines Fahrzeugs zeigt seine Kraftstoff-, Wartungs- und Gebührenkosten an. Einsichten zeigen die gleichen Zahlen für alle deine Fahrzeuge unter **Fahrzeugkosten** an.

## Lesen einer Registrierungskarte

Im Etikettenmodus liest **Karte lesen** eine Registrierungskarte: VIN, Kennzeichen und Ablaufdatum der Zulassung.

## Verlaufsbericht

**Verlaufsbericht** erzeugt ein PDF für einen Zeitraum: Ablesungs-Historie mit Nachweis-Fotos, Wartungen mit ihren Rechnungen, Kraftstoff und Dokumenten, und Kosten nur dort, wo du Geld sehen kannst.

## Verwandtes

- [Alltägliche Nutzung](/de/users/everyday-use/) für das größere Bild.
- [Bestände und Inventuren](/de/users/counts/) für im Lager gespeicherte Verbrauchsmaterialien.
- [KI-Anbieter](/de/users/ai-providers/) für das Lesen von Rechnungen und Karten.
