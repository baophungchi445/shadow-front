# Đối chiếu `docs/PLAN.md` với game hiện tại (sau đợt 6, v0.6 — kiểm tra lại 2026-11-19, có ghi phần đợt 7 đang làm dở)

Ký hiệu: ✅ đã có · 🟡 có một phần · ⬜ chưa làm (offline được, để sau) · 🌐 cần online (đang hoãn theo yêu cầu) · 🎨 cần đồ họa / âm thanh thật (đang hoãn)

## 1. Main Menu

✅ Logo, Play (Skirmish/Survival), Campaign, Settings · ✅ Profile · 🌐 Multiplayer, Co-op online · ⬜ Exit (trình duyệt không cho trang tự đóng; chỉ có ở bản desktop)

## 2. Player System

✅ Hồ sơ người chơi **offline** (nickname, level & XP, thống kê, lịch sử trận) · ✅ Avatar riêng: 8 hình × 8 màu (đợt 12.4) · 🌐 Đăng ký / đăng nhập / đăng xuất, avatar online, bạn bè, người chơi online, mời, chat

## 3. Game Lobby

✅ Thiết lập trận offline: chọn chế độ, map, faction, team, thêm/xóa bot, độ khó AI · 🟡 Server có phòng, mật khẩu, ready, host (chưa có giao diện) · 🌐 Danh sách phòng, mời bạn, ready/unready, đếm ngược · ✅ Chọn màu quân đội

## 4. Game Modes

✅ Campaign, Skirmish, Human vs AI, Human + AI đồng minh vs AI team, Survival, Elimination (Annihilation/Decapitation) · ✅ Domination · ✅ Capture the Flag · 🌐 Co-op PvE online, Team PvP 3v3/5v5, Custom Match online

## 5. Faction System

✅ 5 faction, chọn faction, bonus/điểm yếu cân bằng (modifiers) · ✅ Mỗi faction 1 unit đặc trưng · ✅ Công nghệ riêng từng faction · ✅ Công trình riêng từng faction (đợt 10.2)

## 6. Map System

✅ Desert Storm, Urban Conflict (+ River Crossing, Highland Pass), chọn map, xem trước, đặt tài nguyên, spawn, điểm chiến lược, chướng ngại, đường, cầu, sông, Fog of War, map tự làm qua Tiled · ✅ Random Map · ✅ Forest Warfare, Snowfield, Island Conflict, Industrial Zone (địa hình rừng, tuyết) · ✅ map editor trong game (đợt 9.2) · ✅ độ cao địa hình (đồi), môi trường phá hủy được (rừng / nhà) (đợt 12.1–12.2)

## 7. Base Building

✅ HQ, Power Plant, Barracks, War Factory, Airfield, Research Center, Defense Tower (Turret), SAM Site, Resource Extractor (≈ Refinery), đặt công trình, xây, sửa, phá hủy, điều kiện tiên quyết, điện, hàng chờ sản xuất · ✅ Radar Station, Wall, Missile Launcher, **Sell** · ✅ Bunker (có quân trú, đợt 7.1; AI dùng từ đợt 8.1) · ✅ nâng cấp công trình Level 2 (đợt 7.2) · ✅ xoay công trình (mặt trước, đợt 12.3)

## 8. Economy

✅ Credits, điện, mỏ, thu nhập, chi phí, thiếu điện, thống kê kinh tế (màn kết quả) · 🟡 Khai thác tự động bằng Extractor (không có xe thu gom / vận chuyển — đơn giản hóa có chủ ý) · ✅ Chia tiền cho đồng đội

## 9. Units

