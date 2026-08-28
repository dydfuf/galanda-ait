// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicInviteSummary } from "../../core/domain/invite.ts";
import {
  RevisionSchema,
  TripIdSchema,
  UserIdSchema,
} from "../../core/domain/ids.ts";
import type { TripRoom, UserSession } from "../../core/domain/room.ts";
import { InvitePage } from "./InvitePage.tsx";

const INVITE_TOKEN = "00000000-0000-4000-8000-000000000001";
const STORAGE_KEY = `galanda:invite-nickname:${INVITE_TOKEN}`;

const registeredSession: UserSession = {
  participantId: UserIdSchema.make("user-1"),
  participantIds: [UserIdSchema.make("user-1")],
  accountType: "REGISTERED",
  name: "라온",
  isAuthenticated: true,
};

const guestSession: UserSession = {
  participantId: UserIdSchema.make("guest-1"),
  participantIds: [UserIdSchema.make("guest-1")],
  accountType: "GUEST",
  name: "돌아온 여행자",
  isAuthenticated: true,
};

const baseSummary: PublicInviteSummary = {
  title: "오사카 가을 여행",
  inviterName: "민지",
  participantCount: 3,
  destination: "오사카",
  startDate: "2026-09-01",
  endDate: "2026-09-04",
  alreadyJoined: false,
};

const joinedRoom: TripRoom = {
  id: TripIdSchema.make("trip-joined"),
  title: baseSummary.title,
  destination: baseSummary.destination ?? "오사카",
  revision: RevisionSchema.make(1),
  members: [
    { id: UserIdSchema.make("user-1"), name: "라온", role: "MEMBER" },
  ],
  plans: [],
  confirmedPlanId: undefined,
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const requestPath = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return `${input.pathname}${input.search}`;
  return new URL(input.url).pathname;
};

let inviteSummary: PublicInviteSummary;
let inviteHandler: () => Response | Promise<Response>;
let sessionHandler: () => Response | Promise<Response>;
let joinHandler: () => Response | Promise<Response>;
let requests: Array<{ readonly path: string; readonly init?: RequestInit }>;

