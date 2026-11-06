import type { ProviderKind } from '@kept/shared';
import {
  type Message,
  type MessageContext,
  type Of,
  page,
  type TransparencyTable,
} from './message-kit.js';
import type { MailLocale } from './messages.js';

// D180's configuration notices (D204), in every language Kept mails in: every
// active user hears when the instance's OIDC sign-in, its outgoing mail (host and sender) or its
// default AI provider changes. Sent by the `transparency-notice` job (notices/transparency.ts),
// once per change. They name the new setting and nothing secret: never a client secret, a key or
// a mail password.

type Words = {
  oidcOn: { subject: (name: string) => string; body: (name: string) => string };
  oidcOff: { subject: string; body: string };
  oidcFootnote: string;
  smtp: { subject: (sender: string) => string; body: (sender: string) => string; footnote: string };
  ai: {
    subject: (provider: string) => string;
    body: (provider: string) => string;
    action: string;
    footnote: string;
  };
  providers: Record<ProviderKind, string>;
};

const NAMES = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  openrouter: 'OpenRouter',
  groq: 'Groq',
} as const;

const WORDS: Record<MailLocale, Words> = {
  en: {
    oidcOn: {
      subject: (name) => `Sign-in with ${name} changed on Kept`,
      body: (name) =>
        `The person who runs this Kept changed sign-in with ${name}. Your password, passkeys and email links work as before.`,
    },
    oidcOff: {
      subject: 'Sign-in with an outside account is off on Kept',
      body: 'The person who runs this Kept turned off sign-in with an outside account. Sign in with your password, a passkey or an email link.',
    },
    oidcFootnote:
      'Everyone with an account here is told when sign-in changes. If you didn’t expect it, ask the person who runs this Kept.',
    smtp: {
      subject: (sender) => `Kept now sends mail from ${sender}`,
      body: (sender) =>
        `The person who runs this Kept changed how it sends mail. Its mail now comes from ${sender}, as this message did.`,
      footnote:
        'Everyone with an account here is told when this changes. If a message that says it is from Kept comes from another address, don’t follow its links.',
    },
    ai: {
      subject: (provider) => `Kept’s default AI provider is now ${provider}`,
      body: (provider) =>
        `The person who runs this Kept changed its default AI provider to ${provider}. Where your locations use this Kept’s AI, what you send to the AI (photos, receipts and questions) now goes to ${provider}.`,
      action: 'Open AI settings',
      footnote:
        'AI settings show which provider each of your locations uses, and let an owner choose another.',
    },
    providers: { ...NAMES, openai_compatible: 'an OpenAI-compatible server' },
  },
  ar: {
    oidcOn: {
      subject: (name) => `تغيّر تسجيل الدخول عبر ${name} في Kept`,
      body: (name) =>
        `غيّر مسؤول هذا الـ Kept تسجيل الدخول عبر ${name}. كلمة المرور ومفاتيح المرور وروابط البريد تعمل كما كانت.`,
    },
    oidcOff: {
      subject: 'أُوقف تسجيل الدخول بحساب خارجي في Kept',
      body: 'أوقف مسؤول هذا الـ Kept تسجيل الدخول بحساب خارجي. سجّل الدخول بكلمة المرور أو بمفتاح مرور أو برابط في البريد.',
    },
    oidcFootnote:
      'يُبلَّغ كل من له حساب هنا حين يتغيّر تسجيل الدخول. إن لم تتوقّع هذا، فاسأل مسؤول هذا الـ Kept.',
    smtp: {
      subject: (sender) => `صار Kept يرسل البريد من ${sender}`,
      body: (sender) =>
        `غيّر مسؤول هذا الـ Kept طريقة إرسال البريد. صار بريده يأتي من ${sender}، كما جاءت هذه الرسالة.`,
      footnote:
        'يُبلَّغ كل من له حساب هنا حين يتغيّر هذا. إن جاءتك رسالة تقول إنها من Kept من عنوان آخر، فلا تفتح روابطها.',
    },
    ai: {
      subject: (provider) => `صار مزوّد الذكاء الاصطناعي الافتراضي في Kept هو ${provider}`,
      body: (provider) =>
        `غيّر مسؤول هذا الـ Kept مزوّد الذكاء الاصطناعي الافتراضي إلى ${provider}. حيث تستخدم مواقعك ذكاء هذا الـ Kept الاصطناعي، صار ما ترسله إليه (الصور والإيصالات والأسئلة) يذهب إلى ${provider}.`,
      action: 'افتح إعدادات الذكاء الاصطناعي',
      footnote:
        'تُظهر إعدادات الذكاء الاصطناعي المزوّد الذي يستخدمه كل موقع من مواقعك، ويختار فيها المالك غيره.',
    },
    providers: { ...NAMES, openai_compatible: 'خادم متوافق مع OpenAI' },
  },
  fr: {
    oidcOn: {
      subject: (name) => `La connexion avec ${name} a changé sur Kept`,
      body: (name) =>
        `La personne qui gère ce Kept a modifié la connexion avec ${name}. Votre mot de passe, vos clés d’accès et les liens par e-mail fonctionnent comme avant.`,
    },
    oidcOff: {
      subject: 'La connexion avec un compte externe est désactivée sur Kept',
      body: 'La personne qui gère ce Kept a désactivé la connexion avec un compte externe. Connectez-vous avec votre mot de passe, une clé d’accès ou un lien par e-mail.',
    },
    oidcFootnote:
      'Chaque personne ayant un compte ici est prévenue quand la connexion change. Si vous ne vous y attendiez pas, demandez à la personne qui gère ce Kept.',
    smtp: {
      subject: (sender) => `Kept envoie désormais ses e-mails depuis ${sender}`,
      body: (sender) =>
        `La personne qui gère ce Kept a modifié l’envoi des e-mails. Ils viennent désormais de ${sender}, comme ce message.`,
      footnote:
        'Chaque personne ayant un compte ici est prévenue de ce changement. Si un message se disant de Kept vient d’une autre adresse, n’ouvrez pas ses liens.',
    },
    ai: {
      subject: (provider) => `Le fournisseur d’IA par défaut de Kept est désormais ${provider}`,
      body: (provider) =>
        `La personne qui gère ce Kept a choisi ${provider} comme fournisseur d’IA par défaut. Là où vos lieux utilisent l’IA de ce Kept, ce que vous envoyez à l’IA (photos, reçus et questions) va désormais à ${provider}.`,
      action: 'Ouvrir les réglages d’IA',
      footnote:
        'Les réglages d’IA indiquent le fournisseur utilisé par chacun de vos lieux, et permettent au propriétaire d’en choisir un autre.',
    },
    providers: { ...NAMES, openai_compatible: 'un serveur compatible OpenAI' },
  },
  de: {
    oidcOn: {
      subject: (name) => `Die Anmeldung mit ${name} wurde bei Kept geändert`,
      body: (name) =>
        `Die Person, die dieses Kept betreibt, hat die Anmeldung mit ${name} geändert. Ihr Passwort, Ihre Passkeys und E-Mail-Links funktionieren wie bisher.`,
    },
    oidcOff: {
      subject: 'Die Anmeldung mit einem externen Konto ist bei Kept ausgeschaltet',
      body: 'Die Person, die dieses Kept betreibt, hat die Anmeldung mit einem externen Konto ausgeschaltet. Melden Sie sich mit Ihrem Passwort, einem Passkey oder einem E-Mail-Link an.',
    },
    oidcFootnote:
      'Alle mit einem Konto hier werden informiert, wenn sich die Anmeldung ändert. Wenn Sie das nicht erwartet haben, fragen Sie die Person, die dieses Kept betreibt.',
    smtp: {
      subject: (sender) => `Kept sendet E-Mails jetzt von ${sender}`,
      body: (sender) =>
        `Die Person, die dieses Kept betreibt, hat den E-Mail-Versand geändert. Die E-Mails kommen jetzt von ${sender}, wie diese Nachricht.`,
      footnote:
        'Alle mit einem Konto hier werden über diese Änderung informiert. Wenn eine Nachricht angeblich von Kept von einer anderen Adresse kommt, öffnen Sie ihre Links nicht.',
    },
    ai: {
      subject: (provider) => `Der Standard-KI-Anbieter von Kept ist jetzt ${provider}`,
      body: (provider) =>
        `Die Person, die dieses Kept betreibt, hat ${provider} als Standard-KI-Anbieter gewählt. Wo Ihre Orte die KI dieses Kept nutzen, geht das, was Sie an die KI senden (Fotos, Belege und Fragen), jetzt an ${provider}.`,
      action: 'KI-Einstellungen öffnen',
      footnote:
        'Die KI-Einstellungen zeigen, welchen Anbieter jeder Ihrer Orte nutzt, und dort kann der Eigentümer einen anderen wählen.',
    },
    providers: { ...NAMES, openai_compatible: 'ein OpenAI-kompatibler Server' },
  },
  it: {
    oidcOn: {
      subject: (name) => `L’accesso con ${name} è cambiato su Kept`,
      body: (name) =>
        `La persona che gestisce questo Kept ha modificato l’accesso con ${name}. La password, le passkey e i link via e-mail funzionano come prima.`,
    },
    oidcOff: {
      subject: 'L’accesso con un account esterno è disattivato su Kept',
      body: 'La persona che gestisce questo Kept ha disattivato l’accesso con un account esterno. Accedi con la password, una passkey o un link via e-mail.',
    },
    oidcFootnote:
      'Chiunque abbia un account qui viene avvisato quando l’accesso cambia. Se non te lo aspettavi, chiedi alla persona che gestisce questo Kept.',
    smtp: {
      subject: (sender) => `Kept ora invia le e-mail da ${sender}`,
      body: (sender) =>
        `La persona che gestisce questo Kept ha modificato l’invio delle e-mail. Ora arrivano da ${sender}, come questo messaggio.`,
      footnote:
        'Chiunque abbia un account qui viene avvisato di questo cambiamento. Se un messaggio che dice di venire da Kept arriva da un altro indirizzo, non aprirne i link.',
    },
    ai: {
      subject: (provider) => `Il fornitore di IA predefinito di Kept ora è ${provider}`,
      body: (provider) =>
        `La persona che gestisce questo Kept ha scelto ${provider} come fornitore di IA predefinito. Dove i tuoi luoghi usano l’IA di questo Kept, ciò che invii all’IA (foto, ricevute e domande) ora va a ${provider}.`,
      action: 'Apri le impostazioni IA',
      footnote:
        'Le impostazioni IA mostrano quale fornitore usa ciascuno dei tuoi luoghi, e lì il proprietario può sceglierne un altro.',
    },
    providers: { ...NAMES, openai_compatible: 'un server compatibile con OpenAI' },
  },
  vi: {
    oidcOn: {
      subject: (name) => `Đăng nhập với ${name} đã thay đổi trên Kept`,
      body: (name) =>
        `Người quản lý Kept này đã thay đổi đăng nhập với ${name}. Mật khẩu, khóa truy cập và liên kết email của bạn vẫn hoạt động như trước.`,
    },
    oidcOff: {
      subject: 'Đăng nhập với tài khoản bên ngoài bị tắt trên Kept',
      body: 'Người quản lý Kept này đã tắt đăng nhập với tài khoản bên ngoài. Đăng nhập bằng mật khẩu của bạn, một khóa truy cập hoặc một liên kết email.',
    },
    oidcFootnote:
      'Mọi người có tài khoản ở đây đều được thông báo khi đăng nhập thay đổi. Nếu bạn không mong đợi điều đó, hãy hỏi người quản lý Kept này.',
    smtp: {
      subject: (sender) => `Kept hiện gửi thư từ ${sender}`,
      body: (sender) =>
        `Người quản lý Kept này đã thay đổi cách gửi thư. Thư hiện đến từ ${sender}, như thư này.`,
      footnote:
        'Mọi người có tài khoản ở đây được thông báo khi thay đổi này diễn ra. Nếu một thư tự nhận là từ Kept đến từ một địa chỉ khác, đừng mở các liên kết trong thư.',
    },
    ai: {
      subject: (provider) => `Nhà cung cấp AI mặc định của Kept hiện là ${provider}`,
      body: (provider) =>
        `Người quản lý Kept này đã thay đổi nhà cung cấp AI mặc định thành ${provider}. Ở những địa điểm của bạn dùng AI của Kept này, những gì bạn gửi cho AI (ảnh, hóa đơn và câu hỏi) giờ sẽ đến ${provider}.`,
      action: 'Mở cài đặt AI',
      footnote:
        'Cài đặt AI chỉ ra nhà cung cấp nào mỗi địa điểm của bạn dùng, và cho phép chủ sở hữu chọn một nhà cung cấp khác.',
    },
    providers: { ...NAMES, openai_compatible: 'máy chủ tương thích với OpenAI' },
  },
  uk: {
    oidcOn: {
      subject: (name) => `Вхід через ${name} змінено в Kept`,
      body: (name) =>
        `Людина, яка керує цим Kept, змінила вхід через ${name}. Ваш пароль, ключі доступу та посилання з електронної пошти працюють як раніше.`,
    },
    oidcOff: {
      subject: 'Вхід через зовнішній обліковий запис вимкнено в Kept',
      body: 'Людина, яка керує цим Kept, вимкнула вхід через зовнішній обліковий запис. Увійдіть за допомогою пароля, ключа доступу або посилання з електронної пошти.',
    },
    oidcFootnote:
      'Кожного, хто має обліковий запис тут, повідомляють про зміни входу. Якщо ви не очікували цього, запитайте людину, яка керує цим Kept.',
    smtp: {
      subject: (sender) => `Kept тепер надсилає листи від ${sender}`,
      body: (sender) =>
        `Людина, яка керує цим Kept, змінила спосіб надсилання листів. Тепер вони надходять від ${sender}, як і цей лист.`,
      footnote:
        'Кожного, хто має обліковий запис тут, повідомляють про ці зміни. Якщо лист, який каже, що він від Kept, приходить з іншої адреси, не переходьте за його посиланнями.',
    },
    ai: {
      subject: (provider) => `Тепер типовий ШІ-провайдер Kept: ${provider}`,
      body: (provider) =>
        `Людина, яка керує цим Kept, змінила його типовий ШІ-провайдер на ${provider}. Там, де ваші локації використовують ШІ цього Kept, те, що ви надсилаєте ШІ (фото, чеки та запитання), тепер надходить до ${provider}.`,
      action: 'Відкрити налаштування ШІ',
      footnote:
        'Налаштування ШІ показують, який провайдер використовує кожна з ваших локацій, і дозволяють власнику обрати інший.',
    },
    providers: { ...NAMES, openai_compatible: 'сервер, сумісний з OpenAI' },
  },
  es: {
    oidcOn: {
      subject: (name) => `Cambió el inicio de sesión con ${name} en Kept`,
      body: (name) =>
        `La persona que administra este Kept cambió el inicio de sesión con ${name}. Tu contraseña, claves de acceso y enlaces de correo funcionan como antes.`,
    },
    oidcOff: {
      subject: 'El inicio de sesión con una cuenta externa está desactivado en Kept',
      body: 'La persona que administra este Kept desactivó el inicio de sesión con una cuenta externa. Inicia sesión con tu contraseña, una clave de acceso o un enlace de correo.',
    },
    oidcFootnote:
      'Todas las personas con una cuenta aquí reciben un aviso cuando cambia el inicio de sesión. Si no lo esperabas, pregunta a la persona que administra este Kept.',
    smtp: {
      subject: (sender) => `Kept ahora envía correo desde ${sender}`,
      body: (sender) =>
        `La persona que administra este Kept cambió cómo envía correo. Su correo ahora viene desde ${sender}, como este mensaje.`,
      footnote:
        'Todas las personas con una cuenta aquí reciben un aviso cuando esto cambia. Si un mensaje dice que es de Kept y viene de otra dirección, no sigas sus enlaces.',
    },
    ai: {
      subject: (provider) => `El proveedor de IA predeterminado de Kept ahora es ${provider}`,
      body: (provider) =>
        `La persona que administra este Kept cambió su proveedor de IA predeterminado a ${provider}. Donde tus ubicaciones usan la IA de este Kept, lo que envías a la IA (fotos, recibos y preguntas) ahora va a ${provider}.`,
      action: 'Abrir configuración de IA',
      footnote:
        'La configuración de IA muestra qué proveedor usa cada una de tus ubicaciones y permite al propietario elegir otro.',
    },
    providers: { ...NAMES, openai_compatible: 'un servidor compatible con OpenAI' },
  },
};

