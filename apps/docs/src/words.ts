/**
 * The small interface words of the site's components, per language: the title's "Docs", the
 * landing page's eyebrow, facts and picture description, the gallery's buttons, the integrations
 * link, the Try pages' notes and the install page's picker. English and Arabic are as they have
 * always been; a language without an entry shows English (see i18n.ts). Terms follow the app's
 * own catalogue (apps/web/src/locales/<language>/messages.po).
 */
import type { PathGroup, PathId } from './components/install/paths';
import type { Words } from './i18n';

export const siteSub: Words<string> = {
  ar: 'التوثيق',
  de: 'Doku',
  en: 'Docs',
  es: 'Docs',
  fr: 'Docs',
  it: 'Guida',
  uk: 'Довідник',
  vi: 'Tài liệu',
};

export interface HeroWords {
  eyebrow: string;
  facts: [string, string, string];
  mapAlt: string;
}

export const hero: Words<HeroWords> = {
  ar: {
    eyebrow: 'جديد: الخريطة ثلاثية الأبعاد',
    facts: ['AGPL-3.0', 'Docker أو Kubernetes', 'تطبيق هاتف بلا اتصال'],
    mapAlt:
      'خريطة Kept ثلاثية الأبعاد لمنزل: غرفه في منظر مائل، لكلٍّ منها اسمها، بأثاثها وصناديقها، بجانب شجرة أماكن الموقع',
  },
  de: {
    eyebrow: 'Neu: die 3D-Karte',
    facts: ['AGPL-3.0', 'Docker oder Kubernetes', 'Handy-App, auch offline'],
    mapAlt:
      'Die 3D-Karte von Kept für ein Zuhause: die Räume in isometrischer Ansicht, jeweils benannt, mit Möbeln und Kisten, neben dem Ortsbaum des Standorts',
  },
  en: {
    eyebrow: 'New: the 3D map',
    facts: ['AGPL-3.0', 'Docker or Kubernetes', 'Offline phone app'],
    mapAlt:
      "Kept's 3D map of a home: its rooms in an isometric view, each labelled, with furniture and boxes, beside the location's tree of places",
  },
  es: {
    eyebrow: 'Novedad: el mapa 3D',
    facts: ['AGPL-3.0', 'Docker o Kubernetes', 'App móvil sin conexión'],
    mapAlt:
      'El mapa 3D de Kept de una casa: sus habitaciones en vista isométrica, cada una con su nombre, con muebles y cajas, junto al árbol de lugares de la ubicación',
  },
  fr: {
    eyebrow: 'Nouveau : la carte 3D',
    facts: ['AGPL-3.0', 'Docker ou Kubernetes', 'Appli mobile hors ligne'],
    mapAlt:
      'La carte 3D de Kept pour une maison : ses pièces en vue isométrique, chacune nommée, avec meubles et boîtes, à côté de l’arbre des emplacements du lieu',
  },
  it: {
    eyebrow: 'Novità: la mappa 3D',
    facts: ['AGPL-3.0', 'Docker o Kubernetes', 'App per il telefono, anche offline'],
    mapAlt:
      'La mappa 3D di Kept per una casa: le stanze in vista isometrica, ognuna con il suo nome, con mobili e scatole, accanto all’albero dei posti del luogo',
  },
  uk: {
    eyebrow: 'Новинка: 3D-карта',
    facts: ['AGPL-3.0', 'Docker або Kubernetes', 'Застосунок для телефона, працює офлайн'],
    mapAlt:
      '3D-карта Kept для дому: кімнати в ізометричному вигляді, кожна з назвою, з меблями й коробками, поруч із деревом місць локації',
  },
  vi: {
    eyebrow: 'Mới: bản đồ 3D',
    facts: ['AGPL-3.0', 'Docker hoặc Kubernetes', 'Ứng dụng điện thoại chạy ngoại tuyến'],
    mapAlt:
      'Bản đồ 3D của Kept cho một ngôi nhà: các phòng nhìn theo góc isometric, mỗi phòng có tên, cùng đồ nội thất và hộp, bên cạnh cây vị trí của địa điểm',
  },
};

export interface GalleryWords {
  previous: string;
  next: string;
  of: string;
  pause: string;
  play: string;
}

