// Kenyan phone normalisation → 2547XXXXXXXX
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  let n = digits;
  if (n.startsWith("0") && n.length === 10) n = "254" + n.slice(1);
  if (n.startsWith("7") && n.length === 9) n = "254" + n;
  if (n.startsWith("1") && n.length === 9) n = "254" + n;
  if (n.startsWith("254") && n.length === 12) n = n;
  if (!/^254(7|1)\d{8}$/.test(n)) return null;
  return n;
}
