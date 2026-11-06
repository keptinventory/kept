// Spanish mail. Same shape as the English table in messages.ts; keep them in step.
import type { SecurityEvent } from '../auth/security.js';
import type { AdminAction, AiCapFacts } from './mailer.js';
import {
  aiPage,
  type Chrome,
  type CoreTable,
  capFactsOf,
  capitalise,
  day,
  diskFacts,
  type Message,
  type MessageContext,
  mailDay,
  num,
  page,
  tokens,
} from './message-kit.js';

// How many, with the noun in the singular or the plural.
const esCount = (n: number, one: string, other: string) => `${n} ${n === 1 ? one : other}`;

const ES_ROLE = { admin: 'administrador', member: 'miembro', viewer: 'espectador' } as const;

const ES_NOT_YOU =
  'Si no fuiste tú, restablece tu contraseña ahora desde la página de inicio de sesión.';

const ES_SECURITY: Record<SecurityEvent, (ctx: MessageContext) => Message> = {
  'passkey-added': () => ({
    subject: 'Se agregó una clave de acceso a tu cuenta de Kept',
    paragraphs: [
      'Se agregó una nueva clave de acceso a tu cuenta de Kept, y se cerró sesión en todos los demás dispositivos.',
    ],
    footnote:
      'Si no fuiste tú, restablece tu contraseña ahora y quita la clave de acceso en Configuración → Iniciar sesión y seguridad.',
  }),
  'two-factor-disabled': () => ({
    subject: 'Se desactivó el inicio de sesión con autenticación de dos factores',
    paragraphs: [
      'Se desactivó la autenticación de dos factores para tu cuenta de Kept, y se cerró sesión en todos los demás dispositivos.',
    ],
    footnote:
      'Si no fuiste tú, restablece tu contraseña ahora y activa de nuevo la autenticación de dos factores.',
  }),
  'passkey-removed': () => ({
    subject: 'Se quitó una clave de acceso de tu cuenta de Kept',
    paragraphs: [
      'Se quitó una clave de acceso de tu cuenta de Kept, y se cerró sesión en todos los demás dispositivos. Ya no te permite iniciar sesión.',
    ],
    footnote: ES_NOT_YOU,
  }),
  'two-factor-enabled': () => ({
    subject: 'Se activó el inicio de sesión con autenticación de dos factores',
    paragraphs: [
      'Se activó la autenticación de dos factores para tu cuenta de Kept, y se cerró sesión en todos los demás dispositivos. Ahora iniciar sesión pide un código de tu app de autenticación.',
    ],
    footnote:
      'Si no fuiste tú, restablece tu contraseña ahora y revisa Configuración → Iniciar sesión y seguridad.',
  }),
  'two-factor-replaced': () => ({
    subject: 'Se configuró de nuevo el inicio de sesión con autenticación de dos factores',
    paragraphs: [
      'Se configuró de nuevo la autenticación de dos factores para tu cuenta de Kept con una app de autenticación nueva, y se cerró sesión en todos los demás dispositivos. Los códigos de la app antigua y los códigos de respaldo antiguos ya no funcionan.',
    ],
    footnote:
      'Si no fuiste tú, restablece tu contraseña ahora y revisa Configuración → Iniciar sesión y seguridad.',
  }),
  'backup-codes-new': () => ({
    subject: 'Se crearon nuevos códigos de respaldo para tu cuenta de Kept',
    paragraphs: [
      'Se crearon nuevos códigos de respaldo de dos factores para tu cuenta de Kept, y se cerró sesión en todos los demás dispositivos. Los códigos de respaldo antiguos ya no funcionan.',
    ],
    footnote: ES_NOT_YOU,
  }),
  'sign-in-unlinked': () => ({
    subject: 'Se desvinculó un inicio de sesión de tu cuenta de Kept',
    paragraphs: [
      'Se desvinculó un inicio de sesión externo (como Google) de tu cuenta de Kept, y se cerró sesión en todos los demás dispositivos. Ya no te permite iniciar sesión.',
    ],
    footnote: ES_NOT_YOU,
  }),
  'password-changed': () => ({
    subject: 'Se cambió tu contraseña de Kept',
    paragraphs: [
      'Se cambió la contraseña de tu cuenta de Kept, y se cerró sesión en todos los demás dispositivos.',
    ],
    footnote: ES_NOT_YOU,
  }),
  'unverified-account-reset': () => ({
    subject: 'Tu dirección de correo electrónico está confirmada',
    paragraphs: [
      'Tu contraseña de Kept se restableció desde este buzón, lo que confirma que la dirección de correo de la cuenta es tuya.',
      'La dirección no se había confirmado antes, así que, por si otra persona configuró la cuenta, se eliminaron todas las claves de acceso, la configuración de autenticación de dos factores y los dispositivos con sesión iniciada agregados hasta ahora.',
    ],
    footnote:
      'Inicia sesión con tu nueva contraseña y vuelve a configurar la autenticación de dos factores si la usas. Si no restableciste tu contraseña, restablécela de nuevo ahora.',
  }),
  'unverified-account-link': () => ({
    subject: 'Tu dirección de correo electrónico está confirmada',
    paragraphs: [
      'Iniciaste sesión en Kept con un enlace enviado a este buzón, lo que confirma que la dirección de correo de la cuenta es tuya.',
      'La dirección no se había confirmado antes, así que, por si otra persona configuró la cuenta, se eliminaron su contraseña, sus claves de acceso, su configuración de autenticación de dos factores y todos los demás dispositivos con sesión iniciada.',
    ],
    footnote:
      'Elige una contraseña nueva y vuelve a configurar la autenticación de dos factores si la usas, en la configuración de tu cuenta.',
  }),
};

