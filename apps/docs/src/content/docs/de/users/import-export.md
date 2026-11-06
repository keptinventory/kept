---
title: Import und Export
description: Dinge aus einer Tabelle, Homebox oder einem anderen Kept importieren und einen Standort als vollständigen Export mitnehmen – mit einer Kopie, die ohne Kept lesbar ist.
---

Import und Export liegen in **Einstellungen → Import** und **Einstellungen → Export**. Beides ist für **Eigentümer und Admins** eines Standorts, läuft im Hintergrund auf dem Server und braucht eine Verbindung. Zum Verschieben eines ganzen Servers oder eines Haushalts zwischen Servern siehe auch
[Umzug auf einen neuen Server](/de/admin/move-server/).

## Importieren

**Einstellungen → Import** fragt, woher es kommt:

| Quelle | Was es ist |
|---|---|
| **Eine Tabelle (CSV)** | Ein Gegenstand pro Zeile, mit einer Kopfzeile, die die Spalten benennt; auch den eigenen Tabellen-Export von Homebox |
| **Ein Homebox-Export** | Das ZIP aus Homebox v0.26.1 oder neuer, v0.27.0 empfohlen (Collection → Tools → Backup & Restore → Create Backup → Download) |
| **Ein Kept-Export** | Ein Standort, der aus diesem Kept oder einem anderen exportiert wurde |

Jeder Import wird geprüft, bevor etwas geschrieben wird: **Import prüfen** zeigt **Was der Import
machen wird**, Zeile für Zeile, mit dem Grund für alles, was übersprungen wird. Dann läuft er mit einem Fortschrittsbalken.
Du kannst die Seite verlassen; der Import läuft weiter, und Einstellungen → Import zeigt, wie weit er gekommen ist. Bricht er ab, macht **Fortsetzen** ab der letzten Zeile weiter. **Import abbrechen** behält, was schon importiert wurde.

Einen Import erneut laufen zu lassen überspringt, was er schon geholt hat, also gibt ein erneuter Lauf nie Duplikate. Ein Archiv (ein ZIP) kann bis zu 5 GB groß sein. Importierte Dinge kommen bestätigt an, nicht im Posteingang.

### Eine Tabelle (CSV)

1. **Datei wählen** und den Standort, in den es geht: einer, der dir gehört oder den du verwaltest. Eine Datei nimmt höchstens 10.000 Zeilen (8 MB); teile eine größere auf. Unter der Datei listet **Die Spalten, die Kept liest** jede Spalte, die Kept versteht, und **Beispiel-CSV herunterladen** gibt eine kleine Datei zum Starten.
2. **Spalten zuordnen.** Für jede Spalte wähle das Feld, in das sie geht, einschließlich **Ein Feld des Typs …** für deine eigenen Typfelder. Eine Spalte muss der Name sein: jedes Ding braucht einen.
3. **Ein paar Entscheidungen:**
   - Eine Orts-Spalte wie `Garage > Shelf A` macht die Räume und Plätze: wähle den Trenner und ob du **Orte anlegen, die die Datei nennt und die es noch nicht gibt**.
   - Wohin Zeilen ohne Ort gehen (standardmäßig Nicht platziert).
   - Wie Daten geschrieben werden (aus der Datei ermittelt, wo es geht) und die Währung für Zeilen ohne.
   - **Typ-Spalte per Name deinen Typen zuordnen**, in einer von Kepts Sprachen; ausgeschaltet bleibt der Typ in den Notizen.
4. **Import prüfen**, Bericht lesen und importieren.

Die Spalten, die Kept liest: Name, Menge, Ort, Typ, Marke, Modell, Seriennummer, Barcode, Farbe,
Zustand, Notizen, Tags, andere Namen, Kaufdatum, Preis, Währung, Laden, Manuallink, der Code eines alten Labels, dein eigener Code, eine Zeilen-ID (damit ein erneuter Import die Zeile überspringt) und die eigenen Felder deiner Typen.
Kopfzeilen werden in einer von Kepts Sprachen für dich zugeordnet. Tags und andere Namen werden durch Kommas getrennt, ein Preis ist eine Zahl ohne Währungszeichen, und Daten werden in der ganzen Datei einheitlich geschrieben.

