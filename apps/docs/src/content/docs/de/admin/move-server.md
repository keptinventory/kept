---
title: Umzug auf einen neuen Server
description: Zwei Wege, um Kept umzuziehen – die ganze Instanz über ein Backup oder einen Standort nach dem anderen über einen Export.
sidebar:
  order: 8
---

## Die ganze Instanz: über ein Backup

Damit zieht alles um (alle Konten, Standorte, Dateien und Einstellungen) und das Verfahren ist dasselbe wie beim Wiederherstellen nach einem verlorenen Server:

1. Auf dem alten Server erstellst du ein Backup und lässt es fertigstellen und druckst den [Recovery-Kit](/de/admin/recovery-kit/).
2. Auf dem neuen Server [installierst du Kept](/de/install/compose/) mit den Schlüsseln des Kits in `.env` und demselben Backup-Ziel, aber **starte Kept noch nicht**.
3. [Stelle](/de/admin/restore/#nach-dem-verlust-des-servers) das neueste Backup in der neuen, leeren Datenbank wieder her.
4. Weise die alte Adresse dem neuen Server zu (DNS oder dein Proxy), lass `KEPT_PUBLIC_URL` unverändert und starte Kept. Etiketten und QR-Codes funktionieren weiter, weil sich die Adresse nicht geändert hat.
5. Stoppe den alten Server, sobald der neue geprüft ist, und behalte seine Festplatte, bis der neue ein gutes Backup und eine [Wiederherstellungsübung](/de/admin/restore/#die-monatliche-übung) hatte.

Wenn sich die Adresse doch ändert, tragen bereits gedruckte Etiketten noch die alte: Weise den alten Hostnamen ebenfalls dem neuen Server zu und nimm ihn in die ehemaligen Hostnamen der Instanz auf: Kept leitet dann einen Aufruf unter dem alten Namen auf dieselbe Seite unter der neuen Adresse um.

## Ein Standort nach dem anderen: über einen Export

Ein Besitzer exportiert einen Standort mit seinen Dateien und, falls gewünscht, seinen geheimen Werten mit einem Passwort; auf dem neuen Server wird er in einen neuen Standort importiert. Das verschiebt einen Haushalt, ohne den Rest der Instanz, und funktioniert zwischen zwei Instanzen, die unterschiedliche Versionen laufen lassen, solange die neue nicht älter ist als die alte (ein älteres Kept lehnt den Export eines neueren möglicherweise ab).

1. Auf dem alten Server unter **Einstellungen → Export** den Standort exportieren. Wähle, ob geheime Werte enthalten sein sollen; falls ja, setze ein Passwort. Exporte werden nur über HTTPS erstellt und bleiben 7 Tage zum Download verfügbar.
2. Auf dem neuen Server anmelden, **Einstellungen → Import** öffnen und den Kept-Export (das ZIP) auswählen. Kept prüft ihn zuerst und zeigt, was hinzugefügt wird, bevor etwas geschrieben wird; gib das Passwort ein, um die geheimen Werte zurückzuholen.
3. Beim Import entsteht ein **neuer Standort** mit den Dingen, Orten, Dateien, Zustandsberichten, Verschiebungen und deren Verlauf. Gedruckte Etiketten funktionieren weiter: Der Kurzcode eines Etiketts wird behalten, wenn er auf dem neuen Server frei ist, und neu vergeben, wenn nicht; im letzteren Fall öffnet das Scannen des alten Etiketts trotzdem das Ding.
4. Lade die Personen ein, die den Standort geteilt haben; der Import listet sie auf, lädt aber niemanden von sich aus ein.
