"use client";

import { useState } from "react";

const INTERESTS = [
  { value: "art", emoji: "🎨", label: "Art Classes" },
  { value: "tidepools", emoji: "🌊", label: "Tidepools" },
  { value: "hikes", emoji: "🌿", label: "Hikes" },
  { value: "science", emoji: "🔬", label: "Science" },
];

/* 16px on touch widths — iOS zooms into any input below 16px on focus. */
const INPUT_CLASSES =
  "rounded-tile w-full border-[1.5px] border-lavender bg-cream px-4 py-[13px] text-[16px] text-dark transition-colors duration-fast outline-none focus:border-purple focus:bg-white md:text-base";

/**
 * The interest-list form. Client-side only by decision: submit swaps the
 * form for the success state and no data leaves the page — wiring a real
 * destination (email/sheet/service) is a future slice.
 *
 * Its own module because two routes render it: the landing page wraps it in
 * a teaser column, and /community renders it alone. The caller owns the
 * width it sits in; this module owns the card.
 */
export function InterestListForm() {
  const [submitted, setSubmitted] = useState(false);

  return (
    // min-h ≈ the rendered form, so the success swap doesn't collapse the
    // card and yank the page while the user is looking at it.
    <div className="rounded-card shadow-card min-h-140 bg-white p-9">
      {submitted ? (
        <div
          role="status"
          className="flex min-h-120 flex-col justify-center px-5 py-10 text-center"
        >
          <span aria-hidden="true" className="mb-4 block text-[52px]">
            🎉
          </span>
          <h3 className="mb-2 text-[22px] font-black italic">
            You&apos;re in!
          </h3>
          <p className="leading-normal text-base text-fog">
            We&apos;ll be in touch soon with updates, new classes and coastal
            adventures.
          </p>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
          }}
        >
          <div className="mb-4.5">
            <label
              htmlFor="community-name"
              className="mb-2 block text-2xs font-extrabold tracking-wider uppercase"
            >
              Your name
            </label>
            <input
              id="community-name"
              name="name"
              type="text"
              required
              placeholder="First and last name"
              className={INPUT_CLASSES}
            />
          </div>
          <div className="mb-4.5">
            <label
              htmlFor="community-email"
              className="mb-2 block text-2xs font-extrabold tracking-wider uppercase"
            >
              Email
            </label>
            <input
              id="community-email"
              name="email"
              type="email"
              required
              placeholder="you@email.com"
              className={INPUT_CLASSES}
            />
          </div>
          <div className="mb-4.5">
            <label
              htmlFor="community-ages"
              className="mb-2 block text-2xs font-extrabold tracking-wider uppercase"
            >
              Kids&apos; ages
            </label>
            <input
              id="community-ages"
              name="ages"
              type="text"
              placeholder="e.g. 6, 9, 12"
              className={INPUT_CLASSES}
            />
          </div>
          <fieldset className="mb-4.5">
            <legend className="mb-2 block text-2xs font-extrabold tracking-wider uppercase">
              Interested in
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {INTERESTS.map(({ value, emoji, label }) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 text-sm font-bold"
                >
                  <input
                    type="checkbox"
                    name="interest"
                    value={value}
                    className="size-4 accent-purple"
                  />
                  <span aria-hidden="true">{emoji}</span> {label}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="submit"
            className="rounded-pill mt-6 w-full cursor-pointer bg-purple p-[15px] text-base font-black tracking-[0.06em] text-white transition-colors duration-fast hover:bg-purple-deep"
          >
            Join the community →
          </button>
        </form>
      )}
    </div>
  );
}