const renderPage = (viewportWidth?: number) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

  return render(
    <div
      data-testid="viewport"
      style={viewportWidth ? { width: `${viewportWidth}px` } : undefined}
    >
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/invites/${INVITE_TOKEN}`]}>
          <Routes>
            <Route path="/invites/:inviteToken" element={<InvitePage />} />
            <Route path="/trips/:tripId" element={<p>여행방 진입 완료</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </div>,
  );
};

beforeEach(() => {
  sessionStorage.clear();
  requests = [];
  inviteSummary = { ...baseSummary };
  inviteHandler = () => jsonResponse(inviteSummary);
  sessionHandler = () => jsonResponse(registeredSession);
  joinHandler = () => jsonResponse(joinedRoom);

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = requestPath(input);
      requests.push({ path, init });

      if (path === "/api/session") return sessionHandler();
      if (path === `/api/invites/${INVITE_TOKEN}`) return inviteHandler();
      if (path === "/api/auth/sign-in/anonymous") {
        return jsonResponse({ token: "anonymous-session", user: { id: "guest-1" } });
      }
      if (path === `/api/invites/${INVITE_TOKEN}/join`) return joinHandler();

      return jsonResponse({ error: { message: `Unexpected request: ${path}` } }, 500);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("InvitePage entry flow", () => {
  it("초대장 query pending 상태를 status text로 알린다", async () => {
    const pendingInvite = deferred<Response>();
    inviteHandler = () => pendingInvite.promise;
    renderPage();

    expect(await screen.findByRole("status")).toHaveTextContent(
      "초대장 정보를 확인하는 중...",
    );

    await act(async () => {
      pendingInvite.resolve(jsonResponse(inviteSummary));
      await pendingInvite.promise;
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "오사카 가을 여행에 초대받았어요" }),
    ).toBeInTheDocument();
  });

  it("320px 긴 초대 정보에서 permanent label과 DOM keyboard order를 보존한다", async () => {
    const longTitle = "친구들과 함께 오래 기억할 가을 단풍과 온천을 모두 즐기는 여행".repeat(2);
    const longDestination = "오사카·교토·고베·나라를 잇는 아주 긴 다도시 여행 목적지".repeat(2);
    inviteSummary = {
      ...baseSummary,
      title: longTitle,
      inviterName: "아주 긴 이름을 사용하는 초대자 민지",
      destination: longDestination,
    };
    renderPage(320);

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: `${longTitle}에 초대받았어요`,
    });
    const input = screen.getByRole("textbox", { name: "어떤 이름으로 참여할까요?" });
    const primaryAction = screen.getByRole("button", { name: "이 이름으로 참여하기" });
    const cancelAction = screen.getByRole("button", { name: "취소" });

    expect(screen.getByTestId("viewport")).toHaveStyle({ width: "320px" });
    expect(heading).toHaveClass("min-w-0", "[overflow-wrap:anywhere]");
    expect(screen.getByText(longDestination)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "초대받은 여행 정보" })).toBeInTheDocument();
    expect(input).toHaveAttribute("id", "invite-nickname");
    expect(input).toHaveAttribute("placeholder", "여행에서 사용할 닉네임");
    expect(screen.getByText("닉네임을 입력해 주세요.")).toBeInTheDocument();
    expect(
      input.compareDocumentPosition(primaryAction) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      primaryAction.compareDocumentPosition(cancelAction) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("참여 실패를 alert로 표시하고 nickname과 sessionStorage 값을 보존한다", async () => {
    joinHandler = () =>
      jsonResponse(
        { error: { code: "DEPENDENCY_FAILURE", message: "참여 서버를 확인하지 못했어요." } },
        503,
      );
    renderPage();

    const input = await screen.findByRole("textbox", {
      name: "어떤 이름으로 참여할까요?",
    });
    fireEvent.change(input, { target: { value: "  라온 여행자  " } });
    fireEvent.click(screen.getByRole("button", { name: "이 이름으로 참여하기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "참여 서버를 확인하지 못했어요.",
    );
    expect(input).toHaveValue("  라온 여행자  ");
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("  라온 여행자  ");
    expect(screen.getByRole("button", { name: "이 이름으로 참여하기" })).toBeEnabled();
    expect(screen.queryByText("여행방 진입 완료")).not.toBeInTheDocument();
  });

  it("join pending 동안 aria-busy label로 중복 제출을 막고 server success 후에만 이동한다", async () => {
    const pendingJoin = deferred<Response>();
    joinHandler = () => pendingJoin.promise;
    renderPage();

    const input = await screen.findByRole("textbox", {
      name: "어떤 이름으로 참여할까요?",
    });
    fireEvent.change(input, { target: { value: "라온" } });
    const action = screen.getByRole("button", { name: "이 이름으로 참여하기" });
    fireEvent.click(action);
    fireEvent.click(action);

    const pendingAction = screen.getByRole("button", { name: "참여하는 중..." });
    expect(pendingAction).toBeDisabled();
    expect(pendingAction).toHaveAttribute("aria-busy", "true");
    expect(
      requests.filter(({ path }) => path === `/api/invites/${INVITE_TOKEN}/join`),
    ).toHaveLength(1);
    expect(screen.queryByText("여행방 진입 완료")).not.toBeInTheDocument();

    await act(async () => {
      pendingJoin.resolve(jsonResponse(joinedRoom));
      await pendingJoin.promise;
    });

    expect(await screen.findByText("여행방 진입 완료")).toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    const joinRequest = requests.find(
      ({ path }) => path === `/api/invites/${INVITE_TOKEN}/join`,
    );
    expect(JSON.parse(joinRequest?.init?.body as string)).toEqual({ nickname: "라온" });
  });

  it("alreadyJoined 상태는 nickname form 없이 live 안내와 복귀 action을 제공한다", async () => {
    inviteSummary = { ...baseSummary, alreadyJoined: true };
    const sessionResponses: Array<UserSession | null> = [null, guestSession];
    sessionHandler = () =>
      jsonResponse(
        sessionResponses.length > 1 ? sessionResponses.shift() : sessionResponses[0],
      );
    renderPage();

    const announcement = await screen.findByText(
      "이미 이 여행에 참여하고 있어요. 여행방으로 바로 돌아갈 수 있어요.",
    );
    expect(announcement.tagName).toBe("OUTPUT");
    expect(announcement).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "여행방으로 돌아가기" }));

    expect(await screen.findByText("여행방 진입 완료")).toBeInTheDocument();
    const authIndex = requests.findIndex(
      ({ path }) => path === "/api/auth/sign-in/anonymous",
    );
    const joinIndex = requests.findIndex(
      ({ path }) => path === `/api/invites/${INVITE_TOKEN}/join`,
    );
    expect(authIndex).toBeGreaterThanOrEqual(0);
    expect(joinIndex).toBeGreaterThan(authIndex);
    const joinRequest = requests[joinIndex];
    expect(JSON.parse(joinRequest.init?.body as string)).toEqual({
      nickname: "돌아온 여행자",
    });
  });

  it("session 확인 실패를 별도 alert와 retry action으로 유지한다", async () => {
    sessionHandler = () =>
      jsonResponse({ error: { message: "인증 서비스 응답 없음" } }, 503);
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "오사카 가을 여행에 초대받았어요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "인증 서비스를 확인하지 못했어요.",
    );
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이 이름으로 참여하기" })).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByText("인증 서비스 재확인이 필요해요.")).toBeInTheDocument(),
    );
  });
});
