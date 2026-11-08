---
title: KI-Anbieter
description: Mit welchen KI-Anbietern Kept funktioniert, wo Schlüssel gespeichert werden, was jedes Feature sendet und kostet, Ausgabelimits, lokale Modelle und KI ausschalten.
---

Kept funktioniert ohne KI. Wenn du einen Anbieter verbindest, kommen drei Dinge dazu: Dinge aus Fotos benennen sowie Belege, Etiketten und Zählerstände lesen; den Assistenten, der Fragen zu deinem Inventar beantwortet; und mit einem Einbettungsmodell die Suche nach Bedeutung. Du bringst deinen eigenen Schlüssel mit; Kept hat keinen eigenen KI-Dienst.

## Anbieter

| Anbieter | Fotos und Belege | Assistent | Suche nach Bedeutung |
|---|---|---|---|
| **Groq** (empfohlen) | ja | ja | kein Einbettungsmodell |
| **OpenAI** | ja | ja | ja |
| **Anthropic** | ja | ja | kein Einbettungsmodell |
| **Google** (Gemini) | ja | ja | ja |
| **OpenRouter** | ja | ja | ja (seine Einbettungsmodelle) |
| **OpenAI-kompatibel** (Ollama, LM Studio, …) | die Modelle, die du nennst | die Modelle, die du nennst | wenn der Server eines anbietet |

**Groq mit `qwen/qwen3.8-27b`** ist die Empfehlung: das günstigste zuverlässige Ergebnis, das Kept gemessen hat, etwa 0,004 USD pro Beleg (auf synthetischen Testbildern, 2026-09-26). Wenn du einen Groq-Schlüssel einfügst, wird es ausgewählt, und **Warum?** auf der Seite nennt die Zahlen. Kept schlägt für jeden Anbieter und jede Aufgabe ein Modell vor; du kannst unter **Erweitert** ein anderes aus der Liste des Anbieters wählen oder eine beliebige Modell-ID eingeben.

## Wo der Schlüssel landet

Es gibt drei Stellen für einen Schlüssel, und keinen pro Standort:

