/** Resolve only when the selected update is active, never just after sending it. */
export function activateWaitingWorker(
  worker: ServiceWorker | null,
  requestUpdate: () => Promise<void>,
): Promise<void> {
  if (!worker) return Promise.reject(new Error("No waiting service worker"))
  // A timed-out activation may finish later; only an explicit retry reaches here.
  if (worker.state === "activated") return Promise.resolve()

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      worker.removeEventListener("statechange", onStateChange)
      if (error) reject(error)
      else resolve()
    }
    const onStateChange = () => {
      if (worker.state === "activated") finish()
      else if (worker.state === "redundant") finish(new Error("Update became redundant"))
    }
    const timeout = setTimeout(() => {
      finish(new Error("Service worker activation timed out"))
    }, 4000)
    worker.addEventListener("statechange", onStateChange)
    // The plugin returns after sending SKIP_WAITING, not after activation.
    void Promise.resolve().then(requestUpdate).catch(() => {
      finish(new Error("Could not request service worker activation"))
    })
    onStateChange()
  })
}