const ES_ADMIN: Record<AdminAction, (locationName: string) => Message> = {
  disabled: () => ({
    subject: 'Tu cuenta de Kept fue desactivada',
    paragraphs: [
      'Un administrador de este Kept desactivó tu cuenta. No puedes iniciar sesión hasta que se vuelva a activar.',
    ],
  }),
  enabled: () => ({
    subject: 'Tu cuenta de Kept se activó de nuevo',
    paragraphs: ['Un administrador activó tu cuenta de nuevo. Puedes iniciar sesión como antes.'],
  }),
  'two-factor-reset': () => ({
    subject: 'Se restableció la autenticación de dos factores en tu cuenta',
    paragraphs: [
      'Un administrador quitó la autenticación de dos factores de tu cuenta y cerró su sesión en todas partes, generalmente porque perdiste tu app de autenticación.',
      'Vuelve a configurar la autenticación de dos factores en la configuración de tu cuenta.',
    ],
  }),
  'signed-out-everywhere': () => ({
    subject: 'Se cerró tu sesión de Kept en todas partes',
    paragraphs: [
      'Un administrador cerró la sesión de tu cuenta en todos los dispositivos. Inicia sesión de nuevo para continuar.',
    ],
  }),
  'instance-admin-granted': () => ({
    subject: 'Ahora eres administrador de este Kept',
    paragraphs: [
      'Te convirtieron en administrador de la instancia: ahora puedes gestionar los usuarios y la configuración de este Kept.',
    ],
  }),
  'instance-admin-revoked': () => ({
    subject: 'Ya no eres administrador de este Kept',
    paragraphs: [
      'Te quitaron los derechos de administrador de la instancia. Tus propias ubicaciones y todo lo que contienen siguen sin cambios.',
    ],
  }),
  'password-reset-issued': () => ({
    subject: 'Se emitió un restablecimiento de contraseña para tu cuenta',
    paragraphs: [
      'La persona que administra este Kept emitió un restablecimiento de contraseña de un solo uso para tu cuenta y cerró su sesión en todas partes.',
      'Esa persona te dará el código para elegir una contraseña nueva.',
    ],
  }),
  'location-ownership-received': (name) => ({
    subject: `Ahora eres el propietario de ${name}`,
    paragraphs: [`La persona que administra este Kept te hizo propietario de ${name}.`],
  }),
  'location-ownership-moved': (name) => ({
    subject: `${name} tiene un nuevo propietario`,
    paragraphs: [
      `La persona que administra este Kept cambió el propietario de ${name}. Sigues en ella como administrador.`,
    ],
  }),
  'token-created': () => ({
    subject: 'Se creó un token para tu cuenta',
    paragraphs: [
      'La persona que administra este Kept creó un token personal para tu cuenta en el servidor, para una app como Home Assistant o un asistente de IA. Puede hacer lo mismo que tú, en las ubicaciones para las que se creó.',
      'Si no lo solicitaste, revócalo en Configuración → Conexiones.',
    ],
  }),
};

