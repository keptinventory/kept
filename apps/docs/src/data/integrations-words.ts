/**
 * The integrations' words in the languages besides English and Arabic (those are in
 * integrations.ts beside the entries): each group's name, and per entry `[name, title, body]`,
 * with an empty title where the name says enough. Keyed by the group's and the entry's `id`.
 */
import type { OtherLang } from '../i18n';

export type Row = readonly [name: string, title: string, body: string];

export const groupNames: Record<string, Record<OtherLang, string>> = {
  'bring-in': {
    de: 'Gegenstände hereinholen',
    es: 'Traer objetos',
    fr: 'Faire entrer des objets',
    it: 'Portare dentro gli oggetti',
    uk: 'Додати речі',
    vi: 'Đưa đồ vật vào',
  },
  'get-told': {
    de: 'Informiert werden',
    es: 'Recibir avisos',
    fr: 'Être prévenu',
    it: 'Ricevere avvisi',
    uk: 'Сповіщення',
    vi: 'Nhận thông báo',
  },
  'sign-in': {
    de: 'Anmeldung',
    es: 'Inicio de sesión',
    fr: 'Connexion',
    it: 'Accesso',
    uk: 'Вхід',
    vi: 'Đăng nhập',
  },
  ai: {
    de: 'KI und Automatisierung',
    es: 'IA y automatización',
    fr: 'IA et automatisation',
    it: 'IA e automazione',
    uk: 'ШІ й автоматизація',
    vi: 'AI và tự động hóa',
  },
  'share-print': {
    de: 'Teilen und Drucken',
    es: 'Compartir e imprimir',
    fr: 'Partager et imprimer',
    it: 'Condividere e stampare',
    uk: 'Спільний доступ і друк',
    vi: 'Chia sẻ và in',
  },
};