export const gallery: Words<GalleryWords> = {
  ar: {
    previous: 'الشاشة السابقة',
    next: 'الشاشة التالية',
    of: 'من',
    pause: 'إيقاف العرض',
    play: 'تشغيل العرض',
  },
  de: {
    previous: 'Vorheriger Bildschirm',
    next: 'Nächster Bildschirm',
    of: 'von',
    pause: 'Diashow anhalten',
    play: 'Diashow starten',
  },
  en: {
    previous: 'Previous screen',
    next: 'Next screen',
    of: 'of',
    pause: 'Pause the slideshow',
    play: 'Play the slideshow',
  },
  es: {
    previous: 'Pantalla anterior',
    next: 'Pantalla siguiente',
    of: 'de',
    pause: 'Pausar la presentación',
    play: 'Reproducir la presentación',
  },
  fr: {
    previous: 'Écran précédent',
    next: 'Écran suivant',
    of: 'sur',
    pause: 'Mettre le diaporama en pause',
    play: 'Lancer le diaporama',
  },
  it: {
    previous: 'Schermata precedente',
    next: 'Schermata successiva',
    of: 'di',
    pause: 'Metti in pausa la presentazione',
    play: 'Avvia la presentazione',
  },
  uk: {
    previous: 'Попередній екран',
    next: 'Наступний екран',
    of: 'з',
    pause: 'Призупинити слайдшоу',
    play: 'Запустити слайдшоу',
  },
  vi: {
    previous: 'Màn hình trước',
    next: 'Màn hình sau',
    of: 'trên',
    pause: 'Tạm dừng trình chiếu',
    play: 'Chạy trình chiếu',
  },
};

export interface IntegrationsWords {
  /** The link on each entry of the integrations page. */
  setUp: string;
  /** The link under the landing page's wall; `count` is the number, already formatted. */
  all: (count: string) => string;
}

export const integrations: Words<IntegrationsWords> = {
  ar: {
    setUp: 'طريقة الإعداد',
    all: (count) => `التكاملات كلها (${count})، وطريقة إعداد كلٍّ منها`,
  },
  de: {
    setUp: 'So richtest du es ein',
    all: (count) => `Alle ${count} Integrationen, und wie du jede einrichtest`,
  },
  en: {
    setUp: 'Set it up',
    all: (count) => `All ${count} integrations, and how to set each up`,
  },
  es: {
    setUp: 'Cómo configurarlo',
    all: (count) => `Las ${count} integraciones, y cómo configurar cada una`,
  },
  fr: {
    setUp: 'Comment le configurer',
    all: (count) => `Les ${count} intégrations, et comment configurer chacune`,
  },
  it: {
    setUp: 'Come configurarlo',
    all: (count) => `Tutte le ${count} integrazioni, e come configurare ciascuna`,
  },
  uk: {
    setUp: 'Як налаштувати',
    all: (count) => `Усі інтеграції (${count}) і як налаштувати кожну`,
  },
  vi: {
    setUp: 'Cách thiết lập',
    all: (count) => `Tất cả ${count} tích hợp và cách thiết lập từng cái`,
  },
};

export interface TryKeptWords {
  note: string;
  open: string;
  desktop: string;
  phone: string;
}

