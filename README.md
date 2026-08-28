# Coartifex

A gacha relic co-pilot built for **people and their agents**. You paste the relics
you pulled, and Coartifex scores them, suggests a build, and tells you which
domain to farm next. Because it exposes **WebMCP** tools, an AI agent (ChatGPT's
in-app browser, or Chrome with WebMCP enabled) can do all of that *with* you, in
the same page, while you stay in control of every save.

This is a real, usable companion for any gacha that follows the familiar
relic/artifact model (Honkai: Star Rail, Genshin Impact, and others through
imported profiles). It runs entirely in your browser: no account, no server, no
upload of your account data.

## Why WebMCP is the right fit

Gacha players describe relic farming as "hell": weeks of RNG for one usable piece,
spreadsheets to decide keep vs feed, and constant "is this piece good?" questions.
The pain is exactly the kind WebMCP targets:

- **Structured tools instead of UI guessing.** An agent calls `evaluate_relic`,
  `suggest_build`, `plan_farm_route`, and `recommend_wishes` with typed inputs,
  not by scraping the DOM and clicking.
- **People and agents share one surface.** The human adds relics and approves;
  the agent reasons over them and explains tradeoffs in plain language.
- **Human-in-the-loop for anything destructive.** Saving a loadout is a two-step
  `save_loadout` (stages a token) then `confirm_loadout` (commits only after the
  human approves in the UI). The agent can never silently write your loadout.
- **Read-only by default.** Five of seven tools are marked `readOnlyHint: true`;
  only the save/confirm pair mutate state, and only behind confirmation.

## The tools

| Tool | Read-only | What it does |
| --- | --- | --- |
| `describe_game` | yes | Lists slots, stats, sets, characters of the active profile |
| `evaluate_relic` | yes | Scores a relic and names its best-fitting characters |
| `suggest_build` | yes | Picks the best relics per slot and estimates set bonus + DPS |
| `plan_farm_route` | yes | Recommends which domain to farm for a character's set |
| `recommend_wishes` | yes | Pity math: can you guarantee the banner? |
| `save_loadout` | no | Stages a loadout, returns a confirmation token |
| `confirm_loadout` | no | Commits a staged loadout after human approval |

## Verifiable by construction

WebMCP puts an agent in the page, so Coartifex is built to keep the human in
control of every state change:

- **Session receipts.** Every tool call, whether from the human or the agent, is
  logged as a receipt: tool name, inputs, outcome, and (for mutating actions)
  whether it was approved or rejected. Export the whole log as JSON anytime.
- **Gate before write.** `save_loadout` only stages a change; `confirm_loadout`
  commits it after the human approves in the UI. The agent can never silently
  write your loadout.
- **Owner-controlled lock.** A "Lock saving" switch revokes the agent's ability to
  save at all. Turn it on and every mutating call is refused.

All of it stays local: the receipt log is in the browser and exportable as JSON,
never uploaded. That is what makes pointing an agent at your relics safe.

## Run it locally

```bash
# from this folder
python3 -m http.server 8080
# open http://localhost:8080
```

To let an agent drive it from Chrome, enable the flag:

1. Visit `chrome://flags/#enable-webmcp-testing`
2. Set it to **Enabled** and relaunch.
3. Open the page, then use the Model Context Tool Inspector extension (or an
   agent in ChatGPT's in-app browser) to call the tools.

The app also works fully by hand: the Advisor buttons call the same engine the
agent uses.

## Deploy

It is a static site. Deploy the folder to Cloudflare Pages, Vercel, Netlify,
GitHub Pages, or ChatGPT Sites. No build step, no backend. The `_headers` file
keeps the `tools` Permissions-Policy at its default (`self`) and origin
isolation intact, which WebMCP requires.

## Make it your game

Coartifex is profile-driven. It ships with HSR-style and Genshin-style
profiles. To support any other gacha, paste a profile JSON in the UI:

```json
{
  "id": "mygame",
  "label": "My Game",
  "slots": { "head": { "label": "Head", "fixedMain": "hpPercent" }, "...": {} },
  "substats": { "critRate": { "label": "CRIT Rate", "maxRoll": 0.072 } },
  "roleWeights": { "dps": { "critRate": 1.0 } },
  "sets": { "setA": { "label": "Set A", "type": "relic", "domain": "Some Cavern", "bonus2": "+x", "bonus4": "+y" } },
  "characters": { "hero": { "label": "Hero", "role": "dps", "element": "Fire", "sets": ["setA"], "wantedMain": { "body": ["critRate"] }, "blurb": "..." } }
}
```

The scoring engine reads only the profile, so a new game needs no code changes.

## Demo video

Record a public, under-3-minute demo: show the WebMCP status badge go active, add
a few relics, click Suggest build and Plan farm, then in the WebMCP inspector call
`evaluate_relic` and `save_loadout` and approve the staged change in the UI. No
account or upload is needed.

## License

MIT. See `LICENSE`.
