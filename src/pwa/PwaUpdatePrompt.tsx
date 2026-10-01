import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import { useRegisterSW } from "virtual:pwa-register/react"

import { activateWaitingWorker } from "./activate-waiting-worker.ts"

// Prompt updates preserve the current page until the user opts in and the new
// worker has actually activated. A timeout or failed message must not reload.
const PERIODIC_UPDATE_INTERVAL_MS = 60 * 60 * 1000 // 1 hour — conservative for long-lived standalone

export function PwaUpdatePrompt() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const selectedWorkerRef = useRef<ServiceWorker | null>(null)
  const updateInProgressRef = useRef(false)
  const periodicIntervalRef = useRef<number | null>(null)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Own reload after confirmed activation; avoid the plugin's independent reload.
    onNeedReload() {},
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      registrationRef.current = registration
      // P2: 주기적 업데이트 체크는 기본 제공되지 않으므로 앱에서 직접 polling 해요.
      // https://github.com/vite-pwa/vite-plugin-pwa/blob/main/docs/frameworks/react.md#periodic-sw-updates
      if (periodicIntervalRef.current) {
        clearInterval(periodicIntervalRef.current)
      }
      periodicIntervalRef.current = window.setInterval(() => {
        void registration.update().catch(() => {
          // network failure 등은 무시 — 다음 interval에 재시도
        })
      }, PERIODIC_UPDATE_INTERVAL_MS)
    },
    onRegisterError(error) {
      console.error("[PWA] Service Worker 등록 실패:", error)
    },
  })

  useEffect(() => {
    return () => {
      if (periodicIntervalRef.current) {
        clearInterval(periodicIntervalRef.current)
        periodicIntervalRef.current = null
      }
    }
  }, [])

  const handleUpdate = useCallback(async function update() {
    if (updateInProgressRef.current) return
    updateInProgressRef.current = true
    try {
      selectedWorkerRef.current = registrationRef.current?.waiting ?? selectedWorkerRef.current
      await activateWaitingWorker(selectedWorkerRef.current, updateServiceWorker)
      window.location.reload()
    } catch {
      toast.error("업데이트를 완료하지 못했어요", {
        duration: Infinity,
        closeButton: true,
        description: "현재 화면은 유지돼요. 준비되면 다시 시도해 주세요.",
        action: { label: "다시 시도", onClick: () => { void update() } },
      })
    } finally {
      updateInProgressRef.current = false
    }
  }, [updateServiceWorker])

  useEffect(() => {
    if (!needRefresh) return
    selectedWorkerRef.current = registrationRef.current?.waiting ?? selectedWorkerRef.current

    const id = toast("새 버전이 준비되었어요", {
      description: "업데이트하면 최신 기능과 수정을 바로 사용할 수 있어요.",
      duration: Infinity,
      closeButton: true,
      action: {
        label: "업데이트",
        onClick: () => {
          void handleUpdate()
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
  }, [needRefresh, setNeedRefresh, handleUpdate])

  return null
}
