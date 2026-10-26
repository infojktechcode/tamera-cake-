"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatKES } from "@/lib/format";

export interface ShareableProduct {
  name: string;
  slug: string;
  kind: "cake" | "pastry";
  price: number;
}

export function ShareTools({
  products,
  siteUrl,
}: {
  products: ShareableProduct[];
  siteUrl: string;
}) {
  const [slug, setSlug] = useState(products[0]?.slug ?? "");
  const [qrData, setQrData] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const product = products.find((item) => item.slug === slug);
  const url = useMemo(
    () => product ? `${siteUrl}/p/${encodeURIComponent(product.slug)}` : `${siteUrl}/cakes`,
    [product, siteUrl],
  );
  const message = product
    ? `Take a look at ${product.name} from Tamera's Cakes & Bakery.`
    : "Browse cakes from Tamera's Cakes & Bakery.";
  const whatsappMessage = `${message} ${url}`;

  useEffect(() => {
    let current = true;
    void QRCode.toDataURL(url, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#3A2620", light: "#FFFFFF" },
    }).then(
      (data) => {
        if (current) setQrData(data);
      },
      (cause: unknown) => {
        if (current) setError(cause instanceof Error ? cause.message : "Could not create the QR code.");
      },
    );
    return () => {
      current = false;
    };
  }, [url]);

  async function copyLink() {
    setError("");
    setNotice("");
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Link copied.");
    } catch {
      setError("Could not copy the link. Select and copy it from the address below.");
    }
  }

  async function shareMore() {
    setError("");
    setNotice("");
    if (!navigator.share) {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    try {
      await navigator.share({ title: product?.name ?? "Tamera's Cakes & Bakery", text: message, url });
      setNotice("Share options opened.");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError("Could not open the share options.");
    }
  }

  async function downloadPrintPdf() {
    if (!qrData) return;
    setError("");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a5" });
      pdf.setTextColor("#3A2620");
      pdf.setFontSize(20);
      pdf.text("Tamera's Cakes & Bakery", 15, 24);
      pdf.setFontSize(13);
      pdf.text(product?.name ?? "Browse our cakes", 15, 36);
      if (product) {
        pdf.setFontSize(11);
        pdf.text(formatKES(product.price), 15, 44);
      }
      pdf.addImage(qrData, "PNG", 47.5, 54, 60, 60);
      pdf.setFontSize(10);
      pdf.text("Scan to view and order", 74.5, 121, { align: "center" });
      pdf.setFontSize(8);
      const lines = pdf.splitTextToSize(url, 110) as string[];
      pdf.text(lines, 47.5, 132);
      pdf.save(`tamera-${product?.slug ?? "cakes"}-qr.pdf`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the print PDF.");
    }
  }

  function downloadPng() {
    if (!qrData) return;
    const link = document.createElement("a");
    link.href = qrData;
    link.download = `tamera-${product?.slug ?? "cakes"}-qr.png`;
    link.click();
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          No available products to share yet. Make a product available in Products first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>Choose what to share</CardTitle>
          <p className="text-sm text-ink-muted">
            Product pages include a WhatsApp preview and an order link.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="grid gap-1 text-sm font-medium">
            Product
            <select
              value={slug}
              onChange={(event) => {
                setError("");
                setNotice("");
                setQrData("");
                setSlug(event.target.value);
              }}
              className="min-h-11 rounded-xl border border-cocoa/20 bg-white px-3"
            >
              {products.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name} · {item.kind}
                </option>
              ))}
            </select>
          </label>
          <div className="break-all rounded-xl bg-vanilla p-3 text-sm" aria-label="Share link">
            {url}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={copyLink}>Copy link</Button>
            <Button
              variant="outline"
              onClick={() => window.open(
                `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`,
                "_blank",
                "noopener,noreferrer",
              )}
            >
              Share on WhatsApp
            </Button>
            <Button variant="outline" onClick={shareMore}>More share options</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>QR code</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-center">
          {qrData ? (
            // Generated locally from a public product URL; no image is uploaded.
            <Image
              src={qrData}
              width={240}
              height={240}
              unoptimized
              alt={`QR code for ${product?.name ?? "the cake catalogue"}`}
            />
          ) : (
            <p className="py-20 text-sm text-ink-muted">Creating QR code…</p>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={downloadPng} disabled={!qrData}>Download PNG</Button>
            <Button size="sm" variant="outline" onClick={downloadPrintPdf} disabled={!qrData}>
              Print-ready PDF
            </Button>
          </div>
        </CardContent>
      </Card>
      {error && <p role="alert" className="text-sm text-red-700 lg:col-span-2">{error}</p>}
      {notice && <p role="status" className="text-sm text-ink-muted lg:col-span-2">{notice}</p>}
    </div>
  );
}
