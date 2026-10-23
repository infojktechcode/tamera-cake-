import { useEffect, useState } from "react";
import { createCartStore } from "../../lib/cart-store";
import { getSizes, getDesignTiers, getDeliveryZones, getBlockedDates, getOrderSettings } from "../../lib/builder-data;
import { cartTotal, itemCount, hasCakes, hasCakesRequiringDeposit } from "../../lib/cart-store";
import { depositParity } from "../../lib/order-compute";
import type { OrderSettings } from "../../lib/builder-data";

interface SizeButtonProps {
  size: { id: string; kg: number };
  onSelect: () => void;
  isSelected: boolean;
}

const SizeButton: React.FC<SizeButtonProps> = ({ size, onSelect, isSelected }) => {
  const btnClass = isSelected
    ? "px-4 py-2 rounded text-sm font-medium bg-primary text-white"
    : "px-4 py-2 rounded text-sm font-medium bg-secondary text-white/80 hover:bg-secondary/90";
  return <button onClick={onSelect} className={btnClass}>{ `${size.kg}kg` }</button>;
};

interface FlavourCardProps {
  flavourName: string;
  flavourPricePerKg: number;
  onSelect: () => void;
  isSelected: boolean;
}

const FlavourCard: React.FC<FlavourCardProps> = ({
  flavourName,
  flavourPricePerKg,
  onSelect,
  isSelected,
}) => {
  const cardClass = isSelected
    ? "rounded-lg border border-primary cursor-pointer transition-colors"
    : "rounded-lg border-transparent cursor-pointer transition-colors";
  return (
    <div onClick={onSelect} className={cardClass}>
      <span className="font-medium">{flavourName}</span>
      <span className="text-sm text-white/60">KES {flavourPricePerKg.toLocaleString()} per kg</span>
    </div>
  );
};

interface TierRadioProps {
  tier: { id: string; name: string; extra_fee: number; requires_quote: boolean };
  onSelect: (tierId: string) => void;
  isSelected: boolean;
}

const TierRadio: React.FC<TierRadioProps> = ({ tier, onSelect, isSelected }) => {
  const labelClass = isSelected
    ? "flex items-center rounded-md border bg-primary text-white p-2 cursor-pointer select-none"
    : "flex items-center rounded-md border bg-background/50 text-white hover:bg-background/60 p-2 cursor-pointer select-none";
  return (
    <div className="space-y-1">
      <label className={labelClass}>
        <input
          type="radio"
          name="tier"
          value={tier.id}
          checked={isSelected}
          onChange={(e) => onSelect((e.target as HTMLInputElement).value)}
          className="peer hidden"
        />
        <span>{tier.name}</span>
      </label>
    </div>
  );
};

interface PhotoUploadProps {
  onSelect: (files: File[]) => void;
  accepted: string;
  maxSizeMB: number;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({ onSelect, accepted, maxSizeMB }) => {
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Compress each accepted file (best-effort; falls back to original on error).
    Promise.allSettled(Array.from(files).map((f) => compressAndRequestUpload(f)))
      .then((results) => {
        const ok = results.filter((r): r is PromiseFulfilledResult<string[]> => r.status === "fulfilled");
        if (ok.length > 0) {
          onSelect(ok.flatMap((r) => r.value));
        } else {
          const allFail = results.every((r): r is PromiseRejectedResult => r.status === "rejected");
          if (allFail) setError("Failed to process all selected photos.");
        }
      });
  };

  return (
    <div className="border rounded p-4 cursor-pointer hover:border-primary/50 transition-colors">
      <p className="text-white/60 text-sm mb-2">Max {maxSizeMB}MB, accepted: {accepted}</p>
      <p className="text-white/60 text-xs">Click to add cake photos</p>
      <input
        type="file"
        multiple
        accept={accepted}
        onChange={handleChange}
        className="hidden"
      />
      {error && <p className="mt-2 text-red-400 text-xs">{error}</p>}
    </div>
  );
};

interface DateTimeProps {
  blockedDates: string[];
  minDate: string;
  onSelect: (date: string) => void;
}

