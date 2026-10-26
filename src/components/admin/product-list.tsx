"use client";

import { useRef, useState } from "react";

import { formatKES } from "@/lib/format";
import {
  draftFromProduct,
  isProductDirty,
  marginPercent,
  productChanges,
  profitPerUnit,
  type AdminProduct,
  type ProductDraft,
} from "@/lib/product-edit";
import { resolveProductImage } from "@/lib/product-image";
import { uploadProductPhoto } from "@/lib/product-upload";

/**
 * The products panel: prices, stock, availability, photos, cost and margin.
 *
 * Every row has its own draft, so nothing is written until Save is pressed.
 * The role flags are props because the owner is the only one who sees costs
 * or may change a price (`permissions.ts`); the API enforces the same rules
 * again for anyone calling it directly.
 */

interface Props {
  products: AdminProduct[];
  canEditPrice: boolean;
  canViewCost: boolean;
  canDelete: boolean;
  onSaved: (product: AdminProduct) => void;
  onDeleted: (id: string) => void;
}

export function ProductList({
  products,
  canEditPrice,
  canViewCost,
  canDelete,
  onSaved,
  onDeleted,
}: Props) {
  if (products.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-cocoa/20 bg-white/60 p-8 text-center text-sm text-ink-muted">
        No products match.
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-cocoa/10 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-vanilla/60 text-left text-xs font-semibold text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3">Product</th>
              <th scope="col" className="px-4 py-3">Price</th>
              <th scope="col" className="px-4 py-3">Stock</th>
              <th scope="col" className="px-4 py-3">Available</th>
              {canViewCost && <th scope="col" className="px-4 py-3">Cost</th>}
              <th scope="col" className="w-px whitespace-nowrap px-4 py-3">
                <span className="sr-only">Save</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cocoa/10">
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                canEditPrice={canEditPrice}
                canViewCost={canViewCost}
                canDelete={canDelete}
                onSaved={onSaved}
                onDeleted={onDeleted}
              />
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            canEditPrice={canEditPrice}
            canViewCost={canViewCost}
            canDelete={canDelete}
            onSaved={onSaved}
            onDeleted={onDeleted}
          />
        ))}
      </ul>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* One row's state                                                            */
/* -------------------------------------------------------------------------- */

