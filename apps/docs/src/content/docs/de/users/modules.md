---
title: Module und Voreinstellungen
description: "Was jeder Standort verfolgt: die Basis, Haushalt und Erledigen Voreinstellungen, die Module dahinter und was das Ausschalten eines davon bewirkt."
---

Jeder Standort läuft auf einer **Voreinstellung**: einem Satz von **Modulen**, die zusammen eingeschaltet sind. Eine Voreinstellung ist ein Ausgangspunkt: ein Eigentümer oder Admin kann einzelne Module danach ein- oder ausschalten, und das Ausschalten eines blendet es nur aus. Nichts wird gelöscht.

Du wählst die Voreinstellung beim Erstellen des Standorts ([Deine ersten Minuten](/de/users/first-run/)). Der **Persönliche** Standort eines neuen Kontos startet mit Essentials. Ein Homebox-Import in einen neuen Standort startet ebenfalls mit Essentials, wobei jedes Modul, für das das Backup Daten hat, vorausgefüllt ist ([Import aus Homebox](/de/users/import-export/#ein-homebox-export)).

## Die drei Voreinstellungen

- **Basis**: Dinge finden: Räume, Kisten, Etiketten und Suche.
- **Haushalt**: fügt Belege und Garantien, Erinnerungen, Verleih, Unterlagen und Fahrzeuge hinzu.
-vehicles hinzu.
- **Erledigen**: fügt Tanken, Dinge die zur Neige gehen, Passwörter und Codes, Umzug und „ChatGPT oder Claude verbinden“ hinzu.

Die Zeitzone und Währung gehören nicht zur Voreinstellung: sie befinden sich unter **Standorteinstellungen → Allgemein**.

## Was jedes Modul hinzufügt

Die folgenden Namen sind die Schalter unter **Was erfasst wird**.

| Module | Von | Was es bringt |
|---|---|---|
| **Etiketten und QR-Codes** | Essentials | Druckbare Etiketten für Dinge und Orte; Scannen einer Etikette öffnet, worauf sie angebracht ist. |
| **Zählungen** | Essentials | **Hier zählen**, **Regelmäßig zählen** und **Frühere Zählungen** auf einem Ort, **Diese Kiste zählen** und **Zählungen** unter Werkzeuge: jede Zählung und jeder Kistencheck, aufbewahrt. |
| **Geld und Ausgaben** | Household | Preise, Gesamtbeträge und **Einblicke**. Jede Währung auf ihrer eigenen Linie, nie umgerechnet. |
| **Belege und Garantien** | Household | Garantiedaten; eine ablaufende Garantie erscheint als Erinnerung. |
| **Erinnerungen** | Household | Zeitpläne: was fällig ist, nach Datum oder nach Messwert. |
| **Verleihen** | Household | Dinge verleihen und borgen. |
| **Unterlagen** | Household | Die Unterlagen-Bibliothek; Dokumentdaten lösen Erinnerungen aus. |
| **Fahrzeuge** | Household | Fahrzeuge und Maschinen. |
| **Tanken** | Complete | Tanken und Laden. Benötigt **Fahrzeuge**. |
| **Dinge die zur Neige gehen** | Complete | **Mindestens behalten** bei etwas; niedriger Bestand zeigt eine Erinnerung an. |
| **Umzug** | Complete | Umzugsmodus. Benötigt **Etiketten und QR-Codes**. |
| **Passwörter und Codes** | Complete | Geheimfelder: verborgen bis jemand zugelassen einen enthüllt, was protokolliert wird. |
| **ChatGPT oder Claude verbinden** | Complete | Die MCP-Verbindung, damit eine AI-App mit dem Standort arbeiten kann. |

## KI an diesem Standort

KI-Erfassung und der Assistent werden in jeder Voreinstellung aktiv, sobald ein KI-Anbieter für den Standort verbunden ist. Sie teilen einen Schalter, **KI-Erfassung und der Assistent**, unter **KI an diesem Standort** auf derselben Seite, sodass ein Standort ohne KI bleiben kann, während ein Anbieter verbunden ist. Die Wahl einer Voreinstellung ändert das nicht. Siehe [KI-Anbieter](/de/users/ai-providers/).

## Ein Modul ausschalten

Ein ausgeschaltetes Modul wird überall ausgeblendet, wo es erscheinen würde (seine Bildschirme, Menüeinträge, Filter) und seine Erinnerungen pausieren. Das Wiedereinschalten bringt alles zurück, da nichts gelöscht wurde.

- **Erinnerungen pausieren mit ihrem Modul.** Zeitpläne und ablaufende Dinge warten mit **Erinnerungen**, Garantie- und Registrierungsdaten mit **Belegen und Garantien**, Dokumentdaten mit **Unterlagen** (die Dokumente eines Fahrzeugs laufen auch weiter, während **Fahrzeuge** eingeschaltet ist), Ausleihen mit **Verleihen**, niedriger Bestand mit **Dingen die zur Neige gehen**. Erinnerungen über längst nicht gelesene Zähler laufen ständig weiter.
- **Abhängigkeiten gehen ebenfalls mit.** Tanken benötigt Fahrzeuge, und Umzug benötigt Etiketten und QR-Codes: das Ausschalten des benötigten Moduls schaltet auch dieses Modul aus. Sein Schalter zeigt dann *Benötigt Fahrzeuge, aus in diesem Standort*.
- **Das Menü folgt allen deinen Standorten.** Unter **Nachverfolgung** erscheint ein Eintrag (Zeitpläne, Verleih, Unterlagen, Verbrauchsgüter, Fahrzeuge, Umzug, Einblicke) einmal, wenn sein Modul in einem deiner Standorte eingeschaltet ist. Unter **Werkzeuge** erscheint **Etiketten**, solange Etikett irgendwo eingeschaltet ist, und **Zählungen**, solange Zählungen irgendwo eingeschaltet sind. Aktivität, Papierkorb und Benachrichtigungen sind ebenfalls immer vorhanden.

## Später ändern

Ein Eigentümer oder Admin öffnet **Standorteinstellungen → Was erfasst wird**. Der Voreinstellungswähler stellt alle Module gleichzeitig ein; **Feinabstimmung** darunter hat einen Schalter pro Module. Bevor du speicherst, zeigt **Beim Speichern** an, was eingeschaltet und was ausgeschaltet wird.

## Weiterführend

- [Standorte, Räume und Kisten](/de/users/locations/) für die Orte innerhalb eines Standorts.
- [Einen Standort teilen](/de/users/sharing/) für Rollen.
