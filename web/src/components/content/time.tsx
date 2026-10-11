/** Thời gian tương đối tiếng Việt ("2 giờ trước"). Chỉ gọi ở server component để khỏi lệch khi hydrate. */
export function relativeTimeVi(date: Date, now: Date = new Date()): string {
  const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (sec < 45) return "vừa xong";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${Math.max(1, min)} phút trước`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d === 1) return "hôm qua";
  if (d < 7) return `${d} ngày trước`;
  if (d < 30) return `${Math.floor(d / 7)} tuần trước`;
  return date.toLocaleDateString("vi-VN");
}

/** <time> hiển thị tương đối, tooltip là thời điểm đầy đủ. Server component. */
export function TimeAgo({ date, className }: { date: Date; className?: string }) {
  return <time dateTime={date.toISOString()} title={date.toLocaleString("vi-VN")} className={className}>{relativeTimeVi(date)}</time>;
}
