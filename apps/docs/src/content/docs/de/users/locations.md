---
title: Standorte, Räume und Kisten
description: "Der Baum, in dem alles sitzt: Standorte, Räume und Plätze, Kisten und Behälter, Ohne Ort, die Layouts eines Standorts (Liste, Raster, Graph, Tabelle, Karte) und Auswählen für viele Gegenstände auf einmal."
---

Alles sitzt in einem Baum: Ein Standort (Zuhause, Garage, ein Lager) hält **Räume und Plätze**
(„Raum oder Platz“ ist Kepts Wort für jeden Ort), die wiederum Gegenstände halten. Ein Gegenstand kann eine
**Kiste / ein Behälter** sein, der andere Gegenstände enthält, so tief du willst. Jeder Standort hat
auch **Ohne Ort** für Gegenstände, die noch keinen Platz haben.

- Auf einem Standort, einem Raum oder einer Kiste fügt **Hier hinzufügen** einen Gegenstand, eine
  **Kiste / einen Behälter** oder ein **Raum oder Platz** hinzu, oder [Möbel mit Fächern](#möbel-mit-fächern).
- Listen haben ein Suchfeld, **+ Filter**, gespeicherte **Ansichten** und eine Schaltfläche **Anzeige** für Sortierreihenfolge
  und Gruppierung. Filter stehen in der Adresse, daher lässt sich eine gefilterte Liste als Lesezeichen speichern oder teilen.
- **Auswählen** (neben dem Suchfeld, für alle, die Gegenstände bearbeiten können) hakt in der Liste eines
  Standorts, eines Ortes oder einer Kiste in der Listen- oder Rasteransicht Gegenstände ab. Mit **Umschalt-Klick** auf die
  Checkbox einer Zeile (oder **Umschalt+Leertaste** darauf) hakst du alle Zeilen ab der zuletzt angehakten ab. Dann: **Verschieben**, **Schlagwörter hinzufügen…** oder **Schlagwörter entfernen…**,
  **Feld setzen…**, **Aufnehmen** (in die Ablage), **Etiketten drucken**, **Zum Vorfall hinzufügen** und
  **Schadenspaket** (für Besitzer und Admins, wenn Belege und Garantien eingeschaltet ist), oder **In den Papierkorb**.
  Die Leiste ist die der [Tabelle](/de/users/spreadsheet/).
- **Feld setzen…** gibt jedem abgehakten Gegenstand einen Wert: Typ, Marke, Modell, Zustand und
  der Rest. Änderungen warten, markiert als **Noch nicht gespeichert**, bis **N Änderungen speichern**; ein
  **Rückgängig** nimmt den ganzen Speichervorgang zurück. Das braucht eine Verbindung. Wenn
  jemand einen von ihnen inzwischen geändert hat, wartet der: **Meine Version behalten** oder
  **Andere Version behalten**.
- **In den Papierkorb** nimmt bis zu 200 auf einmal und braucht eine Verbindung. Zuerst wird
  gefragt, was mit dem Inhalt einer Kiste passiert (herausnehmen oder ebenfalls wegwerfen) und
  ob etwas ausgeliehen ist, dann bringt ein **Rückgängig** alle zurück.
- **Reihenfolge:** Orte und Gegenstände lesen sich A bis Z mit Zahlen in der Reihenfolge (Kiste 2 vor Kiste 10), gleich
  in der App, offline, in Exporten und für KI-Apps. Stockwerke behalten die Reihenfolge, in der sie gemacht wurden: das
  erste ist das Erdgeschoss auf der Karte. Auf einem Ort ordnet **Anzeige → Gegenstände: sortieren nach** dessen
  Gegenstände; seine Orte bleiben A bis Z.
- **Eigene Reihenfolge:** Auf einem Ort setzt **Verwalten → Reihenfolge der Orte hier → Eigene Reihenfolge** die
  Orte darin in die Reihenfolge, die du wählst, mit **Nach oben** und **Nach unten** auf jedem (Tastatur
  auch). **A bis Z** kommt jederzeit zurück, und wenn du wieder auf **Eigene Reihenfolge**
  wechselst, kommt deine Reihenfolge zurück. Der Baum, die Karte, Exporte und KI-Apps folgen ihr. Die
  oberste Ebene eines Standorts bleibt A bis Z.
- **Orte in Kisten umwandeln…** auf dem **Verwalten** eines Ortes listet die Orte darin auf: hake einige
  ab oder **Alle auswählen**, und sie werden in einem Schritt zu Kisten, jede behält ID, Etikett und Inhalt. Ein
  Ort mit Orten darin kann nicht abgehakt werden: eine Kiste enthält nur Gegenstände. Das
  **Rückgängig** des Toasts macht sie alle wieder zu Orten, wie sie waren; es bleibt 7 Tage in der
  Historie.
- **Der Assistent und KI-Apps** können dasselbe: einen Ort umbenennen, seine Art ändern, ihn verschieben, seine
  Felder und die Reihenfolge der Orte darin setzen, und Orte in Kisten umwandeln (`update_place` und
  `turn_into_boxes`, [MCP-Clients](/de/users/mcp-clients/)). Der Assistent zeigt zuerst eine Karte zur Bestätigung; Rückgängig funktioniert wie in der App.
- **Der Ortsbaum** (neben der Seite auf einem Computer, **Alle Orte** auf einem Telefon) zeigt Kisten unter
  ihrem Ort mit, wie viele Gegenstände in jedem sind, bis zu 50 pro Ort, dann **+N Kisten**. Der Pfeil
  neben einem Ort klappt ein, was darunter ist; **Alle einklappen** und **Alle ausklappen** machen jeden Ort auf
  einmal. Kept merkt sich deine Einklappungen für dein Konto, auf jedem Gerät. Die Orte über der Seite, auf der du bist,
  bleiben auf, auch nach **Alle einklappen**.
- **Seine Breite** (auf einem Computer, ab 1280 px breit): ziehe die Linie am Rand des Baums, oder fokussiere sie
  und nutze die Pfeiltasten, Home und End. **Orte einklappen**, die Schaltfläche oben am Baum,
  klappt ihn ein, um der Seite den ganzen Platz zu lassen; **Orte ausklappen** holt ihn zurück. Dieses Gerät merkt
  sich beides.
- Auf einem Standort geht **Einsortieren** „Ohne Ort“ Gegenstand für Gegenstand durch mit einem Ortsauswähler.
- Eine Kiste, die über ihr Etikett geöffnet wird, zeigt ein Fotogitter von dem, was drin ist.
- **Layouts:** Die Seite eines Standorts wechselt zwischen **Liste**, **Raster**, **Graph**, **Tabelle** und
  **Karte**, jedes mit seinem Symbol. **Graph** zeichnet den Standort als Graph seiner Stockwerke, Räume, Kisten
  und Gegenstände in 2D oder 3D ([Der Graph](/de/users/graph/)). **Tabelle** zeigt seine Gegenstände in Tabellenform
  auf einem Bildschirm 1024 px breit oder mehr ([Die Tabellenansicht](/de/users/spreadsheet/)), sodass ein Telefon
  Liste, Raster, Graph, Karte zeigt. **Karte** zeigt den Standort in 3D, Stockwerk für Stockwerk, mit seinen Räumen,
  Regalböden und Kisten ([Die Standortkarte](/de/users/location-map/)). Das **Anzeige**-Menü der Liste bietet
  dieselbe Auswahl. Die eigene Seite eines Ortes (nicht Ohne Ort) hat den Schalter auch, ohne Tabelle. Kept
  merkt sich das Layout für jeden Standort und jeden Ort auf diesem Gerät.
- **Raster** zeigt die Orte und Gegenstände eines Standorts oder Raums als Kacheln, unter den gleichen Überschriften
  **Orte** und **Gegenstände** wie die Liste; jede Überschrift lässt sich einklappen. **Anzeige → Größe** wählt
  **Kleine**, **Mittlere** oder **Große** Kacheln (3, 2 oder 1 pro Zeile auf einem Telefon), und Kept merkt sich
  deine Größe auf diesem Gerät.
- Auf Computer oder Tablet markiert die Seitenleiste den Standort, in dem du bist: auf seiner Seite und auf
  seinen Räumen, Gegenständen, Kisten und Einstellungen.

![Ein Standort im Raster mit kleinen Kacheln: die Überschrift Orte, 9 über den Räumen, dann Gegenstände, 20+ über den Gegenständen, sechs Kacheln pro Zeile, jede nur mit ihrem Namen](../../../../assets/screens/grid-desktop-light.webp)

![Dasselbe Raster im dunklen Design](../../../../assets/screens/grid-desktop-dark.webp)

Links verwenden IDs, nie den Pfad, daher bricht das Verschieben eines Gegenstands einen Link zu ihm nie.

## Möbel mit Fächern

Ein Würfelregal, ein Bücherregal oder eine Kommode ist ein Ort, und jeder Würfel, jedes Regalboden oder jede
Schublade ist ein Ort darin, mit eigenem Namen, Etikett und, wenn du willst, eigenem Code.

- **Hier hinzufügen → Raum oder Platz → Möbel mit Fächern …** macht die Möbel und alle ihre Fächer in einem
  Schritt. Wähle eine Vorlage: ein Würfelregal 1 × 4, 2 × 2, 2 × 4, 4 × 4 oder 2 × 8, ein
  Bücherregal (6 Regalböden), eine Kommode (9) oder ein Regalsystem (4). Ändere die Anzahl der Regalböden
  oder Schubladen vor dem Hinzufügen. Die Art der Möbel ist **Möbel**; ihre Fächer sind **Fach**, **Regalboden** oder
  **Schublade**.
- **Wie es steht:** ein Würfelregal, das nicht quadratisch ist, kann **Aufrecht** stehen oder **Liegend**
  liegen. Ein 2 × 4 aufrecht sind 4 Reihen zu 2; liegend 2 Reihen zu 4. Die Fächer werden so gebaut,
  wie es steht.
- **Zählung:** von oben links, zeilenweise, wie du es vor dir siehst. Ein 4 × 4 ist Fach 1 bis
  Fach 16; ein 2 × 4 liegend hat 1 bis 4 in der oberen Reihe und 5 bis 8 darunter. Das Blatt zeigt
  die Zahlen, bevor du es hinzufügst. **Namen der Fächer** nehmen `{n}` für die Nummer, `{row}` und
  `{col}` für die Position.
- **Codes:** **Sein eigener Code** gibt den Möbeln einen Code (`KX01`), und **Fachcodes** ein
  Muster für die Fächer, wie `{parent}-F{col:02}{row:02}`: `{parent}` ist der
  Code der Möbel, `{col:02}` die Spalte mit zwei Ziffern. Ein 4 × 4 bekommt dann `KX01-F0101` bis `KX01-F0404`. Jeder Code wird gegen die
  Formatregel des Standorts geprüft (**Einstellungen → der Standort → Allgemein → Deine eigenen Codes**) und
  gegen die bereits vorhandenen Codes; wenn einer nicht passt, wird nichts gemacht und Kept nennt den Code.
  Ein Code scannen oder suchen findet sein Fach.
- **Rückgängig:** Das **Rückgängig** des Toasts legt die Möbel und ihre Fächer in den Papierkorb und gibt ihre
  Codes frei, solange nichts darin abgelegt oder seitdem geändert wurde.
- **Etiketten:** Auf den neuen Möbeln druckt **Alles hier etikettieren** ein Etikett für sie und für jedes
  Fach in Zählreihenfolge.
- **Seine Seite** zeigt die Fächer so, wie es steht, nummeriert wie ihre Etiketten. Tippe eines an,
  um es zu öffnen. **Ihre Etiketten drucken** druckt alle erneut in Zählreihenfolge mit den Namen,
  die sie jetzt haben.
- **In den Papierkorb:** Seine Fächer kommen mit in den Papierkorb und beim **Wiederherstellen**
  mit zurück. Liegt etwas darin oder in einem Fach, fragt Kept nur danach: **Verschieben in** den
  Raum, in dem es steht (oder **Anderen Ort wählen**), oder **Auch sie in den Papierkorb**. Eine
  Kiste wandert so, wie sie ist, mit allem darin. Ein Ort, den du selbst zu den Möbeln hinzugefügt
  hast, zählt als etwas darin. Das **Rückgängig** des Toasts legt alles zurück in sein Fach.

### Möbel drehen

**Drehen…** auf der Seite der Möbel, für ein Würfelregal, das nicht quadratisch ist.

- **Die Oberseite zeigt jetzt:** **Nach rechts** oder **Nach links**, wie du davorstehst. Jedes Fach bewegt sich
  mit der Einheit, mit seinen Gegenständen und seinem gedruckten Etikett.
- **Seine Fächer** wird jedes Mal gefragt, weil die Etiketten schon drauf sind:
  - **Neu nummerieren:** jedes Fach bekommt die Nummer, den Namen und den Code des Ortes, an dem es jetzt steht,
    wieder von oben links gezählt. Ein alter Code funktioniert noch: er öffnet das Fach jetzt an dem Ort, den er
    benannt hat. Druck die Etiketten für die neuen Namen nochmal.
  - **Codes behalten:** nur wie es steht, ändert sich. Jedes Fach behält seine Nummer, seinen Namen und seine
    Codes.
- Das Blatt zeigt das neue Raster, bevor du drehst. Ein Name oder Code, den du selbst getippt hast, bleibt bei seinem
  Fach, egal wie.
- **Rückgängig** dreht es zurück, Nummern, Namen und Codes eingeschlossen, solange nichts darin seitdem geändert
  wurde.

### Fächer zusammenführen und aufteilen

Ein Würfeleinsatz oder ein entfernter Regalboden macht zwei oder mehr Fächer zu einem.

- **Zusammenführen oder aufteilen…**, dann tippe Fächer nebeneinander an, die ein Rechteck ergeben, und
  **Zusammenführen**. Das oben links bleibt, mit Nummer, Name und Code. Die anderen gehen in den Papierkorb; ihre Codes
  und gedruckten Etiketten öffnen das zusammengeführte Fach, und was darin war, zieht hinein.
- Um ein zusammengeführtes Fach aufzuteilen, tippe es an und **Aufteilen**. Jede Zelle kommt mit ihrem Code und
  ihrem Etikett zurück; Gegenstände bleiben im oben linken.
- **Rückgängig** kehrt beides um.
- **Deine eigenen Vorlagen:** **Einstellungen → Konto → Vorlagen → Möbel** enthält die eigenen
  Ortsvorlagen des Kontos: Würfel quer und hoch (aufrecht), Regalböden oder Schubladen, die Arten, die Namen und
  das Codemuster, geteilt mit den Standorten, die du wählst. Besitzer und Admins machen sie; jeder, der Orte hinzufügen
  kann, nutzt sie.
- **KI-Apps** können dasselbe: `create_place` nimmt ein `template`, und `update_place` ein `turn`
  ([MCP-Clients](/de/users/mcp-clients/#die-werkzeuge)). Zusammenführen und Aufteilen bleiben in der App.

## Persönlich ausblenden

Jeder bekommt einen **Persönlich**-Standort. Wenn du ihn nicht brauchst, schalte **Persönlich ausblenden** in
**Einstellungen → Profil → Deine Standorte** ein, und aus, um ihn jederzeit wieder zu zeigen. Es ist deine
eigene Einstellung: niemand sonst sieht eine Änderung.

- **Verschwunden aus:** den Standorten im Menü, Home, Listen, Suche und deren Filtern. Ein Modul, das nur
  Persönlich verfolgt (Fahrzeuge zum Beispiel), verschwindet mit ihm aus dem Menü.
- **Unverändert:** alles darin. Ein Link auf Persönlich oder auf einen Gegenstand darin öffnet es immer noch. Ausblenden
  ist aufräumen, nicht schützen: es sperrt nichts.
- **Erinnerungen erreichen dich weiter**, als Benachrichtigungen, im Digest und im Kalender-Feed. Schalte sie in
  **Einstellungen → Profil → Benachrichtigungen** aus, wo Persönlich weiter gelistet ist.
- **Erfassen** startet in deinem anderen Standort, oder in Persönlich, wenn du sonst nirgends Gegenstände hinzufügen
  kannst.
- **Import** bietet die anderen Standorte, die du besitzt oder verwaltest, oder Persönlich, wenn es keine gibt. Ein
  vergangener Import lässt sich aus Aktivität weiter öffnen, wohin er auch ging.
- **Offline verfügbar halten** in **Einstellungen → Dieses Gerät** behält die Zeile von Persönlich, solange ihre Kopie
  auf dem Gerät ist, damit du es ausschalten kannst.
- **Meine Daten exportieren** übernimmt den ersten anderen Standort, den du besitzt, und Persönlich bleibt auf **Einen
  Standort exportieren**. Wenn du keinen anderen Standort besitzt, übernimmt es Persönlich.
- **Dein persönlicher KI-Schlüssel** zahlt auch für einen Standort, den du besitzt und allein nutzt, wenn das Konto
  dieses Standorts keinen eigenen Schlüssel hat. Für einen gemeinsamen Standort zahlt er nie.
- **Der Assistent** lässt Persönlich weg, es sei denn, du öffnest es aus Persönlich. **Verbindungen** (persönliche
  Tokens und verbundene Apps) behalten die Standorte, die du ihnen gegeben hast, versteckt oder nicht.

Du kannst ihn nicht ausblenden, solange er dein einziger Standort ist. Wenn er später dein einziger Standort wird (du
gehst, wirst entfernt, der andere Standort wird gelöscht), zeigt er sich von allein wieder und blendet sich wieder aus,
wenn du einen anderen hast.

## Verwandt

- [Alltagsnutzung](/de/users/everyday-use/) für das größere Bild.
- [Schlagwörter](/de/users/tags/) für das, was ein Gegenstand außer seinem Ort noch ist.
- [Einen Standort teilen](/de/users/everyday-use/#einen-standort-teilen) für das Hineinlassen von Leuten.
