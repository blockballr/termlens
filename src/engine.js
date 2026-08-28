// Game-agnostic scoring engine. Reads only the active profile passed in.
// All substat values are accepted in the units a player sees in-game
// (CRIT shown as 7.2, Speed as 5.8, flat ATK as 35) and normalised here.

(function () {
  function normalize(stat, value) {
    if (stat === "spd") return value;
    if (stat.indexOf("flat") === 0) return value;
    return value / 100; // percent-style stats
  }

  function gradeFromScore(raw) {
    if (raw >= 105) return "SSS";
    if (raw >= 85) return "SS";
    if (raw >= 65) return "S";
    if (raw >= 45) return "A";
    if (raw >= 30) return "B";
    if (raw >= 15) return "C";
    return "F";
  }

  function mainStatFit(profile, relic, character) {
    const slotDef = profile.slots[relic.slot];
    if (!slotDef) return 0.2;
    if (slotDef.fixedMain) {
      return relic.mainStat === slotDef.fixedMain ? 1 : 0.3;
    }
    const wants = (character.wantedMain && character.wantedMain[relic.slot]) || [];
    if (wants.indexOf(relic.mainStat) !== -1) return 1;
    if (slotDef.variableMain && slotDef.variableMain.indexOf(relic.mainStat) !== -1) return 0.5;
    return 0.2;
  }

  function subScore(profile, relic, character) {
    const weights = profile.roleWeights[character.role] || {};
    let total = 0;
    (relic.substats || []).forEach(function (s) {
      const def = profile.substats[s.stat];
      if (!def) return;
      const w = weights[s.stat] || 0;
      total += (normalize(s.stat, s.value) / def.maxRoll) * w;
    });
    return total;
  }

  function scoreRelicForCharacter(profile, relic, character) {
    const mainFit = mainStatFit(profile, relic, character);
    const sub = subScore(profile, relic, character);
    const raw = sub * 20 + mainFit * 18;
    const reasons = [];
    if (mainFit >= 1) reasons.push("main stat is exactly what " + character.label + " wants");
    else if (mainFit >= 0.5) reasons.push("main stat is usable but not ideal for " + character.label);
    else reasons.push("main stat is a poor fit for " + character.label);
    const top = (relic.substats || [])
      .map(function (s) { return s.stat; })
      .filter(function (st) { return (profile.roleWeights[character.role] || {})[st] >= 0.8; });
    if (top.length >= 2) reasons.push("carries " + top.length + " high-value substats");
    else if (top.length === 1) reasons.push("has one high-value substat");
    else reasons.push("substats are low priority for this role");
    return { score: Math.round(raw), grade: gradeFromScore(raw), mainFit: mainFit, subScore: +sub.toFixed(2), reasons: reasons };
  }

  // Evaluate one relic against a character, or find its best-fitting characters.
  function evaluateRelic(profile, relic, characterId) {
    if (characterId && profile.characters[characterId]) {
      const r = scoreRelicForCharacter(profile, relic, profile.characters[characterId]);
      return { character: characterId, grade: r.grade, score: r.score, reasons: r.reasons };
    }
    const fits = Object.keys(profile.characters).map(function (id) {
      const r = scoreRelicForCharacter(profile, relic, profile.characters[id]);
      return { character: id, label: profile.characters[id].label, grade: r.grade, score: r.score, reasons: r.reasons };
    }).sort(function (a, b) { return b.score - a.score; });
    return { bestFit: fits[0], ranked: fits };
  }

  function suggestBuild(profile, characterId, relics) {
    const character = profile.characters[characterId];
    if (!character) throw new Error("Unknown character: " + characterId);
    const used = {};
    const assignment = [];
    let slotTotal = 0;
    Object.keys(profile.slots).forEach(function (slot) {
      const candidates = relics.filter(function (r) { return r.slot === slot && !used[r.id]; });
      if (!candidates.length) { assignment.push({ slot: slot, slotLabel: profile.slots[slot].label, relicId: null, label: "(no piece)" }); return; }
      let best = null, bestScore = -1;
      candidates.forEach(function (r) {
        const s = scoreRelicForCharacter(profile, r, character).score;
        if (s > bestScore) { bestScore = s; best = r; }
      });
      used[best.id] = true;
      slotTotal += bestScore;
      assignment.push({ slot: slot, slotLabel: profile.slots[slot].label, relicId: best.id, label: best.label || ("#" + best.id), slotScore: bestScore });
    });

    const relicSets = {};
    const planarSets = {};
    assignment.forEach(function (a) {
      if (!a.relicId) return;
      const relic = relics.find(function (r) { return r.id === a.relicId; });
      const setDef = profile.sets[relic.setName];
      if (!setDef) return;
      if (setDef.type === "planar") planarSets[relic.setName] = (planarSets[relic.setName] || 0) + 1;
      else relicSets[relic.setName] = (relicSets[relic.setName] || 0) + 1;
    });

    function describe(counts) {
      const parts = [];
      Object.keys(counts).forEach(function (s) {
        const n = counts[s];
        if (n >= 4) parts.push(profile.sets[s].label + " 4pc");
        else if (n >= 2) parts.push(profile.sets[s].label + " 2pc");
      });
      return parts.join(" + ") || "no set bonus yet";
    }
    const setComposition = describe(relicSets) + (planarSets && Object.keys(planarSets).length ? " / " + describe(planarSets) : "");

    let setBonus = 0;
    Object.keys(relicSets).forEach(function (s) { setBonus += relicSets[s] >= 4 ? 25 : relicSets[s] >= 2 ? 10 : 0; });
    Object.keys(planarSets).forEach(function (s) { setBonus += planarSets[s] >= 2 ? 8 : 0; });

    const total = Math.round(slotTotal + setBonus);
    const dpsMult = +(1 + total * 0.01).toFixed(2);
    return {
      character: characterId,
      assignment: assignment,
      setComposition: setComposition,
      totalScore: total,
      estDpsMultiplier: dpsMult,
      reasoning: character.label + ": " + character.blurb + " Set bonus contribution ~" + setBonus + " pts.",
    };
  }

  function planFarmRoute(profile, characterId, relics) {
    const character = profile.characters[characterId];
    if (!character) throw new Error("Unknown character: " + characterId);
    const have = {};
    relics.forEach(function (r) {
      const setDef = profile.sets[r.setName];
      if (setDef && setDef.type === "relic") have[r.setName] = (have[r.setName] || 0) + 1;
    });
    const primary = character.sets[0];
    const pdef = profile.sets[primary];
    if (!have[primary]) {
      return { domain: pdef.domain, character: characterId, reason: "You have no " + pdef.label + " pieces yet. Start farming " + pdef.domain + " for a 4pc." };
    }
    const missing = character.sets.filter(function (s) { return (have[s] || 0) < 4; });
    if (!missing.length) {
      return { domain: pdef.domain, character: characterId, reason: "Core " + pdef.label + " 4pc is done. Farm more for better substats or a planar ornament." };
    }
    const weak = missing[0];
    return {
      domain: profile.sets[weak].domain,
      character: characterId,
      reason: "You have " + (have[weak] || 0) + "/4 " + profile.sets[weak].label + " pieces. Keep farming " + profile.sets[weak].domain + " to complete the set.",
    };
  }

  // Pity math. 50/50 banner: worst case per copy is 90 if already guaranteed,
  // else 180 (lose then guarantee).
  function recommendWishes(input) {
    const pity = input.pity || 0;
    const guaranteed = !!input.guaranteed;
    const available = (input.currency || 0) + pity;
    const goal = Math.max(1, input.goalCopies || 1);
    const needed = (guaranteed ? 90 : 180) + 90 * (goal - 1);
    let verdict;
    if (available >= needed) verdict = "Guaranteed: you can secure " + goal + " copy(ies).";
    else if (available >= 90) verdict = "Possible: you can reach at least one copy at hard pity, but not " + goal + " guaranteed.";
    else verdict = "Short by " + (needed - available) + " wishes for a guarantee.";
    return { availableWishes: available, neededWishes: needed, guaranteed: guaranteed, verdict: verdict };
  }

  window.RELIC_ENGINE = {
    evaluateRelic: evaluateRelic,
    suggestBuild: suggestBuild,
    planFarmRoute: planFarmRoute,
    recommendWishes: recommendWishes,
    gradeFromScore: gradeFromScore,
  };
})();
