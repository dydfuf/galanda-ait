import { useState } from "react";
import { Result } from "effect";
import { useNavigate, useParams } from "react-router-dom";
import { BottomAction } from "@/components/galanda/bottom-action.tsx";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import type {
  ConfirmedItinerary,
  ItineraryItemPatch,
} from "../../core/domain/confirmed-itinerary.ts";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import {
  isRevisionConflict,
  isStateConflict,
  toRevisionConflictMessage,
  toUserMessage,
} from "../common/error-message.ts";
import { useItineraryQuery } from "./queries.ts";
import { useReviseItineraryMutation } from "./mutations.ts";
import {
  getChangedItineraryPatches,
  rebaseItineraryPatches,
} from "./itinerary-editor-state.ts";

const toItineraryPatches = (itinerary: ConfirmedItinerary): ItineraryItemPatch[] =>
  itinerary.snapshot.items.map((item) =>
    item.type === "STAY"
      ? {
          type: "STAY",
          itemId: item.accommodation.id,
          date: item.date,
          endDate: item.endDate,
          hotelName: item.accommodation.hotelName,
          memo: item.memo,
        }
      : {
          type: "TRANSPORT",
          itemId: item.transport.id,
          date: item.date,
          fromCity: item.transport.fromCity,
          toCity: item.transport.toCity,
          mode: item.transport.mode,
          memo: item.memo,
        }
  );

