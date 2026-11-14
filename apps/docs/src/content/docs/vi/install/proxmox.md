---
title: Cài đặt trên Proxmox VE
description: Một lệnh trong shell của máy chủ Proxmox VE tạo một container Debian 13 không đặc quyền có Kept bên trong, không cần Docker.
sidebar:
  order: 2
  label: Proxmox VE
---

:::caution[Chưa được thử trên máy chủ Proxmox VE thật]
Các script được kiểm tra ở mỗi thay đổi: shellcheck, rồi cài đặt, một lần cập nhật và một lần quay
lại trên một Debian 13 sạch có systemd, và script máy chủ chạy với các công cụ thay thế cho công cụ
của Proxmox. Chúng chưa chạy trên một máy chủ Proxmox VE thật. Viết cho Proxmox VE 8 và 9 trên
amd64; máy chủ arm64 chưa được thử. Hãy coi lần cài đầu tiên là một lần thử.
:::

Kept chạy trong container Debian 13 không đặc quyền của riêng nó, không cần Docker, như Proxmox
khuyên: PostgreSQL, Node và Kept dưới systemd. Bản sao lưu của Proxmox bao gồm nó, và không có gì
khác trên máy chủ thay đổi.

## Cài đặt

Trong shell của máy chủ Proxmox VE, với quyền root:

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

- **Default:** chỉ hỏi xác nhận, với các thiết lập bên dưới.
- **Advanced:** hỏi từng thiết lập: ID, tên, CPU, bộ nhớ, ổ đĩa, kho lưu trữ, bridge, một địa chỉ
  cố định kèm gateway, một VLAN, DNS, một khóa SSH, mật khẩu root, múi giờ.
- **Màn hình xác nhận** hiển thị từng thiết lập và đúng lệnh `pct create` trước khi tạo bất cứ thứ
  gì.

Trước tiên nó kiểm tra máy chủ (root, Proxmox VE 8 hoặc 9, bridge, một kho lưu trữ còn chỗ, DNS),
tải template Debian 13 nếu chưa có, tạo container, cài Kept vào và in địa chỉ. Nếu có gì thất bại,
nó nói rõ điều gì và xóa container chưa hoàn tất.

### Đọc trước

Tải script và `SHA256SUMS` của bản phát hành, kiểm tra, đọc, rồi chạy:

```sh
curl -fsSLO https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh
curl -fsSLO https://github.com/keptinventory/kept/releases/download/v1.14.7/SHA256SUMS
sha256sum -c --ignore-missing SHA256SUMS && bash kept.sh
```

`SHA256SUMS` chứa SHA-256 của `kept.sh`, `kept-install.sh` (phần chạy trong container) và các tệp
nén của bản phát hành. Nó được ký bằng khóa phát hành: `kept.sh` và `kept-install.sh` kiểm tra chữ
ký đó bằng openssl trước khi dùng bất cứ thứ gì từ bản phát hành. Để tự kiểm tra, tải
`SHA256SUMS.sigstore.json` từ cùng bản phát hành và xem
[xác minh bản phát hành](/vi/admin/verify-release/):

```sh
cosign verify-blob --key cosign.pub --bundle SHA256SUMS.sigstore.json SHA256SUMS
```

## Những gì nó tạo

- **Container:** Debian 13 không đặc quyền, `nesting=1` (systemd của Debian 13 cần nó), khởi động
  cùng máy chủ, gắn thẻ `kept`.
- **Bên trong:** PostgreSQL 18 với pgvector (từ kho của PostgreSQL), Node 24 (từ nodejs.org),
  restic và tệp nén phát hành của Kept, mỗi thứ đều được ghim phiên bản và kiểm tra.
- **Dịch vụ:** `kept-bootstrap` (cơ sở dữ liệu và các tài khoản đăng nhập của nó, mỗi lần khởi
  động) và `kept` (các bản di chuyển, rồi Kept ở cổng 8080 với người dùng `kept`).
- **Tệp:** Kept ở `/opt/kept`, thiết lập ở `/etc/kept/kept.env`, khóa ở `/etc/kept/config`, ảnh và
  tài liệu ở `/var/lib/kept`, địa chỉ và mã thiết lập ở `/root/kept.creds`.

Không telemetry, không bộ hẹn giờ, không tự động cập nhật, không thay đổi gì trên máy chủ ngoài
container.

## Giá trị mặc định

| Thiết lập | Mặc định | Đặt trước bằng |
|---|---|---|
| CPU | 2 nhân | `var_cpu` |
| Bộ nhớ | 2048 MB, swap 512 MB | `var_ram`, `var_swap` |
| Ổ đĩa | 8 GB | `var_disk` |
| Kho lưu trữ | kho đầu tiên chứa được container | `var_storage` |
| Mạng | DHCP trên `vmbr0` | `var_bridge`, `var_ip`, `var_gateway`, `var_vlan`, `var_dns` |
| ID, tên | ID trống kế tiếp, `kept` | `var_ctid`, `var_hostname` |
| Múi giờ | của máy chủ | `var_timezone` |
| Khóa SSH | không có | `var_ssh_key` (một tệp khóa công khai trên máy chủ) |