export const tryKept: Words<TryKeptWords> = {
  ar: {
    note: 'التطبيق كاملًا مع منزل تجريبي، في متصفحك. لا يُحفظ شيء ولا يُرسل.',
    open: 'افتح Kept',
    desktop:
      'الصفحة الرئيسية في Kept على حاسوب: بطاقات «يحتاجك» والمواقع بمعاينات خرائطها والاختصارات',
    phone: 'الصفحة الرئيسية في Kept على هاتف: بطاقات «يحتاجك» والاختصارات فوق شريط التبويب',
  },
  de: {
    note: 'Die ganze App mit einem Beispielhaushalt, in deinem Browser. Nichts wird gespeichert oder gesendet.',
    open: 'Kept öffnen',
    desktop:
      'Der Start von Kept am Computer: Erste Schritte, die Kacheln „Braucht dich“, die Standorte mit Kartenvorschau, Schnellzugriff und Einblicke',
    phone:
      'Der Start von Kept am Handy: die Kacheln „Braucht dich“ und der Schnellzugriff, über der Tab-Leiste',
  },
  en: {
    note: 'The whole app with a sample household, in your browser. Nothing is saved or sent.',
    open: 'Open Kept',
    desktop:
      "Kept's Home on a desktop: Get started, the Needs you tiles, the locations with their map previews, shortcuts and Insights",
    phone: "Kept's Home on a phone: the Needs you tiles and the shortcuts, above the tab bar",
  },
  es: {
    note: 'Toda la app con un hogar de ejemplo, en tu navegador. No se guarda ni se envía nada.',
    open: 'Abre Kept',
    desktop:
      'Inicio de Kept en un ordenador: Comenzar, las tarjetas Te necesita, las ubicaciones con la vista previa de su mapa, atajos y perspectivas',
    phone:
      'Inicio de Kept en un móvil: las tarjetas Te necesita y los atajos, sobre la barra de pestañas',
  },
  fr: {
    note: 'Toute l’application avec un foyer d’exemple, dans votre navigateur. Rien n’est enregistré ni envoyé.',
    open: 'Ouvrir Kept',
    desktop:
      'L’accueil de Kept sur ordinateur : Premiers pas, les tuiles À traiter, les lieux avec l’aperçu de leur carte, les raccourcis et les statistiques',
    phone:
      'L’accueil de Kept sur téléphone : les tuiles À traiter et les raccourcis, au-dessus de la barre d’onglets',
  },
  it: {
    note: 'Tutta l’app con una famiglia di esempio, nel tuo browser. Non viene salvato né inviato nulla.',
    open: 'Apri Kept',
    desktop:
      'La Home di Kept su computer: Per iniziare, le schede Tocca a te, i luoghi con l’anteprima della mappa, le scorciatoie e le statistiche',
    phone:
      'La Home di Kept su telefono: le schede Tocca a te e le scorciatoie, sopra la barra delle schede',
  },
  uk: {
    note: 'Увесь застосунок із прикладом домогосподарства, у вашому браузері. Нічого не зберігається й не надсилається.',
    open: 'Відкрити Kept',
    desktop:
      'Головна Kept на комп’ютері: «Почати роботу», плитки «Потребує вас», локації з попереднім переглядом карти, швидкі дії та аналітика',
    phone: 'Головна Kept на телефоні: плитки «Потребує вас» і швидкі дії над панеллю вкладок',
  },
  vi: {
    note: 'Toàn bộ ứng dụng với một hộ gia đình mẫu, ngay trong trình duyệt của bạn. Không có gì được lưu hay gửi đi.',
    open: 'Mở Kept',
    desktop:
      'Trang chủ của Kept trên máy tính: Bắt đầu, các ô Cần bạn, các địa điểm cùng bản xem trước bản đồ, lối tắt và thống kê',
    phone: 'Trang chủ của Kept trên điện thoại: các ô Cần bạn và lối tắt, phía trên thanh tab',
  },
};

export interface TryMapWords {
  note: string;
  reset: string;
  install: string;
  loading: string;
  failed: string;
  noscript: string;
  /** The text before and after the Poly Haven link. */
  credit: [string, string];
}

