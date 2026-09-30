import { setInviteShareFallback } from "./invite-share-fallback.ts";
import { toast } from "sonner";
import { issueTripInvite } from "../../app/api-client.ts";
import { TripIdSchema } from "../../core/domain/ids.ts";
import { platform, type ShareOutcome } from "../../platform/index.ts";

export async function shareTripInvite(
  tripId: string,
): Promise<ShareOutcome | "failed"> {
  try {
    const { token } = await issueTripInvite(TripIdSchema.make(tripId));
    const url = `${window.location.origin}/invites/${encodeURIComponent(token)}`;
    // 플랫폼 공유 실패도 이미 발급된 링크로 복구한다.
    const outcome = await platform.share({
      title: "Galanda 여행 초대",
      text: "여행방에 참여해 주세요.",
      url,
    }).catch(() => "unsupported" as const);

    if (outcome === "shared") toast("초대 링크를 공유했어요.");
    if (outcome === "copied") toast("초대 링크를 복사했어요.");
    if (outcome === "unsupported") {
      setInviteShareFallback(url);
    }
    return outcome;
  } catch {
    toast.error("초대 링크를 만들지 못했어요. 다시 시도해주세요.");
    return "failed";
  }
}
