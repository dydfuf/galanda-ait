import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import { useRegisterSW } from "virtual:pwa-register/react"

/**
 * PWA Service Worker update lifecycle prompt.
 *
 * - registerType: "prompt" 이므로 새 SW가 대기 중이어도 자동 reload하지 않아요.
 * - 사용자가 "업데이트"를 눌렀을 때만 skipWaiting + reload 해요.
 * - "나중에"는 현재 화면/입력 상태를 유지하고 toast만 닫아요.
 * - sonner 기반 non-blocking toast로 기존 UI foundation을 재사용해요.
 *
 * P1 workaround (vite-plugin-pwa@1.3.0 #789):
 * prompt 모드의 `controlling` 핸들러가 `event.isUpdate` 체크 때문에 첫 업데이트에서
 * reload가 되지 않는 upstream 버그가 있어요 (PR #931 아직 open, 2026-08-25 기준).
 * `updateServiceWorker(true)`만으로는 첫 v1→v2 업데이트에서 페이지가 reload되지 않을 수 있어
 * 앱 레벨에서 `navigator.serviceWorker.controllerchange`를 one-shot으로 감시하고
 * fallback 타이머로 강제 reload를 보장해요. iOS/Safari의 controllerchange 미발생 케이스도 fallback이 커버해요.
 *
 * P2 periodic polling:
 * vite-plugin-pwa/react 문서에 따르면 주기적 SW 업데이트는 기본 제공되지 않고
 * 앱에서 `registration.update()`를 interval로 호출해야 해요. standalone으로 장시간
 * 열려있는 여행 앱 시나리오를 위해 1시간마다 polling을 수행해요.
 */

const PERIODIC_UPDATE_INTERVAL_MS = 60 * 60 * 1000 // 1 hour — conservative for long-lived standalone

export function PwaUpdatePrompt() {
  const periodicIntervalRef = useRef<number | null>(null)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
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

  const handleUpdate = useCallback(async () => {
    // P1 workaround: vite-plugin-pwa@1.3.0 controlling handler의 isUpdate 버그(#789) 때문에
    // 첫 업데이트에서 reload가 누락될 수 있어 controllerchange + fallback으로 보장해요.
    if (!("serviceWorker" in navigator)) {
      await updateServiceWorker(true)
      window.location.reload()
      return
    }

    let reloaded = false
    const doReload = () => {
      if (!reloaded) {
        reloaded = true
        window.location.reload()
      }
    }

    let fallbackId: number | null = null
    const onControllerChange = () => {
      if (fallbackId !== null) clearTimeout(fallbackId)
      doReload()
    }

    // one-shot controllerchange 감시 — vite-plugin-pwa #789 isUpdate 버그 우회
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange, {
      once: true,
    })

    // iOS/Safari 및 isUpdate 버그로 controllerchange가 안 오는 경우 fallback (4s)
    fallbackId = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
      doReload()
    }, 4000)

    try {
      await updateServiceWorker(true)
      // updateServiceWorker는 skipWaiting 메시지 전송 후 controlling 이벤트를 기다리지만
      // #789 버그로 reload가 안 될 경우 위 controllerchange 리스너가 reload를 담당해요.
      // fallback 타이머가 최종 보장을 해요.
    } catch {
      if (fallbackId !== null) clearTimeout(fallbackId)
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
      doReload()
    }
  }, [updateServiceWorker])

  useEffect(() => {
    if (!needRefresh) return

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
