"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { IMAGE_BLUR_DATA_URL } from "@/lib/blur";

// Decorative hero image: showcase 08 so the hero never duplicates the four
// featured cards (they come from showcase 01–04 by sort_order).
const HERO_IMAGE = "/showcase/08-two-tier-celebration-cake.jpg";

/**
 * Hero image with a light scroll parallax (~40px of travel). The image box
 * overhangs its clipping container by 24px on every edge so the parallax
 * never reveals a gap. Global <MotionConfig reducedMotion="user"> in the root
 * layout governs motion preferences — no local flag here.
 */
export function HeroImage() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  // motion 14 clamps transformed values to the range by default, so progress
  // outside [0, 1] can't push the image past its 24px overhang.
  const y = useTransform(scrollYProgress, [0, 1], [-20, 20]);

  return (
    <div
      ref={ref}
      className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-cocoa/10 shadow-sm"
    >
      <motion.div style={{ y }} className="absolute inset-x-0 -inset-y-6">
        <Image
          src={HERO_IMAGE}
          alt="Two-tier celebration cake with piped cream decoration"
          fill
          sizes="(max-width: 640px) 100vw, 50vw"
          priority
          placeholder="blur"
          blurDataURL={IMAGE_BLUR_DATA_URL}
          className="object-cover"
        />
      </motion.div>
    </div>
  );
}
