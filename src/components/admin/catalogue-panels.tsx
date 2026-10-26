"use client";

import { useState } from "react";

import type { AdminFlavour, AdminSize, AdminTier } from "@/lib/product-edit";

/**
 * Cake flavours, cake sizes and design tiers.
 *
 * These are short lists, so each one is a card rather than a table. The same
 * rule as products applies: a manager switches items on and off, the owner
 * changes what they cost (see `permissions.ts`, and the API checks again).
 */

/* -------------------------------------------------------------------------- */
/* Flavours                                                                   */
/* -------------------------------------------------------------------------- */

export function FlavoursPanel({
  flavours,
  canEditPrice,
  onSaved,
}: {
  flavours: AdminFlavour[];
  canEditPrice: boolean;
  onSaved: (flavour: AdminFlavour) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {flavours.map((flavour) => (
        <FlavourCard
          key={flavour.id}
          flavour={flavour}
          canEditPrice={canEditPrice}
          onSaved={onSaved}
        />
      ))}
    </ul>
  );
}

function FlavourCard({
  flavour,
  canEditPrice,
  onSaved,
}: {
  flavour: AdminFlavour;
  canEditPrice: boolean;
  onSaved: (flavour: AdminFlavour) => void;
}) {
  const [price, setPrice] = useState(flavour.pricePerKg);
  const [available, setAvailable] = useState(flavour.available);
  const saver = useCatalogueSave();

  const dirty = available !== flavour.available || (canEditPrice && price !== flavour.pricePerKg);

  const reset = () => {
    setPrice(flavour.pricePerKg);
    setAvailable(flavour.available);
    saver.clear();
  };

  const save = async () => {
    const payload: Record<string, unknown> = {};
    if (canEditPrice && price !== flavour.pricePerKg) payload.pricePerKg = price;
    if (available !== flavour.available) payload.available = available;
    const ok = await saver.save(`/api/admin/catalogue/flavours/${flavour.id}`, payload);
    if (ok) onSaved({ ...flavour, pricePerKg: price, available });
  };

  return (
    <li className={`rounded-2xl border bg-white p-4 ${dirty ? "border-strawberry/50" : "border-cocoa/10"}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-display font-semibold text-cocoa">{flavour.name}</p>
        <Toggle
          label={`${flavour.name} is ${available ? "available" : "switched off"}`}
          on={available}
          onChange={(next) => {
            saver.clear();
            setAvailable(next);
          }}
        />
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-ink-muted">Price per kg (KES)</span>
        <input
          type="number"
          min={0}
          max={1_000_000}
          step={1}
          inputMode="numeric"
          value={price}
          disabled={!canEditPrice || saver.busy}
          onChange={(event) => {
            saver.clear();
            setPrice(toWholeNumber(event.target.value));
          }}
          className="mt-1 min-h-11 w-full rounded-xl border border-cocoa/20 px-3 text-sm tabular-nums outline-none focus:border-strawberry disabled:bg-vanilla/60"
        />
        {!canEditPrice && <span className="text-[11px] text-ink-muted">Owner only</span>}
      </label>

      <ErrorLine message={saver.error} />
      <CardActions dirty={dirty} saved={saver.saved} busy={saver.busy} onReset={reset} onSave={save} />
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Sizes                                                                      */
/* -------------------------------------------------------------------------- */

export function SizesPanel({
  sizes,
  onSaved,
}: {
  sizes: AdminSize[];
  onSaved: (size: AdminSize) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-muted">
        A cake&apos;s price is the flavour&apos;s price per kg × the size, so a size only needs to be
        on or off.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sizes.map((size) => (
          <SizeCard key={size.id} size={size} onSaved={onSaved} />
        ))}
      </ul>
    </div>
  );
}

function SizeCard({ size, onSaved }: { size: AdminSize; onSaved: (size: AdminSize) => void }) {
  const [available, setAvailable] = useState(size.available);
  const saver = useCatalogueSave();
  const dirty = available !== size.available;

  const save = async () => {
    const ok = await saver.save(`/api/admin/catalogue/sizes/${size.id}`, { available });
    if (ok) onSaved({ ...size, available });
  };

  return (
    <li className={`rounded-2xl border bg-white p-4 ${dirty ? "border-strawberry/50" : "border-cocoa/10"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-semibold text-cocoa">
            {formatKg(size.kg)}
          </p>
          <p className="text-xs text-ink-muted">round cake</p>
        </div>
        <Toggle
          label={`${formatKg(size.kg)} is ${available ? "available" : "switched off"}`}
          on={available}
          onChange={(next) => {
            saver.clear();
            setAvailable(next);
          }}
        />
      </div>

      <ErrorLine message={saver.error} />
      <CardActions
        dirty={dirty}
        saved={saver.saved}
        busy={saver.busy}
        onReset={() => {
          setAvailable(size.available);
          saver.clear();
        }}
        onSave={save}
      />
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Design tiers                                                               */
/* -------------------------------------------------------------------------- */

export function TiersPanel({
  tiers,
  canEditPrice,
  onSaved,
}: {
  tiers: AdminTier[];
  canEditPrice: boolean;
  onSaved: (tier: AdminTier) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tiers.map((tier) => (
        <TierCard key={tier.id} tier={tier} canEditPrice={canEditPrice} onSaved={onSaved} />
      ))}
    </ul>
  );
}

function TierCard({
  tier,
  canEditPrice,
  onSaved,
}: {
  tier: AdminTier;
  canEditPrice: boolean;
  onSaved: (tier: AdminTier) => void;
}) {
  const [fee, setFee] = useState(tier.extraFee);
  const [requiresQuote, setRequiresQuote] = useState(tier.requiresQuote);
  const saver = useCatalogueSave();

  const dirty =
    requiresQuote !== tier.requiresQuote || (canEditPrice && fee !== tier.extraFee);

  const reset = () => {
    setFee(tier.extraFee);
    setRequiresQuote(tier.requiresQuote);
    saver.clear();
  };

  const save = async () => {
    const payload: Record<string, unknown> = {};
    if (canEditPrice && fee !== tier.extraFee) payload.extraFee = fee;
    if (requiresQuote !== tier.requiresQuote) payload.requiresQuote = requiresQuote;
    const ok = await saver.save(`/api/admin/catalogue/tiers/${tier.id}`, payload);
    if (ok) onSaved({ ...tier, extraFee: fee, requiresQuote });
  };

  return (
    <li className={`rounded-2xl border bg-white p-4 ${dirty ? "border-strawberry/50" : "border-cocoa/10"}`}>
      <p className="font-display font-semibold text-cocoa">{tier.name}</p>
      {tier.description && <p className="mt-0.5 text-xs text-ink-muted">{tier.description}</p>}

      <label className="mt-3 block">
        <span className="text-xs font-medium text-ink-muted">Extra fee (KES)</span>
        <input
          type="number"
          min={0}
          max={1_000_000}
          step={1}
          inputMode="numeric"
          value={fee}
          disabled={!canEditPrice || saver.busy}
          onChange={(event) => {
            saver.clear();
            setFee(toWholeNumber(event.target.value));
          }}
          className="mt-1 min-h-11 w-full rounded-xl border border-cocoa/20 px-3 text-sm tabular-nums outline-none focus:border-strawberry disabled:bg-vanilla/60"
        />
        {!canEditPrice && <span className="text-[11px] text-ink-muted">Owner only</span>}
      </label>

      <label className="mt-3 flex items-center gap-2 text-sm text-cocoa">
        <input
          type="checkbox"
          checked={requiresQuote}
          onChange={(event) => {
            saver.clear();
            setRequiresQuote(event.target.checked);
          }}
          className="size-4 accent-strawberry"
        />
        Needs a quote before ordering
      </label>

      <ErrorLine message={saver.error} />
      <CardActions dirty={dirty} saved={saver.saved} busy={saver.busy} onReset={reset} onSave={save} />
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Small shared pieces                                                        */
/* -------------------------------------------------------------------------- */

function useCatalogueSave() {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (url: string, payload: Record<string, unknown>): Promise<boolean> => {
    if (Object.keys(payload).length === 0) return false;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "That change could not be saved.");
        return false;
      }
      setSaved(true);
      return true;
    } catch {
      setError("We could not reach the shop server. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    saved,
    error,
    save,
    clear: () => {
      setSaved(false);
      setError(null);
    },
  };
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
        on ? "bg-pistachio text-cocoa" : "bg-cocoa/10 text-ink-muted"
      }`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${on ? "bg-cocoa" : "bg-ink-muted"}`} />
      {on ? "Available" : "Off"}
    </button>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 rounded-xl bg-strawberry/10 p-2 text-xs text-strawberry-deep">
      {message}
    </p>
  );
}

function CardActions({
  dirty,
  saved,
  busy,
  onReset,
  onSave,
}: {
  dirty: boolean;
  saved: boolean;
  busy: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  if (!dirty && !saved) return <div className="h-2" />;
  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      {saved && !dirty && <span className="text-[11px] font-medium text-pistachio">Saved</span>}
      {dirty && (
        <>
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="min-h-9 rounded-full px-2 text-xs font-medium text-ink-muted underline-offset-4 hover:underline disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="min-h-9 rounded-full bg-strawberry px-3 text-xs font-semibold text-white transition hover:bg-strawberry-deep disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </>
      )}
    </div>
  );
}

const kgFormatter = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2 });

/** 1 -> "1 kg", 1.5 -> "1.5 kg". */
function formatKg(kg: number): string {
  return `${kgFormatter.format(kg)} kg`;
}

/** Keep a whole-shilling field honest when the browser hands back a string. */
function toWholeNumber(value: string): number {
  if (value === "") return 0;
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
}
