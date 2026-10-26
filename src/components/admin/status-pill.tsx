import { STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/lib/order-status";

/**
 * The status pill.
 *
 * Colour is never the only signal — the status name is always written out,
 * so the pill still reads correctly for a colour-blind user or on a screen
 * in bright sun (spec §7.5).
 */
export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATUS_TONE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