export const itemRows: Record<string, Record<OtherLang, Row>> = {
  csv: {
    de: [
      'CSV',
      'Import aus einer Tabelle (CSV)',
      'Ein Gegenstand pro Zeile. Spalten zuordnen, prüfen, dann importieren.',
    ],
    es: [
      'CSV',
      'Importar desde una hoja de cálculo (CSV)',
      'Un objeto por fila. Asocia las columnas, revisa y luego importa.',
    ],
    fr: [
      'CSV',
      'Import d’un tableur (CSV)',
      'Un objet par ligne. Associez les colonnes, vérifiez, puis importez.',
    ],
    it: [
      'CSV',
      'Importazione da foglio di calcolo (CSV)',
      'Un oggetto per riga. Abbina le colonne, controlla, poi importa.',
    ],
    uk: [
      'CSV',
      'Імпорт із таблиці (CSV)',
      'Одна річ у рядку. Зіставте стовпці, перевірте, потім імпортуйте.',
    ],
    vi: [
      'CSV',
      'Nhập từ bảng tính (CSV)',
      'Mỗi dòng một đồ vật. Ghép các cột, kiểm tra, rồi nhập.',
    ],
  },
  homebox: {
    de: [
      'Homebox',
      'Import aus Homebox',
      'Sein Export als ZIP, samt Dateien. Alte Homebox-Etiketten lassen sich weiter scannen.',
    ],
    es: [
      'Homebox',
      'Importar desde Homebox',
      'Su exportación en ZIP, con los archivos incluidos. Las etiquetas antiguas de Homebox se siguen escaneando.',
    ],
    fr: [
      'Homebox',
      'Import depuis Homebox',
      'Son export ZIP, fichiers compris. Les anciennes étiquettes Homebox se scannent toujours.',
    ],
    it: [
      'Homebox',
      'Importazione da Homebox',
      'Il suo export ZIP, file inclusi. Le vecchie etichette Homebox si scansionano ancora.',
    ],
    uk: [
      'Homebox',
      'Імпорт із Homebox',
      'Його експорт у ZIP, разом із файлами. Старі етикетки Homebox і далі скануються.',
    ],
    vi: [
      'Homebox',
      'Nhập từ Homebox',
      'Tệp xuất ZIP của nó, kèm cả các tệp. Nhãn Homebox cũ vẫn quét được.',
    ],
  },
  lubelogger: {
    de: [
      'LubeLogger',
      'Import aus LubeLogger',
      'Tank-, Wartungs- und Kilometerverlauf eines Fahrzeugs. Jeweils eine CSV-Datei.',
    ],
    es: [
      'LubeLogger',
      'Importar desde LubeLogger',
      'El historial de combustible, mantenimiento y cuentakilómetros de un vehículo. Un CSV cada vez.',
    ],
    fr: [
      'LubeLogger',
      'Import depuis LubeLogger',
      'L’historique de carburant, d’entretien et de compteur d’un véhicule. Un CSV à la fois.',
    ],
    it: [
      'LubeLogger',
      'Importazione da LubeLogger',
      'Lo storico di carburante, manutenzione e contachilometri di un veicolo. Un CSV alla volta.',
    ],
    uk: [
      'LubeLogger',
      'Імпорт із LubeLogger',
      'Історія пального, обслуговування й одометра транспортного засобу. По одному CSV за раз.',
    ],
    vi: [
      'LubeLogger',
      'Nhập từ LubeLogger',
      'Lịch sử nhiên liệu, bảo dưỡng và đồng hồ công tơ mét của một phương tiện. Mỗi lần một tệp CSV.',
    ],
  },
  'kept-export': {
    de: [
      'Anderes Kept',
      'Import aus einem anderen Kept',
      'Ein Standort, aus einem Kept exportiert und in ein anderes importiert.',
    ],
    es: [
      'Otro Kept',
      'Importar desde otro Kept',
      'Una ubicación exportada de un Kept e importada en otro.',
    ],
    fr: [
      'Un autre Kept',
      'Import depuis un autre Kept',
      'Un lieu exporté d’un Kept, importé dans un autre.',
    ],
    it: [
      'Un altro Kept',
      'Importazione da un altro Kept',
      'Un luogo esportato da un Kept e importato in un altro.',
    ],
    uk: [
      'Інший Kept',
      'Імпорт з іншого Kept',
      'Локація, експортована з одного Kept і імпортована в інший.',
    ],
    vi: [
      'Một Kept khác',
      'Nhập từ một Kept khác',
      'Một địa điểm được xuất từ một Kept và nhập vào Kept khác.',
    ],
  },
  barcodes: {
    de: [
      'Barcodes',
      'Produktsuche per Barcode',
      'Benannt über Open Food Facts, Open Products Facts oder Open Beauty Facts. Aus, bis ein Admin es einschaltet.',
    ],
    es: [
      'Códigos de barras',
      'Búsqueda por código de barras del producto',
      'El nombre sale de Open Food Facts, Open Products Facts u Open Beauty Facts. Desactivado hasta que un administrador lo active.',
    ],
    fr: [
      'Codes-barres',
      'Recherche par code-barres produit',
      'Nommé d’après Open Food Facts, Open Products Facts ou Open Beauty Facts. Désactivé tant qu’un administrateur ne l’active pas.',
    ],
    it: [
      'Codici a barre',
      'Ricerca per codice a barre del prodotto',
      'Il nome arriva da Open Food Facts, Open Products Facts o Open Beauty Facts. Disattivato finché un amministratore non lo attiva.',
    ],
    uk: [
      'Штрихкоди',
      'Пошук за штрихкодом товару',
      'Назву дає Open Food Facts, Open Products Facts або Open Beauty Facts. Вимкнено, доки адміністратор не ввімкне.',
    ],
    vi: [
      'Mã vạch',
      'Tra cứu theo mã vạch sản phẩm',
      'Tên lấy từ Open Food Facts, Open Products Facts hoặc Open Beauty Facts. Tắt cho đến khi quản trị viên bật.',
    ],
  },
  camera: {
    de: [
      'Kamera',
      'Aufnahme mit der Kamera',
      'Ein Foto pro Gegenstand, direkt in einen Raum oder eine Kiste. Benennen kannst du später.',
    ],
    es: [
      'Cámara',
      'Captura con la cámara',
      'Una foto por objeto, directo a una habitación o caja. Ponle nombre después.',
    ],
    fr: [
      'Appareil photo',
      'Capture par l’appareil photo',
      'Une photo par objet, directement dans une pièce ou une boîte. Nommez-le plus tard.',
    ],
    it: [
      'Fotocamera',
      'Acquisizione con la fotocamera',
      'Una foto per oggetto, direttamente in una stanza o in una scatola. Dagli un nome dopo.',
    ],
    uk: [
      'Камера',
      'Знімання камерою',
      'Одне фото на річ, просто в кімнату чи коробку. Назвіть пізніше.',
    ],
    vi: [
      'Máy ảnh',
      'Chụp bằng máy ảnh',
      'Mỗi đồ vật một ảnh, thêm thẳng vào phòng hoặc hộp. Đặt tên sau.',
    ],
  },
  'email-in': {
    de: [
      'E-Mail-Eingang',
      'E-Mail-Eingang (IMAP)',
      'Ein Postfachordner, den du schon hast. Eingehende Belege werden zu Entwürfen.',
    ],
    es: [
      'Correo entrante',
      'Correo entrante (IMAP)',
      'Una carpeta del buzón que ya tienes. Los recibos que llegan se vuelven borradores.',
    ],
    fr: [
      'E-mail entrant',
      'E-mail entrant (IMAP)',
      'Un dossier de votre messagerie existante. Les reçus qui arrivent deviennent des brouillons.',
    ],
    it: [
      'Email in ingresso',
      'Email in ingresso (IMAP)',
      'Una cartella della tua casella già esistente. Le ricevute che arrivano diventano bozze.',
    ],
    uk: [
      'Вхідна пошта',
      'Вхідна пошта (IMAP)',
      'Тека поштової скриньки, яка в вас уже є. Чеки, що надходять, стають чернетками.',
    ],
    vi: [
      'Email đến',
      'Email đến (IMAP)',
      'Một thư mục hộp thư bạn đã có. Biên lai gửi đến sẽ thành bản nháp.',
    ],
  },
  paperless: {
    de: [
      'Paperless-ngx',
      'Paperless-ngx-Dokumente',
      'Verknüpfe einen Gegenstand mit seinen Belegen und Anleitungen in Paperless. Kopiere eines herein, wenn du es behalten willst.',
    ],
    es: [
      'Paperless-ngx',
      'Documentos de Paperless-ngx',
      'Vincula un objeto con sus recibos y manuales en Paperless. Copia uno cuando quieras conservarlo.',
    ],
    fr: [
      'Paperless-ngx',
      'Documents Paperless-ngx',
      'Reliez un objet à ses reçus et notices dans Paperless. Copiez-en un quand vous voulez le conserver.',
    ],
    it: [
      'Paperless-ngx',
      'Documenti Paperless-ngx',
      'Collega un oggetto alle sue ricevute e ai suoi manuali in Paperless. Copia un documento quando vuoi conservarlo.',
    ],
    uk: [
      'Paperless-ngx',
      'Документи Paperless-ngx',
      'Прив’яжіть річ до її чеків і посібників у Paperless. Скопіюйте документ, коли хочете його зберегти.',
    ],
    vi: [
      'Paperless-ngx',
      'Tài liệu Paperless-ngx',
      'Liên kết một đồ vật với biên lai và sách hướng dẫn của nó trong Paperless. Sao chép một tài liệu vào khi bạn muốn giữ lại.',
    ],
  },
  reading: {
    de: [
      'Belege lesen',
      'Belege und Etiketten, von KI gelesen',
      'Mit eingeschalteter KI: der Kauf, die Marke, das Modell und die Seriennummer. Du bestätigst sie.',
    ],
    es: [
      'Lectura de recibos',
      'Recibos y etiquetas leídos por IA',
      'Con la IA activada: la compra, la marca, el modelo y el número de serie. Tú los aceptas.',
    ],
    fr: [
      'Lecture des reçus',
      'Reçus et étiquettes lus par l’IA',
      'Avec l’IA activée : l’achat, la marque, le modèle et le numéro de série. Vous les acceptez.',
    ],
    it: [
      'Lettura delle ricevute',
      'Ricevute ed etichette lette dall’IA',
      'Con l’IA attiva: l’acquisto, la marca, il modello e il numero di serie. Li accetti tu.',
    ],
    uk: [
      'Читання чеків',
      'Чеки й етикетки, прочитані ШІ',
      'Коли ШІ увімкнено: покупка, марка, модель і серійний номер. Ви їх підтверджуєте.',
    ],
    vi: [
      'Đọc biên lai',
      'Biên lai và nhãn do AI đọc',
      'Khi bật AI: lần mua, thương hiệu, mẫu và số sê-ri. Bạn là người chấp nhận.',
    ],
  },
  email: {
    de: [
      'E-Mail',
      'E-Mail-Benachrichtigungen (SMTP)',
      'Erinnerungen und eine tägliche Zusammenfassung. Über deinen eigenen SMTP-Server.',
    ],
    es: [
      'Correo',
      'Avisos por correo (SMTP)',
      'Recordatorios y un resumen diario. Con tu propio servidor SMTP.',
    ],
    fr: [
      'E-mail',
      'Notifications par e-mail (SMTP)',
      'Des rappels et un récapitulatif quotidien. Via votre propre serveur SMTP.',
    ],
    it: [
      'Email',
      'Notifiche via email (SMTP)',
      'Promemoria e un riepilogo giornaliero. Tramite il tuo server SMTP.',
    ],
    uk: [
      'Email',
      'Сповіщення електронною поштою (SMTP)',
      'Нагадування та щоденне зведення. Через ваш власний SMTP-сервер.',
    ],
    vi: [
      'Email',
      'Thông báo qua email (SMTP)',
      'Lời nhắc và bản tin hàng ngày. Qua máy chủ SMTP của chính bạn.',
    ],
  },
  'web-push': {
    de: [
      'Web-Push',
      'Web-Push-Benachrichtigungen',
      'Auf dem Handy und am Computer. Keine Schlüssel einzurichten.',
    ],
    es: [
      'Web push',
      'Notificaciones web push',
      'En el móvil y en el ordenador. Sin claves que configurar.',
    ],
    fr: [
      'Web push',
      'Notifications web push',
      'Sur le téléphone et sur l’ordinateur. Aucune clé à configurer.',
    ],
    it: [
      'Web push',
      'Notifiche web push',
      'Sul telefono e sul computer. Nessuna chiave da configurare.',
    ],
    uk: [
      'Web push',
      'Web push-сповіщення',
      'На телефоні й на комп’ютері. Ключі налаштовувати не потрібно.',
    ],
    vi: [
      'Web push',
      'Thông báo web push',
      'Trên điện thoại và máy tính. Không cần thiết lập khóa.',
    ],
  },
  ntfy: {
    de: [
      'ntfy',
      'ntfy-Benachrichtigungen',
      'ntfy.sh oder dein eigener Server, zu einem Thema deiner Wahl.',
    ],
    es: ['ntfy', 'Notificaciones de ntfy', 'ntfy.sh o tu propio servidor, en el tema que elijas.'],
    fr: [
      'ntfy',
      'Notifications ntfy',
      'ntfy.sh ou votre propre serveur, sur un sujet de votre choix.',
    ],
    it: ['ntfy', 'Notifiche ntfy', 'ntfy.sh o il tuo server, su un argomento a tua scelta.'],
    uk: ['ntfy', 'Сповіщення ntfy', 'ntfy.sh або ваш власний сервер, на обрану вами тему.'],
    vi: ['ntfy', 'Thông báo ntfy', 'ntfy.sh hoặc máy chủ của riêng bạn, theo chủ đề bạn chọn.'],
  },
  telegram: {
    de: ['Telegram', 'Telegram-Benachrichtigungen', 'Dein eigener Bot, in deinen Chat.'],
    es: ['Telegram', 'Notificaciones de Telegram', 'Tu propio bot, a tu chat.'],
    fr: ['Telegram', 'Notifications Telegram', 'Votre propre bot, vers votre conversation.'],
    it: ['Telegram', 'Notifiche Telegram', 'Un tuo bot, nella tua chat.'],
    uk: ['Telegram', 'Сповіщення в Telegram', 'Ваш власний бот, у ваш чат.'],
    vi: [
      'Telegram',
      'Thông báo qua Telegram',
      'Bot của riêng bạn, gửi vào cuộc trò chuyện của bạn.',
    ],
  },
  apprise: {
    de: [
      'Apprise',
      'Apprise: Discord, Slack, Matrix, Signal',
      'Discord, Slack, Matrix, Signal und mehr. Über einen Apprise-Server, den du selbst betreibst.',
    ],
    es: [
      'Apprise',
      'Apprise: Discord, Slack, Matrix, Signal',
      'Discord, Slack, Matrix, Signal y más. Con un servidor Apprise que tú mismo ejecutas.',
    ],
    fr: [
      'Apprise',
      'Apprise : Discord, Slack, Matrix, Signal',
      'Discord, Slack, Matrix, Signal et bien d’autres. Via un serveur Apprise que vous hébergez.',
    ],
    it: [
      'Apprise',
      'Apprise: Discord, Slack, Matrix, Signal',
      'Discord, Slack, Matrix, Signal e altri. Tramite un server Apprise che gestisci tu.',
    ],
    uk: [
      'Apprise',
      'Apprise: Discord, Slack, Matrix, Signal',
      'Discord, Slack, Matrix, Signal та інші. Через сервер Apprise, який ви запускаєте самі.',
    ],
    vi: [
      'Apprise',
      'Apprise: Discord, Slack, Matrix, Signal',
      'Discord, Slack, Matrix, Signal và nhiều nữa. Qua máy chủ Apprise do bạn tự chạy.',
    ],
  },
  calendar: {
    de: [
      'Kalender-Feed',
      'Kalender-Feed (iCal)',
      'Ein privater iCal-Link. Was fällig ist, was zur Neige geht.',
    ],
    es: [
      'Calendario',
      'Calendario (iCal)',
      'Un enlace iCal privado. Lo que vence, lo que se agota.',
    ],
    fr: [
      'Flux de calendrier',
      'Flux de calendrier (iCal)',
      'Un lien iCal privé. Ce qui arrive à échéance, ce qui va manquer.',
    ],
    it: [
      'Feed del calendario',
      'Feed del calendario (iCal)',
      'Un link iCal privato. Cosa è in scadenza, cosa sta finendo.',
    ],
    uk: [
      'Стрічка календаря',
      'Стрічка календаря (iCal)',
      'Приватне посилання iCal. Що настає, що закінчується.',
    ],
    vi: [
      'Nguồn lịch',
      'Nguồn lịch (iCal)',
      'Một liên kết iCal riêng tư. Việc đến hạn, thứ sắp hết.',
    ],
  },
  passkeys: {
    de: ['Passkeys', '', 'Das Handy oder der Laptop, den du ohnehin entsperrst.'],
    es: ['Passkeys', '', 'El móvil o el portátil que ya desbloqueas.'],
    fr: ['Clés d’accès', '', 'Le téléphone ou l’ordinateur que vous déverrouillez déjà.'],
    it: ['Passkey', '', 'Il telefono o il portatile che sblocchi già.'],
    uk: ['Ключі доступу', '', 'Телефон або ноутбук, який ви й так розблоковуєте.'],
    vi: ['Khóa truy cập', '', 'Điện thoại hoặc laptop mà bạn vốn đã mở khóa.'],
  },
  'two-factor': {
    de: [
      'Zwei-Faktor',
      'Zwei-Faktor-Authentifizierung',
      'Eine Authenticator-App oder ein Passkey. Ein Standort kann sie verlangen.',
    ],
    es: [
      'Doble factor',
      'Autenticación de doble factor',
      'Una app de autenticación o una passkey. Una ubicación puede exigirla.',
    ],
    fr: [
      'Double facteur',
      'Authentification à deux facteurs',
      'Une application d’authentification ou une clé d’accès. Un lieu peut l’exiger.',
    ],
    it: [
      'Due fattori',
      'Autenticazione a due fattori',
      'Un’app di autenticazione o una passkey. Un luogo può richiederla.',
    ],
    uk: [
      'Двофакторна',
      'Двофакторна автентифікація',
      'Застосунок-автентифікатор або ключ доступу. Локація може вимагати її.',
    ],
    vi: [
      'Hai yếu tố',
      'Xác thực hai yếu tố',
      'Một ứng dụng xác thực hoặc khóa truy cập. Một địa điểm có thể bắt buộc.',
    ],
  },
  oidc: {
    de: [
      'OIDC',
      'OIDC-Single-Sign-on',
      'Dein eigener Identitätsanbieter. Neue Leute brauchen weiterhin eine Einladung oder eine erlaubte Domain.',
    ],
    es: [
      'OIDC',
      'Inicio de sesión único con OIDC',
      'Tu propio proveedor de identidad. Las personas nuevas siguen necesitando una invitación o un dominio permitido.',
    ],
    fr: [
      'OIDC',
      'Authentification unique OIDC',
      'Votre propre fournisseur d’identité. Les nouveaux venus ont toujours besoin d’une invitation ou d’un domaine autorisé.',
    ],
    it: [
      'OIDC',
      'Accesso singolo OIDC',
      'Il tuo provider di identità. Le nuove persone hanno comunque bisogno di un invito o di un dominio consentito.',
    ],
    uk: [
      'OIDC',
      'Єдиний вхід OIDC',
      'Ваш власний постачальник ідентифікації. Нові люди все одно потребують запрошення або дозволеного домену.',
    ],
    vi: [
      'OIDC',
      'Đăng nhập một lần OIDC',
      'Nhà cung cấp danh tính của riêng bạn. Người mới vẫn cần lời mời hoặc một tên miền được cho phép.',
    ],
  },
  google: {
    de: [
      'Google',
      'Mit Google anmelden',
      'Für eingeladene Personen und Konten, die es verknüpft haben. Nie offene Registrierung.',
    ],
    es: [
      'Google',
      'Iniciar sesión con Google',
      'Para personas invitadas y cuentas que lo vincularon. Nunca registro abierto.',
    ],
    fr: [
      'Google',
      'Se connecter avec Google',
      'Pour les personnes invitées et les comptes qui l’ont lié. Jamais d’inscription libre.',
    ],
    it: [
      'Google',
      'Accedi con Google',
      'Per le persone invitate e gli account che lo hanno collegato. Mai registrazione aperta.',
    ],
    uk: [
      'Google',
      'Вхід через Google',
      'Для запрошених людей і облікових записів, які його підключили. Ніколи не відкрита реєстрація.',
    ],
    vi: [
      'Google',
      'Đăng nhập bằng Google',
      'Dành cho người được mời và tài khoản đã liên kết. Không bao giờ mở đăng ký.',
    ],
  },
  providers: {
    de: [
      'KI-Anbieter',
      'KI-Anbieter: OpenAI, Anthropic, Google, Groq, OpenRouter',
      'Oder jeder OpenAI-kompatible Server. Dein Schlüssel, oder keiner.',
    ],
    es: [
      'Proveedores de IA',
      'Proveedores de IA: OpenAI, Anthropic, Google, Groq, OpenRouter',
      'O cualquier servidor compatible con OpenAI. Tu clave, o ninguna.',
    ],
    fr: [
      'Fournisseurs d’IA',
      'Fournisseurs d’IA : OpenAI, Anthropic, Google, Groq, OpenRouter',
      'Ou tout serveur compatible OpenAI. Votre clé, ou aucune.',
    ],
    it: [
      'Provider IA',
      'Provider IA: OpenAI, Anthropic, Google, Groq, OpenRouter',
      'Oppure qualsiasi server compatibile con OpenAI. La tua chiave, o nessuna.',
    ],
    uk: [
      'Постачальники ШІ',
      'Постачальники ШІ: OpenAI, Anthropic, Google, Groq, OpenRouter',
      'Або будь-який сервер, сумісний з OpenAI. Ваш ключ або жодного.',
    ],
    vi: [
      'Nhà cung cấp AI',
      'Nhà cung cấp AI: OpenAI, Anthropic, Google, Groq, OpenRouter',
      'Hoặc bất kỳ máy chủ nào tương thích OpenAI. Khóa của bạn, hoặc không cần.',
    ],
  },
  ollama: {
    de: [
      'Ollama',
      'Ollama (lokale KI)',
      'Ein lokales Modell auf deinem eigenen Rechner. Das Profil ollama in compose.full.yaml.',
    ],
    es: [
      'Ollama',
      'Ollama (IA local)',
      'Un modelo local en tu propia máquina. El perfil ollama en compose.full.yaml.',
    ],
    fr: [
      'Ollama',
      'Ollama (IA locale)',
      'Un modèle local sur votre propre machine. Le profil ollama dans compose.full.yaml.',
    ],
    it: [
      'Ollama',
      'Ollama (IA locale)',
      'Un modello locale sulla tua macchina. Il profilo ollama in compose.full.yaml.',
    ],
    uk: [
      'Ollama',
      'Ollama (локальний ШІ)',
      'Локальна модель на вашому комп’ютері. Профіль ollama у compose.full.yaml.',
    ],
    vi: [
      'Ollama',
      'Ollama (AI cục bộ)',
      'Một mô hình chạy cục bộ trên máy của bạn. Profile ollama trong compose.full.yaml.',
    ],
  },
  assistant: {
    de: [
      'Assistent',
      'KI-Assistent',
      'Frag, wo etwas ist. Antworten nennen die Gegenstände; Änderungen warten auf dich.',
    ],
    es: [
      'Asistente',
      'Asistente de IA',
      'Pregunta dónde está algo. Las respuestas citan los objetos; los cambios esperan tu visto bueno.',
    ],
    fr: [
      'Assistant',
      'Assistant IA',
      'Demandez où se trouve quelque chose. Les réponses citent les objets ; les modifications attendent votre accord.',
    ],
    it: [
      'Assistente',
      'Assistente IA',
      'Chiedi dove si trova qualcosa. Le risposte citano gli oggetti; le modifiche aspettano te.',
    ],
    uk: [
      'Помічник',
      'Помічник ШІ',
      'Запитайте, де щось лежить. Відповіді посилаються на речі; зміни чекають на вас.',
    ],
    vi: [
      'Trợ lý',
      'Trợ lý AI',
      'Hỏi một thứ đang ở đâu. Câu trả lời nêu rõ các đồ vật; mọi thay đổi chờ bạn duyệt.',
    ],
  },
  mcp: {
    de: [
      'MCP-Server',
      '',
      'Claude und andere KI-Apps. Ein persönliches Token oder OAuth, beschränkt auf die Standorte, die du wählst.',
    ],
    es: [
      'Servidor MCP',
      '',
      'Claude y otras apps de IA. Un token personal u OAuth, limitado a las ubicaciones que elijas.',
    ],
    fr: [
      'Serveur MCP',
      '',
      'Claude et d’autres applications d’IA. Un jeton personnel ou OAuth, limité aux lieux que vous choisissez.',
    ],
    it: [
      'Server MCP',
      '',
      'Claude e altre app di IA. Un token personale o OAuth, limitato ai luoghi che scegli.',
    ],
    uk: [
      'Сервер MCP',
      '',
      'Claude та інші застосунки ШІ. Особистий токен або OAuth, обмежений локаціями, які ви оберете.',
    ],
    vi: [
      'Máy chủ MCP',
      '',
      'Claude và các ứng dụng AI khác. Token cá nhân hoặc OAuth, giới hạn trong các địa điểm bạn chọn.',
    ],
  },
  api: {
    de: ['HTTP-API', 'HTTP-API (OpenAPI)', 'Mit OpenAPI dokumentiert. Für deine eigenen Skripte.'],
    es: ['API HTTP', 'API HTTP (OpenAPI)', 'Documentada con OpenAPI. Para tus propios scripts.'],
    fr: ['API HTTP', 'API HTTP (OpenAPI)', 'Documentée avec OpenAPI. Pour vos propres scripts.'],
    it: ['API HTTP', 'API HTTP (OpenAPI)', 'Documentata con OpenAPI. Per i tuoi script.'],
    uk: ['HTTP API', 'HTTP API (OpenAPI)', 'Описаний в OpenAPI. Для ваших власних скриптів.'],
    vi: [
      'HTTP API',
      'HTTP API (OpenAPI)',
      'Được mô tả bằng OpenAPI. Dành cho script của riêng bạn.',
    ],
  },
  'home-assistant-app': {
    de: [
      'Home-Assistant-App',
      '',
      'Wird aus dem App-Store von Home Assistant installiert. In der Seitenleiste, in den Backups von Home Assistant.',
    ],
    es: [
      'App de Home Assistant',
      '',
      'Se instala desde la tienda de apps de Home Assistant. En la barra lateral y en las copias de seguridad de Home Assistant.',
    ],
    fr: [
      'App Home Assistant',
      '',
      'S’installe depuis la boutique d’apps de Home Assistant. Dans la barre latérale, dans les sauvegardes de Home Assistant.',
    ],
    it: [
      'App Home Assistant',
      '',
      'Si installa dallo store delle app di Home Assistant. Nella barra laterale, nei backup di Home Assistant.',
    ],
    uk: [
      'Застосунок Home Assistant',
      '',
      'Встановлюється з магазину застосунків Home Assistant. На бічній панелі, у резервних копіях Home Assistant.',
    ],
    vi: [
      'Ứng dụng Home Assistant',
      '',
      'Cài từ kho ứng dụng của Home Assistant. Nằm ở thanh bên, có trong bản sao lưu của Home Assistant.',
    ],
  },
  'home-assistant': {
    de: [
      'Home Assistant',
      'Home-Assistant-Integration',
      'Überfällig, fällig und ablaufend je Standort, die nächste Wartung jedes Fahrzeugs. Kilometerstände werden zurückgesendet.',
    ],
    es: [
      'Home Assistant',
      'Integración con Home Assistant',
      'Vencido, por vencer y a punto de caducar por ubicación, el próximo mantenimiento de cada vehículo. Las lecturas del cuentakilómetros se devuelven.',
    ],
    fr: [
      'Home Assistant',
      'Intégration Home Assistant',
      'En retard, à venir et sur le point d’expirer par lieu, le prochain entretien de chaque véhicule. Les relevés de compteur sont renvoyés.',
    ],
    it: [
      'Home Assistant',
      'Integrazione con Home Assistant',
      'In ritardo, da fare e in scadenza per ogni luogo, il prossimo tagliando di ogni veicolo. Le letture del contachilometri vengono rimandate indietro.',
    ],
    uk: [
      'Home Assistant',
      'Інтеграція з Home Assistant',
      'Прострочене, актуальне й те, що спливає, за локаціями; наступне обслуговування кожного транспортного засобу. Показання одометра надсилаються назад.',
    ],
    vi: [
      'Home Assistant',
      'Tích hợp Home Assistant',
      'Quá hạn, đến hạn và sắp hết hạn theo từng địa điểm, lần bảo dưỡng tiếp theo của mỗi phương tiện. Số đọc công tơ mét được gửi ngược lại.',
    ],
  },
  dashboards: {
    de: [
      'Dashboards',
      'Dashboards: Homepage, Glance, Homarr',
      'Was dich braucht, als Widget. Ein Aufruf, ein schreibgeschütztes Token.',
    ],
    es: [
      'Paneles',
      'Paneles: Homepage, Glance, Homarr',
      'Lo que te necesita, como widget. Una sola llamada, un token de solo lectura.',
    ],
    fr: [
      'Tableaux de bord',
      'Tableaux de bord : Homepage, Glance, Homarr',
      'Ce qui a besoin de vous, en widget. Un seul appel, un jeton en lecture seule.',
    ],
    it: [
      'Dashboard',
      'Dashboard: Homepage, Glance, Homarr',
      'Cosa ha bisogno di te, come widget. Una sola chiamata, un token di sola lettura.',
    ],
    uk: [
      'Дашборди',
      'Дашборди: Homepage, Glance, Homarr',
      'Те, що потребує вас, у вигляді віджета. Один виклик, токен лише для читання.',
    ],
    vi: [
      'Dashboard',
      'Dashboard: Homepage, Glance, Homarr',
      'Những việc cần bạn, dưới dạng widget. Một lần gọi, một token chỉ đọc.',
    ],
  },
  webhooks: {
    de: [
      'Webhooks',
      '',
      'Signierte POSTs an deine eigenen Skripte. Erinnerungen und Änderungen an einem Standort.',
    ],
    es: [
      'Webhooks',
      '',
      'POST firmados a tus propios scripts. Recordatorios y cambios en una ubicación.',
    ],
    fr: [
      'Webhooks',
      '',
      'Des POST signés vers vos propres scripts. Les rappels et les changements dans un lieu.',
    ],
    it: [
      'Webhook',
      '',
      'POST firmati verso i tuoi script. I promemoria e le modifiche in un luogo.',
    ],
    uk: ['Вебхуки', '', 'Підписані POST-запити до ваших скриптів. Нагадування та зміни в локації.'],
    vi: [
      'Webhook',
      '',
      'Các POST có chữ ký gửi đến script của riêng bạn. Lời nhắc và thay đổi trong một địa điểm.',
    ],
  },
  labels: {
    de: [
      'QR-Etiketten',
      'Etiketten und QR-Codes',
      'A4-Bögen, Letter (Avery-5160-Layout), Rollen für Etikettendrucker, Band für Beschriftungsgeräte.',
    ],
    es: [
      'Etiquetas QR',
      'Etiquetas y códigos QR',
      'Hojas A4, Letter (formato Avery 5160), rollos de impresora de etiquetas, cinta de rotuladora.',
    ],
    fr: [
      'Étiquettes QR',
      'Étiquettes et codes QR',
      'Feuilles A4, Letter (format Avery 5160), rouleaux d’imprimante d’étiquettes, ruban d’étiqueteuse.',
    ],
    it: [
      'Etichette QR',
      'Etichette e codici QR',
      'Fogli A4, Letter (formato Avery 5160), rotoli per stampanti di etichette, nastro per etichettatrici.',
    ],
    uk: [
      'QR-етикетки',
      'Етикетки та QR-коди',
      'Аркуші A4, Letter (розкладка Avery 5160), рулони для принтера етикеток, стрічка для етикетувальника.',
    ],
    vi: [
      'Nhãn QR',
      'Nhãn và mã QR',
      'Tờ A4, Letter (bố cục Avery 5160), cuộn cho máy in nhãn, băng cho máy dán nhãn.',
    ],
  },
  'share-links': {
    de: [
      'Geteilte Links',
      'Geteilte Links, nur lesbar',
      'Eine Kiste, ein Raum oder eine Suche. Für jemanden ohne Konto.',
    ],
    es: [
      'Enlaces compartidos',
      'Enlaces compartidos de solo lectura',
      'Una caja, una habitación o una búsqueda. Para quien no tiene cuenta.',
    ],
    fr: [
      'Liens de partage',
      'Liens de partage en lecture seule',
      'Une boîte, une pièce ou une recherche. Pour quelqu’un sans compte.',
    ],
    it: [
      'Link condivisi',
      'Link condivisi di sola lettura',
      'Una scatola, una stanza o una ricerca. Per chi non ha un account.',
    ],
    uk: [
      'Посилання для спільного доступу',
      'Посилання для спільного доступу лише для читання',
      'Коробка, кімната або пошук. Для тих, хто не має облікового запису.',
    ],
    vi: [
      'Liên kết chia sẻ',
      'Liên kết chia sẻ chỉ đọc',
      'Một hộp, một phòng hoặc một lần tìm kiếm. Dành cho người không có tài khoản.',
    ],
  },
  reports: {
    de: [
      'PDF-Berichte',
      'Inventar- und Versicherungsberichte (PDF)',
      'Per E-Mail, sobald sie fertig sind. Das Inventar auch wöchentlich oder monatlich.',
    ],
    es: [
      'Reportes en PDF',
      'Reportes de inventario y de seguro (PDF)',
      'Se envían por correo cuando están listos. El de inventario también cada semana o cada mes.',
    ],
    fr: [
      'Rapports PDF',
      'Rapports d’inventaire et d’assurance (PDF)',
      'Envoyés par e-mail une fois prêts. L’inventaire aussi, chaque semaine ou chaque mois.',
    ],
    it: [
      'Report PDF',
      'Report di inventario e assicurativi (PDF)',
      'Inviati via email quando sono pronti. L’inventario anche ogni settimana o ogni mese.',
    ],
    uk: [
      'PDF-звіти',
      'Звіти інвентаризації та для страхування (PDF)',
      'Надсилаються електронною поштою, коли готові. Інвентар також щотижня чи щомісяця.',
    ],
    vi: [
      'Báo cáo PDF',
      'Báo cáo kiểm kê và bảo hiểm (PDF)',
      'Gửi qua email khi sẵn sàng. Báo cáo kiểm kê cũng có thể gửi hàng tuần hoặc hàng tháng.',
    ],
  },
  'claim-pack': {
    de: [
      'Schadenspaket',
      'Schadenspaket für die Versicherung',
      'Eine ZIP-Datei für die Versicherung: der Bericht, Belege, Fotos, Seriennummern.',
    ],
    es: [
      'Paquete de reclamación',
      'Paquete de reclamación al seguro',
      'Un ZIP para la aseguradora: el reporte, los recibos, las fotos, los números de serie.',
    ],
    fr: [
      'Dossier de sinistre',
      'Dossier de déclaration de sinistre',
      'Un seul ZIP pour l’assureur : le rapport, les reçus, les photos, les numéros de série.',
    ],
    it: [
      'Pacchetto sinistro',
      'Pacchetto per la richiesta di indennizzo',
      'Un unico ZIP per l’assicuratore: il report, le ricevute, le foto, i numeri di serie.',
    ],
    uk: [
      'Пакет для страхової вимоги',
      'Пакет документів для страхової вимоги',
      'Один ZIP для страховика: звіт, чеки, фото, серійні номери.',
    ],
    vi: [
      'Hồ sơ bồi thường',
      'Hồ sơ yêu cầu bồi thường bảo hiểm',
      'Một tệp ZIP cho hãng bảo hiểm: báo cáo, biên lai, ảnh, số sê-ri.',
    ],
  },
  export: {
    de: [
      'Export',
      'Einen Standort exportieren',
      'Ein ganzer Standort als ZIP. Mit einer Kopie, die du ohne Kept lesen kannst.',
    ],
    es: [
      'Exportación',
      'Exportar una ubicación',
      'Una ubicación entera en un ZIP. Con una copia que puedes leer sin Kept.',
    ],
    fr: ['Export', 'Exporter un lieu', 'Un lieu entier en ZIP. Avec une copie lisible sans Kept.'],
    it: [
      'Esportazione',
      'Esportare un luogo',
      'Un intero luogo in un file ZIP. Con una copia leggibile senza Kept.',
    ],
    uk: ['Експорт', 'Експорт локації', 'Уся локація в ZIP. З копією, яку можна читати без Kept.'],
    vi: [
      'Xuất',
      'Xuất một địa điểm',
      'Cả một địa điểm trong tệp ZIP. Kèm một bản sao đọc được mà không cần Kept.',
    ],
  },
};
