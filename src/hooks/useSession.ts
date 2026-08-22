import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { UserSession } from "../core/domain/room.ts";
import { getCurrentSession } from "../app/api-client.ts";

export const sessionKeys = {
  all: ["session"] as const,
  current: (): readonly ["session", "current"] => [...sessionKeys.all, "current"] as const,
};

/**
 * 현재 세션 조회
 * - 비로그인: data === null (오류 아님)
 * - 세션 조회 실패(SessionUnavailableError): isError === true
 *   화면은 두 상태를 구분해 안내해야 한다
 */
export const useSessionQuery = (): UseQueryResult<UserSession | null, Error> =>
  useQuery<UserSession | null, Error>({
    queryKey: sessionKeys.current(),
    queryFn: ({ signal }): Promise<UserSession | null> =>
      getCurrentSession(signal),
    staleTime: 1000 * 60 * 5,
  });
