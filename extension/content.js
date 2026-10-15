// CodeTracker panel + timer (isolated content script).
(() => {
  const slugNow = () => (location.pathname.match(/\/problems\/([a-z0-9-]+)/) || [])[1] || null;
  let slug = null;
  let t = null; // { ms, startedAt, stopped }
  let lastResult = null; // { status, runtime, at }

  const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes inactivity timeout
  let lastActiveAt = Date.now();
  let isIdle = false;
  let activeAcceptedSlug = null;
  let isSaving = false;

  // After the extension is reloaded/updated, this old script's context is dead;
  // touching chrome.* then throws "Extension context invalidated". Bail out quietly.
  const alive = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };
  const key = (s) => `timer:${s}`;
  const save = () => {
    if (!alive() || !slug || !t) return;
    try {
      const data = {
        ms: elapsed(),
        startedAt: t.startedAt ? Date.now() : null,
        stopped: !!t.stopped,
      };
      t.ms = data.ms;
      if (t.startedAt) t.startedAt = Date.now();
      chrome.storage.local.set({ [key(slug)]: data });
    } catch {}
  };
  const elapsed = () => {
    if (!t) return 0;
    if (!t.startedAt) return t.ms;
    const now = Date.now();
    const timeSinceActive = now - lastActiveAt;
    const activeSpan = timeSinceActive > IDLE_TIMEOUT_MS
      ? Math.max(0, lastActiveAt - t.startedAt + IDLE_TIMEOUT_MS)
      : now - t.startedAt;
    return t.ms + Math.max(0, activeSpan);
  };
  const pause = (dueToInactivity = false) => {
    if (t?.startedAt) {
      if (dueToInactivity) {
        const effectiveEnd = Math.min(Date.now(), lastActiveAt + IDLE_TIMEOUT_MS);
        t.ms += Math.max(0, effectiveEnd - t.startedAt);
      } else {
        t.ms = elapsed();
      }
      t.startedAt = null;
      save();
    }
  };
  const resume = () => {
    if (
      t &&
      !t.stopped &&
      !t.startedAt &&
      document.visibilityState === "visible" &&
      document.hasFocus() &&
      !isIdle
    ) {
      t.startedAt = Date.now();
      lastActiveAt = Date.now();
      save();
    }
  };

  async function load(s) {
    pause(false);
    slug = s;
    if (!s) {
      t = null;
      return;
    }
    if (!alive()) return;
    const got = (await chrome.storage.local.get(key(s)))[key(s)];
    t = got
      ? { ms: got.ms || 0, startedAt: null, stopped: !!got.stopped }
      : { ms: 0, startedAt: null, stopped: false };
    lastActiveAt = Date.now();
    isIdle = false;
    resume();
  }

  const onActivity = () => {
    lastActiveAt = Date.now();
    if (isIdle) {
      isIdle = false;
      resume();
    }
  };
  ["mousemove", "keydown", "mousedown", "touchstart", "scroll"].forEach((evt) => {
    window.addEventListener(evt, onActivity, { passive: true });
  });

  window.addEventListener("blur", () => pause(false));
  window.addEventListener("focus", () => {
    lastActiveAt = Date.now();
    isIdle = false;
    resume();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      lastActiveAt = Date.now();
      isIdle = false;
      resume();
    } else {
      pause(false);
    }
  });
  window.addEventListener("beforeunload", () => pause(false));

  setInterval(() => {
    const s = slugNow();
    if (s !== slug) {
      load(s);
    } else {
      if (t?.startedAt) {
        if (
          document.visibilityState !== "visible" ||
          !document.hasFocus() ||
          Date.now() - lastActiveAt > IDLE_TIMEOUT_MS
        ) {
          isIdle = Date.now() - lastActiveAt > IDLE_TIMEOUT_MS;
          pause(isIdle);
        } else {
          save();
        }
      } else if (
        !isIdle &&
        t &&
        !t.stopped &&
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        Date.now() - lastActiveAt <= IDLE_TIMEOUT_MS
      ) {
        resume();
      }
    }
  }, 1000);
  load(slugNow());

  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg?.type === "ct-timer-get")
      reply({
        slug,
        seconds: Math.round(elapsed() / 1000),
        minutes: Math.round(elapsed() / 60000),
        stopped: !!t?.stopped,
        last: lastResult,
      });
    else if (msg?.type === "ct-save-latest") {
      window.postMessage({ source: "codetracker-ctl", type: "save-latest" }, location.origin);
      reply({ ok: true });
    } else if (msg?.type === "ct-timer-reset" && slug) {
      t = { ms: 0, startedAt: null, stopped: false };
      lastActiveAt = Date.now();
      isIdle = false;
      resume();
      save();
      reply({ ok: true });
    }
  });

  // ---------- panel ----------
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    :host{all:initial}
    .card{width:340px;max-width:calc(100vw - 40px);background:#0f1422;color:#e6e8f0;border:1px solid #2a3150;border-radius:14px;
      box-shadow:0 20px 50px rgba(0,0,0,.5);font:13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;padding:14px}
    h3{margin:0 0 2px;font-size:14px} .muted{color:#8a91aa;font-size:12px}
    .tag{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;margin-right:4px;background:#1b2238}
    .easy{color:#34d399}.medium{color:#fbbf24}.hard{color:#f87171}
    label{display:block;margin:10px 0 4px;color:#a5abc4;font-size:12px}
    input[type=number],textarea,select{width:100%;box-sizing:border-box;background:#0a0e19;border:1px solid #2a3150;color:#e6e8f0;border-radius:8px;padding:7px 9px;font:inherit}
    textarea{min-height:52px;resize:vertical}
    .row{display:flex;gap:8px;align-items:center;margin-top:12px}
    button{border:0;border-radius:8px;padding:8px 12px;font:600 13px system-ui;cursor:pointer}
    .pri{background:#a855f7;color:#fff;flex:1}.pri:disabled{opacity:.6;cursor:default}
    .ghost{background:transparent;color:#a5abc4}
    .brand{color:#c084fc;font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}
    .msg{margin-top:10px;font-size:12px} .ok{color:#34d399} .err{color:#f87171} a{color:#c084fc}
  </style><div class="card" id="c"></div>`;
  const card = root.getElementById("c");
  let mounted = false;
  const mount = () => {
    if (!mounted) {
      document.documentElement.appendChild(host);
      mounted = true;
    }
  };
  const close = () => {
    host.remove();
    mounted = false;
    activeAcceptedSlug = null;
  };
  const esc = (s) =>
    String(s).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  const localDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  function showError(message) {
    mount();
    card.innerHTML = `<div class="brand">CodeTracker</div><div class="err">${esc(message)}</div>
      <div class="muted" style="margin-top:6px">You can still add this problem by hand in CodeTracker.</div>
      <div class="row"><button class="ghost" id="x">Close</button></div>`;
    root.getElementById("x").onclick = close;
  }

  function showAccepted(d) {
    if (isSaving || (mounted && activeAcceptedSlug === d.slug)) return;
    activeAcceptedSlug = d.slug;
    if (t) {
      pause(false);
      t.stopped = true;
      save();
    }
    const mins = Math.max(1, Math.round(elapsed() / 60000));
    mount();
    card.innerHTML = `<div class="brand">CodeTracker · Accepted ✓</div>
      <h3>${esc(d.problem_id)}. ${esc(d.title)}</h3>
      <div><span class="tag ${esc(d.difficulty)}">${esc(d.difficulty)}</span><span class="muted">${esc(d.lang)}</span></div>
      <div class="muted" style="margin-top:4px">${esc(d.topics.join(", "))}</div>
      <label>Time taken (minutes)</label><input type="number" id="m" min="0" value="${mins}">
      <label>Status</label><select id="st"><option value="">Keep current (new: Solved)</option><option value="need_revision">Need Revision</option><option value="solved">Solved</option><option value="mastered">Mastered</option><option value="forgotten">Forgotten</option></select>
      <label>Notes (optional)</label><textarea id="n" placeholder="Approach, mistakes, edge cases…"></textarea>
      <label>Hints (optional)</label><textarea id="h"></textarea>
      <label style="display:flex;gap:6px;align-items:center;margin-top:10px;color:#e6e8f0"><input type="checkbox" id="g" checked> Push solution to GitHub</label>
      <div class="row"><button class="pri" id="s">Save to CodeTracker</button><button class="ghost" id="x">Dismiss</button></div>
      <div class="msg" id="r"></div>`;
    root.getElementById("x").onclick = close;
    root.getElementById("s").onclick = async () => {
      if (isSaving) return;
      isSaving = true;
      const btn = root.getElementById("s"),
        r = root.getElementById("r");
      btn.disabled = true;
      btn.textContent = "Saving…";
      r.textContent = "";
      const mv = root.getElementById("m").value;
      const payload = {
        ...d,
        date: localDate(),
        time_taken_minutes: mv === "" ? null : Math.max(0, Math.round(Number(mv))),
        notes: root.getElementById("n").value,
        hints: root.getElementById("h").value,
        ...(root.getElementById("st").value ? { status: root.getElementById("st").value } : {}),
        push_github: root.getElementById("g").checked,
      };
      const res = await chrome.runtime
        .sendMessage({ type: "ct-save", payload })
        .catch(() => ({ error: "Extension was reloaded — refresh this page." }));
      if (res?.error) {
        isSaving = false;
        r.className = "msg err";
        r.textContent = res.error;
        btn.disabled = false;
        btn.textContent = "Try again";
        return;
      }
      isSaving = false;
      let html = `<div class="ok">${res.kind === "created" ? "Saved to CodeTracker." : `Already tracked — solved ${res.times_solved}×.`}</div>`;
      if (res.github_url)
        html += `<div class="ok">Pushed to GitHub · <a href="${esc(res.github_url)}" target="_blank" rel="noopener">view</a></div>`;
      else if (res.github_error) html += `<div class="err">GitHub: ${esc(res.github_error)}</div>`;
      r.innerHTML = html;
      btn.textContent = "Saved";
      t = { ms: 0, startedAt: null, stopped: false };
      save();
      setTimeout(close, 6000);
    };
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.source !== "codetracker") return;
    if (e.data.type === "result")
      lastResult = { status: e.data.status, runtime: e.data.runtime, at: Date.now() };
    else if (e.data.type === "accepted") showAccepted(e.data.data);
    else if (e.data.type === "error") showError(e.data.message);
  });
})();
