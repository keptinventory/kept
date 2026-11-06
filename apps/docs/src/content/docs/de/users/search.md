---
title: Suche
description: Dinge nach Name, Marke, Seriennummer, ID, Ort oder den Wörtern finden, die KI als Aliase hinzugefügt hat. Filter, Gespeicherte Suchen, Offline-Suche und semantische Suche.
---

Suche findet Dinge nach Name, Marke, Seriennummer, ID, Ort oder den Wörtern, die KI als Aliase
hinzugefügt hat, und gruppiert Ergebnisse in Dinge, Orte, Personen, Geschäfte und Dokumente (mit
einem Auszug aus dem Belegtext).

Diese Seite behandelt, wonach du suchen kannst, Filter, Gespeicherte Suchen, Offline-Suche und
semantische Suche.

## Filters

Filter grenzen Ergebnisse nach Standort, Ort, Typ, Tag und Zustand ein.

**Gespeicherte Suchen** speichern einen Filtersatz für dich oder einen ganzen Standort.

Am Computer öffnet ⌘K oder Ctrl+K die Suche von überall.

## Offline search

Auf dem Handy funktioniert die Suche auch offline aus der Kopie auf dem Handy, beschriftet mit
**On this phone · as of last sync**. Die Ergebnisse stammen aus der lokalen Kopie, und was du
änderst, synchronisiert sich, wenn du wieder online bist.

## Semantic search

Ist ein Embeddings-Modell verbunden, gesellen sich Ergebnisse, die "nach Bedeutung" passen, zu
den Treffern aus Stichwörtern. Zum Beispiel kann eine Anfrage zum Schneiden von Papier eine Schere
treffen, selbst wenn das Wort in der Anfrage nicht vorkommt. Siehe [KI-Anbieter](/de/users/ai-providers/#suche-und-einbettungen).

Ohne ein solches Modell gleicht die Suche nur Namen und Wörter ab: "laptop" findet kein MacBook
Pro. Die Suche zeigt **Searched by name only** über den Ergebnissen an, mit einem Link zu
**Einstellungen → KI**. Der Assistent und MCP-Clients bekommen dieselbe Information (`search_mode`
bei `search_things` und `where_is`), sodass eine Antwort sagt, dass nur nach Namen gesucht wurde,
statt dass nichts existiert.

## Scanning

**Scannen** auf der Startseite und in der Suche öffnet die Kamera. Siehe [Scan-Sitzungen](/de/users/scanning-sessions/) für das Scannen mehrerer Etiketten auf einmal.

## Sharing a search

**Diese Liste teilen** in der Suche erstellt einen schreibgeschützten Teilungslink für eine Suche,
die auf einen Standort gefiltert ist, ohne Zustands- oder Preisfilter. Siehe Teilen eines
Standorts.

## Related

- [Alltagsnutzung](/de/users/everyday-use/) für den Gesamtüberblick.
- [KI-Anbieter](/de/users/ai-providers/) für die Einrichtung der semantischen Suche.
- [Tags](/de/users/tags/) zum Filtern nach Tags.
