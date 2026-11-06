# AI Coding-Agent Skills

This project ships with a local collection of [Agent Skills](https://agentskills.io) repositories so that coding agents (Claude Code, Cline, Codex, Cursor, and 20+ others) can discover and use them when working on this codebase.

## What's included

Nine third-party repositories were cloned:

| # | Repository | Skills | Purpose |
|---|-----------|--------|---------|
| 1 | [morluto/rea](https://github.com/morluto/rea) | 5 | Reverse-engineering agents (native analysis, static analysis, Ghidra, decompilation) |
| 2 | [microsoft/playwright](https://github.com/microsoft/playwright) | 7 | Playwright web testing/automation development guide |
| 3 | [upstash/context7](https://github.com/upstash/context7) | 3 | Context7 MCP — up-to-date library documentation for agents |
| 4 | [supabase/agent-skills](https://github.com/supabase/agent-skills) | 2 | Official Supabase agent skills (core Supabase + Postgres best practices) |
| 5 | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | 5 | Official Vercel skills (Optimize, React best practices, View Transitions, Deploy claimable, Composition patterns) |
| 6 | [obra/superpowers](https://github.com/obra/superpowers) | 15 | Agentic skills framework & SDLC methodology (planning, debugging, testing, collaboration) |
| 7 | [anthropics/skills](https://github.com/anthropics/skills) | 20 | Anthropic's public agent skills (document editing, design, API, creative) |
| 8 | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 10 | UI/UX design intelligence across platforms |
| 9 | [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) | 818 | Cybersecurity skills mapped to MITRE ATT&CK, NIST CSF 2.0, MITRE ATLAS, D3FEND, NIST AI RMF & MITRE F3 |

**Total: 885 skills** (+ 5 companion `.zip` archives).

## Location

- Full cloned repos: `.claude/skills/` (396 MB)
- Skills-only mirror (for agent discovery): `.agents/skills/` (75 MB)
- Index: `.agents/skills/SKILLS.md`

## Licensing

Each skill keeps its upstream license (MIT, Apache-2.0, etc.). This local collection is for agent use only and is git-ignored — it is not part of the versioned project.

## Adding more skills

```bash
# 1. Clone a repo
git clone --depth 1 https://github.com/<owner>/<repo> .claude/skills/<name>

# 2. Mirror its skills folder into .agents/skills/
#    (path varies: some repos use skills/, some .claude/skills/, some .agents/skills/)
cp -r .claude/skills/<name>/skills/. .agents/skills/   # or <repo>/.claude/skills/.
cp -r .claude/skills/<name>/.agents/skills/. .agents/skills/  # if applicable

# 3. Update .agents/skills/SKILLS.md with the new source and count
```

Then ask your agent to "add <repo-name> to the skills collection" — the `writing-skills` / skill-discovery skills can help automate verification.

## Note on the Tamera project's existing agent setup

This project already uses the agentic workflow:
- `Agent.md` — the full product/build prompt for the project
- `.superpowers/` — Sub-agent-driven-development (SDD) plan workspace
- `docs/superpowers/plans/` — recorded implementation plans
- `docs/DECISIONS.md` — architectural decisions
- `docs/AUDIT.md` — phased audit report
- `e2e/order-journey.spec.ts` — Playwright e2e test

The skill collection above complements that existing setup by giving agents authoritative documentation and reference material when implementing, debugging, and hardening this codebase.
