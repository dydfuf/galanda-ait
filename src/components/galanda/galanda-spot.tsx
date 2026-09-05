export type GalandaSpotName = "empty-trips" | "empty-saved";

/** Decorative: the adjacent PageState text owns the meaning. */
export function GalandaSpot({ name }: { readonly name: GalandaSpotName }) {
  const base = `${import.meta.env.BASE_URL}assets/galanda/spots/${name}`;

  return (
    <span className="inline-flex shrink-0" aria-hidden="true">
      <img className="block dark:hidden" src={`${base}-light.svg`} width={128} height={128} alt="" decoding="async" />
      {/* Lift fine outlines on dark surfaces at the actual 128px display size. */}
      <img className="hidden brightness-125 dark:block" src={`${base}-dark.svg`} width={128} height={128} alt="" decoding="async" />
    </span>
  );
}
