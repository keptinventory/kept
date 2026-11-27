// Simplified Chinese mail. Same shape as the English table in messages.ts; keep them in step.
import type { SecurityEvent } from '../auth/security.js';
import type { AdminAction, AiCapFacts } from './mailer.js';
import {
  aiPage,
  type Chrome,
  type CoreTable,
  capFactsOf,
  day,
  deviceName,
  diskFacts,
  type Message,
  type MessageContext,
  mailDay,
  mailTime,
  num,
  page,
  tokens,
} from './message-kit.js';

const ZH_ROLE = { admin: '管理员', member: '成员', viewer: '访客' } as const;

const ZH_NOT_YOU = '如果这不是你本人操作，请立即前往登录页重置密码。';

const ZH_SECURITY: Record<SecurityEvent, (ctx: MessageContext) => Message> = {
  'passkey-added': () => ({
    subject: '你的 Kept 账户已添加通行密钥',
    paragraphs: ['你的 Kept 账户已添加一个新的通行密钥，其他所有设备均已退出登录。'],
    footnote: '如果这不是你本人操作，请立即重置密码，并在「设置 → 登录与安全」中移除该通行密钥。',
  }),
  'two-factor-disabled': () => ({
    subject: '两步验证已关闭',
    paragraphs: ['你的 Kept 账户已关闭两步验证，其他所有设备均已退出登录。'],
    footnote: '如果这不是你本人操作，请立即重置密码并重新开启两步验证。',
  }),
  'passkey-removed': () => ({
    subject: '你的 Kept 账户已移除一个通行密钥',
    paragraphs: [
      '你的 Kept 账户已移除一个通行密钥，其他所有设备均已退出登录。该通行密钥已无法用于登录。',
    ],
    footnote: ZH_NOT_YOU,
  }),
  'two-factor-enabled': () => ({
    subject: '两步验证已开启',
    paragraphs: [
      '你的 Kept 账户已开启两步验证，其他所有设备均已退出登录。今后登录时需要输入身份验证器应用生成的验证码。',
    ],
    footnote: '如果这不是你本人操作，请立即重置密码，并检查「设置 → 登录与安全」。',
  }),
  'two-factor-replaced': () => ({
    subject: '两步验证已重新配置',
    paragraphs: [
      '你的 Kept 账户已使用新的身份验证器应用重新配置两步验证，其他所有设备均已退出登录。旧验证器验证码及旧备用验证码均已失效。',
    ],
    footnote: '如果这不是你本人操作，请立即重置密码，并检查「设置 → 登录与安全」。',
  }),
  'backup-codes-new': () => ({
    subject: '你的 Kept 账户已生成新的备用验证码',
    paragraphs: [
      '你的 Kept 账户已生成新的两步验证备用验证码，其他所有设备均已退出登录。旧备用验证码已失效。',
    ],
    footnote: ZH_NOT_YOU,
  }),
  'sign-in-unlinked': () => ({
    subject: '你的 Kept 账户已解绑一种登录方式',
    paragraphs: [
      '一种外部登录方式（如 Google）已从你的 Kept 账户解绑，其他所有设备均已退出登录。你已无法再通过该方式登录。',
    ],
    footnote: ZH_NOT_YOU,
  }),
  'password-changed': () => ({
    subject: '你的 Kept 密码已更改',
    paragraphs: ['你的 Kept 账户密码已更改，其他所有设备均已退出登录。'],
    footnote: ZH_NOT_YOU,
  }),
  'unverified-account-reset': () => ({
    subject: '你的邮箱地址已验证',
    paragraphs: [
      '你的 Kept 密码已通过此邮箱完成重置，确认该账户邮箱归你本人所有。',
      '由于该邮箱此前未经验证，为防止他人曾抢先注册，此前添加的所有通行密钥、两步验证配置及已登录设备均已清除。',
    ],
    footnote:
      '请使用新密码登录，并在需要时重新开启两步验证。如果刚才重置密码的不是你本人，请立即再次重置。',
  }),
  'unverified-account-link': () => ({
    subject: '你的邮箱地址已验证',
    paragraphs: [
      '你已通过发送至此邮箱的链接登录 Kept，确认该账户邮箱归你本人所有。',
      '由于该邮箱此前未经验证，为防止他人曾抢先设置账户，原有的密码、通行密钥、两步验证配置及其他已登录设备均已清除。',
    ],
    footnote: '请在账户设置中设置新密码，并在需要时重新开启两步验证。',
  }),
};

