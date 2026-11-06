---
title: Fragen und Antworten
description: Kurze Antworten auf die Fragen, die Leute vor und nach der Installation von Kept stellen, jeweils mit einem Link zur Seite mit den Details.
---

## Schickt Kept irgendetwas über mich oder meinen Server irgendwohin?

Nein. Es gibt keine Telemetrie irgendeiner Art, nicht einmal eine Opt-in-Installationszählung. Der Update-Check ist
aus, bis ein Admin ihn einschaltet, und sendet dann nur die Anfrage nach der neuesten Version. Barcode-Suche
und KI sind ebenfalls aus, bis jemand sie verbindet. Siehe [Observability](/de/admin/observability/) und
[Updates](/de/admin/upgrades/).

## Wo werden meine Daten gespeichert?

Auf deinem Server: die Datenbank in Postgres und die Dateien (Fotos, Belege, Dokumente) auf dem Datenvolume von Kept
oder in einem S3-Bucket, den du selbst wählst. Dein Telefon behält eine Kopie für die Offline-Nutzung, ohne
geheime Werte. Siehe [Dateispeicher](/de/admin/storage/) und [die Telefon-App](/de/users/phone-app/).

## Wie lösche ich mein Konto?

Einstellungen → Ich → Mein Konto löschen, mit deinem Passwort. Gib zuerst jeden Standort, den du
besitzt (außer Persönlich), an jemand anderem ab, oder lösche ihn; der einzige Admin der Instanz
muss zuerst einen anderen Admin ernennen. Das Konto wartet dann 30 Tage: Beim Anmelden werden das
Datum und eine Möglichkeit angezeigt, es zu behalten, und sonst öffnet sich nichts. Danach wird es
zusammen mit deinem persönlichen Standort gelöscht. Was du zu den Standorten anderer Personen
hinzugefügt hast, bleibt dort. [Exportiere deine Daten](/de/users/import-export/#exportieren) zuerst,
falls du eine Kopie möchtest.

## Kann ich es ohne KI nutzen?

Ja. Alles funktioniert außer dem Benennen von Dingen anhand von Fotos, dem Lesen von Belegen,
dem Assistenten und der Suche nach Bedeutung. Ohne Anbieter warten erfasste Dinge im Posteingang
auf einen Namen, und die Suche nutzt Stichwörter. Siehe [KI-Anbieter](/de/users/ai-providers/).

## Welche KI-Anbieter funktionieren, und wer bezahlt?

Groq (empfohlen), OpenAI, Anthropic, Google, OpenRouter oder jeden OpenAI-kompatiblen Server wie
Ollama. Du nutzt deinen eigenen Schlüssel; die Nutzung in einem Standort wird über den Schlüssel
des Standortbesitzers abgerechnet, und du kannst die Kosten begrenzen. Siehe
[KI-Anbieter](/de/users/ai-providers/).

## Funktioniert es offline?

Auf einem Telefon mit installiertem Kept: Ja, zum Finden und Erfassen: Browsen, Suchen, Erfassen,
Bewegen von Dingen, Ablesungen, Box-Kontrollen und Scannen von Etiketten. Änderungen an Details,
Berichte, Importe und Exporte benötigen eine Verbindung. Was du offline tust, wird synchronisiert,
wenn du wieder online bist. Siehe
[Kept auf deinem Telefon](/de/users/phone-app/#was-offline-funktioniert).

## Gibt es eine App im App Store oder bei Google Play?

Nein. Kept ist eine Web-App, die du über den Browser zum Startbildschirm hinzufügst. Kept muss
auf HTTPS laufen. Siehe [Kept auf deinem Telefon](/de/users/phone-app/#installieren) und
[HTTPS](/de/install/https/).

## Läuft es auf arm64 oder einem Raspberry Pi?

Die Images werden für amd64 und arm64 gebaut, sodass sie auf ARM-Servern und unter Docker auf Apple Silicon laufen. Ein
Raspberry Pi mit 1 GB oder mehr könnte funktionieren, allerdings langsamer; kein Release wird auf einem solchen getestet. Kept wird
mit 1 GB RAM und ein oder zwei CPU-Kernen (arm64) getestet. Siehe
[Was wurde getestet](/de/install/hardware/).

## Wie viele Personen können ein Kept nutzen?

Kept wird nach der Anzahl der Dinge dimensioniert, nicht nach Personen: die Ziele sind 10,000 Dinge an einem
Standort und 50,000 in einer Instanz; der 1-GB-Test verwendete 3,000 an einem Standort. Personen treten
einem Standort per Einladung bei, und jeder Standort kann bis zu 20 verwaltete Konten für Personen
ohne E-Mail umfassen. Siehe [Was wird benötigt](/de/install/hardware/) und
[Personen einladen](/de/users/first-run/#5-leute-einladen).

## Kann ich mehrere Haushalte führen oder nur einen Teil meiner Dinge teilen?

Ja. Jeder Standort (ein Zuhause, eine Garage, ein Lagerraum, das Haus der Eltern) wird einzeln geteilt,
mit eigenen Mitgliedern und Rollen; das Teilen der Garage gibt nichts weiter frei. Eine Person
kann mehreren Standorten angehören, und jeder hat einen privaten persönlichen Standort. Siehe
[Deine ersten Minuten](/de/users/first-run/#5-leute-einladen).

## Wie unterscheidet sich Kept von Homebox?

Beide behalten den Überblick darüber, was du besitzt und wo es ist. Kept hat zusätzlich:

- **Eine 3D-Karte** deiner Etagen, Räume, Regale und Boxen.
- **Fahrzeuge**: Ablesungen, Wartungen, Kraftstoff und ihre Kosten.
- **Erinnerungen** für Garantien, Wartungen, Leihen und niedrigen Bestand.
- **Offline-Nutzung** auf deinem Telefon, mit Etiketten, die du druckst und scannst.
- **KI, falls du möchtest**: Erfassen anhand eines Fotos und ein MCP-Server für Assistenten.

Es importiert ein Homebox-Backup, damit du es mit deinen eigenen Dingen ausprobieren kannst.

## Kann ich von Homebox umziehen?

Ja. Ab Homebox v0.26.1 oder neuer (v0.27.0 empfohlen) erstelle ein Backup in Homebox (**Sammlung →
Werkzeuge → Sicherung & Wiederherstellung → Sicherung erstellen**, dann **Herunterladen**), importiere diese ZIP-Datei in
Kept, prüfe, was passieren wird, und importiere dann. Fotos, Belege, Garantien, Wartungen und Tags werden
übernommen, und alte Homebox-Etiketten lassen sich noch scannen. Ein Artikel wird als verkauft
übernommen, nur wenn Homebox einen Käufer oder einen Preis dafür hat (ein reines Verkaufsdatum
bleibt in seinen Notizen), und archivierte Artikel werden als **Archiviert** übernommen, es sei denn,
du wählst **In Gebrauch** oder **Ausschließen**. Verbinde zuerst [Paperless-ngx](/de/users/paperless/),
und Homebox' Links zu seinen Dokumenten werden als Paperless-Links übernommen. Siehe
[Import und Export](/de/users/import-export/#ein-homebox-export); ein Import vor 1.14.1 kann
[repariert](/de/users/import-export/#einen-früheren-import-reparieren) werden. Ein älteres
Homebox hat kein Backup, das Kept lesen kann: aktualisiere zuerst eine Kopie davon oder importiere
seine Tabelle. Siehe
[Umstieg von einer älteren Homebox](/de/users/import-export/#von-einem-älteren-homebox-kommen).

## Wie sichere ich es?

Der Server erstellt nächtlich einen verschlüsselten restic-Snapshot der Datenbank, der Dateien und
einer lesbaren Kopie jedes Standorts auf eine andere Festplatte, in einen S3-Bucket oder auf einen
SFTP-Server. Bewahre das Wiederherstellungskit an einem anderen Ort auf. Um einen Standort mitzunehmen,
exportiere ihn. Siehe [Backups](/de/admin/backups/),
[das Wiederherstellungskit](/de/admin/recovery-kit/) und [Import und Export](/de/users/import-export/#exportieren).

## Was passiert, wenn der Server zusammen mit dem Haus verloren geht?

Die lesbare Kopie des Backups öffnet sich in jedem Browser mit restic, dem Backup-Passwort und einem
Laptop, ohne dass Kept benötigt wird. Um Kept selbst auf einem neuen Rechner wiederherzustellen,
benötigst du ebenfalls das Wiederherstellungskit. Siehe
[Deinen Bestand allein mit restic lesen](/de/admin/read-with-restic/) und
[Wiederherstellung](/de/admin/restore/).

## Welche Sprachen spricht es?

Englisch, Arabisch (von rechts nach links), Französisch, Deutsch, Italienisch, Vietnamesisch,
Ukrainisch und Spanisch, pro Gerät wählbar. Siehe [Sprache und Design](/de/users/first-run/#6-sprache-und-design).

## Unter welcher Lizenz steht es?

Die GNU Affero General Public License, Version 3 (AGPL-3.0). Du kannst sie ausführen, verändern und
weitergeben; wenn du eine geänderte Version über ein Netzwerk für andere Personen betreibst,
musst du ihnen den Quelltext anbieten. Der Text befindet sich im Repository unter
[LICENSE](https://github.com/keptinventory/kept/blob/main/LICENSE).

## Ist Kept kostenlos? Wird es kostenpflichtig?

Die selbst gehostete Version von Kept ist kostenlos und Open Source. Mobile Apps, Desktop-Apps und
eine Cloud-Version sind in Arbeit.

## Gibt es ein Release?

Ja: `1.0.0` war das erste signierte Release, auf GHCR als `ghcr.io/keptinventory/kept`,
und jedes Release seitdem ist auf der [Releases-Seite](https://github.com/keptinventory/kept/releases)
aufgeführt. Upgrades führen ihre Migrationen einmal durch, erstellen zuerst einen Snapshot der
Datenbank und können eine Version zurückgehen. Siehe [Installation mit Docker Compose](/de/install/compose/)
und [Aktualisierungen](/de/admin/upgrades/).
