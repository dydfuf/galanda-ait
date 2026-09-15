// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../../app/api-client.ts";
import { ParticipantIdSchema, RevisionSchema, TripIdSchema } from "../../core/domain/ids.ts";
import type { TripResourceResponse, TripResourcesResponse } from "../../contracts/trip-resource.ts";
import { TripResourcesPage } from "./TripResourcesPage.tsx";
import { useTripResourceMutation, useTripResourcesQuery } from "./queries.ts";

vi.mock("./queries.ts", () => ({ useTripResourcesQuery: vi.fn<typeof useTripResourcesQuery>(), useTripResourceMutation: vi.fn<typeof useTripResourceMutation>() }));
vi.mock("../../platform/index.ts", () => ({ platform: { openExternalUrl: vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined) } }));

const resource: TripResourceResponse = {
  id: "a4e57d70-46b2-4dc1-8000-77e29f92d301",
  tripId: TripIdSchema.make("trip-resources"),
  createdBy: ParticipantIdSchema.make("participant-author"),
  createdByName: "민지",
  createdAt: "2026-09-16T00:00:00.000Z",
  updatedAt: "2026-09-16T00:00:00.000Z",
  revision: RevisionSchema.make(1),
  url: "https://example.com/seoul-cafe",
  note: "서울 카페는 비 오는 날 가기 좋겠어.",
  processedAt: "2026-09-16T00:00:00.000Z",
  linkStatus: "READ",
  canManage: false,
  places: [{ name: "서울 카페", category: "FOOD", location: "", summary: "실내 좌석이 있는 카페", evidence: { source: "LINK", text: "실내 좌석이 있습니다." }, edited: false }],
};

const mutateAsync = vi.fn<() => Promise<unknown>>();
const refetch = vi.fn<() => Promise<unknown>>();
function setQuery(data: TripResourcesResponse = { items: [resource], extractionAvailable: true }, error?: Error) {
  vi.mocked(useTripResourcesQuery).mockReturnValue({ data, isError: Boolean(error), error: error ?? null, isFetching: false, refetch } as unknown as ReturnType<typeof useTripResourcesQuery>);
}
function TestPage() {
  return <MemoryRouter initialEntries={["/trips/trip-resources/resources"]}><Routes><Route path="/trips/:tripId/resources" element={<TripResourcesPage />} /></Routes></MemoryRouter>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mutateAsync.mockResolvedValue(resource);
  refetch.mockResolvedValue({ data: { items: [resource], extractionAvailable: true }, isError: false });
  setQuery();
  vi.mocked(useTripResourceMutation).mockReturnValue({ mutateAsync, isPending: false } as unknown as ReturnType<typeof useTripResourceMutation>);
});