const ZH_ADMIN: Record<AdminAction, (locationName: string) => Message> = {
  disabled: () => ({
    subject: '你的 Kept 账户已被停用',
    paragraphs: ['此 Kept 实例的管理员已停用你的账户。在重新启用之前，你将无法登录。'],
  }),
  enabled: () => ({
    subject: '你的 Kept 账户已重新启用',
    paragraphs: ['管理员已重新启用你的账户，你可以照常登录。'],
  }),
  'two-factor-reset': () => ({
    subject: '你账户的两步验证已被重置',
    paragraphs: [
      '管理员已移除你账户上的两步验证并退出了所有设备的登录（通常是因为验证器设备遗失）。',
      '请在账户设置中重新配置两步验证。',
    ],
  }),
  'signed-out-everywhere': () => ({
    subject: '你的 Kept 账户已在所有设备上退出登录',
    paragraphs: ['管理员已将你的账户从所有设备退出登录。请重新登录以继续使用。'],
  }),
  'instance-admin-granted': () => ({
    subject: '你已成为此 Kept 的实例管理员',
    paragraphs: ['你已被授予实例管理员权限，可以管理此 Kept 的用户与系统设置。'],
  }),
  'instance-admin-revoked': () => ({
    subject: '你已不再是此 Kept 的实例管理员',
    paragraphs: ['你的实例管理员权限已被移除。你名下的地点及其中所有物品不受影响。'],
  }),
  'password-reset-issued': () => ({
    subject: '你的账户已获发一次性密码重置码',
    paragraphs: [
      '运行此 Kept 的管理员已为你的账户生成一次性密码重置码，并退出了所有设备的登录。',
      '管理员会将重置码交给你，用于设置新密码。',
    ],
  }),
  'location-ownership-received': (name) => ({
    subject: `你已成为「${name}」的所有者`,
    paragraphs: [`运行此 Kept 的管理员已将「${name}」的所有权移交给你。`],
  }),
  'location-ownership-moved': (name) => ({
    subject: `「${name}」已更换所有者`,
    paragraphs: [
      `运行此 Kept 的管理员已将「${name}」移交给新的所有者。你仍保留该地点的管理员身份。`,
    ],
  }),
  'token-created': () => ({
    subject: '你的账户已创建一个访问令牌',
    paragraphs: [
      '运行此 Kept 的管理员在服务器上为你的账户创建了个人访问令牌（供 Home Assistant 或 AI 助手等应用使用）。在所授权的地点内，该令牌拥有与你相同的操作权限。',
      '如果这不是你本人申请的，请在「设置 → 连接」中将其撤销。',
    ],
  }),
};

// AI caps (D206): the cap in words, and how much of it is used.
function zhCapOf(c: AiCapFacts): string {
  switch (c.scope) {
    case 'location':
      return `「${c.target}」的 AI 限额`;
    case 'member':
      return c.target ? `${c.target} 的 AI 限额` : '成员的 AI 限额';
    case 'account':
      return '你账户的 AI 限额';
    case 'user':
      return '你的个人 AI 限额';
    case 'instance':
      return '此服务器的 AI 限额';
    case 'instance_account':
      return c.target ? `${c.target} 在此服务器 AI 密钥上的配额` : '此服务器 AI 密钥上的账户配额';
  }
}

const zhUsed = (c: AiCapFacts) =>
  c.unit === 'money'
    ? `${c.currency} ${c.used} / ${c.currency} ${c.limit}`
    : `${tokens('zh-CN', c.used)} / ${tokens('zh-CN', c.limit)} token`;

