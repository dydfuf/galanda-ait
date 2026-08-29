import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { cn } from "@/lib/utils.ts";
import { ApiClientError } from "@/app/api-client.ts";
import { toUserMessage } from "@/features/common/error-message.ts";
import { useSessionQuery } from "@/hooks/useSession.ts";
import { useAppNavigation } from "@/hooks/useAppNavigation.ts";
import type { ExploreListingId, Revision, TripId } from "@/core/domain/ids.ts";
import type { ImportExplorePlanRequest } from "@/contracts/explore.ts";

import { useTripRoomsQuery } from "../../plan-home/queries.ts";
import type { TripRoomViewModel } from "../../plan-home/plan-home-view-model.ts";
import { useImportExplorePlanMutation } from "../import-queries.ts";

/**
 * Explore snapshot import 대상 선택 drawer (RAON-262 DISC-8).
 *
 * ## Flow
 *
 * `내 여행으로 가져오기` → NEW_TRIP 또는 EXISTING_TRIP 명시 선택 →
 * 독립 복사/실시간 동기화 없음을 안내하고 required 확인 → pending/성공/충돌/오류 →
 * **API 성공 이후에만** `/trips/:tripId/plans/:planId`로 이동한다.
 *
 * ## Deferred private query
 *
 * 상세 최초 로드에서는 private trip query를 쏘지 않는다. 참여 방 목록
 * (`useTripRoomsQuery`)은 drawer가 열릴 때만(`enabled: isOpen`) 활성화한다.
 * 확정된 방은 `plan:create` transition이 불가하므로 후보에서 제외한다(membership은
 * 서버가 최종 판정한다 — 여기서는 실제 세션 membership/capability 후보를 노출할 뿐).
 *
 * ## EXISTING submit freshness
 *
 * EXISTING 제출 시 mutation 직전에 방 목록을 **다시 refetch**해 그 결과의 최신
 * revision을 사용한다. 대상 방이 사라졌거나/확정됐거나/refetch가 실패하면 import를
 * 호출하지 않는다(stale revision으로 낙관적 성공을 만들지 않는다).
 *
 * ## No optimistic success / no double submit
 *
 * navigate는 `mutateAsync` resolve 이후에만 한다. pending 동안 drawer dismiss/
 * 옵션 변경/submit을 모두 비활성화해 중복 제출을 막는다.
 */

type ImportOption = "NEW_TRIP" | "EXISTING_TRIP";

const NEW_ACCOUNT_REQUIRED_MESSAGE =
  "새 여행으로 가져오려면 계정 연결(로그인)이 필요해요.";

interface ExploreImportDrawerProps {
  readonly listingId: ExploreListingId;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function ExploreImportDrawer({
  listingId,
  isOpen,
  onClose,
}: ExploreImportDrawerProps) {
  const { data: session } = useSessionQuery();
  const { navigate } = useAppNavigation();
  const isGuest = session?.accountType === "GUEST";

  // private trip query는 drawer가 열릴 때만 발사한다(상세 최초 로드에서 쏘지 않음).
  const rooms = useTripRoomsQuery({ enabled: isOpen });
  const mutation = useImportExplorePlanMutation(listingId);

  const [option, setOption] = useState<ImportOption | undefined>(undefined);
  const [selectedTripId, setSelectedTripId] = useState<TripId | undefined>(
    undefined
  );
  const [confirmedCopy, setConfirmedCopy] = useState(false);
  // EXISTING 제출 직전 fresh refetch/revision 검증 실패를 사용자에게 알린다.
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const wasOpenRef = useRef(false);
  // 동일 event loop 내 연속 클릭(state flush 이전)을 막는 동기 lock.
  // state 기반 isPending은 re-render 이후에만 반영되므로, 같은 tick에서 두 번
  // 눌리면 두 mutation이 발사될 수 있다. ref는 즉시 반영되어 이를 차단한다.
  const submitLockRef = useRef(false);
  const confirmId = useId();

  // drawer가 새로 열릴 때 상태를 초기화한다(닫혔다 다시 열려도 stale 선택이 남지 않음).
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setOption(undefined);
      setSelectedTripId(undefined);
      setConfirmedCopy(false);
      setPreflightError(null);
      setIsSubmitting(false);
      submitLockRef.current = false;
      mutation.reset();
    }
    wasOpenRef.current = isOpen;
    // mutation.reset은 안정적이지 않을 수 있으나 open 전이에서만 호출하면 충분하다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const isPending = isSubmitting || mutation.isPending;

