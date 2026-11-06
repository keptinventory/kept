---
title: Scan-Sitzungen
description: Einen Raum zählen, Kisten packen oder Dinge verschieben, indem du mit offener Kamera an ihren Etiketten vorbeiläufst. Jedes Etikett im Bild wird gelesen, jedes nur einmal, online oder offline, und nichts ändert sich, bis du abschließt.
---

Eine **Scan-Sitzung** hält die Kamera offen, während du läufst. Jedes Kept-Etikett im Bild wird gelesen,
mehrere gleichzeitig, und einmal gezählt. Nutze sie, um:

- **Zählen** eines Raums, Regals, einer Kiste oder eines ganzen Ortes: Was du scannst, wird als gesehen markiert, und die
  Zusammenfassung zeigt, was fehlt und was woanders aufgetaucht ist.
- **Packen in** Kisten: Alles, was du scannst, landet in der aktuellen Kiste. Scanne die nächste Kiste, um zu wechseln.
- **Verschieben nach** einem Ort oder einer Kiste: Alles, was du scannst, wird dorthin verschoben.

Eine Sitzung fasst bis zu 5.000 Etiketten und funktioniert ohne Verbindung, sobald das Telefon eine Sitzung online geöffnet hat: Der Bildschirm wird beim ersten Verwenden geladen und dann auf dem Telefon behalten.

