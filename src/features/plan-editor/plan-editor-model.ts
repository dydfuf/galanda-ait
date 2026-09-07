import type {
  AccommodationSnapshot,
  CityStay,
  TransportSnapshot,
} from "../../core/domain/room.ts";

export interface PlanEditorFormData {
  readonly title: string;
  readonly proposalReason: string;
  readonly baseHeadcount: number;
  readonly routes: ReadonlyArray<CityStay>;
  readonly accommodations: ReadonlyArray<AccommodationSnapshot>;
  readonly transports: ReadonlyArray<TransportSnapshot>;
  readonly clonedFromPlanId?: string;
}

export type DraftSaveStatus = "IDLE" | "SAVING" | "SAVED" | "ERROR";

export const getDraftSaveStatusLabel = (status: DraftSaveStatus): string => ({
  IDLE: "아직 저장되지 않음",
  SAVING: "자동 저장 중…",
  SAVED: "자동 저장됨",
  ERROR: "임시 저장하지 못했어요",
})[status];
