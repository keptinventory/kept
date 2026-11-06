---
title: Lokale KI mit Ollama
description: Führe das KI-Modell auf deinem eigenen Rechner mit dem Ollama-Profil in compose.full.yaml aus und was es an Speicher kostet
sidebar:
  order: 10
---

Die KI-Funktionen von Kept (Dinge aus Fotos und Belegen ausfüllen, der Assistent, die semantische Suche)
funktionieren mit jedem Anbieter, den der Eigentümer eines Standorts in **Einstellungen → KI** verbindet. Ollama führt das Modell
auf deiner eigenen Hardware aus, sodass nichts das Gerät verlässt; Kept spricht es als **OpenAI-kompatiblen** Anbieter an.

:::caution[Nicht getestet]
Ollama wurde mit Kept noch nicht gemessen. Ein Modell teilt sich den Speicher der Maschine mit Kept, also plane
mehr als die [1 GB, auf denen Kept getestet ist](/de/install/hardware/), und erwarte, dass ein kleines Modell beim
Lesen von Belegen langsamer und ungenauer ist als ein gehostetes.
:::

## Einrichtung

1. Ollama wird mit `compose.full.yaml` geliefert, nicht mit `compose.yaml`: lade sie herunter und setze
   `COMPOSE_FILE=compose.full.yaml` in `.env` ([Caddy und Ollama](/de/install/compose/#caddy-und-ollama)).
   Starte Kept mit dem `ollama`-Profil und hole dir dann ein Modell mit Ollamas eigenem Befehl hinein:

   ```sh
   docker compose --profile ollama up -d
   docker compose exec ollama ollama pull <model>
   ```

   Die Modelle liegen in dem Volume `ollama`. Nichts wird auf dem Host veröffentlicht: Nur Kept erreicht
   Ollama, über Composes Netzwerk. Das Image ist vor jedem Modell etwa 3,8 GB (amd64) oder 2,8 GB (arm64).

2. **Private Adressen erlauben.** `http://ollama:11434` liegt im eigenen Netzwerk von Compose, eine private
   Adresse, und Kept lehnt solche standardmäßig ab ([ausgehende Anfragen](/de/admin/security-model/#ausgehende-anfragen-ssrf)).
   Ein Instanz-Administrator schaltet zuerst **Admin → Einstellungen → Private Adressen erlauben** ein;
   ohne es sagt das Hinzufügen des Anbieters "That address is on a private network". Das gilt auch für ein
   Ollama (oder LM Studio) an anderer Stelle in deinem Heimnetzwerk.

3. In **Einstellungen → KI**, füge einen **OpenAI-kompatiblen** Anbieter mit der Basis-URL
   `http://ollama:11434/v1` und dem Modell, das du heruntergeladen hast, hinzu. Ollama ignoriert den
   API-Schlüssel, also tut es jeder Wert.
