"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { FadeUp } from "@/components/motion";
import { useCart } from "@/lib/cart-store";
import type { CakeSize, DesignTier, DeliveryZone, OrderSettings } from "@/lib/builder-data";
import type { FlavourCard } from "@/lib/catalog";
import { publicPhotoUrlFromEnv } from "@/lib/photo-paths";
import { uploadReferencePhoto } from "@/lib/photo-upload";
import { depositRequired } from "@/lib/pricing";

/**
 * Multi-step custom cake builder.
 *
 * All catalogue data arrives as props from the server page — the builder never
 * imports the server-only fetchers, so no Supabase client or cache directive
 * reaches the browser bundle.
 *
 * Steps: size → flavour → tier → photos → message/allergies → date → review.
 */

const MAX_PHOTO_SIZE_MB = 5;
const MAX_PHOTOS = 3;

const STEP_LABELS = [
  "Size",
  "Flavour",
  "Design",
  "Photos",
  "Message",
  "Date",
  "Review",
] as const;

const BUILDER_STORAGE_KEY = "tamera-cake-builder";

/**
 * Persisted form state.
 *
 * `deliveryZone` (a whole row) is not serialised: it is restored by id from
 * the catalogue passed in as props. The reference photos are stored as their
 * storage paths, so they survive a reload too.
 */
interface PersistedForm {
  sizeId: string | null;
  kg: number;
  flavourId: string | null;
  flavourName: string;
  flavourPricePerKg: number;
  tierId: string | null;
  tierName: string;
  tierExtraFee: number;
  tierRequiresQuote: boolean;
  designDescription: string;
  cakeMessage: string;
  allergies: string;
  referencePhotos: string[];
  pickupDate: string | null;
  pickupTime: string | null;
  deliveryZoneId: string | null;
  step: number;
}

function saveBuilderForm(state: FormState): void {
  const payload: PersistedForm = {
    sizeId: state.sizeId,
    kg: state.kg,
    flavourId: state.flavourId,
    flavourName: state.flavourName,
    flavourPricePerKg: state.flavourPricePerKg,
    tierId: state.tierId,
    tierName: state.tierName,
    tierExtraFee: state.tierExtraFee,
    tierRequiresQuote: state.tierRequiresQuote,
    designDescription: state.designDescription,
    cakeMessage: state.cakeMessage,
    allergies: state.allergies,
    referencePhotos: state.referencePhotos,
    pickupDate: state.pickupDate,
    pickupTime: state.pickupTime,
    deliveryZoneId: state.deliveryZone?.id ?? null,
    step: state.step,
  };
  try {
    sessionStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage can be unavailable (private mode, quota) — fail silently.
  }
}

