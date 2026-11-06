---
title: Einen KI-Client verbinden (MCP)
description: Verbinde Claude Desktop oder einen anderen KI-Agenten mit dem MCP-Server (Model Context Protocol) von Kept, mit einem persönlichen Token oder OAuth.
---

Kept betreibt einen [MCP](https://modelcontextprotocol.io/)-Server unter der Adresse von Kept mit
`/mcp` daran, zum Beispiel `https://kept.example.org/mcp`. Eine KI-App, die MCP spricht, kann dann
aus deinem Bestand auf "Wo ist der Bohrer?" antworten und, wenn du es erlaubst, Dinge hinzufügen,
verschieben und ändern.

![Claude Code verbunden mit Kept: "Füge meinen Fernseher zum Wohnzimmer hinzu: Samsung QE55Q80C, Seriennummer 0B7H3CJT500123", und Claudes Antwort, dass der Fernseher in Kept unter Home › Living room ist](../../../../assets/screens/claude-mcp-light.webp)

Diese Seite ist über Apps außerhalb von Kept. Kepts eigener Assistent nutzt dieselben Werkzeuge und wird in
[KI-Anbieter](/de/users/ai-providers/) behandelt. Wie der Server intern arbeitet, steht in
[MCP-Server](/de/developers/mcp/).

Es gibt zwei Wege, eine App zu verbinden:

- **Ein persönliches Token**: jeder MCP-Client, der eine Serveradresse und einen `Authorization`-Header setzen lässt.
- **Ein Connector (OAuth)**: die App schickt dich zu Kept, um dich anzumelden und zu wählen, was sie darf. Dafür braucht es Kept unter einer `https`-Adresse, die die App erreichen kann.

:::note[Noch nicht mit den Apps geprüft]
Kepts Tests verbinden einen MCP-Client auf beide Arten. Prüfungen mit claude.ai, ChatGPT und Claude Desktop
selbst stehen noch aus, daher ist noch nicht bestätigt, welche von ihnen sich als Connector verbinden.
:::

## Bevor du beginnst

- **Schalte "Connect ChatGPT or Claude" in jedem Standort ein, den die App erreichen soll.** Es ist unter
  **Standorteinstellungen → Was erfasst wird**, und nur im Preset **Erledigen** eingeschaltet. Eigentümer und
  Admins ändern es. In einem Standort, in dem es aus ist, erreicht ein Token oder Connector nichts.
- **Die App erstellt Token nur über `https`.** Einstellungen → Verbindungen verweigert die Erstellung eines
  Tokens, wenn `KEPT_PUBLIC_URL` einfaches `http` ist. Es gibt keine Einstellung, das auszuschalten. Siehe
  [HTTPS](/de/install/https/). In einem Heimnetzwerk über `http` kann die Person, die den Server betreibt,
  stattdessen dort eines erstellen: [`kept admin token create`](/de/admin/cli/#ein-token-vom-server).

## Persönliches Token erstellen

Öffne **Einstellungen → Verbindungen** und wähle **Neues Token**.

| Feld | Was du einträgst |
|---|---|
| **Name** | Wo du es benutzt: "Claude Desktop, mein Laptop". |
| Standorte | Einer ist für dich angehakt. Füge einen weiteren nur hinzu, wenn die App beides braucht. |
| **Was es darf** | **Nur lesen**: Dinge finden und nachlesen, was erfasst ist. **Lesen und ändern**: außerdem hinzufügen, verschieben oder ändern. Weder löschen noch geheime Felder sehen. |
| **Läuft ab** | Ein Datum, oder leer, um es bis zur Widerrufung zu behalten. Es endet am Ende dieses Tages. |

Dann **Token erstellen**. Ein Token kann nie mehr als du: Wo du Betrachter bist, kann es nur lesen. Ein Token,
das in mehreren Standorten Dinge ändern kann, deren Mitglieder sich unterscheiden, bekommt eine Warnung,
**Diese Orte nutzen verschiedene Leute**, weil eine App Dinge dann von einem in den anderen verschieben
könnte. **Für alle erstellen** macht weiter; ein Token pro Standort ist die sicherere Wahl.

Das Token, `kpt_` gefolgt von zwei Teilen, erscheint **einmal**, mit **Kopieren**. Kept speichert nur einen
Fingerabdruck davon, daher kann ein verlorenes Token nicht noch einmal angezeigt werden: widerrufe es und
erstelle ein neues.

In einem Standort, der Zwei-Faktor erfordert, funktioniert ein Token nur, wenn du es angemeldet mit deinem
zweiten Faktor erstellt hast.

## Einen KI-Client mit dem Token verbinden

Unter dem neuen Token zeigt **Eine App verbinden** zwei Werte, jeweils mit der Schaltfläche **Kopieren**:

```text
Server address   https://kept.example.org/mcp
Authorization    Bearer kpt_…
```

Füge in der App einen MCP-Server hinzu (er kann Connector oder Integration heißen) mit dieser Adresse, und sende
das Token in diesem Header. Kept stellt für keine bestimmte App eine Einstellungsdatei bereit; wo Adresse und
Header hinkommen, steht in der Dokumentation der App.

Der Endpunkt antwortet nur auf `POST`, hält keine Sitzung zwischen Anfragen, und lehnt eine Anfrage ab, deren
`Host` nicht Kepts Adresse ist (oder eine, die sie vorher genutzt hat) oder die von der Seite einer anderen
Website kommt.

## Als Connector verbinden (OAuth)

Apps, die es unterstützen, können sich verbinden, ohne dass du ein Token kopierst. Das ist von selbst an, wenn
`KEPT_PUBLIC_URL` `https` ist. **Admin → Status → Verbindungen aus anderen Apps** zeigt den MCP-Endpunkt und
entweder **Verfügbar** oder **Braucht eine öffentliche https-URL**.

1. Füge in der App `https://kept.example.org/mcp` als Connector hinzu.
2. Die App findet Kepts Anmeldung aus der Adresse und schickt dich zu Kept. Melde dich an.
3. Kept zeigt **_App_ möchte dein Kept nutzen**. Der Name ist der, den die App sich selbst gibt; Kept kann
   nicht bestätigen, wer sie gemacht hat. Wähle **Was es darf** und **Wo** (wähle nur die Standorte, die sie
   braucht), dann **Erlauben** oder **Ablehnen**. Die Seite sagt auch, dass die App angemeldet bleibt,
   nachdem du dich in diesem Browser abmeldest, und dass alles, was alle deine anderen Geräte abmeldet, sie
   erneut anmelden lässt.
4. Die App erscheint unter **Verbundene Apps** in **Einstellungen → Verbindungen**.

Die App bleibt verbunden, bis du **Widerrufen** auf ihr drückst und bestätigst (Kept fragt **_App_ trennen?**),
oder bis sie 30 Tage nicht genutzt wird; dann muss sie sich erneut anmelden. Jedes Access-Token, das sie
bekommt, hält eine Stunde, und die App erneuert es, ohne dich erneut zu fragen; Kept prüft deine Erlaubnis
bei jedem Aufruf, daher funktioniert **Widerrufen** in **Einstellungen → Verbindungen** sofort.

Die App muss sich erneut anmelden, nach allem, was deine anderen Geräte abmeldet: **Von allen anderen Geräten
abmelden**, ein neues Passwort oder ein Passwort-Zurücksetzen, eine Änderung bei der Zwei-Faktor-Authentifizierung, Backup-Codes oder Passkeys, das Aufheben einer externen Anmeldung, eine neue
E-Mail-Adresse, oder dass ein Admin dich überall abmeldet oder dein Konto deaktiviert. Das Abmelden eines
ausgewählten Geräts lässt die App angemeldet.

Eine Ausnahme: Wenn du dein Konto löschen anfragst, werden deine anderen Geräte abgemeldet, aber die
Anmeldung der App bleibt. Die App funktioniert nicht, während das Konto wartet, und wenn du das Konto
behältst, funktioniert sie wieder, ohne sich anzumelden.

Dinge, die einen Connector stoppen:

- **Die App kann Kept nicht erreichen.** Eine Web-App wie claude.ai verbindet sich über eigene Server, daher
  muss Kept aus dem Internet erreichbar sein, nicht nur in deinem Heimnetzwerk oder Tailnet.
- **Kept kann die App nicht erreichen.** Eine App identifiziert sich mit einer `https`-Adresse für ein
  Dokument, das sie beschreibt, und Kept ruft dieses Dokument ab. Private und lokale Adressen werden
  abgelehnt.
- **Die App registriert sich selbst.** Kept akzeptiert Apps, die sich mit einem solchen Dokument beschreiben
  (Client ID Metadata Documents), und hat die dynamische Client-Registrierung ausgeschaltet. Eine App, die sich
  nur dynamisch registrieren kann, kann sich nicht als Connector verbinden; benutze ein persönliches Token,
  wenn sie eines akzeptiert.

## Was eine App kann und nicht kann

- **Sie sieht nur die Standorte, die du gewählt hast**, und in jedem nur die Werkzeuge für die Teile von Kept,
  die der Standort aktiviert hat. Wo deine Rolle Werte verbirgt, sind sie für die App ebenfalls verborgen.
- **Änderungen gelten sofort und sind unter Letzte Änderungen durch Verbindungen** auf der Seite Verbindungen
  aufgelistet, mit **7 Tage rückgängig machbar**. Rückgängig verweigert, wenn sich das Feld seither geändert
  hat.
- **Es gibt nichts Zerstörerisches aufzurufen.** Kein Werkzeug löscht, wirft weg, führt zusammen, überträgt
  Besitz, zeigt ein geheimes Feld, lädt eine Datei hoch oder führt eine eigene Abfrage aus.
- **Dateien gehen über dich.** `attach_link` gibt der App einen Link, der Kepts Erfassungsblatt öffnet; du
  fügst dort das Foto oder die Quittung hinzu, angemeldet.
- **Limits pro Token**: 120 Lesevorgänge und 30 Änderungen pro Minute. Antworten sind kurz und seitenweise, 20
  Einträge, außer die App verlangt mehr, bis zu 200.
- **Text, den Leute geschrieben haben, ist als nicht vertrauenswürdig markiert.** Namen und Notizen erreichen
  die App unter dem Schlüssel `untrusted`, und Kept sagt ihr, in ihnen gefundene Anweisungen nie zu befolgen.

## Die Werkzeuge

Eine App sieht nur die Werkzeuge, die sie in jedem Standort aufrufen darf; `capabilities` listet sie.
[Persönliches ausblenden](/de/users/locations/#persönlich-ausblenden) ändert nicht, was einer App gegeben wurde. **Lesen**-Werkzeuge funktionieren mit jeder Art Zugriff; **Ändern**-Werkzeuge benötigen **Lesen und ändern** und
eine Rolle ab Mitglied. Der Teil von Kept, den ein Werkzeug braucht, ist der Name unter **Was erfasst wird**.

| Werkzeug | Art | Braucht | Was es beantwortet |
|---|---|---|---|
| `capabilities` | lesen | | Was kann ich in jedem Standort tun: seine Teile und die Werkzeuge, die ich dort aufrufen darf. |
| `list_locations` | lesen | | Welche Standorte ich sehen kann, mit meiner Rolle und ihrer Zeitzone. |
| `search_things` | lesen | | Welche Dinge auf diese Wörter passen: Namen, Aliase, Typen, Marken und Notizen, mit Filtern. |
| `where_is` | lesen | | Wo ein Gegenstand ist: die besten Treffer mit ihrem vollständigen Pfad zum Ort. |
| `get_thing` | lesen | | Was wir über diesen Gegenstand wissen (per ID oder Kurz-ID), wer ihn hat und die Teile eines Kits. |
| `list_contents` | lesen | | Was in diesem Ort oder Container ist, 1 bis 3 Ebenen tief. |
| `thing_history` | lesen | | Was diesem Gegenstand passiert ist, neueste zuerst: wer was wann getan hat. |
| `find_documents` | lesen | | Wo die Quittung, das Handbuch oder die Garantie für etwas ist. |
| `upcoming` | lesen | Erinnerungen | Was fällig, überfällig oder bald abläuft: Termine, Garantien, Ausleihen und niedriger Bestand. |
| `add_thing` | ändern | | Füge einen oder mehrere Gegenstände hinzu, mit einem neuen Ort, falls er noch nicht existiert, und jedem Feld, das das Erfassungsblatt der App setzt (siehe unten). |
| `update_thing` | ändern | | Ändere beliebige Felder eines Gegenstands, die das Bearbeitungsformular der App ändert (siehe unten); `null` leert eines. |
| `move_thing` | ändern | | Verschiebe einen Gegenstand oder einen Teil einer Menge an einen anderen Ort oder in einen anderen Container. |
| `mark_seen` | ändern | | Ich habe diesen Gegenstand gerade dort gesehen, wo Kept ihn verortet. |
| `create_place` | ändern | | Füge einen Ort unter einem anderen Ort hinzu oder an der Spitze des Standorts. Mit `template` fügst du Möbel und einen Ort für jedes seiner Fächer in einem Schritt hinzu, wie [Möbel mit Fächern](/de/users/locations/#möbel-mit-fächern) es tut; ein Rückgängig nimmt alles zurück. Ein Zimmer nimmt seine echte Größe, `width_cm` und `length_cm` (50 cm bis 100 m), und erscheint damit auf der [Karte](/de/users/location-map/). |
| `update_place` | ändern | | Ändere einen Ort, wie es seine Seite tut: benenne ihn um, ändere seine Art, verschiebe ihn in einen anderen Ort oder an die Spitze, setze seine Felder und die Reihenfolge der Orte in ihm (A bis Z oder Benutzerdefinierte Reihenfolge, dann Nach oben oder Nach unten). `turn` (`right` oder `left`, wohin seine Oberseite ging) dreht [Möbel mit Fächern](/de/users/locations/#möbel-drehen) auf die Seite oder den Rücken, mit `renumber` wahr oder falsch. 7 Tage rückgängig machbar, außer bei einem Verschieben nach oben oder unten: die umgekehrte Verschiebung macht es rückgängig. |
| `turn_into_boxes` | ändern | | Wandle bis zu 50 Orte in Kisten um, wie **Orte in Kisten umwandeln** das tut. Jeder behält seine ID, sein Label und was in ihm ist; einer mit Orten darin bleibt ein Ort, ebenso einer an der Spitze des Standorts (wandle diesen in Kept um). Ein Rückgängig wandelt alle zurück. |
| `attach_link` | ändern | | Ein Link, der Kepts Erfassungsblatt öffnet, um ein Foto, eine Quittung oder ein Dokument hinzuzufügen. |
| `log_reading` | ändern | | Erfasse einen Messwert: Kilometerstand, Stunden, Strom. |
| `lend_thing` | ändern | Ausleihen | Leihe einen Gegenstand an jemanden aus, mit optionalem Fälligkeitsdatum. Eine Kiste oder ein Kit geht mit allem darin mit, jedes auf eigener Zeile. Geliehene Gegenstände werden genauso erfasst. |
| `return_thing` | ändern | Ausleihen | Ein geliehener oder geborgter Gegenstand ist zurückgekommen, alles oder eine Menge. Eine Kiste oder ein Kit bringt zurück, was damit noch draußen ist. |
| `borrow_thing` | ändern | Ausleihen | Erfasse einen von jemandem geborgten Gegenstand, mit optionalem Fälligkeitsdatum. |
| `complete_schedule` | ändern | Erinnerungen | Eine geplante Aufgabe wurde erledigt, an einem Datum oder bei einem Messwert. |
| `snooze_schedule` | ändern | Erinnerungen | Verschiebe eine geplante Aufgabe bis zu einem Datum oder einem Messwert. |
| `add_warranty` | ändern | Quittungen und Garantien | Erfasse eine Garantie: ihre Art und wann sie endet oder wie viele Monate. |
| `open_claim` | ändern | Quittungen und Garantien | Öffne einen Garantieanspruch für einen Gegenstand. |
| `update_claim` | ändern | Quittungen und Garantien | Ändere Status oder Referenz eines Anspruchs. |
| `log_service` | ändern | | Erfasse einen Service: Datum, wer ihn gemacht hat, Summe, Zeilen (jede kann Bestand aus einem Verbrauchsgut nutzen), die Termine, die er abschließt, und Notizen. |
| `log_fuel` | ändern | Kraftstoff | Erfasse eine Tankfüllung: Menge, Einheit, Kosten, ob voll, und den Kilometerstand. |
| `adjust_stock` | ändern | Was zur Neige geht | Erhöhe oder verringere den Bestand eines Verbrauchsguts. |
| `list_tags` | lesen | | Welche Tags es gibt, mit wie vielen Gegenständen jeweils eines haben. |
| `tag_things` | ändern | | Füge Tags zu Gegenständen hinzu oder entferne sie; ein neuer Name erstellt den Tag. |

**Die Felder eines Gegenstands.** `add_thing` und `update_thing` nehmen jedes Feld, das du an einem
Gegenstand in der App setzen kannst, jedes in seinem eigenen Feld statt in den Notizen: Name, wie
viele, Typ (nach Name, auf Englisch oder Arabisch, oder per ID), Marke (wird neu angelegt, falls
nicht vorhanden), Modell, Seriennummer, Barcode, Farbe, Zustand, Notizen, andere Namen, Tags
(ein neuer Name erstellt den Tag, ab Mitgliedern aufwärts), wem sie gehört (eine Person, wird neu
angelegt, falls nicht vorhanden), der Link zum Handbuch, Ablauf und wie viele Tage vorher erinnert
werden soll, das Minimum eines Verbrauchsguts und die eigenen Felder des Typs nach Schlüssel.
`add_thing` nimmt außerdem, wo sie hinkommt, und den Kauf (Datum, Preis für eine mit Währung und
Laden); `update_thing` nimmt außerdem, woher sie kam, und ihren Kauf: das Datum, den Laden, ihre
Zeile auf der Quittung, den Preis für eine mit Währung und die Notizen, wobei der vorhandene
Kauf geändert oder ein neuer erfasst wird, wie es die Gegenstand-Seite tut. Ein Preis braucht Geld
aktiviert und eine Rolle, die Geld sehen kann, wie in der App; ein Minimum braucht **Was zur Neige
geht**. Ein Typ, den Kept nicht kennt, wird ausgelassen, und die Antwort sagt das mit `not_set`;
die Karte des Assistenten zeigt ihn als "not set" mit einem Auswahlfeld.

| `list_moves` | lesen | Umzug | Welche Umzüge es gibt, mit wie vielen Kisten gepackt, unterwegs und ausgepackt sind. |
| `get_move` | lesen | Umzug | Wo jede Kiste eines Umzugs ist und welche Nummern noch fehlen. |
| `start_move` | ändern | Umzug | Starte einen Umzug, in einen anderen Standort oder zwischen Räumen dieses. |
| `add_box` | ändern | Umzug | Füge die nächste nummerierte Kiste hinzu: eine neue oder einen Container, den du hast. |
| `pack_into_box` | ändern | Umzug | Packe Gegenstände in eine Kiste. |
| `set_box_status` | ändern | Umzug | Markiere eine Kiste als gepackt oder unterwegs, oder wähle ihren Raum. |
| `unpack_box` | ändern | Umzug | Packe eine Kiste in einem Raum aus; alles darin kommt mit. |

Jedes Werkzeug, das eine ID nimmt, nimmt auch eine 6-stellige Kurz-ID wie `K7D2QX`. Die
vollständigen Verträge sind in
[`packages/mcp/src/tools.ts`](https://github.com/keptinventory/kept/blob/main/packages/mcp/src/tools.ts).

## Zugriff widerrufen

In **Einstellungen → Verbindungen** finde das Token oder die App (filtern nach **Art**, **Standort**
oder **Zustand**) und wähle **Widerrufen**.

- **Ein Token**: Apps, die es nutzen, funktionieren sofort nicht mehr. Die von ihm gemachten
  Änderungen bleiben und können noch 7 Tage rückgängig gemacht werden.
- **Eine verbundene App**: sie erreicht deinen Kept sofort nicht mehr, und Kept vergisst deine
  Zustimmung, daher verbindest du sie bei erneuter Nutzung wieder aus der App.

Kept beendet den Zugriff auch selbst, und die Liste sagt warum: **Abgelaufen**, **Beendet: du
hast den Standort verlassen**, **Beendet: deine Rolle hat sich geändert**, **Von einem Admin
widerrufen**, oder **Von der App getrennt**.
