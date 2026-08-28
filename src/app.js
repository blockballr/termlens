// UI wiring. Talks to the same engine/state the WebMCP tools use, so the app
// is fully usable by a human even without an agent, and the agent drives the
// exact same logic when WebMCP is available.

(function () {
  const S = window.RELIC_STATE;
  const E = window.RELIC_ENGINE;
  const P = function () { return S.getActiveProfile(); };

  const el = function (id) { return document.getElementById(id); };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  let currentToken = null;

  window.RelicUI = {
    setWebMCPStatus: function (ok) {
      const b = el("webmcp-status");
      if (!b) return;
      b.textContent = ok ? "WebMCP: active" : "WebMCP: unsupported here";
      b.className = ok ? "badge ok" : "badge";
    },
    logTool: function (entry) {
      window.RELIC_STATE.appendAudit({
        tool: entry.tool,
        input: entry.input,
        outcome: entry.outcome,
        detail: entry.detail,
        source: entry.source || "agent",
      });
      renderReceipts();
    },
    showConfirmation: function (token, summary) {
      currentToken = token;
      const c = el("confirm");
      const charLabel = (P().characters[summary.character] || {}).label || summary.character;
      const slots = Object.keys(summary.assignment).map(function (slot) {
        const r = S.getInventory().find(function (x) { return x.id === summary.assignment[slot]; });
        return escapeHtml(slot) + ": " + escapeHtml(r ? (r.label || ("#" + r.id)) : "?");
      }).join(", ");
      c.querySelector(".confirm-text").textContent = "Agent wants to save a loadout for " + charLabel + " (" + slots + "). Approve?";
      c.classList.remove("hidden");
    },
    refresh: function () { renderInventory(); renderLoadouts(); },
  };

  function renderProfileOptions() {
    const sel = el("profile");
    sel.innerHTML = "";
    Object.keys(window.RELIC_PROFILES).forEach(function (id) {
      const o = document.createElement("option");
      o.value = id; o.textContent = window.RELIC_PROFILES[id].label;
      sel.appendChild(o);
    });
    const activeId = S.getActiveProfileId();
    if (activeId === "custom") {
      const o = document.createElement("option");
      o.value = "custom"; o.textContent = "Custom profile";
      sel.appendChild(o);
    }
    sel.value = activeId;
  }

  function renderRelicForm() {
    const p = P();
    const slotSel = el("relic-slot");
    slotSel.innerHTML = "";
    Object.keys(p.slots).forEach(function (id) {
      const o = document.createElement("option");
      o.value = id; o.textContent = p.slots[id].label;
      slotSel.appendChild(o);
    });
    updateMainOptions();
    const setSel = el("relic-set");
    setSel.innerHTML = "";
    Object.keys(p.sets).forEach(function (id) {
      const o = document.createElement("option");
      o.value = id; o.textContent = p.sets[id].label + (p.sets[id].type === "planar" ? " (planar)" : "");
      setSel.appendChild(o);
    });
    renderSubstatRow();
  }

  function updateMainOptions() {
    const p = P();
    const slot = el("relic-slot").value;
    const mainSel = el("relic-main");
    mainSel.innerHTML = "";
    const def = p.slots[slot];
    const opts = def.fixedMain ? [def.fixedMain] : def.variableMain;
    opts.forEach(function (st) {
      const o = document.createElement("option");
      o.value = st; o.textContent = p.substats[st] ? p.substats[st].label : st;
      mainSel.appendChild(o);
    });
  }

  function renderSubstatRow() {
    const wrap = el("substat-rows");
    wrap.innerHTML = "";
    addSubstatRow();
  }

  function addSubstatRow() {
    const p = P();
    const wrap = el("substat-rows");
    const row = document.createElement("div");
    row.className = "substat-row";
    const stat = document.createElement("select");
    Object.keys(p.substats).forEach(function (st) {
      const o = document.createElement("option");
      o.value = st; o.textContent = p.substats[st].label;
      stat.appendChild(o);
    });
    const val = document.createElement("input");
    val.type = "number"; val.step = "any"; val.placeholder = "value (e.g. 7.2)";
    const del = document.createElement("button");
    del.type = "button"; del.textContent = "x"; del.className = "mini";
    del.onclick = function () { row.remove(); };
    row.appendChild(stat); row.appendChild(val); row.appendChild(del);
    wrap.appendChild(row);
  }

  function collectRelic() {
    const p = P();
    const substats = [];
    el("substat-rows").querySelectorAll(".substat-row").forEach(function (row) {
      const st = row.querySelector("select").value;
      const v = parseFloat(row.querySelector("input").value);
      if (!isNaN(v)) substats.push({ stat: st, value: v });
    });
    return {
      slot: el("relic-slot").value,
      setName: el("relic-set").value,
      mainStat: el("relic-main").value,
      label: el("relic-label").value.trim() || null,
      substats: substats,
    };
  }

  function renderInventory() {
    const p = P();
    const inv = S.getInventory();
    const list = el("inventory");
    list.innerHTML = "";
    if (!inv.length) { list.innerHTML = "<p class='muted'>No relics yet. Add one above.</p>"; return; }
    inv.forEach(function (r) {
      const ev = E.evaluateRelic(p, r);
      const card = document.createElement("div");
      card.className = "card";
      const subs = (r.substats || []).map(function (s) {
        return escapeHtml(p.substats[s.stat] ? p.substats[s.stat].label : s.stat) + " " + s.value;
      }).join(", ");
      card.innerHTML =
        "<div class='card-head'><strong>" + escapeHtml(r.label || (p.slots[r.slot] && p.slots[r.slot].label)) + "</strong>" +
        " <span class='grade grade-" + ev.bestFit.grade + "'>" + ev.bestFit.grade + "</span></div>" +
        "<div class='muted'>" + escapeHtml(p.slots[r.slot] ? p.slots[r.slot].label : r.slot) + " / " +
        escapeHtml(p.sets[r.setName] ? p.sets[r.setName].label : r.setName) + " / " +
        escapeHtml(p.substats[r.mainStat] ? p.substats[r.mainStat].label : r.mainStat) + "</div>" +
        "<div class='muted small'>" + escapeHtml(subs) + "</div>" +
        "<div class='muted small'>Best for: " + escapeHtml(ev.bestFit.label) + " (" + ev.bestFit.score + ")</div>";
      const acts = document.createElement("div"); acts.className = "card-actions";
      const evalBtn = document.createElement("button"); evalBtn.type = "button"; evalBtn.textContent = "Evaluate";
      evalBtn.onclick = function () { showEvaluate(r); };
      const del = document.createElement("button"); del.type = "button"; del.textContent = "Delete"; del.className = "mini";
      del.onclick = function () { S.removeRelic(r.id); renderInventory(); };
      acts.appendChild(evalBtn); acts.appendChild(del);
      card.appendChild(acts);
      list.appendChild(card);
    });
  }

  function showEvaluate(relic) {
    const p = P();
    const ev = E.evaluateRelic(p, relic);
    window.RelicUI.logTool({ tool: "evaluate_relic", input: { slot: relic.slot, setName: relic.setName }, outcome: "ok", detail: { bestFit: ev.bestFit.label, grade: ev.bestFit.grade }, source: "human" });
    const out = el("advisor-output");
    let html = "<h3>Evaluation</h3><p class='muted'>" + escapeHtml(relic.label || p.slots[relic.slot].label) + "</p><ul>";
    ev.ranked.forEach(function (f) {
      html += "<li><strong>" + escapeHtml(f.label) + "</strong> - " + f.grade + " (" + f.score + "): " + escapeHtml(f.reasons.join("; ")) + "</li>";
    });
    html += "</ul><p class='muted small'>An AI agent using WebMCP sees the same scoring and can pick pieces for you.</p>";
    out.innerHTML = html;
  }

  function renderAdvisor() {
    const p = P();
    const sel = el("advisor-character");
    sel.innerHTML = "";
    Object.keys(p.characters).forEach(function (id) {
      const o = document.createElement("option");
      o.value = id; o.textContent = p.characters[id].label + " (" + p.characters[id].role + ")";
      sel.appendChild(o);
    });
  }

  function runSuggest() {
    const p = P();
    const charId = el("advisor-character").value;
    const res = E.suggestBuild(p, charId, S.getInventory());
    window.RelicUI.logTool({ tool: "suggest_build", input: { characterId: charId }, outcome: "ok", detail: { totalScore: res.totalScore, set: res.setComposition }, source: "human" });
    const out = el("advisor-output");
    let html = "<h3>Build for " + escapeHtml(p.characters[charId].label) + "</h3>";
    html += "<ul>";
    res.assignment.forEach(function (a) {
      html += "<li>" + escapeHtml(a.slotLabel) + ": " + escapeHtml(a.label) +
        (a.slotScore != null ? " (" + a.slotScore + ")" : "") + "</li>";
    });
    html += "</ul>";
    html += "<p><strong>Set:</strong> " + escapeHtml(res.setComposition) + "</p>";
    html += "<p><strong>Total score:</strong> " + res.totalScore + " &nbsp; <strong>Est. DPS x</strong> " + res.estDpsMultiplier + "</p>";
    html += "<p class='muted'>" + escapeHtml(res.reasoning) + "</p>";
    html += "<button type='button' id='save-build'>Save this build</button>";
    out.innerHTML = html;
    el("save-build").onclick = function () { stageSave(charId, res.assignment); };
  }

  function stageSave(characterId, assignment) {
    if (S.getWriteLock()) { alert("Saving is locked. Unlock 'Allow agent to save' to store a loadout."); return; }
    const map = {};
    assignment.forEach(function (a) { if (a.relicId) map[a.slot] = a.relicId; });
    const token = S.stageLoadout({ character: characterId, assignment: map });
    window.RelicUI.logTool({ tool: "save_loadout", input: { characterId: characterId, slots: Object.keys(map).length }, outcome: "ok", detail: { staged: true, requiresConfirmation: true }, source: "human" });
    window.RelicUI.showConfirmation(token, { character: characterId, assignment: map });
  }

  function runPlan() {
    const p = P();
    const charId = el("advisor-character").value;
    const res = E.planFarmRoute(p, charId, S.getInventory());
    window.RelicUI.logTool({ tool: "plan_farm_route", input: { characterId: charId }, outcome: "ok", detail: { domain: res.domain }, source: "human" });
    el("advisor-output").innerHTML =
      "<h3>Farm plan</h3><p>" + escapeHtml(res.reason) + "</p><p class='muted'>Domain: <strong>" + escapeHtml(res.domain) + "</strong></p>";
  }

  function renderLoadouts() {
    const p = P();
    const ls = S.getLoadouts();
    const wrap = el("loadouts");
    wrap.innerHTML = "";
    const ids = Object.keys(ls);
    if (!ids.length) { wrap.innerHTML = "<p class='muted'>No saved loadouts yet.</p>"; return; }
    ids.forEach(function (charId) {
      const a = ls[charId];
      const div = document.createElement("div");
      div.className = "card";
      const parts = Object.keys(a).map(function (slot) {
        const r = S.getInventory().find(function (x) { return x.id === a[slot]; });
        return escapeHtml(p.slots[slot] ? p.slots[slot].label : slot) + ": " + escapeHtml(r ? (r.label || "#" + r.id) : "?");
      }).join(", ");
      div.innerHTML = "<strong>" + escapeHtml((p.characters[charId] || {}).label || charId) + "</strong><div class='muted small'>" + parts + "</div>";
      wrap.appendChild(div);
    });
  }

  function renderReceipts() {
    const list = el("receipts");
    if (!list) return;
    const audit = S.getAudit();
    if (!audit.length) { list.innerHTML = "<p class='muted'>No agent actions yet. Tool calls (human or agent) appear here as verifiable receipts.</p>"; return; }
    list.innerHTML = "";
    audit.slice().reverse().forEach(function (e) {
      const row = document.createElement("div");
      row.className = "receipt-row receipt-" + e.outcome;
      const det = e.detail ? JSON.stringify(e.detail) : "";
      row.innerHTML = "<span class='r-tool'>" + escapeHtml(e.tool) + "</span>" +
        "<span class='r-out '>" + escapeHtml(e.outcome) + "</span>" +
        "<span class='r-src'>" + escapeHtml(e.source || "agent") + "</span>" +
        "<span class='r-det muted small'>" + escapeHtml(det) + "</span>";
      list.appendChild(row);
    });
  }

  function exportReceipts() {
    const data = JSON.stringify(S.getAudit(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;     a.download = "coartifex-receipts.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function init() {
    renderProfileOptions();
    renderRelicForm();
    renderAdvisor();
    renderInventory();
    renderLoadouts();

    el("profile").onchange = function () {
      S.setActiveProfile(el("profile").value);
      renderRelicForm(); renderAdvisor(); renderInventory(); renderLoadouts();
    };
    el("import-profile").onclick = function () {
      const txt = el("profile-json").value.trim();
      if (!txt) return;
      try {
        const prof = JSON.parse(txt);
        if (!prof.slots || !prof.characters) throw new Error("Profile needs slots and characters.");
        S.importProfile(prof);
        renderProfileOptions(); renderRelicForm(); renderAdvisor(); renderInventory(); renderLoadouts();
      } catch (e) { alert("Invalid profile JSON: " + e.message); }
    };
    el("relic-slot").onchange = updateMainOptions;
    el("add-substat").onclick = addSubstatRow;
    el("add-relic").onclick = function () {
      const r = collectRelic();
      if (!r.substats.length) { alert("Add at least one substat."); return; }
      S.addRelic(r);
      el("relic-label").value = "";
      renderInventory();
    };
    el("suggest-btn").onclick = runSuggest;
    el("plan-btn").onclick = runPlan;

    el("confirm-approve").onclick = function () {
      if (currentToken) {
        if (S.getWriteLock()) { alert("Saving is locked. Unlock first."); return; }
        S.confirmLoadout(currentToken);
        window.RelicUI.logTool({ tool: "confirm_loadout", input: { token: "(approved)" }, outcome: "ok", detail: { committed: true }, source: "human" });
        renderLoadouts();
      }
      el("confirm").classList.add("hidden");
      currentToken = null;
    };
    el("confirm-reject").onclick = function () {
      if (currentToken) {
        S.consumeLoadout(currentToken);
        window.RelicUI.logTool({ tool: "confirm_loadout", input: { token: "(rejected)" }, outcome: "blocked", detail: { committed: false }, source: "human" });
      }
      el("confirm").classList.add("hidden");
      currentToken = null;
    };

    el("write-lock").checked = S.getWriteLock();
    el("write-lock").onchange = function () { S.setWriteLock(el("write-lock").checked); };
    el("export-receipts").onclick = exportReceipts;
    el("clear-receipts").onclick = function () { S.clearAudit(); renderReceipts(); };
    renderReceipts();

    window.RelicUI.setWebMCPStatus(false);
    window.RELIC_TOOLS.registerAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
