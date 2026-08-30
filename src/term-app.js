// TermLens UI wiring. Reuses the state/tools module. The human approves each
// proposed term; nothing commits without approval; every call is a receipt.

(function () {
  const S = window.TERMLENS_STATE;
  const E = window.TERMLENS_ENGINE;
  const el = function (id) { return document.getElementById(id); };

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  const staged = {}; // token -> {term, grounding}

  window.TermLensUI = {
    setWebMCPStatus: function (ok) {
      const b = el("webmcp-status");
      if (!b) return;
      b.textContent = ok ? "WebMCP: active" : "WebMCP: unsupported here";
      b.className = ok ? "badge ok" : "badge";
    },
    logTool: function (entry) {
      S.appendAudit({ tool: entry.tool, input: entry.input, outcome: entry.outcome, detail: entry.detail, source: entry.source || "agent" });
      renderReceipts();
    },
    showProposal: function (token, term, grounding) {
      staged[token] = { term: term, grounding: grounding };
      renderStaged();
      showConfirmBar(term, grounding);
    },
    refresh: function () { renderStaged(); renderApproved(); },
  };

  function showConfirmBar(term, grounding) {
    const c = el("confirm");
    const cq = grounding && grounding.quote;
    let msg = "Agent proposes a term: " + term.label + " = \"" + term.value + "\"";
    if (grounding && grounding.grounded) msg += " (" + (grounding.confidence * 100).toFixed(0) + "% conf). Approve?";
    else msg += ". WARNING: not grounded to the text. Review before approving.";
    c.querySelector(".confirm-text").textContent = msg;
    // Approve/Reject handlers set per-show (see wiring below)
    c.classList.remove("hidden");
  }

  let currentToken = null;
  function setToken(t) { currentToken = t; }

  function renderStaged() {
    const wrap = el("staged");
    const keys = Object.keys(staged);
    if (!keys.length) { wrap.innerHTML = "<p class='muted small'>No terms staged yet. Ask your agent to propose some, or approve from a summary.</p>"; return; }
    wrap.innerHTML = "";
    keys.forEach(function (token) {
      const item = staged[token];
      const div = document.createElement("div");
      div.className = "term" + (item.grounding && item.grounding.grounded ? "" : " locked");
      const conf = item.grounding ? item.grounding.confidence : 0;
      const confClass = conf >= 0.55 ? "conf-high" : "conf-low";
      div.innerHTML =
        "<div class='top'><span class='kind'>" + escapeHtml(item.term.kind) + "</span>" +
        "<span class='conf " + confClass + "'>" + Math.round(conf * 100) + "%</span></div>" +
        "<div class='val'>" + escapeHtml(item.term.label) + " = " + escapeHtml(item.term.value) + "</div>" +
        "<div class='quote'>" + escapeHtml(item.grounding ? item.grounding.quote : "") + "</div>" +
        (item.grounding && item.grounding.reason && !item.grounding.grounded ? "<div class='reason'>" + escapeHtml(item.grounding.reason) + "</div>" : "");
      const acts = document.createElement("div");
      acts.className = "actions";
      const ap = document.createElement("button");
      ap.type = "button"; ap.textContent = "Approve";
      ap.onclick = function () {
        S.approveTerm(token);
        delete staged[token];
        TermLensUI.logTool({ tool: "approve_term", input: { token: "(approved)" }, outcome: "ok", detail: { label: item.term.label, value: item.term.value }, source: "human" });
        renderStaged(); renderApproved();
      };
      const rj = document.createElement("button");
      rj.type = "button"; rj.textContent = "Reject"; rj.className = "mini";
      rj.onclick = function () {
        S.rejectTerm(token);
        delete staged[token];
        TermLensUI.logTool({ tool: "reject_term", input: { token: "(rejected)" }, outcome: "blocked", detail: { label: item.term.label }, source: "human" });
        renderStaged();
      };
      acts.appendChild(ap); acts.appendChild(rj);
      div.appendChild(acts);
      wrap.appendChild(div);
    });
  }

  function renderApproved() {
    const approved = S.getApproved();
    const wrap = el("approved");
    if (!approved.length) { wrap.innerHTML = "<p class='muted small'>No approved terms yet.</p>"; return; }
    wrap.innerHTML = "";
    approved.forEach(function (a) {
      const div = document.createElement("div");
      div.className = "term";
      const conf = a.grounding ? a.grounding.confidence : 0;
      div.innerHTML =
        "<div class='top'><span class='kind'>" + escapeHtml(a.term.kind) + "</span>" +
        "<span class='approved'>approved</span></div>" +
        "<div class='val'>" + escapeHtml(a.term.label) + " = " + escapeHtml(a.term.value) + "</div>" +
        "<div class='quote'>" + escapeHtml((a.grounding && a.grounding.quote) || "") + "</div>";
      wrap.appendChild(div);
    });
  }

  function renderReceipts() {
    const list = el("receipts");
    if (!list) return;
    const audit = S.getAudit();
    if (!audit.length) { list.innerHTML = "<p class='muted small'>No calls yet. Tool calls (human or agent) appear here.</p>"; return; }
    list.innerHTML = "";
    audit.slice().reverse().forEach(function (e) {
      const row = document.createElement("div");
      row.className = "receipt-row receipt-" + e.outcome;
      const det = e.detail ? JSON.stringify(e.detail) : "";
      row.innerHTML = "<span class='r-tool'>" + escapeHtml(e.tool) + "</span>" +
        "<span class='r-out'>" + escapeHtml(e.outcome) + "</span>" +
        "<span class='r-src'>" + escapeHtml(e.source || "agent") + "</span>" +
        "<span class='r-det muted small'>" + escapeHtml(det) + "</span>";
      list.appendChild(row);
    });
  }

  function loadSampleContract() {
    const sample =
`This Master Services Agreement is entered into as of May 1, 2026 between Acme Corp ("Client") and Northwind Studio ("Provider").
1. Term. This Agreement begins on the Effective Date and continues for twelve (12) months. It shall automatically renew for successive twelve (12) month periods unless either party provides written notice of non-renewal at least thirty (30) days before the end of the then-current term.
2. Fees. Client shall pay the sum of $48,000 per year, in quarterly installments of $12,000, due within thirty (30) days of invoice.
3. Termination. Either party may terminate this Agreement immediately upon written notice in the event of a material breach. Provider may terminate for non-payment after fifteen (15) days written notice.
4. Confidentiality. Each party agrees to keep the other's confidential information strictly confidential and to not disclose it to any third party.
5. Non-Compete. For twelve (12) months following termination, Provider shall not provide competing services to Client's direct competitors.
6. Governing Law. This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware.
7. Limitation of Liability. Neither party shall be liable for indirect or consequential damages, and each party's total liability shall not exceed the fees paid in the prior twelve (12) months.`;
    el("contract-text").value = sample;
    doLoadContract();
  }

  function doLoadContract() {
    const text = el("contract-text").value;
    if (!text.trim()) { el("contract-status").textContent = "Paste contract text first."; return; }
    S.setContractText(text);
    el("contract-status").textContent = text.split(/\s+/).length + " words loaded. Ask your agent to extract terms.";
  }

  function approveAllConfirmed() {
    Object.keys(staged).forEach(function (token) {
      const item = staged[token];
      if (item.grounding && item.grounding.grounded) {
        S.approveTerm(token);
        delete staged[token];
        TermLensUI.logTool({ tool: "approve_term", input: { token: "(bulk)" }, outcome: "ok", detail: { label: item.term.label }, source: "human" });
      }
    });
    renderStaged(); renderApproved();
  }

  function rejectAll() {
    Object.keys(staged).forEach(function (token) {
      const item = staged[token];
      S.rejectTerm(token);
      delete staged[token];
      TermLensUI.logTool({ tool: "reject_term", input: { token: "(bulk)" }, outcome: "blocked", detail: { label: item.term.label }, source: "human" });
    });
    renderStaged();
  }

  function exportReceipts() {
    const data = JSON.stringify(S.getAudit(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "termlens-receipts.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function init() {
    function on(id, fn) { const n = el(id); if (n) n.onclick = fn; return n; }
    on("load-sample", loadSampleContract);
    on("load-contract", doLoadContract);
    on("btn-approve-all", approveAllConfirmed);
    on("btn-reject-all", rejectAll);
    on("reset-terms", function () {
      S.resetTerms();
      renderApproved();
    });
    on("export-receipts", exportReceipts);
    on("clear-receipts", function () { S.clearAudit(); renderReceipts(); });

    el("write-lock").checked = S.getWriteLock();
    el("write-lock").onchange = function () { S.setWriteLock(el("write-lock").checked); };

    // Confirm bar buttons
    on("confirm-approve", function () {
      if (currentToken && staged[currentToken]) {
        const item = staged[currentToken];
        if (S.getWriteLock()) { alert("Committing is locked. Unlock first."); return; }
        S.approveTerm(currentToken);
        delete staged[currentToken];
        TermLensUI.logTool({ tool: "approve_term", input: { token: "(approved)" }, outcome: "ok", detail: { label: item.term.label, value: item.term.value }, source: "human" });
        renderStaged(); renderApproved();
      }
      el("confirm").classList.add("hidden");
      currentToken = null;
    });
    on("confirm-reject", function () {
      if (currentToken && staged[currentToken]) {
        const item = staged[currentToken];
        S.rejectTerm(currentToken);
        delete staged[currentToken];
        TermLensUI.logTool({ tool: "reject_term", input: { token: "(rejected)" }, outcome: "blocked", detail: { label: item.term.label }, source: "human" });
        renderStaged();
      }
      el("confirm").classList.add("hidden");
      currentToken = null;
    });

    // Override showProposal to also set currentToken for the confirm bar
    const baseShow = TermLensUI.showProposal;
    TermLensUI.showProposal = function (token, term, grounding) {
      setToken(token);
      baseShow(token, term, grounding);
    };

    renderStaged();
    renderApproved();
    renderReceipts();
    TermLensUI.setWebMCPStatus(false);
    window.TERMLENS_TOOLS.registerAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
