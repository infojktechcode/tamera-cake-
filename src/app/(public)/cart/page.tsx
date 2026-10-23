"use client";

import { useCartStore } from "../../lib/cart-store";
import { CartView } from "../../components/public/CartView";

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  return <CartView items={items} onRemove={removeItem} />;
}