function useProductEditor(
  product: AdminProduct,
  flags: { canEditPrice: boolean; canViewCost: boolean; canDelete: boolean },
  onSaved: (product: AdminProduct) => void,
  onDeleted: (id: string) => void,
) {
  const [draft, setDraft] = useState<ProductDraft>(() => draftFromProduct(product));
  const [cost, setCost] = useState<number>(product.costPrice ?? 0);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const original = draftFromProduct(product);
  const costChanged = flags.canViewCost && cost !== (product.costPrice ?? 0);
  const dirty = isProductDirty(original, draft) || costChanged;

  const update = (patch: Partial<ProductDraft>) => {
    setSaved(false);
    setError(null);
    setDraft((state) => ({ ...state, ...patch }));
  };

  const reset = () => {
    setDraft(draftFromProduct(product));
    setCost(product.costPrice ?? 0);
    setSaved(false);
    setError(null);
  };

  const save = async () => {
    const patch = productChanges(original, draft);
    const payload: Record<string, unknown> = { ...patch };
    if (costChanged) payload.costPrice = cost;
    if (Object.keys(payload).length === 0) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "That change could not be saved.");
        return;
      }
      onSaved({
        ...product,
        ...patch,
        costPrice: costChanged ? cost : product.costPrice,
      });
      setSaved(true);
    } catch {
      setError("We could not reach the shop server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = async (file: File) => {
    setPhotoBusy(true);
    setError(null);
    try {
      const path = await uploadProductPhoto(file);
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: path }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "The photo was uploaded but could not be saved.");
        return;
      }
      onSaved({ ...product, imageUrl: path });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const remove = async () => {
    if (
      !window.confirm(
        `Delete ${product.name}? Past orders keep their own copy, but the product leaves the catalogue.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "That product could not be deleted.");
        return;
      }
      onDeleted(product.id);
    } catch {
      setError("We could not reach the shop server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return {
    draft,
    cost,
    setCost: (value: number) => {
      setSaved(false);
      setError(null);
      setCost(value);
    },
    update,
    reset,
    save,
    pickPhoto,
    remove,
    dirty,
    busy,
    photoBusy,
    saved,
    error,
    canDelete: flags.canDelete,
  };
}

/* -------------------------------------------------------------------------- */
/* Desktop row                                                                 */
/* -------------------------------------------------------------------------- */

function ProductRow({
  product,
  canEditPrice,
  canViewCost,
  canDelete,
  onSaved,
  onDeleted,
}: {
  product: AdminProduct;
  canEditPrice: boolean;
  canViewCost: boolean;
  canDelete: boolean;
  onSaved: (product: AdminProduct) => void;
  onDeleted: (id: string) => void;
}) {
  const editor = useProductEditor(
    product,
    { canEditPrice, canViewCost, canDelete },
    onSaved,
    onDeleted,
  );
  const { draft } = editor;
  const margin = marginPercent(draft.price, canViewCost ? editor.cost : null);
  const profit = profitPerUnit(draft.price, canViewCost ? editor.cost : null);

  return (
    <tr className={editor.dirty ? "bg-vanilla/40" : "hover:bg-vanilla/30"}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <PhotoThumb product={product} editor={editor} />
          <div className="min-w-0">
            <p className="truncate font-medium text-cocoa">{product.name}</p>
            <p className="text-xs text-ink-muted">
              {product.categoryName}
              {!product.available && (
                <span className="ml-2 rounded-full bg-cocoa/10 px-1.5 py-0.5 text-[10px] font-medium">
                  hidden
                </span>
              )}
            </p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="text-xs text-ink-muted">KES</span>
          <input
            type="number"
            min={0}
            max={1_000_000}
            step={1}
            inputMode="numeric"
            value={draft.price}
            disabled={!canEditPrice || editor.busy}
            onChange={(event) => editor.update({ price: toWholeNumber(event.target.value) })}
            aria-label={`Price for ${product.name}`}
            className="min-h-9 w-20 rounded-lg border border-cocoa/20 px-2 text-right tabular-nums outline-none focus:border-strawberry disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:text-left"
          />
        </div>
      </td>

      <td className="px-4 py-3">
        <StockFields product={product} draft={draft} update={editor.update} busy={editor.busy} />
      </td>

      <td className="px-4 py-3">
        <AvailabilityToggle
          product={product}
          available={draft.available}
          onChange={(available) => editor.update({ available })}
          disabled={editor.busy}
        />
      </td>

      {canViewCost && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <span className="text-xs text-ink-muted">KES</span>
            <input
              type="number"
              min={0}
              max={1_000_000}
              step={1}
              inputMode="numeric"
              value={editor.cost}
              disabled={editor.busy}
              onChange={(event) => editor.setCost(toWholeNumber(event.target.value))}
              aria-label={`Cost price for ${product.name}`}
              className="min-h-9 w-20 rounded-lg border border-cocoa/20 px-2 text-right tabular-nums outline-none focus:border-strawberry"
            />
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">
            {margin === null
              ? "no cost yet"
              : `${margin}% margin · ${formatKES(profit ?? 0)} profit`}
          </p>
        </td>
      )}

      <td className="w-px whitespace-nowrap px-4 py-3">
        <div className="flex flex-col items-end gap-1">
          <SaveControls editor={editor} />
          {editor.error && (
            <p role="alert" className="max-w-48 text-right text-[11px] text-strawberry-deep">
              {editor.error}
            </p>
          )}
          {editor.canDelete && !editor.dirty && (
            <button
              type="button"
              onClick={editor.remove}
              disabled={editor.busy}
              className="min-h-8 rounded-full px-1 text-[11px] font-medium text-ink-muted underline-offset-4 hover:text-strawberry-deep hover:underline disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile card                                                                 */
/* -------------------------------------------------------------------------- */

function ProductCard({
  product,
  canEditPrice,
  canViewCost,
  canDelete,
  onSaved,
  onDeleted,
}: {
  product: AdminProduct;
  canEditPrice: boolean;
  canViewCost: boolean;
  canDelete: boolean;
  onSaved: (product: AdminProduct) => void;
  onDeleted: (id: string) => void;
}) {
  const editor = useProductEditor(
    product,
    { canEditPrice, canViewCost, canDelete },
    onSaved,
    onDeleted,
  );
  const { draft } = editor;
  const margin = marginPercent(draft.price, canViewCost ? editor.cost : null);
  const profit = profitPerUnit(draft.price, canViewCost ? editor.cost : null);

  return (
    <li className={`rounded-2xl border bg-white p-4 ${editor.dirty ? "border-strawberry/50" : "border-cocoa/10"}`}>
      <div className="flex items-start gap-3">
        <PhotoThumb product={product} editor={editor} />
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-cocoa">{product.name}</p>
          <p className="text-xs text-ink-muted">
            {product.categoryName}
            {!product.available && " · hidden"}
          </p>
        </div>
        <AvailabilityToggle
          product={product}
          available={draft.available}
          onChange={(available) => editor.update({ available })}
          disabled={editor.busy}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-ink-muted">Price (KES)</span>
          <input
            type="number"
            min={0}
            max={1_000_000}
            step={1}
            inputMode="numeric"
            value={draft.price}
            disabled={!canEditPrice || editor.busy}
            onChange={(event) => editor.update({ price: toWholeNumber(event.target.value) })}
            className="mt-1 min-h-11 w-full rounded-xl border border-cocoa/20 px-3 text-sm tabular-nums outline-none focus:border-strawberry disabled:bg-vanilla/60"
          />
          {!canEditPrice && <span className="text-[11px] text-ink-muted">Owner only</span>}
        </label>

        {canViewCost && (
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Cost (KES)</span>
            <input
              type="number"
              min={0}
              max={1_000_000}
              step={1}
              inputMode="numeric"
              value={editor.cost}
              disabled={editor.busy}
              onChange={(event) => editor.setCost(toWholeNumber(event.target.value))}
              className="mt-1 min-h-11 w-full rounded-xl border border-cocoa/20 px-3 text-sm tabular-nums outline-none focus:border-strawberry"
            />
            <span className="text-[11px] text-ink-muted">
              {margin === null ? "no cost yet" : `${margin}% margin · ${formatKES(profit ?? 0)}`}
            </span>
          </label>
        )}
      </div>

      <div className="mt-3">
        <StockFields product={product} draft={draft} update={editor.update} busy={editor.busy} />
      </div>

      {editor.error && (
        <p role="alert" className="mt-3 rounded-xl bg-strawberry/10 p-2 text-xs text-strawberry-deep">
          {editor.error}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <SaveControls editor={editor} />
        {editor.canDelete && (
          <button
            type="button"
            onClick={editor.remove}
            disabled={editor.busy}
            className="min-h-9 rounded-full px-2 text-xs font-medium text-strawberry-deep underline-offset-4 hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared fields                                                              */
/* -------------------------------------------------------------------------- */

function PhotoThumb({
  product,
  editor,
}: {
  product: AdminProduct;
  editor: ReturnType<typeof useProductEditor>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const src = resolveProductImage(product.imageUrl);
  return (
    <label
      className="relative block size-12 shrink-0 cursor-pointer overflow-hidden rounded-xl bg-blush"
      title={`Change the photo for ${product.name}`}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={`Change the photo for ${product.name}`}
        disabled={editor.photoBusy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void editor.pickPhoto(file).finally(() => {
            if (fileRef.current) fileRef.current.value = "";
          });
        }}
      />
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden className="flex size-full items-center justify-center text-xl">
          {product.kind === "cake" ? "🎂" : "🥐"}
        </span>
      )}
      {editor.photoBusy && (
        <span className="absolute inset-0 flex items-center justify-center bg-white/80 text-[10px] font-medium">
          …
        </span>
      )}
    </label>
  );
}

function StockFields({
  product,
  draft,
  update,
  busy,
}: {
  product: AdminProduct;
  draft: ProductDraft;
  update: (patch: Partial<ProductDraft>) => void;
  busy: boolean;
}) {
  const low =
    draft.trackStock && draft.stockQty <= draft.lowStockLevel ? (
      <span className="rounded-full bg-strawberry/15 px-1.5 py-0.5 text-[10px] font-semibold text-strawberry-deep">
        low
      </span>
    ) : null;

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-xs text-ink-muted">
        <input
          type="checkbox"
          checked={draft.trackStock}
          disabled={busy}
          onChange={(event) => update({ trackStock: event.target.checked })}
          className="size-4 accent-strawberry"
        />
        Track stock
      </label>
      {draft.trackStock && (
        <>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100_000}
              step={1}
              inputMode="numeric"
              value={draft.stockQty}
              disabled={busy}
              onChange={(event) => update({ stockQty: toWholeNumber(event.target.value) })}
              aria-label={`Stock for ${product.name}`}
              className="min-h-9 w-16 rounded-lg border border-cocoa/20 px-2 text-right text-sm tabular-nums outline-none focus:border-strawberry"
            />
            <span className="text-xs text-ink-muted">left</span>
            {low}
          </div>
          <label className="flex items-center gap-1 text-[11px] text-ink-muted">
            low at
            <input
              type="number"
              min={0}
              max={100_000}
              step={1}
              inputMode="numeric"
              value={draft.lowStockLevel}
              disabled={busy}
              onChange={(event) => update({ lowStockLevel: toWholeNumber(event.target.value) })}
              aria-label={`Low stock level for ${product.name}`}
              className="min-h-8 w-12 rounded-lg border border-cocoa/20 px-1 text-right text-xs tabular-nums outline-none focus:border-strawberry"
            />
          </label>
        </>
      )}
    </div>
  );
}

function AvailabilityToggle({
  product,
  available,
  onChange,
  disabled,
}: {
  product: AdminProduct;
  available: boolean;
  onChange: (available: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={available}
      aria-label={`${product.name} is ${available ? "available" : "switched off"}`}
      disabled={disabled}
      onClick={() => onChange(!available)}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition disabled:opacity-50 ${
        available ? "bg-pistachio text-cocoa" : "bg-cocoa/10 text-ink-muted"
      }`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${available ? "bg-cocoa" : "bg-ink-muted"}`} />
      {available ? "Available" : "Off"}
    </button>
  );
}

function SaveControls({ editor }: { editor: ReturnType<typeof useProductEditor> }) {
  if (!editor.dirty && !editor.saved) return null;

  return (
    <span className="flex items-center gap-2">
      {editor.saved && !editor.dirty && (
        <span className="text-[11px] font-medium text-pistachio">Saved</span>
      )}
      {editor.dirty && (
        <>
          <button
            type="button"
            onClick={editor.reset}
            disabled={editor.busy}
            className="min-h-9 rounded-full px-2 text-xs font-medium text-ink-muted underline-offset-4 hover:underline disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={editor.save}
            disabled={editor.busy}
            className="min-h-9 rounded-full bg-strawberry px-3 text-xs font-semibold text-white transition hover:bg-strawberry-deep disabled:opacity-50"
          >
            {editor.busy ? "Saving…" : "Save"}
          </button>
        </>
      )}
    </span>
  );
}

function toWholeNumber(value: string): number {
  if (value === "") return 0;
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
}
