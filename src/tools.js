// WebMCP tool registration. These are the tools an AI agent (ChatGPT's in-app
// browser, or Chrome with WebMCP enabled) discovers and calls. The UI also
// calls the same engine, so the app is useful with or without an agent.

(function () {
  const S = window.RELIC_STATE;
  const E = window.RELIC_ENGINE;

  function activeProfile() { return S.getActiveProfile(); }

  function buildAssignmentFromIds(characterId, relicIds) {
    const profile = activeProfile();
    const relics = relicIds && relicIds.length
      ? S.getInventory().filter(function (r) { return relicIds.indexOf(r.id) !== -1; })
      : S.getInventory();
    return E.suggestBuild(profile, characterId, relics);
  }

  const TOOLS = [
    {
      name: "describe_game",
      title: "Describe the active game profile",
      description: "List the slots, stats, sets, and characters of the currently loaded gacha profile so you know valid inputs for the other tools. Call this first.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: async function () {
        const p = activeProfile();
        return {
          profile: p.id,
          label: p.label,
          slots: Object.keys(p.slots),
          substats: Object.keys(p.substats),
          sets: Object.keys(p.sets),
          characters: Object.keys(p.characters).map(function (id) {
            return { id: id, label: p.characters[id].label, role: p.characters[id].role, blurb: p.characters[id].blurb };
          }),
        };
      },
    },
    {
      name: "evaluate_relic",
      title: "Evaluate a relic",
      description: "Score one relic and explain which characters it fits. Pass characterId to score for one character, or omit it to find the best-fitting characters. Substat values use in-game units: percents as 7.2, Speed as 5.8, flat ATK as 35.",
      inputSchema: {
        type: "object",
        properties: {
          relic: {
            type: "object",
            description: "The relic to evaluate.",
            properties: {
              slot: { type: "string", description: "Slot id, e.g. head, body, sphere, sands, goblet." },
              setName: { type: "string", description: "Set id, e.g. emberveil, crimson." },
              mainStat: { type: "string", description: "Main stat id, e.g. critRate, atkPercent, elementDmg." },
              substats: {
                type: "array",
                items: {
                  type: "object",
                  properties: { stat: { type: "string" }, value: { type: "number" } },
                },
              },
            },
            required: ["slot", "setName", "mainStat"],
          },
          characterId: { type: "string", description: "Optional character id to score against." },
        },
        required: ["relic"],
      },
      annotations: { readOnlyHint: true },
      execute: async function (input) {
        const profile = activeProfile();
        if (!profile.slots[input.relic.slot]) throw new Error("Unknown slot: " + input.relic.slot);
        if (!profile.sets[input.relic.setName]) throw new Error("Unknown set: " + input.relic.setName);
        return E.evaluateRelic(profile, input.relic, input.characterId);
      },
    },
    {
      name: "suggest_build",
      title: "Suggest a build",
      description: "Pick the best available relics per slot for a character and estimate the set bonus and damage multiplier. Omit relicIds to use the whole inventory.",
      inputSchema: {
        type: "object",
        properties: {
          characterId: { type: "string", description: "Character id, e.g. pyra, diluc." },
          relicIds: { type: "array", items: { type: "string" }, description: "Optional subset of relic ids to choose from." },
        },
        required: ["characterId"],
      },
      annotations: { readOnlyHint: true },
      execute: async function (input) {
        return buildAssignmentFromIds(input.characterId, input.relicIds);
      },
    },
    {
      name: "plan_farm_route",
      title: "Plan the farm route",
      description: "Given a character and your current relics, recommend which domain to farm next to complete their set. Read-only.",
      inputSchema: {
        type: "object",
        properties: { characterId: { type: "string" } },
        required: ["characterId"],
      },
      annotations: { readOnlyHint: true },
      execute: async function (input) {
        return E.planFarmRoute(activeProfile(), input.characterId, S.getInventory());
      },
    },
    {
      name: "recommend_wishes",
      title: "Recommend wishes",
      description: "Pity math. Given current pity, whether the next 5-star is guaranteed, currency on hand, and goal copies, say if the banner is affordable. Read-only.",
      inputSchema: {
        type: "object",
        properties: {
          pity: { type: "number", description: "Pulls since last 5-star." },
          guaranteed: { type: "boolean", description: "True if the next 5-star is the featured unit." },
          currency: { type: "number", description: "Wishes currently available." },
          goalCopies: { type: "number", description: "Copies you want, default 1." },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async function (input) {
        return E.recommendWishes(input || {});
      },
    },
    {
      name: "save_loadout",
      title: "Save a loadout (needs confirmation)",
      description: "Stage a character's relic loadout for saving. This is a mutating action and requires human confirmation: it returns a token. Call confirm_loadout with that token after the human approves in the UI. It does NOT persist on its own.",
      inputSchema: {
        type: "object",
        properties: {
          characterId: { type: "string" },
          assignment: { type: "object", description: "Map of slot id to relic id." },
        },
        required: ["characterId", "assignment"],
      },
      annotations: { readOnlyHint: false },
      execute: async function (input) {
        const profile = activeProfile();
        const inv = S.getInventory();
        const validated = {};
        Object.keys(input.assignment).forEach(function (slot) {
          const id = input.assignment[slot];
          const relic = inv.find(function (r) { return r.id === id; });
          if (!relic) throw new Error("Unknown relic id: " + id);
          if (relic.slot !== slot) throw new Error("Relic " + id + " is a " + relic.slot + ", not " + slot);
          validated[slot] = id;
        });
        const summary = { character: input.characterId, assignment: validated };
        const token = S.stageLoadout(summary);
        if (window.RelicUI && window.RelicUI.showConfirmation) window.RelicUI.showConfirmation(token, summary);
        return { token: token, requiresConfirmation: true, summary: summary, note: "Persist only after the human approves via confirm_loadout." };
      },
    },
    {
      name: "confirm_loadout",
      title: "Confirm a saved loadout",
      description: "Commit a loadout previously staged by save_loadout. Only succeeds with a valid token the human approved. Mutating.",
      inputSchema: {
        type: "object",
        properties: { token: { type: "string" } },
        required: ["token"],
      },
      annotations: { readOnlyHint: false },
      execute: async function (input) {
        const summary = S.confirmLoadout(input.token);
        if (!summary) throw new Error("Invalid or expired confirmation token.");
        if (window.RelicUI && window.RelicUI.refresh) window.RelicUI.refresh();
        return { ok: true, character: summary.character };
      },
    },
  ];

  async function registerAll() {
    if (!document.modelContext) {
      window.RELIC_WEBMCP = { supported: false };
      return;
    }
    for (const t of TOOLS) {
      const original = t.execute;
      const wrapped = async function (input, opts) {
        const mutating = t.annotations && t.annotations.readOnlyHint === false;
        if (mutating && S.getWriteLock()) {
          const blocked = { blocked: true, reason: "Owner locked agent writes. Unlock to allow saving." };
          if (window.RelicUI && window.RelicUI.logTool) {
            window.RelicUI.logTool({ tool: t.name, input: input, outcome: "blocked", detail: blocked.reason });
          }
          throw new Error(blocked.reason);
        }
        try {
          const result = await original(input, opts);
          if (window.RelicUI && window.RelicUI.logTool) {
            window.RelicUI.logTool({ tool: t.name, input: input, outcome: "ok", detail: summarize(result) });
          }
          return result;
        } catch (e) {
          if (window.RelicUI && window.RelicUI.logTool) {
            window.RelicUI.logTool({ tool: t.name, input: input, outcome: "error", detail: e.message });
          }
          throw e;
        }
      };
      try {
        await document.modelContext.registerTool({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: t.annotations,
          execute: wrapped,
        });
      } catch (e) {
        console.warn("WebMCP register failed for " + t.name, e);
      }
    }
    window.RELIC_WEBMCP = { supported: true, tools: TOOLS.map(function (t) { return t.name; }) };
    if (window.RelicUI && window.RelicUI.setWebMCPStatus) window.RelicUI.setWebMCPStatus(true);
  }

  function summarize(result) {
    if (!result || typeof result !== "object") return result;
    if (result.token) return { staged: true, requiresConfirmation: result.requiresConfirmation };
    if (result.verdict) return { verdict: result.verdict };
    if (result.grade) return { grade: result.grade, score: result.score };
    if (result.totalScore != null) return { totalScore: result.totalScore, set: result.setComposition };
    if (result.domain) return { domain: result.domain };
    if (result.ok) return { ok: true };
    return { ok: true };
  }

  window.RELIC_TOOLS = { registerAll: registerAll, TOOLS: TOOLS };
})();