function restoreBuilderForm(): PersistedForm | null {
  try {
    const raw = sessionStorage.getItem(BUILDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedForm>;
    if (!parsed || typeof parsed !== "object") return null;
    const step = Number(parsed.step);
    return {
      sizeId: parsed.sizeId ?? null,
      kg: typeof parsed.kg === "number" ? parsed.kg : 1,
      flavourId: parsed.flavourId ?? null,
      flavourName: parsed.flavourName ?? "",
      flavourPricePerKg:
        typeof parsed.flavourPricePerKg === "number" ? parsed.flavourPricePerKg : 0,
      tierId: parsed.tierId ?? null,
      tierName: parsed.tierName ?? "Simple",
      tierExtraFee: typeof parsed.tierExtraFee === "number" ? parsed.tierExtraFee : 0,
      tierRequiresQuote: parsed.tierRequiresQuote === true,
      designDescription: parsed.designDescription ?? "",
      cakeMessage: parsed.cakeMessage ?? "",
      allergies: parsed.allergies ?? "",
      referencePhotos: Array.isArray(parsed.referencePhotos) ? parsed.referencePhotos : [],
      pickupDate: parsed.pickupDate ?? null,
      pickupTime: parsed.pickupTime ?? null,
      deliveryZoneId: parsed.deliveryZoneId ?? null,
      step: step >= 1 && step <= 7 ? step : 1,
    };
  } catch {
    return null;
  }
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface CakeBuilderProps {
  sizes: CakeSize[];
  flavours: FlavourCard[];
  tiers: DesignTier[];
  zones: DeliveryZone[];
  blockedDates: string[];
  settings: OrderSettings;
  /** Flavour preselected from `/order/cake?flavour=<id>`. */
  initialFlavourId?: string | null;
}

interface FormState {
  sizeId: string | null;
  kg: number;
  flavourId: string | null;
  flavourName: string;
  flavourPricePerKg: number;
  tierId: string | null;
  tierName: string;
  tierExtraFee: number;
  tierRequiresQuote: boolean;
  designDescription: string;
  cakeMessage: string;
  allergies: string;
  /** Storage paths of the uploaded reference photos. */
  referencePhotos: string[];
  pickupDate: string | null;
  pickupTime: string | null;
  deliveryZone: DeliveryZone | null;
  step: Step;
}

const INITIAL_FORM: FormState = {
  sizeId: null,
  kg: 1,
  flavourId: null,
  flavourName: "",
  flavourPricePerKg: 0,
  tierId: null,
  tierName: "Simple",
  tierExtraFee: 0,
  tierRequiresQuote: false,
  designDescription: "",
  cakeMessage: "",
  allergies: "",
  referencePhotos: [],
  pickupDate: null,
  pickupTime: null,
  deliveryZone: null,
  step: 1,
};

export function CakeBuilder({
  sizes,
  flavours,
  tiers,
  zones,
  blockedDates,
  settings,
  initialFlavourId = null,
}: CakeBuilderProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const restoredRef = useRef(false);

  /**
   * Restore the wizard on mount, then keep it saved.
   *
   * A back/forward navigation remounts this component; without the restore
   * the customer loses their place. Restoration happens in an effect (not in
   * the `useState` initialiser) so the server-rendered markup and the first
   * client render agree.
   */
  useEffect(() => {
    if (!restoredRef.current) {
      restoredRef.current = true;
      const saved = restoreBuilderForm();
      const flavour = initialFlavourId
        ? flavours.find((f) => f.id === initialFlavourId)
        : undefined;

      let restored: Partial<FormState> | null = null;
      if (saved) {
        restored = {
          ...saved,
          deliveryZone:
            saved.deliveryZoneId === null
              ? null
              : (zones.find((z) => z.id === saved.deliveryZoneId) ?? null),
          step: saved.step as Step,
        };
      } else if (flavour) {
        // `/order/cake?flavour=<uuid>` preselects the flavour from the query.
        restored = {
          flavourId: flavour.id,
          flavourName: flavour.name,
          flavourPricePerKg: flavour.price_per_kg,
        };
      }

      if (restored) {
        /* eslint-disable react-hooks/set-state-in-effect -- mirroring an
           external system (sessionStorage) into React state on mount. */
        setForm((p) => ({ ...p, ...restored }));
        /* eslint-enable react-hooks/set-state-in-effect */
      }
      return;
    }
    saveBuilderForm(form);
    // `flavours`/`zones`/`initialFlavourId` are read only on the first run
    // (the `restoredRef` guard); listing them keeps the linter honest.
  }, [form, flavours, initialFlavourId, zones]);

  const blocked = useMemo(() => new Set(blockedDates), [blockedDates]);

  const minLeadDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + settings.min_lead_days);
    return d.toISOString().slice(0, 10);
  }, [settings.min_lead_days]);

  const basePrice =
    Math.round(form.kg * form.flavourPricePerKg) + form.tierExtraFee;

  const deposit = depositRequired({
    // A design the shop still has to quote carries no deposit yet — the same
    // rule the server applies in `order-compute.ts`.
    anyCakeOverThreshold:
      !form.tierRequiresQuote && form.kg >= settings.deposit_threshold_kg,
    anyNonSimpleTier: !form.tierRequiresQuote && form.tierName !== "Simple",
    total: basePrice,
    depositPercent: settings.deposit_percent,
  });

  const tier = tiers.find((t) => t.id === form.tierId) ?? null;

  /** A step may be left only when its required fields are set. */
  const stepComplete = (step: Step): boolean => {
    switch (step) {
      case 1:
        return form.sizeId !== null;
      case 2:
        return form.flavourId !== null;
      case 3:
        return form.tierId !== null;
      case 4:
        return true;
      case 5:
        return true;
      case 6:
        return form.pickupDate !== null;
      case 7:
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (!stepComplete(form.step)) return;
    if (form.step === 7) {
      addToCart();
      return;
    }
    setForm((p) => ({ ...p, step: (p.step + 1) as Step }));
  };

  const goBack = () => {
    if (form.step > 1)
      setForm((p) => ({ ...p, step: (p.step - 1) as Step }));
  };

  const addToCart = () => {
    useCart.getState().addCake({
      flavourId: form.flavourId ?? "",
      flavourName: form.flavourName,
      flavourPricePerKg: form.flavourPricePerKg,
      sizeId: form.sizeId ?? "",
      kg: form.kg,
      tierId: form.tierId ?? "",
      tierName: form.tierName,
      tierExtraFee: form.tierExtraFee,
      tierRequiresQuote: form.tierRequiresQuote,
      designDescription: form.designDescription,
      cakeMessage: form.cakeMessage,
      allergies: form.allergies,
      referencePhotos: form.referencePhotos,
    });
    // The date and the fulfilment belong to the order, not to the cake — carry
    // them into the cart so the checkout form starts from them instead of
    // asking the customer to repeat the decision.
    useCart.getState().setDetails({
      dateNeeded: form.pickupDate,
      timeNeeded: form.pickupTime,
      fulfilment: form.deliveryZone
        ? {
            kind: "delivery",
            zoneId: form.deliveryZone.id,
            zoneName: form.deliveryZone.name,
            fee: form.deliveryZone.fee,
            chosen: true,
          }
        : { kind: "pickup", zoneId: null, zoneName: null, fee: 0, chosen: true },
    });
    // The cake is in the cart now — a fresh builder should start from step 1.
    try {
      sessionStorage.removeItem(BUILDER_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
    router.push("/cart");
  };

  /**
   * Upload the photos the customer picked.
   *
   * The files go to Supabase storage straight away (through a signed URL), so
   * the cart holds storage paths rather than `File` objects — that way the
   * photos survive a reload and can be attached to the order.
   */
  const handlePhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotoError(null);

    const tooBig = Array.from(files).find(
      (f) => f.size > MAX_PHOTO_SIZE_MB * 1024 * 1024,
    );
    if (tooBig) {
      setPhotoError(
        `"${tooBig.name}" is larger than ${MAX_PHOTO_SIZE_MB}MB. Please choose a smaller photo.`,
      );
      return;
    }

    const room = MAX_PHOTOS - form.referencePhotos.length;
    if (room <= 0) {
      setPhotoError(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const accepted = Array.from(files).slice(0, room);
    if (files.length > room) {
      setPhotoError(
        `Only ${MAX_PHOTOS} photos are allowed — the extra files were ignored.`,
      );
    } else {
      setPhotoError(null);
    }

    setUploadingPhotos(true);
    try {
      const uploaded: string[] = [];
      for (const file of accepted) {
        const photo = await uploadReferencePhoto(file);
        uploaded.push(photo.path);
      }
      setForm((p) => ({ ...p, referencePhotos: [...p.referencePhotos, ...uploaded] }));
    } catch (e) {
      setPhotoError(
        e instanceof Error ? e.message : "We could not upload that photo. Please try again.",
      );
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removePhoto = (index: number) => {
    setForm((p) => ({
      ...p,
      referencePhotos: p.referencePhotos.filter((_, i) => i !== index),
    }));
    setPhotoError(null);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <h1 className="font-display text-3xl font-bold text-cocoa sm:text-4xl">
        Build your cake
      </h1>
      <p className="mt-2 text-ink-muted">
        Seven quick steps — we&apos;ll confirm the final price and deposit with you.
      </p>

      {/* Progress indicator */}
      <ol className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {STEP_LABELS.map((label, i) => {
          const step = (i + 1) as Step;
          const state =
            step < form.step
              ? "text-strawberry"
              : step === form.step
                ? "font-semibold text-cocoa"
                : "text-ink-muted/60";
          return (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && (
                <span aria-hidden className="text-ink-muted/40">
                  ·
                </span>
              )}
              <span className={state}>
                {step}. {label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          <FadeUp key={form.step}>
            {form.step === 1 && (
              <section aria-labelledby="step-heading-size">
                <h2
                  id="step-heading-size"
                  className="font-display text-xl font-semibold text-cocoa"
                >
                  How big?
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Prices are per kilogram — the estimate updates as you go.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {sizes.map((s) => {
                    const selected = form.sizeId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setForm((p) => ({ ...p, sizeId: s.id, kg: s.kg }))
                        }
                        className={`min-h-12 rounded-2xl border px-4 py-3 text-left transition ${
                          selected
                            ? "border-strawberry bg-blush font-semibold text-cocoa"
                            : "border-cocoa/15 bg-vanilla/50 text-cocoa hover:border-cocoa/30"
                        }`}
                      >
                        <span className="block text-lg">{s.kg}kg</span>
                      </button>
                    );
                  })}
                </div>
                {form.sizeId && (
                  <p className="mt-3 text-sm text-ink-muted">
                    Selected: {form.kg}kg
                  </p>
                )}
              </section>
            )}

            {form.step === 2 && (
              <section aria-labelledby="step-heading-flavour">
                <h2
                  id="step-heading-flavour"
                  className="font-display text-xl font-semibold text-cocoa"
                >
                  Choose a flavour
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {flavours.map((f) => {
                    const selected = form.flavourId === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            flavourId: f.id,
                            flavourName: f.name,
                            flavourPricePerKg: f.price_per_kg,
                          }))
                        }
                        className={`min-h-12 rounded-2xl border px-4 py-3 text-left transition ${
                          selected
                            ? "border-strawberry bg-blush font-semibold text-cocoa"
                            : "border-cocoa/15 bg-vanilla/50 text-cocoa hover:border-cocoa/30"
                        }`}
                      >
                        <span className="block">{f.name}</span>
                        <span className="mt-0.5 block text-xs text-ink-muted">
                          KES {f.price_per_kg.toLocaleString("en-KE")}/kg
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {form.step === 3 && (
              <section aria-labelledby="step-heading-tier">
                <h2
                  id="step-heading-tier"
                  className="font-display text-xl font-semibold text-cocoa"
                >
                  How elaborate?
                </h2>
                <div className="mt-4 space-y-2">
                  {tiers.map((t) => {
                    const selected = form.tierId === t.id;
                    return (
                      <label
                        key={t.id}
                        className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                          selected
                            ? "border-strawberry bg-blush"
                            : "border-cocoa/15 bg-vanilla/50 hover:border-cocoa/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="tier"
                          value={t.id}
                          checked={selected}
                          onChange={() =>
                            setForm((p) => ({
                              ...p,
                              tierId: t.id,
                              tierName: t.name,
                              tierExtraFee: t.extra_fee,
                              tierRequiresQuote: t.requires_quote,
                            }))
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-cocoa">
                            {t.name}
                          </span>
                          {t.description && (
                            <span className="block text-xs text-ink-muted">
                              {t.description}
                            </span>
                          )}
                        </span>
                        <span className="text-sm font-medium text-cocoa">
                          {t.extra_fee > 0
                            ? `+KES ${t.extra_fee.toLocaleString("en-KE")}`
                            : "Included"}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {tier?.requires_quote && (
                  <p className="mt-3 text-sm text-ink-muted">
                    This design is quoted individually — we&apos;ll confirm the
                    final price before you pay.
                  </p>
                )}

                <label className="mt-5 block text-sm font-medium text-cocoa">
                  Design notes (optional)
                  <textarea
                    rows={3}
                    value={form.designDescription}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        designDescription: e.target.value,
                      }))
                    }
                    placeholder="Colours, theme, what you'd like us to know"
                    className="mt-1 w-full resize-y rounded-xl border border-cocoa/15 bg-vanilla/40 p-3 text-cocoa placeholder:text-ink-muted/60 focus:border-strawberry focus:outline-none"
                  />
                </label>
              </section>
            )}

            {form.step === 4 && (
              <section aria-labelledby="step-heading-photos">
                <h2
                  id="step-heading-photos"
                  className="font-display text-xl font-semibold text-cocoa"
                >
                  Reference photos
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Optional — up to {MAX_PHOTOS} photos, {MAX_PHOTO_SIZE_MB}MB each.
                </p>

                <label
                  htmlFor="cake-photos"
                  className="mt-4 flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-cocoa/25 bg-vanilla/40 px-4 py-6 text-center text-sm text-ink-muted transition hover:border-cocoa/40"
                >
                  <span>
                    {uploadingPhotos ? "Uploading…" : "Tap to add photos"}
                    <input
                      id="cake-photos"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={uploadingPhotos}
                      aria-label="Cake photos"
                      onChange={(e) => {
                        void handlePhotos(e.target.files);
                        // Allow the same file to be picked again after a removal.
                        e.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </span>
                </label>

                {uploadingPhotos && (
                  <p className="mt-3 text-sm text-ink-muted">
                    Sending your photo to the shop…
                  </p>
                )}

                {photoError && (
                  <p role="alert" className="mt-3 text-sm text-strawberry-deep">
                    {photoError}
                  </p>
                )}

                {form.referencePhotos.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-3">
                    {form.referencePhotos.map((photo, i) => {
                      const src = publicPhotoUrlFromEnv(photo);
                      return (
                        <li key={photo} className="relative">
                          <span className="block h-20 w-20 overflow-hidden rounded-xl border border-cocoa/10">
                            {src ? (
                              <Image
                                src={src}
                                alt={`Reference photo ${i + 1}`}
                                width={80}
                                height={80}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-xs text-ink-muted">
                                Photo {i + 1}
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            aria-label={`Remove reference photo ${i + 1}`}
                            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-cocoa text-xs text-white"
                          >
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {form.referencePhotos.length > 0 && (
                  <p className="mt-3 text-sm text-ink-muted">
                    {form.referencePhotos.length} photo(s) selected
                  </p>
                )}
              </section>
            )}

            {form.step === 5 && (
              <section aria-labelledby="step-heading-message">
                <h2
                  id="step-heading-message"
                  className="font-display text-xl font-semibold text-cocoa"
                >
                  Message &amp; allergies
                </h2>
                <label className="mt-4 block text-sm font-medium text-cocoa">
                  Message on the cake (optional)
                  <textarea
                    rows={2}
                    value={form.cakeMessage}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, cakeMessage: e.target.value }))
                    }
                    placeholder="Happy birthday, Wanjiku!"
                    className="mt-1 w-full resize-y rounded-xl border border-cocoa/15 bg-vanilla/40 p-3 text-cocoa placeholder:text-ink-muted/60 focus:border-strawberry focus:outline-none"
                  />
                </label>
                <label className="mt-4 block text-sm font-medium text-cocoa">
                  Allergies (optional)
                  <textarea
                    rows={2}
                    value={form.allergies}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, allergies: e.target.value }))
                    }
                    placeholder="Peanuts, dairy"
                    className="mt-1 w-full resize-y rounded-xl border border-cocoa/15 bg-vanilla/40 p-3 text-cocoa placeholder:text-ink-muted/60 focus:border-strawberry focus:outline-none"
                  />
                </label>
              </section>
            )}

            {form.step === 6 && (
              <section aria-labelledby="step-heading-date">
                <h2
                  id="step-heading-date"
                  className="font-display text-xl font-semibold text-cocoa"
                >
                  When do you need it?
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  We need at least {settings.min_lead_days} days&apos; notice.
                </p>

                <label htmlFor="pickup-date" className="mt-4 block text-sm font-medium text-cocoa">
                  Pickup date
                  <input
                    id="pickup-date"
                    type="date"
                    min={minLeadDate}
                    value={form.pickupDate ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (!value) return;
                      if (blocked.has(value)) {
                        setDateError("That day is closed. Please pick another date.");
                        return;
                      }
                      setDateError(null);
                      setForm((p) => ({ ...p, pickupDate: value }));
                    }}
                    className="mt-1 w-full rounded-xl border border-cocoa/15 bg-vanilla/40 p-3 text-cocoa focus:border-strawberry focus:outline-none"
                  />
                </label>

                <label htmlFor="pickup-time" className="mt-4 block text-sm font-medium text-cocoa">
                  Time (optional)
                  <input
                    id="pickup-time"
                    type="time"
                    value={form.pickupTime ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        pickupTime: e.target.value || null,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-cocoa/15 bg-vanilla/40 p-3 text-cocoa focus:border-strawberry focus:outline-none"
                  />
                </label>

                {blockedDates.length > 0 && (
                  <p className="mt-3 text-sm text-ink-muted">
                    Blocked: {blockedDates.join(", ")}
                  </p>
                )}
                {dateError && (
                  <p role="alert" className="mt-3 text-sm text-strawberry-deep">
                    {dateError}
                  </p>
                )}

                <fieldset className="mt-6">
                  <legend className="text-sm font-medium text-cocoa">
                    Pickup or delivery
                  </legend>
                  <label className="mt-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-cocoa/15 bg-vanilla/40 px-4 py-3">
                    <input
                      type="radio"
                      name="fulfilment"
                      checked={form.deliveryZone === null}
                      onChange={() =>
                        setForm((p) => ({ ...p, deliveryZone: null }))
                      }
                    />
                    <span className="flex-1">
                      <span className="block font-medium text-cocoa">
                        Pickup at the shop
                      </span>
                      <span className="block text-xs text-ink-muted">Free</span>
                    </span>
                  </label>
                  {zones.map((z) => (
                    <label
                      key={z.id}
                      className="mt-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-cocoa/15 bg-vanilla/40 px-4 py-3"
                    >
                      <input
                        type="radio"
                        name="fulfilment"
                        checked={form.deliveryZone?.id === z.id}
                        onChange={() =>
                          setForm((p) => ({ ...p, deliveryZone: z }))
                        }
                      />
                      <span className="flex-1">
                        <span className="block font-medium text-cocoa">
                          Deliver to {z.name}
                        </span>
                      </span>
                      <span className="text-sm font-medium text-cocoa">
                        KES {z.fee.toLocaleString("en-KE")}
                      </span>
                    </label>
                  ))}
                </fieldset>
              </section>
            )}

            {form.step === 7 && (
              <section aria-labelledby="step-heading-review">
                <h2
                  id="step-heading-review"
                  className="font-display text-xl font-semibold text-cocoa"
                >
                  Check your order
                </h2>
                <dl className="mt-4 divide-y divide-cocoa/10 rounded-2xl border border-cocoa/10 bg-vanilla/40">
                  <Row label="Size" value={form.sizeId ? `${form.kg}kg` : "—"} />
                  <Row label="Flavour" value={form.flavourName || "—"} />
                  <Row label="Design" value={form.tierName || "—"} />
                  <Row
                    label="Message"
                    value={form.cakeMessage || "None"}
                  />
                  <Row
                    label="Allergies"
                    value={form.allergies || "None"}
                  />
                  <Row
                    label="Photos"
                    value={
                      form.referencePhotos.length
                        ? `${form.referencePhotos.length}`
                        : "None"
                    }
                  />
                  <Row label="Pickup date" value={form.pickupDate ?? "—"} />
                  <Row label="Pickup time" value={form.pickupTime ?? "Any time"} />
                  <Row
                    label="Delivery"
                    value={
                      form.deliveryZone
                        ? `${form.deliveryZone.name} (KES ${form.deliveryZone.fee.toLocaleString("en-KE")})`
                        : "Pickup at the shop"
                    }
                  />
                </dl>

                {tier?.requires_quote && (
                  <p className="mt-4 text-sm text-ink-muted">
                    This design is quoted individually — the price below is an
                    estimate until we confirm the details with you.
                  </p>
                )}
              </section>
            )}
          </FadeUp>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={form.step === 1}
              className="min-h-12 rounded-full border border-cocoa/20 px-6 py-3 font-medium text-cocoa transition hover:border-cocoa/40 disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!stepComplete(form.step)}
              className="min-h-12 rounded-full bg-strawberry px-8 py-3 font-semibold text-white transition hover:bg-strawberry-deep disabled:opacity-40"
            >
              {form.step === 7 ? "Add to cart" : "Next"}
            </button>
          </div>
        </div>

        {/* Live price bar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-cocoa/10 bg-vanilla/60 p-5">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Estimate
            </h2>
            <p className="mt-2 font-display text-2xl font-bold text-cocoa">
              KES {basePrice.toLocaleString("en-KE")}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {form.kg}kg × KES{" "}
              {form.flavourPricePerKg.toLocaleString("en-KE")}/kg
              {form.tierExtraFee > 0 &&
                ` + KES ${form.tierExtraFee.toLocaleString("en-KE")} design`}
            </p>
            <p className="mt-3 text-sm text-cocoa">
              Deposit:{" "}
              <span className="font-semibold">
                KES {deposit.toLocaleString("en-KE")}
              </span>
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {deposit > 0
                ? `${settings.deposit_percent}% deposit required for this order.`
                : "No deposit needed for this order."}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-cocoa">{value}</dd>
    </div>
  );
}
