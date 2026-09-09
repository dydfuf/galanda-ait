export type GalandaSpotName = "empty-trips" | "empty-saved" | "create-trip" | "invite-companions" | "compare-plans" | "confirm-plan" | "empty-explore" | "empty-search";

/** Decorative: the adjacent text owns the meaning. */
export function GalandaSpot({ name }: { readonly name: GalandaSpotName }) {
  const base = `${import.meta.env.BASE_URL}assets/galanda/spots/${name}`;

  return (
    <span className="inline-flex size-32 shrink-0" aria-hidden="true" data-slot="galanda-spot" data-spot={name}>
      <img className="block dark:hidden" src={`${base}-light.svg`} width={128} height={128} alt="" decoding="async" />
      <img className="hidden dark:block" src={`${base}-dark.svg`} width={128} height={128} alt="" decoding="async" />
    </span>
  );
}
