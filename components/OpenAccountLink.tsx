"use client";

// Switch the account selector to one account and open a page under it — the
// Auto Trader cards' "positions" link. Same cookie AccountSwitcher sets.
import { useRouter } from "next/navigation";
import { ACCOUNT_COOKIE } from "@/lib/account-shared";

export function OpenAccountLink({ id, href, children }: { id: string; href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        document.cookie = `${ACCOUNT_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
        router.push(href);
      }}
      className="text-[11px] text-emerald-300 underline"
    >
      {children}
    </button>
  );
}
