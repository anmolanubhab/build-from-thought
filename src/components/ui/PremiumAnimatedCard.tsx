// path: src/components/ui/PremiumAnimatedCard.tsx
//
// Reusable "premium" wrapper: adds a slowly-rotating purple -> blue -> cyan
// gradient outline (plus a hover glow/lift) around whatever it wraps,
// without touching the wrapped element's own background, padding, or
// layout. Meant for upgrade/premium CTAs (Upgrade to Pro, referral cards,
// etc.) — drop an existing card/button/row in as `children` unchanged:
//
//   <PremiumAnimatedCard radiusClassName="rounded-lg">
//     <div className="...">Upgrade to Pro</div>
//   </PremiumAnimatedCard>
//
// How the border works: a single continuously-running animation drives the
// whole effect, and it only ever animates `transform` (never background,
// width, or a custom-property angle) so it stays on the compositor thread:
//   1. An oversized layer filled with a conic-gradient sits behind the
//      content and spins via `animate-premium-border-spin` (transform:
//      rotate — see src/index.css).
//   2. Its own wrapper is exactly `radiusClassName` + 1.5px of padding and
//      has `overflow-hidden`, which clips that spinning layer down to a
//      thin ring — so what you actually see is a 1.5px gradient outline
//      that appears to travel around the edge.
//   3. The wrapped content sits in an opaque layer on top, covering
//      everything but that 1.5px ring, so its own background is untouched.
// Hover (scale + glow + shadow) lives one level further out, so the glow
// is free to bleed past the card's edges instead of being clipped by the
// ring-clipping `overflow-hidden` layer.
import * as React from "react";
import { cn } from "@/lib/utils";

const PREMIUM_GRADIENT =
  "conic-gradient(from 0deg, #A855F7 0deg, #3B82F6 120deg, #06B6D4 240deg, #A855F7 360deg)";

export interface PremiumAnimatedCardProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Rounded-corner utility class to match whatever is being wrapped, so the
   * animated ring lines up exactly with the wrapped element's own corners.
   * Defaults to "rounded-lg".
   */
  radiusClassName?: string;
  /** Render as a different element (e.g. "span") instead of the default "div". */
  as?: keyof JSX.IntrinsicElements;
}

export const PremiumAnimatedCard = React.forwardRef<HTMLElement, PremiumAnimatedCardProps>(
  ({ children, className, radiusClassName = "rounded-lg", as = "div", ...props }, ref) => {
    const Comp = as as React.ElementType;

    return (
      <Comp
        ref={ref}
        className={cn(
          // Outer layer: owns hover scale/shadow only — deliberately has no
          // overflow-hidden of its own, so the glow below can bleed outward.
          "group relative inline-block cursor-pointer transition-transform duration-300 ease-out will-change-transform",
          "hover:scale-[1.02]",
          "motion-reduce:transition-none motion-reduce:hover:scale-100",
          className,
        )}
        {...props}
      >
        {/* Hover glow — opacity-only transition, stays compositor-friendly. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -inset-2 -z-10 opacity-0 blur-xl transition-opacity duration-300 ease-out",
            "group-hover:opacity-60",
            radiusClassName,
          )}
          style={{ backgroundImage: PREMIUM_GRADIENT }}
        />

        {/* Shadow layer — separate from the glow so both requirements
            ("stronger glow" + "shadow transition") are independently visible. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 -z-10 opacity-0 shadow-[0_12px_32px_-8px_rgba(59,130,246,0.55)] transition-opacity duration-300 ease-out",
            "group-hover:opacity-100",
            radiusClassName,
          )}
        />

        {/* Ring clipper: 1.5px padding + overflow-hidden turns the oversized
            spinning gradient behind it into a thin animated outline. */}
        <div
          className={cn("relative isolate overflow-hidden p-[1.5px]", radiusClassName)}
        >
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-[-150%] animate-premium-border-spin motion-reduce:animate-none",
            )}
            style={{ backgroundImage: PREMIUM_GRADIENT }}
          />

          {/* Opaque content layer — sits above the ring, keeping the
              wrapped element's own background/padding/spacing untouched. */}
          <span className={cn("relative z-10 block h-full w-full overflow-hidden", radiusClassName)}>
            {children}
          </span>
        </div>
      </Comp>
    );
  },
);
PremiumAnimatedCard.displayName = "PremiumAnimatedCard";

export default PremiumAnimatedCard;
