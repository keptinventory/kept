---
title: Prometheus and Grafana
description: "اجمع مقاييس Kept من /metrics باستخدام بروميثيوس، واعرضها بيانياً في غرافانا، واضبط تنبيهات بشأن النسخ الاحتياطية، القرص وإعادة التشغيل."
---

دليل إرشادي لمراقبة Kept باستخدام بروميثيوس وغرافانا. المقاييس نفسها، وفحوصات الصحة، والسجلات، والتتبع موجودة على [المراقبة](/ar/admin/observability/).

## ١. فعّل `/metrics`

أنشئ رمز دخول في محطة الأوامر:

```sh
openssl rand -hex 32
```

والصق القيمة في `.env` بجانب `compose.yaml`:

```sh
KEPT_METRICS_TOKEN=<the value>
```

يُقرأ `.env` كما هو، لذا يُؤخذ `$(openssl …)` الموجود فيه حرفياً. ثمطبّق التغيير:

```sh
docker compose up -d
```

تمرّر Compose المتغير إلى Kept. بدونه، لا يوجد `/metrics`. تحقق من استجابته:

```sh
curl -H "Authorization: Bearer <the value>" http://localhost:8080/metrics
```

في Kubernetes، ضع المتغير `KEPT_METRICS_TOKEN` في سرّ، وسمّه في الحقل `metrics.tokenSecret` في المخطط ([Kubernetes](/ar/install/kubernetes/)).

## ٢. اجمع المقاييس

احفظ الرمز في ملف يمكن لبروميثيوس قراءته، مثل `/etc/prometheus/kept-token`، وأضف مهمة:

```yaml
scrape_configs:
  - job_name: kept
    metrics_path: /metrics
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/kept-token
    static_configs:
      - targets: ['kept:8080']
```

`kept:8080` هي خدمة Kept على شبكة Compose؛ من مكان آخر، استخدم العنوان والمنفذ اللذين يصل من خلالهما بروميثيوس إلى Kept. أعد تحميل بروميثيوس: يجب أن تظهر صفحة الأهداف `kept` في حالة التشغيل.

## ٣. ما الذي يجب مراقبته

| المقياس | راقب |
|---|---|
| `kept_process_uptime_seconds` | يعود إلى رقم صغير عند إعادة تشغيل العملية |
| `kept_process_resident_memory_bytes` | نمو نحو حد ذاكرة الحاوية |
| `kept_db_pool_connections{state="waiting"}` | أعلى من ٠ لأكثر من دقيقة: طلبات تنتظر قاعدة البيانات |
| `kept_backup_last_success_timestamp_seconds` | أقدم من ٣٦ ساعة (٠ تعني عدم وجود نسخة احتياطية سليمة بعد) |
| `kept_backup_last_run_status{status="failed"}` | ١: فشلت النسخة الاحتياطية الأخيرة |
| `kept_disk_used_ratio{volume="data"}` | أعلى من ٠٫٨٥ |
| `kept_update_available` | ١: إصدار أحدث. تظل ٠ ما لم يكن فحص التحديث مفعّلاً ([التحديثات](/ar/admin/upgrades/)) |

تأتي أرقام النسخة الاحتياطية والقرص من فحص يُجرى كل ساعة، لذا قد يصل عمرها إلى ساعة.

## ٤. غرافانا

لوحة تحكم فيها لوحة لكل سطر:

- **عرض إحصائي**: `kept_build_info`, حسب التسمية `version`.
- **سلسلة زمنية**: `kept_process_uptime_seconds` و`kept_process_resident_memory_bytes`.
- **سلسلة زمنية**: `kept_db_pool_connections`, حسب `pool` و`state`.
- **عرض إحصائي**: `time() - kept_backup_last_success_timestamp_seconds`, عمر النسخة الاحتياطية بالثواني.
- **عرض إحصائي**: `kept_backup_last_run_status`, حسب `status`.
- **مقياس**: `kept_disk_used_ratio{volume="data"}`, من ٠ إلى ١.

## ٥. التنبيهات

```yaml
groups:
  - name: kept
    rules:
      - alert: KeptDown
        expr: up{job="kept"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: Kept is down

      - alert: KeptBackupStale
        expr: >-
          kept_backup_last_success_timestamp_seconds > 0
          and time() - kept_backup_last_success_timestamp_seconds > 36 * 3600
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Kept's last good backup is more than 36 hours old

      - alert: KeptBackupFailed
        expr: kept_backup_last_run_status{status="failed"} == 1
        labels:
          severity: critical
        annotations:
          summary: Kept's last backup failed

      - alert: KeptDiskFilling
        expr: kept_disk_used_ratio{volume="data"} > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Kept's data disk is over 85% full

      - alert: KeptUpdateAvailable
        expr: kept_update_available == 1
        for: 1h
        labels:
          severity: info
        annotations:
          summary: A new Kept release is available
```

٣٦ ساعة و٨٥٪ تتطابقان مع تنبيهات المسؤول في Kept ([مراقبة النسخ الاحتياطية](/ar/admin/backups/#المراقبة)). يُبقي `> 0` قاعدة النسخة الاحتياطية المتعثرة كتمت على Kept لم تنشئ نسخة احتياطية أولى بعد: المقياس هو ٠ حتى ذلك الحين.

## مواضيع ذات صلة

- [المراقبة](/ar/admin/observability/): فحوصات الصحة، المقاييس، السجلات، التتبع والإبلاغ عن الأخطاء.
- [النسخ الاحتياطية](/ar/admin/backups/) لتفعيل النسخ الاحتياطية.
- [استكشاف الأخطاء وإصلاحها](/ar/admin/troubleshooting/) عند إطلاق تنبيه.
