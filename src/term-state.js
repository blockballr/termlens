// TermLens client state. No backend, so the contract text stays in the browser.
// Terms the agent proposes are staged (not committed) until the human approves.

(function () {
  const KEY = "termlens.v1";
  const pending = {};   // staged terms awaiting approval, keyed by token
  const audit = [];     // receipt log
  let approved = [];    // in-memory list of approved terms for the current doc
  let writeLock = false;
  let contractText = "";
  let seq = 0;

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function write(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

  function state() {
    const s = read();
    if (!s.approved) s.approved = [];
    if (!s.documents) s.documents = {};
    return s;
  }

  function setContractText(text) {
    contractText = String(text || "");
    write(state());
    return contractText.length;
  }
  function getContractText() { return contractText; }

  function nextId() { seq += 1; return "t" + Date.now() + "-" + seq; }

  function sameTerm(a, b) {
    return a && b && a.kind === b.kind && a.label === b.label && a.value === b.value;
  }

  function isDuplicate(term) {
    // already approved
    const appr = state().approved;
    if (appr.some(function (a) { return sameTerm(a.term, term); })) return true;
    // already pending (staged but not yet approved)
    return Object.keys(pending).some(function (k) {
      return pending[k] && sameTerm(pending[k].term, term);
    });
  }

  // Stage a proposed term (from the agent). Returns a token; NOT approved yet.
  // If an identical term is already staged or approved, returns null (skipped).
  function stageTerm(term, grounding, explanation) {
    if (isDuplicate(term)) return null;
    const token = "term-" + Math.random().toString(36).slice(2, 10);
    pending[token] = { term: term, grounding: grounding, explanation: explanation || null };
    return token;
  }

  function consumeTerm(token) {
    const entry = pending[token];
    if (!entry) return null;
    delete pending[token];
    return entry;
  }

  function approveTerm(token) {
    const entry = consumeTerm(token);
    if (!entry) return null;
    const s = state();
    s.approved.push({ id: nextId(), term: entry.term, grounding: entry.grounding, explanation: entry.explanation || null, at: new Date().toISOString() });
    write(s);
    approved = s.approved;
    return entry.term;
  }

  function rejectTerm(token) { return consumeTerm(token); }

  function getApproved() { return state().approved; }

  function resetTerms() {
    const s = state();
    s.approved = [];
    write(s);
    approved = [];
  }

  function getWriteLock() { return writeLock; }
  function setWriteLock(v) { writeLock = !!v; }

  function appendAudit(entry) {
    entry.at = new Date().toISOString();
    audit.push(entry);
    return entry;
  }
  function getAudit() { return audit.slice(); }
  function clearAudit() { audit.length = 0; }

  function summarizeApproved() {
    const s = state();
    const out = [];
    s.approved.forEach(function (a) {
      out.push({ kind: a.term.kind, label: a.term.label, value: a.term.value, quote: a.grounding && a.grounding.quote, confidence: a.grounding && a.grounding.confidence });
    });
    return out;
  }

  // format approved terms and audit log as markdown
  function exportMarkdown() {
    const s = state();
    const date = new Date().toISOString().split("T")[0];
    let md = "# termlens approved summary\n\n";
    md += "**date:** " + date + "\n";
    md += "**status:** verified and approved\n\n";

    md += "## approved terms\n\n";
    if (!s.approved || s.approved.length === 0) {
      md += "*no terms approved yet.*\n\n";
    } else {
      md += "| term | value | source quote | confidence |\n";
      md += "| :--- | :--- | :--- | :--- |\n";
      s.approved.forEach(function (a) {
        const q = (a.grounding && a.grounding.quote) ? a.grounding.quote.replace(/\n/g, " ") : "n/a";
        const conf = a.grounding ? Math.round(a.grounding.confidence * 100) + "%" : "n/a";
        md += "| **" + a.term.label + "** | " + a.term.value + " | \"" + q + "\" | " + conf + " |\n";
      });
      md += "\n";
    }

    md += "## audit receipts\n\n";
    if (!audit || audit.length === 0) {
      md += "*no receipts logged.*\n";
    } else {
      audit.forEach(function (r) {
        const det = r.detail ? JSON.stringify(r.detail) : "";
        md += "- `[" + r.at + "]` **" + r.tool + "** (" + r.outcome + "): " + det + "\n";
      });
    }

    return md;
  }

  window.TERMLENS_STATE = {
    setContractText: setContractText,
    getContractText: getContractText,
    stageTerm: stageTerm,
    consumeTerm: consumeTerm,
    approveTerm: approveTerm,
    rejectTerm: rejectTerm,
    getApproved: getApproved,
    resetTerms: resetTerms,
    getWriteLock: getWriteLock,
    setWriteLock: setWriteLock,
    appendAudit: appendAudit,
    getAudit: getAudit,
    clearAudit: clearAudit,
    summarizeApproved: summarizeApproved,
    exportMarkdown: exportMarkdown,
  };
})();