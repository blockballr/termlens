// Client-side state. No backend, so all data stays in the user's browser.
// This is what makes the tool safe for real accounts: we never see your relics.

(function () {
  const KEY = "coartifex.v1";
  const pending = {}; // confirmation tokens for mutating actions
  const audit = [];   // session receipt log (in memory; exportable, never uploaded)
  let writeLock = false; // owner-controlled gate on mutating tools

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function write(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

  function state() {
    const s = read();
    if (!s.inventory) s.inventory = [];
    if (!s.loadouts) s.loadouts = {};
    if (!s.activeProfileId) s.activeProfileId = "hsr";
    return s;
  }

  function getActiveProfile() {
    const s = state();
    if (s.activeProfileId === "custom" && s.customProfile) return s.customProfile;
    return window.RELIC_PROFILES[s.activeProfileId] || window.RELIC_PROFILES.hsr;
  }

  function getActiveProfileId() {
    const s = state();
    return s.activeProfileId || "hsr";
  }

  function setActiveProfile(id) {
    const s = state();
    s.activeProfileId = id;
    write(s);
  }

  function importProfile(profile) {
    const s = state();
    s.customProfile = profile;
    s.activeProfileId = "custom";
    write(s);
  }

  function getInventory() { return state().inventory; }

  function addRelic(relic) {
    const s = state();
    relic.id = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    s.inventory.push(relic);
    write(s);
    return relic.id;
  }

  function removeRelic(id) {
    const s = state();
    s.inventory = s.inventory.filter(function (r) { return r.id !== id; });
    write(s);
  }

  function getLoadouts() { return state().loadouts; }

  function stageLoadout(summary) {
    const token = "ld-" + Math.random().toString(36).slice(2, 10);
    pending[token] = summary;
    return token;
  }

  function consumeLoadout(token) {
    const summary = pending[token];
    if (!summary) return null;
    delete pending[token];
    return summary;
  }

  function confirmLoadout(token) {
    const summary = consumeLoadout(token);
    if (!summary) return null;
    const s = state();
    s.loadouts[summary.character] = summary.assignment;
    write(s);
    return summary;
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

  window.RELIC_STATE = {
    getActiveProfile: getActiveProfile,
    getActiveProfileId: getActiveProfileId,
    setActiveProfile: setActiveProfile,
    importProfile: importProfile,
    getInventory: getInventory,
    addRelic: addRelic,
    removeRelic: removeRelic,
    getLoadouts: getLoadouts,
    stageLoadout: stageLoadout,
    consumeLoadout: consumeLoadout,
    confirmLoadout: confirmLoadout,
    getWriteLock: getWriteLock,
    setWriteLock: setWriteLock,
    appendAudit: appendAudit,
    getAudit: getAudit,
    clearAudit: clearAudit,
  };
})();