  // 확정된 방은 plan:create가 불가하므로 후보에서 제외한다.
  const eligibleRooms: ReadonlyArray<TripRoomViewModel> = (
    rooms.data ?? []
  ).filter((room) => !room.isConfirmed);

  const handleOpenChange = (open: boolean) => {
    // pending 중에는 dismiss를 막아 중복 제출/경합을 방지한다.
    if (!open && !isPending) {
      onClose();
    }
  };

  const handleSubmit = async () => {
    // 동기 lock: state 기반 isPending보다 먼저 즉시 차단한다.
    if (submitLockRef.current) return;
    if (isPending) return;
    if (!option) return;
    if (!confirmedCopy) return;
    // 이 지점 이후로는 어떤 preflight/mutation도 단일 실행만 허용한다.
    submitLockRef.current = true;

    setPreflightError(null);

    let target: ImportExplorePlanRequest["target"] | undefined;

    if (option === "NEW_TRIP") {
      if (isGuest) {
        submitLockRef.current = false;
        return; // guest는 NEW 불가(비활성/안내). 방어적으로 재확인.
      }
      target = { type: "NEW_TRIP" };
    } else {
      if (!selectedTripId) {
        submitLockRef.current = false;
        return;
      }
      // EXISTING: 제출 직전 최신 방 목록을 다시 refetch해 최신 revision을 쓴다.
      setIsSubmitting(true);
      let latest: ReadonlyArray<TripRoomViewModel>;
      try {
        const refetched = await rooms.refetch();
        if (refetched.error || !refetched.data) {
          setPreflightError(
            "여행 목록을 다시 불러오지 못했어요. 잠시 후 다시 시도해주세요."
          );
          setIsSubmitting(false);
          // preflight 실패는 성공 상태가 아니므로 lock을 풀어 재시도를 허용한다.
          submitLockRef.current = false;
          return;
        }
        latest = refetched.data;
      } catch {
        setPreflightError(
          "여행 목록을 다시 불러오지 못했어요. 잠시 후 다시 시도해주세요."
        );
        setIsSubmitting(false);
        submitLockRef.current = false;
        return;
      }

      const room = latest.find((r) => r.id === selectedTripId);
      if (!room || room.isConfirmed) {
        // 방이 사라졌거나 확정됐으면 import를 호출하지 않고 재선택을 요구한다.
        setPreflightError(
          "선택한 여행을 더 이상 사용할 수 없어요. 목록을 확인하고 다시 선택해주세요."
        );
        setSelectedTripId(undefined);
        setIsSubmitting(false);
        submitLockRef.current = false;
        return;
      }

      target = {
        type: "EXISTING_TRIP",
        tripId: room.id as TripId,
        expectedRevision: room.revision as Revision,
      };
    }

    try {
      const result = await mutation.mutateAsync(target);
      // 성공(atomic + 캐시 무효화 완료) 이후에만 이동한다.
      onClose();
      navigate(`/trips/${result.tripId}/plans/${result.planId}`);
    } catch {
      // 실패 시 어떤 성공 상태도 만들지 않는다(navigate 없음). 오류는 아래에서 표시.
    } finally {
      setIsSubmitting(false);
      // mutation이 끝나면(성공/실패 모두) lock을 풀어 재시도를 허용한다.
      submitLockRef.current = false;
    }
  };

