---
title: Was es braucht
description: Auf was Kept getestet wurde, wie viel Speicher es nutzte und was seinen Bedarf steigert.
sidebar:
  order: 6
---

**Getestet: 1 GB RAM, ein oder zwei CPU-Kerne**, mit einem externen KI-Anbieter oder ohne. Alles
lief dort, auch eine Sicherung während des Foto-Uploads. 2 GB lassen Spielraum.

## Was getestet wurde

- **Version:** Die Änderungen von Kept 1.14.3 (ein Build vor dem Release), `compose.yaml` wie veröffentlicht
  (Kept, Postgres 18 mit pgvector). 1.14.2 brauchte 2 GB für seine Sicherung.
- **Maschine:** emuliert in Docker auf einem arm64-Mac. Docker, Kept und Postgres teilen sich ein Speicher- und
  CPU-Budget wie auf einer kleinen VM, mit 128 MB für das Betriebssystem. Kein Swap.
- **Daten:** ein Haushalt, plus ein Ort mit 3.000 Dingen in 206 Orten und 200 Behältern sowie
  300 echte Fotos.
- **Arbeiten:** 20 Fotos mit 12 Megapixeln, zwei PDFs, 120 Ladevorgänge der Karte und des Graphen dieses Ortes, 120
  Listen- und Suchaufrufe, `kept admin backup` während die Fotos hochgeladen werden, die geplante Sicherung, dann
  10 Minuten Leerlauf.

| Maschine | Fotos, Karte, Suche, PDFs | Sicherung während Uploads | Geplante Sicherung | Spitze |
|---|---|---|---|---|
| 1 GB, 2 Kerne (3 Läufe) | bestanden | bestanden | bestanden | 730–745 MB |
| 1 GB, 1 Kern | bestanden | bestanden | bestanden | 740 MB |
| 768 MB, 1 Kern | bestanden, bis die Sicherung an Speichermangel scheiterte; 9 Uploads und beide PDFs schlugen fehl, während Kept neu startete | Speicher voll | bestanden von selbst (ein Lauf) | — |

Spitzenwerte sind Speicher, der nicht zurückgegeben werden kann (Seitencache nicht mitgezählt), für die ganze Maschine, Docker
eingeschlossen. Bei Speichermangel tötete das System Kepts Prozess und Docker startete ihn neu.

- **Im Leerlauf:** nach einem Start Kept etwa 160 MB und Postgres etwa 30–70 MB. Sobald Fotos
  verkleinert wurden, bleibt Kept bei etwa 300 MB.
- **Echte Daten:** auf einem amd64-Heimserver Kept 206 MB und Postgres 119 MB (eine Messung).
- **Geschwindigkeit** (Mediane): eine Listenseite 30–40 ms, eine Suche 50–70 ms, ein Foto-Upload 0,3–0,4 s, die Karte
  des Ortes mit 3.000 Dingen 0,4–0,5 s.
- **Noch nicht getestet:** eine echte VM, amd64 in diesen Größen, 512 MB, lokale KI. Leistungstests laufen weiter: [#379](https://github.com/keptinventory/kept/issues/379).

## Was das bedeutet

- **1 GB, 1 oder 2 Kerne:** getestet, jeder Lauf bestanden, mit etwa 150 MB Spielraum am Spitzenwert.
- **2 GB:** Spielraum, für andere Dienste neben Kept.
- **768 MB:** Kept lief, und Jetzt sichern (der Pfad der geplanten Sicherung) auch; `kept admin backup`
  während der Foto-Uploads lief dem Speicher aus. Nicht empfohlen.

## Raspberry Pi

Nicht auf einem getestet. Das arm64-Image ist das, auf dem diese Tests liefen, also kann ein Pi mit 1 GB oder mehr wie die 1-GB-Zeilen passen; es wird voraussichtlich langsamer sein. Keine Veröffentlichung wird auf einem Pi getestet.

## Was schwer wiegt

- **Sicherungen.** `kept admin backup` fügt während des Laufs etwa 300–400 MB hinzu, die geplante Sicherung etwa
  150 MB; restic selbst etwa 100 MB davon. Nicht in der
  [Home Assistant App](/de/install/home-assistant/): Stattdessen laufen dort die Sicherungen von Home Assistant.
- **Fotoverkleinerung.** Jeder Upload wird beim Eintreffen verkleinert. Unter 3 GB RAM oder einem Container-Limit
  unter 3 GB verkleinert Kept eines nach dem anderen, sonst zwei (`KEPT_IMAGE_CONCURRENCY` überschreibt das). Der Speicher
  steigt über die ersten Fotos um etwa 150 MB und bleibt dort.
- **Karte und Graph eines sehr großen Ortes.** Der Server liest bei jedem Laden den ganzen Ort:
  etwa 670 KB für 3.000 Dinge.
- **Nicht auf dem Server:** Karte, Graph und Grid werden von deinem Browser gezeichnet und fügen im Leerlauf keinen Serverspeicher
  hinzu; Karte und Graph werden nur heruntergeladen, wenn sie geöffnet werden.
- **Lokale KI mit Ollama.** Ein Modell auf derselben Maschine teilt sich ihren Speicher mit Kept und braucht viel
  mehr als Kept; siehe [Ollama](/de/admin/ollama/).
- **Festplatte.** Die Datenbank ist klein; Dateien sind es, die wachsen. Lass Platz für Sicherungen auf einer anderen Festplatte, und
  Admin → Status warnt – und Admins werden alarmiert –, wenn eine Festplatte 85 % voll ist.

## Postgres

Kept braucht PostgreSQL 18 mit pgvector. Compose führt das Image `pgvector/pgvector` aus, angeheftet an einen
  Digest; für die Datenbank eines Anbieters siehe [Managed Postgres](/de/install/managed-postgres/).
