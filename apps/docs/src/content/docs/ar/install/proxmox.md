---
title: التثبيت على Proxmox VE
description: أمر واحد في طرفية مضيف Proxmox VE ينشئ حاوية Debian 13 غير مميّزة فيها Kept، من دون Docker.
sidebar:
  order: 2
  label: Proxmox VE
---

:::caution[لم يُجرَّب بعد على مضيف Proxmox VE حقيقي]
يُفحص السكربتان مع كل تغيير: ‏shellcheck، ثم التثبيت وتحديث وتراجع على Debian ١٣ نظيف مع systemd،
وسكربت المضيف مقابل بدائل لأدوات Proxmox. لم يُشغَّلا بعد على مضيف Proxmox VE حقيقي. كُتبا لـ
‏Proxmox VE ‏٨ و٩ على amd64؛ مضيفات arm64 غير مجرَّبة. تعامل مع أول تثبيت كتجربة.
:::

يعمل Kept في حاوية Debian ١٣ غير مميّزة خاصة به، من دون Docker، كما تنصح Proxmox: ‏PostgreSQL
وNode وKept تحت systemd. تشمله النسخ الاحتياطية لـ Proxmox، ولا يتغيّر شيء آخر على المضيف.

## التثبيت

في طرفية مضيف Proxmox VE، بصلاحيات root:

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

- **‏Default:** لا يسأل إلا عن التأكيد، بالإعدادات أدناه.
- **‏Advanced:** يسأل عن كل إعداد: المعرّف، والاسم، والمعالج، والذاكرة، والقرص، والتخزين، والجسر،
  وعنوان ثابت مع بوابته، وVLAN، وDNS، ومفتاح SSH، وكلمة مرور root، والمنطقة الزمنية.
- **التأكيد** يعرض كل إعداد وأمر `pct create` الدقيق قبل إنشاء أي شيء.

يفحص المضيف أولًا (‏root، وProxmox VE ‏٨ أو ٩، والجسر، وتخزينًا فيه مساحة، وDNS)، وينزّل قالب
‏Debian ١٣ إن لم يكن موجودًا، وينشئ الحاوية، ويثبّت Kept فيها، ويطبع العنوان. إن فشل شيء، يقول ما
هو ويزيل الحاوية غير المكتملة.

### اقرأه أولًا

نزّل السكربت و`SHA256SUMS` الخاص بالإصدار، وتحقّق، واقرأ، ثم شغّله:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh
curl -fsSLO https://github.com/keptinventory/kept/releases/download/v1.14.7/SHA256SUMS
sha256sum -c --ignore-missing SHA256SUMS && bash kept.sh
```

يحوي `SHA256SUMS` قيمة SHA-256 لكل من `kept.sh` و`kept-install.sh` (ما يعمل داخل الحاوية) وأرشيفات
الإصدار. وهو موقّع بمفتاح الإصدارات: يتحقّق `kept.sh` و`kept-install.sh` من هذا التوقيع عبر openssl
قبل استخدام أي شيء من الإصدار. لتتحقّق منه بنفسك، نزّل `SHA256SUMS.sigstore.json` من الإصدار نفسه
وراجع [التحقق من الإصدار](/ar/admin/verify-release/):

```sh
cosign verify-blob --key cosign.pub --bundle SHA256SUMS.sigstore.json SHA256SUMS
```

## ما الذي ينشئه

- **الحاوية:** ‏Debian ١٣ غير مميّزة، و`nesting=1` (يحتاجه systemd في Debian ١٣)، تبدأ مع
  المضيف، وعليها الوسم `kept`.
- **بداخلها:** ‏PostgreSQL ١٨ مع pgvector (من مستودع PostgreSQL)، وNode ٢٤ (من nodejs.org)، وrestic،
  وأرشيف إصدار Kept، كلٌّ منها مثبّت الإصدار ومُتحقَّق منه.
- **الخدمات:** ‏`kept-bootstrap` (قاعدة البيانات وتسجيلات دخولها، عند كل تشغيل) و`kept` (الترحيلات،
  ثم Kept على المنفذ 8080 بالمستخدم `kept`).
- **الملفات:** ‏Kept في `/opt/kept`، وإعداداته في `/etc/kept/kept.env`، ومفاتيحه في
  `/etc/kept/config`، والصور والمستندات في `/var/lib/kept`، والعنوان ورمز الإعداد في
  `/root/kept.creds`.

لا قياس عن بعد، ولا مؤقّتات، ولا تحديثات تلقائية، ولا تغيير على المضيف سوى الحاوية.

## الإعدادات الافتراضية

| الإعداد | الافتراضي | يُضبط مسبقًا بـ |
|---|---|---|
| المعالج | نواتان | `var_cpu` |
| الذاكرة | ٢٠٤٨ ميغابايت، وswap ‏٥١٢ ميغابايت | `var_ram`، `var_swap` |
| القرص | ٨ غيغابايت | `var_disk` |
| التخزين | أول تخزين يقبل الحاويات | `var_storage` |
| الشبكة | ‏DHCP على `vmbr0` | `var_bridge`، `var_ip`، `var_gateway`، `var_vlan`، `var_dns` |
| المعرّف والاسم | المعرّف الحر التالي، و`kept` | `var_ctid`، `var_hostname` |
| المنطقة الزمنية | منطقة المضيف | `var_timezone` |
| مفتاح SSH | لا شيء | `var_ssh_key` (ملف مفتاح عام على المضيف) |

جُرّب Kept على ١ غيغابايت ([ما يحتاجه](/ar/install/hardware/))؛ و٢ غيغابايت تترك مجالًا للاستيراد
والنسخ الاحتياطي. تشغل الصور معظم القرص.

يمكن ضبط كل قيمة مسبقًا، و`var_unattended=yes` يشغّله دون أسئلة:

```sh
var_unattended=yes var_ram=4096 var_ip=192.168.1.50/24 var_gateway=192.168.1.1 \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

