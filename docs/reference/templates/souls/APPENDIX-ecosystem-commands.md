# APPENDIX: Ecosystem Commands Reference

> **SSOT** for all SOUL templates. When you need build/test/lint commands,
> detect the ecosystem from marker files and use the corresponding commands.
> Do NOT hardcode `pnpm`, `npm`, or any specific tool.

## Detection Table

| Marker File | Ecosystem | Install | Build | Test | Lint |
|-------------|-----------|---------|-------|------|------|
| `package.json` | Node.js | `{pm} install` | `{pm} build` | `{pm} test` | `{pm} lint` |
| `go.mod` | Go | `go mod download` | `go build ./...` | `go test ./...` | `golangci-lint run` |
| `Cargo.toml` | Rust | — | `cargo build` | `cargo test` | `cargo clippy` |
| `requirements.txt` / `pyproject.toml` | Python | `pip install -r requirements.txt` | — | `pytest` | `ruff check .` |
| `pubspec.yaml` | Dart/Flutter | `flutter pub get` | `flutter build` | `flutter test` | `dart analyze` |
| `pom.xml` / `build.gradle` | Java/Kotlin | `mvn install` / `gradle build` | `mvn package` / `gradle build` | `mvn test` / `gradle test` | — |
| `Dockerfile` | Docker | — | `docker build .` | — | `hadolint Dockerfile` |

**`{pm}`** = detected package manager: `pnpm` if `pnpm-lock.yaml`, `yarn` if `yarn.lock`, `bun` if `bun.lock`, `npm` otherwise.

## Usage in SOULs

```markdown
## Build & Test

Detect the project ecosystem from marker files (see APPENDIX-ecosystem-commands.md).
Use `endiorbot ops build` when available, or run the ecosystem-specific commands directly.

If no marker file is found, ask the user for their build/test commands before proceeding.
```

## Anti-Patterns (binding — from MTClaw SSOT §7)

1. NEVER hardcode language assumptions ("Write TypeScript/JavaScript/Python code")
2. NEVER hardcode a single tool (`pnpm test`, `pnpm build`, `pnpm lint`)
3. NEVER replace one hardcode with another ("Go/Dart only")
4. NEVER add `if language == "X"` branches in agent reasoning
5. NEVER duplicate this table into SOUL body text — reference this appendix

## Fallback

If `endiorbot ops` is unavailable and no marker file is detected:
1. Check for `Makefile` → use `make build`, `make test`
2. Check for `justfile` → use `just build`, `just test`
3. Ask the user: "What commands do you use to build and test this project?"

## Source

- EndiorBot: `src/cli/commands/ecosystem-detector.ts` — `detectEcosystem()` + `getEcosystemCommands()`
- Cross-product: MTClaw `docs/02-design/multi-stack-project-detection.md` (upstream SSOT)
