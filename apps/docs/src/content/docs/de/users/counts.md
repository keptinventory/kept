---
title: Zählungen und Bestandsaufnahmen
description: Jede Zählung und jede Boxprüfung bleibt erhalten, mit dem, was gefunden wurde, was fehlte und wo sich jetzt jedes Ding befindet. Zähle einen Ort gemeinsam, plane eine Zählung alle paar Monate, vergleiche mit der letzten und exportiere eine CSV.
---

Eine Zählung behält jedes Ergebnis. **Zählungen** listet jede Zählung und Boxprüfung eines Standorts, neueste
zuerst, und die Seite einer Zählung zeigt, was sie gefunden hat, was fehlte und wo sich jetzt jedes Ding befindet.

Öffne sie über **Mehr → Zählungen**, über die Seite eines Standorts (**Zählungen**), oder über die Seite eines Orts
(**Frühere Zählungen**). Nach dem Speichern einer Zählung öffnet **Diese Zählung ansehen** sie.

## Die Liste der Zählungen

Suche nach dem, was gezählt wurde, und filtere nach Art (Zählungen, Boxprüfungen), Ort, wer gezählt hat, **Hat
Fehlendes** und Datum. Gruppiere nach Ort, Person oder Monat. Die Liste ist seitenweise, und jeder Filter steht in
der Adresse, sodass eine gefilterte Liste als Lesezeichen gespeichert oder als Ansicht gespeichert werden kann.

## Die Seite einer Zählung

- **Gefunden X von Y**, wann, wie lange es dauerte, wer gezählt hat (alle, bei einer gemeinsamen Zählung) und wer
  sie beendet hat.
- **Seit der letzten Zählung** desselben Orts oder derselben Box: "1 neu fehlend, 0 wieder gefunden, 2 neue
  Dinge", mit einem Link zur vorherigen.
- Seine Listen, jede Zeile verlinkt das Ding mit dem, wo es sich jetzt befindet:

| Liste | Was es bedeutet |
|---|---|
| Gefunden | Beim Zählen gelesen: als gesehen markiert |
| Fehlend | Auf der Liste, nicht gelesen und nicht als nicht hier markiert |
| Anderorts gefunden | Hier gelesen, aber Kept hatte es woanders, und du hast es dort gelassen |
| Hierher verschoben | Anderorts gefunden und hierher verschoben |
| Als nicht hier markiert | In der Übersicht gewählt |
| Ausgeliehen, In Reparatur, Im Papierkorb | Nie fehlend: weg aus einem Grund, den Kept kennt |
| Nicht gezählt: Hintere Ablage | In einem Bereich, den niemand gezählt hat (siehe unten) |

Ein Ding, das seit der Zählung in den Papierkorb gelegt wurde, bleibt sichtbar und ist **In den Papierkorb gelegt** markiert.

**Als CSV exportieren** speichert die Zählung als Tabelle: Ding, Kurz-ID, wo es erwartet wurde, das
Ergebnis, wie viele von wie vielen gefunden wurden und wo es sich jetzt befindet.

Vor Kept 1.14 gespeicherte Zählungen zeigen ihr Gesamtergebnis; sie haben nicht aufgezeichnet, was fehlte oder
woanders war.

## Nie "fehlend" aus einem Grund

Ein Ding, das ausgeliehen, in Reparatur oder im Papierkorb ist, wird nie als fehlend aufgeführt. Die Übersicht gibt
jedem seine eigene Gruppe, "Bei Murdock (3)", "In Reparatur (1)", und die Zählung behält sie so.

## Nicht gezählt und "Ich habe nachgesehen"

Eine Zählung eines Orts mit Orten darin (oder eines ganzen Standorts) hat **Bereiche**: den Ort und jeden Ort darin.
Ein Bereich, in dem nichts gelesen wurde, ist **Nicht gezählt**: seine Dinge stehen unter "Nicht gezählt: Hintere Ablage",
nicht unter Fehlend. Wenn du nachgesehen hast und der Bereich wirklich leer von diesen Dingen war, tippe auf **Ich habe
nachgesehen**: Sie werden als fehlend aufgeführt.

## Zählen nach Menge

Ein Ding mit einer Menge (6 Dosen) zählt als alle, wenn sein Etikett gelesen wird. Nutze **−** und
**+** in seiner Zeile, um zu sagen, wie viele du gefunden hast. Wenn du zu wenige gefunden hast, wähle **Rest als nicht
hier markieren** dafür: der Rest wird als eigene Zeile abgetrennt und als nicht hier markiert, wie es eine
Boxprüfung tut. Rückgängig machen fügt alles wieder zusammen.

## Gemeinsam zählen

Eine online begonnene Zählung wird geteilt. Jeder andere, der eine Zählung desselben Orts öffnet, sieht **Zählung
läuft bei Sam: Beitreten**. Beitreten fügt hinzu, was du gelesen hast, zur selben Zählung, jede Lesung mit der Person,
die sie gelesen hat; die Übersicht zeigt, was die anderen gefunden haben, und ihre Bereiche zählen als gezählt. Jeder,
der dort zählt, kann sie beenden, und zum Beenden braucht man eine Verbindung. Eine Zählung, der über mehrere Tage
beigetreten wird, bleibt offen, bis jemand sie beendet.

## Etikettenabdeckung

Das Setup der Zählung sagt, wie viele der Dinge dort Etiketten haben ("62% der Dinge hier haben
Etiketten"), mit **Etiketten für den Rest drucken**. Ein Ding ohne Etikett ist nie fehlend: Hake es in der Übersicht
ab, wenn du es gesehen hast.

## Geplante Zählungen

Auf der Seite eines Orts plant **Regelmäßig zählen** eine Zählung alle 1 bis 24 Monate. Es ist ein Zeitplan des Orts,
mit der üblichen Erinnerung (eine Woche vorher), fällig und überfällig, und der Needs-you-Kachel. Wer diesen Ort zählt
(mit oder ohne die Orte darin) markiert ihn als erledigt; das Zählen rückgängig machen macht auch das rückgängig. Um
einen ganzen Standort regelmäßig zu zählen, plane es auf seinem obersten Ort.

## Wer was tun darf

| | Eigentümer, Admin, Mitglied | Betrachter |
|---|---|---|
| Zählungen sehen, eine Zählungsseite, vergleichen, Als CSV exportieren | ✓ | ✓ |
| Zählen, einer Zählung beitreten | ✓ | Eine Prüfung: nichts gespeichert, nicht gelistet |
| Eine Zählung planen | ✓, mit Zeitplänen an | — |

## Zählungen ausschalten

Zählungen sind ein Modul, in jeder Voreinstellung eingeschaltet. Ein Eigentümer oder Admin schaltet sie
unter **Standorteinstellungen → Was erfasst wird** (**Zählungen**) aus. Sind sie an einem Standort
aus, haben seine Orte kein **Hier zählen**, **Regelmäßig zählen** oder **Frühere Zählungen**, seine
Kisten kein **Diese Kiste zählen**, seine Räume auf der Karte kein **Diesen Raum zählen**, und
**Sitzung starten** bietet dort kein Zählen an. **Zählungen** unter Werkzeuge verschwindet, sobald
sie an allen deinen Standorten aus sind. Geplante Zählungen erinnern nicht mehr. Der
**Kistencheck** bleibt. Nichts wird gelöscht: wieder eingeschaltet, ist jede Zählung wieder da.
