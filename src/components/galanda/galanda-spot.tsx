export type GalandaSpotName = "empty-trips" | "empty-saved" | "create-trip" | "invite-companions" | "compare-plans" | "confirm-plan";

/** Decorative: the adjacent PageState text owns the meaning. */
export function GalandaSpot({ name }: { readonly name: GalandaSpotName }) {
  const base = `${import.meta.env.BASE_URL}assets/galanda/spots/${name}`;
  // These dimensional assets have their own calibrated dark palette. Keep the
  // legacy outline lift on the other three illustrations until they are updated.
  const hasCalibratedDarkPalette = name === "empty-trips" || name === "create-trip" || name === "empty-saved";

  return (
    <span className="inline-flex size-32 shrink-0" aria-hidden="true" data-slot="galanda-spot" data-spot={name}>
      <img className="block dark:hidden" src={`${base}-light.svg`} width={128} height={128} alt="" decoding="async" />
      <img className={hasCalibratedDarkPalette ? "hidden dark:block" : "hidden brightness-125 dark:block"} src={`${base}-dark.svg`} width={128} height={128} alt="" decoding="async" />
    </span>
  );
}