Eine Sitzung liest QR-Codes und Barcodes. Ein Etikett ohne QR-Code (schmales Etikettendrucker-Band) öffnet stattdessen einzeln aus **Scannen** über seine gedruckte Kurz-ID ([Scannen eines Codes ohne QR-Code](/de/users/short-ids/#scannen-eines-codes-ohne-qr-code)).

## Sitzung starten

- **Scannen → Sitzung starten**, dann wähle aus, was zu tun ist und wo.
- Von der Seite eines Ortes: **Hier zählen**.
- Vom Menü einer Kiste: **Diese Kiste zählen** oder **In diese Kiste packen**.
- Von der Seite einer Verschiebung: **Kisten packen**.
- Von der Karte eines Raums auf der Karte: **Diesen Raum zählen**.

Wenn der Ort noch nicht gewählt ist, wähle ihn aus der Liste oder tippe auf **Sein Etikett scannen**.

Für eine Zählung eines Ortes ist **Orte darin einbeziehen** standardmäßig aktiviert. Aktiviere **Eine von dir gescannte Kiste zählt, was in ihr ist**, wenn du Kisten zählst, ohne sie zu öffnen.

## Während du scannst

| Du scannst | Zählen | Packen in, Verschieben nach |
|---|---|---|
| Ein Ding auf der Liste | Gefunden, grün, der Zähler steigt | Hinzugefügt, grün |
| Dasselbe Etikett erneut | Ein leiser Ton, keine Zählung | Dasselbe |
| Ein Ding aus einem anderen Ort hier | Bernstein: **Woanders gefunden**, mit dem Ort, wo es sein sollte | Hinzugefügt |
| Ein Ding aus einem anderen Standort | Bernstein, mit dem Standort | Hinzugefügt, wenn du beides bearbeiten kannst |
| Ein Ding in einem Ort, den du nur ansehen kannst | Grau: **Hier nur ansehen** | Grau, nicht hinzugefügt |
| Das Etikett eines Ortes | Kept schlägt vor, es von seiner eigenen Seite zu zählen | Abgelehnt: Ein Raum kann nicht verschoben werden |
| Ein leeres Etikett oder ein Code auf mehreren Dingen | Für die Zusammenfassung behalten | Dasselbe |
| Ein Produkt-Barcode | Dem Ding zugeordnet, das ihn trägt | Dasselbe |
| Eine Seriennummer oder Asset-Tag (Data Matrix, Code 39…) | Dem Ding zugeordnet, das sie hat, online | Dasselbe |
| Ein Code, den dieses Telefon offline nicht kennt | **Später prüfen** | Dasselbe |

Der Zähler zeigt "312 von 340" für eine Zählung. Jedes Lesen spielt einen kurzen Ton ab und zeichnet einen Rahmen um das Etikett: grün für einen neuen Fund, Bernstein für woanders, grau für alles andere.

- **Letzten Scan zurücknehmen** nimmt das letzte zurück.
- **Pause** stoppt die Kamera. Eine Minute ohne Lesungen pausiert sie ebenfalls.
- **Ziel** (Packen in, Verschieben nach): tippe darauf und scane dann die nächste Kiste oder den nächsten Ort.
- **USB- oder Bluetooth-Barcode-Scanner** funktionieren auf demselben Bildschirm: Was sie eingeben, wird wie ein Etikett gelesen.
- **Licht** wird auf Telefonen angezeigt, die eine haben (Android).

Schließe die App, lade neu oder verliere den Akku: Die Sitzung bleibt auf dem Telefon. **Scannen → Sitzung fortsetzen** nimmt sie wieder auf.

## Abschließen und speichern

**Abschließen** zeigt die Zusammenfassung. Noch nichts hat sich geändert.

- **Gefunden**: als gesehen markiert, zum Zeitpunkt, an dem jedes Etikett gelesen wurde.
- **Fehlt**: standardmäßig unverändert. Wähle für jedes **Als nicht hier markieren** oder **Alle als nicht hier markieren**.
- **Kein Etikett**: Dinge auf der Liste ohne Etikett. Hake die an, die du gesehen hast.
- **Woanders gefunden** und **In einem anderen Standort**: unverändert, oder **Hierher verschieben**.
- **Nicht zugeordnet**: leere Etiketten und Codes, die zu mehreren Dingen passen. Jedes leere Etikett hat **Vergeben**: eine neue Kiste, ein bestehendes Ding oder ein bestehender Ort. Klebe leere Etiketten an Regale und Türen, scanne sie alle in einem Durchgang und vergib sie hier.

Eine Zählung listet auch auf, was verliehen oder in Reparatur ist (nie fehlend), und was sich in einem Ort darin befindet, den niemand gezählt hat (**Nicht gezählt**, bis du **Ich habe nachgesehen** tippst). Ein Ding, das in einer Anzahl gezählt wird, hat **−** und **+** in seiner Zeile. Jedes Ergebnis wird aufbewahrt: siehe [Zählungen und Inventuren](/de/users/counts/).

**Speichern** sendet die Sitzung. Offline wartet sie auf dem Telefon und wird gespeichert, sobald du wieder online bist. Die Sitzung ist ein Eintrag in **Aktivität**, "Gezählte Garage: 312 von 340", mit **Rückgängig** für 7 Tage. Rückgängig stellt jedes Sichtungsdatum, jedes "nicht hier" und jede Verschiebung wieder her, es sei denn, etwas hat sich seitdem geändert.

Ein Ding, das während deines Durchgangs weggeworfen wurde, bleibt beim Speichern aus, und die Zusammenfassung nach dem Speichern sagt, wie viele das waren.

## Wer was tun kann

| | Eigentümer, Admin, Mitglied | Betrachter |
|---|---|---|
| Zählen | Gespeichert | Eine Kontrolle: derselbe Bildschirm und dieselben Summen, nichts gespeichert |
| Packen in, Verschieben nach | Wo du beides bearbeiten kannst: das Ding und wohin es geht | Nicht angeboten |

Wenn sich deine Rolle ändert, während du läufst und du dort nicht mehr bearbeiten kannst, wird das Speichern abgelehnt und die Sitzung bleibt mit ihrer Zusammenfassung auf dem Telefon.

## Grenzen auf dem iPhone

- Keine Erschütterung: Web-Apps können auf dem iPhone nicht vibrieren. Der Ton und die farbige Box tragen jedes Lesen.
- Der Bildschirm kann in der installierten App immer noch verdunkeln: Halte ihn in **Einstellungen → Anzeige & Helligkeit → Automatische Sperre** wach, während du eine große Zählung läufst.
- Das Lesen kann auf älteren iPhones langsamer sein. Halte das Telefon ein wenig weiter von dicht gepackten Etiketten, damit mehrere ins Bild passen.
- Keine Lichtsteuerung über das Web.
