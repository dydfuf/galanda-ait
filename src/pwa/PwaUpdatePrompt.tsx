import { useEffect } from "react"
import { toast } from "sonner"
import { useRegisterSW } from "virtual:pwa-register/react"

/**
 * PWA Service Worker update lifecycle prompt.
 *
 * - registerType: "prompt" 이므로 새 SW가 대기 중이어도 자동 reload하지 않아요.
 * - 사용자가 "업데이트"를 눌렀을 때만 `updateServiceWorker(true)`로 skipWaiting + reload 해요.
 * - "나중에"는 현재 화면/입력 상태를 유지하고 toast만 닫아요.
 * - sonner 기반 non-blocking toast로 기존 UI foundation을 재사용해요.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      // 주기적 업데이트 체크는 Workbox 기본 interval에 위임해요.
      // 필요하면 r?.update()로 수동 체크를 추가할 수 있어요.
      if (r) {
        // no-op, reference만 유지
      }
    },
    onRegisterError(error) {
      console.error("[PWA] Service Worker 등록 실패:", error)
    },
  })

  useEffect(() => {
    if (!needRefresh) return

    const id = toast("새 버전이 준비되었어요", {
      description: "업데이트하면 최신 기능과 수정을 바로 사용할 수 있어요.",
      duration: Infinity,
      closeButton: true,
      action: {
        label: "업데이트",
        onClick: () => {
          void updateServiceWorker(true)
        },
      },
      cancel: {
        label: "나중에",
        onClick: () => {
          setNeedRefresh(false)
        },
      },
      onDismiss: () => {
        // 사용자가 X로 닫은 경우에도 대기 상태는 유지하지 않고 닫아요.
        // 다시 필요하면 다음 SW 업데이트 감지 시 재표시돼요.
        setNeedRefresh(false)
      },
    })

    return () => {
      toast.dismiss(id)
    }
  }, [needRefresh, setNeedRefresh, updateServiceWorker])

  return null
}
