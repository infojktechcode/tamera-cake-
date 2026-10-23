import Link from "next/link";
import type { CartItem } from "../../types/cart";

interface CartViewProps {
  items: CartItem[];
  onRemove: (id: string) => void;
}

export function CartView({ items, onRemove }: CartViewProps) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-ink-muted">Your cart is empty.</p>
        <Link href="/pastries" className="rounded-full bg-strawberry px-6 py-3 font-medium text-white transition hover:bg-strawberry-deep">
          Browse pastries
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-cocoa">Your order</h1>
        <Link href="/checkout" className="rounded-full bg-primary px-5 py-2 font-medium text-white transition hover:bg-primary/90">
          Checkout →
        </Link>
      </header>

      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.kind + (item.productId ?? item.flavourId)} className="rounded-2xl border border-cocoa/10 bg-cream p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-cocoa">{item.kind === "cake" ? item.flavourName : item.name}</p>
                {item.kind === "cake" && <p className="text-xs text-ink-muted">{item.kg}kg · {item.tierName}</p>}
                {item.kind === "pastry" && <p className="text-xs text-ink-muted">{item.quantity}× {item.unitPrice} KES</p>}
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.kind + (item.kind === "cake" ? item.flavourId : item.productId))}
                className="rounded-full bg-black/10 px-3 py-1 text-sm text-ink-muted hover:bg-black/20"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <footer className="mt-6 border-t border-cocoa/10 pt-4">
        <p className="text-ink-muted">Total: <span className="font-semibold text-primary">{Math.round(items.reduce((s, i) => s + lineTotalOf(i), 0))}</span></p>
        <Link href="/checkout" className="mt-2 inline-block rounded-full bg-primary px-5 py-2 font-medium text-white transition hover:bg-primary/90">
          Place order →
        </Link>
      </footer>
    </div>
  );
}

function lineTotalOf(item: CartItem): number {
  if (item.kind === "cake") {
    return Math.round(item.flavourPricePerKg * item.kg + (item as any).tierExtraFee);
  }
  return item.unitPrice * item.quantity;
}
