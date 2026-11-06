---
title: "Cài đặt trên Kubernetes với Helm"
description: "Biểu đồ Helm của Kept cho k3s và các cụm Kubernetes khác."
sidebar:
  order: 4
---

:::caution[Chưa được kiểm tra trên cụm thực]
Biểu đồ (`charts/kept/` trong kho mã) hiển thị và xác thực (`helm lint`, `helm template` và `kubeconform` chạy ở mọi lần kiểm tra), và mỗi bản phát hành đẩy nó cùng với hình ảnh, nhưng nó chưa được cài đặt trên một cụm thực. Hãy xem lần cài đặt đầu tiên là một bài kiểm tra. README của nó chứa các giá trị, các bí mật cần tạo và các lệnh; trang này nói về những gì nó làm.
:::

Biểu đồ chạy cùng hình ảnh như Compose, với cùng các [biến môi trường](/vi/reference/configuration/).

- **Bí mật trước.** Biểu đồ không bao giờ ghi bí mật: bạn tạo bí mật đăng nhập cơ sở dữ liệu (và, với Postgres đi kèm, bí mật của superuser của nó) trước khi cài đặt, và tham chiếu các bí mật tùy chọn (các khóa, S3, thông tin đăng nhập sao lưu, SMTP, mã thông báo chỉ số) theo tên trong các giá trị.
- **Postgres:** Một StatefulSet đi kèm trên cùng hình ảnh pgvector được ghim như Compose, để bắt đầu nhanh, hoặc PostgreSQL 18 của bạn. Với bí mật của superuser cơ sở dữ liệu (hoặc admin của nhà cung cấp), một Job tạo các vai trò và tiện ích mở rộng của Kept; không có bí mật đó, hãy chạy [SQL Postgres được quản lý](/vi/install/managed-postgres/#sql) bạn-même.
- **Di chuyển** chạy trong một Job hook với đăng nhập của chủ sở hữu, vì vậy phiên bản mới không bao giờ phục vụ trước khi các di chuyển của nó được áp dụng. Với mục tiêu sao lưu được cấu hình, Job đó trước tiên lấy [ảnh chụp nhanh trước khi nâng cấp](/vi/admin/upgrades/). Với Postgres đi kèm, Job cài đặt đầu tiên chạy sau khi cài đặt, vì vậy đừng truyền `--wait` cho `helm install` đầu tiên đó.
- **Tệp lưu trữ cục bộ** nằm trên một thể tích ReadWriteOnce, vì vậy Deployment sử dụng chiến lược `Recreate`: một nâng cấp dừng pod cũ trước khi pod mới bắt đầu. Cập nhật lăn chỉ đến với lưu trữ tệp S3 và các khóa trong một bí mật.
- **Sao lưu chạy trong worker**, không bao giờ trong CronJob: cùng công việc hàng đêm như trong Compose, được cấu hình trong Admin → Sao lưu hoặc bị khóa bởi các giá trị của biểu đồ.
- **Tách Deployment web và worker** là một tùy chọn; worker là một bản sao đơn lẻ.
- **Thể tích được giữ** khi `helm uninstall`; hãy xóa các claim bạn-même để xóa dữ liệu.
- `helm test` hỏi Kept đang chạy về `/readyz` và `/version`.

Phiên bản của biểu đồ là phiên bản của Kept: bản phát hành 1.0.1 xuất bản biểu đồ 1.0.1. Nó được xuất bản dưới dạng một thành phần OCI được ký bên cạnh hình ảnh với mỗi bản phát hành; xem [xác minh một bản phát hành](/vi/admin/verify-release/).
