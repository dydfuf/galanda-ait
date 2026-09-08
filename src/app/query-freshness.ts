export const COLLABORATION_READ_FRESHNESS = {
  staleTime: 0,
  refetchOnMount: true,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
} as const;

export const EDITOR_BASELINE_FRESHNESS = {
  staleTime: 0,
  refetchOnMount: true,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchInterval: false,
} as const;
