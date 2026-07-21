# Triển khai self-hosted (single-tenant)

Hướng dẫn cài AI Marketing Command Center lên máy chủ doanh nghiệp bằng Docker.
Một container phục vụ **cả dashboard lẫn Control API** (cùng origin), có write-path bảo vệ bằng token.

## 1. Yêu cầu
- Docker + Docker Compose
- 1 máy chủ Linux (hoặc máy tính nội bộ), mở cổng 8787 trong mạng LAN

## 2. Cấu hình

Tạo file `.env` cạnh `docker-compose.yml`:

```bash
# Token bảo vệ hành động ghi (tạo/duyệt/xuất bản). Sinh token mạnh:
#   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
CONTROL_API_TOKEN=dán-token-vừa-sinh-vào-đây

# Tùy chọn — cắm khi muốn AI thật (để trống = chạy mock an toàn):
# NINE_ROUTER_API_KEY=...
# NINE_ROUTER_MODEL=cx/gpt-5.4-mini
# META_PUBLISH_ENABLED=false
```

> Không đặt `CONTROL_API_TOKEN` thì compose sẽ từ chối chạy — đúng chủ đích để không mở write-path.

## 3. Chạy

```bash
docker compose up -d --build      # build + chạy nền
docker compose logs -f            # xem log JSON có cấu trúc
```

Mở dashboard: `http://<IP-máy-chủ>:8787/`
Nhập `CONTROL_API_TOKEN` vào ô token trên dashboard để bật các nút điều khiển.

## 4. Dữ liệu & backup
- State runtime: `./output/telegram-runtime-state.json` (gắn volume, không mất khi rebuild)
- Backup tự động: `./output/backups/state-<timestamp>.json` (giữ 10 bản gần nhất)
- Sao lưu định kỳ: chỉ cần backup thư mục `./output`

## 5. Cập nhật phiên bản
```bash
git pull
docker compose up -d --build
```

## 6. HTTPS & truy cập ngoài internet (khuyến nghị)
Đặt một reverse proxy (Caddy/Nginx/Traefik) trước cổng 8787 để có TLS:
- Caddy một dòng: `reverse_proxy localhost:8787` + domain → tự cấp SSL.
- Luôn giữ `CONTROL_API_TOKEN` khi mở ra ngoài LAN, và giới hạn IP bằng tường lửa.

## 7. Chạy không Docker (tùy chọn)
```bash
npm ci
VITE_CONTROL_API_BASE="" npm run build
NODE_ENV=production CONTROL_API_TOKEN=... CONTROL_API_HOST=0.0.0.0 npm run control:api
```

## 8. Chế độ live thật (khi có tài khoản)
- **AI**: đặt `NINE_ROUTER_API_KEY` → agent dùng LLM thật thay mock.
- **Telegram**: chạy thêm `npm run telegram:bot` với 6 bot token (ngoài Docker hoặc thêm service).
- **Facebook**: `META_PUBLISH_ENABLED=true` + token đã qua App Review. Xuất bản vẫn cần xác nhận cuối của người vận hành.
