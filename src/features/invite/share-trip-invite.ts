import { toast } from "sonner";
import { issueTripInvite } from "../../app/api-client.ts";
import { TripIdSchema } from "../../core/domain/ids.ts";
import { platform, type ShareOutcome } from "../../platform/index.ts";

export async function shareTripInvite(
  tripId: string,
): Promise<ShareOutcome | "failed"> {
  try {
    const { token } = await issueTripInvite(TripIdSchema.make(tripId));
    const outcome = await platform.share({
      title: "Galanda 여행 초대",
      text: "여행방에 참여해 주세요.",
      url: `${window.location.origin}/invites/${encodeURIComponent(token)}`,
    });

    if (outcome === "shared") toast("초대 링크를 공유했어요.");
    if (outcome === "copied") toast("초대 링크를 복사했어요.");
    if (outcome === "unsupported") {
      toast("공유를 지원하지 않는 환경이에요. 토스 앱에서 다시 시도해 주세요.");
    }
    return outcome;
  } catch {
    toast.error("초대 링크를 만들지 못했어요. 다시 시도해주세요.");
    return "failed";
  }
}
