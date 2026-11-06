---
title: Erinnerungen und Benachrichtigungen
description: Was Kept Ihnen erinnert, wie das Benachrichtigungszentrum funktioniert, Kanal-Einrichtung für ntfy, Telegram und Apprise sowie standortbezogene Einstellungen
---
Kept erinnert dich an fällige Zeitpläne, auslaufende Garantien, Anmeldefristen, Dokumente
und Dinge, die ablaufen, überfällige Kredite, Zähler, die seit längerem nicht abgeglesen wurden, Wenig Vorrat, Mitglieder, die beitreten und verlassen, und KI-Ausgabenbegrenzungen. Home's **Braucht dich** zeigt, was fällig oder überfällig ist; die Glocke öffnet das Benachrichtigungszentrum, wo **Erledigen**, **Verschieben**, **Verlängern** oder **Als zurückgegeben markieren** Anwendung finden.

Diese Seite behandelt, was dich erreicht, wie du Kanäle einrichtest und standortbezogene Einstellungen. Für Push-Benachrichtigungen auf einem Telefon siehe [Kept auf deinem Telefon](/de/users/phone-app/#benachrichtigungen).

## Was dich erreicht

Home's **Braucht dich** zeigt sechs Anzahlen, stets am selben Ort: **Überfällig**, **Fällig**, **Läuft bald ab**, **Verliehen**, **Unklar** und **Wenig Vorrat**. Eine Null wird ausgegraut, nicht versteckt.
**Ausgeliehen bekommen** und **Lange nicht gesehen** erscheinen, wenn sie etwas enthalten. Auf einem Computer benennt jedes sein dringendstes Element. Tippe darauf, um diese Liste zu öffnen, bereits gefiltert.

Das Benachrichtigungszentrum (die Glocke) listet alles, was fällig oder überfällig ist, nach Art gruppiert. Dort kannst du **Erledigen**, **Verschieben**, **Verlängern** oder **Als zurückgegeben markieren** ausführen, ohne die Seite zu verlassen.

## Einstellungen

**Einstellungen → Profil → Benachrichtigungen** legt fest, was dich erreicht und wie:

- **Tägliche Zusammenfassung**: eine tägliche Zusammenfassung stattdessen einzelner Benachrichtigungen.
- **Ruhezeiten**: keine Benachrichtigungen während der Stunden, die du festgelegt hast. nichts wird gepusht oder per E-Mail gesendet; was fällig wird, wartet bis sie vorbei sind und wird dann gesendet.
- **Kalender-Feed**: ein privater Link für deine Kalender-App, der fällige Termine anzeigt.

Push auf einem Telefon wird in [Kept auf deinem Telefon](/de/users/phone-app/#benachrichtigungen) behandelt.

## Die Benachrichtigungstabelle

**Was dich erreicht** ist eine Tabelle. Zeilen sind die Arten, gruppiert:

- **Fälligkeiten**: Zeitpläne, Garantien, Anmeldefristen, Dokumente, Dinge, die ablaufen, Zähler, die seit längerem nicht abgeglesen wurden.
- **Verleihen**: überfällige Kredite.
- **Vorrat**: geringer Vorrat.
- **Personen**: Mitglieder, die beitreten und verlassen.
- **KI**: Ausgabenbegrenzungen und die monatliche Zusammenfassung.

Spalten sind deine Kanäle:

- **In Kept**: das Benachrichtigungszentrum und Home's Braucht dich.
- **E-Mail**: an deine Konten-E-Mail-Adresse.
- **Push**: an dein Telefon (wo Push eingerichtet ist).
- **Webhook / ntfy / Telegram / Apprise**: nachdem du einen hinzugefügt hast, erscheint für jede Art eine Spalte.

Mitglieds- und KI-Benachrichtigungen gehen nur an Kept und E-Mail. Das Ausschalten von **In Kept** für eine Art schaltet sie überall aus: nichts anderes wird dafür gesendet. Auf einem Telefon zeigt jede Art ihre Kanäle als Schalter darunter an.

## Standortbezogene Einstellungen

- **Alle Orte** legt fest, was du überall erhältst, einschließlich später hinzugefügter Orte.
- **Einen Ort auswählen** ändert ihn nur dort. Ein Punkt kennzeichnet, was ausschließlich für diesen Ort gesetzt ist.
- **Diesen Ort auf alle Orte zurücksetzen** löscht diese Überschreibungen.
- Eine Art, deren Modul dort deaktiviert ist, zeigt als angehalten an (ihre Erinnerungen warten, bis der Modul wieder aktiv ist).
- Wo du ein Zuschauer bist, erhältst du nur Mitglieder, die beitreten und verlassen.
- Wo du ein Mitglied bist, beginnt Kept mit nur den Krediten, die du aufzeichnest: schalte dort ein, was du having möchtest.

## Einrichtung von Kanälen

### ntfy

Füge deinen Server (`https://ntfy.sh` oder deinen eigenen) und ein Thema hinzu, das schwer zu erraten ist, sowie ein Zugriffstoken, falls das Thema eines benötigt. Kept speichert alle verschlüsselt und zeigt sie nie wieder an.
**Testen** sendet jetzt eine.

### Telegram

Erstelle einen Bot mit @BotFather, sende ihm eine Nachricht, dann füge dessen Token und deine Chat-ID hinzu. Kept speichert alle verschlüsselt und zeigt sie nie wieder an.
**Testen** sendet jetzt eine.

### Apprise

Wenn dein Server Apprise hat, füge eine oder mehrere Apprise-URLs hinzu, wie `discord://…`, um Discord, Slack, Matrix, Signal und mehr zu erreichen. Kept speichert alle verschlüsselt und zeigt sie nie wieder an.
**Testen** sendet jetzt eine.

## Leih-Erinnerungen

**Verleihen** ein Ding (oder einen Teil einer Menge) an ein Mitglied oder einen Kontakt, mit einem Fälligkeitsdatum und Zustandsfotos. Kept Nachrichten niemals den Borrower; **Erinnerung kopieren** gibt dir den Text, um ihn selbst zu senden.
Ein Kasten geht mit allem darin, jeweils etwas pro Zeile. Siehe
[Kits und Übergaben](/de/users/kits/).

## Verwandtes

- [Kept auf deinem Telefon](/de/users/phone-app/) für Push-Benachrichtigungen und Offline-Nutzung.
- [Alltägliche Verwendung](/de/users/everyday-use/) für das größere Bild.
- Fahrzeuge und Maschinen für Zählerstände und Servicepläne.
