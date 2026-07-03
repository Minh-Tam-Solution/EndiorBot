# Problem Statement

**Project:** EndiorBot
**Version:** 2.0.0
**Date:** 2026-02-28
**Author:** CEO/Solo Developer
**SDLC Stage:** 00-FOUNDATION
**Identity:** Solo Developer Power Tool (LOCKED)

---

## Executive Summary

> **EndiorBot is a Solo Developer Power Tool**
> Not a platform. Not an SDLC enforcer. Not an enterprise product.

**One Sentence**: Help developers get AI-assisted answers in <30s instead of 30-60 min.

EndiorBot addresses the inefficiency of solo developers managing enterprise-scale projects (~1M LOC) by eliminating copy/paste between AI apps through automated multi-model consultation (5 providers: Anthropic, OpenAI, Gemini, Kimi, Ollama).

---

## Problem Definition

### Current State (Pain Points)

```
┌─────────────────────────────────────────────────────────────────────┐
│                 Solo Developer's Current Workflow                    │
│                                                                     │
│   ┌──────────────┐                                                  │
│   │ Claude Code  │ ◄── PRIMARY: Development, coding                │
│   │   (VSCode)   │                                                  │
│   └──────┬───────┘                                                  │
│          │ Manual copy/paste                                        │
│          ▼                                                          │
│   ┌──────────────┐  ┌──────────────┐                               │
│   │   Cursor     │  │GitHub Copilot│ ◄── CPO/CTO support           │
│   └──────┬───────┘  └──────┬───────┘                               │
│          │ Manual copy/paste                                        │
│          ▼                                                          │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │   ChatGPT    │  │   Gemini     │  │  Claude AI   │             │
│   │  (Expert 1)  │  │  (Expert 2)  │  │  (Expert 3)  │             │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│          │                 │                 │                      │
│          └─────────────────┼─────────────────┘                      │
│                            │ Manual consolidate                     │
│                            ▼                                        │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │              CEO Decision                                    │   │
│   │  • Review multiple expert opinions                          │   │
│   │  • Consolidate manually                                     │   │
│   │  • Approve plan/design                                      │   │
│   │  • Go back to Claude Code to implement                      │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   Pain Points:                                                      │
│   ❌ Open multiple apps (Claude Code, Cursor, ChatGPT, Gemini...)  │
│   ❌ Copy/paste prompts and responses between apps                 │
│   ❌ Multiple rounds back and forth                                │
│   ❌ Manually consolidate expert opinions                          │
│   ❌ Context lost between apps                                     │
│   ❌ Time-consuming (30-60 min per decision)                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Pain Points

| # | Pain Point | Impact | Frequency |
|---|------------|--------|-----------|
| 1 | Multi-app context switching | Lost context, mental fatigue | Daily |
| 2 | Manual copy/paste between AI tools | Time waste, error-prone | 10+ times/day |
| 3 | No automated SDLC compliance | Manual tracking, missed gates | Every feature |
| 4 | Manual expert opinion consolidation | Decision delays | Every architecture decision |
| 5 | Project context switching overhead | 5+ min per switch | Multiple times/day |

### Quantified Impact (Per Master Plan v2.0)

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Decision time | 30-60 min | <30s | **98%** |
| Context switch | 5 min | <2s | **99%** |
| Gate status | 20 min | At a glance | **95%** |
| Copy/paste between apps | 10+ times/day | 0 | **100%** |

---

## Target Users

### Primary User: Solo Developer

**Profile:**
- Single developer managing enterprise-scale codebases
- Multiple local projects of varying sizes (~200K–1M+ LOC)
- Uses multiple AI tools daily
- Needs to maintain SDLC compliance across all projects

**Goals:**
- Reduce time spent on tooling overhead
- Automate SDLC compliance tracking
- Get consolidated expert opinions without manual effort
- Quick context switching between projects

### Secondary Users: Junior Developers (1-2)

**Profile:**
- On-job training developers
- Mentored by CEO + AI
- Limited permissions (sandbox)

**Goals:**
- Learn best practices through AI assistance
- Safe environment for experimentation
- Clear task assignments and feedback

---

## Constraints

| Constraint | Description |
|------------|-------------|
| Solo developer focus | Not enterprise team features |
| Lightweight infrastructure | No heavy DB, Redis, MinIO |
| TypeScript ecosystem | Must integrate with Claude Code |
| SDLC Framework v6.4.0 | Must be compliant |

---

## Success Criteria (Per Master Plan v2.0)

| Metric | Target | Tier |
|--------|--------|------|
| Decision time | <30s (not 30-60 min) | MVP |
| Context switch | <2s | MVP |
| No copy/paste | 0 app switches | MVP |
| Gate status | At a glance | MVP |
| Session resume | No context loss | Pro |
| Context drift | <5% re-explanations | Pro |

---

## MVP Scope (Tier 1)

```bash
endiorbot consult "<question>"  # 2 models, primary_with_notes
endiorbot gate status G2        # Read-only checklist
endiorbot switch <project>      # Minimal context
```

---

## References

- [Master Plan v2.0](./master-plan.md) - Identity & roadmap
- [SDLC Framework v6.4.0](/.sdlc-framework)

---

*Solo Developer Power Tool | SDLC Framework v6.4.0 - Stage 00: Foundation*
*Identity: LOCKED (2026-02-28) — Updated Sprint 144 (2026-04-27)*
