<!-- status: SUPERSEDED — Sprint 144 Desktop app shipped -->
# Desktop Gap Analysis: ClawX vs EndiorBot

**Date**: 2026-02-26
**Status**: Sprint 49 - Desktop Testing Phase
**Priority**: P0 - Critical for Desktop MVP

---

## Executive Summary

After reviewing the original **ClawX** implementation and our current **EndiorBot Desktop**, we have identified significant gaps in functionality and user experience. While the WebSocket connection is now working (✅ port 18790 fixed), the **chat interface is incomplete** and missing critical features that make ClawX production-ready.

**Current Status**:
- ✅ WebSocket connection established (Desktop ↔ Gateway)
- ✅ JSON-RPC 2.0 protocol implemented
- ✅ Basic streaming works
- ❌ Chat UX is minimal (no markdown, no tool display, no sessions)
- ❌ Missing 50%+ features from ClawX

**Recommendation**: **Migrate ClawX UI components** to EndiorBot Desktop to achieve feature parity.

---

## Feature Comparison Matrix

| Feature | ClawX (Original) | EndiorBot Desktop | Gap | Priority |
|---------|------------------|-------------------|-----|----------|
| **Core Chat** |
| Streaming messages | ✅ Full | ✅ Basic | Medium | P0 |
| Markdown rendering | ✅ Full | ❌ Plain text | **Critical** | P0 |
| Code syntax highlighting | ✅ Yes | ❌ No | High | P1 |
| Auto-scroll | ✅ Smooth | ✅ Smooth | None | - |
| Message history | ✅ Persistent | ✅ In-memory only | Medium | P1 |
| **Advanced Features** |
| Session management | ✅ Multiple | ❌ Single session | **Critical** | P0 |
| Thinking toggle | ✅ Show/hide | ❌ No thinking | High | P1 |
| Tool use display | ✅ Real-time status | ❌ No display | **Critical** | P0 |
| File attachments | ✅ Upload files | ❌ No support | High | P2 |
| Image display | ✅ Inline images | ❌ No images | Medium | P2 |
| **User Experience** |
| Component library | ✅ shadcn/ui | ❌ Inline styles | High | P0 |
| Toolbar | ✅ ChatToolbar | ❌ No toolbar | Medium | P1 |
| Error handling | ✅ User-friendly | ✅ Basic | Medium | P1 |
| Loading states | ✅ Rich spinners | ✅ Basic dots | Low | P2 |
| **Settings & Config** |
| Provider management | ✅ Visual UI | ❌ No UI | High | P1 |
| Gateway controls | ✅ Start/stop | ❌ External only | Medium | P2 |
| Theme settings | ✅ Full | ✅ Basic | Low | P2 |
| Language (i18n) | ✅ EN/ZH | ❌ EN only | Low | P3 |
| **Additional Pages** |
| Skills management | ✅ Full page | ❌ No page | Medium | P2 |
| Cron jobs | ✅ Full page | ❌ No page | Low | P3 |
| Channels | ✅ Full page | ❌ No page | Low | P3 |
| **Architecture** |
| IPC communication | ✅ gateway:rpc | ✅ WebSocket | Different | - |
| State management | ✅ Zustand | ✅ Zustand | Same | - |
| Type safety | ✅ Full TS | ✅ Full TS | Same | - |

---

## Critical Missing Features (P0)

### 1. Markdown Rendering ❌ **CRITICAL**
**ClawX**: Uses `react-markdown` with syntax highlighting
```tsx
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
```

**EndiorBot**: Plain text only
```tsx
<p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
  {message.content}
</p>
```

**Impact**:
- Code blocks unreadable
- No formatting (bold, italic, lists)
- Poor developer experience

**Solution**: Import ClawX `ChatMessage.tsx` component

---

### 2. Tool Use Visualization ❌ **CRITICAL**
**ClawX**: Real-time tool status display
```tsx
<ToolStatus
  name="read_file"
  status="running"
  durationMs={1234}
/>
```

**EndiorBot**: No tool use display

**Impact**:
- User doesn't see what EndiorBot is doing
- No feedback during long operations
- Confusing UX (looks frozen)

**Solution**: Import ClawX tool visualization components

---

### 3. Session Management ❌ **CRITICAL**
**ClawX**: Multiple conversations
```tsx
<SessionSelector
  sessions={sessions}
  current={currentSessionKey}
  onSwitch={switchSession}
/>
```

**EndiorBot**: Single session only

**Impact**:
- Can't switch between projects
- No conversation history
- Lost context on restart

**Solution**: Import ClawX session management

---

### 4. Component Library ❌ **HIGH**
**ClawX**: Uses shadcn/ui (modern, accessible)
```tsx
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
```

**EndiorBot**: Inline styles (hard to maintain)
```tsx
<div style={{ padding: '12px', background: '#1a1a2e' }}>
```

**Impact**:
- Hard to maintain
- Inconsistent styling
- No accessibility features

**Solution**: Copy ClawX `/components/ui/` folder

---

## Architecture Differences

### Communication Protocol

| Aspect | ClawX | EndiorBot |
|--------|-------|-----------|
| **Transport** | Electron IPC (`gateway:rpc`) | WebSocket (`ws://localhost:18790`) |
| **Format** | JSON-RPC 2.0 | JSON-RPC 2.0 |
| **Security** | Process isolation | Token-based auth |

**Decision**: Keep WebSocket (more flexible for future web version)

---

### Store Structure

**ClawX** has rich stores:
```
stores/
├── chat.ts        # Messages, sessions, streaming
├── providers.ts   # AI provider config
├── channels.ts    # Telegram, WhatsApp, etc.
├── skills.ts      # Skill management
├── cron.ts        # Scheduled tasks
├── gateway.ts     # Gateway lifecycle
├── settings.ts    # User preferences
└── update.ts      # Auto-update
```

