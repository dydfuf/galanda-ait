// 초대 capability는 열린 공유 UI의 메모리에만 보관한다. 저장소나 로그에 남기지 않는다.
let inviteUrl: string | undefined;
const listeners = new Set<() => void>();

export function getInviteShareFallback(): string | undefined {
  return inviteUrl;
}

export function subscribeInviteShareFallback(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setInviteShareFallback(url: string | undefined): void {
  inviteUrl = url;
  listeners.forEach((listener) => listener());
}
