const DEFAULT_BASE = "https://code-recall-quest.lovable.app";
const $ = (id) => document.getElementById(id);
const show = (live) => {
  $("setup").style.display = live ? "none" : "block";
  $("live").style.display = live ? "block" : "none";
};

async function test() {
  const st = $("st");
  st.className = "";
  st.textContent = "Checking…";
  const r = await chrome.runtime.sendMessage({ type: "ct-ping" });
  if (r?.error) {
    st.className = "err";
    st.textContent = r.error;
    await chrome.storage.local.set({ connected: false });
    show(false);
    return false;
  }
  st.className = "ok";
  st.textContent = r.github
    ? `Connected · GitHub ${r.github}`
    : "Connected · GitHub not set up (problems still save)";
  await chrome.storage.local.set({ connected: true });
  return true;
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

async function poll(tabId) {
  const r = await chrome.tabs.sendMessage(tabId, { type: "ct-timer-get" }).catch(() => null);
  if (!r?.slug) {
    $("prob").textContent = "Refresh the LeetCode page so CodeTracker can start.";
    return;
  }
  $("prob").textContent = r.slug.replace(/-/g, " ");
  $("time").textContent = fmt(r.seconds ?? r.minutes * 60) + (r.stopped ? " (stopped)" : "");
  $("reset").style.display = "block";
  const res = $("res");
  if (r.last) {
    const ok = /^Accepted/.test(r.last.status);
    res.className = ok ? "ok" : "err";
    res.textContent = `${ok ? "✓ Accepted" : "✗ " + r.last.status}${r.last.runtime ? " · " + r.last.runtime : ""}`;
  }
}

(async () => {
  const { token, apiBase, connected } = await chrome.storage.local.get([
    "token",
    "apiBase",
    "connected",
  ]);
  $("token").value = token || "";
  $("base").value = apiBase || DEFAULT_BASE;
  show(!!(token && connected));
  if (token) test().then((ok) => ok && show(true));

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (tab?.url?.startsWith("https://leetcode.com/problems/")) {
    poll(tab.id);
    setInterval(() => poll(tab.id), 1000);
    $("manual").style.display = "block";
    $("manualHint").style.display = "block";
    $("manual").onclick = () =>
      chrome.tabs
        .sendMessage(tab.id, { type: "ct-save-latest" })
        .then(() => window.close())
        .catch(() => {
          $("res").className = "err";
          $("res").textContent = "Refresh the LeetCode page, then try again.";
        });
    $("reset").onclick = () =>
      chrome.tabs.sendMessage(tab.id, { type: "ct-timer-reset" }).then(() => poll(tab.id));
  }
})();

$("change").onclick = () => show(false);
$("save").onclick = async () => {
  await chrome.storage.local.set({
    token: $("token").value.trim(),
    apiBase: ($("base").value.trim() || DEFAULT_BASE).replace(/\/+$/, ""),
  });
  if (await test()) show(true);
};