✅ Rifleman, Anti-Tank Infantry (≈ Rocket Soldier), MBT, Heavy Tank, APC, Scout (Recon Vehicle), Attack Helicopter, UAV (Recon Drone), Self-Propelled Artillery
✅ Sniper, Medic, Engineer · ✅ Special Forces (Ranger), Light Tank, IFV, Gunship, Rocket Launcher/MLRS (unit riêng của faction)
✅ Transport Helicopter (đợt 7.1; AI thả quân từ đợt 8.1) · ✅ Mobile Command Vehicle (triển khai thành HQ tiền tuyến), Fighter Jet, Bomber (đợt 8.3) · ✅ Long-range Missile System (đợt 9.3) · ⬜ Hải quân (PLAN ghi "Future")
**Điều khiển:** ✅ chọn, chọn nhiều, nhóm, phím nhóm, move, attack, attack-move, hold, retreat, focus fire, đội hình rải đều, máu · ✅ **Patrol**, **kinh nghiệm / cấp bậc (veterancy)**, sửa xe (Engineer) · ✅ chở quân (APC 5, Transport Helicopter 6, Bunker 4; chuột phải để lên, phím U để xuống) · ✅ chọn kiểu đội hình: rải đều / hàng ngang / hàng dọc / mũi tên (đợt 8.4) · ✅ nâng cấp từng unit (đợt 11.1)

## 10. Combat

✅ Thời gian thực, tự động/thủ công, chọn mục tiêu, tầm bắn, vũ khí, đạn bay, giáp, tính sát thương, sát thương lan, phòng không, nổ, khói, hiệu ứng phá hủy, thống kê · ✅ áp chế bộ binh, đạn cháy (đợt 9.3) · ✅ chí mạng, lựu đạn khói (đợt 10.3) · ✅ Đường đạn đạo thật: cung parabol, ngắm đón, vùng đạn rơi (đợt 11.4)

## 11. AI

✅ Xây căn cứ, quản lý tài nguyên, sản xuất, trinh sát, phòng thủ, tấn công, rút lui, chiếm lãnh thổ, chọn mục tiêu, 4 độ khó, 5 tính cách (Shadow dùng trọng số cân bằng) · ✅ Phối hợp đội: AI đồng minh cùng tấn công, gửi cứu viện (đợt 8.1) · ✅ AI dùng chở quân, Bunker, thả quân bằng trực thăng (đợt 8.1) · ✅ Cân bằng lối Rush (đợt 8.2) · ✅ AI dùng unit / công trình mới

## 12. Multiplayer — 🌐 toàn bộ (server chỉ có quản lý phòng)

## 13. UI / UX

✅ Menu, HUD, tài nguyên, minimap, panel chọn, panel công trình, hàng chờ, panel lệnh, thông tin unit/faction/team, thông báo, menu pause, thắng/thua, thống kê, settings, âm lượng · ✅ Bảng phím tắt, toàn màn hình · 🌐 Lobby online, chat · ✅ Đổi phím · ⬜ độ phân giải (trình duyệt tự theo cửa sổ)

## 14. Âm thanh & hiệu ứng

✅ Tiếng vũ khí, nổ, công trình (WebAudio procedural), hiệu ứng nổ/khói, animation đơn giản · ✅ Nhạc nền procedural (menu + trận), âm lượng nhạc / hiệu ứng riêng · 🎨 Giọng nói unit/chỉ huy, âm thanh thật, animation thật · ✅ Thời tiết (mưa, bão cát, tuyết), ngày / đêm (đợt 11.3)

## 15. Progression

✅ Level, XP, thống kê, thành tích (achievements) — **lưu offline** · ✅ Nhiệm vụ ngày/tuần, danh hiệu · ✅ thành thạo faction (cấp 0–10, đợt 8.6) · ✅ thành thạo từng unit (đợt 11.2) · 🌐 Bảng xếp hạng, ranking, phần thưởng online · 🎨 Skin, vật phẩm trang trí

## 16. Settings

✅ Tốc độ camera, cuộn mép màn hình, âm lượng, hiện FPS · ✅ Toàn màn hình, âm lượng nhạc / hiệu ứng · ✅ Camera zoom + tốc độ zoom (đợt 8.5) · ✅ Đổi phím tắt (đợt 7.5) · ✅ Chất lượng đồ họa Low / Medium / High (thay chế độ hiệu năng), độ nhạy kéo chuột (đợt 8.5) · ✅ ngôn ngữ: tiếng Việt / tiếng Anh (đợt 9.1) · ⬜ độ phân giải · 🌐 Mạng

## 17. Admin & Backend — 🌐 toàn bộ (cấu hình cân bằng / unit / map / AI đã nằm trong `packages/game-data`)

## 18. MVP

✅ Tất cả mục MVP chơi offline · 🌐 Game Lobby online, Create/Join Room trên giao diện, Co-op 1–5 người online, đồng bộ multiplayer
