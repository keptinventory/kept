---
title: Kurze IDs und Etiketten
description: Sechsstellige IDs, Etiketten drucken auf Blättern, Rollen und Etikettiererband, was der Scanner mit jedem Code macht, den er liest, Scannen eines Codes ohne QR-Code und welchen Code Kept wo behält
---

Wenn ein neues Ding auf den Server kommt, bekommt es eine kurze ID: sechs Buchstaben und Ziffern, wie `7KQ-4MZ`, die nie wiederverwendet wird. Bis dahin zeigt es **ID ausstehend**. Ein Etikett trägt die ID als Text und, auf allen Druckmaterialien außer schmalem Etikettiererband, in einem QR-Code, der das Ding öffnet. Ein Etikett behält seinen Code dauerhaft, sodass ein verlorengegangenes mit demselben Code nachgedruckt wird.

Listen, Suchergebnisse und die ⌘K-Palette zeigen ein Ding bei seinem Namen. Sein Code erscheint dort als bernsteinfarbenes Etikettenband nur, sobald es ein gedrucktes Etikett hat: ein Etikett, das mit **Gut gedruckt?** bestätigt wurde, oder ein leeres Etikett, das dafür beansprucht wurde. Der Inhaltsbogen einer Umzugskiste zählt auch, sobald er auf die gleiche Weise bestätigt wurde ([Moving house](/de/users/moving/)). Bernstein bedeutet „dieses ist etikettiert“. Auf seiner eigenen Seite zeigt ein Ding oder Ort ohne gedrucktes Etikett seinen Code klein und grau, nach dem Rest; eines mit einem Etikett zeigt das Band. Ein Ding mit mehr als einem Etikett (zum Beispiel ein dafür beanspruchtes leeres Etikett) zeigt den Code des zuletzt gedruckten. Suche und Scanner finden ein Ding über jeden seiner Codes.

## Drucken

**Drucken** (Etiketten im Menü, oder **Etikett** auf einem Ding): wähle, was zu drucken ist (eine Auswahl, **Alles etikettieren, was noch kein gedrucktes Etikett hat** an einem Ort oder Platz, oder ein **leeres Blatt**), wähle das **Etikettenmaterial**, lege fest, wo auf einem teilweise benutzten Blatt gestartet wird, und drucke aus dem Browser. Die **Blattvorschau** ist der Druck selbst, nur kleiner: dieselben QR-Codes, Namen und Orte, auf dieselben Zeilen umbrochen. Ein Name wird nie abgeschnitten: ein langer bricht um und seine Schrift wird kleiner, und einer, der immer noch nicht passt, wird vor dem Druck aufgelistet, mit einem Link zum Umbenennen. Die Seite ist auf das Papier des Blatts ohne Ränder eingestellt, sodass die Standardeinstellungen des Druckdialogs (Skalierung 100 %) jedes Etikett in seine Zelle setzen.

| Material | Größe | Jedes Etikett |
|---|---|---|
| A4-Blatt, 24 Etiketten | 70 × 37 mm, 3 × 8 | QR-Code, kurze ID, Name und Ort |
| A4-Blatt, 65 Etiketten | 38 × 21 mm, 5 × 13 | QR-Code und kurze ID |
| Letter-Blatt, 30 Etiketten (Avery 5160 layout) | 67 × 25 mm, 3 × 10 | QR-Code, kurze ID, Name und Ort |
| Etikettendrucker-Rollen | 50 × 30, 40 × 30 und 62 × 29 mm | QR-Code, kurze ID, Name und Ort |
| Etikettiererband, 9 und 12 mm (Brother TZe and similar) | 40 und 50 mm lang | Kurze ID in großer Schrift und der Name. Kein QR-Code |
| Etikettiererband, 18 und 24 mm | 50 und 60 mm lang | QR-Code, kurze ID in großer Schrift und der Name |

