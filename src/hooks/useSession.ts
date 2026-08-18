import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Option } from "effect";
import { appRuntime } from "../app/runtime.ts";
import { getOptionalSession } from "../core/ports/session.ts";
import type { UserSession } from "../core/domain/room.ts";

export const sessionKeys = {
  all: ["session"] as const,
  current: (): readonly ["session", "current"] => [...sessionKeys.all, "current"] as const,
};

export const useSessionQuery = (): UseQueryResult<UserSession | null, Error> =>
  useQuery<UserSession | null, Error>({
    queryKey: sessionKeys.current(),
    queryFn: async ({ signal }): Promise<UserSession | null> => {
      const opt = await appRuntime.runPromise(getOptionalSession, { signal });
      return Option.isSome(opt) ? opt.value : null;
    },
    staleTime: 1000 * 60 * 5,
  });

