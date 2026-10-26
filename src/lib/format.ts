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

/**
 * A phone number the way the shop reads it: 254720009999 -> 0720 009 999.
 * Anything unexpected is returned untouched, so a display format never hides
 * a number the shop needs to call.
 */
export function formatKenyanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("254") ? `0${digits.slice(3)}` : digits;
  if (local.length !== 10) return phone;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** Today on the shop's clock, YYYY-MM-DD. */
export function todayInKenya(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The time now on the shop's clock, HH:MM. */
export function timeInKenya(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}
