# YouTube Sync Player

YouTube Sync Player là ứng dụng web nhỏ giúp nghe và xem song ngữ Anh - Việt trên nền tảng YouTube. Ứng dụng mở hai player YouTube cạnh nhau, cho phép phát/dừng, tua, chỉnh tốc độ và đồng bộ thời gian giữa hai video.

Phù hợp cho các tình huống học ngoại ngữ như:

- Xem một video tiếng Anh cùng một bản dịch/lồng tiếng tiếng Việt.
- So sánh hai bản cùng nội dung ở hai ngôn ngữ khác nhau.
- Mở cùng một video trên hai player để căn độ trễ khi luyện nghe, shadowing hoặc đối chiếu phụ đề.

## Tính năng

- Dán 1 hoặc 2 link/iframe YouTube để tạo hai player.
- Tự nhận dạng nhiều dạng URL YouTube: `youtube.com/watch`, `youtu.be`, `embed`, `shorts`, `live`.
- Nếu chỉ dán 1 video, ứng dụng tự tạo 2 player từ cùng video đó.
- Điều khiển đồng bộ: phát/dừng, lùi 5 giây, tiến 5 giây, đồng bộ lại.
- Chỉnh tốc độ phát từ `0.5x` đến `2x`.
- Chỉnh độ trễ cho Player 1 từ `0` đến `5` giây để khớp âm thanh hoặc phụ đề.
- Tự lưu nội dung đã dán và độ trễ Player 1 trong trình duyệt bằng `localStorage`.

## Yêu cầu

- Node.js đã được cài trên máy.
- Trình duyệt hiện đại như Chrome, Edge, Firefox hoặc Safari.
- Kết nối internet để tải YouTube IFrame API và phát video từ YouTube.

## Cách chạy

Mở terminal tại thư mục dự án và chạy:

```bash
npm start
```

Sau đó mở trình duyệt tại:

```text
http://127.0.0.1:3000
```

Nếu muốn đổi cổng trên Windows PowerShell:

```powershell
$env:PORT=5173; npm start
```

Ứng dụng chỉ dùng Node.js để phục vụ file tĩnh, hiện không cần cài thêm dependency.

## Cách sử dụng

1. Chuẩn bị 1 hoặc 2 link YouTube/iframe YouTube.
2. Dán vào ô `Iframe hoặc link YouTube`.
3. Bấm `Tải 2 player`.
4. Khi hai player đã sẵn sàng, dùng nút `Phát` để phát đồng bộ.
5. Dùng `Lùi 5s`, `Tiến 5s` hoặc `Đồng bộ lại` khi muốn căn lại vị trí.
6. Chỉnh `Player 1 chậm (s)` nếu bản ở Player 1 cần chạy chậm hơn Player 2 một khoảng thời gian cố định.
7. Chỉnh `Tốc độ` nếu muốn luyện nghe chậm hơn hoặc nhanh hơn.

Ví dụ nội dung có thể dán:

```text
https://www.youtube.com/watch?v=VIDEO_ID_1
https://youtu.be/VIDEO_ID_2
```

Hoặc dán trực tiếp mã iframe lấy từ nút chia sẻ của YouTube.

## Gợi ý học song ngữ Anh - Việt

- Đặt video tiếng Anh ở Player 1 và bản tiếng Việt ở Player 2 để vừa nghe hiểu vừa đối chiếu.
- Nếu hai video không khớp thời điểm bắt đầu, tua một player đến đoạn tương ứng rồi bấm `Đồng bộ lại`.
- Dùng tốc độ `0.75x` hoặc `0.5x` khi luyện nghe chi tiết.
- Khi nghe quen, tăng lên `1x`, `1.25x` hoặc cao hơn để luyện phản xạ.

## Lưu ý

- Một số video YouTube có thể chặn nhúng, khi đó player sẽ báo lỗi và không phát được trong ứng dụng.
- Ứng dụng không tự tải phụ đề hoặc dịch nội dung; việc song ngữ đến từ hai video/bản phụ đề/bản lồng tiếng mà bạn chọn trên YouTube.
- Chất lượng đồng bộ phụ thuộc vào khả năng phát của YouTube, tốc độ mạng và việc hai video có cùng nội dung/timeline hay không.

## Cấu trúc dự án

```text
.
├── app.js       # Logic tải YouTube API, tạo player và đồng bộ phát
├── index.html   # Giao diện chính
├── styles.css   # Kiểu hiển thị responsive
├── server.js    # HTTP server phục vụ file tĩnh
└── package.json # Script chạy dự án
```

# english-bilingual