#### Die Homebox-Tabelle

Jedes Homebox kann ein Tabellenblatt exportieren (bis v0.25: **Tools → Import/Export → Export
Inventory**). Homebox v0.10.3 und v0.11.0 schreibt es tabulatorgetrennt
(`homebox-items.tsv`); Kept liest beides. Wenn die Spalten die von Homebox sind (`HB.name`,
`HB.location`, …), sagt Kept das, ordnet die Spalten selbst zu und liest, was ein einfacher Tabellen-Import
weglassen würde:

| Homebox-Spalte | Kept |
|---|---|
| `HB.asset_id`, and the item's link in `HB.url` (v0.13 and later) | Alte Labels: ein gedrucktes Homebox-Label öffnet das Ding |
| `HB.sold_*` | Mit einem Käufer oder einem Preis: das Ding endete als verkauft, mit Datum, Käufer, Notizen und Preis. Ein reines Verkaufsdatum bleibt in den Notizen |
| `HB.archived` | Deine Wahl: **Archiviert** (Standard: auch in Kept archiviert, bleibt deins, weggelegt), **In Gebrauch** oder **Weglassen**. Eines mit Verkauf endet verkauft |
| `HB.warranty_expires`, `HB.lifetime_warranty` | Eine Garantie ab Kaufdatum, wo Garantien an ist |
| `HB.warranty_details`, `HB.insured` | Zeilen in den Notizen |

Ein Preis von 0 wird als kein Preis gelesen (Homebox schreibt 0, wenn keiner gesetzt war). Die Standortzeilen, die ein v0.26- oder späteres Tabellenblatt auflistet, werden weggelassen; Orte kommen aus dem Ortspfad jedes Artikels. Eine Tabelle kann keine Fotos, Dateien, Wartung oder Artikel in Artikeln tragen, und eigene Felder werden nur importiert, wenn du sie einem Feld eines Typs zuordnest. Für all das nutze das Export-ZIP.

### Ein Homebox-Export

