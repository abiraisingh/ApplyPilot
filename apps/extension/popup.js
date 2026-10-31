const fields = {
  companyName: document.querySelector("#company"),
  role: document.querySelector("#role"),
  status: document.querySelector("#status"),
  capture: document.querySelector("#capture"),
  message: document.querySelector("#message"),
  hint: document.querySelector("#page-hint"),
};
let pageUrl = "";

function extractVisibleJob() {
  const text = (value) => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  const findPosting = (value, depth = 0) => {
    if (!value || depth > 20) return null;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findPosting(item, depth + 1);
        if (found) return found;
      }
      return null;
    }
    if (typeof value !== "object") return null;
    const type = value["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return value;
    for (const child of Object.values(value)) {
      const found = findPosting(child, depth + 1);
      if (found) return found;
    }
    return null;
  };
  let posting = null;
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      posting = findPosting(JSON.parse(script.textContent || ""));
      if (posting) break;
    } catch {
      continue;
    }
  }
  const organization = posting?.hiringOrganization;
  const companyName = text(typeof organization === "string" ? organization : organization?.name)
    || text(document.querySelector('meta[property="og:site_name"]')?.content);
  const role = text(posting?.title)
    || text(document.querySelector('meta[property="og:title"]')?.content)
    || text(document.querySelector("h1")?.textContent)
    || text(document.title).split("|")[0].split("-")[0].trim();
  const locationValue = posting?.jobLocation;
  const firstLocation = Array.isArray(locationValue) ? locationValue[0] : locationValue;
  const address = firstLocation?.address;
  const location = typeof address === "string"
    ? text(address)
    : text([address?.addressLocality, address?.addressRegion, address?.addressCountry?.name || address?.addressCountry]
      .filter(Boolean).join(", "));
  return { companyName, role, location };
}

function supportedPortal(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ["linkedin.com", "naukri.com", "internshala.com"]
      .some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function setMessage(message, type = "") {
  fields.message.textContent = message;
  fields.message.className = type;
}

async function loadCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !supportedPortal(tab.url)) {
    fields.capture.disabled = true;
    fields.hint.textContent = "Open a job or application page on LinkedIn, Naukri, or Internshala first.";
    return;
  }
  pageUrl = tab.url;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractVisibleJob,
    });
    if (!result) throw new Error("No job details were available on this page.");
    fields.companyName.value = result.companyName || "";
    fields.role.value = result.role || "";
    fields.hint.textContent = `Page detected: ${new URL(tab.url).hostname}. Review the details before capture.`;
    if (!result.companyName || !result.role) {
      setMessage("Some details were not detected. Fill in the company and role to continue.", "error");
    }
  } catch {
    fields.capture.disabled = true;
    setMessage("This page could not be read. Open a supported job page and try again.", "error");
  }
}

async function captureJob() {
  fields.capture.disabled = true;
  setMessage("Sending the page to your ApplyPilot workspace...");
  try {
    const appTabs = await chrome.tabs.query({ url: "http://localhost:5173/*" });
    const appTab = appTabs.find((tab) => tab.id !== undefined);
    if (!appTab?.id) {
      await chrome.tabs.create({ url: "http://localhost:5173/" });
      throw new Error("ApplyPilot opened in a new tab. Sign in, then capture this job again.");
    }
    await chrome.scripting.executeScript({ target: { tabId: appTab.id }, files: ["bridge.js"] });
    const result = await chrome.tabs.sendMessage(appTab.id, {
      type: "APPLYPILOT_CAPTURE_JOB",
      payload: {
        companyName: fields.companyName.value,
        role: fields.role.value,
        jobUrl: pageUrl,
        status: fields.status.value,
      },
    });
    if (!result?.success) throw new Error(result?.message || "Could not capture this job.");
    setMessage(result.message, "success");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Could not connect to ApplyPilot.", "error");
  } finally {
    fields.capture.disabled = !pageUrl;
  }
}

fields.capture.addEventListener("click", () => void captureJob());
void loadCurrentTab();