| Schlüssel | Festgelegt in | Zahlt für |
|---|---|---|
| **Der Schlüssel des Kontos** | **Einstellungen → KI**, vom Konto-Inhaber | Jeder Standort, der diesem Konto gehört |
| **Ihr persönlicher Schlüssel** | **Einstellungen → KI → Persönlicher KI-Schlüssel** | Dein Persönlicher Standort, deine privaten Assistenten-Threads und Fragen, die mehrere Besitzer überspannen. Mit [Persönlich versteckt](/de/users/locations/#persönlich-ausblenden) auch ein Standort, der dir allein gehört und den du allein nutzt, wenn das Konto keinen Schlüssel hat |
| **Schlüssel dieses Servers** | **Admin → KI**, von einem Instanz-Admin | Alle, deren Konto keinen eigenen Schlüssel hat |

Arbeit in einem Standort (ein Foto benennen, eine Assistenten-Antwort dazu) wird vom **Besitzer des Standorts** bezahlt, also nutzen Mitglieder von Alfreds "Family house" Alfreds Schlüssel, nicht ihren eigenen. Mitglieder und Betrachter sehen eine schreibgeschützte Zeile, die angibt, wer zahlt.

**Verbinden:** Füge den Schlüssel in **Schlüssel einfügen** ein. Kept erkennt den Anbieter am Schlüssel, wo es kann (sonst wähle ihn unter **Erweitert**), dann prüft **Speichern und testen**, ob das Modell Fotos liest und strukturierte Antworten gibt, und nennt, was der Test gekostet hat. Schlüssel sind nur schreibbar: Kept zeigt einen gespeicherten Schlüssel nie wieder, und **Schlüssel ersetzen** tauscht ihn aus. Vor dem ersten Schlüssel auf einem Server muss der Instanz-Admin das [Recovery-Kit](/de/admin/recovery-kit/) speichern: der Schlüssel ist ein Geheimnis, das Kept aus einem Backup wiederherstellen können muss.

**Erweitert** enthält Anbieter und Basis-URL, das Modell für jede Aufgabe (**Modelle**), **Denkaufwand** (standardmäßig niedrig), die Limits und die Preise.

**Modelle:** Die Liste stammt vom Anbieter selbst und wird jedes Mal abgefragt, wenn der Picker öffnet (Kept nutzt sie zehn Minuten wieder; **Liste aktualisieren** fragt erneut). OpenRouters `:free`-Modelle sind enthalten, markiert als "free: shared, may be busy": ein gemeinsamer Pool, der oft mit "busy" antwortet. Unter jedem Picker akzeptiert **Custom model id** jede ID, für jeden Anbieter, auch eine, die die Liste nicht zeigt; **Speichern und testen** prüft sie dann. Wenn der Anbieter die Liste nicht beantwortet, bleibt das Eintippen der ID.

## Was KI nutzt und was es kostet

Die KI-Einstellungen öffnen mit **Was in Kept KI nutzt**: eine Zeile pro Aktion (ein erfasstes Foto, ein Beleg, ein Etikett, ein Ablesewert, eine Assistentenfrage, eine Suche, der Test), mit der Zahl der Aufrufe, den verbrauchten Tokens und den Kosten aus der Preistabelle, aus deiner Nutzung der letzten 30 Tage, sobald es welche gibt. Unter **Dieser Monat** zeigt ein Balken pro Limit die bisherigen Ausgaben.

- **Erfassen** (Ding, Beleg, Etikett, Ablesewert): ein Aufruf pro Foto. Namen, Marken, Modelle und Typen werden eingetragen; Preise, Daten, Seriennummern und Ablesewerte warten im Posteingang als Vorschlagswerte, die du annehmen kannst. Jeder von KI ausgefüllte Entwurf trägt eine Zeile wie "Read by qwen/qwen3.8-27b (Groq), 2,502 tokens", mit Kosten und Angabe, wer bezahlt hat.
- **Mehrere Dinge auf einem Foto** (Ding-Modus; Admin → Einstellungen, standardmäßig aus): derselbe eine Aufruf benennt bis zu 12 Dinge auf dem Foto. Das erste füllt den Entwurf der Erfassung aus und behält das Foto; jedes weitere wird ein Entwurf daneben, am selben Ort und im selben Stapel, mit eigenem aus dem Foto ausgeschnittenen Bild, zum Bestätigen, Zusammenführen oder Verwerfen im Posteingang. Wie gut die Bilder ausgeschnitten werden, hängt von den Rahmen des Anbieters ab, prüfe also ein paar Entwürfe nach dem Einschalten.
- **Raumfotos** (Raum-Modus): ein Aufruf pro Foto, der bis zu 60 Objekte auflistet, und bei mehreren Fotos ein kurzer nur-Text-Aufruf, der sie zusammenführt. Die Objekte werden zu Entwürfen im Raum, jedes mit eigenem Bild ([Raumfotos](/de/users/room-photos/)).
- **Grundrisse** (in der Standortkarte: **Mit einem Grundriss beginnen**): ein Aufruf pro Plan, der seine Räume, ihre Beschriftungen und gedruckten Größen liest; Kept rechnet die Größen aus und setzt sich selbst, und du prüfst sie, bevor etwas hinzugefügt wird ([der Standortkarte](/de/users/location-map/#mit-einem-grundriss-beginnen)). Das Blatt zeigt, wie viel ein Lesen höchstens verbrauchen kann, bevor es gesendet wird: etwa 11.000 Tokens bei Groq, eine Schätzung.
- **Der Assistent** antwortet aus deinem Inventar innerhalb deiner Rolle, und jedes Werkzeug, das er nutzt, ergibt einen weiteren Aufruf. Änderungen, die er vorschlägt, erscheinen als Bestätigungskarte, die du freigibst; für Betrachter ist er nur lesend.
- **Suchwörter nach einem Import**: ein Import kann **Suchwörter mit KI hinzufügen?** anbieten, mit der Token-Schätzung zuerst ([Import](/de/users/import-export/)).

**KI-Nutzung**-Seiten listen jeden Aufruf: **Meine KI-Nutzung** für alle, die Nutzung eines Standorts für dessen Admins und Besitzer, die des Kontos für dessen Besitzer und die der Instanz unter Admin → KI. Jede zeigt Summen, Tokens pro Tag gestapelt nach Aufgabe, Aufschlüsselungen nach Aufgabe, Person und Standort, wo sie zutreffen, sowie die Aufrufliste mit **Als CSV exportieren**. Ein Aufruf speichert Modell, Tokens, Ergebnis und Kosten, nie den Prompt, das Foto, die Antwort oder den Schlüssel.

Die Preise stammen aus der **Preistabelle**, die Instanz-Admins in Admin → KI bearbeiten (mit **Aus der Liste von … füllen** für Anbieter, die Preise veröffentlichen). Der Preis des empfohlenen Groq-Modells wird für dich eingetragen. Ein Aufruf ohne Preis wird in Tokens gezählt und als Kosten unbekannt angezeigt.

## Limits und Pausieren

Nichts wird durch Geld begrenzt, außer jemand wählt es: Nach dem ersten Schlüssel bietet Kept **Monatslimit setzen?** mit einem vorgeschlagenen Betrag und **Kein Limit** an. Unter **Erweitert** enthält **Limits**:

- **Betrag pro Monat** (in einer Währung, die der Server aktiviert hat) und **Tokens pro Monat**, für das Konto; ein eigenes Limit eines Standorts innerhalb des Kontos, vom Besitzer gesetzt; sowie ein Limit pro Person.
- Das Lesen von Fotos und Belegen hat ein Token-Budget von 60.000 Tokens pro Minute, 2.000.000 pro Tag und 20.000.000 pro Monat pro zahlendem Konto, sofern nicht geändert.
- **KI pausieren** stoppt alle Aufrufe von Hand, bis du fortsetzt.

Wenn ein Limit erreicht ist, pausiert KI nur für diesen Bereich, mit einem Banner wie "AI paused until 1 Oct, Home's monthly cap reached". **Erfassungen werden weiterhin gespeichert; das Benennen wartet**, und wird fortgesetzt, wenn KI es wieder tut. Wer das Limit gesetzt hat, erhält **Jetzt fortsetzen**, um es anzuheben, zu entfernen oder pausiert zu lassen. Ein eigenes Rate-Limit des Anbieters ist keine Pause: Fortschrittszeilen sagen "Waiting for Groq, about 20 s" und machen weiter.

**Eine Assistenten-Anfrage wird unter dem pro-Minute-Limit des Anbieters gehalten**, sobald der Anbieter es benannt hat (Groqs kostenloser Tarif: 8.000 Tokens pro Minute). Jede Anfrage trägt die Werkzeuge, um die es in der Frage geht: Dinge finden und die alltäglichen Änderungen immer, und Ausleihen, Zeitpläne, Garantien, Dokumente, Fahrzeuge, Bestand, Verlauf oder Orte, wenn die Frage (oder die letzten des Threads) sie nennt, in einer von Kepts Sprachen; ein Werkzeug, das das Modell anfordert und nicht gesendet wurde, wird im nächsten Schritt gesendet. Eine erste Frage mit allen Modulen an kommt auf etwa 3.100 Tokens vor der Antwort-Zulage. Wenn eine Anfrage immer noch zu groß ist, sendet Kept weniger Werkzeuge, fragt dann nach einer kürzeren Antwort, lässt dann die ältesten Werkzeugergebnisse aus dem Gesendeten weg; der Thread behält sie. Eine Frage, die immer noch nicht passt, scheitert mit "too large": ein Modell oder Plan mit höherem Limit beantwortet sie.

## Was an den Anbieter geschickt wird

Kepts eigene Zusammenfassung, neben jedem Anbieter angezeigt:

> Nur eine Kopie des Fotos, bei der Standort- und Kameradaten entfernt wurden, nie das Original. Die festen Anweisungen und die Sprachen deines Standorts. Für den Assistenten deine Frage und das Inventar, das er nachschlägt, innerhalb deiner Rolle. Nie geheime Felder.

Ein Grundriss sendet dieselbe Art von Kopie (die erste Seite eines PDF als Bild gezeichnet, mit dem Text dieser Seite) und keine deiner Standort-, Raum- oder Etagennamen; der eigene Text des Plans wird als Daten gesendet, und nichts, was Kept aus der Antwort behält, ist ein Name, eine Adresse oder eine Zahl aus dem Plan außer den Beschriftungen und Größen der Räume.

Darunter fasst Kept zusammen, was der Anbieter sagt, dass er mit API-Daten macht (Training, Aufbewahrung), und verlinkt seine Richtlinie. Ein Server, den du selbst betreibst, behält, was du ihn behalten lässt.

## Suche und Einbettungen

Die Stichwortsuche funktioniert immer, einschließlich der Suchwörter, die KI zu Dingen in jeder Sprache des Standorts hinzufügt. Suche nach Bedeutung braucht ein Einbettungsmodell, das aus einem von drei Orten stammt, vom Server-Admin gesetzt mit `KEPT_EMBEDDINGS` ([Konfiguration](/de/reference/configuration/)):

- `provider` (die Standardeinstellung): der Anbieter des Standorts, wenn er ein Einbettungsmodell hat (OpenAI, Google, OpenRouter oder ein OpenAI-kompatibler Server). Wähle eines unter **Erweitert → Modelle → Suche**; OpenRouter hat keinen Standard und listet kostenlose. Groq und Anthropic haben keine, also bleibt die Suche mit denen nur Stichwort und sagt das. Ein weiter oben in der Kette liegender Schlüssel mit einem Suchmodell (dieses Servers) deckt einen Standort ab, dessen eigener Schlüssel keines hat.

  Wenn ein Schlüssel ein Assistentenmodell, aber kein Suchmodell hat und weiter oben nichts eines liefert, sagt **Einstellungen → KI** **Die Suche findet nur nach Namen**, mit dem Schritt: **Suchmodell wählen**, oder für Groq und Anthropic **Anderen Anbieter wählen**. Admin → Status → Such-Embeddings zählt die Standorte, die nur nach Namen suchen, ohne sie zu nennen.

  Kept fragt OpenAI und Google nach 768-Zahlen-Vektoren. Andere Modelle antworten mit ihrer eigenen Länge, die 2.000 oder weniger sein muss: ein Modell mit längeren Vektoren kann nicht für die Suche verwendet werden. Eine Anfrage, die mit Vektoren anderer Länge als gefragt oder mit zwei Längen zurückkommt, wird abgelehnt und nichts gespeichert.
- `local`: ein kleines Modell innerhalb von Kept, ohne Schlüssel und ohne Kosten pro Aufruf. Kept lehnt diese Einstellung ab, es sei denn, die Laufzeitumgebung des lokalen Modells ist installiert.
- `off`: nur Stichwortsuche.

## Lokale Modelle mit Ollama

Um alles auf deiner eigenen Hardware zu halten, betreibe ein Modell mit Ollama und füge es als **OpenAI-kompatiblen** Anbieter mit seiner Basis-URL hinzu; Kept füllt für diese Art nichts aus, also benennst du die Modelle. Eine Adresse in deinem privaten Netzwerk muss von einem Instanz-Admin in Admin → Einstellungen erst erlaubt werden. Einrichtung, Speicher und das Compose-Profil: [Ollama](/de/admin/ollama/).

## KI ausschalten

- **Für einen Standort:** **Standorteinstellungen → Was erfasst wird**, unter **KI an diesem Standort**, schalte **KI-Erfassung und der Assistent** aus. Erfassen funktioniert weiter; Dinge warten im Posteingang auf einen Namen.
- **Für eine Weile:** **KI pausieren**, unter Erweitert.
- **Gar nicht verbinden:** Ist auf keiner Ebene ein Schlüssel vorhanden, wird nichts gesendet, und der Schritt **KI-Anbieter verbinden** der Checkliste kann ignoriert werden.

Die KI-Seite hat keine Schaltfläche, um einen gespeicherten Schlüssel zu löschen; ersetze ihn, pausiere oder schalte KI pro Standort aus.

:::note[ChatGPT oder Claude als Client]
"ChatGPT oder Claude verbinden" (die Voreinstellung Vollausstattung) funktioniert andersherum: deine KI-App liest und aktualisiert Kept über MCP, mit eigenem Modell und Abonnement, mit einem Token, das du in **Einstellungen → Verbindungen** erstellst. Siehe [KI-Apps verbinden](/de/users/mcp-clients/) und für die Details [MCP](/de/developers/mcp/).
:::
