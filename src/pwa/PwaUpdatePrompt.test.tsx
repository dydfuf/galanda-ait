// @vitest-environment jsdom
import { act, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { PwaUpdatePrompt } from "./PwaUpdatePrompt.tsx"

const mock = vi.hoisted(() => ({
  options: null as null | { onRegisteredSW: (url: string, registration: ServiceWorkerRegistration) => void; onNeedReload: () => void },
  toast: Object.assign(vi.fn(), { error: vi.fn(), dismiss: vi.fn() }),
  update: vi.fn(async () => {}),
  setNeedRefresh: vi.fn(),
}))
vi.mock("sonner", () => ({ toast: mock.toast }))
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (options: NonNullable<typeof mock.options>) => {
    mock.options = options
    return { needRefresh: [true, mock.setNeedRefresh], updateServiceWorker: mock.update }
  },
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.clearAllMocks()
})

it("preserves the page after timeout and late activation, then reloads only on explicit retry", async () => {
  vi.useFakeTimers()
  const reload = vi.fn()
  const testWindow = Object.create(window) as Window
  Object.defineProperty(testWindow, "location", { value: { reload } })
  vi.stubGlobal("window", testWindow)
  const testNavigator = Object.create(navigator) as Navigator
  Object.defineProperty(testNavigator, "serviceWorker", { value: new EventTarget() })
  vi.stubGlobal("navigator", testNavigator)
  const worker = Object.assign(new EventTarget(), { state: "installed" })
  const registration = { waiting: worker, update: vi.fn(async () => {}) }
  const view = render(<PwaUpdatePrompt />)
  act(() => mock.options!.onRegisteredSW("/sw.js", registration as unknown as ServiceWorkerRegistration))
  await act(async () => {
    mock.toast.mock.calls[0]![1].action.onClick()
    await vi.advanceTimersByTimeAsync(4000)
  })
  expect(reload).not.toHaveBeenCalled()
  expect(mock.toast.error).toHaveBeenCalledOnce()

  worker.state = "activated"
  Object.assign(registration, { waiting: null })
  worker.dispatchEvent(new Event("statechange"))
  mock.options!.onNeedReload()
  expect(reload).not.toHaveBeenCalled()

  await act(async () => { mock.toast.error.mock.calls[0]![1].action.onClick() })
  expect(reload).toHaveBeenCalledOnce()
  expect(mock.update).toHaveBeenCalledOnce()
  view.unmount()
})
