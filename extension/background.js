const DEFAULT_BASE = "http://localhost:3000";

async function cfg() {
  const { apiBase, token } = await chrome.storage.local.get(["apiBase", "token"]);
  return { base: (apiBase || DEFAULT_BASE).replace(/\/+$/, ""), token: token || "" };
}

async function call(method, body) {
  const { base, token } = await cfg();
  if (!token) return { error: "No extension key. Click the CodeTracker icon and paste your key." };
  try {
    const res = await fetch(`${base}/api/public/extension/save`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || `CodeTracker error (${res.status})` };
    return data;
  } catch (e) {
    return { error: "Could not reach CodeTracker. Check your internet connection." };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === "ct-save") call("POST", msg.payload).then(reply);
  else if (msg?.type === "ct-ping") call("GET").then(reply);
  else return false;
  return true;
});
