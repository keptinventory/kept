---
title: Raumfotos
description: Fotografiere einen Raum, einen Schrank oder ein Regal, und Kept listet den Inhalt als Entwürfe im Posteingang auf, jeweils mit eigenem Bild, wobei bereits vorhandene Objekte ausgelassen wird.
---

**Raum** ist ein Erfassungsmodus, um Kept schnell zu füllen: mache bis zu fünf Fotos von einem Raum, einem Schrank oder einem Regal, und KI listet jedes Objekt, das sie sieht. Kept führt gleiche Objekte, die in zwei Fotos zu sehen sind, zusammen, lässt heraus, was bereits in Kept ist, und legt den Rest als Entwürfe im Posteingang in diesem Raum ab, jeweils mit einem Bild, das aus dem Foto ausgeschnitten ist.

## Vor dem Start

Der Räumodus liest Fotos mit KI, weshalb er das benötigt, was auch andere KI-Erfassung benötigt:

- **KI-Erfassung** aktiviert im Standort (ein Eigentümer oder Administrator schaltet sie ein, in **Standorteinstellungen → Was zu verfolgen**), und ein KI-Anbieter, der Fotos liest ([KI-Anbieter](/de/users/ai-providers/)).
- Du kannst Dinge im Standort bearbeiten: Mitglieder, Administratoren und Eigentümer. Zuschauer sehen den Modus nicht.

Wenn der Räumodus nicht ausgeführt werden kann, gibt der Modus stattdessen den Grund an, anstatt ihn zu verstecken: 
KI-Erfassung ist im Standort deaktiviert, kein Anbieter, der Fotos liest, ist eingerichtet, oder das KI-Budget ist derzeit aufgebraucht.

## Die Fotos aufnehmen

1. Öffne **Erfassen**, dann **Raum** auf der Modusleiste. Von einer Ortsseite aus öffnet **Aus Fotos füllen** 
   es an diesem Ort; auf der [Ortskarte](/de/users/location-map/) hat eine Raumkarte **Diesen Raum fotografieren**.

2. Überprüfe, wohin die Fotos gehen: der Ort-Chip oben. Eine Raumaufnahme geht in einen Raum, einen Fleck 
   oder eine Box, niemals in den Nicht zugeordneten Bereich.

3. Mache 1 bis 5 Fotos oder wähle sie mit **Galerie** aus. Stelle dich in die Türöffnung und mache pro Wand ein Foto. 
   Jedes Foto wartet in der Leiste, wo du es entfernen kannst.

4. **Senden**. Offline warten die Fotos auf dem Telefon und werden gesendet, wenn es wieder online ist, wie bei jeder Erfassung.

Kept liest die Etiketten in den Fotos auf dem Telefon, bevor sie gesendet werden. 
Ein Objekt, dessen Etikett sichtbar ist, ist mit Sicherheit bekannt, egal wo es sich im Standort befindet.

## Den Raum überprüfen

Der Posteingang zeigt eine **Raum**-Karte am Anfang des Aufnahmebatches, wobei die von ihr erstellten Entwürfe darunter angezeigt werden:

- **Neue Dinge**: jeweils ein Entwurf im Raum, mit seinem eigenen Bild, Namen, Marke, Modell, Farbe und 
  Typ, die dort ausgefüllt werden, wo das Foto sie zeigte. Akzeptiere, bearbeite oder verwerfe sie wie jeden Entwurf, 
  oder **Namen übernehmen** für den gesamten Batch. Ein Entwurf, der einem bereits vorhandenen Ding ähnelt, 
  wird als wahrscheinliches Duplikat gekennzeichnet.
- **Möbel, in denen Dinge liegen** (Regale, Bücherregale, Schränke, Kleiderschränke, Kommoden): 
  **Als Ort hinzufügen** macht jedes zu einem Ort innerhalb des Raums, sodass Dinge hineingelegt werden können. 
  Andere Möbel (ein Sofa, ein Bett, ein Tisch) sind ein Entwurf wie jedes andere Ding.
- **Schon in Kept**: die Dinge, die die Fotos zeigten und die der Raum bereits hat, anhand des gleichen Etiketts, 
  derselben Marke und des gleichen Modells oder desselben Namens. Markiere sie als gesehen und **Als gesehen markieren**. 
  Ein Objekt, dessen Etikett gelesen wurde, ist standardmäßig angekreuzt.
