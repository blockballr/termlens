// Game-agnostic gacha profiles. The scoring engine (engine.js) knows nothing
// about any specific game; it only reads the active profile. Ship a profile per
// game you want to support, or let a user import their own JSON.
//
// Profile schema
//   slots:     { id: { label, fixedMain?|variableMain:[...] } }
//   substats:  { id: { label, maxRoll } }            // maxRoll = one perfect upgrade roll
//   roleWeights:{ role: { substatId: weight } }       // drives relic scoring
//   sets:      { id: { label, type:'relic'|'planar', domain, bonus2, bonus4? } }
//   characters:{ id: { label, role, element, sets:[...], wantedMain:{slot:[statId]}, blurb } }
//
// These numbers are directional approximations meant to be extended, not a
// substitute for a per-game theorycrafting database.

window.RELIC_PROFILES = {
  hsr: {
    id: "hsr",
    label: "Honkai: Star Rail (style)",
    slots: {
      head:  { label: "Head",          fixedMain: "hpPercent" },
      hands: { label: "Hands",         fixedMain: "atkPercent" },
      body:  { label: "Body",          variableMain: ["critRate", "critDmg", "atkPercent", "hpPercent", "energyRegen", "elementDmg"] },
      feet:  { label: "Feet",          variableMain: ["spd", "atkPercent", "hpPercent"] },
      sphere:{ label: "Planar Sphere", variableMain: ["elementDmg", "atkPercent", "hpPercent"] },
      rope:  { label: "Link Rope",     variableMain: ["energyRegen", "atkPercent", "hpPercent"] },
    },
    substats: {
      critRate:    { label: "CRIT Rate",     maxRoll: 0.072 },
      critDmg:     { label: "CRIT DMG",      maxRoll: 0.144 },
      atkPercent:  { label: "ATK%",          maxRoll: 0.108 },
      spd:         { label: "Speed",         maxRoll: 5.8 },
      elementDmg:  { label: "Elemental DMG%",maxRoll: 0.108 },
      energyRegen: { label: "Energy Regen%",  maxRoll: 0.096 },
      hpPercent:   { label: "HP%",           maxRoll: 0.108 },
      defPercent:  { label: "DEF%",          maxRoll: 0.108 },
    },
    roleWeights: {
      dps:     { critRate: 1.0, critDmg: 1.0, atkPercent: 0.8, spd: 0.7, elementDmg: 0.9, energyRegen: 0.2, hpPercent: 0.1, defPercent: 0.0 },
      support: { spd: 1.0, energyRegen: 0.9, hpPercent: 0.6, critRate: 0.2, critDmg: 0.2, atkPercent: 0.3, elementDmg: 0.3, defPercent: 0.2 },
      healer:  { energyRegen: 1.0, hpPercent: 0.9, spd: 0.7, critRate: 0.1, critDmg: 0.1, atkPercent: 0.1, elementDmg: 0.1, defPercent: 0.3 },
    },
    sets: {
      emberveil:  { label: "Emberveil",      type: "relic",  domain: "Cinderfall Cavern",        bonus2: "ATK +18%",        bonus4: "Skill DMG +25%" },
      voidpierce: { label: "Voidpierce",     type: "relic",  domain: "Riftspark Cavern",        bonus2: "Lightning DMG +14%",bonus4: "Aftershock DMG +20%" },
      tempest:    { label: "Tempest",        type: "relic",  domain: "Galehollow Cavern",       bonus2: "Speed +12%",      bonus4: "Follow-up DMG +20%" },
      lumen:      { label: "Lumen",          type: "relic",  domain: "Lumen Sanctum",          bonus2: "Healing +15%",    bonus4: "Outgoing heal +20%" },
      azureOrb:   { label: "Azure Orb",      type: "planar", domain: "Simulated Void",         bonus2: "Elemental DMG +12%" },
      swiftRope:  { label: "Swift Rope",     type: "planar", domain: "Simulated Void",         bonus2: "Energy Regen +12%" },
    },
    characters: {
      pyra:   { label: "Pyra",   role: "dps",     element: "Fire",      sets: ["emberveil"],               wantedMain: { body: ["critRate","critDmg"], feet: ["atkPercent","spd"], sphere: ["elementDmg"], rope: ["atkPercent","energyRegen"] }, blurb: "Fire hypercarry. Wants double CRIT, ATK%, Fire DMG sphere." },
      bolt:   { label: "Bolt",   role: "dps",     element: "Lightning", sets: ["voidpierce"],             wantedMain: { body: ["critRate","critDmg"], feet: ["atkPercent","spd"], sphere: ["elementDmg"], rope: ["atkPercent","energyRegen"] }, blurb: "Lightning carry. Same stat appetite on Voidpierce." },
      gale:   { label: "Gale",   role: "support", element: "Wind",     sets: ["tempest","lumen"],         wantedMain: { body: ["critRate","hpPercent"], feet: ["spd"], sphere: ["elementDmg","atkPercent"], rope: ["energyRegen"] }, blurb: "Support. Lives on Speed and Energy Regen." },
      lumina: { label: "Lumina", role: "healer",  element: "Quantum",  sets: ["lumen"],                  wantedMain: { body: ["hpPercent","energyRegen"], feet: ["spd","hpPercent"], sphere: ["hpPercent","energyRegen"], rope: ["energyRegen"] }, blurb: "Healer. Energy Regen and HP% everywhere." },
    },
  },

  genshin: {
    id: "genshin",
    label: "Genshin Impact (style)",
    slots: {
      flower:  { label: "Flower", fixedMain: "hpPercent" },
      plume:   { label: "Plume",  fixedMain: "atkPercent" },
      sands:   { label: "Sands",  variableMain: ["atkPercent", "emPercent", "erPercent", "hpPercent", "defPercent"] },
      goblet:  { label: "Goblet", variableMain: ["elementDmg", "atkPercent", "hpPercent", "emPercent"] },
      circlet: { label: "Circlet",variableMain: ["critRate", "critDmg", "atkPercent", "hpPercent", "emPercent", "erPercent"] },
    },
    substats: {
      critRate:   { label: "CRIT Rate",     maxRoll: 0.072 },
      critDmg:    { label: "CRIT DMG",      maxRoll: 0.144 },
      atkPercent: { label: "ATK%",          maxRoll: 0.108 },
      emPercent:  { label: "EM",            maxRoll: 0.072 },
      erPercent:  { label: "ER%",           maxRoll: 0.108 },
      elementDmg:{ label: "Elemental DMG%", maxRoll: 0.108 },
      hpPercent:  { label: "HP%",           maxRoll: 0.108 },
      defPercent: { label: "DEF%",          maxRoll: 0.108 },
    },
    roleWeights: {
      dps:     { critRate: 1.0, critDmg: 1.0, atkPercent: 0.8, elementDmg: 0.9, emPercent: 0.3, erPercent: 0.2, hpPercent: 0.1, defPercent: 0.0 },
      support: { erPercent: 1.0, hpPercent: 0.6, emPercent: 0.5, critRate: 0.2, atkPercent: 0.3, elementDmg: 0.3, defPercent: 0.2 },
      healer:  { erPercent: 1.0, hpPercent: 0.9, critRate: 0.1, critDmg: 0.1, atkPercent: 0.1, defPercent: 0.3 },
    },
    sets: {
      crimson:  { label: "Crimson Witch", type: "relic", domain: "Crimson Domain",     bonus2: "Pyro DMG +15%",  bonus4: "Overload/Vaporize +15%" },
      gilded:   { label: "Gilded Dreams", type: "relic", domain: "Gilded Domain",     bonus2: "EM +80",         bonus4: "EM +14% / ATK +18%" },
      noblesse: { label: "Noblesse",      type: "relic", domain: "Noblesse Domain",   bonus2: "HP +20%",        bonus4: "Burst DMG +20%" },
    },
    characters: {
      diluc:  { label: "Diluc",  role: "dps",     element: "Pyro",    sets: ["crimson"],                wantedMain: { sands: ["atkPercent","emPercent"], goblet: ["elementDmg"], circlet: ["critRate","critDmg"] }, blurb: "Pyro DPS. CRIT circlet, Pyro goblet, ATK% sands." },
      nilou:  { label: "Nilou",  role: "support", element: "Hydro",   sets: ["noblesse"],              wantedMain: { sands: ["hpPercent","erPercent"], goblet: ["hpPercent","elementDmg"], circlet: ["hpPercent","critRate"] }, blurb: "Bloom support. HP% and ER heavy." },
      bennett:{ label: "Bennett",role: "healer",  element: "Pyro",    sets: ["noblesse"],              wantedMain: { sands: ["erPercent","hpPercent"], goblet: ["hpPercent","elementDmg"], circlet: ["hpPercent","critRate","erPercent"] }, blurb: "Healer/buffer. Energy Regen is king." },
    },
  },
};
