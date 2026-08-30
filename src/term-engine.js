// TermLens: contract/agreement term extraction with source-attribution.
// The core idea: an agent proposes terms, but every term must be grounded to
// an actual quote from the contract text, and is confidence-scored by how well
// it holds up. Low-confidence terms get flagged so the human knows where to look.
// Pure functions, no DOM, testable in Node.

(function () {
  const TERM_KINDS = {
    renewalDate:      { label: "Renewal date",      keywords: ["renew", "auto-renew", "renewal", "term of", "anniversary"] },
    terminationClause:{ label: "Termination",       keywords: ["terminat", "terminate", "end this agreement", "breach"] },
    noticePeriod:     { label: "Notice period",     keywords: ["notice", "days notice", "prior written notice", "days' written notice"] },
    paymentTerm:      { label: "Payment terms",     keywords: ["payment", "pay", "net ", "invoice", "due", "within"] },
    amount:           { label: "Amount",            keywords: ["$", "usd", "fee", "amount", "consideration", "salary", "price"] },
    governingLaw:     { label: "Governing law",     keywords: ["governed by", "laws of", "jurisdiction", "governing law"] },
    obligation:       { label: "Obligation",        keywords: ["shall", "must", "agrees to", "responsible for", "shall provide"] },
    confidential:     { label: "Confidentiality",   keywords: ["confidential", "non-disclosure", "proprietary", "trade secret"] },
    nonCompete:       { label: "Non-compete",       keywords: ["non-compete", "noncompete", "competition", "compete"] },
    liabilityCap:     { label: "Liability cap",     keywords: ["limitation of liability", "liable", "cap", "warranty"] },
    date:             { label: "Date",              keywords: [] },
    party:            { label: "Party",             keywords: ["parties", "the company", "the client", "between"] },
  };

  function norm(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, " ");
  }

  function splitSentences(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+(?=[A-Z"“'(])/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 5; });
  }

  function keywordScore(sentenceNorm, keywords) {
    let s = 0;
    keywords.forEach(function (k) {
      if (sentenceNorm.indexOf(k) !== -1) s += 1;
    });
    // a sentence that mentions several of the term's keywords is a stronger candidate
    return s;
  }

  function valueEvidence(sentenceNorm, value, kind) {
    if (!value) return 0;
    const v = norm(value);
    let s = 0;
    if (sentenceNorm.indexOf(v) !== -1) s += 3;
    const nums = (sentenceNorm.match(/\d+(?:\.\d+)?/g) || []);
    const core = v.replace(/[^0-9]/g, "");
    if (core.length >= 2 && nums.some(function (n) { return n === core || core.indexOf(n) !== -1 || n.indexOf(core) !== -1; })) s += 1;
    return s;
  }

  // Find the best grounding sentence for a proposed term, with a confidence score.
  function findGrounding(text, term) {
    const sentences = splitSentences(text);
    const kindDef = TERM_KINDS[term.kind] || TERM_KINDS.date;
    const value = term.value || "";
    let best = null, bestScore = 0;
    sentences.forEach(function (s) {
      const sn = norm(s);
      const k = keywordScore(sn, kindDef.keywords);
      const v = valueEvidence(sn, value, term.kind);
      const score = k * 2 + v;
      if (score > bestScore) { bestScore = score; best = s; }
    });
    if (!best) return { grounded: false, quote: null, confidence: 0, reason: "No sentence in the contract supports this term." };

    const sn = norm(best);
    const keyScore = keywordScore(sn, kindDef.keywords);
    const valScore = valueEvidence(sn, value, term.kind);

    // Invariant: if a value was provided, it MUST appear in the source sentence
    // for the term to be considered grounded. Otherwise the value is hallucinated.
    let grounded, confidence, reason;
    if (value && valScore === 0) {
      grounded = false;
      confidence = Math.min(0.45, 0.2 + keyScore * 0.06);
      reason = "The proposed value does not appear in the contract next to this term. Verify the value before approving.";
    } else {
      grounded = value ? valScore >= 1 : keyScore >= 1;
      confidence = Math.min(0.98, 0.35 + keyScore * 0.12 + valScore * 0.22);
      reason = grounded
        ? "Grounded to the quoted sentence."
        : "Found a related sentence, but the value is weakly supported. Review carefully.";
    }
    return { grounded: grounded, quote: best, confidence: +confidence.toFixed(2), reason: reason };
  }

  // Validate/normalize a proposed term from an agent.
  function validateTerm(term) {
    if (!term || typeof term !== "object") return { ok: false, error: "Term must be an object." };
    if (!TERM_KINDS[term.kind]) return { ok: false, error: "Unknown term kind: " + term.kind };
    if (typeof term.label !== "string" || !term.label) return { ok: false, error: "Term needs a label." };
    if (typeof term.value !== "string") return { ok: false, error: "Term value must be a string." };
    if (term.confidence != null && (typeof term.confidence !== "number" || term.confidence < 0 || term.confidence > 1)) {
      return { ok: false, error: "Confidence must be 0..1." };
    }
    return { ok: true };
  }

  window.TERMLENS_ENGINE = {
    TERM_KINDS: TERM_KINDS,
    splitSentences: splitSentences,
    findGrounding: findGrounding,
    validateTerm: validateTerm,
  };
})();
