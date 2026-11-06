---
title: Cambiare l'archiviazione dei file
description: Sposta i file di Kept tra il disco del server e un bucket S3, con copia verificata.
sidebar:
  order: 6
---

Kept memorizza i file (foto, ricevute, documenti) sul volume dati (`KEPT_STORAGE=local`, il valore predefinito) oppure in un bucket compatibile con S3 (`KEPT_STORAGE=s3` con le variabili `KEPT_S3_*`). Cambiare solo `KEPT_STORAGE` non sposta nulla: i file già memorizzati restano dove erano e Kept non riesce a trovarli. Spostarli è fare una copia.

## Spostare

I file non cambiano mai una volta memorizzati, quindi la copia è sicura mentre Kept è in esecuzione, e può essere ripetuta: un file già presente alla destinazione con l'hash corretto viene saltato.

1. Aggiungi le impostazioni della destinazione accanto a quelle attuali (per S3: `KEPT_S3_BUCKET`,
   `KEPT_S3_ACCESS_KEY_ID`, `KEPT_S3_SECRET_ACCESS_KEY` e, se serve, `KEPT_S3_ENDPOINT`,
   `KEPT_S3_REGION`, `KEPT_S3_FORCE_PATH_STYLE`), lasciando `KEPT_STORAGE` come è.
2. **Copia mentre Kept è in esecuzione:** `kept admin storage copy --to s3` (oppure `--to local`). Viene copiato ogni file a cui fa riferimento il database, con le sue versioni ridimensionate, e ne viene verificato lo SHA-256. `--dry-run` conta soltanto.
3. **Ferma Kept**, poi copia di nuovo: viene copiato solo ciò che è arrivato nel frattempo.
4. Imposta `KEPT_STORAGE` sul nuovo store e avvia Kept.
5. **Verifica:** `kept admin storage verify --store s3` controlla ogni file a cui fa riferimento il database.

I vecchi file restano dove erano; cancellali tu stesso quando sei soddisfatto.

## Prima di scegliere S3

- Attiva il **versioning del bucket**: con l'archiviazione S3 i backup non contengono i file, ed è il versioning a recuperare un file cancellato o sovrascritto ([backup](/it/admin/backups/#quando-i-file-vivono-in-s3)).
- I telefoni scaricano i file direttamente dal bucket, tramite link firmati di breve durata. Se il server raggiunge il bucket a un indirizzo che i telefoni non possono raggiungere (dentro Compose, per esempio), imposta `KEPT_S3_PUBLIC_ENDPOINT` su quello che possono.
- Servi il bucket dal suo hostname, mai da quello di Kept.