// AI caps (D206): the cap in words, and how much of it is used.
function esCapOf(c: AiCapFacts): string {
  switch (c.scope) {
    case 'location':
      return `el límite de IA de ${c.target}`;
    case 'member':
      return c.target ? `el límite de IA de ${c.target}` : 'el límite de IA de una persona';
    case 'account':
      return 'el límite de IA de tu cuenta';
    case 'user':
      return 'tu límite personal de IA';
    case 'instance':
      return 'el límite de IA de este servidor';
    case 'instance_account':
      return c.target
        ? `la asignación de ${c.target} en la clave de IA de este servidor`
        : 'la asignación en la clave de IA de este servidor';
  }
}
const esUsed = (c: AiCapFacts) =>
  c.unit === 'money'
    ? `${c.currency} ${c.used} de ${c.currency} ${c.limit}`
    : `${tokens('es', c.used)} de ${tokens('es', c.limit)} tokens`;

function esCap(level: 80 | 100, c: AiCapFacts, ctx: MessageContext, footnote: string): Message {
  const cap = esCapOf(c);
  if (level === 80) {
    return {
      subject: `Kept: ${cap} va por el 80 % este mes`,
      paragraphs: [
        `${capitalise(cap)} está en ${esUsed(c)} hasta ahora este mes.`,
        'Cuando se alcanza el límite, la IA se pausa hasta el día 1 del próximo mes. Las capturas siguen guardándose y sus fotos se leen cuando la IA se reanude.',
      ],
      action: { label: 'Abrir configuración de IA', url: aiPage(ctx, c.scope) },
      footnote,
    };
  }
  return {
    subject: `Kept: IA pausada hasta ${day(c.pausedUntil)}`,
    paragraphs: [
      `${capitalise(cap)} se alcanzó: ${esUsed(c)} este mes.`,
      `La IA está pausada hasta ${day(c.pausedUntil)}. Las capturas siguen guardándose y sus fotos se leen cuando se reanude. Para reanudar antes, aumenta o quita el límite.`,
    ],
    action: { label: 'Reanudar ahora', url: aiPage(ctx, c.scope) },
    footnote,
  };
}