function ItineraryEditor({
  tripId,
  itinerary,
  onRefresh,
}: {
  readonly tripId: string;
  readonly itinerary: ConfirmedItinerary;
  readonly onRefresh: () => Promise<ConfirmedItinerary | undefined>;
}) {
  const navigate = useNavigate();
  const mutation = useReviseItineraryMutation();
  const [basePatches, setBasePatches] = useState(() => toItineraryPatches(itinerary));
  const [patches, setPatches] = useState(() => toItineraryPatches(itinerary));
  const [conflictNotice, setConflictNotice] = useState<string>();
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const update = (index: number, patch: ItineraryItemPatch) =>
    setPatches((current) => [
      ...current.slice(0, index),
      patch,
      ...current.slice(index + 1),
    ]);
  const invalid = patches.some((patch) =>
    patch.type === "STAY"
      ? patch.date >= patch.endDate
      : !patch.fromCity.trim() || !patch.toCity.trim()
  );
  const changedPatches = getChangedItineraryPatches(basePatches, patches);
  const unchanged = changedPatches.length === 0;
  const save = async (): Promise<void> => {
    if (mutation.isPending || isResolvingConflict) return;
    setConflictNotice(undefined);
    try {
      await mutation.mutateAsync({
        tripId,
        patches: changedPatches,
        expectedRevision: itinerary.currentRevision,
      });
      navigate(`/trips/${tripId}/itinerary`, { replace: true });
    } catch (error: unknown) {
      if (isRevisionConflict(error) || isStateConflict(error)) {
        setIsResolvingConflict(true);
        const latest = await onRefresh();
        if (!latest) {
          setConflictNotice("최신 일정 상태를 불러오지 못했습니다. 다시 시도해주세요.");
        } else {
          const latestPatches = toItineraryPatches(latest);
          setPatches(rebaseItineraryPatches(basePatches, patches, latestPatches));
          setBasePatches(latestPatches);
          setConflictNotice(
            isRevisionConflict(error)
              ? `${toRevisionConflictMessage(error)} 내 변경만 최신 일정에 다시 적용했습니다.`
              : "여행 상태가 변경되어 최신 내용을 불러왔습니다."
          );
        }
        setIsResolvingConflict(false);
      }
    }
  };

  return (
    <PageBody withBottomAction className="mx-auto max-w-[640px] gap-4 py-4">
      <PageTitle
        title="확정 일정 수정"
        description={`현재 v${itinerary.currentRevision} · 저장하면 새 revision이 생성됩니다.`}
      />
      <div className="flex flex-col gap-4 px-(--app-inline-padding)">
        {patches.map((patch, index) => (
          <fieldset key={`${patch.type}-${patch.itemId}`} className="rounded-xl border p-4">
            <legend className="px-1 text-[15px] font-bold">
              {patch.type === "STAY" ? "숙소" : "이동"}
            </legend>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`date-${patch.itemId}`}>날짜</Label>
                <Input
                  id={`date-${patch.itemId}`}
                  type="date"
                  value={patch.date}
                  onChange={(event) => update(index, { ...patch, date: event.target.value })}
                />
              </div>
              {patch.type === "STAY" ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`end-${patch.itemId}`}>체크아웃 날짜</Label>
                    <Input
                      id={`end-${patch.itemId}`}
                      type="date"
                      value={patch.endDate}
                      onChange={(event) => update(index, { ...patch, endDate: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`hotel-${patch.itemId}`}>숙소</Label>
                    <Input
                      id={`hotel-${patch.itemId}`}
                      value={patch.hotelName}
                      onChange={(event) => update(index, { ...patch, hotelName: event.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`from-${patch.itemId}`}>출발</Label>
                      <Input
                        id={`from-${patch.itemId}`}
                        value={patch.fromCity}
                        onChange={(event) => update(index, { ...patch, fromCity: event.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`to-${patch.itemId}`}>도착</Label>
                      <Input
                        id={`to-${patch.itemId}`}
                        value={patch.toCity}
                        onChange={(event) => update(index, { ...patch, toCity: event.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`mode-${patch.itemId}`}>이동 수단</Label>
                    <Input
                      id={`mode-${patch.itemId}`}
                      value={patch.mode}
                      onChange={(event) => update(index, { ...patch, mode: event.target.value })}
                    />
                  </div>
                </>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`memo-${patch.itemId}`}>메모</Label>
                <Textarea
                  id={`memo-${patch.itemId}`}
                  value={patch.memo ?? ""}
                  onChange={(event) => update(index, { ...patch, memo: event.target.value })}
                />
              </div>
            </div>
          </fieldset>
        ))}
      </div>
      <BottomAction
        accessory={
          conflictNotice ? (
            <p className="text-center text-[13px] text-warning" role="alert">
              {conflictNotice}
            </p>
          ) : mutation.isError ? (
            <p className="text-center text-[13px] text-destructive">
              {toUserMessage(mutation.error, "일정을 저장하지 못했습니다.")}
            </p>
          ) : undefined
        }
      >
        <Button
          type="button"
          size="xl"
          disabled={invalid || unchanged || mutation.isPending || isResolvingConflict}
          onClick={() => void save()}
        >
          변경 저장
        </Button>
      </BottomAction>
    </PageBody>
  );
}

export function ItineraryEditPage(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  const validated = decodeRouteParams(TripParamsSchema, params);
  const tripId = Result.isSuccess(validated) ? validated.success.tripId : "";
  const query = useItineraryQuery(tripId);

  if (Result.isFailure(validated)) {
    return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  }
  if (query.isLoading) return <p className="p-5">확정 일정을 불러오는 중입니다...</p>;
  if (query.isError || !query.data) {
    return <RouteErrorFallback message={toUserMessage(query.error, "확정 일정을 불러오지 못했습니다.")} />;
  }
  if (query.data.status !== "CONFIRMED") {
    return <RouteErrorFallback message="수정할 확정 일정이 없습니다." />;
  }
  if (!query.data.canEdit) {
    return (
      <RouteErrorFallback
        title="수정 권한이 없습니다"
        message="방장만 확정 일정을 수정할 수 있습니다."
        actionText="일정으로 돌아가기"
        onAction={() => navigate(`/trips/${tripId}/itinerary`, { replace: true })}
      />
    );
  }
  return (
    <ItineraryEditor
      tripId={tripId}
      itinerary={query.data.itinerary}
      onRefresh={async () => {
        const refreshed = await query.refetch();
        return refreshed.isError || refreshed.data?.status !== "CONFIRMED"
          ? undefined
          : refreshed.data.itinerary;
      }}
    />
  );
}
