import { useState } from "react";
import { useParams } from "react-router-dom";
import { Result } from "effect";
import { ApiClientError } from "../../app/api-client.ts";
import { OFFLINE_MUTATION_MESSAGE } from "../../app/offline-mutation.ts";
import { decodeRouteParams, TripParamsSchema } from "../../app/routes/route-params.ts";
import { PLACE_CATEGORY_LABELS, RESOURCE_LIMIT, RESOURCE_NOTE_LIMIT, type TripResourceResponse } from "../../contracts/trip-resource.ts";
import type { PlaceCard } from "../../core/domain/trip-resource.ts";
import { useOnlineStatus } from "../../hooks/useOnlineStatus.ts";
import { platform } from "../../platform/index.ts";
import { PageBody } from "@/components/galanda/page-body.tsx";
import { PageState } from "@/components/galanda/page-state.tsx";
import { PageTitle } from "@/components/galanda/page-title.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Field, FieldLabel } from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog.tsx";
import { RouteErrorFallback } from "../common/RouteErrorFallback.tsx";
import { isRevisionConflict, toUserMessage } from "../common/error-message.ts";
import { useTripResourceMutation, useTripResourcesQuery } from "./queries.ts";

type EditingPlace = {
  resourceId: string;
  source: TripResourceResponse;
  index: number;
  revision: TripResourceResponse["revision"];
  name: string;
  category: PlaceCard["category"];
  location: string;
  summary: string;
};

