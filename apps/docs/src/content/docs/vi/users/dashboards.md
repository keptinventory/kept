---
title: "Bảng điều khiển"
description: "Số lượng của Kept trên bảng điều khiển. Sao chép widget cho Homepage, Glance và Homarr đọc những gì quá hạn, đến hạn và sắp hết hạn từ tóm tắt của Kept."
---

Một bảng điều khiển có thể hiển thị những gì bạn cần trong Kept: quá hạn, đến hạn, sắp hết hạn, đã cho mượn, không chắc chắn và tồn kho thấp, tổng cộng và theo từng địa điểm. Mỗi widget dưới đây đọc một lần gọi, `GET /api/v1/summary`, với một [mã thông báo cá nhân](/vi/users/mcp-clients/#tạo-token-cá-nhân) (**Chỉ đọc**, các vị trí bạn muốn đếm). [Home Assistant](/vi/users/home-assistant/) đọc cùng một lần gọi.

## Tóm tắt

```json
{
  "asOf": "2026-10-15T11:30:00.000Z",
  "totals": { "things": 61, "unplaced": 4, "overdue": 2, "due": 3, "expiring": 2,
              "lentOut": 2, "borrowedIn": 0, "uncertain": 2, "longUnseen": 0, "lowStock": 0 },
  "locations": [
    { "id": "…", "name": "Home", "kind": "home", "timeZone": "Africa/Cairo",
      "counts": { "things": 34, "unplaced": 1, "overdue": 2, "due": 1, "expiring": 1,
                  "lentOut": 1, "borrowedIn": 0, "uncertain": 1, "longUnseen": 0,
                  "lowStock": null } }
  ]
}
```

- Mỗi số lượng là số trên Trang chủ của Kept, cho các vị trí mà mã thông báo truy cập được.
- `null` trong một vị trí: mô-đun đó tắt ở đó (Cho mượn cho `lentOut` và `borrowedIn`, Tiêu hao cho `lowStock`). `totals` cộng dồn các vị trí nơi nó áp dụng, nên chúng luôn là số.
- Không có tên đồ vật, không có tiền.

Giữ mã thông báo trong bí mật của bảng điều khiển, không phải trong tệp bạn chia sẻ. Mỗi ví dụ dùng `https://kept.example.org`: hãy đặt địa chỉ Kept của bạn.

## Homepage

Một widget [API tùy chỉnh](https://gethomepage.dev/widgets/services/customapi/), trong `services.yaml`. Mã thông báo đến từ biến môi trường, `HOMEPAGE_VAR_KEPT_TOKEN` ([bí mật môi trường](https://gethomepage.dev/installation/docker/#using-environment-secrets)). Đã kiểm tra với tài liệu Homepage 2.5.0.

```yaml
- Home:
    - Kept:
        href: https://kept.example.org
        description: What needs you
        widget:
          type: customapi
          url: https://kept.example.org/api/v1/summary
          refreshInterval: 300000 # 5 minutes
          headers:
            Authorization: Bearer {{HOMEPAGE_VAR_KEPT_TOKEN}}
          mappings:
            - field: totals.overdue
              label: Overdue
              format: number
            - field: totals.due
              label: Due
              format: number
            - field: totals.expiring
              label: Expiring
              format: number
            - field: totals.lowStock
              label: Low stock
              format: number
```

Theo từng vị trí, một hàng cho mỗi vị trí:

```yaml
        widget:
          type: customapi
          url: https://kept.example.org/api/v1/summary
          refreshInterval: 300000
          headers:
            Authorization: Bearer {{HOMEPAGE_VAR_KEPT_TOKEN}}
          display: dynamic-list
          mappings:
            items: locations
            name: name
            label: counts.overdue
```

## Glance

Một widget [`custom-api`](https://github.com/glanceapp/glance/blob/main/docs/configuration.md#custom-api), trong `glance.yml`. `${KEPT_TOKEN}` được đọc từ môi trường của Glance. Đã kiểm tra với tài liệu Glance 0.8.6.

```yaml
- type: custom-api
  title: Kept
  cache: 5m
  url: https://kept.example.org/api/v1/summary
  headers:
    Authorization: Bearer ${KEPT_TOKEN}
    Accept: application/json
  template: |
    <div class="flex justify-between text-center">
      <div>
        <div class="color-highlight size-h3">{{ .JSON.Int "totals.overdue" }}</div>
        <div class="size-h6">OVERDUE</div>
      </div>
      <div>
        <div class="color-highlight size-h3">{{ .JSON.Int "totals.due" }}</div>
        <div class="size-h6">DUE</div>
      </div>
      <div>
        <div class="color-highlight size-h3">{{ .JSON.Int "totals.expiring" }}</div>
        <div class="size-h6">EXPIRING</div>
      </div>
      <div>
        <div class="color-highlight size-h3">{{ .JSON.Int "totals.lowStock" }}</div>
        <div class="size-h6">LOW STOCK</div>
      </div>
    </div>
    <ul class="list list-gap-10" style="margin-top: 1rem">
    {{ range .JSON.Array "locations" }}
      <li>{{ .String "name" }}: {{ .Int "counts.overdue" }} overdue, {{ .Int "counts.due" }} due</li>
    {{ end }}
    </ul>
```

Thêm `allow-insecure: true` cho chứng chỉ tự ký.

## Homarr

Một widget tùy chỉnh (Homarr 2.x). Lưu định nghĩa dưới đây thành `kept.homarr-widget.json`, sau đó trong Homarr: **Custom widgets → Nhập**. Trong **Configure API sources**, đặt địa chỉ Kept của bạn thay cho địa chỉ gợi ý, đánh dấu xác nhận, và dán mã thông báo vào **API key or token**. Sau đó thêm vào bảng: **Choose item to add → Custom widget**. Homarr gọi Kept từ máy chủ của nó và giữ mã thông báo ra khỏi trình duyệt.

Đã kiểm tra với schema nhập của Homarr 2.5.2, chưa chạy qua bản xem trước: hãy dùng **Test and preview** trước khi phụ thuộc vào nó.

- `networkScope: private` cho phép Homarr truy cập Kept trên LAN của bạn. Homarr từ chối địa chỉ `100.x` của Tailscale dưới mọi cài đặt, và không theo dõi chuyển hướng: hãy dùng địa chỉ LAN của Kept, địa chỉ cuối cùng.
- Chứng chỉ tự ký có thể bị từ chối; hãy dùng chứng chỉ tin cậy hoặc `http://` trên LAN của bạn.

```json
{
  "$schema": "homarr-custom-widget-v2",
  "name": "Kept",
  "description": "Overdue, due, expiring, lent out, uncertain and low stock from Kept.",
  "sources": {
    "default": {
      "name": "Kept",
      "baseUrl": "https://your-kept.example.com",
      "networkScope": "private",
      "auth": "bearer"
    }
  },
  "requests": {
    "summary": {
      "path": "/api/v1/summary",
      "cacheSeconds": 60
    }
  },
  "options": {
    "showLocations": {
      "label": "Show each location",
      "control": "switch",
      "default": true
    }
  },
  "template": "<Stack gap=\"sm\" p=\"sm\" h=\"100%\" style={{ minWidth: 0, minHeight: 0 }}>\n  <Group justify=\"space-between\" wrap=\"nowrap\"><Text size=\"xs\" c=\"dimmed\" tt=\"uppercase\" fw={700}>Kept</Text><RefreshButton requestId=\"summary\" label=\"Refresh\" size=\"xs\" /></Group>\n  {status.summary?.loading && <Skeleton height={120} radius=\"md\" />}\n  {status.summary?.ok === false && <Alert color=\"red\" title=\"Kept unavailable\">{status.summary.error || \"Check the address and token under Configure sources.\"}</Alert>}\n  {!status.summary?.loading && status.summary?.ok !== false && <ScrollArea style={{ flex: 1, minHeight: 0 }}><Stack gap=\"sm\">\n    <SimpleGrid type=\"container\" cols={{ base: 2, \"300px\": 3 }} spacing=\"xs\">{[{ label: \"Overdue\", value: data.summary?.totals?.overdue }, { label: \"Due\", value: data.summary?.totals?.due }, { label: \"Expiring\", value: data.summary?.totals?.expiring }, { label: \"Lent out\", value: data.summary?.totals?.lentOut }, { label: \"Uncertain\", value: data.summary?.totals?.uncertain }, { label: \"Low stock\", value: data.summary?.totals?.lowStock }].map(item => <Paper key={item.label} withBorder radius=\"md\" p=\"sm\"><Text size=\"xs\" c=\"dimmed\">{item.label}</Text><Text fw={700} size=\"xl\">{item.value ?? \"-\"}</Text></Paper>)}</SimpleGrid>\n    {options.showLocations && <Stack gap={0}>{(data.summary?.locations ?? []).map(location => <Group key={location.id} justify=\"space-between\" wrap=\"wrap\" gap=\"xs\" py=\"xs\"><Text size=\"sm\" fw={600}>{location.name}</Text><Text size=\"xs\" c=\"dimmed\">{\"Overdue \" + location.counts.overdue + \" \u00b7 Due \" + location.counts.due}</Text></Group>)}</Stack>}\n  </Stack></ScrollArea>}\n</Stack>"
}
```
