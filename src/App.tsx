import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./app/query-client.ts";
import { AppRouter } from "./app/router.tsx";
import { Toaster } from "@/components/ui/sonner.tsx";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      {/* 하단 고정 CTA(BottomAction)와 겹치지 않게 모바일 오프셋을 줘요. */}
      <Toaster
        position="bottom-center"
        mobileOffset={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}
      />
    </QueryClientProvider>
  );
}

export default App;