  const submitDisabled =
    isPending ||
    !option ||
    !confirmedCopy ||
    (option === "NEW_TRIP" && isGuest) ||
    (option === "EXISTING_TRIP" && !selectedTripId);

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange} showSwipeHandle>
      <DrawerContent data-slot="explore-import-drawer">
        <DrawerHeader>
          <DrawerTitle className="text-left text-[17px] font-bold">
            내 여행으로 가져오기
          </DrawerTitle>
          <DrawerDescription className="text-left">
            이 여행 일정을 내 여행으로 <strong>복사</strong>해요. 복사본은 원본과
            독립적이며, 원본이 바뀌어도 자동으로 업데이트되지 않아요.
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-raised px-4 pb-4">
          <RadioGroup
            aria-label="가져올 위치"
            value={option ?? null}
            onValueChange={(value) => {
              if (isPending) return;
              setPreflightError(null);
              setOption(value as ImportOption);
              if (value !== "EXISTING_TRIP") setSelectedTripId(undefined);
            }}
            className="mt-4 gap-3"
          >
            {/* NEW_TRIP */}
            <label
              className={cn(
                "flex min-w-0 items-start gap-3 rounded-xl border bg-surface-content p-3 transition-colors",
                option === "NEW_TRIP"
                  ? "border-primary bg-info-muted"
                  : "border-border",
                (isGuest || isPending) && "opacity-60"
              )}
            >
              <RadioGroupItem
                value="NEW_TRIP"
                className="mt-0.5"
                disabled={isGuest || isPending}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="min-w-0 text-base font-medium text-foreground [overflow-wrap:anywhere]">
                  새 여행 만들기
                </span>
                <span className="min-w-0 text-sm text-foreground-muted [overflow-wrap:anywhere]">
                  {isGuest
                    ? NEW_ACCOUNT_REQUIRED_MESSAGE
                    : "이 일정으로 새 여행을 시작해요."}
                </span>
              </span>
            </label>

            {/* EXISTING_TRIP */}
            <label
              className={cn(
                "flex min-w-0 items-start gap-3 rounded-xl border bg-surface-content p-3 transition-colors",
                option === "EXISTING_TRIP"
                  ? "border-primary bg-info-muted"
                  : "border-border",
                isPending && "opacity-60"
              )}
            >
              <RadioGroupItem
                value="EXISTING_TRIP"
                className="mt-0.5"
                disabled={isPending}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="min-w-0 text-base font-medium text-foreground [overflow-wrap:anywhere]">
                  기존 여행에 추가
                </span>
                <span className="min-w-0 text-sm text-foreground-muted [overflow-wrap:anywhere]">
                  참여 중인 여행에 새 여행안으로 추가해요.
                </span>
              </span>
            </label>
          </RadioGroup>

          {/* EXISTING 후보 목록: rooms query 상태를 정직하게 표시한다. */}
          {option === "EXISTING_TRIP" && (
            <div className="mt-3 min-w-0">
              {rooms.isPending ? (
                <p className="flex items-center gap-2 text-sm text-foreground-muted">
                  <Spinner className="size-4" aria-hidden="true" />
                  여행 목록을 불러오는 중이에요.
                </p>
              ) : rooms.isError ? (
                <div
                  role="alert"
                  className="flex min-w-0 flex-col gap-2 rounded-xl border border-destructive-border bg-destructive-muted p-3"
                >
                  <p className="min-w-0 text-sm text-destructive-strong [overflow-wrap:anywhere]">
                    {toUserMessage(
                      rooms.error,
                      "여행 목록을 불러오지 못했어요."
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => void rooms.refetch()}
                  >
                    다시 시도
                  </Button>
                </div>
              ) : eligibleRooms.length === 0 ? (
                <p className="min-w-0 text-sm text-foreground-muted [overflow-wrap:anywhere]">
                  추가할 수 있는 여행이 없어요. 새 여행으로 가져오거나 여행에
                  참여한 뒤 다시 시도해주세요.
                </p>
              ) : (
                <RadioGroup
                  aria-label="추가할 여행 선택"
                  value={selectedTripId ?? null}
                  onValueChange={(value) => {
                    if (isPending) return;
                    setPreflightError(null);
                    setSelectedTripId(value as TripId);
                  }}
                  className="gap-2"
                >
                  {eligibleRooms.map((room) => (
                    <label
                      key={room.id}
                      className={cn(
                        "flex min-w-0 items-center gap-3 rounded-xl border bg-surface-content p-3 transition-colors",
                        selectedTripId === room.id
                          ? "border-primary bg-info-muted"
                          : "border-border",
                        isPending && "opacity-60"
                      )}
                    >
                      <RadioGroupItem value={room.id} disabled={isPending} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="min-w-0 text-base font-medium text-foreground [overflow-wrap:anywhere]">
                          {room.title}
                        </span>
                        {room.destination && (
                          <span className="min-w-0 text-sm text-foreground-muted [overflow-wrap:anywhere]">
                            {room.destination}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}

          {/* 복사 semantics required 확인 체크박스(접근 가능한 문구). */}
          <label
            htmlFor={confirmId}
            className="mt-4 flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-content p-3"
          >
            <input
              id={confirmId}
              type="checkbox"
              checked={confirmedCopy}
              disabled={isPending}
              onChange={(event) => {
                if (isPending) return;
                setConfirmedCopy(event.target.checked);
              }}
              className="mt-0.5 size-4 shrink-0 rounded border-input text-primary accent-primary focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            />
            <span className="min-w-0 text-sm text-foreground [overflow-wrap:anywhere]">
              이 일정이 <strong>복사본</strong>으로 만들어지며, 원본이 바뀌어도
              자동으로 업데이트되지 않는다는 점을 이해했어요.
            </span>
          </label>

          {preflightError && (
            <p
              role="alert"
              className="mt-4 min-w-0 rounded-xl border border-destructive-border bg-destructive-muted p-3 text-sm text-destructive-strong [overflow-wrap:anywhere]"
            >
              {preflightError}
            </p>
          )}

          {mutation.isError && (
            <ImportErrorNotice
              error={mutation.error}
              onRefreshCandidates={() => void rooms.refetch()}
            />
          )}
        </div>

        <DrawerFooter>
          <Button
            type="button"
            size="xl"
            disabled={submitDisabled}
            aria-busy={isPending}
            onClick={() => void handleSubmit()}
            data-slot="explore-import-submit"
          >
            {isPending ? "가져오는 중..." : "가져오기"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * import mutation 실패 안내. 서버가 status code로 내려준 의미를 정직하게 구분해
 * 각 상황에 맞는 복구 경로를 제시한다.
 */
function ImportErrorNotice({
  error,
  onRefreshCandidates,
}: {
  readonly error: Error;
  readonly onRefreshCandidates: () => void;
}) {
  const { navigate } = useAppNavigation();

  let message = toUserMessage(error, "여행 일정을 가져오지 못했어요.");
  let action: { readonly label: string; readonly onClick: () => void } | null =
    null;

  if (error instanceof ApiClientError) {
    if (error.status === 409) {
      // REVISION_CONFLICT / STATE_CONFLICT: 후보를 새로고침하고 재시도 유도.
      message =
        "다른 사용자가 먼저 여행을 변경했어요. 목록을 새로고침하고 다시 시도해주세요.";
      action = { label: "목록 새로고침", onClick: onRefreshCandidates };
    } else if (error.status === 403) {
      if (error.code === "ACCOUNT_UPGRADE_REQUIRED") {
        // 계정 연결/전환이 필요한 상태: 권한 문제가 아니므로 정직하게 구분한다.
        // (별도 in-app 전환 route를 임의로 만들지 않는다.)
        message =
          "이 작업을 하려면 계정 연결이 필요해요. 로그인(계정 연결) 후 다시 시도해주세요.";
      } else {
        // 권한/계정 상태 변경: 후보 새로고침 후 다른 대상 선택.
        message =
          "이 여행에 일정을 추가할 권한이 없어요. 목록을 새로고침하고 다른 여행을 선택해주세요.";
        action = { label: "목록 새로고침", onClick: onRefreshCandidates };
      }
    } else if (error.status === 404) {
      const entity = (error.details as { readonly entity?: unknown } | undefined)
        ?.entity;
      if (entity === "TripRoom") {
        message =
          "선택한 여행을 찾을 수 없어요. 목록을 새로고침하고 다시 선택해주세요.";
        action = { label: "목록 새로고침", onClick: onRefreshCandidates };
      } else if (entity === "ExplorePlanListing") {
        message =
          "이 여행 일정을 더 이상 찾을 수 없어요. 탐색에서 다른 일정을 확인해주세요.";
        action = { label: "탐색으로 가기", onClick: () => navigate("/explore") };
      } else {
        message = "대상을 찾을 수 없어요. 잠시 후 다시 시도해주세요.";
      }
    } else if (error.status === 410) {
      message =
        "공개가 중단된 여행 일정이라 가져올 수 없어요. 탐색에서 다른 일정을 확인해주세요.";
      action = { label: "탐색으로 가기", onClick: () => navigate("/explore") };
    } else if (error.status === 422) {
      message =
        "이 여행 일정은 정보가 완전하지 않아 가져올 수 없어요. 다른 일정을 이용해주세요.";
    } else if (error.status >= 500) {
      message = "잠시 문제가 생겼어요. 잠시 후 다시 시도해주세요.";
    }
  }

  return (
    <div
      role="alert"
      className="mt-4 flex min-w-0 flex-col gap-2 rounded-xl border border-destructive-border bg-destructive-muted p-3"
    >
      <p className="min-w-0 text-sm text-destructive-strong [overflow-wrap:anywhere]">
        {message}
      </p>
      {action && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
