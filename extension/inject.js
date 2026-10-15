// Runs in the LeetCode page. Watches submissions and reports Accepted ones.
(() => {
  if (window.__ctInjected) return;
  window.__ctInjected = true;
  const submits = new Map(); // submission_id -> { lang, code, slug }
  const handled = new Set();

  const slugFromUrl = (u) => (String(u).match(/\/problems\/([a-z0-9-]+)\/submit/) || [])[1];

  async function gql(query, variables) {
    const r = await fetch("/graphql/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrftoken": (document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/) || [])[1] || "",
      },
      credentials: "include",
      body: JSON.stringify({ query, variables }),
    });
    if (!r.ok) throw new Error(`LeetCode request failed (${r.status})`);
    return (await r.json()).data;
  }

  async function onAccepted(id, check, force) {
    if (handled.has(id) && !force) return;
    handled.add(id);
    try {
      const sub = submits.get(id) || {};
      let code = sub.code,
        lang = sub.lang || check.lang;
      let slug = sub.slug || (location.pathname.match(/\/problems\/([a-z0-9-]+)/) || [])[1];
      if (!code) {
        const d = await gql(
          `query s($id: Int!) { submissionDetails(submissionId: $id) { code lang { name } question { titleSlug } } }`,
          { id: Number(id) },
        );
        code = d?.submissionDetails?.code || "";
        lang = lang || d?.submissionDetails?.lang?.name;
        slug = slug || d?.submissionDetails?.question?.titleSlug;
      }
      const q = (
        await gql(
          `query q($s: String!) { question(titleSlug: $s) { questionFrontendId title titleSlug difficulty topicTags { name } } }`,
          { s: slug },
        )
      )?.question;
      if (!q) throw new Error("Couldn't read problem details from LeetCode");
      window.postMessage(
        {
          source: "codetracker",
          type: "accepted",
          data: {
            slug: q.titleSlug,
            title: q.title,
            problem_id: q.questionFrontendId,
            difficulty: String(q.difficulty).toLowerCase(),
            topics: q.topicTags.map((t) => t.name),
            lang: lang || "",
            code: code || "",
          },
        },
        location.origin,
      );
    } catch (e) {
      window.postMessage(
        { source: "codetracker", type: "error", message: String(e?.message || e) },
        location.origin,
      );
    }
  }

  function report(status, runtime) {
    window.postMessage(
      { source: "codetracker", type: "result", status, runtime: runtime || "" },
      location.origin,
    );
  }

  const curSlug = () => (location.pathname.match(/\/problems\/([a-z0-9-]+)/) || [])[1];

  // Find the newest Accepted submission for the open problem and report it.
  async function saveLatest(force) {
    try {
      const slug = curSlug();
      if (!slug) throw new Error("Open a LeetCode problem first.");
      const d = await gql(
        `query l($s: String!) { questionSubmissionList(questionSlug: $s, offset: 0, limit: 20) { submissions { id statusDisplay } } }`,
        { s: slug },
      );
      const sb = (d?.questionSubmissionList?.submissions || []).find(
        (x) => x.statusDisplay === "Accepted",
      );
      if (!sb) {
        if (force)
          throw new Error(
            "No Accepted submission found for this problem yet. Make sure you're signed in to LeetCode.",
          );
        return;
      }
      await onAccepted(String(sb.id), {}, force);
    } catch (e) {
      window.postMessage(
        { source: "codetracker", type: "error", message: String(e?.message || e) },
        location.origin,
      );
    }
  }

  window.addEventListener("message", (e) => {
    if (
      e.source === window &&
      e.data?.source === "codetracker-ctl" &&
      e.data.type === "save-latest"
    )
      saveLatest(true);
  });

  // Fallback: watch the page for LeetCode's result banner, in case request watching misses it.
  let lastBanner = "";
  new MutationObserver(() => {
    const el = document.querySelector('[data-e2e-locator="submission-result"]');
    const txt = el?.textContent?.trim() || "";
    if (!txt || txt === lastBanner) return;
    lastBanner = txt;
    report(txt);
    if (/^Accepted/.test(txt)) saveLatest(false);
  }).observe(document, { childList: true, subtree: true, characterData: true });

  function inspect(url, reqBody, respText) {
    try {
      const u = String(url);
      const slug = slugFromUrl(u);
      if (slug && respText) {
        const r = JSON.parse(respText);
        if (r.submission_id) {
          let b = {};
          try {
            b = JSON.parse(reqBody || "{}");
          } catch {}
          submits.set(String(r.submission_id), { lang: b.lang, code: b.typed_code, slug });
        }
        return;
      }
      const m = u.match(/\/submissions\/detail\/(\d+)\/check/);
      if (m && respText) {
        const r = JSON.parse(respText);
        if (r.state === "SUCCESS") {
          const ok = r.status_msg === "Accepted" || r.status_code === 10;
          report(ok ? "Accepted" : r.status_msg || "Not accepted", r.status_runtime);
          if (ok) onAccepted(m[1], r);
        }
      }
    } catch {}
  }

  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const res = await origFetch.apply(this, arguments);
    try {
      const url = typeof input === "string" ? input : input?.url;
      if (/\/submit\/?$|\/submissions\/detail\/\d+\/check/.test(url || "")) {
        res
          .clone()
          .text()
          .then((t) => inspect(url, init?.body, t));
      }
    } catch {}
    return res;
  };

  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url) {
    this.__ctUrl = url;
    return open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener("load", () => {
      if (/\/submit\/?$|\/submissions\/detail\/\d+\/check/.test(this.__ctUrl || "")) {
        try {
          inspect(this.__ctUrl, body, this.responseText);
        } catch {}
      }
    });
    return send.apply(this, arguments);
  };
})();
