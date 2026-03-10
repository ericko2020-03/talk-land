// path: app/components/mobile/MobileCurtainFrame.tsx
"use client";

import type { ReactNode } from "react";
import MobileTopCurtain from "./MobileTopCurtain";
import MobileBottomCurtain from "./MobileBottomCurtain";
import useMobileCurtainVisibility from "./useMobileCurtainVisibility";

type MobileCurtainFrameProps = {
  children: ReactNode;
  isAdmin: boolean;
  containerClassName: string;
};

export default function MobileCurtainFrame({
  children,
  isAdmin,
  containerClassName,
}: MobileCurtainFrameProps) {
  const visible = useMobileCurtainVisibility({ threshold: 10 });

  return (
    <>
      <MobileTopCurtain visible={visible} isAdmin={isAdmin} />
      <MobileBottomCurtain visible={visible} />

      <main
        className={[
          containerClassName,
          "as-mobile-content-frame sm:pt-0 sm:pb-0",
        ].join(" ")}
      >
        {children}
      </main>
    </>
  );
}