Rollen und Band drucken ein Etikett pro Seite, in der Größe des Etiketts: im Druckdialog den Etikettendrucker und diese Größe wählen. Für eine Etikettierer-App, die Bilder nimmt, macht **Als Bilder teilen** ein PNG pro Etikett. Schmales Band hat keinen Platz für einen scannbaren QR-Code, daher trägt es stattdessen die kurze ID groß: der Scanner liest sie aus dem Text ([Scannen eines Codes ohne QR-Code](#scannen-eines-codes-ohne-qr-code)).

Danach fragt **Gut gedruckt?** nach der Charge, die gerade gedruckt wurde, und protokolliert sie; von da an zeigen diese Dinge und Orte das bernsteinfarbene Band. **Letzte Chargen** zeigt, was jede enthält, wann und wo sie erstellt wurde und ob sie gedruckt hat; eine noch nicht bestätigte kann dort als **Gut gedruckt** oder **Nicht gedruckt** markiert werden und druckt mit denselben Codes nach. Druckt man dieselben Dinge erneut, während ihr Blatt noch unbestätigt ist, wird stattdessen dieses Blatt angeboten, nicht ein neues. Dinge, deren ID noch ausstehend ist, können noch nicht gedruckt werden.

## Scannen

**Scannen** auf der Startseite und der Suche öffnet die Kamera.

| Du scannst | Kept |
|---|---|
| Ein Kept-Etikett für etwas, das du siehst | Öffnet es und markiert es gerade als gesehen |
| Ein Kept-Code, gedruckt ohne QR-Code (schmales Band) | Öffnet es, aus dem Text gelesen, oder fragt zuerst **Ist das der Code?**, wenn das Lesen nicht eindeutig ist ([unten](#scannen-eines-codes-ohne-qr-code)) |
| Ein leeres Etikett | Bietet **Neue Kiste hier**, **An ein vorhandenes Ding hängen** oder **An einen vorhandenen Ort hängen** (einen Raum, ein Regal oder einen Platz) an |
| Ein Produktbarcode | Bietet an, es als neues Ding hinzuzufügen; mit vom Admin eingeschalteter Barcode-Suche wird es aus Open Food Facts, Open Products Facts oder Open Beauty Facts benannt |
| Eine Seriennummer oder ein Asset-Tag, das ein Ding hat | Öffnet dieses Ding |
| Ein Barcode, den ein Ding hat | Öffnet dieses Ding; bei mehreren Dingen wird gefragt, welches |
| Ein Code, den noch nichts hat | Nennt seinen Typ und bietet an, es als neues Ding hinzuzufügen, wobei der Code als Barcode oder Seriennummer behalten wird |
| Ein Homebox-Etikett, nach einem [Homebox-Import](/de/users/import-export/) | Öffnet das importierte Ding |
| Alles andere | Sagt, dass es kein Kept-Etikett ist |

Ein für einen Ort beanspruchtes Etikett zeigt sich auf ihm als bernsteinfarbenes Band, wie eines, das für ihn gedruckt wurde. Beanspruchen funktioniert offline: es wartet auf dem Telefon, bis es synchronisiert, und wenn ein anderes Telefon dasselbe Etikett zuerst beansprucht hat, wird gesagt, was es hat. Mitglieder, Admins und Besitzer können beanspruchen; Betrachter können nicht.

Um einen Ort zu etikettieren, auf den du schon ein leeres Etikett geklebt hast, öffne den Ort und wähle **Etikett-Code hinzufügen** (unter Verwalten): der Scanner öffnet sich und das gescannte leere Etikett bietet diesen Ort zuerst an.

Ein Etikett bleibt bei dem, worauf es klebt. Wenn [Fächer zusammengeführt werden](/de/users/locations/#fächer-zusammenführen-und-aufteilen), öffnen die Etiketten der entfernten Fächer das zusammengeführte Fach; eine Teilung gibt jedem sein Etikett zurück. Wenn Möbel [gedreht werden](/de/users/locations/#möbel-drehen), behält jedes Fach sein Etikett, egal ob es neu nummeriert wird oder nicht.

Die Codes, die Kept liest, und wo ein neues Ding sie aufbewahrt:

| Code | Meist auf | Kept behält es als |
|---|---|---|
| QR-Code | Kept-Etiketten, Homebox-Etiketten | Das Etikett |
| EAN-13, EAN-8, UPC-A, UPC-E | Produkte | Barcode |
| Code 128, Codabar | Shop-, Asset- und Bibliotheksetiketten | Barcode |
| ITF-14 | Kartons | Barcode, wenn seine Prüfziffer stimmt; sonst wählst du |
| Code 39, Code 93 | Asset-Tags, IT-Aufkleber | Seriennummer, oder Barcode, wenn du ihn wählst |
| Data Matrix | Elektronik, Ladegeräte, Teile | Ein GS1-Code: seine GTIN als Barcode und seine Seriennummer als Seriennummer. Reiner Text: du wählst |
| PDF417, Aztec | Versandetiketten, Garantiekarten, Tickets | Du wählst; Text, der für beide Felder zu lang ist (64 Zeichen für einen Barcode, 100 für eine Seriennummer), wird nicht behalten |

Ein Kept-Etikett hat in all diesen Fällen Vorrang. Eine Seriennummer wird nur bei exakter Übereinstimmung mit der gespeicherten erkannt, und nur online: die Offline-Kopie des Telefons enthält keine Seriennummern. GS1-Codes mit Klammern, wie `(01)04006381333931(21)K7Q2X9`, werden auf die gleiche Weise gelesen.

Ein abgenutztes Etikett oder keine Kamera: **Code eingeben**. Die Capture-Kamera erkennt Kept-Etiketten ebenfalls und bietet an, diese Kiste zu öffnen oder darin zu erfassen.

### Scannen eines Codes ohne QR-Code

Ein Etikett ohne QR-Code (schmales Band) scannt über seine gedruckte kurze ID. Richte **Scannen** auf den Code, sodass er etwa ein Drittel der Kamerabreite ausfüllt, und halte einen Moment still: Kept liest die sechs Zeichen aus dem Text und öffnet das Ding, wie es von einem QR-Code täte, und eine Meldung sagt, welchen Code es gelesen hat.

- **Auf dem Telefon, auch offline.** Das Lesen geschieht auf dem Telefon; das Bild wird nirgendwohin gesendet. Es funktioniert ohne Verbindung für alles in der Kopie des Telefons.
- **Nie das falsche Ding.** Kept öffnet einen Code nur, wenn es jedes Zeichen zweimal hintereinander klar gelesen hat und der Code einer von deinen ist. Wenn es sich nicht sicher ist, zeigt es den gelesenen Code und was es öffnet, und fragt **Ist das der Code?**, bevor es öffnet. Ein Code, der zu keinem deiner Etiketten passt, öffnet nichts: **Erneut scannen** oder **Code eingeben**.
- **Nur Kepts eigener Druck.** Es liest die kurze ID so, wie Kept sie druckt, in seiner eigenen Schriftart. Ein Code, der per Hand in einen Etikettierer getippt wurde, in der Schrift des Etikettierers, liest vielleicht nicht: tippe ihn stattdessen ein.

Nur **Scannen** liest gedruckte Codes. Scan-Sitzungen, die Kistenprüfung und die Erfassungskamera lesen
nur QR-Codes und Barcodes.

## Verwandte Themen

- [Scan-Sitzungen](/de/users/scanning-sessions/) zum Scannen einer ganzen Kiste auf einmal.
- [Tags](/de/users/tags/) um zu sagen, was ein Ding sonst noch ist.
- [Tägliche Nutzung](/de/users/everyday-use/) für das größere Bild.