export const tryMap: Words<TryMapWords> = {
  ar: {
    note: 'منزل تجريبي في متصفحك. لا يُحفظ أي شيء تغيّره ولا يُرسل إلى أي مكان.',
    reset: 'إعادة تعيين',
    install: 'ثبّت Kept',
    loading: 'جارٍ تحميل الخريطة…',
    failed: 'تعذّر تحميل الخريطة. أعد تحميل الصفحة للمحاولة مجددًا.',
    noscript: 'تحتاج الخريطة إلى JavaScript.',
    credit: [
      'الأثاث والنباتات والأدوات ووحدات التكييف نماذج مجانية من ',
      ' ‏(CC0)، مُصغَّرة للهواتف. أوقف «نماذج مفصّلة» كي لا يُنزَّل أي منها.',
    ],
  },
  de: {
    note: 'Ein Beispielzuhause, in deinem Browser. Nichts, was du änderst, wird gespeichert oder irgendwohin gesendet.',
    reset: 'Zurücksetzen',
    install: 'Kept installieren',
    loading: 'Karte wird geladen…',
    failed: 'Die Karte konnte nicht geladen werden. Lade die Seite neu, um es erneut zu versuchen.',
    noscript: 'Die Karte braucht JavaScript.',
    credit: [
      'Möbel, Pflanzen, Werkzeuge und die Klimageräte sind kostenlose Modelle von ',
      ' (CC0), für Handys verkleinert. Schalte „Detaillierte Modelle“ aus, um keine herunterzuladen.',
    ],
  },
  en: {
    note: 'A sample home, in your browser. Nothing you change is saved or sent anywhere.',
    reset: 'Reset',
    install: 'Install Kept',
    loading: 'Loading the map…',
    failed: 'The map couldn’t load. Reload the page to try again.',
    noscript: 'The map needs JavaScript.',
    credit: [
      'Furniture, plants, tools and the AC units are free models from ',
      ' (CC0), shrunk for phones. Turn off Detailed models to download none.',
    ],
  },
  es: {
    note: 'Una casa de ejemplo, en tu navegador. Nada de lo que cambies se guarda ni se envía a ninguna parte.',
    reset: 'Restablecer',
    install: 'Instalar Kept',
    loading: 'Cargando el mapa…',
    failed: 'No se pudo cargar el mapa. Recarga la página para intentarlo de nuevo.',
    noscript: 'El mapa necesita JavaScript.',
    credit: [
      'Los muebles, las plantas, las herramientas y las unidades de aire acondicionado son modelos gratuitos de ',
      ' (CC0), reducidos para móviles. Desactiva «Modelos detallados» para no descargar ninguno.',
    ],
  },
  fr: {
    note: 'Une maison d’exemple, dans votre navigateur. Rien de ce que vous changez n’est enregistré ni envoyé.',
    reset: 'Réinitialiser',
    install: 'Installer Kept',
    loading: 'Chargement de la carte…',
    failed: 'La carte n’a pas pu se charger. Rechargez la page pour réessayer.',
    noscript: 'La carte nécessite JavaScript.',
    credit: [
      'Les meubles, les plantes, les outils et les unités de climatisation sont des modèles gratuits de ',
      ' (CC0), réduits pour les téléphones. Désactivez « Modèles détaillés » pour n’en télécharger aucun.',
    ],
  },
  it: {
    note: 'Una casa di esempio, nel tuo browser. Niente di ciò che modifichi viene salvato o inviato.',
    reset: 'Ripristina',
    install: 'Installa Kept',
    loading: 'Caricamento della mappa…',
    failed: 'Impossibile caricare la mappa. Ricarica la pagina per riprovare.',
    noscript: 'La mappa richiede JavaScript.',
    credit: [
      'Mobili, piante, attrezzi e le unità del climatizzatore sono modelli gratuiti di ',
      ' (CC0), ridotti per i telefoni. Disattiva «Modelli dettagliati» per non scaricarne nessuno.',
    ],
  },
  uk: {
    note: 'Приклад дому у вашому браузері. Нічого, що ви змінюєте, не зберігається й нікуди не надсилається.',
    reset: 'Скинути',
    install: 'Встановити Kept',
    loading: 'Завантаження карти…',
    failed: 'Не вдалося завантажити карту. Перезавантажте сторінку, щоб спробувати ще раз.',
    noscript: 'Для карти потрібен JavaScript.',
    credit: [
      'Меблі, рослини, інструменти й кондиціонери: безкоштовні моделі від ',
      ' (CC0), зменшені для телефонів. Вимкніть «Детальні моделі», щоб не завантажувати жодної.',
    ],
  },
  vi: {
    note: 'Một ngôi nhà mẫu, ngay trong trình duyệt của bạn. Mọi thay đổi của bạn không được lưu hay gửi đi đâu cả.',
    reset: 'Đặt lại',
    install: 'Cài đặt Kept',
    loading: 'Đang tải bản đồ…',
    failed: 'Không tải được bản đồ. Hãy tải lại trang để thử lại.',
    noscript: 'Bản đồ cần JavaScript.',
    credit: [
      'Đồ nội thất, cây cảnh, dụng cụ và dàn nóng điều hòa là các mô hình miễn phí từ ',
      ' (CC0), đã thu nhỏ cho điện thoại. Tắt “Mô hình chi tiết” để không tải mô hình nào.',
    ],
  },
};

export interface InstallWords {
  /** The picker's name, for screen readers. */
  picker: string;
  /** The picker's two groups. */
  groups: Record<PathGroup, string>;
  /** Each path's name (its chip and its section's heading) and a few words under the name. */
  paths: Record<PathId, { name: string; hint: string }>;
  /** The line before a path's requirements. */
  need: string;
  /** The label of the check after a step. */
  see: string;
}

