import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 재시도 및 오류 분류 정책은 Effect 프로그램이 담당하므로 React Query의 자동 retry는 비활성화
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5분
    },
    mutations: {
      retry: false,
    },
  },
});
