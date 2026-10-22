"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * The "there is a new order" badge.
 *
 * The dashboard lives in two places — the page and the sidebar — and both
 * need to know when an order arrives, so the count lives in a tiny context
 * above them.
 */
interface NewOrdersValue {
  count: number;
  /** Called when a new order arrives. */
  notify: () => void;
  /** Called when the shop looks at the list. */
  clear: () => void;
}

const NewOrdersContext = createContext<NewOrdersValue>({
  count: 0,
  notify: () => {},
  clear: () => {},
});

export function NewOrdersProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  const notify = useCallback(() => setCount((c) => c + 1), []);
  const clear = useCallback(() => setCount(0), []);

  const value = useMemo(() => ({ count, notify, clear }), [count, notify, clear]);

  return <NewOrdersContext.Provider value={value}>{children}</NewOrdersContext.Provider>;
}

export function useNewOrders(): NewOrdersValue {
  return useContext(NewOrdersContext);
}