**EndiorBot** has minimal stores:
```
stores/
├── gateway.safe.ts   # WebSocket only
└── settings.safe.ts  # Basic settings
```

**Gap**: Missing chat, providers, channels, skills, cron stores

---

## Implementation Plan

### Phase 1: Core Chat UX (Sprint 50, Week 1)
**Goal**: Feature parity for chat experience

| Task | Effort | Priority |
|------|--------|----------|
| Copy shadcn/ui components from ClawX | 4h | P0 |
| Import ChatMessage.tsx (markdown rendering) | 2h | P0 |
| Import ChatToolbar.tsx | 1h | P0 |
| Create rich chat.ts store | 4h | P0 |
| Add tool use visualization | 3h | P0 |

**Total**: ~14 hours (2 days)

---

### Phase 2: Session Management (Sprint 50, Week 2)
**Goal**: Multi-conversation support

| Task | Effort | Priority |
|------|--------|----------|
| Implement session store | 3h | P0 |
| Add session selector UI | 2h | P0 |
| Persist sessions to disk | 2h | P1 |
| Add new session button | 1h | P1 |

**Total**: ~8 hours (1 day)

---

### Phase 3: Advanced Features (Sprint 51)
**Goal**: File attachments, images, thinking

| Task | Effort | Priority |
|------|--------|----------|
| File attachment UI | 4h | P2 |
| Image display in messages | 2h | P2 |
| Thinking toggle | 2h | P1 |
| Provider settings UI | 3h | P1 |

**Total**: ~11 hours (1.5 days)

---

### Phase 4: Additional Pages (Sprint 52+)
**Goal**: Skills, Cron, Channels

| Task | Effort | Priority |
|------|--------|----------|
| Skills page | 6h | P2 |
| Cron page | 4h | P3 |
| Channels page | 4h | P3 |

**Total**: ~14 hours (2 days)

---

## Migration Strategy

### Option A: Full Port (Recommended)
**Approach**: Copy ClawX components → Adapt to WebSocket protocol

**Pros**:
- ✅ Proven UX
- ✅ Complete feature set
- ✅ Minimal design work

**Cons**:
- ❌ Need to adapt IPC → WebSocket
- ❌ ~40 hours work

**Timeline**: 5-6 days (Sprint 50)

---

### Option B: Incremental Build
**Approach**: Build features one by one from scratch

**Pros**:
- ✅ Full control
- ✅ WebSocket-native

**Cons**:
- ❌ Reinvent the wheel
- ❌ ~80 hours work
- ❌ Bugs to discover

**Timeline**: 10-12 days (Sprint 50-51)

---

### Option C: Hybrid (Minimal Viable)
**Approach**: Copy only P0 features (markdown, tools, sessions)

**Pros**:
- ✅ Faster than Option A
- ✅ Gets us to MVP

**Cons**:
- ❌ Incomplete feature set
- ❌ Will need Phase 3-4 later

**Timeline**: 3-4 days (Sprint 50)

---

## Recommendation

**Choose Option A: Full Port**

**Rationale**:
1. ClawX is production-ready and battle-tested
2. User expectations are set by ClawX
3. 5-6 days is acceptable for Sprint 50
4. Avoids reinventing the wheel
5. Gets us to full feature parity

**Next Steps**:
1. ✅ Read this analysis
2. 📋 Approve Option A
3. 🛠️ Start Phase 1 migration
4. 🧪 Test after each phase

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| IPC → WebSocket breaking changes | Medium | High | Map IPC calls to WebSocket messages |
| UI bugs during port | Low | Medium | Test incrementally |
| State management conflicts | Low | Low | Zustand already used |
| Performance issues | Low | Medium | Profile after migration |
| User confusion during transition | Medium | Low | Keep old version available |

---

## Success Metrics

After Phase 1 (Sprint 50 Week 1):
- [ ] Markdown renders correctly in chat
- [ ] Tool use displays real-time status
- [ ] Code blocks have syntax highlighting
- [ ] Error messages are user-friendly

After Phase 2 (Sprint 50 Week 2):
- [ ] Can switch between multiple sessions
- [ ] Session history persists on restart
- [ ] Can create new sessions
- [ ] Session labels are editable

After Full Migration (End Sprint 50):
- [ ] Feature parity with ClawX
- [ ] All P0 + P1 features working
- [ ] User can chat without friction
- [ ] Desktop feels production-ready

---

## Appendix: File Structure Comparison

### ClawX (Target)
```
src/
├── components/
│   ├── ui/                    # shadcn/ui components (20+ files)
│   ├── layout/                # TitleBar, Sidebar, MainLayout
│   ├── settings/              # Provider, Update settings
│   └── common/                # StatusBadge, ErrorBoundary, etc.
├── pages/
│   ├── Chat/                  # ChatMessage, ChatInput, ChatToolbar
│   ├── Dashboard/
│   ├── Settings/
│   ├── Skills/
│   ├── Cron/
│   ├── Channels/
│   └── Setup/
├── stores/                    # 8 Zustand stores
├── lib/                       # Utils, providers
└── i18n/                      # EN, ZH translations
```

### EndiorBot Desktop (Current)
```
src/
├── components/
│   └── ui/                    # 3 basic components (Card, Badge, Button)
├── pages/
│   ├── Dashboard.tsx
│   ├── ChatSimple.tsx
│   └── Settings (inline)
└── stores/
    ├── gateway.safe.ts
    └── settings.safe.ts
```

**Gap**: Missing ~80% of ClawX structure

---

*Analysis prepared by @pm (SOUL-pm.md)*
*Sprint 49 - Desktop Gap Analysis*
*SDLC Framework v6.4.0*