function SourceLink({ resource }: { resource: TripResourceResponse }) {
  const [error, setError] = useState<string>();
  return (
    <div className="min-w-0 text-sm text-foreground-muted">
      {resource.url ? (
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-(--touch-target-min) max-w-full items-center text-primary underline underline-offset-4 [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-ring"
          onClick={(event) => {
            event.preventDefault();
            setError(undefined);
            void platform.openExternalUrl(resource.url).catch(() => setError("링크를 열지 못했어요. 다시 시도해주세요."));
          }}
        >
          {resource.url}
        </a>
      ) : <span>메모에서 정리한 정보</span>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function TripResourcesPage() {
  const params = useParams();
  const validated = decodeRouteParams(TripParamsSchema, params);
  if (Result.isFailure(validated)) return <RouteErrorFallback message="유효하지 않은 여행방 식별자입니다." />;
  return <TripResourcesContent key={validated.success.tripId} tripId={validated.success.tripId} />;
}

function TripResourcesContent({ tripId }: { tripId: string }) {
  const query = useTripResourcesQuery(tripId);
  const mutation = useTripResourceMutation(tripId);
  const isOnline = useOnlineStatus();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [section, setSection] = useState("places");
  const [createError, setCreateError] = useState<string>();
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState<{ resourceId: string; type: "organize" | "delete"; message: string }>();
  const [editing, setEditing] = useState<EditingPlace>();
  const [editError, setEditError] = useState<string>();
  const [editConflict, setEditConflict] = useState(false);
  const [reviewedResource, setReviewedResource] = useState<TripResourceResponse>();
  const [deleteTarget, setDeleteTarget] = useState<TripResourceResponse>();
  const [deleteReview, setDeleteReview] = useState<"required" | "review">();
  const disabled = mutation.isPending || !isOnline;
  const deleteBlocked = disabled || query.isFetching || deleteReview === "required";

  const accessDenied = query.error instanceof ApiClientError && [401, 403, 404].includes(query.error.status);
  if (accessDenied || (!query.data && query.isError)) {
    return <PageBody><PageState status="error" title="자료함을 불러오지 못했어요" description={toUserMessage(query.error, "잠시 후 다시 시도해주세요.")} actionText="다시 시도" onAction={() => void query.refetch()} /></PageBody>;
  }
  if (!query.data) return <PageBody><PageState status="loading" message="여행 자료를 불러오는 중이에요." /></PageBody>;

  const { items, extractionAvailable } = query.data;
  const showAddForm = isAdding || items.length === 0;
  const placeCount = items.reduce((count, resource) => count + (resource.places?.length ?? 0), 0);
  const unprocessedCount = items.filter((resource) => resource.places === null).length;
  const editingResourceDeleted = Boolean(editing && !items.some((resource) => resource.id === editing.resourceId));
  const cardResources = editingResourceDeleted && editing ? [...items, editing.source] : items;

  const saveResource = async () => {
    if (disabled || editing) return;
    setCreateError(undefined);
    setNotice("");
    try {
      await mutation.mutateAsync({ type: "create", input: { url: url.trim(), note: note.trim() } });
      setUrl("");
      setNote("");
      setIsAdding(false);
      setSection("sources");
      setNotice("자료를 저장했어요. 원본 자료에서 정보를 정리할 수 있어요.");
    } catch (error) {
      setCreateError(toUserMessage(error, "자료를 저장하지 못했어요. 입력 내용은 유지돼요."));
    }
  };

  const actOnResource = async (type: "organize" | "delete", resource: TripResourceResponse) => {
    if (disabled || (type === "delete" && deleteBlocked)) return;
    setActionError(undefined);
    setNotice("");
    try {
      const result = await mutation.mutateAsync({ type, resourceId: resource.id, expectedRevision: resource.revision });
      if (type === "organize" && "places" in result) {
        setNotice(result.places?.length ? `${result.places.length}개의 장소 카드로 정리했어요.` : "자료에서 장소를 찾지 못했어요. 원본은 그대로 보관돼요.");
        if (result.places?.length) setSection("places");
      } else {
        setDeleteTarget(undefined);
        setNotice("자료와 연결된 장소 카드를 삭제했어요.");
      }
    } catch (error) {
      if (type === "delete" && (isRevisionConflict(error) || (error instanceof ApiClientError && [401, 403, 404].includes(error.status)))) setDeleteReview("required");
      setActionError({
        resourceId: resource.id,
        type,
        message: isRevisionConflict(error)
          ? "다른 멤버가 자료를 변경했어요. 최신 자료를 확인한 뒤 다시 시도해주세요."
          : toUserMessage(error, "처리하지 못했어요. 원본은 그대로 보관돼요. 다시 시도해주세요."),
      });
    }
  };

  const checkLatestDelete = async () => {
    if (!deleteTarget || disabled || query.isFetching) return;
    setDeleteReview("required");
    const result = await query.refetch();
    const resource = result.data?.items.find((item) => item.id === deleteTarget.id);
    if (result.isError || !resource?.canManage) {
      setActionError({
        resourceId: deleteTarget.id,
        type: "delete",
        message: result.isError
          ? "최신 자료를 불러오지 못했어요. 다시 확인해주세요."
          : !resource ? "이 자료는 이미 삭제되었어요." : "이 자료를 삭제할 권한이 없어요.",
      });
      return;
    }
    setDeleteTarget(resource);
    setActionError(undefined);
    setDeleteReview("review");
  };

  const savePlace = async () => {
    if (!editing || disabled || editConflict || editingResourceDeleted) return;
    setEditError(undefined);
    try {
      await mutation.mutateAsync({
        type: "edit", resourceId: editing.resourceId,
        input: { expectedRevision: editing.revision, index: editing.index, name: editing.name.trim(), category: editing.category, location: editing.location.trim(), summary: editing.summary.trim() },
      });
      setEditing(undefined);
      setNotice("장소 카드를 수정했어요. 원문 근거는 그대로 남겨두었어요.");
    } catch (error) {
      setEditConflict(isRevisionConflict(error));
      setEditError(isRevisionConflict(error)
        ? "다른 멤버가 먼저 수정했어요. 작성 중인 내용은 유지돼요. 최신 카드를 확인해주세요."
        : toUserMessage(error, "카드를 수정하지 못했어요. 입력 내용은 유지돼요."));
    }
  };

  const checkLatestPlace = async () => {
    const result = await query.refetch();
    if (result.isError) {
      setEditError("최신 카드를 불러오지 못했어요. 입력 내용은 유지돼요.");
      return;
    }
    const resource = result.data?.items.find((item) => item.id === editing?.resourceId);
    if (!resource?.places?.[editing?.index ?? -1]) {
      setEditError("이 자료가 삭제되었어요. 작성 중인 내용은 복사해서 보관할 수 있어요.");
      return;
    }
    setReviewedResource(resource);
  };

  return (
    <PageBody>
      <PageTitle title="함께 모은 여행 자료" description="링크와 메모를 모으고, 장소별로 정리해요." action={
        <Button type="button" variant="ghost" disabled={!isOnline || query.isFetching || mutation.isPending} onClick={() => void query.refetch()}>{query.isFetching ? "불러오는 중…" : "새로고침"}</Button>
      } />
      <div className="flex min-w-0 flex-col gap-6 px-(--app-inline-padding)">
        {query.isError && <div role="alert" className="text-sm text-warning"><p>최신 자료를 확인하지 못했어요. 마지막으로 불러온 내용을 보고 있어요.</p><Button variant="ghost" onClick={() => void query.refetch()}>다시 불러오기</Button></div>}
        {!isOnline && <output className="text-sm text-foreground-muted">{OFFLINE_MUTATION_MESSAGE}</output>}
        {showAddForm ? <form className="flex flex-col gap-3 rounded-2xl bg-surface-subtle p-4" aria-label="여행 자료 추가" onSubmit={(event) => { event.preventDefault(); void saveResource(); }}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">발견한 자료를 남겨보세요</h2>
            {items.length > 0 && <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={() => setIsAdding(false)}>닫기</Button>}
          </div>
          <Field>
            <FieldLabel htmlFor="resource-url">링크</FieldLabel>
            <Input id="resource-url" type="url" inputMode="url" autoComplete="off" placeholder="https://" maxLength={2048} value={url} onChange={(event) => { setUrl(event.target.value); setIsAdding(true); }} disabled={mutation.isPending || Boolean(editing)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="resource-note">메모</FieldLabel>
            <Textarea id="resource-note" placeholder="장소 정보나 함께 보고 싶은 내용을 적어주세요." rows={3} maxLength={RESOURCE_NOTE_LIMIT} value={note} onChange={(event) => { setNote(event.target.value); setIsAdding(true); }} disabled={mutation.isPending || Boolean(editing)} />
          </Field>
          <p className="text-sm text-foreground-muted">링크나 메모 중 하나만 있어도 저장할 수 있어요. 여행 멤버 모두에게 보여요.</p>
          {createError && <p role="alert" className="text-sm text-destructive-strong">{createError}</p>}
          {items.length >= RESOURCE_LIMIT && <p className="text-sm text-foreground-muted">자료는 여행마다 {RESOURCE_LIMIT}개까지 보관할 수 있어요.</p>}
          <Button type="submit" size="lg" disabled={disabled || Boolean(editing) || (!url.trim() && !note.trim()) || items.length >= RESOURCE_LIMIT}>
            {mutation.isPending && mutation.variables?.type === "create" ? "저장 중…" : "자료 저장"}
          </Button>
        </form> : <Button type="button" variant="outline" size="lg" disabled={mutation.isPending || Boolean(editing)} onClick={() => setIsAdding(true)}>자료 추가</Button>}
        {!extractionAvailable && <p className="text-sm text-foreground-muted">현재 AI 정보 정리를 사용할 수 없어요. 링크와 메모는 계속 모아둘 수 있어요.</p>}
        {notice && <output className="text-sm text-primary">{notice}</output>}
        <Tabs value={section} onValueChange={(value) => { if (!editing) setSection(String(value)); }}>
          <TabsList className="w-full" aria-label="자료 보기">
            <TabsTrigger value="places">장소 카드 {placeCount}</TabsTrigger>
            <TabsTrigger value="sources" disabled={Boolean(editing)}>원본 자료 {items.length}</TabsTrigger>
          </TabsList>
          <TabsContent value="places" className="mt-3">
            {placeCount === 0 && !editing ? <PageState status="empty" title="아직 정리된 장소가 없어요" description={unprocessedCount ? `원본 자료 ${unprocessedCount}개가 정리를 기다려요.` : "링크나 메모를 저장한 뒤 정보 정리를 눌러보세요."} actionText={items.length ? "원본 자료 보기" : undefined} onAction={items.length ? () => setSection("sources") : undefined} /> : (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-foreground-muted">AI가 원문에서 정리한 정보예요. 가격·운영 정보는 출처에서 다시 확인해주세요.</p>
                {cardResources.flatMap((resource) => (resource.places ?? []).map((place, index) => {
                  if (editingResourceDeleted && resource.id === editing?.resourceId && index !== editing.index) return null;
                  const isEditing = editing?.resourceId === resource.id && editing.index === index;
                  return <article key={`${resource.id}-${index}`} className="min-w-0 rounded-2xl bg-surface-subtle p-4" aria-label={place.name}>
                    {isEditing ? <form className="flex flex-col gap-3" aria-label="장소 카드 수정" onSubmit={(event) => { event.preventDefault(); void savePlace(); }}>
                      {editingResourceDeleted && <p role="alert" className="text-sm text-destructive-strong">이 자료가 삭제되었어요. 작성 중인 내용은 복사해서 보관할 수 있어요.</p>}
                      <Field><FieldLabel htmlFor="place-name">장소명</FieldLabel><Input id="place-name" value={editing.name} maxLength={120} required disabled={mutation.isPending} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></Field>
                      <Field><FieldLabel htmlFor="place-category">분류</FieldLabel><select id="place-category" value={editing.category} disabled={mutation.isPending} className="min-h-(--touch-target-min) rounded-lg border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring" onChange={(event) => setEditing({ ...editing, category: event.target.value as PlaceCard["category"] })}>{Object.entries(PLACE_CATEGORY_LABELS).map(([category, label]) => <option key={category} value={category}>{label}</option>)}</select></Field>
                      <Field><FieldLabel htmlFor="place-location">위치</FieldLabel><Input id="place-location" value={editing.location} maxLength={200} disabled={mutation.isPending} onChange={(event) => setEditing({ ...editing, location: event.target.value })} /></Field>
                      <Field><FieldLabel htmlFor="place-summary">설명</FieldLabel><Textarea id="place-summary" value={editing.summary} maxLength={700} disabled={mutation.isPending} onChange={(event) => setEditing({ ...editing, summary: event.target.value })} /></Field>
                      {editError && <p role="alert" className="text-sm text-destructive-strong">{editError}</p>}
                      {editConflict && <Button type="button" variant="outline" disabled={!isOnline || query.isFetching} onClick={() => void checkLatestPlace()}>최신 카드 확인</Button>}
                      {editConflict && reviewedResource && <div className="rounded-lg bg-background p-3 text-sm" aria-label="최신 카드 내용">
                        <h3 className="font-semibold">현재 저장된 카드</h3>
                        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{reviewedResource.places?.[index]?.name} · {PLACE_CATEGORY_LABELS[reviewedResource.places![index]!.category]}</p>
                        <p>{reviewedResource.places?.[index]?.location || "위치 확인 필요"}</p>
                        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{reviewedResource.places?.[index]?.summary || "설명 확인 필요"}</p>
                        <Button type="button" variant="outline" className="mt-2" onClick={() => { setEditing({ ...editing, revision: reviewedResource.revision }); setEditConflict(false); setReviewedResource(undefined); setEditError(undefined); }}>최신 내용을 확인했어요</Button>
                      </div>}
                      <div className="flex gap-2"><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => { setEditing(undefined); setEditError(undefined); setEditConflict(false); setReviewedResource(undefined); }}>취소</Button><Button type="submit" disabled={disabled || editConflict || editingResourceDeleted || !editing.name.trim()}>{mutation.isPending ? "저장 중…" : "수정 저장"}</Button></div>
                    </form> : <>
                      <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{PLACE_CATEGORY_LABELS[place.category]}</Badge><span className="text-xs text-foreground-muted">{place.edited ? "멤버가 수정함" : "AI가 정리함"}</span></div>
                      <h2 className="mt-3 text-lg font-semibold [overflow-wrap:anywhere]">{place.name}</h2>
                      <p className="mt-1 text-sm text-foreground-muted [overflow-wrap:anywhere]">{place.location || "위치 확인 필요"}</p>
                      <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed [overflow-wrap:anywhere]">{place.summary || "설명 확인 필요"}</p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-foreground-muted">자료를 올린 멤버 · {resource.createdByName}</p><Button type="button" variant="ghost" disabled={disabled || Boolean(editing)} onClick={() => { setEditing({ resourceId: resource.id, source: resource, index, revision: resource.revision, name: place.name, category: place.category, location: place.location, summary: place.summary }); setEditError(undefined); setEditConflict(false); setReviewedResource(undefined); }}>카드 수정</Button></div>
                    </>}
                    <details className="mt-2 text-sm">
                      <summary className="flex min-h-(--touch-target-min) cursor-pointer items-center text-foreground-muted focus-visible:outline-2 focus-visible:outline-ring">
                        원문 근거 보기 · {place.evidence.source === "LINK" ? "링크" : "메모"}
                      </summary>
                      <blockquote className="whitespace-pre-wrap border-l-2 border-border pl-3 leading-relaxed [overflow-wrap:anywhere]">{place.evidence.text}</blockquote>
                      {place.evidence.source === "LINK" ? <SourceLink resource={resource} /> : <p className="mt-2 whitespace-pre-wrap text-foreground-muted [overflow-wrap:anywhere]">{resource.note}</p>}
                      {resource.processedAt && <p className="mt-2 text-xs text-foreground-muted">정리한 시각 · <time dateTime={resource.processedAt}>{new Date(resource.processedAt).toLocaleString("ko-KR")}</time></p>}
                    </details>
                    {resource.linkStatus === "UNAVAILABLE" && <p className="mt-2 text-sm text-warning">링크를 읽지 못해 메모만으로 정리했어요.</p>}
                  </article>;
                }))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="sources" className="mt-3">
            {items.length === 0 ? <PageState status="empty" title="함께 볼 자료를 모아보세요" description="숙소, 여행지, 액티비티 링크나 메모를 남기면 멤버들과 함께 볼 수 있어요." /> : <ul className="flex flex-col gap-4">{items.map((resource) => <li key={resource.id} className="min-w-0 rounded-2xl bg-surface-subtle p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{resource.createdByName}</p><Badge variant="secondary">{resource.places === null ? "정리 전" : resource.places.length ? `장소 ${resource.places.length}개` : "장소 없음"}</Badge></div>
              {resource.url && <SourceLink resource={resource} />}
              {resource.note && <p className="mt-2 whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">{resource.note}</p>}
              {resource.linkStatus === "UNAVAILABLE" && <p className="mt-3 text-sm text-warning">링크를 읽지 못해 메모만으로 정리했어요.</p>}
              {resource.places?.length === 0 && <p className="mt-3 text-sm text-foreground-muted">이 자료에서 장소를 찾지 못했어요. 원본은 그대로 보관돼요.</p>}
              {actionError?.resourceId === resource.id && <div role="alert" className="mt-3 text-sm text-destructive-strong"><p>{actionError.message}</p><Button type="button" variant="ghost" disabled={!isOnline || query.isFetching} onClick={() => void query.refetch()}>최신 자료 확인</Button></div>}
              <div className="mt-3 flex flex-wrap gap-2">
                {resource.places === null && <Button type="button" variant="outline" disabled={disabled || !extractionAvailable} onClick={() => void actOnResource("organize", resource)}>{mutation.isPending && mutation.variables?.type === "organize" && mutation.variables.resourceId === resource.id ? "정보 정리 중…" : actionError?.resourceId === resource.id && actionError.type === "organize" ? "정보 정리 다시 시도" : "정보 정리"}</Button>}
                {resource.canManage && <Button type="button" variant="ghost" disabled={disabled} onClick={() => { setDeleteTarget(resource); setDeleteReview(undefined); setActionError(undefined); }}>자료 삭제</Button>}
              </div>
            </li>)}</ul>}
          </TabsContent>
        </Tabs>
      </div>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !mutation.isPending && !query.isFetching) setDeleteTarget(undefined); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>이 자료를 삭제할까요?</AlertDialogTitle><AlertDialogDescription>원본과 연결된 장소 카드가 멤버 모두의 자료함에서 삭제돼요.</AlertDialogDescription></AlertDialogHeader>
          {deleteTarget && actionError?.resourceId === deleteTarget.id && <p role="alert" className="text-sm text-destructive-strong">{actionError.message}</p>}
          {deleteReview === "required" && <Button variant="outline" disabled={disabled || query.isFetching} onClick={() => void checkLatestDelete()}>최신 자료 확인</Button>}
          {deleteTarget && deleteReview === "review" &&
            <section aria-label="최신 자료 내용" className="max-h-60 overflow-y-auto rounded-lg bg-surface-subtle p-3 text-sm">
              <h3 className="font-semibold">현재 저장된 자료</h3>
              {deleteTarget.url && <SourceLink resource={deleteTarget} />}
              {deleteTarget.note && <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{deleteTarget.note}</p>}
              {deleteTarget.places?.length ? <ul className="mt-3 flex flex-col gap-3">{deleteTarget.places.map((place, index) => <li key={index}>
                <p className="font-semibold [overflow-wrap:anywhere]">{place.name} · {PLACE_CATEGORY_LABELS[place.category]}</p>
                <p className="[overflow-wrap:anywhere]">{place.location || "위치 확인 필요"}</p>
                <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{place.summary || "설명 확인 필요"}</p>
              </li>)}</ul> : <p className="mt-2">{deleteTarget.places === null ? "정리 전" : "장소 없음"}</p>}
            </section>}
          <AlertDialogFooter><Button variant="outline" disabled={mutation.isPending || query.isFetching} onClick={() => setDeleteTarget(undefined)}>취소</Button><Button variant="destructive" disabled={deleteBlocked} onClick={() => { if (deleteTarget) void actOnResource("delete", deleteTarget); }}>삭제</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageBody>
  );
}
