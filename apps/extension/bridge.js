chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "APPLYPILOT_CAPTURE_JOB") return false;
  const captureId = crypto.randomUUID();
  const timeout = setTimeout(() => {
    window.removeEventListener("message", onResult);
    sendResponse({ success: false, message: "ApplyPilot did not respond. Make sure you are signed in, then try again." });
  }, 15_000);
  const onResult = (event) => {
    if (event.source !== window ||
        event.origin !== window.location.origin ||
        event.data?.type !== "APPLYPILOT_CAPTURE_RESULT" ||
        event.data?.captureId !== captureId) return;
    clearTimeout(timeout);
    window.removeEventListener("message", onResult);
    sendResponse(event.data.result);
  };
  window.addEventListener("message", onResult);
  window.postMessage({
    type: "APPLYPILOT_EXTENSION_CAPTURE",
    captureId,
    payload: message.payload,
  }, window.location.origin);
  return true;
});