const DateTimePicker: React.FC<DateTimeProps> = ({ blockedDates, minDate, onSelect }) => {
  return (
    <div>
      <label className="block text-sm mb-1">
        Pickup date
        <span className="text-white/50 text-xs">(min {minDate})</span>
      </label>
      <input
        type="date"
        min={minDate}
        className="w-full rounded border p-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary"
        onChange={(e) => onSelect(e.target.value)}
      />
      {blockedDates.length > 0 && (
        <div className="mt-2 text-xs text-red-400">
          Blocked: {blockedDates.join(", ")}
        </div>
      )}
    </div>
  );
};

// --- CakeBuilder component ---

export interface DeliveryZoneInfo {
  id: string;
  name: string;
  fee: number;
}

interface CakeFormState {
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
  deliveryZone: DeliveryZoneInfo | null;
  step: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

const MAX_PHOTO_SIZE_MB = 5;
const MAX_BLOCKED_PHOTOS = 3;

export const CakeBuilder: React.FC = () => {
  // Fetch data
  const [sizes, setSizes] = useState<{ id: string; kg: number }[]>([]);
  const [tiers, setTiers] = useState<{ id: string; name: string; extra_fee: number; requires_quote: boolean }[]>([]);
  const [zones, setZones] = useState<DeliveryZoneInfo[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [settings, setSettings] = useState<OrderSettings>({
    min_lead_days: 2,
    daily_limit: 6,
    deposit_percent: 50,
    deposit_threshold_kg: 3,
  });

  useEffect(() => {
    ;(async () => {
      const [s, t, z, b, o] = await Promise.all([
        getSizes(),
        getDesignTiers(),
        getDeliveryZones(),
        getBlockedDates(),
        getOrderSettings(),
      ]);
      setSizes(s.map((size) => ({ id: size.id, kg: size.kg })));
      setTiers(
        t.map((tier) => ({
          id: tier.id,
          name: tier.name,
          extra_fee: tier.extra_fee,
          requires_quote: tier.requires_quote,
        })),
      );
      setZones(z);
      setBlockedDates(b);
      setSettings(o);
    })();
  }, []);

  // Form state
  const [form, setForm] = useState<CakeFormState>({
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
    deliveryZone: null,
    step: 1,
  });

  // Derived computed values
  const basePrice = form.kg * form.flavourPricePerKg + form.tierExtraFee;
  const deposit = depositParity(
    form.kg >= settings.deposit_threshold_kg,
    form.tierName !== "Simple",
    basePrice,
    settings.deposit_percent,
  );
  const canDeposit = deposit > 0; // parity with server — no quote-only branch

  // Build cart item with ALL required CakeCartItem fields
  const cartItem = {
    kind: "cake" as const,
    flavourId: form.flavourId || "",
    flavourName: form.flavourName,
    flavourPricePerKg: form.flavourPricePerKg,
    kg: form.kg,
    tierId: form.tierId || "",
    tierName: form.tierName,
    tierExtraFee: form.tierExtraFee,
    tierRequiresQuote: form.tierRequiresQuote,
    sizeId: form.sizeId || "",
    designDescription: form.designDescription,
    cakeMessage: form.cakeMessage,
    allergies: form.allergies,
    referencePhotos: form.referencePhotos,
    dateNeeded: form.pickupDate,
    deliveryZone: form.deliveryZone,
  };

  const total = cartTotal([cartItem]);

  // Pre-computed display strings
  const tierDisplayText = form.tierId
    ? `Tier: ${tiers.find((t) => t.id === form.tierId)?.name} ${form.tierExtraFee > 0 ? `KES ${form.tierExtraFee.toLocaleString()}` : ""}`
    : "";
  const flavourDisplayText = form.flavourId ? form.flavourName : "";

  // Step navigation
  const nextStep = (): void => {
    switch (form.step) {
      case 1:
        if (!form.sizeId) return;
        return;
      case 2:
        if (!form.flavourId) return;
        return;
      case 3:
        if (!form.tierId) return;
        return;
      case 4:
        return;
      case 5:
        if (!form.cakeMessage.length) return;
        return;
      case 6:
        if (!form.pickupDate) return;
        return;
      case 7: {
        const store = createCartStore();
        store.getState().addCake({
          flavourId: form.flavourId!,
          flavourName: form.flavourName,
          flavourPricePerKg: form.flavourPricePerKg,
          sizeId: form.sizeId!,
          kg: form.kg,
          tierId: form.tierId!,
          tierName: form.tierName,
          tierExtraFee: form.tierExtraFee,
          tierRequiresQuote: form.tierRequiresQuote,
          designDescription: form.designDescription,
          cakeMessage: form.cakeMessage,
          allergies: form.allergies,
          referencePhotos: form.referencePhotos,
          dateNeeded: form.pickupDate ?? null,
          deliveryZone: form.deliveryZone,
        });
        window.location.href = "/cart";
        return;
      }
      default:
        return;
    }
  };

  const prevStep = (): void => {
    if (form.step > 1) setForm((prev) => ({ ...prev, step: prev.step - 1 }));
  };

  const goToStep = (step: number): void => {
    setForm({ ...form, step: step as 1 | 2 | 3 | 4 | 5 | 6 | 7 });
  };

  // Handlers
  const handleSizeChange = (sizeId: string) =>
    setForm((prev) => ({ ...prev, sizeId, kg: sizes.find((s) => s.id === sizeId)?.kg || 1 }));

  const handleFlavourChange = (flavourId: string, flavourName: string, flavourPricePerKg: number) =>
    setForm((prev) => ({ ...prev, flavourId, flavourName, flavourPricePerKg }));

  const handleTierChange = (tierId: string) =>
    setForm((prev) => {
      const newTier = tiers.find((t) => t.id === tierId);
      if (!newTier) return prev;
      return {
        ...prev,
        tierId,
        tierName: newTier.name,
        tierExtraFee: newTier.extra_fee,
        tierRequiresQuote: newTier.requires_quote,
      };
    });

  const handlePhotoSelect = (photos: string[]) =>
    setForm((prev) => ({ ...prev, referencePhotos: photos }));

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, cakeMessage: e.target.value }));

  const handleAllergiesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, allergies: e.target.value }));

  const handleDateChange = (date: string) =>
    setForm((prev) => ({ ...prev, pickupDate: date }));

  const handleZoneChange = (zone: DeliveryZoneInfo) =>
    setForm((prev) => ({ ...prev, deliveryZone: zone }));

  // Compute lead date validity
  const minLeadDate = new Date();
  minLeadDate.setDate(minLeadDate.getDate() + settings.min_lead_days);
  const minLeadString = minLeadDate.toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-700 py-4">
        <h1 className="text-2xl font-bold">Build Your Cake</h1>
      </header>

      <main className="p-4">
        {/* Progress indicator */}
        <div className="flex justify-between text-sm mb-6">
          {[
            "Size",
            "Flavour",
            "Design Tier",
            "Photo",
            "Message",
            "Date/Time",
            "Review",
          ].map((label, i) => (
            <div key={label}>
              <span
                className={
                  i < form.step
                    ? "text-primary font-medium"
                    : i === form.step - 1
                    ? "text-white/60"
                    : "text-gray-400"
                }
              >
                {label}
              </span>
              {i < 6 && (
                <span className="mx-2">
                  {i < form.step - 1 ? "✓" : i === form.step - 1 ? "→" : ""}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="space-y-6">
          {/* Step 1: Size */}
          {form.step === 1 && (
            <div>
              <h2 className="text-lg font-medium mb-4">Cake Size</h2>
              <div className="grid grid-cols-2 gap-2">
                {sizes.map((size) => (
                  <SizeButton
                    key={size.id}
                    size={size}
                    onSelect={() => handleSizeChange(size.id)}
                    isSelected={form.sizeId === size.id}
                  />
                ))}
              </div>
              {form.sizeId && (
                <p className="mt-2 text-white/60">Selected: {sizes.find((s) => s.id === form.sizeId)?.kg}kg</p>
              )}
            </div>
          )}

          {/* Step 2: Flavour */}
          {form.step === 2 && (
            <div>
              <h2 className="text-lg font-medium mb-4">Flavour Selection</h2>
              <div className="grid grid-cols-2 gap-3">
                <FlavourCard
                  key="rv"
                  flavourName="Red Velvet"
                  flavourPricePerKg={3200}
                  onSelect={() => handleFlavourChange("f1", "Red Velvet", 3200)}
                  isSelected={form.flavourId === "f1"}
                />
                <FlavourCard
                  key="ch"
                  flavourName="Chocolate"
                  flavourPricePerKg={3200}
                  onSelect={() => handleFlavourChange("f2", "Chocolate", 3200)}
                  isSelected={form.flavourId === "f2"}
                />
              </div>
            </div>
          )}

          {/* Step 3: Design Tier */}
          {form.step === 3 && (
            <div>
              <h2 className="text-lg font-medium mb-4">Design Tier</h2>
              <div className="grid grid-cols-2 gap-3">
                {tiers.map((tier) => (
                  <TierRadio
                    key={tier.id}
                    tier={tier}
                    onSelect={() => handleTierChange(tier.id)}
                    isSelected={form.tierId === tier.id}
                  />
                ))}
              </div>
              {form.tierId && (
                <p className="mt-2 text-white/60">{tierDisplayText}</p>
              )}
            </div>
          )}

          {/* Step 4: Photo Upload */}
          {form.step === 4 && (
            <div>
              <h2 className="text-lg font-medium mb-4">Cake Photos</h2>
              <PhotoUpload
                onSelect={handlePhotoSelect}
                accepted="image/*"
                maxSizeMB={MAX_PHOTO_SIZE_MB}
              />
              {form.referencePhotos.length > 0 && (
                <div className="mt-3 text-white/60 text-xs">
                  {form.referencePhotos.length} photo(s) selected
                </div>
              )}
              {form.referencePhotos.length >= MAX_BLOCKED_PHOTOS && (
                <p className="mt-2 text-red-500 text-xs">
                  Maximum {MAX_BLOCKED_PHOTOS} photos allowed
                </p>
              )}
            </div>
          )}

          {/* Step 5: Message & Allergies */}
          {form.step === 5 && (
            <div>
              <h2 className="text-lg font-medium mb-4">Message & Allergies</h2>
              <textarea
                rows={3}
                placeholder="Personal message for the cake (optional)"
                className="w-full rounded border p-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary mb-3 resize-y"
                value={form.cakeMessage}
                onChange={handleMessageChange}
              />
              <textarea
                rows={3}
                placeholder="Allergies (com comma-separated, optional)"
                className="w-full rounded border p-2 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.allergies}
                onChange={handleAllergiesChange}
              />
            </div>
          )}

          {/* Step 6: Date & Time */}
          {form.step === 6 && (
            <div>
              <h2 className="text-lg font-medium mb-4">Pickup Date & Time</h2>
              <DateTimePicker
                blockedDates={blockedDates}
                minDate={minLeadString}
                onSelect={handleDateChange}
              />
            </div>
          )}

          {/* Step 7: Review & Confirm */}
          {form.step === 7 && (
            <div>
              <h2 className="text-lg font-medium mb-4">Order Summary</h2>
              <div className="space-y-4">
                <div>
                  <span className="font-medium">Size:</span>
                  {form.sizeId ? sizes.find((s) => s.id === form.sizeId)?.kg + "kg" : "Not selected"}
                </div>
                <div>
                  <span className="font-medium">Flavour:</span>
                  {form.flavourId ? form.flavourName : "Not selected"}
                </div>
                <div>
                  <span className="font-medium">Design Tier:</span>
                  {form.tierId ? tiers.find((t) => t.id === form.tierId)?.name : "Not selected"}
                </div>
                <div>
                  <span className="font-medium">Price:</span>
                  <span className="text-primary">KES {total.toLocaleString()}</span>
                </div>
                <div>
                  <span className="font-medium">Deposit:</span>
                  <span className="text-primary">KES {deposit.toLocaleString()}</span>
                  {canDeposit ? " (50% deposit required)" : " (no deposit)"}
                </div>
                {form.referencePhotos.length > 0 && (
                  <div>
                    <span className="font-medium">Photos:</span>
                    {form.referencePhotos.length} image(s)
                  </div>
                )}
              </div>

              {/* Add to Cart button */}
              <button
                onClick={nextStep}
                className="w-full py-3 rounded bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
                disabled={!canProgress[6]}
              >
                {form.referencePhotos.length > 0 ? "Add to Cart" : "Please select cake photos first"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