Kept đã được thử với 1 GB ([những gì nó cần](/vi/install/hardware/)); 2 GB để dư chỗ cho nhập dữ
liệu và sao lưu. Ảnh chiếm phần lớn ổ đĩa.

Mọi giá trị đều đặt trước được, và `var_unattended=yes` chạy mà không hỏi:

```sh
var_unattended=yes var_ram=4096 var_ip=192.0.2.50/24 var_gateway=192.0.2.1 \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/keptinventory/kept/v1.14.7/deploy/proxmox/kept.sh)"
```

## Lần chạy đầu

1. Mở địa chỉ được in ra, `http://<address>:8080`. Kept hiển thị **Nhập mã thiết lập**.
2. Mã nằm trong container: `pct exec <CTID> -- cat /root/kept.creds`. Nhập mã, rồi
   **Tạo tài khoản đầu tiên**: tài khoản này trở thành quản trị viên của phiên bản.
3. Cất các khóa ở nơi khác ngoài máy chủ này: `pct exec <CTID> -- kept admin recovery-kit` in bộ
   khôi phục.

Nhãn in ra mang địa chỉ. Hãy cho container một địa chỉ cố định (đặt trước DHCP trong router, hoặc
`var_ip`) trước khi in. Để đổi sau này, đặt `KEPT_PUBLIC_URL` trong `/etc/kept/kept.env`, rồi
`systemctl restart kept`. HTTPS: [sau một reverse proxy](/vi/install/reverse-proxy/).

## Cập nhật

Trong console của container (`pct enter <CTID>`, hoặc **Console** của container trong giao diện
web):

```sh
update
```

`update` nêu phiên bản đang chạy và phiên bản mới nhất rồi hỏi trước. Nó in lệnh sao lưu để chạy
trên máy chủ trước khi bạn trả lời. Sau đó nó tải bản phát hành mới và kiểm tra theo `SHA256SUMS`
đã ký của bản phát hành, dừng Kept, chuyển sang bản mới đặt cạnh bản cũ và khởi động nó (các bản di
chuyển chạy trước). Nếu Kept không trả lời `/readyz` với phiên bản mới, nó chuyển lại và khởi động
bản trước. `update 1.15.0` cài một phiên bản cụ thể. Phiên bản cũ hơn cần `KEPT_ALLOW_DOWNGRADE=1`,
dành cho việc khôi phục ([quay lại một phiên bản](/vi/admin/upgrades/)). Không có gì tự cập nhật.

Cập nhật của chính Debian là `apt update && apt upgrade` trong container, như mọi Debian.

## Sao lưu

Mọi thứ nằm trên ổ đĩa của container, nên một bản sao lưu Proxmox chứa trọn Kept: thêm container
vào một tác vụ sao lưu (**Datacenter → Backup**) ở chế độ snapshot, hoặc một lần:

```sh
vzdump <CTID> --mode snapshot
```

Chế độ snapshot cần kho lưu trữ hỗ trợ snapshot (LVM-thin, ZFS, Ceph); với kho khác dùng
`--mode stop`. Khôi phục bằng **Restore** trong giao diện web, hoặc `pct restore`.

Để có bản sao thứ hai ngoài máy, bật sao lưu hằng đêm của Kept ([sao lưu](/vi/admin/backups/)).
Chúng chạy với quyền chủ sở hữu cơ sở dữ liệu, nên trước hết hãy cấp cho Kept tài khoản đó, trong
container:

```sh
install -m 0400 -o kept -g kept /etc/kept/owner/kept_owner /etc/kept/config/database/kept_owner
printf '%s\n' 'KEPT_OWNER_DATABASE_URL=postgres://kept_owner@127.0.0.1:5432/kept' \
  'KEPT_DB_OWNER_PASSWORD_FILE=/etc/kept/config/database/kept_owner' >>/etc/kept/kept.env
systemctl restart kept
```

Đích S3 và SFTP chạy được ngay. Một thư mục làm đích phải ghi được bởi dịch vụ: thêm nó bằng
`systemctl edit kept` (`[Service]` rồi `ReadWritePaths=/thu/muc/sao/luu`), thuộc sở hữu của người
dùng `kept`.

## Gỡ bỏ

Lệnh này xóa container và mọi thứ bên trong, kể cả dữ liệu của Kept. Hãy sao lưu trước nếu bạn có
thể cần lại:

```sh
pct stop <CTID> && pct destroy <CTID> --purge
```

## Có gì đó không chạy?

- **Cài đặt dừng giữa chừng:** script đã nêu bước và xóa container. Chạy lại với
  `var_keep_failed=yes` để giữ container, rồi `pct enter <CTID>` và `journalctl -u kept`.
- **Kept không khởi động:** `journalctl -u kept-bootstrap -u kept` trong container nêu vấn đề, như
  `kept: invalid environment:` cho một thiết lập trong `/etc/kept/kept.env`.
- **Console đen:** Debian 13 cần `nesting=1`, script đã đặt; một container tạo tay mà thiếu nó sẽ
  như vậy.
