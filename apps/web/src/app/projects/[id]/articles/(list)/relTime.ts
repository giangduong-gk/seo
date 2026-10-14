const rtf = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [["second", 60], ["minute", 60], ["hour", 24], ["day", 7], ["week", 4.345], ["month", 12], ["year", Infinity]];

/** "3 phút trước", "hôm qua", "2 tuần trước"… */
export function relTime(d: Date, now = new Date()): string {
  let v = (d.getTime() - now.getTime()) / 1000;
  for (const [unit, size] of STEPS) {
    if (Math.abs(v) < size) return unit === "second" && Math.abs(v) < 45 ? "vừa xong" : rtf.format(Math.round(v), unit);
    v /= size;
  }
  return d.toLocaleDateString("vi-VN");
}
