// path: app/components/mobile/MobileBottomCurtain.tsx
"use client";

type MobileBottomCurtainProps = {
  visible: boolean;
};

export default function MobileBottomCurtain({
  visible,
}: MobileBottomCurtainProps) {
  return (
    <div
      className={[
        "as-mobile-curtain-bottom fixed z-40 border-t border-white/10 bg-black/85 text-white backdrop-blur-sm transition-transform duration-200 ease-out sm:hidden",
        visible ? "translate-y-0" : "translate-y-full",
      ].join(" ")}
    >
      <div className="flex h-[var(--as-mobile-bottom-curtain-h)] items-center justify-center px-3">
        <div className="text-xs text-white/50"> </div>
      </div>
    </div>
  );
}