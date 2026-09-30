import { afterEach, describe, expect, it, vi } from "vitest"
import { activateWaitingWorker } from "./activate-waiting-worker.ts"

function fixture() {
  const worker = Object.assign(new EventTarget(), { state: "installed" })
  const selectedWorker = worker as unknown as ServiceWorker
  return { worker, selectedWorker, transition: (state: string) => {
    worker.state = state
    worker.dispatchEvent(new Event("statechange"))
  } }
}

afterEach(() => vi.useRealTimers())

describe("PWA update activation", () => {
  it("does not treat a sent message as a successful activation", async () => {
    vi.useFakeTimers()
    const { selectedWorker } = fixture()
    const result = activateWaitingWorker(selectedWorker, async () => {})
    await Promise.all([
      expect(result).rejects.toThrow("timed out"),
      vi.advanceTimersByTimeAsync(4000),
    ])
  })

  it("accepts activation without requiring controllerchange (Safari fallback)", async () => {
    const { selectedWorker, transition } = fixture()
    const result = activateWaitingWorker(selectedWorker, async () => {})
    transition("activating")
    transition("activated")
    await expect(result).resolves.toBeUndefined()
  })

  it("allows explicit retry after late activation without another update message", async () => {
    vi.useFakeTimers()
    const { selectedWorker, transition } = fixture()
    const request = vi.fn(async () => {})
    const result = activateWaitingWorker(selectedWorker, request)
    await Promise.all([
      expect(result).rejects.toThrow("timed out"),
      vi.advanceTimersByTimeAsync(4000),
    ])
    transition("activated")
    await expect(activateWaitingWorker(selectedWorker, request)).resolves.toBeUndefined()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it("rejects failed update requests and removes activation listeners", async () => {
    const { worker, selectedWorker } = fixture()
    const remove = vi.spyOn(worker, "removeEventListener")
    await expect(activateWaitingWorker(selectedWorker, async () => { throw Error("offline") }))
      .rejects.toThrow("Could not request")
    expect(remove).toHaveBeenCalledWith("statechange", expect.any(Function))
  })

  it("rejects a redundant update instead of reloading the old worker", async () => {
    const { selectedWorker, transition } = fixture()
    const result = activateWaitingWorker(selectedWorker, async () => {})
    transition("redundant")
    await expect(result).rejects.toThrow("redundant")
  })

  it("does not send an update or reload when the waiting worker is gone", async () => {
    const request = vi.fn()
    await expect(activateWaitingWorker(null, request)).rejects.toThrow("No waiting")
    expect(request).not.toHaveBeenCalled()
  })
})