function zhCap(level: 80 | 100, c: AiCapFacts, ctx: MessageContext, footnote: string): Message {
  const cap = zhCapOf(c);
  if (level === 80) {
    return {
      subject: `Kept：本月已使用 ${cap} 的 80%`,
      paragraphs: [
        `${cap}本月已使用 ${zhUsed(c)}。`,
        '达到上限后，AI 功能将暂停至下月 1 日。在此期间采集的照片仍会照常保存，并在恢复后继续识别。',
      ],
      action: { label: '打开 AI 设置', url: aiPage(ctx, c.scope) },
      footnote,
    };
  }
  return {
    subject: `Kept：AI 已暂停至 ${day(c.pausedUntil)}`,
    paragraphs: [
      `${cap}已达上限：本月已使用 ${zhUsed(c)}。`,
      `AI 功能将暂停至 ${day(c.pausedUntil)}。在此期间采集的照片仍会照常保存，并在恢复后继续识别。如需提前恢复，请调高或移除该限额。`,
    ],
    action: { label: '立即恢复', url: aiPage(ctx, c.scope) },
    footnote,
  };
}

export const ZH: CoreTable = {
  'magic-link': (m) => ({
    subject: '你的 Kept 登录链接',
    paragraphs: ['点击此链接即可登录 Kept。链接仅可使用一次，有效期为 15 分钟。'],
    action: { label: '登录', url: m.url },
    footnote: '如果你未申请登录，请忽略此邮件。没有此链接，任何人都无法登录你的账户。',
  }),
  'password-reset': (m) => ({
    subject: '重置你的 Kept 密码',
    paragraphs: [
      '有人请求重置此 Kept 账户的密码。点击下方链接即可设置新密码。链接仅可使用一次，有效期为 1 小时。',
    ],
    action: { label: '设置新密码', url: m.url },
    footnote: '如果这不是你本人操作，请忽略此邮件，你的原密码不会改变。',
  }),
  'email-change-confirm': (m) => ({
    subject: '确认你的新邮箱地址',
    paragraphs: [
      `已登录你 Kept 账户的用户请求将绑定邮箱更改为 ${m.newEmail}。如果是你本人操作，请在 1 小时内通过下方链接确认。`,
    ],
    action: { label: '确认更改', url: m.url },
    footnote: '如果这不是你本人操作，请勿点击链接：你的账户仍保留在当前邮箱，建议尽快修改密码。',
  }),
  'email-change-verify': (m) => ({
    subject: '验证用于 Kept 的邮箱地址',
    paragraphs: ['点击下方链接，完成将你的 Kept 账户迁移至此邮箱地址。'],
    action: { label: '验证此邮箱', url: m.url },
    footnote: '如果你未进行此操作，请忽略此邮件：在点击链接前不会发生任何更改。',
  }),
  'email-changed': (m) => ({
    subject: '你的 Kept 账户邮箱已更改',
    paragraphs: [`你的 Kept 账户现已改用 ${m.newEmail}。当前邮箱将不再接收来自该账户的邮件。`],
    footnote: '如果这不是你本人操作，请联系运行此 Kept 的管理员。',
  }),
  'account-deletion': (m) => {
    const when = mailDay('zh-CN', m.purgeAfter, m.timezone);
    return {
      subject: `你的 Kept 账户将于 ${when} 删除`,
      paragraphs: [
        `你已申请删除自己的 Kept 账户。该账户将于 ${when} 正式删除，届时你的「个人」地点及其中的全部物品也将一并清除。`,
        '在此日期之前，登录账户可查看删除日期并随时选择保留账户。你在他人地点中添加的内容仍会保留在原处。',
      ],
      footnote: '如果这不是你本人操作，请立即登录并选择「保留我的账户」，同时修改密码。',
    };
  },
  'report-ready': (m) => {
    const name = {
      inventory: '物品清单报告',
      insurance: '保险理赔报告',
      vehicle_history: '车辆历史报告',
    }[m.report];
    return {
      subject: m.place ? `${name}：${m.place}` : name,
      paragraphs: [
        m.attached
          ? 'Kept 已生成你请求的报告，PDF 文件已随附于本邮件中。'
          : 'Kept 已生成你请求的报告，但文件体积过大无法作为邮件附件发送。请返回 Kept 重新导出并下载。',
      ],
      footnote: '定时发送的报告列于「设置 → 我的 → 通知」中，你可随时前往停用。',
    };
  },
  invite: (m) => ({
    subject: m.inviterName
      ? `${m.inviterName} 邀请你加入 Kept 上的「${m.locationName}」`
      : `你受邀加入 Kept 上的「${m.locationName}」`,
    paragraphs: [
      m.inviterName
        ? `${m.inviterName} 邀请你以${ZH_ROLE[m.role]}身份加入「${m.locationName}」。`
        : `你受邀以${ZH_ROLE[m.role]}身份加入「${m.locationName}」。`,
      'Kept 用于记录你拥有的物品、存放位置以及即将到期的保修与待办事项。',
    ],
    action: { label: '接受邀请', url: m.url },
    footnote: '如果你不认识此邀请，请忽略此邮件：在你接受之前不会发生任何操作。',
  }),
  'sign-up-existing': (_m, ctx) => ({
    subject: '有人尝试使用你的邮箱注册 Kept',
    paragraphs: [
      '有人尝试使用此邮箱地址创建 Kept 账户，但该邮箱已注册过账户，因此未创建新账户。',
      '如果是你本人操作，请直接登录；如忘记密码，可在登录页重置密码。',
    ],
    action: { label: '前往登录', url: page(ctx, '/signin') },
    footnote: '如果这不是你本人操作，无需进行任何处理。',
  }),
  'security-notice': (m, ctx) => ZH_SECURITY[m.event](ctx),
  'backup-code-used': (m) => {
    const when = mailTime('zh-CN', m.at, m.timeZone);
    const device = deviceName(m, (browser, os) => `${os} 上的 ${browser}`);
    return {
      subject: '有人使用备用验证码登录了你的 Kept 账户',
      paragraphs: [
        device
          ? `${when}，有人通过 ${device} 使用备用验证码登录了你的 Kept 账户。`
          : `${when}，有人使用备用验证码登录了你的 Kept 账户。`,
        m.left === 0
          ? '这是你的最后一个备用验证码。请在「设置 → 登录与安全 → 生成新备用验证码」中重新生成。'
          : `你还剩余 ${m.left} 个备用验证码。`,
        '如果你是因为原身份验证器不可用而使用了备用验证码，请在「设置 → 登录与安全 → 重新配置」中绑定新应用，同时获取新的备用验证码。',
      ],
      footnote:
        '如果这不是你本人操作，请立即在登录页重置密码；随后前往「设置 → 登录与安全 → 生成新备用验证码」（旧验证码将立即作废），并在「设置 → 会话与设备 → 退出所有其他设备」中踢出其余会话。',
    };
  },
  'admin-action': (m) => ({
    ...ZH_ADMIN[m.action](m.locationName ?? ''),
    footnote: '这是一封关于你账户状态变更的系统通知邮件。',
  }),
  'owner-new-member': (m) => ({
    subject: `${m.memberName} 已加入「${m.locationName}」`,
    paragraphs: [
      m.managed
        ? `${m.memberName} 已作为托管账户添加至「${m.locationName}」，角色为${ZH_ROLE[m.role]}。`
        : `${m.memberName} 现可以${ZH_ROLE[m.role]}身份访问「${m.locationName}」。`,
    ],
    footnote:
      '作为地点所有者，每当有新成员加入时你都会收到此通知。你可在地点设置中调整权限或移除成员。',
  }),
  'ai-cap': (m, ctx) =>
    zhCap(
      m.level,
      m.cap,
      ctx,
      '你收到此邮件是因为该限额由你设置或适用于你的操作。每个限额周期每月最多发送一次。',
    ),
  'admin-alert': (m, ctx) => {
    const footnote =
      '你收到此邮件是因为你是此 Kept 的实例管理员。问题持续期间每天最多发送一次提醒。';
    if (m.alert === 'ai_instance_cap_warning' || m.alert === 'ai_instance_cap_reached') {
      const c = capFactsOf(m.details);
      if (c) return zhCap(m.alert === 'ai_instance_cap_warning' ? 80 : 100, c, ctx, footnote);
    }
    if (m.alert === 'ai_instance_key_rejected') {
      return {
        subject: 'Kept：实例 AI 密钥被拒绝',
        paragraphs: [
          `${String(m.details.provider ?? '服务商')} 拒绝了此服务器的 AI 密钥，使用该密钥计费的识别与问答任务目前处于排队等待状态。`,
          '请在管理员 AI 设置中更换有效密钥，保存后排队中的任务将自动继续执行。',
        ],
        action: { label: '打开 AI 设置', url: page(ctx, '/admin/ai') },
        footnote,
      };
    }
    if (m.alert === 'failed_jobs_rising') {
      return {
        subject: 'Kept：后台任务出现失败',
        paragraphs: [
          `过去一小时内有 ${num(m.details.failedLastHour)} 个后台任务执行失败。`,
          '可在失败任务列表中查看具体任务与失败原因，并选择重试或丢弃。',
        ],
        action: { label: '查看失败任务', url: page(ctx, '/admin/jobs') },
        footnote,
      };
    }
    if (m.alert === 'backup_failed') {
      return {
        subject: 'Kept：夜间自动备份失败',
        paragraphs: [
          `夜间备份未能完成：${String(m.details.error ?? '')}`,
          m.details.lastOk
            ? `最近一次成功备份完成于 ${day(m.details.lastOk)}。在下次备份成功前，此后新增的数据尚未进入备份库。`
            : '目前尚无任何成功备份记录，此 Kept 中的数据尚未得到备份保护。',
        ],
        action: { label: '打开状态页', url: page(ctx, '/admin/status') },
        footnote,
      };
    }
    if (m.alert === 'backup_stale') {
      return {
        subject: 'Kept：已超过 36 小时未完成备份',
        paragraphs: [
          m.details.lastOkAt
            ? `最近一次有效备份完成于 ${day(m.details.lastOkAt)}。Kept 默认每晚自动备份，说明夜间备份任务已停止正常运行。`
            : '已配置备份存储，但迄今尚未完成过任何备份。',
          '备份页面列出了每次运行记录与失败原因；如果后台 worker 进程未运行，请将其重启。',
        ],
        action: { label: '打开备份设置', url: page(ctx, '/admin/backups') },
        footnote,
      };
    }
    if (m.alert === 'disk_space_low') {
      const d = diskFacts(m.details);
      return {
        subject: d.backup ? 'Kept：备份磁盘空间即将耗尽' : 'Kept：数据磁盘空间即将耗尽',
        paragraphs: [
          `磁盘已使用 ${d.percent}%，仅剩 ${d.gb} GB 可用空间。`,
          d.backup
            ? '磁盘写满后夜间备份将会失败。请清理空间、扩容磁盘，或在备份设置中减少保留份数。'
            : '磁盘写满后 Kept 将无法保存新照片或文档，数据库也可能停止工作。请尽快清理空间或扩容磁盘。',
        ],
        action: { label: '打开状态页', url: page(ctx, '/admin/status') },
        footnote,
      };
    }
    if (m.alert === 'bucket_versioning_off') {
      return {
        subject: 'Kept：文件存储桶未开启版本控制',
        paragraphs: [
          'Kept 将附件保存在 S3 存储桶中，夜间备份不会重复打包桶内原文件。当前存储桶未开启版本控制，一旦文件被误删或被持有密钥的人覆盖，将无法恢复。',
          '请在对象存储服务商控制台中开启存储桶版本控制（Bucket Versioning）；下次备份检测到开启后本提醒将自动解除。',
        ],
        action: { label: '打开状态页', url: page(ctx, '/admin/status') },
        footnote,
      };
    }
    if (m.alert === 'restore_drill_due') {
      return {
        subject: 'Kept：建议执行备份恢复演练',
        paragraphs: [
          m.details.lastDrillAt
            ? `上次恢复演练执行于 ${day(m.details.lastDrillAt)}，距今已超过 30 天。`
            : '目前尚未执行过备份恢复演练。',
          '恢复演练会将最新备份还原至临时数据库并校验所有数据表，确保备份真正可用。请参照恢复指南运行 `kept admin backup drill`。',
        ],
        action: { label: '打开备份设置', url: page(ctx, '/admin/backups') },
        footnote,
      };
    }
    if (m.alert === 'backup_verify_failed') {
      return {
        subject: 'Kept：每周备份校验发现异常',
        paragraphs: [
          `备份仓库的每周完整性校验失败：${String(m.details.error ?? '')}`,
          '当前备份可能无法按原样恢复。请打开备份页面查看详情，并在修复后重新运行校验。',
        ],
        action: { label: '打开备份设置', url: page(ctx, '/admin/backups') },
        footnote,
      };
    }
    if (m.alert === 'backup_suspicious_size') {
      return {
        subject: 'Kept：最新备份体积异常偏小',
        paragraphs: [
          '最新一次备份比上一次有效备份小得多。Kept 已保留本次快照，同时暂停清理旧快照，以确保历史完好备份不被修剪。',
          '如果近期确实主动删除了大量数据，则无需担心，后续备份会自动解除此警告；否则请在执行任何恢复操作前排查原因。',
        ],
        action: { label: '打开备份设置', url: page(ctx, '/admin/backups') },
        footnote,
      };
    }
    if (m.alert === 'webhook_failing') {
      return {
        subject: 'Kept：某地点的 Webhook 持续投递失败',
        paragraphs: [
          `此 Kept 中某个地点配置的 Webhook 自 ${day(m.details.since)} 起每次投递均告失败，已被标记为异常。`,
          '新事件产生时 Kept 仍会继续尝试。该地点的所有者和管理员可在「地点设置 → Webhook」中查看并修复或删除它。',
        ],
        action: { label: '打开状态页', url: page(ctx, '/admin/status') },
        footnote,
      };
    }
    if (m.alert === 'reminders_not_scanned') {
      return {
        subject: 'Kept：到期提醒扫描已停止',
        paragraphs: [
          m.details.lastOkAt
            ? `Kept 上次检查到期提醒是在 ${day(m.details.lastOkAt)}（已超过 2 小时）。在恢复扫描前不会发送任何新提醒。`
            : 'Kept 尚未成功完成过到期提醒检查，因此目前无人会收到提醒。',
          '后台 worker 每 15 分钟执行一次扫描。请查看失败任务列表排查停摆原因；若后台 worker 未运行，请将其重启。',
        ],
        action: { label: '查看失败任务', url: page(ctx, '/admin/jobs') },
        footnote,
      };
    }
    if (m.alert === 'llm_default_partition') {
      return {
        subject: 'Kept：AI 调用日志分区需要处理',
        paragraphs: [
          `共有 ${num(m.details.rows)} 条 AI 调用记录（${day(m.details.oldest)} 至 ${day(m.details.newest)}）落入了默认分区而非月度分区。`,
          '在这些记录迁入对应月度分区之前，Kept 无法创建该月分区，夜间维护任务将持续报错。请由运维此 Kept 的管理员在数据库层迁移处理。',
        ],
        action: { label: '打开状态页', url: page(ctx, '/admin/status') },
        footnote,
      };
    }
    return {
      subject: 'Kept：审计日志分区需要处理',
      paragraphs: [
        `共有 ${num(m.details.rows)} 条审计事件（${day(m.details.oldest)} 至 ${day(m.details.newest)}）落入了默认分区而非月度分区。`,
        '在这些记录迁入对应月度分区之前，Kept 无法创建该月分区，夜间维护任务将持续报错。请由运维此 Kept 的管理员在数据库层迁移处理。',
      ],
      action: { label: '打开状态页', url: page(ctx, '/admin/status') },
      footnote,
    };
  },
};

export const ZH_CHROME: Chrome = {
  dir: 'ltr',
  linkFallback: '如果按钮无法点击，请将以下地址复制到浏览器中打开：',
  sentBy: (host) => `由位于 ${host} 的 Kept 发送。`,
  about: (site) => `Kept，开源自托管家庭物品清单系统：${site}`,
};