function table(locale: MailLocale): TransparencyTable {
  const t = WORDS[locale];
  return {
    'oidc-changed': (m: Of<'oidc-changed'>): Message =>
      m.name
        ? {
            subject: t.oidcOn.subject(m.name),
            paragraphs: [t.oidcOn.body(m.name)],
            footnote: t.oidcFootnote,
          }
        : { subject: t.oidcOff.subject, paragraphs: [t.oidcOff.body], footnote: t.oidcFootnote },
    'smtp-changed': (m: Of<'smtp-changed'>): Message => ({
      subject: t.smtp.subject(m.sender),
      paragraphs: [t.smtp.body(m.sender)],
      footnote: t.smtp.footnote,
    }),
    'ai-provider-changed': (m: Of<'ai-provider-changed'>, ctx: MessageContext): Message => {
      const provider = t.providers[m.provider];
      return {
        subject: t.ai.subject(provider),
        paragraphs: [t.ai.body(provider)],
        action: { label: t.ai.action, url: page(ctx, '/settings/ai') },
        footnote: t.ai.footnote,
      };
    },
  };
}

export const TRANSPARENCY_MESSAGES: Record<MailLocale, TransparencyTable> = {
  en: table('en'),
  ar: table('ar'),
  fr: table('fr'),
  de: table('de'),
  it: table('it'),
  vi: table('vi'),
  uk: table('uk'),
  es: table('es'),
};
