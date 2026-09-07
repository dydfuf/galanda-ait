import { useMemo, useState } from "react";

import type {
  AccommodationSnapshot,
  BookingStatus,
  CityStay,
  TransportSnapshot,
} from "../../../core/domain/room.ts";
import { getStayNightCount } from "../../../core/domain/room.ts";
import type { FirstPlanWizardCursor } from "../first-plan-wizard-flow.ts";
import {
  createFirstPlanWizardViewModel,
  type FirstPlanWizardPresenterInput,
} from "../first-plan-wizard.presenter.ts";
import type {
  FirstPlanWizardEvent,
  FirstPlanWizardField,
} from "../first-plan-wizard.contract.ts";
import {
  type DraftSaveStatus,
  type PlanEditorFormData,
} from "../plan-editor-model.ts";
import type { usePlanEditorState } from "../hooks/usePlanEditorState.ts";
import { FirstPlanWizardView } from "./FirstPlanWizardView.tsx";

export interface FirstPlanWizardProps {
  readonly cursor: FirstPlanWizardCursor;
  /** Production uses the connected editor. The formData branch is a compatibility adapter for existing callers. */
  readonly editor?: ReturnType<typeof usePlanEditorState>;
  readonly formData?: PlanEditorFormData;
  readonly draftSaveStatus?: DraftSaveStatus;
  readonly isOnline?: boolean;
  readonly tripId?: string;
  readonly onTitleChange?: (value: string) => void;
  readonly onProposalReasonChange?: (value: string) => void;
  readonly onHeadcountChange?: (value: number) => void;
  readonly onCityChange?: (index: number, value: string) => void;
  readonly onArrivalDateChange?: (index: number, value: string) => void;
  readonly onDepartureDateChange?: (index: number, value: string) => void;
  readonly onAddCity?: (city?: string) => void;
  readonly onAccommodationStatusChange?: (index: number, isSearching: boolean) => void;
  readonly onHotelNameChange?: (index: number, value: string) => void;
  readonly onTransportEndpointsChange?: (index: number, fromCity: string, toCity: string) => void;
  readonly onTransportStatusChange?: (index: number, bookingStatus: BookingStatus) => void;
  readonly onTransportModeChange?: (index: number, value: string) => void;
  readonly onTransportDurationChange?: (index: number, value: string) => void;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly onSkip?: () => void;
}

const EMPTY_ROUTES: ReadonlyArray<CityStay> = [];
const EMPTY_ACCOMMODATIONS: ReadonlyArray<AccommodationSnapshot> = [];
const EMPTY_TRANSPORTS: ReadonlyArray<TransportSnapshot> = [];
const EMPTY_TOUCHED: Partial<Record<FirstPlanWizardField, boolean>> = {};

function toFormData(editor: ReturnType<typeof usePlanEditorState>): PlanEditorFormData {
  return {
    title: editor.title,
    proposalReason: editor.proposalReason,
    baseHeadcount: editor.baseHeadcount,
    routes: editor.routes,
    accommodations: editor.accommodations,
    transports: editor.transports,
  };
}

function getTransportDefaults(
  formData: PlanEditorFormData,
  index: number,
): Pick<TransportSnapshot, "fromCity" | "toCity"> {
  const totalLegs = Math.max(1, formData.routes.length + 1);
  return {
    fromCity: index === 0 ? "" : formData.routes[index - 1]?.city ?? "",
    toCity: index === totalLegs - 1 ? "" : formData.routes[index]?.city ?? "",
  };
}

function createAccommodation(
  formData: PlanEditorFormData,
  index: number,
  isSearching: boolean,
  hotelName = "",
): AccommodationSnapshot {
  const route = formData.routes[index];
  const period = route?.arrivalDate && route.departureDate
    ? `${route.arrivalDate} ~ ${route.departureDate}`
    : "";
  return {
    id: `acc-${index + 1}`,
    city: route?.city ?? "",
    period,
    nights: route ? Math.max(0, getStayNightCount(route)) : 0,
    hotelName,
    isSearching,
    bookingStatus: isSearching ? "NOT_CHECKED" : "AVAILABLE",
  };
}

function createTransport(
  formData: PlanEditorFormData,
  index: number,
  values: Partial<TransportSnapshot>,
): TransportSnapshot {
  const defaults = getTransportDefaults(formData, index);
  return {
    id: `tr-${index + 1}`,
    fromCity: values.fromCity ?? defaults.fromCity,
    toCity: values.toCity ?? defaults.toCity,
    mode: values.mode ?? "",
    hasTransfer: values.hasTransfer ?? false,
    durationText: values.durationText ?? "",
    bookingStatus: values.bookingStatus ?? "NOT_CHECKED",
    ...(values.priceRange ? { priceRange: values.priceRange } : {}),
    ...(values.bookingUrl ? { bookingUrl: values.bookingUrl } : {}),
  };
}

