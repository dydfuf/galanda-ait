export type GalandaSpotName = "empty-trips" | "empty-saved" | "create-trip" | "invite-companions" | "compare-plans" | "confirm-plan" | "empty-explore" | "empty-search";

/** Decorative: the adjacent text owns the meaning. */
export function GalandaSpot({ name }: { readonly name: GalandaSpotName }) {
  const src = `${import.meta.env.BASE_URL}assets/galanda/spots-3d/${name}.webp`;

  return (
    <span className="inline-flex size-32 shrink-0" aria-hidden="true" data-slot="galanda-spot" data-spot={name}>
      <img className="block size-32 object-contain" src={src} width={128} height={128} alt="" decoding="async" />
    </span>
  );
}