export const install: Words<InstallWords> = {
  ar: {
    picker: 'كيف تشغّل Kept',
    groups: { terminal: 'في الطرفية', oneClick: 'بنقرة واحدة' },
    paths: {
      compose: { name: 'Docker Compose', hint: 'جهاز واحد' },
      kubernetes: { name: 'Kubernetes', hint: 'باستخدام Helm' },
      source: { name: 'من المصدر', hint: 'صورة تبنيها بنفسك' },
      'home-assistant': { name: 'Home Assistant', hint: 'كتطبيق' },
      unraid: { name: 'Unraid', hint: 'حاوية واحدة' },
    },
    need: 'ما تحتاجه',
    see: 'ستظهر لك',
  },
  de: {
    picker: 'Wie du Kept betreibst',
    groups: { terminal: 'Im Terminal', oneClick: 'Mit einem Klick' },
    paths: {
      compose: { name: 'Docker Compose', hint: 'Ein Rechner' },
      kubernetes: { name: 'Kubernetes', hint: 'Mit Helm' },
      source: { name: 'Aus dem Quellcode', hint: 'Dein eigenes Image' },
      'home-assistant': { name: 'Home Assistant', hint: 'Als App' },
      unraid: { name: 'Unraid', hint: 'Ein Container' },
    },
    need: 'Was du brauchst',
    see: 'Du solltest sehen',
  },
  en: {
    picker: 'How you run Kept',
    groups: { terminal: 'In a terminal', oneClick: 'One click' },
    paths: {
      compose: { name: 'Docker Compose', hint: 'One machine' },
      kubernetes: { name: 'Kubernetes', hint: 'With Helm' },
      source: { name: 'From source', hint: 'Your own image' },
      'home-assistant': { name: 'Home Assistant', hint: 'As an app' },
      unraid: { name: 'Unraid', hint: 'One container' },
    },
    need: 'What you need',
    see: 'You should see',
  },
  es: {
    picker: 'Cómo ejecutas Kept',
    groups: { terminal: 'En una terminal', oneClick: 'Con un clic' },
    paths: {
      compose: { name: 'Docker Compose', hint: 'Una máquina' },
      kubernetes: { name: 'Kubernetes', hint: 'Con Helm' },
      source: { name: 'Desde el código', hint: 'Tu propia imagen' },
      'home-assistant': { name: 'Home Assistant', hint: 'Como app' },
      unraid: { name: 'Unraid', hint: 'Un contenedor' },
    },
    need: 'Lo que necesitas',
    see: 'Deberías ver',
  },
  fr: {
    picker: 'Comment vous faites tourner Kept',
    groups: { terminal: 'Dans un terminal', oneClick: 'En un clic' },
    paths: {
      compose: { name: 'Docker Compose', hint: 'Une machine' },
      kubernetes: { name: 'Kubernetes', hint: 'Avec Helm' },
      source: { name: 'Depuis les sources', hint: 'Votre propre image' },
      'home-assistant': { name: 'Home Assistant', hint: 'Comme application' },
      unraid: { name: 'Unraid', hint: 'Un conteneur' },
    },
    need: 'Ce qu’il vous faut',
    see: 'Vous devriez voir',
  },
  it: {
    picker: 'Come esegui Kept',
    groups: { terminal: 'In un terminale', oneClick: 'Con un clic' },
    paths: {
      compose: { name: 'Docker Compose', hint: 'Una macchina' },
      kubernetes: { name: 'Kubernetes', hint: 'Con Helm' },
      source: { name: 'Dal codice sorgente', hint: 'La tua immagine' },
      'home-assistant': { name: 'Home Assistant', hint: 'Come app' },
      unraid: { name: 'Unraid', hint: 'Un container' },
    },
    need: 'Cosa ti serve',
    see: 'Dovresti vedere',
  },
  uk: {
    picker: 'Як ви запускаєте Kept',
    groups: { terminal: 'У терміналі', oneClick: 'Одним кліком' },
    paths: {
      compose: { name: 'Docker Compose', hint: 'Одна машина' },
      kubernetes: { name: 'Kubernetes', hint: 'З Helm' },
      source: { name: 'З вихідного коду', hint: 'Ваш власний образ' },
      'home-assistant': { name: 'Home Assistant', hint: 'Як додаток' },
      unraid: { name: 'Unraid', hint: 'Один контейнер' },
    },
    need: 'Що потрібно',
    see: 'Ви маєте побачити',
  },
  vi: {
    picker: 'Cách bạn chạy Kept',
    groups: { terminal: 'Trong terminal', oneClick: 'Một cú nhấp' },
    paths: {
      compose: { name: 'Docker Compose', hint: 'Một máy' },
      kubernetes: { name: 'Kubernetes', hint: 'Với Helm' },
      source: { name: 'Từ mã nguồn', hint: 'Image của riêng bạn' },
      'home-assistant': { name: 'Home Assistant', hint: 'Dưới dạng ứng dụng' },
      unraid: { name: 'Unraid', hint: 'Một container' },
    },
    need: 'Bạn cần',
    see: 'Bạn sẽ thấy',
  },
};