export const ES: CoreTable = {
  'magic-link': (m) => ({
    subject: 'Tu enlace de inicio de sesión para Kept',
    paragraphs: [
      'Usa este enlace para iniciar sesión en Kept. Solo funciona una vez, en los próximos 15 minutos.',
    ],
    action: { label: 'Iniciar sesión', url: m.url },
    footnote:
      'Si no pediste iniciar sesión, ignora este correo. Nadie puede iniciar sesión sin el enlace.',
  }),
  'password-reset': (m) => ({
    subject: 'Restablece tu contraseña de Kept',
    paragraphs: [
      'Alguien pidió restablecer la contraseña de esta cuenta de Kept. Usa este enlace para elegir una nueva. Solo funciona una vez, durante la próxima hora.',
    ],
    action: { label: 'Elige una contraseña nueva', url: m.url },
    footnote: 'Si no fuiste tú, ignora este correo: tu contraseña sigue igual.',
  }),
  'email-change-confirm': (m) => ({
    subject: 'Confirma tu nueva dirección de correo electrónico',
    paragraphs: [
      `Alguien con sesión iniciada en tu cuenta de Kept pidió moverla a ${m.newEmail}. Si fuiste tú, confírmalo con este enlace durante la próxima hora.`,
    ],
    action: { label: 'Confirmar el cambio', url: m.url },
    footnote:
      'Si no fuiste tú, no uses el enlace: tu cuenta sigue en esta dirección. Quizás quieras cambiar tu contraseña.',
  }),
  'email-change-verify': (m) => ({
    subject: 'Verifica tu dirección de correo electrónico para Kept',
    paragraphs: ['Usa este enlace para terminar de mover tu cuenta de Kept a esta dirección.'],
    action: { label: 'Verifica esta dirección', url: m.url },
    footnote: 'Si no esperabas esto, ignóralo: nada cambia hasta que uses el enlace.',
  }),
  'email-changed': (m) => ({
    subject: 'Tu dirección de correo electrónico de Kept cambió',
    paragraphs: [
      `Tu cuenta de Kept ahora usa ${m.newEmail}. Esta dirección ya no recibe sus correos.`,
    ],
    footnote: 'Si no hiciste este cambio, ponte en contacto con la persona que administra tu Kept.',
  }),
  'account-deletion': (m) => {
    const day = mailDay('es', m.purgeAfter, m.timezone);
    return {
      subject: `Tu cuenta de Kept se eliminará el ${day}`,
      paragraphs: [
        `Pediste que se eliminara tu cuenta de Kept. Se eliminará el ${day}, junto con tu ubicación Personal y todo lo que contiene.`,
        'Hasta entonces, iniciar sesión muestra esa fecha y te permite mantener la cuenta. Lo que agregaste a las ubicaciones de otras personas se queda allí.',
      ],
      footnote:
        'Si no pediste esto, inicia sesión ahora, elige Mantener mi cuenta y cambia tu contraseña.',
    };
  },
  'report-ready': (m) => {
    const name = {
      inventory: 'Inventario',
      insurance: 'Reporte de seguro',
      vehicle_history: 'Historial de vehículo',
    }[m.report];
    return {
      subject: m.place ? `${name}: ${m.place}` : name,
      paragraphs: [
        m.attached
          ? 'Kept preparó el reporte que pediste. Está adjunto como PDF.'
          : 'Kept preparó el reporte que pediste, pero es demasiado grande para adjuntar. Imprímelo de nuevo desde Kept para descargarlo.',
      ],
      footnote:
        'Los reportes programados aparecen en Configuración → Yo → Notificaciones, donde puedes desactivarlos.',
    };
  },
  invite: (m) => ({
    subject: m.inviterName
      ? `${m.inviterName} te invitó a ${m.locationName} en Kept`
      : `Te invitaron a ${m.locationName} en Kept`,
    paragraphs: [
      m.inviterName
        ? `${m.inviterName} te invitó a unirte a ${m.locationName} como ${ES_ROLE[m.role]}.`
        : `Te invitaron a unirte a ${m.locationName} como ${ES_ROLE[m.role]}.`,
      'Kept lleva el registro de los objetos que tienes, dónde están y qué vence para ellos.',
    ],
    action: { label: 'Aceptar la invitación', url: m.url },
    footnote: 'Si no esperabas esto, ignóralo: no pasa nada a menos que aceptes.',
  }),
  'sign-up-existing': (_m, ctx) => ({
    subject: 'Alguien intentó registrarse con tu correo electrónico',
    paragraphs: [
      'Alguien intentó crear una cuenta de Kept con esta dirección, que ya tiene una. No se creó ninguna cuenta nueva.',
      'Si fuiste tú, inicia sesión. Si olvidaste tu contraseña, puedes restablecerla desde la página de inicio de sesión.',
    ],
    action: { label: 'Iniciar sesión', url: page(ctx, '/signin') },
    footnote: 'Si no fuiste tú, no tienes que hacer nada.',
  }),
  'security-notice': (m, ctx) => ES_SECURITY[m.event](ctx),
  'admin-action': (m) => ({
    ...ES_ADMIN[m.action](m.locationName ?? ''),
    footnote: 'Este es un aviso automático sobre tu cuenta.',
  }),
  'owner-new-member': (m) => ({
    subject: `${m.memberName} se unió a ${m.locationName}`,
    paragraphs: [
      m.managed
        ? `Se agregó a ${m.memberName} a ${m.locationName} como una cuenta administrada, con el rol de ${ES_ROLE[m.role]}.`
        : `${m.memberName} ahora tiene acceso a ${m.locationName} como ${ES_ROLE[m.role]}.`,
    ],
    footnote:
      'Recibes esto como propietario, por cada nuevo miembro. Puedes cambiar o eliminar miembros en la configuración de la ubicación.',
  }),
  'ai-cap': (m, ctx) =>
    esCap(
      m.level,
      m.cap,
      ctx,
      'Recibes esto porque configuraste este límite o cubre tu trabajo. Se envía una vez al mes.',
    ),
  'admin-alert': (m, ctx) => {
    const footnote =
      'Recibes esto como administrador de este Kept. Se envía como máximo una vez al día mientras dure el problema.';
    if (m.alert === 'ai_instance_cap_warning' || m.alert === 'ai_instance_cap_reached') {
      const c = capFactsOf(m.details);
      if (c) return esCap(m.alert === 'ai_instance_cap_warning' ? 80 : 100, c, ctx, footnote);
    }
    if (m.alert === 'ai_instance_key_rejected') {
      return {
        subject: 'Kept: la clave de IA del servidor fue rechazada',
        paragraphs: [
          `${String(m.details.provider ?? 'El proveedor')} rechazó la clave de IA de este servidor, por lo que el trabajo de IA que paga está en espera.`,
          'Reemplaza la clave en la configuración de IA del administrador. El trabajo en espera continúa al guardar una nueva clave.',
        ],
        action: { label: 'Abrir configuración de IA', url: page(ctx, '/admin/ai') },
        footnote,
      };
    }
    if (m.alert === 'failed_jobs_rising') {
      return {
        subject: 'Kept: los trabajos en segundo plano están fallando',
        paragraphs: [
          `${esCount(num(m.details.failedLastHour), 'trabajo fallido', 'trabajos fallidos')} en la última hora.`,
          'La lista de trabajos fallidos muestra qué falló y por qué; desde allí puedes reintentarlos o descartarlos.',
        ],
        action: { label: 'Abrir trabajos fallidos', url: page(ctx, '/admin/jobs') },
        footnote,
      };
    }
    if (m.alert === 'backup_failed') {
      return {
        subject: 'Kept: la copia de seguridad nocturna falló',
        paragraphs: [
          `La copia de seguridad nocturna no terminó: ${String(m.details.error ?? '')}`,
          m.details.lastOk
            ? `La última copia de seguridad correcta terminó el ${day(m.details.lastOk)}. Hasta que otra termine bien, nada de lo escrito desde entonces está en una copia de seguridad.`
            : 'Aún no ha habido una copia de seguridad exitosa, así que nada en este Kept está respaldado.',
        ],
        action: { label: 'Abrir la página de estado', url: page(ctx, '/admin/status') },
        footnote,
      };
    }
    if (m.alert === 'backup_stale') {
      return {
        subject: 'Kept: sin copia de seguridad por más de 36 horas',
        paragraphs: [
          m.details.lastOkAt
            ? `La última copia de seguridad correcta terminó el ${day(m.details.lastOkAt)}. Kept hace una copia de seguridad cada noche, así que la copia de seguridad nocturna ha dejado de funcionar.`
            : 'Las copias de seguridad están configuradas, pero aún no ha terminado ninguna.',
          'La página de copias de seguridad muestra cada ejecución y por qué falló. Si el proceso en segundo plano de Kept no está en marcha, vuelve a iniciarlo.',
        ],
        action: { label: 'Abrir copias de seguridad', url: page(ctx, '/admin/backups') },
        footnote,
      };
    }
    if (m.alert === 'disk_space_low') {
      const d = diskFacts(m.details, true);
      return {
        subject: d.backup
          ? 'Kept: el disco de copias de seguridad está casi lleno'
          : 'Kept: el disco de datos está casi lleno',
        paragraphs: [
          `Está al ${d.percent}%, con ${d.gb} GB libres.`,
          d.backup
            ? 'Cuando se llene, la copia de seguridad nocturna fallará. Libera espacio, ponle un disco más grande o guarda menos copias en la configuración de copias de seguridad.'
            : 'Cuando se llene, Kept no podrá guardar fotos ni documentos nuevos, y su base de datos podría detenerse. Libera espacio o ponle un disco más grande.',
        ],
        action: { label: 'Abrir la página de estado', url: page(ctx, '/admin/status') },
        footnote,
      };
    }
    if (m.alert === 'bucket_versioning_off') {
      return {
        subject: 'Kept: el control de versiones está desactivado en el bucket de archivos',
        paragraphs: [
          'Kept guarda sus archivos en un bucket S3, y la copia de seguridad nocturna los deja ahí. El control de versiones está desactivado en ese bucket, así que un archivo borrado o sobrescrito por error, o por alguien que tenga su clave, no se puede recuperar.',
          'Activa el control de versiones para el bucket en tu proveedor de almacenamiento. Este aviso se detiene cuando la siguiente copia de seguridad lo encuentre activado.',
        ],
        action: { label: 'Abrir la página de estado', url: page(ctx, '/admin/status') },
        footnote,
      };
    }
    if (m.alert === 'restore_drill_due') {
      return {
        subject: 'Kept: es hora de un simulacro de restauración',
        paragraphs: [
          m.details.lastDrillAt
            ? `El último simulacro de restauración fue el ${day(m.details.lastDrillAt)}, hace más de 30 días.`
            : 'Aún no se ha hecho ningún simulacro de restauración.',
          'Un simulacro restaura la última copia de seguridad en una base de datos de prueba y verifica cada tabla, así sabes que las copias de seguridad realmente se pueden restaurar. Ejecuta `kept admin backup drill` como indica la guía de restauración.',
        ],
        action: { label: 'Abrir copias de seguridad', url: page(ctx, '/admin/backups') },
        footnote,
      };
    }
    if (m.alert === 'backup_verify_failed') {
      return {
        subject: 'Kept: la verificación semanal de copias de seguridad encontró un problema',
        paragraphs: [
          `La verificación semanal del repositorio de copias de seguridad falló: ${String(m.details.error ?? '')}`,
          'Es posible que tus copias de seguridad no se puedan restaurar tal como están. Abre Copias de seguridad para ver qué encontró, y verifica de nuevo una vez que se solucione.',
        ],
        action: { label: 'Abrir copias de seguridad', url: page(ctx, '/admin/backups') },
        footnote,
      };
    }
    if (m.alert === 'backup_suspicious_size') {
      return {
        subject: 'Kept: la última copia de seguridad parece muy pequeña',
        paragraphs: [
          'La última copia de seguridad salió mucho más pequeña que la última correcta. Kept la guardó, pero no eliminó copias de seguridad anteriores, así que las correctas se conservan.',
          'Si se eliminó mucho a propósito, no hay problema y las próximas copias de seguridad quitarán este aviso. Si no, averigua qué cambió antes de restaurar nada.',
        ],
        action: { label: 'Abrir copias de seguridad', url: page(ctx, '/admin/backups') },
        footnote,
      };
    }
    if (m.alert === 'webhook_failing') {
      return {
        subject: 'Kept: un webhook de una ubicación sigue fallando',
        paragraphs: [
          `Un webhook configurado en una de las ubicaciones de este Kept ha fallado en cada entrega desde el ${day(m.details.since)}, así que Kept lo ha marcado como fallido.`,
          'Kept lo vuelve a intentar con cada nuevo evento. Los propietarios y administradores de la ubicación lo ven, y pueden arreglarlo o eliminarlo, en Configuración de ubicación → Webhooks.',
        ],
        action: { label: 'Abrir la página de estado', url: page(ctx, '/admin/status') },
        footnote,
      };
    }
    if (m.alert === 'reminders_not_scanned') {
      return {
        subject: 'Kept: los recordatorios han dejado de enviarse',
        paragraphs: [
          m.details.lastOkAt
            ? `Kept revisó por última vez los recordatorios vencidos el ${day(m.details.lastOkAt)}, hace más de 2 horas. Hasta que vuelva a revisarlos, nadie recibe recordatorios nuevos.`
            : 'Kept aún no ha terminado ni una sola revisión de los recordatorios vencidos, así que nadie recibe recordatorios.',
          'La revisión se ejecuta cada 15 minutos en el proceso en segundo plano de Kept. La lista de trabajos fallidos muestra por qué se detuvo; si el proceso en segundo plano no está en ejecución, vuelve a iniciarlo.',
        ],
        action: { label: 'Abrir trabajos fallidos', url: page(ctx, '/admin/jobs') },
        footnote,
      };
    }
    if (m.alert === 'llm_default_partition') {
      return {
        subject: 'Kept: los registros de llamadas de IA necesitan atención',
        paragraphs: [
          `Fuera de su partición mensual: ${esCount(num(m.details.rows), 'registro de llamada de IA', 'registros de llamadas de IA')} (del ${day(m.details.oldest)} al ${day(m.details.newest)}).`,
          'Kept no puede crear la partición de ese mes hasta que se muevan a ella, así que el trabajo nocturno de mantenimiento de IA seguirá fallando. Moverlos es una tarea de base de datos para la persona que administra este Kept.',
        ],
        action: { label: 'Abrir la página de estado', url: page(ctx, '/admin/status') },
        footnote,
      };
    }
    return {
      subject: 'Kept: los eventos de auditoría necesitan atención',
      paragraphs: [
        `Fuera de su partición mensual: ${esCount(num(m.details.rows), 'evento de auditoría', 'eventos de auditoría')} (del ${day(m.details.oldest)} al ${day(m.details.newest)}).`,
        'Kept no puede crear la partición de ese mes hasta que se muevan a ella, así que el trabajo nocturno de mantenimiento seguirá fallando. Moverlos es una tarea de base de datos para la persona que administra este Kept.',
      ],
      action: { label: 'Abrir la página de estado', url: page(ctx, '/admin/status') },
      footnote,
    };
  },
};

export const ES_CHROME: Chrome = {
  dir: 'ltr',
  linkFallback: 'Si el botón no funciona, copia esta dirección en tu navegador:',
  sentBy: (host) => `Enviado por Kept desde ${host}.`,
  about: (site) => `Kept, el inventario del hogar de código abierto: ${site}`,
};
