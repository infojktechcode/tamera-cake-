export function formatKES(amount: number): string {
  return `KES ${Number(amount).toLocaleString("en-KE")}`;
}
export function orderNumberFromSeq(n: number): string {
  return `TCB-${String(n).padStart(4, "0")}`;
}
export function formatDateKenya(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
