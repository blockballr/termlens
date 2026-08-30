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

  // Stage a proposed term (from the agent). Returns a token; NOT approved yet.
  function stageTerm(term, grounding) {
    const token = "term-" + Math.random().toString(36).slice(2, 10);
    pending[token] = { term: term, grounding: grounding };
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
    s.approved.push({ id: nextId(), term: entry.term, grounding: entry.grounding, at: new Date().toISOString() });
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
  };
})();
