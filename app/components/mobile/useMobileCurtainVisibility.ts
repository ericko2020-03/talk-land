// path: app/components/mobile/useMobileCurtainVisibility.ts
"use client";

import { useEffect, useRef, useState } from "react";

type Options = {
  threshold?: number;
};

export default function useMobileCurtainVisibility(
  options: Options = {}
): boolean {
  const { threshold = 10 } = options;

  const [visible, setVisible] = useState(true);
  const lastYRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    lastYRef.current = window.scrollY || 0;
    let ticking = false;

    const update = () => {
      const currentY = window.scrollY || 0;
      const delta = currentY - lastYRef.current;

      // 頂部時一律顯示
      if (currentY <= 0) {
        setVisible(true);
        lastYRef.current = currentY;
        ticking = false;
        return;
      }

      // 小幅移動忽略，避免抖動
      if (Math.abs(delta) < threshold) {
        ticking = false;
        return;
      }

      if (delta > 0) {
        // 往下捲：隱藏
        setVisible(false);
      } else {
        // 往上捲：顯示
        setVisible(true);
      }

      lastYRef.current = currentY;
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [threshold]);

  return visible;
}