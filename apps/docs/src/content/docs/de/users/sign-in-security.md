---
title: Anmeldung und Sicherheit
description: Passkeys und die Authenticator-App in Einstellungen, Backup-Codes, App neu einrichten, ausschalten, was Kept ablehnt und warum, und warum die App-Sperre kein Passkey ist.
---

**Einstellungen → Anmeldung und Sicherheit** enthält die Arten, wie sich dein Konto über ein Passwort hinaus anmeldet:
Passkeys und Zwei-Faktor mit einer Authenticator-App.

## Bestätige, dass du es bist

Jede Änderung auf dieser Seite fragt zuerst:

- ein Konto mit Passwort: **dein Passwort**;
- ein Konto ohne Passwort (nur Passkey, E-Mail-Link oder Google): **eine Anmeldung in den letzten zehn
  Minuten**. Ist sie älter, bietet das Fenster **Erneut anmelden**.

Passkey hinzufügen fragt bei einem Konto mit Passwort auch nach dem Passwort und braucht immer eine Anmeldung in
den letzten zehn Minuten, egal welches Konto: Der Browser öffnet danach seinen eigenen Passkey-Dialog.
Zwei-Faktor ein- oder auszuschalten gilt nicht als erneute Anmeldung.

Google oder deine OIDC-Anmeldung in **Anmeldemethoden** zu trennen fragt auf dieselbe Weise.

Jede Änderung meldet alle anderen Geräte ab, außer beim Umbenennen eines Passkeys. Kept schreibt dir eine E-Mail, wenn ein Passkey
hinzugefügt oder entfernt wird, wenn eine externe Anmeldung getrennt wird, wenn Zwei-Faktor eingeschaltet, neu eingerichtet
oder ausgeschaltet wird, und wenn neue Backup-Codes erstellt werden. Verwaltete Konten (Benutzername, keine E-Mail) erhalten keine E-Mail.

## Passkeys

Ein Passkey meldet dich mit Face ID, einem Fingerabdruck oder der Bildschirmsperre deines Telefons an, ohne Passwort
einzugeben. Kept sieht ihn nie: Er bleibt auf dem Gerät oder in deinem Passwort-Manager. Er gehört zu einer
Adresse: Bei einem Kept mit [mehr als einer](/de/install/home-network/#mehr-als-eine-adresse) fügst du ihn bei der Hauptadresse hinzu und nutzt ihn dort.

| | |
|---|---|
| **Passkey hinzufügen** | Benenne ihn (Kept schlägt das Gerät vor: "Mac", "iPhone"), dann beantworte den Dialog des Browsers. Diesen Dialog zu schließen ändert nichts. |
| **Synchronisiert** | Dein Passwort-Manager oder die Plattform hält ihn auch auf deinen anderen Geräten. |
| **Nur dieses Gerät** | Er liegt nur auf diesem einen Gerät oder Sicherheitsschlüssel. |
| **Umbenennen** | Der Name ist deiner, bis zu 64 Zeichen. |
| **Entfernen** | Er meldet dich nicht mehr an. Lösche ihn auch auf dem Gerät, wenn du ihn dort nicht mehr willst. |

Jeder Passkey, den Kept hinzufügt, prüft, dass du es bist (Face ID, Fingerabdruck oder PIN), deshalb zählt eine Anmeldung mit Passkey
als Zwei-Faktor für sich, auch an Orten, die danach fragen.

## Die Authenticator-App

Zwei-Faktor mit einer App wie 1Password, Google Authenticator oder Aegis: Nach deinem Passwort,
E-Mail-Link oder Google fragt die Anmeldung nach dem 6-stelligen Code der App.

- **Einschalten**: bestätige, dass du es bist, scanne den QR-Code (oder tippe den Schlüssel ein), gib einen Code ein und speichere dann die
  zehn Backup-Codes. Es ist erst eingeschaltet, wenn der Code übereinstimmt.
- **8 von 10 Backup-Codes übrig**: Jeder Backup-Code meldet dich einmal an, für den Fall, dass dein Telefon weg ist.
- **Neue Backup-Codes**: zehn neue Codes, einmal angezeigt. Die alten hören auf zu funktionieren.
- **Neu einrichten**: für ein neues Telefon oder eine andere App. Scanne den neuen QR-Code und gib einen Code aus der
  neuen App ein. Bis dahin funktioniert die aktuelle App weiter; schließt du das Fenster mittendrin, ändert sich nichts.
  Wenn es fertig ist, hören die Codes der alten App und die alten Backup-Codes auf zu funktionieren.
- **Ausschalten**: Die Anmeldung fragt nicht mehr nach einem Code.

## Was Kept ablehnt

Das lehnt der Server ab, egal was der Bildschirm zeigt:

- **Deine letzte Anmeldemöglichkeit entfernen.** Ein Passkey kann nicht entfernt werden, und Google oder deine OIDC-Anmeldung
  kann nicht getrennt werden, wenn sonst nichts dich anmelden würde: ein Passwort, ein anderer Passkey, Google oder
  die OIDC-Anmeldung (solange dieses Kept sie noch anbietet) oder ein E-Mail-Link (wenn dieses Kept E-Mail sendet
  und deine Adresse bestätigt ist).
- **Zwei-Faktor dort ausschalten, wo ein Ort ihn braucht.** Während ein Ort, dem du angehörst, Zwei-Faktor verlangt und du keinen Passkey hast, bleibt die Authenticator-App eingeschaltet. Füge zuerst einen Passkey hinzu. Genauso bleibt dein letzter Passkey, solange sich ein solcher Ort darauf verlässt und die App ausgeschaltet ist.
- **Einen Passkey oder die App hinzufügen, bevor deine Adresse bestätigt ist**, wenn dieses Kept E-Mails sendet.
  Melde dich einmal mit einem Link an, der an die Adresse gesendet wird, und versuche es dann noch einmal.

## Die App-Sperre ist kein Passkey

**Einstellungen → Dieses Gerät → Mit Face ID oder Fingerabdruck entsperren** entsperrt Kept auf genau diesem Gerät,
nachdem du bereits angemeldet bist ([die App-Sperre](/de/users/phone-app/#die-app-sperre)). Sie kann dich nicht anmelden.
Wenn der Browser sie bei der Anmeldung anbietet und Kept mit *Dieser Passkey gehört nicht zu den Anmeldungen dieses Kontos* antwortet, melde dich auf anderem Weg an und füge dann hier einen echten Passkey hinzu.
