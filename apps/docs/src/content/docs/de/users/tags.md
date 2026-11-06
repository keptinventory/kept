---
title: Schlagwörter
description: Schlagwörter sagen, was ein Gegenstand sonst noch ist, über seinen Ort hinaus. Füge sie überall hinzu, filtere nach mehreren, öffne die Seite eines Schlagworts und vergib Schlagwörter auf dem Telefon ohne Signal.
---

**Orte** sagen, wo ein Gegenstand ist. **Schlagwörter** sagen, was er sonst noch ist: *camping*, *winter*, *kids*,
*fragile*. Ein Gegenstand kann bis zu 50 Schlagwörter haben; ein Konto bis zu 1.000.

Schlagwörter gehören zum Konto, daher teilen alle Orte des Kontos sie. Nur Gegenstände haben Schlagwörter (Kisten
sind Gegenstände); Orte, Dokumente und Personen nicht.

## Schlagwörter hinzufügen

- **Eine Seite eines Gegenstands:** **Schlagwörter → Schlagwort hinzufügen**. Wähle eines aus oder gib einen neuen Namen ein und **Erstellen**. Ein Name,
  der einem vorhandenen Schlagwort nahekommt, wird zuerst unter **Meintest du** aufgelistet, sodass *Campng* nicht zu einem zweiten *Camping* wird.
- **Einen Gegenstand hinzufügen:** das Feld **Schlagwörter** in **Gegenstand hinzufügen**.
- **Erfassen:** **Schlagwörter hinzufügen** unter dem Namen. Die Schlagwörter bleiben für die nächsten Fotos, wie auch der Ort.
- **Viele auf einmal:** **Auswählen** im Inhalt eines Orts, auf der Seite eines Schlagworts oder im Posteingang, dann
  **Schlagwörter hinzufügen…** oder **Schlagwörter entfernen…**. Die anderen Schlagwörter bleiben wie sie sind.
- **Tabellenansicht:** die Spalte **Schlagwörter** und **Schlagwörter…** für eine Auswahl.

Jede Änderung hat **Rückgängig**.

## Wer was tun kann

| | Owner | Admin | Member | Viewer |
|---|---|---|---|---|
| Schlagwörter sehen, danach filtern | ✓ | ✓ | ✓ | ✓ |
| Gegenständen Schlagwörter geben, neues Schlagwort erstellen | ✓ | ✓ | ✓ | |
| Schlagwort umbenennen, neu einfärben, zusammenführen, löschen | ✓ | ✓ | | |

## Farben

Jedes Schlagwort hat eine Farbe aus einer festen Auswahl von zwölf, die in hellem und dunklem Modus gut lesbar sind. Ein neues Schlagwort
übernimmt die am wenigsten verwendete Farbe. Ändere sie unter **Einstellungen → Konto → Schlagwörter → Bearbeiten**. Farben aus einem
Homebox-Import werden der nächstgelegenen der zwölf zugewiesen.

## Seite eines Schlagworts

Klicke auf ein Schlagwort auf der Seite eines Gegenstands oder auf eine Zeile in **Einstellungen → Konto → Schlagwörter**. Es listet alles mit
diesem Schlagwort über deine Orte hinweg, mit der Anzahl in jedem, sowie die übliche Suche, Filter und
Gruppierung der Liste. Owner und Admins benennen es hier um, färben es neu ein, führen es zusammen oder löschen es.

- **Zusammenführen** legt ein Schlagwort in ein anderes: seine Gegenstände erhalten das andere Schlagwort.
- **Löschen** funktioniert nur für ein Schlagwort, das kein Gegenstand hat, einschließlich Gegenständen im Papierkorb. Verwende stattdessen Zusammenführen.
- Umbenennen, neu einfärben, zusammenführen und löschen können 7 Tage lang rückgängig gemacht werden.

## Nach Schlagwort finden

- **Filter → Schlagwort:** **ist eines von**, **hat alle von** (Gegenstände mit jedem gewählten Schlagwort) oder **ist keines von**.
- **Anzeige → Gruppieren: Schlagwort** listet jeden Gegenstand unter seinem ersten Schlagwort auf, von A bis Z; Gegenstände ohne Schlagwort zuletzt.
- Die Suche findet Schlagwortnamen, und die Sinnsuche kennt sie ebenfalls.

## Offline

Das Telefon behält deine Schlagwörter: Chips werden angezeigt, und der Schlagwort-Filter funktioniert in der Offline-Suche. Schlagwörter, die du hinzufügst
oder entfernst, und die, die du erstellst, werden auf dem Telefon gespeichert und synchronisiert, wenn du wieder online bist.

## KI und MCP

- **Erfassen:** wenn KI aktiv ist, schlägt ein Foto Schlagwörter aus deiner eigenen Liste vor, nie neue. Bestätige oder lehne sie im Posteingang ab.
- **MCP und der Assistent:** `get_thing` gibt Schlagwörter zurück; `list_tags` listet sie auf; `tag_things` fügt sie hinzu oder
  entfernt sie; `search_things` nimmt mehrere Schlagwörter, beliebige oder alle; `add_thing` und
  `update_thing` nehmen Schlagwortnamen entgegen.

## Importe

- **Homebox:** Schlagwörter werden mit ihren Farben übernommen; verschachtelte Schlagwörter werden abgeflacht. Schlagwörter auf Homebox-Orten werden nicht übernommen, und der Importbericht weist darauf hin.
- **CSV:** Eine Spalte `tags` erstellt die Schlagwörter, die sie benennt.