describe("공동 여행 자료함", () => {
  it("원문 근거·출처·작성자를 보존하고, 위치 미확인을 표시한다", () => {
    render(<TestPage />);
    const card = screen.getByRole("article", { name: "서울 카페" });
    expect(within(card).getByText("위치 확인 필요")).toBeInTheDocument();
    expect(within(card).getByText("자료를 올린 멤버 · 민지")).toBeInTheDocument();
    fireEvent.click(within(card).getByText("원문 근거 보기 · 링크"));
    expect(within(card).getByText("실내 좌석이 있습니다.")).toBeInTheDocument();
    expect(within(card).getByRole("link")).toHaveAttribute("href", resource.url);
    expect(card.querySelector("time")).toHaveAttribute("datetime", resource.processedAt);
    fireEvent.click(screen.getByRole("tab", { name: "원본 자료 1" }));
    expect(screen.getByText(resource.note)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "자료 삭제" })).not.toBeInTheDocument();
  });

  it("함께 저장한 URL이 있어도 메모에서 추출한 카드에는 메모를 근거로 표시한다", () => {
    setQuery({ items: [{ ...resource, places: [{ ...resource.places![0]!, evidence: { source: "NOTE", text: "서울 카페는 비 오는 날 가기 좋겠어." } }] }], extractionAvailable: true });
    render(<TestPage />);
    const card = screen.getByRole("article", { name: "서울 카페" });
    fireEvent.click(within(card).getByText("원문 근거 보기 · 메모"));
    expect(within(card).queryByRole("link")).not.toBeInTheDocument();
    expect(card).toHaveTextContent(resource.note);
    expect(card).toHaveTextContent("정리한 시각");
  });

  it("저장 실패에는 링크와 메모를 유지하고, 성공 응답 이후에만 비운다", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("저장 실패"));
    render(<TestPage />);
    fireEvent.click(screen.getByRole("button", { name: "자료 추가" }));
    fireEvent.change(screen.getByLabelText("링크"), { target: { value: "https://example.com/stay" } });
    fireEvent.change(screen.getByLabelText("메모"), { target: { value: "함께 볼 숙소" } });
    fireEvent.click(screen.getByRole("button", { name: "자료 저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("저장 실패");
    expect(screen.getByLabelText("링크")).toHaveValue("https://example.com/stay");
    expect(screen.getByLabelText("메모")).toHaveValue("함께 볼 숙소");
    fireEvent.click(screen.getByRole("button", { name: "자료 저장" }));
    await waitFor(() => expect(screen.queryByRole("form", { name: "여행 자료 추가" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "자료 추가" }));
    expect(screen.getByLabelText("메모")).toHaveValue("");
    expect(screen.getByLabelText("링크")).toHaveValue("");
    expect(mutateAsync).toHaveBeenLastCalledWith({ type: "create", input: { url: "https://example.com/stay", note: "함께 볼 숙소" } });
    expect(screen.getByRole("tab", { name: "원본 자료 1" })).toHaveAttribute("aria-selected", "true");
  });

  it("AI를 사용할 수 없어도 메모만 저장할 수 있다", async () => {
    setQuery({ items: [{ ...resource, places: null }], extractionAvailable: false });
    render(<TestPage />);
    expect(screen.getByText(/현재 AI 정보 정리를 사용할 수 없어요/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "원본 자료 1" }));
    expect(screen.getByRole("button", { name: "정보 정리" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "자료 추가" }));
    fireEvent.change(screen.getByLabelText("메모"), { target: { value: "제주 숲길을 걷고 싶어요" } });
    fireEvent.click(screen.getByRole("button", { name: "자료 저장" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ type: "create", input: { url: "", note: "제주 숲길을 걷고 싶어요" } }));
  });

  it("카드 편집 실패에 입력을 유지하고 취소하면 저장 요청 없이 원래 카드를 보여준다", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("수정 실패"));
    render(<TestPage />);
    fireEvent.click(screen.getByRole("button", { name: "카드 수정" }));
    fireEvent.change(screen.getByLabelText("장소명"), { target: { value: "새 카페 이름" } });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("수정 실패");
    expect(screen.getByLabelText("장소명")).toHaveValue("새 카페 이름");
    expect(screen.getByRole("tab", { name: "원본 자료 1" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.getByRole("heading", { name: "서울 카페" })).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("충돌 시 입력을 보존하고 최신 카드 확인 전에는 다시 저장하지 않는다", async () => {
    mutateAsync.mockRejectedValueOnce(new ApiClientError({ status: 409, code: "REVISION_CONFLICT", message: "충돌" }));
    refetch.mockResolvedValue({ data: { items: [{ ...resource, revision: RevisionSchema.make(2), places: [{ ...resource.places![0]!, name: "다른 멤버의 수정" }] }] }, isError: false });
    render(<TestPage />);
    fireEvent.click(screen.getByRole("button", { name: "카드 수정" }));
    fireEvent.change(screen.getByLabelText("장소명"), { target: { value: "내가 작성한 이름" } });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    await screen.findByText(/다른 멤버가 먼저 수정했어요/);
    expect(screen.getByRole("button", { name: "수정 저장" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "최신 카드 확인" }));
    await screen.findByText("다른 멤버의 수정 · 맛집");
    expect(screen.getByLabelText("장소명")).toHaveValue("내가 작성한 이름");
    expect(screen.getByRole("button", { name: "수정 저장" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "최신 내용을 확인했어요" }));
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenLastCalledWith({ type: "edit", resourceId: resource.id, input: expect.objectContaining({ expectedRevision: 2, name: "내가 작성한 이름" }) }));
  });

  it("정리 실패에도 원본을 유지하고 다시 시도할 수 있다", async () => {
    setQuery({ items: [{ ...resource, places: null }], extractionAvailable: true });
    mutateAsync.mockRejectedValueOnce(new Error("원문을 읽지 못했어요"));
    render(<TestPage />);
    fireEvent.click(screen.getByRole("tab", { name: "원본 자료 1" }));
    fireEvent.click(screen.getByRole("button", { name: "정보 정리" }));
    await screen.findByText("원문을 읽지 못했어요");
    expect(screen.getByText(resource.note)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "정보 정리 다시 시도" })).toBeEnabled();
    expect(screen.getByText("정리 전")).toBeInTheDocument();
  });

  it("장소 없음과 정리 전을 구분하고 링크 미열람을 명시한다", () => {
    setQuery({ items: [{ ...resource, places: [], linkStatus: "UNAVAILABLE" }], extractionAvailable: true });
    render(<TestPage />);
    fireEvent.click(screen.getByRole("tab", { name: "원본 자료 1" }));
    expect(screen.getByText("장소 없음")).toBeInTheDocument();
    expect(screen.getByText("링크를 읽지 못해 메모만으로 정리했어요.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "정보 정리" })).not.toBeInTheDocument();
  });

  it("삭제 가능 자료는 확인 후 현재 revision으로 삭제한다", async () => {
    setQuery({ items: [{ ...resource, canManage: true }], extractionAvailable: true });
    mutateAsync.mockResolvedValue({ deleted: true });
    render(<TestPage />);
    fireEvent.click(screen.getByRole("tab", { name: "원본 자료 1" }));
    fireEvent.click(screen.getByRole("button", { name: "자료 삭제" }));
    expect(mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ type: "delete", resourceId: resource.id, expectedRevision: 1 }));
  });

  it("삭제 충돌 뒤 최신 내용을 확인하기 전에는 재삭제하지 않고 확인한 revision을 사용한다", async () => {
    setQuery({ items: [{ ...resource, canManage: true }], extractionAvailable: true });
    mutateAsync.mockRejectedValueOnce(new ApiClientError({ status: 409, code: "REVISION_CONFLICT", message: "충돌" })).mockResolvedValue({ deleted: true });
    refetch.mockResolvedValue({ data: { items: [{ ...resource, canManage: true, revision: RevisionSchema.make(2), places: [{ ...resource.places![0]!, name: "멤버가 바꾼 카페", summary: "토요일에 함께 가요" }] }] }, isError: false });
    render(<TestPage />);
    fireEvent.click(screen.getByRole("tab", { name: "원본 자료 1" }));
    fireEvent.click(screen.getByRole("button", { name: "자료 삭제" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    fireEvent.click(dialog.getByRole("button", { name: "삭제" }));
    await dialog.findByText(/다른 멤버가 자료를 변경했어요/);
    fireEvent.click(dialog.getByRole("button", { name: "삭제" }));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(dialog.getByRole("button", { name: "삭제" })).toBeDisabled();
    fireEvent.click(dialog.getByRole("button", { name: "최신 자료 확인" }));
    const latest = within(await dialog.findByRole("region", { name: "최신 자료 내용" }));
    expect(latest.getByText(resource.note)).toBeInTheDocument();
    expect(latest.getByText("멤버가 바꾼 카페 · 맛집")).toBeInTheDocument();
    expect(latest.getByText("토요일에 함께 가요")).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(dialog.getByRole("button", { name: "삭제" })).toBeEnabled();
    fireEvent.click(dialog.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenLastCalledWith({ type: "delete", resourceId: resource.id, expectedRevision: 2 }));
  });

  it.each([
    { result: { data: { items: [] }, isError: false }, message: "이 자료는 이미 삭제되었어요." },
    { result: { data: { items: [{ ...resource, canManage: false }] }, isError: false }, message: "이 자료를 삭제할 권한이 없어요." },
    { result: { data: { items: [{ ...resource, canManage: true }] }, isError: true }, message: "최신 자료를 불러오지 못했어요. 다시 확인해주세요." },
  ])("삭제 충돌 복구 중 $message 재삭제를 차단한다", async ({ result, message }) => {
    setQuery({ items: [{ ...resource, canManage: true }], extractionAvailable: true });
    mutateAsync.mockRejectedValueOnce(new ApiClientError({ status: 409, code: "REVISION_CONFLICT", message: "충돌" }));
    refetch.mockResolvedValue(result);
    render(<TestPage />);
    fireEvent.click(screen.getByRole("tab", { name: "원본 자료 1" }));
    fireEvent.click(screen.getByRole("button", { name: "자료 삭제" }));
    const dialog = within(await screen.findByRole("alertdialog"));
    fireEvent.click(dialog.getByRole("button", { name: "삭제" }));
    fireEvent.click(await dialog.findByRole("button", { name: "최신 자료 확인" }));
    await dialog.findByText(message);
    expect(dialog.getByRole("button", { name: "삭제" })).toBeDisabled();
    expect(dialog.queryByRole("region", { name: "최신 자료 내용" })).not.toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("새로고침으로 공동 자료를 다시 조회해도 작성 중인 메모는 유지한다", async () => {
    render(<TestPage />);
    fireEvent.click(screen.getByRole("button", { name: "자료 추가" }));
    fireEvent.change(screen.getByLabelText("메모"), { target: { value: "작성 중인 메모" } });
    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("메모")).toHaveValue("작성 중인 메모");
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("일시적 조회 실패에는 입력을 보존하고 권한 실패에는 캐시 자료를 숨긴다", () => {
    const { rerender } = render(<TestPage />);
    fireEvent.click(screen.getByRole("button", { name: "자료 추가" }));
    fireEvent.change(screen.getByLabelText("메모"), { target: { value: "작성 중인 메모" } });
    setQuery(undefined, new ApiClientError({ status: 0, message: "연결 실패" }));
    rerender(<TestPage />);
    expect(screen.getByLabelText("메모")).toHaveValue("작성 중인 메모");
    expect(screen.getByRole("alert")).toHaveTextContent("마지막으로 불러온 내용을 보고 있어요");
    setQuery(undefined, new ApiClientError({ status: 403, message: "접근 권한이 없어요" }));
    rerender(<TestPage />);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("메모")).not.toBeInTheDocument();
  });

  it("기존 자료가 있으면 카드를 먼저 보여주고, 추가 폼을 닫았다 열어도 입력을 유지한다", () => {
    render(<TestPage />);
    expect(screen.getByRole("article", { name: "서울 카페" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "여행 자료 추가" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "자료 추가" }));
    fireEvent.change(screen.getByLabelText("메모"), { target: { value: "나중에 저장할 메모" } });
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByLabelText("메모")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "자료 추가" }));
    expect(screen.getByLabelText("메모")).toHaveValue("나중에 저장할 메모");
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("자료가 없는 여행은 처음부터 추가 폼을 보여준다", () => {
    setQuery({ items: [], extractionAvailable: true });
    render(<TestPage />);
    expect(screen.getByRole("form", { name: "여행 자료 추가" })).toBeInTheDocument();
    expect(screen.getByLabelText("메모")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "닫기" })).not.toBeInTheDocument();
  });

  it("편집 중 다른 멤버가 자료를 삭제해도 입력은 복사할 수 있게 남기고 저장을 막는다", () => {
    const { rerender } = render(<TestPage />);
    fireEvent.click(screen.getByRole("button", { name: "카드 수정" }));
    fireEvent.change(screen.getByLabelText("장소명"), { target: { value: "아직 저장하지 않은 이름" } });
    setQuery({ items: [], extractionAvailable: true });
    rerender(<TestPage />);
    expect(screen.getByLabelText("장소명")).toHaveValue("아직 저장하지 않은 이름");
    expect(screen.getByRole("alert")).toHaveTextContent("이 자료가 삭제되었어요");
    expect(screen.getByRole("button", { name: "수정 저장" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.getByRole("tab", { name: "원본 자료 0" })).not.toHaveAttribute("aria-disabled", "true");
  });
});