Kept liest das eigene Export-ZIP von Homebox, das alles enthält, auch die Dateien. In Homebox öffne **Collection → Werkzeuge → Backup & Restore**, wähle **Create Backup** und **Herunterladen** das Backup, sobald es aufgelistet ist. Es existiert ab Homebox v0.26: nutze v0.26.1 oder neuer (das Docker-Image von v0.26.0 verliert Anhänge) und v0.27.0, wenn du kannst. Ein Homebox älter als v0.26 hat keinen Export: siehe
[von einem älteren Homebox kommen](#von-einem-älteren-homebox-kommen). Ein ZIP ohne Homebox' `manifest.json` wird mit diesem Hinweis abgelehnt.

:::tip[Wenn Homebox "Topic has been Shutdown" sagt]
Homebox v0.26 macht bei jedem Start einen Export. Starte Homebox neu und exportiere erneut, oder aktualisiere auf v0.27.0, das diese Einschränkung nicht hat.
:::

Nach dem Hochladen zeigt Kept die Collection und ihr Exportdatum. Es geht in **Ein neuer Standort**
oder **Ein Standort, den du verwaltest**, wo Dinge, die schon dort sind, bleiben und ein erneuter
Lauf nur das Neue hinzufügt. Ein neuer Standort wird erst gemacht, wenn du **Import** drückst, nicht davor: ein Import, den du in seiner Prüfung lässt, hinterlässt nichts. **Mit Homebox verbinden (optional)** liest die Währung der Collection, die das ZIP nicht trägt: gib Homebox' Adresse
und einen API-Schlüssel oder eine E-Mail und ein Passwort an. Sie werden einmal genutzt und nie gespeichert.

Für einen neuen Standort kommt als Nächstes **Was erfasst wird**: **Basis** (Räume, Kisten, Labels und Suche),
und darüber hinaus angehakt, was das Backup nutzt: **Preise bei 10 Dingen** schaltet Geld an, **5
Garantien** schaltet Garantien an, **2 Wartungseinträge** schaltet Zeitpläne an. Hake eines ab und
diese Daten bleiben als Text in den Notizen der Dinge, was später nicht zu Einträgen werden kann. Ein Backup ohne
jedes davon startet allein mit Basis. **Auch für Persönlich** gibt deinem Persönlichen Standort das Gleiche, sodass das Menü nur zeigt, was du erfasst. Ändere beides jederzeit in **Standorteinstellungen → Was erfasst wird**; etwas auszuschalten löscht nie etwas.

Dann wähle:

- **Preise sind in**: die Währung, nur gefragt, wenn das Backup Preise hat. Eines zu wählen benennt die Beträge um; es rechnet nicht um.
- **Archivierte Artikel**: **Archiviert** (Standard: auch in Kept archiviert, bleibt deins, weggelegt),
  **In Gebrauch** oder **Weglassen**. Ein archivierter Artikel mit Käufer oder Preis endet verkauft.
- **Artikel mit Menge 0**: **0 behalten oder archivieren** (Standard: ein Typ, den du aufbrauchst, behält 0, alles andere kommt archiviert), **Auf 1 setzen** oder **Weglassen**. Jeder, der kommt, hat "Quantity in Homebox: 0" in seinen Notizen. Ein Artikel, der andere Artikel hält, wird für seine 0 nie archiviert oder weggelassen, und ein Standort, der zur Kiste wird, hat keine Menge zu prüfen.
- **Ein "Insured"-Ja/Nein-Feld hinzufügen** und **Die Start-Orte und -Tags von Homebox weglassen** (die
  acht Räume und sechs Tags, mit denen jede neue Homebox-Collection startet, wenn sie ungenutzt sind).
- **Diese sehen nach Kisten aus**: Orte, die wie eine Kiste oder ein Behälter benannt sind (Box 01, Bin 2, Kiste 3 …), die keinen anderen Ort halten. Hake sie an oder **Alle wählen**, und sie kommen als Kisten: Dinge, die Dinge halten, mit ihren Tags und dem, was darin ist. Der Rest kommt als Orte.
- **Eigene Felder**: für jedes **Zum Typ hinzufügen** oder **In den Notizen behalten**.
- **Typen**: für jeden Homebox-Typ ein Kept-Typ, **Neuer Typ…** mit einem Namen, den du tippst, oder **Kein
  Typ**. Die eigenen Typen von Homebox 0.27, `global.item` und `global.location`, lesen sich als **Artikel** und
  Standort, wie in Homebox; der Sammeltyp **Artikel** beginnt als **Kein Typ**.

Die Prüfung listet jeden Eintrag, der einen Blick braucht, jeweils mit dem, was in Worten mit ihm geschehen ist, und die Seite des Imports behält diese Liste nach dem Import: öffne sie aus **Aktivität** (Ran an import).

Was herüberkommt:

| Homebox | Kept |
|---|---|
| Collection | Ein Standort |
| Locations (nested) | Räume und Plätze, Baum bleibt |
| Items | Dinge; ein Artikel, der andere hält, wird zur Kiste, nie sein ganzer Typ |
| Manufacturer, model, serial | Marke, Modell, Seriennummer |
| Purchase date, shop and price | Ein Kauf mit seinem Laden |
| Warranty, lifetime warranty | Eine Garantie |
| Sold details | Mit Käufer oder Preis (mehr als 0): das Ding endete verkauft, mit Datum, Preis, Käufer und Notizen. Ein reines Verkaufsdatum ist kein Verkauf: das Ding bleibt in Gebrauch, das Datum in den Notizen |
| Tags | Tags mit ihren Farben (geschachtelte Tags abgeflacht) |
| Photos, manuals, receipts, warranty files | Fotos, Handbücher, die Quittung des Kaufs, das Dokument der Garantie |
| Links | Links. Ein Link zu einem Dokument des [Paperless-ngx](/de/users/paperless/), mit dem der Standort verbunden ist (gleiche Adresse), kommt als Paperless-Link, wie **Aus Paperless verknüpfen** ihn macht, mit dem Titel aus Paperless (der von Homebox, wenn Paperless keinen geben kann; der Bericht sagt wie viele); verbinde Paperless vor dem Import |
| Completed maintenance | Serviceeinträge |
| Scheduled maintenance | Einmalige Zeitpläne |
| Templates | Kontovorlagen, soweit sie sich zuordnen lassen |

Notifiers, Mitglieder und Rollen werden nicht importiert. Wo in dem Standort ein Modul aus ist, bleibt der Text dieses Eintrags in den Notizen des Dings. Die Beschreibung eines Standorts wird nicht behalten (Orte haben keine Notizen); die Prüfung nennt jeden.

Homebox schreibt Daten, die niemand getippt hat: manche Upgrades füllen leere Datumsfelder, und ein Backup kann ein leeres Datum als letzten Tag des Jahres 0 tragen. Kept liest ein Datum vor dem Jahr 1000 als kein Datum, und ein Verkauf braucht einen Käufer oder einen Preis.

#### Einen früheren Import reparieren

Importe vor Kept 1.13.0 machten aus einer Menge von 0 eine 1, machten einen ganzen Typ zum Kistentyp, wenn eines seiner Dinge ein anderes hielt (sodass jedes Ding davon auf einem leeren Inhalt-Tab öffnete), und konnten einen Typ namens `global.item` anlegen. Importe vor 1.14.1 beendeten ein Ding als verkauft, wenn Homebox nur ein Verkaufsdatum hatte. Öffne den Import aus **Aktivität** (Ran an import): **Diesen Import reparieren** listet, was es richtigstellen kann, namentlich:

- **Die Dinge archivieren, die in Homebox Menge 0 hatten** (noch in Gebrauch, mit Menge 1);
- **Den Typ wieder zu einem gewöhnlichen Typ machen** (ein Ding, das Dinge hält, bleibt eine Kiste);
- **`global.item` in Artikel umbenennen**;
- **Die Dinge, die aufgrund eines alleinigen Datums als verkauft markiert waren, wieder in Gebrauch setzen**: verkauft ohne Käufer und ohne Preis und seitdem nicht geändert. Ein in Homebox archivierter Artikel kommt auch zurück in Gebrauch: archiviere ihn erneut per Hand.

Hake an, was du willst, und drücke **Reparieren**. Ein **Rückgängig** macht alles rückgängig.

**Alte Labels funktionieren weiter.** Jede Homebox-Asset-ID (`000-001`) wird gemerkt und unter
**Deine Codes** auf dem Ding aufgelistet. Kepts Scanner erkennt ein Homebox-Label und öffnet das importierte Ding; wenn du den alten Homebox-Hostnamen auf Kept lenkst, funktioniert das Scannen mit der eigenen Kamera des Telefons auch. Die langen Artikel- und Standort-IDs von Homebox (die in den Label-Links) werden zum Scannen gemerkt, aber nicht aufgelistet. Importierte Dinge bekommen eigene Kept-Codes, die so lange aus den Listen bleiben, bis du ihre Labels druckst.

### Von einem älteren Homebox kommen

Ein Homebox älter als v0.26 kann das Export-ZIP nicht erstellen. Zwei Wege hinein:

- **Alles, Fotos und Wartung eingeschlossen:** aktualisiere eine Kopie von Homebox auf v0.27.0 und exportiere das ZIP aus der Kopie. Getestet von Homebox v0.10.3 (der letzten Version des Originals `hay-kot/homebox`) direkt auf v0.27.0.
- **Schneller, mit weniger:** importiere seine [Tabelle](#die-homebox-tabelle).

Das Upgrade kann nicht rückgängig gemacht werden (ab v0.23 sagen das Homebox' eigene Notizen), daher läuft es auf einer Kopie und dein Homebox bleibt, wie es ist:

1. **Stoppe Homebox und kopiere seinen Datenordner**, den, der bei `/data` eingehängt ist (`homebox.db` mit seinen `-wal`- und `-shm`-Dateien und den Anhängen). Behalte das Original als Backup.
2. **Starte Homebox v0.27.0 auf der Kopie.** Homebox lebt jetzt unter
   `ghcr.io/sysadminsmedia/homebox`; v0.26 und später brauchen `HBOX_AUTH_API_KEY_PEPPER`, 32 oder
   mehr zufällige Zeichen:

   ```sh
   docker run --rm -p 7745:7745      -e HBOX_AUTH_API_KEY_PEPPER="$(openssl rand -hex 24)"      -v /path/to/homebox-copy:/data      ghcr.io/sysadminsmedia/homebox:0.27.0
   ```

   Der erste Start aktualisiert die Datenbank in einem Zug. Es fügt auch die acht Start-Räume von Homebox hinzu, die Kept standardmäßig auslässt, wenn sie leer sind.
3. **Melde dich an** mit deinem üblichen Konto und öffne **Collection → Werkzeuge → Backup & Restore**.
   Wähle **Create Backup**, dann **Herunterladen** das Backup, sobald es aufgelistet ist.
4. **Importiere es in Kept** als [Ein Homebox-Export](#ein-homebox-export).
5. Stoppe die Kopie und lösche sie, sobald der Import erledigt ist.

Fotos, die hinzugefügt wurden, bevor Homebox Dateitypen aufzeichnete, kommen auch durch: Kept prüft jede Datei selbst.

### Ein Kept-Export

Ein Kept-Export kommt immer als **Ein neuer Standort**, mit seinen Dingen, Orten, Dateien, Zustandsprotokollen, Umzügen und Verlauf und der Position des Standorts, falls er eine hat (für
[Wo ich bin vorschlagen](/de/users/phone-app/#kamera-galerie-und-scannen)). Enthält er Geheimniswerte, **Geheimnisse öffnen** mit der Passphrase, die beim Export gewählt wurde; ohne sie wird alles andere importiert. Sie zu öffnen braucht HTTPS: über einfaches HTTP sagt es der Import-Bildschirm und importiert den Rest. **Personen zum Einladen** listet, wer den Standort geteilt hat; niemand wird durch den Import eingeladen, also lade jede Person selbst ein.

**Zustandsprotokolle** kommen mit ihren Tagen, Notizen, Räumen und Fotos zurück, und jedes Foto behält die Zeit, die Kept es zuerst erhalten hat. Ein beendetes Protokoll kommt zur gleichen Zeit beendet zurück und bleibt gesperrt. Auf dem neuen Server stehen die Fotos und die Fertigstellung unter dem Namen der Person, die sie importiert hat; der Verlauf zeigt weiter, wer vor dem Import jedes Ding getan hat.

**Umzüge** kommen mit ihren Kisten zurück: die Nummer jeder Kiste, ihr Zustand und der Raum, in den sie geht, und ein erledigter Umzug ist wieder erledigt. Ein Umzug zu einem anderen Standort kommt als Umzug innerhalb des neuen, mit seinen Räumen, die neu zu wählen sind.

Ein Export, der von einem neueren Kept gemacht wurde als der Server, in den du importierst, kann abgelehnt werden: aktualisiere zuerst diesen Server.

### Die LubeLogger-Historie eines Fahrzeugs

Auf der Übersicht eines Fahrzeugs nimmt **Aus LubeLogger importieren** die CSV, die LubeLogger für ein Fahrzeug exportiert: seinen Kraftstoff, seine Serviceeinträge (Reparaturen und Upgrades auch) oder seine Kilometerstände, eine Datei nach der anderen. Kept liest die Datei, sagt, welche Art sie ist, und rät, wie Daten und Dezimalzahlen geschrieben werden (LubeLogger schreibt sie in der Sprache seines Servers); ändere eine von beiden, wenn der Tipp falsch ist, und sage, ob Kraftstoff in Litern oder Gallonen ist. **Prüfen** zeigt, was hinzugefügt würde und welche Zeilen nicht, und warum; **Import** fügt sie hinzu, älteste zuerst, mit ihren Kilometerständen. Die gleiche Datei erneut zu importieren fügt nichts hinzu. Eigentümer und Admins des Standorts können importieren.

### Suchwörter nach einem Import

Wenn ein KI-Anbieter verbunden ist, kann das Ende eines Imports **Suchwörter mit KI hinzufügen?** anbieten, mit einer Schätzung der Token, die es braucht. Es läuft im Hintergrund und fügt Aliasse in den Sprachen des Standorts hinzu, wie erfasste Dinge sie bekommen ([KI-Anbieter](/de/users/ai-providers/)).

## Exportieren

**Einstellungen → Export** hat zwei Arten:

- **Einen Standort exportieren**, einen, der dir gehört oder den du verwaltest: jedes Ding, jeder Ort, jedes Foto, jedes Dokument, jedes Zustandsprotokoll und jeder Umzug ist immer darin.
- **Meine Daten exportieren**: dein Persönlicher Standort mit seinen Dateien, dein Profil und deine Einstellungen und deine eigenen KI-Aufrufe. Mit [Persönlich verborgen](/de/users/locations/#persönlich-ausblenden) trägt er den ersten weiteren Standort, der dir gehört, und Persönlich ist bei **Einen Standort exportieren**.

**Was hineinkommt** außerdem: archivierte und beendete Dinge (verkauft, weitergegeben, weggeworfen), der Papierkorb, der Verlauf, die KI-Aufrufe und **Eine Kopie, die ohne Kept lesbar ist**: Webseiten, Tabellen, Vorschaubilder und Quittungen, die in jedem Browser öffnen, optional mit dem Inventar-PDF, in einer eigenen Sprache.

**Geheimnisse einschließen** ist für den Eigentümer des Standorts. Geheimniswerte werden mit einer Passphrase von mindestens 12 Zeichen verschlüsselt, zweimal getippt. Wer die Datei und die Passphrase hat, kann jedes Geheimnis darin lesen, und Kept kann eine vergessene Passphrase nicht wiederherstellen. Die lesbare Kopie enthält nie Geheimnisse.

Ein Export ohne Geheimnisse lässt jeden Geheimniswert weg und sagt das: jedes Ding oder jeder Ort, der eines hatte, nennt das Feld in `secretsWithheld`, das Manifest zählt sie, und die lesbare Kopie hat eine Zeile darüber. Er importiert wie jeder andere Export; die Felder kommen leer an. Über einfaches HTTP ist das die einzige Art (**Geheimnisse einschließen** braucht HTTPS, [Kept im Heimnetz](/de/install/home-network/)).

Der Export wird im Hintergrund erstellt; du wirst benachrichtigt, wenn er fertig ist. Jeder Export bleibt in der Liste, bereit zum **Herunterladen**, sieben Tage lang. Jede Datei im ZIP ist mit dem Datum des Exports versehen.

### Exporte und Backups

Ein Export ist etwas, das du mitnimmst: ein Standort, überall lesbar, in jedes Kept importierbar. Das nächtliche Backup des Servers ist getrennt und deckt die ganze Instanz; es hält auch eine lesbare Kopie jedes Standorts ([Backups](/de/admin/backups/)). Beim Löschen eines Standorts wird **Zuerst exportieren** angeboten.

## Umzug zwischen Instanzen

Einen Haushalt auf einen anderen Kept-Server zu verschieben: exportiere den Standort (mit Geheimnissen, wenn du sie brauchst), dann importiere das ZIP dort als Kept-Export. Gedruckte Labels funktionieren weiter: ein Label behält seinen Code, wenn dieser Code auf dem neuen Server frei ist, und wenn nicht, öffnet das alte Label trotzdem das Ding. Zum Verschieben eines ganzen Servers mit jedem Konto nutze stattdessen ein Backup. Beide Wege stehen in
[Umzug auf einen neuen Server](/de/admin/move-server/).