- Jedes Foto sagt, was es lieferte. „Konnte Foto 3 nicht lesen“ bedeutet, dass dieses Foto fehlgeschlagen ist und die anderen 
  noch zählt; „Dieses Foto zeigte mehr; mache ein näheres“ bedeutet, dass es mehr zeigte als ein Foto auflisten kann (60 Objekte).

### Auf der Karte

Wenn der Raum auf der [Ortskarte](/de/users/location-map/) gezeichnet wird, wird jedes akzeptierte Objekt auf der Bodenfläche des Raums 
mit einer Form platziert, die anhand seines Typs und Namens geschätzt wird, in einem freien Bereich. 
Beim nächsten Mal, wenn du **Anordnen** ausführst, listet die Karte auf, was Kept platziert hat, damit du jedes dorthin bewegen kannst, 
wo es tatsächlich steht. Das Platzieren von Objekten durch Kept unterbricht niemals jemanden, der gleichzeitig die Karte anordnet.

## Was es kostet

Jedes Foto entspricht einer KI-Abfrage, und eine Erfassung mit mehr als einem Foto fügt einen kurzen 
Text-only-Aufruf hinzu, der das zusammenführt, was die Fotos gemeinsam haben. Bevor du sendest, 
zeigt die Leiste eine obere Grenze an, beispielsweise „Etwa 3 Fotos · bis zu ~31.000 Tokens · Groq“: 
das Foto, die Anweisungen und die längste Antwort, die Kept pro Foto zulässt; eine kürzere Antwort kostet weniger. 
Ein Modell, das vor dem Antworten nachdenkt, berechnet sein Denken zusätzlich.

Das Lesen von Räumen wird auf die gleichen Budgets und Obergrenzen angerechnet wie andere Fotoauslesungen. 
Wenn eine Obergrenze erreicht ist, zeigt die Karte „Warten auf das KI-Budget“ an, und die Fotos werden gelesen, 
wenn die KI wieder verfügbar ist. Jeder Aufruf erscheint in der **KI-Nutzung** als **Raumfoto** oder **Raumfotos zusammengeführt**.

## Privatsphäre

- Was der Anbieter erhält, ist genauso wie bei jeder Erfassung: eine Kopie jedes Fotos ohne Standort- 
  und Kameradaten, sowie die festen Anweisungen.
- **Die vollständigen Raumfotos werden gelöscht, wenn du die Raumkarte schließt** (Erledigt oder Verwerfen). 
  Jeder Entwurf behält nur sein eigenes ausgeschnittenes Bild.
- **Solange die Raumkarte geöffnet ist, sind ihre Fotos für die Personen privat, die sie überprüfen**: 
  Eigentümer, Administratoren und Mitglieder des Standorts. Zuschauer sehen sie weder auf der Seite des Raums 
  noch auf der Seite des Behälters, in der Suche oder auf ihrem Telefon, und auch kein schreibgeschütztes API-Token, 
  keine schreibgeschützte MCP-Verbindung noch ein Teilungslink sieht sie. Während sie überprüft wird, ist ein Raumfoto 
  niemals das Coverfoto eines Behälters.
- Stattdessen die vollständigen Fotos zu behalten, schaltet ein Eigentümer oder Administrator 
  **Raumfotos nach der Prüfung behalten** in den **Standorteinstellungen → Allgemein** ein. 
  Nach **Erledigt** bleiben sie als gewöhnliche Fotos auf der Raumseite sichtbar und sind für jeden sichtbar, 
  der den Standort sieht.

## In Kept ausprobieren

[Kept ausprobieren](/de/try/kept/) hat keine Kamera und führt keine KI aus: Der Räumodus bietet 
**Ein Beispiel-Raumfoto verwenden**, einen illustrierten Raum, und jedes Raumfoto liefert das gleiche 
Beispielresultat, sodass du die Raumkarte, die Entwürfe und die Möbel ohne Anbieter sehen kannst. 
Die Leiste sagt „Es läuft keine KI in dieser Demo“, während eine echte Installation die Kosten anzeigt.
