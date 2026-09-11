"use client";

/**
 * PROTOTYPE — throwaway. See `NOTES.md` in this directory.
 *
 * A compact select for the top bar, standing in for `AreaSelector` and adding
 * the beach control the bar needs.
 *
 * **Not a reuse of `AreaSelector`**, and the reason is height. That control
 * stacks a block label over a `py-3` pill — about 80px — which is a page
 * header's shape, not a toolbar's. Here the label sits inline and small, and
 * the row owns the rhythm.
 *
 * `TOUCH_TARGET` is kept: ADR-0004's 44px floor below `md` is a rule about the
 * reader's finger, not about which layout is in fashion, and a bar is exactly
 * where a control gets quietly shrunk past it.
 *
 * The `noscript` list is kept for the same reason `AreaSelector` carries one —
 * a `select` that navigates needs JavaScript, and a family checking the tide
 * on a blocked phone would otherwise get a control that silently does nothing.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { TOUCH_TARGET } from "../../ui/touchTarget";

export type BarOption = {
  /** Where choosing this goes. */
  href: string;
  label: string;
  /** What `defaultValue` matches on. */
  value: string;
};

export function BarSelect({
  id,
  label,
  options,
  current,
}: {
  id: string;
  label: string;
  options: readonly BarOption[];
  current: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  // Carry the variant across the navigation. Without this, choosing a beach
  // lands on the shipped layout and the bar being judged disappears mid-test.
  const variant = params.get("variant");
  const hrefFor = (value: string) => {
    const href = options.find((option) => option.value === value)?.href;
    if (href === undefined) return undefined;
    return variant === null ? href : `${href}?variant=${variant}`;
  };

  return (
    <div className="flex items-center gap-2">
      <label
        className="text-2xs font-extrabold tracking-widest text-ocean uppercase"
        htmlFor={id}
      >
        {label}
      </label>
      <select
        id={id}
        name={id}
        className={`rounded-pill ${TOUCH_TARGET} border-2 border-lavender bg-white px-4 py-2 text-base font-bold`}
        defaultValue={current}
        onChange={(event) => {
          const href = hrefFor(event.target.value);
          // Never navigate to a value that is not in the table: a missing href
          // means the option list and the current value have drifted, and
          // going nowhere is better than guessing a URL.
          if (href !== undefined) router.push(href);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <noscript>
        <ul className="text-base text-fog">
          {options.map((option) => (
            <li key={option.value}>
              <a href={option.href}>{option.label}</a>
            </li>
          ))}
        </ul>
      </noscript>
    </div>
  );
}
