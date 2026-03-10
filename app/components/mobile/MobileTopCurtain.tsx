// path: app/components/mobile/MobileTopCurtain.tsx
"use client";

import Link from "next/link";

type MobileTopCurtainProps = {
  visible: boolean;
  isAdmin: boolean;
};

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 3l7 4v5c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V7l7-4z" />
      <path d="M9.5 12l1.5 1.5 3.5-3.5" />
    </svg>
  );
}

export default function MobileTopCurtain({
  visible,
  isAdmin,
}: MobileTopCurtainProps) {
  return (
    <div
      className={[
        "as-mobile-curtain-top fixed z-40 border-b border-white/10 bg-black/85 text-white backdrop-blur-sm transition-transform duration-200 ease-out sm:hidden",
        visible ? "translate-y-0" : "-translate-y-full",
      ].join(" ")}
    >
      <div className="flex h-[var(--as-mobile-top-curtain-h)] items-center justify-between px-3">
        <div className="min-w-0 pr-3">
          <div className="truncate text-base font-semibold">Allensay_s 社群</div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="搜尋"
            title="搜尋"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10 active:bg-white/15"
          >
            <SearchIcon />
          </button>

          {isAdmin ? (
            <Link
              href="/admin/posts"
              aria-label="後台管理"
              title="後台管理"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10 active:bg-white/15"
            >
              <AdminIcon />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}