export function FirstPlanWizard({
  cursor,
  editor,
  formData: legacyFormData,
  draftSaveStatus: explicitDraftSaveStatus,
  isOnline = true,
  onTitleChange,
  onProposalReasonChange,
  onHeadcountChange,
  onCityChange,
  onArrivalDateChange,
  onDepartureDateChange,
  onAddCity,
  onAccommodationStatusChange,
  onHotelNameChange,
  onTransportEndpointsChange,
  onTransportStatusChange,
  onTransportModeChange,
  onTransportDurationChange,
  onNext,
  onPrevious,
}: FirstPlanWizardProps) {
  const formData = editor
    ? toFormData(editor)
    : legacyFormData;
  if (!formData) {
    throw new Error("FirstPlanWizard requires an editor or formData.");
  }

  const cursorKey = `${cursor.section}:${cursor.question}:${cursor.index ?? ""}:${cursor.returnToReview ? "review" : ""}`;
  const [touchState, setTouchState] = useState<{
    readonly key: string;
    readonly fields: Partial<Record<FirstPlanWizardField, boolean>>;
  }>({ key: cursorKey, fields: {} });
  const touched = touchState.key === cursorKey ? touchState.fields : EMPTY_TOUCHED;

  const presenterInput: FirstPlanWizardPresenterInput = useMemo(
    () => ({
      cursor,
      formData: {
        ...formData,
        routes: formData.routes ?? EMPTY_ROUTES,
        accommodations: formData.accommodations ?? EMPTY_ACCOMMODATIONS,
        transports: formData.transports ?? EMPTY_TRANSPORTS,
      },
      draftSaveStatus: editor?.draftSaveStatus ?? explicitDraftSaveStatus ?? "IDLE",
      isOnline,
      touched,
    }),
    [cursor, editor?.draftSaveStatus, explicitDraftSaveStatus, formData, isOnline, touched],
  );
  const vm = useMemo(
    () => createFirstPlanWizardViewModel(presenterInput),
    [presenterInput],
  );

  const updateAccommodation = (index: number, isSearching: boolean, hotelName = "") => {
    const existing = formData.accommodations[index];
    if (editor) {
      if (existing) {
        editor.handleUpdateAccommodation(existing.id, {
          isSearching,
          bookingStatus: isSearching ? "NOT_CHECKED" : "AVAILABLE",
          hotelName: isSearching ? "" : hotelName || existing.hotelName,
        });
      } else {
        editor.handleAddAccommodation(createAccommodation(formData, index, isSearching, hotelName));
      }
    }
  };

  const handleEvent = (event: FirstPlanWizardEvent): void => {
    switch (event.type) {
      case "title-change":
        editor?.setTitle(event.value);
        onTitleChange?.(event.value);
        return;
      case "proposal-reason-change":
        editor?.setProposalReason(event.value);
        onProposalReasonChange?.(event.value);
        return;
      case "headcount-change":
        editor?.setBaseHeadcount(event.value);
        onHeadcountChange?.(event.value);
        return;
      case "city-change":
        editor?.handleUpdateCity(event.index, { city: event.value });
        onCityChange?.(event.index, event.value);
        return;
      case "arrival-date-change":
        editor?.handleUpdateCity(event.index, { arrivalDate: event.value });
        onArrivalDateChange?.(event.index, event.value);
        return;
      case "departure-date-change":
        editor?.handleUpdateCity(event.index, { departureDate: event.value });
        onDepartureDateChange?.(event.index, event.value);
        return;
      case "add-city":
        if (onAddCity) onAddCity("");
        else editor?.handleAddCity("");
        return;
      case "accommodation-status-change":
        updateAccommodation(event.index, event.isSearching);
        onAccommodationStatusChange?.(event.index, event.isSearching);
        return;
      case "hotel-name-change": {
        const existing = formData.accommodations[event.index];
        if (editor) {
          if (existing) {
            editor.handleUpdateAccommodation(existing.id, { hotelName: event.value });
          } else {
            editor.handleAddAccommodation(createAccommodation(formData, event.index, false, event.value));
          }
        }
        onHotelNameChange?.(event.index, event.value);
        return;
      }
      case "transport-endpoints-change": {
        const existing = formData.transports[event.index];
        if (editor) {
          if (existing) {
            editor.handleUpdateTransport(existing.id, {
              fromCity: event.fromCity,
              toCity: event.toCity,
            });
          } else {
            editor.handleAddTransport(createTransport(formData, event.index, event));
          }
        }
        onTransportEndpointsChange?.(event.index, event.fromCity, event.toCity);
        return;
      }
      case "transport-status-change": {
        const existing = formData.transports[event.index];
        const updated = {
          bookingStatus: event.bookingStatus,
          ...(event.bookingStatus === "NOT_CHECKED"
            ? { mode: "", durationText: "" }
            : {}),
        } as const;
        if (editor) {
          if (existing) editor.handleUpdateTransport(existing.id, updated);
          else editor.handleAddTransport(createTransport(formData, event.index, updated));
        }
        onTransportStatusChange?.(event.index, event.bookingStatus);
        return;
      }
      case "transport-mode-change": {
        const existing = formData.transports[event.index];
        if (editor) {
          if (existing) editor.handleUpdateTransport(existing.id, { mode: event.value });
          else editor.handleAddTransport(createTransport(formData, event.index, { mode: event.value, bookingStatus: "AVAILABLE" }));
        }
        onTransportModeChange?.(event.index, event.value);
        return;
      }
      case "transport-duration-change": {
        const existing = formData.transports[event.index];
        if (editor) {
          if (existing) editor.handleUpdateTransport(existing.id, { durationText: event.value });
          else editor.handleAddTransport(createTransport(formData, event.index, { durationText: event.value, bookingStatus: "AVAILABLE" }));
        }
        onTransportDurationChange?.(event.index, event.value);
        return;
      }
      case "field-blur":
        setTouchState((current) => ({
          key: cursorKey,
          fields: {
            ...(current.key === cursorKey ? current.fields : {}),
            [event.field]: true,
          },
        }));
        return;
      case "next":
        if (cursor.section === "accommodation" && cursor.question === "status" && !formData.accommodations[cursor.index ?? 0]) {
          onAccommodationStatusChange?.(cursor.index ?? 0, true);
        }
        onNext();
        return;
      case "previous":
        onPrevious();
        return;
    }
  };

  return <FirstPlanWizardView vm={vm} onEvent={handleEvent} />;
}
