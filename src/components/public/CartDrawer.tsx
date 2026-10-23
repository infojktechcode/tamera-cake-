import Link from "next/link";
import { useCartStore } from "../../lib/cart-store";

/** Mobile bottom-bar cart entry — plain `<Link>` to /cart so nav never 404s. */
export function CartDrawer() {
  const count = useCartStore((s) => s.itemCount);
  return (
    <Link
      href="/cart"
      className="flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 py-2 font-medium text-white transition hover:bg-primary/90"
    >
      Cart {count > 0 ? <span className="rounded-full bg-white/30 px-1.5 py-0.5 text-xs">{count}</span> : null}
    </Link>
  );
}
