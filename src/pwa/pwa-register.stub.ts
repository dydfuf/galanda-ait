// AIT 빌드에서 `virtual:pwa-register/react`를 대체하는 stub이에요.
// Web/PWA 빌드에서는 vite-plugin-pwa가 virtual 모듈을 제공하므로 이 파일은 사용되지 않아요.

export function useRegisterSW(_options?: unknown) {
  return {
    needRefresh: [false, () => {}] as const,
    offlineReady: [false, () => {}] as const,
    updateServiceWorker: (_reloadPage?: boolean) => Promise.resolve(),
  }
}
