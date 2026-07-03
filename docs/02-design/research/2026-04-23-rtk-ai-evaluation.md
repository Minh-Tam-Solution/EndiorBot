---
project: EndiorBot
date: 2026-04-23
researcher: "@architect"
topic: "RTK (rtk-ai/rtk) — Token compression proxy for LLM CLI tools"
status: "Completed"
---

# RTK Evaluation for EndiorBot

## Executive Summary

**RTK is NOT a model orchestrator.** It is a CLI output filter/compressor written in Rust that reduces token consumption by 60-90% on common dev commands. It operates at the **shell command layer**, not the **LLM API layer**.

| Aspect | Expectation | Reality |
|--------|-------------|---------|
| Model routing | Route between Kimi/OpenAI/Anthropic | ❌ Not supported |
| Cost optimization | Smart model selection by price | ❌ Not supported |
| Token reduction | Compress LLM output | ❌ Compresses **CLI output** before it reaches LLM |
| API caching | Cache repeated API calls | ❌ Not supported |
| Integration | HTTP middleware / provider wrapper | ❌ Bash hook / CLI proxy |

## What RTK Actually Does

RTK installs a bash hook that transparently rewrites commands:

```
Before:  git status          → 2,000 tokens
After:   rtk git status      →   200 tokens (-90%)
```

**Four strategies:**
1. **Smart Filtering** — Removes noise (comments, whitespace, boilerplate)
2. **Grouping** — Aggregates similar items (files by directory, errors by type)
3. **Truncation** — Keeps relevant context, cuts redundancy
4. **Deduplication** — Collapses repeated log lines with counts

**Supported commands:** 100+ (git, cargo, npm, docker, kubectl, pytest, ruff, eslint, etc.)

## Architecture

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────────┐
│  Claude Code    │────▶│  RTK Hook   │────▶│  git status     │
│  (Bash tool)    │     │  (rewrite)  │     │  (raw output)   │
└─────────────────┘     └──────┬──────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │  Filter     │
                        │  Compress   │
                        │  Deduplicate│
                        └──────┬──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │  ~200 tokens│
                        │  (to LLM)   │
                        └─────────────┘
```

**Hook mechanism:** `PreToolUse` intercepts bash commands before execution.

## Integration with EndiorBot

### Scenario 1: Claude Code Bridge (Primary)
- **Status:** Already integrated at the source
- **Explanation:** CEO runs Claude Code CLI directly. If CEO installs `rtk init -g`, RTK hooks into Claude Code's bash tool at the CLI level. EndiorBot không cần làm gì.
- **Value:** High (for CEO's direct Claude Code usage)

### Scenario 2: Kimi CLI (Fallback)
- **Status:** Potentially applicable
- **Explanation:** If Kimi CLI có bash tool support (tương tự Claude Code), RTK có thể hook. Cần verify.
- **Value:** Medium

### Scenario 3: API Providers (kimi-api, openai)
- **Status:** NOT applicable
- **Explanation:** API providers gọi trực tiếp HTTP API. Không có bash command flow → RTK không can thiệp được.
- **Value:** Zero

### Scenario 4: EndiorBot Internal Shell Commands
- **Status:** Applicable if EndiorBot spawn shell commands
- **Explanation:** Nếu EndiorBot agents (e.g., `@devops`) spawn `git status`, `cargo test`, `docker ps` và gửi output đến LLM, wrapping với `rtk` giảm tokens.
- **Value:** Medium (depends on agent behavior)

## Strengths

| Strength | Detail |
|----------|--------|
| **Proven savings** | 60-90% token reduction on common commands |
| **Zero config** | `rtk init -g` auto-installs hook |
| **Transparent** | Commands rewritten silently; LLM không biết |
| **Single binary** | Rust, ~10ms overhead |
| **Undoable** | `rtk init -g --uninstall` removes everything |
| **MIT License** | Free, open source |

## Risks

| Risk | Severity | Detail |
|------|----------|--------|
| **Pre-1.0** | Medium | `0.37.2` — API và hook format có thể thay đổi |
| **Young project** | Medium | 3 tháng tuổi, long-term maintenance chưa proven |
| **Small team** | Low | 3 core contributors |
| **656 open issues** | Low | Growth nhanh nhưng nhiều bug |
| **Scope mismatch** | High | Không phải model orchestrator — không giải quyết bài toán EndiorBot |

## Comparison: RTK vs. True Model Orchestrators

| Feature | RTK | LiteLLM | Portkey | EndiorBot's `providers/` |
|---------|-----|---------|---------|--------------------------|
| Model routing | ❌ | ✅ | ✅ | ✅ |
| Fallback chains | ❌ | ✅ | ✅ | ✅ |
| Cost tracking | Telemetry only | ✅ | ✅ | ✅ |
| API caching | ❌ | ✅ | ✅ | ❌ |
| Token compression | ✅ (CLI output) | ❌ | ❌ | ❌ |
| Multi-provider | ❌ | ✅ | ✅ | ✅ |
| Retry logic | ❌ | ✅ | ✅ | ✅ |

## Recommendation

### @pm Assessment

**RTK does NOT solve EndiorBot's model orchestration or cost optimization needs.**

- **Model orchestration:** EndiorBot đã có `src/providers/init.ts` + `src/agents/router/providers.ts` quản lý fallback chain (Claude Code → Kimi API → Kimi OAuth → OpenAI → Ollama). RTK không cung cấp model routing.
- **Cost optimization:** RTK giảm tokens cho CLI output, không giảm API call cost. Để optimize chi phí cloud LLMs, cần caching (Redis), smart model selection (route simple tasks to cheaper models), và request batching — RTK không làm được.

**Where RTK adds value:**
- CEO's local Claude Code workflow (already handled by `rtk init -g` at CLI level)
- Future: nếu EndiorBot agents spawn shell commands và cần compress output

**Verdict:** RTK là một **developer tool hữu ích** nhưng **không phải dependency của EndiorBot**. Không cần tích hợp vào codebase. CEO có thể cài `rtk` riêng cho Claude Code CLI nếu muốn.

### @architect Assessment

**No integration needed.** RTK operates at a different abstraction layer:

```
Layer 1: LLM API calls      ← EndiorBot providers/ (orchestration here)
Layer 2: AI agent tools     ← EndiorBot agents/
Layer 3: Shell commands     ← RTK operates here (bash hook)
```

If EndiorBot ever builds its own shell command execution layer (agents spawn `git status`, `cargo test`, etc.), RTK có thể được evaluate lại. Hiện tại, tất cả shell commands đi qua Claude Code Bridge hoặc Kimi CLI — RTK hook vào đó ở CLI level, không cần EndiorBot code changes.

---

*EndiorBot | Research Note | SDLC 6.4.0*
