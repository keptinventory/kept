// Vietnamese mail. Same shape as the English table in messages.ts; keep them in step.
import type { SecurityEvent } from '../auth/security.js';
import type { AdminAction, AiCapFacts } from './mailer.js';
import {
  aiPage,
  type Chrome,
  type CoreTable,
  capFactsOf,
  capitalise,
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

const VI_ROLE = { admin: 'quản trị viên', member: 'thành viên', viewer: 'người xem' } as const;

const VI_NOT_YOU = 'Nếu đây không phải là bạn, hãy đặt lại mật khẩu ngay từ trang đăng nhập.';

const VI_SECURITY: Record<SecurityEvent, (ctx: MessageContext) => Message> = {
  'passkey-added': () => ({
    subject: 'Một khóa truy cập đã được thêm vào tài khoản Kept của bạn',
    paragraphs: [
      'Một khóa truy cập mới đã được thêm vào tài khoản Kept của bạn, và mọi thiết bị khác đã được đăng xuất.',
    ],
    footnote:
      'Nếu điều này không do bạn, hãy đặt lại mật khẩu của bạn ngay bây giờ và xóa khóa truy cập trong Cài đặt → Đăng nhập và bảo mật.',
  }),
  'two-factor-disabled': () => ({
    subject: 'Xác thực hai yếu tố đã được tắt',
    paragraphs: [
      'Xác thực hai yếu tố đã được tắt cho tài khoản Kept của bạn, và mọi thiết bị khác đã được đăng xuất.',
    ],
    footnote:
      'Nếu điều này không do bạn, hãy đặt lại mật khẩu của bạn ngay bây giờ và bật lại xác thực hai yếu tố.',
  }),
  'passkey-removed': () => ({
    subject: 'Một khóa truy cập đã được xóa khỏi tài khoản Kept của bạn',
    paragraphs: [
      'Một khóa truy cập đã được xóa khỏi tài khoản Kept của bạn, và mọi thiết bị khác đã được đăng xuất. Khóa này không còn dùng để đăng nhập được nữa.',
    ],
    footnote: VI_NOT_YOU,
  }),
  'two-factor-enabled': () => ({
    subject: 'Xác thực hai yếu tố đã được bật',
    paragraphs: [
      'Xác thực hai yếu tố đã được bật cho tài khoản Kept của bạn, và mọi thiết bị khác đã được đăng xuất. Việc đăng nhập bây giờ yêu cầu mã từ ứng dụng xác thực của bạn.',
    ],
    footnote:
      'Nếu điều này không do bạn, hãy đặt lại mật khẩu của bạn ngay bây giờ và kiểm tra Cài đặt → Đăng nhập và bảo mật.',
  }),
  'two-factor-replaced': () => ({
    subject: 'Xác thực hai yếu tố đã được thiết lập lại',
    paragraphs: [
      'Xác thực hai yếu tố cho tài khoản Kept của bạn đã được thiết lập lại với một ứng dụng xác thực mới, và mọi thiết bị khác đã được đăng xuất. Mã của ứng dụng cũ và mã sao lưu cũ không còn hoạt động.',
    ],
    footnote:
      'Nếu điều này không do bạn, hãy đặt lại mật khẩu của bạn ngay bây giờ và kiểm tra Cài đặt → Đăng nhập và bảo mật.',
  }),
  'backup-codes-new': () => ({
    subject: 'Mã sao lưu mới đã được tạo cho tài khoản Kept của bạn',
    paragraphs: [
      'Mã sao lưu xác thực hai yếu tố mới đã được tạo cho tài khoản Kept của bạn, và mọi thiết bị khác đã được đăng xuất. Mã sao lưu cũ không còn hoạt động.',
    ],
    footnote: VI_NOT_YOU,
  }),
  'sign-in-unlinked': () => ({
    subject: 'Một phương thức đăng nhập đã được hủy liên kết khỏi tài khoản Kept của bạn',
    paragraphs: [
      'Một phương thức đăng nhập bên ngoài (như Google) đã được hủy liên kết khỏi tài khoản Kept của bạn, và mọi thiết bị khác đã được đăng xuất. Bạn không thể đăng nhập bằng phương thức đó nữa.',
    ],
    footnote: VI_NOT_YOU,
  }),
  'password-changed': () => ({
    subject: 'Mật khẩu Kept của bạn đã được thay đổi',
    paragraphs: [
      'Mật khẩu tài khoản Kept của bạn đã được thay đổi, và mọi thiết bị khác đã được đăng xuất.',
    ],
    footnote: VI_NOT_YOU,
  }),
  'unverified-account-reset': () => ({
    subject: 'Địa chỉ email của bạn đã được xác nhận',
    paragraphs: [
      'Mật khẩu Kept của bạn đã được đặt lại từ hộp thư này, xác nhận rằng địa chỉ email tài khoản là của bạn.',
      'Trước đây địa chỉ này chưa được xác nhận, nên trong trường hợp ai đó khác thiết lập tài khoản, mọi khóa truy cập, cài đặt xác thực hai yếu tố và thiết bị đã đăng nhập được thêm trước thời điểm này đều đã bị xóa.',
    ],
    footnote:
      'Đăng nhập với mật khẩu mới của bạn, và thiết lập lại xác thực hai yếu tố nếu bạn dùng. Nếu không phải bạn đã đặt lại mật khẩu, hãy đặt lại lần nữa ngay bây giờ.',
  }),
  'unverified-account-link': () => ({
    subject: 'Địa chỉ email của bạn đã được xác nhận',
    paragraphs: [
      'Bạn đã đăng nhập Kept qua một liên kết gửi đến hộp thư này, xác nhận rằng địa chỉ email tài khoản là của bạn.',
      'Địa chỉ này chưa được xác nhận trước đây, nên nếu có người khác thiết lập tài khoản, mật khẩu, các khóa truy cập, cài đặt xác thực hai yếu tố của tài khoản và mọi thiết bị đã đăng nhập khác đều đã bị xóa.',
    ],
    footnote:
      'Chọn một mật khẩu mới, và thiết lập lại xác thực hai yếu tố nếu bạn dùng, trong cài đặt tài khoản của bạn.',
  }),
};

const VI_ADMIN: Record<AdminAction, (locationName: string) => Message> = {
  disabled: () => ({
    subject: 'Tài khoản Kept của bạn đã bị tắt',
    paragraphs: [
      'Một quản trị viên của Kept này đã tắt tài khoản của bạn. Bạn không thể đăng nhập cho đến khi tài khoản được bật lại.',
    ],
  }),
  enabled: () => ({
    subject: 'Tài khoản Kept của bạn đã được bật lại',
    paragraphs: ['Một quản trị viên đã bật lại tài khoản của bạn. Bạn có thể đăng nhập như trước.'],
  }),
  'two-factor-reset': () => ({
    subject: 'Xác thực hai yếu tố trên tài khoản của bạn đã được đặt lại',
    paragraphs: [
      'Một quản trị viên đã loại bỏ xác thực hai yếu tố khỏi tài khoản của bạn và đăng xuất tài khoản đó ở mọi nơi, thường là vì bạn mất ứng dụng xác thực.',
      'Hãy thiết lập lại xác thực hai yếu tố trong cài đặt tài khoản.',
    ],
  }),
  'signed-out-everywhere': () => ({
    subject: 'Bạn đã bị đăng xuất khỏi Kept ở mọi nơi',
    paragraphs: [
      'Một quản trị viên đã đăng xuất tài khoản của bạn trên mọi thiết bị. Hãy đăng nhập lại để tiếp tục.',
    ],
  }),
  'instance-admin-granted': () => ({
    subject: 'Bạn hiện là quản trị viên máy chủ của Kept này',
    paragraphs: [
      'Bạn đã được cấp quyền quản trị viên máy chủ: bạn có thể quản lý người dùng và cài đặt của Kept này.',
    ],
  }),
  'instance-admin-revoked': () => ({
    subject: 'Bạn không còn là quản trị viên máy chủ của Kept này',
    paragraphs: [
      'Quyền quản trị viên máy chủ của bạn đã bị xóa. Các địa điểm của bạn và mọi thứ bên trong chúng vẫn không thay đổi.',
    ],
  }),
  'password-reset-issued': () => ({
    subject: 'Một lần đặt lại mật khẩu đã được cấp cho tài khoản của bạn',
    paragraphs: [
      'Người quản lý Kept này đã cấp một lần đặt lại mật khẩu dùng một lần cho tài khoản của bạn và đăng xuất tài khoản đó ở mọi nơi.',
      'Họ sẽ cung cấp mã cho bạn để chọn một mật khẩu mới.',
    ],
  }),
  'location-ownership-received': (name) => ({
    subject: `Bây giờ bạn là chủ sở hữu của ${name}`,
    paragraphs: [`Người quản lý Kept này đã đặt bạn làm chủ sở hữu của ${name}.`],
  }),
  'location-ownership-moved': (name) => ({
    subject: `${name} có chủ sở hữu mới`,
    paragraphs: [
      `Người quản lý Kept này đã chuyển ${name} cho một chủ sở hữu mới. Bạn vẫn ở trong đó với tư cách quản trị viên.`,
    ],
  }),
  'token-created': () => ({
    subject: 'Một token đã được tạo cho tài khoản của bạn',
    paragraphs: [
      'Người quản lý Kept này đã tạo một token cá nhân cho tài khoản của bạn trên máy chủ, cho một ứng dụng như Home Assistant hoặc một trợ lý AI. Token này có thể làm những gì bạn có thể làm, tại các địa điểm mà nó được tạo cho.',
      'Nếu bạn không yêu cầu, hãy thu hồi nó trong Cài đặt → Kết nối.',
    ],
  }),
};

// AI caps (D206): the cap in words, and how much of it is used.
function viCapOf(c: AiCapFacts): string {
  switch (c.scope) {
    case 'location':
      return `giới hạn AI của ${c.target}`;
    case 'member':
      return c.target ? `giới hạn AI của ${c.target}` : 'giới hạn AI của một người';
    case 'account':
      return 'giới hạn AI của tài khoản của bạn';
    case 'user':
      return 'giới hạn AI cá nhân của bạn';
    case 'instance':
      return 'giới hạn AI của máy chủ này';
    case 'instance_account':
      return c.target
        ? `hạn mức của ${c.target} trên khóa AI của máy chủ này`
        : 'hạn mức trên khóa AI của máy chủ này';
  }
}
const viUsed = (c: AiCapFacts) =>
  c.unit === 'money'
    ? `${c.currency} ${c.used} trên ${c.currency} ${c.limit}`
    : `${tokens('vi', c.used)} trên ${tokens('vi', c.limit)} token`;

function viCap(level: 80 | 100, c: AiCapFacts, ctx: MessageContext, footnote: string): Message {
  const cap = viCapOf(c);
  if (level === 80) {
    return {
      subject: `Kept: đã dùng 80% ${cap} trong tháng này`,
      paragraphs: [
        `${capitalise(cap)}: đã dùng ${viUsed(c)} trong tháng này.`,
        'Khi đạt giới hạn, AI tạm dừng đến ngày 1 tháng sau. Ảnh chụp vẫn được lưu, và ảnh sẽ được đọc khi AI tiếp tục.',
      ],
      action: { label: 'Mở cài đặt AI', url: aiPage(ctx, c.scope) },
      footnote,
    };
  }
  return {
    subject: `Kept: AI tạm dừng đến ${day(c.pausedUntil)}`,
    paragraphs: [
      `${capitalise(cap)} đã đạt mức: ${viUsed(c)} trong tháng này.`,
      `AI tạm dừng đến ${day(c.pausedUntil)}. Ảnh chụp vẫn được lưu, và ảnh sẽ được đọc khi AI tiếp tục. Để tiếp tục sớm hơn, hãy tăng hoặc bỏ giới hạn.`,
    ],
    action: { label: 'Tiếp tục ngay', url: aiPage(ctx, c.scope) },
    footnote,
  };
}

export const VI: CoreTable = {
  'magic-link': (m) => ({
    subject: 'Liên kết đăng nhập vào Kept của bạn',
    paragraphs: [
      'Sử dụng liên kết này để đăng nhập vào Kept. Nó chỉ hoạt động một lần, trong vòng 15 phút tới.',
    ],
    action: { label: 'Đăng nhập', url: m.url },
    footnote:
      'Nếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này. Không ai có thể đăng nhập nếu không có liên kết.',
  }),
  'password-reset': (m) => ({
    subject: 'Đặt lại mật khẩu Kept của bạn',
    paragraphs: [
      'Đã có ai đó yêu cầu đặt lại mật khẩu tài khoản Kept này. Sử dụng liên kết này để chọn mật khẩu mới. Nó chỉ hoạt động một lần, trong vòng 1 giờ tới.',
    ],
    action: { label: 'Chọn mật khẩu mới', url: m.url },
    footnote: 'Nếu đây không phải là bạn, hãy bỏ qua email này: mật khẩu của bạn vẫn giữ nguyên.',
  }),
  'email-change-confirm': (m) => ({
    subject: 'Xác nhận địa chỉ email mới',
    paragraphs: [
      `Một người đã đăng nhập vào tài khoản Kept của bạn yêu cầu chuyển sang địa chỉ ${m.newEmail}. Nếu đó là bạn, hãy xác nhận qua liên kết này trong vòng 1 giờ tới.`,
    ],
    action: { label: 'Xác nhận thay đổi', url: m.url },
    footnote:
      'Nếu đó không phải là bạn, đừng dùng liên kết: tài khoản của bạn vẫn ở địa chỉ này. Bạn có thể muốn đổi mật khẩu.',
  }),
  'email-change-verify': (m) => ({
    subject: 'Xác nhận địa chỉ email cho Kept',
    paragraphs: ['Sử dụng liên kết này để hoàn tất việc chuyển tài khoản Kept đến địa chỉ này.'],
    action: { label: 'Xác nhận địa chỉ này', url: m.url },
    footnote:
      'Nếu bạn không mong đợi điều này, hãy bỏ qua: không có gì thay đổi cho đến khi liên kết được sử dụng.',
  }),
  'email-changed': (m) => ({
    subject: 'Địa chỉ email của tài khoản Kept đã được thay đổi',
    paragraphs: [
      `Tài khoản Kept của bạn hiện dùng ${m.newEmail}. Địa chỉ này không còn nhận thư từ tài khoản Kept nữa.`,
    ],
    footnote: 'Nếu bạn không thực hiện thay đổi này, hãy liên hệ với người quản lý Kept này.',
  }),
  'account-deletion': (m) => {
    const day = mailDay('vi', m.purgeAfter, m.timezone);
    return {
      subject: `Tài khoản Kept của bạn sẽ bị xóa vào ngày ${day}`,
      paragraphs: [
        `Bạn đã yêu cầu xóa tài khoản Kept của mình. Tài khoản sẽ bị xóa vào ngày ${day}, bao gồm cả địa điểm Cá nhân của bạn và mọi thứ bên trong đó.`,
        'Cho đến thời điểm đó, việc đăng nhập hiển thị ngày đó và cho phép bạn giữ lại tài khoản. Những gì bạn thêm vào địa điểm của người khác vẫn còn ở đó.',
      ],
      footnote:
        'Nếu bạn không yêu cầu điều này, hãy đăng nhập ngay bây giờ, chọn Giữ tài khoản của tôi, và thay đổi mật khẩu.',
    };
  },
  'report-ready': (m) => {
    const name = {
      inventory: 'Kiểm kê',
      insurance: 'Báo cáo bảo hiểm',
      vehicle_history: 'Lịch sử xe',
    }[m.report];
    return {
      subject: m.place ? `${name}: ${m.place}` : name,
      paragraphs: [
        m.attached
          ? 'Kept đã tạo báo cáo bạn yêu cầu. Báo cáo được đính kèm dưới dạng PDF.'
          : 'Kept đã tạo báo cáo bạn yêu cầu, nhưng dung lượng quá lớn để đính kèm. Hãy in lại từ Kept để tải xuống.',
      ],
      footnote:
        'Các báo cáo theo lịch trình được liệt kê trong Cài đặt → Tôi → Thông báo, nơi bạn có thể dừng chúng.',
    };
  },
  invite: (m) => ({
    subject: m.inviterName
      ? `${m.inviterName} đã mời bạn đến ${m.locationName} trên Kept`
      : `Bạn được mời đến ${m.locationName} trên Kept`,
    paragraphs: [
      m.inviterName
        ? `${m.inviterName} đã mời bạn tham gia ${m.locationName} với tư cách ${VI_ROLE[m.role]}.`
        : `Bạn được mời tham gia ${m.locationName} với tư cách ${VI_ROLE[m.role]}.`,
      'Kept theo dõi các đồ vật bạn sở hữu, chúng ở đâu, và những gì sắp đến hạn cho chúng.',
    ],
    action: { label: 'Chấp nhận lời mời', url: m.url },
    footnote:
      'Nếu bạn không mong đợi điều này, hãy bỏ qua: không có gì xảy ra trừ khi bạn chấp nhận.',
  }),
  'sign-up-existing': (_m, ctx) => ({
    subject: 'Ai đó đã thử đăng ký với địa chỉ email của bạn',
    paragraphs: [
      'Ai đó đã thử tạo tài khoản Kept với địa chỉ này, nhưng địa chỉ này đã có tài khoản. Không có tài khoản mới nào được tạo.',
      'Nếu đó là bạn, hãy đăng nhập. Nếu bạn quên mật khẩu, bạn có thể đặt lại từ trang đăng nhập.',
    ],
    action: { label: 'Đăng nhập', url: page(ctx, '/signin') },
    footnote: 'Nếu đó không phải bạn, bạn không cần làm gì.',
  }),
  'security-notice': (m, ctx) => VI_SECURITY[m.event](ctx),
  'backup-code-used': (m) => {
    const when = mailTime('vi', m.at, m.timeZone);
    const device = deviceName(m, (browser, os) => `${browser} trên ${os}`);
    return {
      subject: 'Một mã sao lưu đã được dùng để đăng nhập vào tài khoản Kept của bạn',
      paragraphs: [
        device
          ? `Một mã sao lưu đã được dùng để đăng nhập vào tài khoản Kept của bạn vào ${when}, từ ${device}.`
          : `Một mã sao lưu đã được dùng để đăng nhập vào tài khoản Kept của bạn vào ${when}.`,
        m.left === 0
          ? 'Đó là mã sao lưu cuối cùng của bạn. Hãy tạo mã mới trong Cài đặt → Đăng nhập và bảo mật → Mã dự phòng mới.'
          : `Bạn còn ${m.left} mã sao lưu.`,
        'Nếu bạn dùng mã này vì không còn ứng dụng xác thực, hãy thiết lập lại xác thực hai yếu tố với một ứng dụng mới trong Cài đặt → Đăng nhập và bảo mật → Thiết lập lại. Bạn cũng sẽ nhận được mã sao lưu mới.',
      ],
      footnote:
        'Nếu đây không phải là bạn, hãy đặt lại mật khẩu ngay từ trang đăng nhập. Sau đó tạo mã sao lưu mới trong Cài đặt → Đăng nhập và bảo mật → Mã dự phòng mới (mã cũ sẽ ngừng hoạt động), và đăng xuất các thiết bị khác trong Cài đặt → Phiên và thiết bị → Đăng xuất khỏi tất cả thiết bị khác.',
    };
  },
  'admin-action': (m) => ({
    ...VI_ADMIN[m.action](m.locationName ?? ''),
    footnote: 'Đây là thông báo tự động về tài khoản của bạn.',
  }),
  'owner-new-member': (m) => ({
    subject: `${m.memberName} đã tham gia ${m.locationName}`,
    paragraphs: [
      m.managed
        ? `${m.memberName} đã được thêm vào ${m.locationName} dưới dạng tài khoản được quản lý, với vai trò là ${VI_ROLE[m.role]}.`
        : `${m.memberName} hiện có quyền truy cập vào ${m.locationName} với tư cách là ${VI_ROLE[m.role]}.`,
    ],
    footnote:
      'Bạn nhận được thông báo này với tư cách là chủ sở hữu, đối với mỗi thành viên mới. Bạn có thể thay đổi hoặc xóa thành viên trong cài đặt của địa điểm.',
  }),
  'ai-cap': (m, ctx) =>
    viCap(
      m.level,
      m.cap,
      ctx,
      'Bạn nhận được thông báo này vì bạn đặt giới hạn này hoặc nó áp dụng cho công việc của bạn. Thông báo này được gửi một lần mỗi tháng.',
    ),
  'admin-alert': (m, ctx) => {
    const footnote =
      'Bạn nhận được thông báo này vì bạn là quản trị viên của Kept này. Thông báo này được gửi tối đa một lần mỗi ngày trong khi vấn đề vẫn tồn tại.';
    if (m.alert === 'ai_instance_cap_warning' || m.alert === 'ai_instance_cap_reached') {
      const c = capFactsOf(m.details);
      if (c) return viCap(m.alert === 'ai_instance_cap_warning' ? 80 : 100, c, ctx, footnote);
    }
    if (m.alert === 'ai_instance_key_rejected') {
      return {
        subject: 'Kept: khóa AI của máy chủ bị từ chối',
        paragraphs: [
          `${String(m.details.provider ?? 'Nhà cung cấp')} đã từ chối khóa AI của máy chủ này, vì vậy công việc AI do khóa này trả phí đang chờ xử lý.`,
          'Thay thế khóa trong cài đặt AI của quản trị viên. Công việc đang chờ sẽ tiếp tục khi khóa mới được lưu.',
        ],
        action: { label: 'Mở cài đặt AI', url: page(ctx, '/admin/ai') },
        footnote,
      };
    }
    if (m.alert === 'failed_jobs_rising') {
      return {
        subject: 'Kept: công việc nền đang thất bại',
        paragraphs: [
          `${num(m.details.failedLastHour)} công việc nền đã thất bại trong giờ vừa qua.`,
          'Danh sách công việc thất bại cho biết công việc nào đã thất bại và tại sao; từ đó bạn có thể thử lại hoặc hủy bỏ chúng.',
        ],
        action: { label: 'Mở công việc thất bại', url: page(ctx, '/admin/jobs') },
        footnote,
      };
    }
    if (m.alert === 'backup_failed') {
      return {
        subject: 'Kept: sao lưu hàng đêm đã thất bại',
        paragraphs: [
          `Sao lưu hàng đêm chưa hoàn thành: ${String(m.details.error ?? '')}`,
          m.details.lastOk
            ? `Lần sao lưu thành công gần nhất hoàn thành vào ${day(m.details.lastOk)}. Cho đến khi có lần sao lưu thành công tiếp theo, mọi dữ liệu được ghi từ lúc đó đều chưa có trong bản sao lưu.`
            : 'Chưa có lần sao lưu nào thành công, vì vậy không có dữ liệu nào trong Kept này được sao lưu.',
        ],
        action: { label: 'Mở trang trạng thái', url: page(ctx, '/admin/status') },
        footnote,
      };
    }
    if (m.alert === 'backup_stale') {
      return {
        subject: 'Kept: không có bản sao lưu trong hơn 36 giờ',
        paragraphs: [
          m.details.lastOkAt
            ? `Bản sao lưu tốt gần nhất hoàn thành vào ${day(m.details.lastOkAt)}. Kept sao lưu mỗi đêm, nên việc sao lưu hàng đêm đã ngừng hoạt động.`
            : 'Các bản sao lưu đã được cài đặt, nhưng chưa có bản nào hoàn thành.',
          'Trang sao lưu liệt kê mỗi lần chạy và lý do thất bại. Nếu tiến trình nền của Kept không chạy, hãy khởi động lại nó.',
        ],
        action: { label: 'Mở sao lưu', url: page(ctx, '/admin/backups') },
        footnote,
      };
    }
    if (m.alert === 'disk_space_low') {
      const d = diskFacts(m.details, true);
      return {
        subject: d.backup ? 'Kept: ổ đĩa sao lưu gần đầy' : 'Kept: ổ đĩa dữ liệu gần đầy',
        paragraphs: [
          `Ổ đĩa đã đầy ${d.percent}%, còn lại ${d.gb} GB.`,
          d.backup
            ? 'Khi đầy, việc sao lưu hàng đêm sẽ thất bại. Hãy giải phóng dung lượng, dùng ổ đĩa lớn hơn, hoặc giữ ít bản sao lưu hơn trong cài đặt sao lưu.'
            : 'Khi đầy, Kept không thể lưu ảnh hoặc tài liệu mới, và cơ sở dữ liệu có thể ngừng hoạt động. Hãy giải phóng dung lượng hoặc dùng ổ đĩa lớn hơn.',
        ],
        action: { label: 'Mở trang trạng thái', url: page(ctx, '/admin/status') },
        footnote,
      };
    }
    if (m.alert === 'bucket_versioning_off') {
      return {
        subject: 'Kept: lập phiên bản đang tắt trên bucket tệp',
        paragraphs: [
          'Kept giữ các tệp trong một bucket S3, và bản sao lưu hàng đêm để chúng ở đó. Lập phiên bản đang tắt trên bucket đó, nên một tệp bị xóa hoặc ghi đè do nhầm lẫn, hoặc bởi người có khóa của nó, sẽ không thể khôi phục.',
          'Hãy bật lập phiên bản cho bucket tại nhà cung cấp lưu trữ của bạn. Cảnh báo này sẽ dừng khi lần sao lưu tiếp theo thấy nó đã bật.',
        ],
        action: { label: 'Mở trang trạng thái', url: page(ctx, '/admin/status') },
        footnote,
      };
    }
    if (m.alert === 'restore_drill_due') {
      return {
        subject: 'Kept: đã đến lúc diễn tập khôi phục',
        paragraphs: [
          m.details.lastDrillAt
            ? `Diễn tập khôi phục gần nhất là vào ${day(m.details.lastDrillAt)}, hơn 30 ngày trước.`
            : 'Chưa có diễn tập khôi phục nào được thực hiện.',
          'Một lần diễn tập sẽ khôi phục bản sao lưu mới nhất vào cơ sở dữ liệu tạm và kiểm tra mọi bảng, để bạn biết bản sao lưu thực sự có thể khôi phục được. Chạy `kept admin backup drill` như hướng dẫn khôi phục đã chỉ.',
        ],
        action: { label: 'Mở sao lưu', url: page(ctx, '/admin/backups') },
        footnote,
      };
    }
    if (m.alert === 'backup_verify_failed') {
      return {
        subject: 'Kept: lượt kiểm tra bản sao lưu hàng tuần phát hiện sự cố',
        paragraphs: [
          `Lượt kiểm tra hàng tuần của kho bản sao lưu thất bại: ${String(m.details.error ?? '')}`,
          'Bản sao lưu của bạn có thể không khôi phục được ở trạng thái hiện tại. Hãy mở Sao lưu để xem lượt kiểm tra phát hiện gì, và kiểm tra lại sau khi đã sửa.',
        ],
        action: { label: 'Mở sao lưu', url: page(ctx, '/admin/backups') },
        footnote,
      };
    }
    if (m.alert === 'backup_suspicious_size') {
      return {
        subject: 'Kept: bản sao lưu mới nhất trông quá nhỏ',
        paragraphs: [
          'Bản sao lưu mới nhất nhỏ hơn nhiều so với bản tốt gần nhất. Kept đã giữ nó, nhưng không xóa bản sao lưu cũ nào, nên các bản tốt vẫn còn.',
          'Nếu nhiều thứ bị xóa có chủ đích, thì không có vấn đề gì và các bản sao lưu tiếp theo sẽ xóa cảnh báo này. Nếu không, hãy tìm hiểu xem điều gì đã thay đổi trước khi khôi phục bất cứ thứ gì.',
        ],
        action: { label: 'Mở sao lưu', url: page(ctx, '/admin/backups') },
        footnote,
      };
    }
    if (m.alert === 'webhook_failing') {
      return {
        subject: 'Kept: webhook của một địa điểm vẫn bị lỗi',
        paragraphs: [
          `Một webhook được thiết lập tại một địa điểm của Kept này đã thất bại ở mọi lần gửi kể từ ${day(m.details.since)}, nên Kept đã đánh dấu nó là bị lỗi.`,
          'Kept vẫn cố gắng gửi lại mỗi khi có sự kiện mới. Chủ sở hữu và quản trị viên của địa điểm thấy nó và có thể sửa hoặc xóa nó, trong Cài đặt địa điểm → Webhook.',
        ],
        action: { label: 'Mở trang trạng thái', url: page(ctx, '/admin/status') },
        footnote,
      };
    }
    if (m.alert === 'reminders_not_scanned') {
      return {
        subject: 'Kept: các lời nhắc đã ngừng gửi',
        paragraphs: [
          m.details.lastOkAt
            ? `Kept lần cuối kiểm tra lời nhắc đến hạn vào ${day(m.details.lastOkAt)}, hơn 2 giờ trước. Cho đến khi Kept kiểm tra lại, không ai nhận được lời nhắc mới.`
            : 'Kept chưa hoàn thành một lần kiểm tra nào cho lời nhắc đến hạn, nên không ai nhận được lời nhắc.',
          'Việc kiểm tra chạy mỗi 15 phút trong tiến trình nền của Kept. Danh sách công việc thất bại cho thấy lý do nó dừng lại; nếu tiến trình nền không chạy, hãy khởi động lại nó.',
        ],
        action: { label: 'Mở công việc thất bại', url: page(ctx, '/admin/jobs') },
        footnote,
      };
    }
    if (m.alert === 'llm_default_partition') {
      return {
        subject: 'Kept: các bản ghi cuộc gọi AI cần được chú ý',
        paragraphs: [
          `${num(m.details.rows)} bản ghi cuộc gọi AI (từ ${day(m.details.oldest)} đến ${day(m.details.newest)}) đã được lưu ngoài phân vùng hàng tháng của chúng.`,
          'Kept không thể tạo phân vùng của tháng đó cho đến khi chúng được chuyển vào nó, nên công việc bảo trì AI hàng đêm sẽ tiếp tục bị lỗi. Việc chuyển chúng là một tác vụ cơ sở dữ liệu cho người quản lý Kept này.',
        ],
        action: { label: 'Mở trang trạng thái', url: page(ctx, '/admin/status') },
        footnote,
      };
    }
    return {
      subject: 'Kept: các sự kiện kiểm toán cần được chú ý',
      paragraphs: [
        `${num(m.details.rows)} sự kiện kiểm toán (từ ${day(m.details.oldest)} đến ${day(m.details.newest)}) đã được lưu ngoài phân vùng hàng tháng.`,
        'Kept không thể tạo phân vùng tháng đó cho đến khi chúng được chuyển vào đó, vì vậy công việc bảo trì hàng đêm sẽ tiếp tục thất bại. Việc chuyển chúng là một tác vụ cơ sở dữ liệu cho người quản lý Kept này.',
      ],
      action: { label: 'Mở trang trạng thái', url: page(ctx, '/admin/status') },
      footnote,
    };
  },
};

export const VI_CHROME: Chrome = {
  dir: 'ltr',
  linkFallback: 'Nếu nút không hoạt động, sao chép địa chỉ này vào trình duyệt của bạn:',
  sentBy: (host) => `Được gửi bởi Kept tại ${host}.`,
  about: (site) => `Kept, phần mềm kiểm kê đồ đạc gia đình mã nguồn mở: ${site}`,
};
