---
title: Paperless-ngx
description: Verknüpfe ein Ding oder einen Ort mit seinen Belegen, Handbüchern und Garantiekarten in Paperless-ngx. Kept speichert die Verknüpfung und einen Titel, nicht die Datei, es sei denn, du kopierst sie herein.
---

Wenn du deine Unterlagen in [Paperless-ngx](https://docs.paperless-ngx.com/) hast, kann Kept ein Ding mit seinen
Dokumenten dort verknüpfen, statt dass du sie doppelt hochlädst. Der Bohrer zeigt seine Rechnung und
sein Handbuch; die Küche zeigt die Rechnung des Kühlschranks.

Optional: nur, wenn du Paperless-ngx bereits betreibst. Kept funktioniert ohne es genauso.

## Bevor du beginnst

| Das brauchst du | Warum |
|---|---|
| **Paperless-ngx 2.16 oder neuer** | Kept fragt nach API-Version 9 von Paperless, die 2.16 eingeführt hat und 3.x weiterhin anbietet |
| **Ein API-Token** | In Paperless: **Mein Profil**, dann der Rundpfeil beim API-Token. Kept sieht, was dieser Paperless-Nutzer sieht, also genügt ein Nutzer, der deine Dokumente nur ansehen darf |
| **Kept erreicht Paperless** | Vom Computer, auf dem Kept läuft, nicht von deinem Handy |
| **`https`**, oder dein eigenes Netzwerk | Über einfaches `http` wandert das Token unverschlüsselt, also nimmt Kept `http` nur für eine Adresse in deinem eigenen Netzwerk. Für so eine Adresse brauchst du **Admin → Einstellungen → Private Adressen erlauben** ([ausgehende Anfragen](/de/admin/security-model/#ausgehende-anfragen-ssrf)) |

## Verbinden

Ein Eigentümer oder Admin des Standorts:

1. **Standorteinstellungen → Paperless**.
2. **Paperless-Adresse**: die Adresse, unter der du Paperless öffnest, zum Beispiel
   `https://paperless.example.com` (ein Pfad wie `/paperless` ist in Ordnung).
3. **API-Token**, dann **Verbinden**. Kept meldet sich zuerst an und sagt dir warum, wenn es nicht geht: ein abgelehntes
   Token, eine Adresse, die nicht wie Paperless antwortet, oder eine zu alte Version.

Nach der Verbindung zeigt die Seite die Version von Paperless und wie viele Dokumente verknüpft sind. **Verbindung
testen** fragt Paperless erneut. Um das Token zu ändern, gib ein neues ein und **Speichern**; lass es leer, um das gespeicherte zu behalten.

## Dokumente verknüpfen

Auf der Seite eines Dings, unter **Unterlagen**, steht **Aus Paperless verknüpfen** neben **Datei hinzufügen** (auf der
Seite eines Orts neben **Dokument hinzufügen**). Es öffnet eine Suche in deinem Paperless: Wörter aus dem Titel oder
dem Text, ein Korrespondent, ein Typ oder ein Tag. Der Anfang eines Wortes genügt: `Camel` findet "Camelot".
Die eigene Suchsyntax von Paperless wird beim Tippen übernommen, zum Beispiel `title:manual` oder `*amel*` für die
Mitte eines Wortes. Wähle ein oder mehrere aus und **Verknüpfen**.

Verknüpfte Dokumente stehen in derselben Unterlagen-Liste wie die Dateien. Jedes zeigt sein Vorschaubild, seinen Titel,
den Typ von Paperless und den Korrespondenten sowie sein Datum, mit:

- **Art**: *Anleitung*, *Garantie*, *Beleg*, *Rechnung* oder *Dokument*. Ändere sie, wenn der Typ von Paperless nicht sagt, was das Dokument ist.
- **In Paperless öffnen**: die Seite des Dokuments in Paperless, in einem neuen Tab.
- **Herunterladen**: das Dokument über Kept. Mitglieder und höher.
- **In Kept kopieren**: siehe unten.
- **Trennen**: es wird vom Ding entfernt. Paperless behält es.

Die Art ergibt sich aus dem Dokumenttyp in Paperless, dann aus seinen Tags: *Beleg*, *Rechnung*,
*Anleitung* und *Garantie* (und dieselben Wörter in den anderen Sprachen von Kept) werden
erkannt, alles andere ist ein Dokument. Danach kannst du die Art selbst ändern, und **In Kept kopieren**
kopiert das Dokument mit dieser Art. Der **Art**-Filter in Unterlagen verengt Dateien und verknüpfte Dokumente zusammen.

**Aus einem [Homebox-Import](/de/users/import-export/#ein-homebox-export):** Ein Homebox-Link zu einem
deiner Paperless-Dokumente (`…/documents/123` oder das der API `…/api/documents/123/download/`) an der
Adresse, mit der dieser Standort verbunden ist, kommt als verknüpftes Dokument auf das Ding oder den Ort. Sein
Titel kommt aus Paperless, seine Art aus dem Homebox-Anhangstyp. Verbinde Paperless, bevor du
importierst; jeder andere Link bleibt ein einfacher Link.

Kept fragt Paperless nach den Titeln, wenn der Import läuft, nicht wenn er den Export prüft. Wenn Paperless
nicht erreichbar ist oder kein Dokument hat oder es seinem Nutzer nicht zeigt, läuft der Import trotzdem zu Ende,
und dieser Link behält Homebox's Titel oder, wenn Homebox keinen hat, dessen Adresse. Der Bericht des Imports sagt, wie
viele es sind. Um später an den Titel von Paperless zu kommen, **Trenne** das Dokument und nutze **Aus Paperless verknüpfen**, oder
**In Kept kopieren**.

## Verknüpft oder kopiert

| | Verknüpft | In Kept kopiert |
|---|---|---|
| Was Kept speichert | Die Nummer des Dokuments in Paperless, seinen Titel, seine Art, seinen Typ, seinen Korrespondenten und sein Datum | Die Datei selbst, als Anhang am Ding |
| Wenn Paperless nicht erreichbar ist | Die Titel werden weiterhin angezeigt, mit einem Hinweis, dass Paperless nicht erreichbar ist | Nichts ändert sich |
| In Backups und Exporten von Kept | Nein: Eine Verknüpfung braucht das Paperless dieses Servers | Ja, wie jede andere Datei |
| Wenn sich das Dokument in Paperless ändert | Sein Titel wird aktualisiert, wenn du es kopierst | Die Kopie bleibt, wie sie war |

**In Kept kopieren** ist pro Dokument und bewusst: Nutze es für das, was ohne Paperless überleben muss,
zum Beispiel einen Beleg, den du für eine Garantieklage brauchst. Die Kopie ist die Datei, die Paperless zum
Herunterladen bereitstellt (sein archiviertes PDF, wenn es eines erstellt hat), geprüft und mit der Größe wie ein Upload.

## Wer was darf

| | Betrachter | Mitglied | Admin, Eigentümer |
|---|---|---|---|
| Verknüpfte Dokumente und Vorschaubilder ansehen | ✓ | ✓ | ✓ |
| In Paperless suchen, verknüpfen, kopieren, herunterladen | | ✓ | ✓ |
| Die Art ändern, trennen | | Eigene | Alle |
| Verbinden, ändern, trennen | | | ✓ |

Belege und Rechnungen sind Geld: Wo Geld für dich in einem Standort versteckt ist, sind auch verknüpfte Belege und
Rechnungen versteckt, und du kannst ein verknüpftes Dokument nicht als Geld markieren.

Ein [persönlicher Token](/de/users/mcp-clients/#persönliches-token-erstellen) liest die Verknüpfungen eines Dings oder Orts
(`GET /api/v1/paperless-links?thingId=…`), niemals die Verbindung, eine Suche, ein Vorschaubild oder ein
Dokument. Das MCP-Werkzeug `get_thing` listet die verknüpften Dokumente eines Dings mit Titel.

## Datenschutz

- Das Token wird mit Kept's geheimem Schlüssel versiegelt, wie ein Passwort für ein Postfach. Kept zeigt es nie an, protokolliert
  es nicht und setzt es nicht in einen Audit-Eintrag oder einen Export.
- Dein Browser spricht nie mit dem Token mit Paperless. Suchen, Vorschaubilder und Downloads gehen
  über Kept, das zuerst prüft, ob du das Ding sehen darfst. Vorschaubilder werden von Kept neu codiert und
  fünf Minuten lang behalten.
- **In Paperless öffnen** ist ein gewöhnlicher Link: Du meldest dich selbst bei Paperless an.
- Wenn du ein Ding in einen anderen Standort verschiebst, werden seine Verknüpfungen entfernt: Sie benennen Dokumente im Paperless des alten
  Standorts, die Mitglieder des neuen Standorts vielleicht nicht sehen dürfen.

## Trennen

**Standorteinstellungen → Paperless → Trennen** entfernt die Verbindung und jede Verknüpfung zu ihren
Dokumenten. In Kept kopierte Dokumente bleiben.

## Noch nicht fertig

- Zwei-Wege-Synchronisierung: Kept ändert nichts in Paperless.
- Belege automatisch Dingen zuordnen.
- Kept's eigene Dateien an Paperless senden.