## التشغيل الأول

1. افتح العنوان الذي طبعه، `http://<address>:8080`. يعرض Kept **أدخل رمز الإعداد**.
2. الرمز داخل الحاوية: `pct exec <CTID> -- cat /root/kept.creds`. أدخله، ثم
   **أنشئ الحساب الأول**: يصبح مدير النسخة.
3. احفظ المفاتيح بعيدًا عن هذا الخادم: `pct exec <CTID> -- kept admin recovery-kit` يطبع مجموعة
   الاسترداد.

تحمل الملصقات المطبوعة العنوان. أعطِ الحاوية عنوانًا ثابتًا (حجز DHCP في الموجّه، أو `var_ip`) قبل
أن تطبع أيًّا منها. لتغييره لاحقًا، اضبط `KEPT_PUBLIC_URL` في `/etc/kept/kept.env`، ثم
`systemctl restart kept`. ‏HTTPS: [خلف وكيل عكسي](/ar/install/reverse-proxy/).

## التحديث

في طرفية الحاوية (`pct enter <CTID>`، أو **Console** الحاوية في واجهة الويب):

```sh
update
```

يذكر `update` الإصدار العامل والأحدث ويسأل أولًا. ويطبع أمر النسخ الاحتياطي لتشغيله على المضيف قبل
أن تجيب. ثم ينزّل الإصدار الجديد ويتحقّق منه مقابل `SHA256SUMS` الموقّع للإصدار، ويوقف Kept، وينتقل
إلى الإصدار الجديد بجانب القديم ويشغّله (تعمل الترحيلات أولًا). إن لم يجب Kept على `/readyz`
بالإصدار الجديد، يعود ويشغّل الإصدار السابق. ‏`update 1.15.0` يثبّت إصدارًا بعينه. الإصدارات الأقدم
تحتاج `KEPT_ALLOW_DOWNGRADE=1`، للاستعادة ([الرجوع إصدارًا واحدًا](/ar/admin/upgrades/)). لا شيء
يتحدّث من تلقاء نفسه.

تحديثات Debian نفسه هي `apt update && apt upgrade` داخل الحاوية، كما في أي Debian.

## النسخ الاحتياطي

كل شيء على قرص الحاوية، فنسخة Proxmox الاحتياطية تحوي Kept كاملًا: أضف الحاوية إلى مهمة نسخ احتياطي
(**Datacenter → Backup**) بوضع snapshot، أو مرة واحدة:

```sh
vzdump <CTID> --mode snapshot
```

يحتاج وضع snapshot إلى تخزين يدعم اللقطات (‏LVM-thin، ZFS، Ceph)؛ على غيره استخدم `--mode stop`.
استعدها عبر **Restore** في واجهة الويب، أو `pct restore`.

لنسخة ثانية خارج الجهاز، فعّل النسخ الاحتياطي الليلي الخاص بـ Kept
([النسخ الاحتياطي](/ar/admin/backups/)). يعمل بصفة مالك قاعدة البيانات، فأعطِ Kept تسجيل الدخول هذا
أولًا، داخل الحاوية:

```sh
install -m 0400 -o kept -g kept /etc/kept/owner/kept_owner /etc/kept/config/database/kept_owner
printf '%s\n' 'KEPT_OWNER_DATABASE_URL=postgres://kept_owner@127.0.0.1:5432/kept' \
  'KEPT_DB_OWNER_PASSWORD_FILE=/etc/kept/config/database/kept_owner' >>/etc/kept/kept.env
systemctl restart kept
```

تعمل وجهات S3 وSFTP كما هي. يجب أن يكون المجلد الوجهة قابلًا للكتابة من الخدمة: أضفه عبر
`systemctl edit kept` (‏`[Service]` ثم `ReadWritePaths=/your/backup/dir`)، ومالكه المستخدم `kept`.

## الإزالة

يحذف هذا الحاوية وكل ما فيها، ومنه بيانات Kept. خذ نسخة احتياطية أولًا إن كنت قد تحتاجها:

```sh
pct stop <CTID> && pct destroy <CTID> --purge
```

## شيء لا يعمل؟

- **توقّف التثبيت:** ذكر السكربت الخطوة وأزال الحاوية. شغّله مجددًا مع `var_keep_failed=yes` لتبقى
  الحاوية، ثم `pct enter <CTID>` و`journalctl -u kept`.
- **لا يبدأ Kept:** ‏`journalctl -u kept-bootstrap -u kept` داخل الحاوية يذكر المشكلة، مثل
  `kept: invalid environment:` لإعداد في `/etc/kept/kept.env`.
- **الطرفية سوداء:** يحتاج Debian ١٣ إلى `nesting=1`، ويضبطه السكربت؛ حاوية أُنشئت يدويًا من دونه
  تُظهر هذا.
