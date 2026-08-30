// TermLens WebMCP tools. These are what an agent (ChatGPT in-app browser, or
// Chrome with WebMCP) discovers and calls. The agent reads a contract and
// proposes terms; every term is grounded to a source quote and only staged
// until the human approves. Mutating tools are blocked by the owner lock.

(function () {
  const S = window.TERMLENS_STATE;
  const E = window.TERMLENS_ENGINE;

  function stageProposal(input) {
    // input: { term: {kind,label,value}, text? } — text optional override
    const text = input.text || S.getContractText();
    if (!text) throw new Error("No contract text loaded. The human must paste the contract first (or pass `text`).");
    const vres = E.validateTerm(input.term);
    if (!vres.ok) throw new Error(vres.error);
    const grounding = E.findGrounding(text, input.term);
    const token = S.stageTerm(input.term, grounding);
    if (window.TermLensUI && window.TermLensUI.showProposal) window.TermLensUI.showProposal(token, input.term, grounding);
    return {
      token: token,
      needsApproval: true,
      grounded: grounding.grounded,
      confidence: grounding.confidence,
      quote: grounding.quote,
      note: grounding.grounded
        ? "Staged. Human must approve to commit."
        : "WARNING: could not ground this term to the contract. Human likely won't approve. Double-check the value.",
    };
  }

  const TOOLS = [
    {
      name: "describe_page",
      title: "Describe this contract page",
      description: "Return whether a contract document is loaded, how much text, and how many terms are already approved. Call this first to understand the page state.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: async function () {
        const text = S.getContractText();
        return {
          loaded: !!text,
          chars: text.length,
          wordCount: text ? text.split(/\s+/).length : 0,
          approvedCount: S.getApproved().length,
          writeLock: S.getWriteLock(),
          termKinds: Object.keys(E.TERM_KINDS),
        };
      },
    },
    {
      name: "extract_terms",
      title: "Extract key terms from the contract",
      description: "Analyze the loaded contract text and return candidate key terms (renewal date, termination, notice period, payment, amount, governing law, obligations, confidentiality, non-compete, liability). Each candidate includes a source quote it was found in and a confidence score, so the human can review. Read-only: this does NOT change the page.",
      inputSchema: { type: "object", properties: { text: { type: "string", description: "Optional contract text; defaults to the loaded document." } } },
      annotations: { readOnlyHint: true },
      execute: async function (input) {
        const text = input && input.text ? input.text : S.getContractText();
        if (!text) throw new Error("No contract text loaded.");
        const out = [];
        Object.keys(E.TERM_KINDS).forEach(function (kind) {
          if (kind === "date" || kind === "party") return; // keep to the high-value, clearly-bounded kinds
          // representative label + attempt grounding; the agent refines values
          const def = E.TERM_KINDS[kind];
          const probe = { kind: kind, label: def.label, value: "" };
          const g = E.findGrounding(text, probe);
          if (g.grounded) {
            out.push({ kind: kind, label: def.label, quote: g.quote, confidence: g.confidence, grounded: true });
          }
        });
        return { contract: { chars: text.length, words: text.split(/\s+/).length }, candidates: out, note: "Review these candidates and propose exact terms with propose_term." };
      },
    },
    {
      name: "propose_term",
      title: "Propose a term (needs human approval)",
      description: "Stage one key term for the contract review. Provide the kind, a short label, the exact value you extracted, and optionally the text. It is grounded against the contract and STAGED only, returning a token. It does NOT persist until the human approves via approve_term. Mutating.",
      inputSchema: {
        type: "object",
        properties: {
          term: {
            type: "object",
            description: "The term to propose.",
            properties: {
              kind: { type: "string", description: "One of: renewalDate, terminationClause, noticePeriod, paymentTerm, amount, governingLaw, obligation, confidential, nonCompete, liabilityCap." },
              label: { type: "string", description: "Short human label, e.g. 'Auto-renewal year'." },
              value: { type: "string", description: "The exact value, e.g. '12 months' or '30 days' or 'New York'." },
            },
            required: ["kind", "label", "value"],
          },
          text: { type: "string", description: "Optional contract text; defaults to the loaded document." },
        },
        required: ["term"],
      },
      annotations: { readOnlyHint: false },
      execute: async function (input) { return stageProposal(input); },
    },
    {
      name: "propose_terms",
      title: "Propose several terms (needs human approval)",
      description: "Stage multiple key terms from the contract at once. Each is grounded and STAGED only; each returns a token. The human approves them one by one via approve_term. Mutating.",
      inputSchema: {
        type: "object",
        properties: {
          terms: { type: "array", items: { type: "object", description: "A term object like propose_term.term." } },
          text: { type: "string", description: "Optional contract text; defaults to the loaded document." },
        },
        required: ["terms"],
      },
      annotations: { readOnlyHint: false },
      execute: async function (input) {
        return {
          staged: input.terms.map(function (t) { return stageProposal({ term: t, text: input.text }); }),
        };
      },
    },
    {
      name: "approve_term",
      title: "Approve a staged term",
      description: "Commit a term previously staged by propose_term/propose_terms. Only succeeds with a valid token. Mutating.",
      inputSchema: { type: "object", properties: { token: { type: "string" } }, required: ["token"] },
      annotations: { readOnlyHint: false },
      execute: async function (input) {
        const term = S.approveTerm(input.token);
        if (!term) throw new Error("Invalid or expired term token.");
        if (window.TermLensUI && window.TermLensUI.refresh) window.TermLensUI.refresh();
        return { ok: true, label: term.label, value: term.value };
      },
    },
    {
      name: "reject_term",
      title: "Reject a staged term",
      description: "Discard a staged term without committing it. Mutating.",
      inputSchema: { type: "object", properties: { token: { type: "string" } }, required: ["token"] },
      annotations: { readOnlyHint: false },
      execute: async function (input) {
        const entry = S.rejectTerm(input.token);
        if (!entry) throw new Error("Invalid or expired term token.");
        if (window.TermLensUI && window.TermLensUI.refresh) window.TermLensUI.refresh();
        return { ok: true, rejected: true };
      },
    },
    {
      name: "summarize_terms",
      title: "Summarize approved terms",
      description: "Return the currently approved terms with their source quote and confidence. Read-only.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: async function () {
        return { approved: S.summarizeApproved(), writeLock: S.getWriteLock() };
      },
    },
  ];

  async function registerAll() {
    if (!document.modelContext) {
      window.TERMLENS_WEBMCP = { supported: false };
      return;
    }
    for (const t of TOOLS) {
      const original = t.execute;
      const wrapped = async function (input, opts) {
        const mutating = t.annotations && t.annotations.readOnlyHint === false;
        if (mutating && S.getWriteLock()) {
          const blocked = { blocked: true, reason: "Owner locked agent writes. Unlock to allow committing." };
          if (window.TermLensUI && window.TermLensUI.logTool) {
            window.TermLensUI.logTool({ tool: t.name, input: input, outcome: "blocked", detail: blocked.reason });
          }
          throw new Error(blocked.reason);
        }
        try {
          const result = await original(input, opts);
          if (window.TermLensUI && window.TermLensUI.logTool) {
            window.TermLensUI.logTool({ tool: t.name, input: input, outcome: "ok", detail: summarize(result) });
          }
          return result;
        } catch (e) {
          if (window.TermLensUI && window.TermLensUI.logTool) {
            window.TermLensUI.logTool({ tool: t.name, input: input, outcome: "error", detail: e.message });
          }
          throw e;
        }
      };
      try {
        await document.modelContext.registerTool({
          name: t.name, title: t.title, description: t.description,
          inputSchema: t.inputSchema, annotations: t.annotations, execute: wrapped,
        });
      } catch (e) { console.warn("WebMCP register failed for " + t.name, e); }
    }
    window.TERMLENS_WEBMCP = { supported: true, tools: TOOLS.map(function (t) { return t.name; }) };
    if (window.TermLensUI && window.TermLensUI.setWebMCPStatus) window.TermLensUI.setWebMCPStatus(true);
  }

  function summarize(result) {
    if (!result || typeof result !== "object") return result;
    if (result.token) return { staged: true, grounded: result.grounded, confidence: result.confidence };
    if (result.approved) return { approved: result.approved.length };
    if (result.ok) return { ok: true };
    if (result.candidates) return { candidates: result.candidates.length };
    return { ok: true };
  }

  window.TERMLENS_TOOLS = { registerAll: registerAll, TOOLS: TOOLS };
})();
