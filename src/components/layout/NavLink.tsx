"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * Nav link that marks the current page for AT and styling. aria-current is
 * the seam: styles target aria-[current=page] instead of a second "active"
 * prop that could drift from the real location.
 */
export function NavLink(props: ComponentProps<typeof Link>) {
  const pathname = usePathname();

  return (
    <Link
      aria-current={pathname === props.href ? "page" : undefined}
      {...props}
    />
  );
}
