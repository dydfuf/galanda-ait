// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { RevisionSchema, TripIdSchema } from "../../core/domain/ids.ts";
import type { TripRoom } from "../../core/domain/room.ts";

vi.mock("./mutations.ts", () => ({
  useCreateTripRoomMutation: vi.fn(),
}));
vi.mock("../../hooks/useAppNavigation.ts", () => ({
  useAppNavigation: vi.fn(),
}));

import { useAppNavigation } from "../../hooks/useAppNavigation.ts";
import { useCreateTripRoomMutation } from "./mutations.ts";
import { TripCreatePage } from "./TripCreatePage.tsx";

const mockUseAppNavigation = vi.mocked(useAppNavigation);
const mockUseCreateTripRoomMutation = vi.mocked(useCreateTripRoomMutation);

const createdRoom: TripRoom = {
  id: TripIdSchema.make("trip-created"),
  title: "봄 여행",
  destination: "",
  revision: RevisionSchema.make(1),
  members: [],
  plans: [],
  confirmedPlanId: undefined,
};

const mutationResult = (
  mutateAsync = vi.fn(),
  isPending = false,
): ReturnType<typeof useCreateTripRoomMutation> =>
  ({
    mutateAsync,
    isPending,
  }) as unknown as ReturnType<typeof useCreateTripRoomMutation>;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-path">{location.pathname}</output>;
}

function TestApp() {
  return (
    <MemoryRouter initialEntries={["/trips/new"]}>
      <LocationProbe />
      <Routes>
        <Route path="/trips/new" element={<TripCreatePage />} />
        <Route path="*" element={<div>이동 완료</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const renderPage = () => render(<TestApp />);

beforeEach(() => {
  mockUseAppNavigation.mockReset();
  mockUseCreateTripRoomMutation.mockReset();
  mockUseAppNavigation.mockReturnValue(
    {
      goBack: vi.fn(),
      platformNavigation: undefined,
    } as unknown as ReturnType<typeof useAppNavigation>,
  );
  mockUseCreateTripRoomMutation.mockReturnValue(mutationResult());
});

describe("TripCreatePage", () => {
  it("permanent label과 validation accessory로 완료 조건을 표시한다", () => {
    const { container } = renderPage();

    const input = screen.getByLabelText("여행 이름 *");
    const submit = screen.getByRole("button", { name: "여행 만들기" });
    const main = screen.getByRole("main");
    const form = document.getElementById("trip-create-form");
    const bottomAction = container.querySelector('[data-slot="bottom-action"]');

    expect(main.parentElement).toHaveAttribute("data-galanda-surface", "content");
    expect(container.querySelector("header")).not.toHaveAttribute(
      "data-galanda-surface",
    );
    expect(form).toHaveClass("rounded-2xl", "border-border", "bg-card");
    expect(bottomAction).toHaveAttribute("data-galanda-surface", "content");
    expect(input).toHaveAttribute("aria-describedby", "trip-title-help");
    expect(input).toHaveAttribute("maxLength", "30");
    expect(submit).toBeDisabled();
    expect(screen.getByText("여행 이름을 입력해 주세요.")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "제주 힐링 여행" } });

    expect(input).toHaveValue("제주 힐링 여행");
    expect(submit).toBeEnabled();
    expect(
      screen.queryByText("여행 이름을 입력해 주세요."),
    ).not.toBeInTheDocument();
  });

  it("pending 동안 label/aria-busy를 표시하고 중복 제출을 막으며 서버 resolve 이후에만 이동한다", async () => {
    const createRequest = deferred<TripRoom>();
    const mutateAsync = vi.fn(() => createRequest.promise);
    mockUseCreateTripRoomMutation.mockReturnValue(
      mutationResult(mutateAsync, false),
    );

    const view = renderPage();
    const input = screen.getByLabelText("여행 이름 *");
    const form = document.getElementById("trip-create-form");
    expect(form).not.toBeNull();

    fireEvent.change(input, { target: { value: "  봄 여행  " } });
    fireEvent.submit(form as HTMLFormElement);
    fireEvent.submit(form as HTMLFormElement);

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({ title: "봄 여행" });
    expect(screen.getByTestId("location-path")).toHaveTextContent("/trips/new");

    mockUseCreateTripRoomMutation.mockReturnValue(
      mutationResult(mutateAsync, true),
    );
    view.rerender(<TestApp />);

    const pendingAction = screen.getByRole("button", {
      name: "여행방 만드는 중...",
    });
    expect(pendingAction).toBeDisabled();
    expect(pendingAction).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("여행 이름 *")).toHaveValue("  봄 여행  ");
    expect(screen.getByTestId("location-path")).toHaveTextContent("/trips/new");

    await act(async () => {
      createRequest.resolve(createdRoom);
      await createRequest.promise;
    });

    await waitFor(() =>
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        "/trips/trip-created/plans/new",
      ),
    );
  });

  it("mutation 실패 시 error를 알리고 입력과 현재 route를 유지한다", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(
      new Error("여행 생성 서버가 응답하지 않았어요."),
    );
    mockUseCreateTripRoomMutation.mockReturnValue(
      mutationResult(mutateAsync, false),
    );

    renderPage();
    const input = screen.getByLabelText("여행 이름 *");
    fireEvent.change(input, { target: { value: "실패해도 남아야 할 여행" } });
    fireEvent.submit(document.getElementById("trip-create-form") as HTMLFormElement);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "여행 생성 서버가 응답하지 않았어요.",
    );
    expect(input).toHaveValue("실패해도 남아야 할 여행");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("location-path")).toHaveTextContent("/trips/new");
    expect(screen.getByRole("button", { name: "여행 만들기" })).toBeEnabled();
  });
});
