/**
 * CRG Client — HTTP client for AI-Platform code-review-graph tools.
 *
 * EndiorBot uses this to query CRG for TARGET repos (Bflow, VideoLingo, etc.),
 * NOT for its own codebase. EndiorBot = platform to develop other apps.
 *
 * @module graph/client
 * @version 1.0.0
 * @date 2026-04-07
 * @status ACTIVE — Sprint 131
 * @authority ADR-045 Code Knowledge Graph Client
 * @sdlc SDLC Framework 6.4.0
 */

// ============================================================================
// Types
// ============================================================================

export interface CRGConfig {
  /** AI-Platform MCP endpoint */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Timeout in ms (default: 15000) */
  timeout?: number;
}

export interface CRGImpactResult {
  changed_files: string[];
  affected_files: string[];
  affected_count: number;
  blast_radius: number;
}

export interface CRGSymbolResult {
  query: string;
  results: Array<{
    id: number;
    name: string;
    kind: string;
    file_path: string;
    qualified_name: string;
    line_start?: number;
    line_end?: number;
  }>;
}

export interface CRGArchitectureResult {
  total_nodes: number;
  total_edges: number;
  node_types: Record<string, number>;
  top_directories: string[];
}

export interface CRGStatusResult {
  status: string;
  node_count?: number;
  edge_count?: number;
  last_build_at?: string;
  days_since_build?: number;
  error?: string;
}

export interface CRGAffectedFlowsResult {
  affected_test_count: number;
  affected_tests: string[];
}

export interface CRGReviewContextResult {
  symbols: Array<{ name: string; kind: string; line_start: number }>;
  dependents: string[];
  dependent_count: number;
}

interface CRGResponse<T> {
  result: T | { error: string };
  metadata: { tool: string; latency_ms: number };
  is_error: boolean;
  error: string | null;
}

// ============================================================================
// CRG Client
// ============================================================================

export class CRGClient {
  private config: CRGConfig;

  constructor(config?: Partial<CRGConfig>) {
    this.config = {
      baseUrl: config?.baseUrl ?? process.env.AI_PLATFORM_URL ?? "https://api.endior.net",
      apiKey: config?.apiKey ?? process.env.AI_PLATFORM_API_KEY ?? process.env.MTCLAW_API_KEY ?? "",
      timeout: config?.timeout ?? 15000,
    };
  }

  /** Check if CRG client is configured (has API key) */
  isAvailable(): boolean {
    return this.config.apiKey.length > 0;
  }

  /** Get graph build status for a repo */
  async graphStatus(repoId: string): Promise<CRGStatusResult> {
    return this.call<CRGStatusResult>("crg_graph_status", { repo_id: repoId });
  }

  /** Get blast radius for changed files */
  async impactRadius(repoId: string, changedFiles: string[]): Promise<CRGImpactResult> {
    return this.call<CRGImpactResult>("crg_impact_radius", {
      repo_id: repoId,
      changed_files: changedFiles,
    });
  }

  /** Find a symbol (class, function, type) by name */
  async findSymbol(repoId: string, query: string): Promise<CRGSymbolResult> {
    return this.call<CRGSymbolResult>("crg_find_symbol", {
      repo_id: repoId,
      query,
    });
  }

  /** Get architecture overview of a repo */
  async architectureOverview(repoId: string): Promise<CRGArchitectureResult> {
    return this.call<CRGArchitectureResult>("crg_architecture_overview", {
      repo_id: repoId,
    });
  }

  /** Get affected test flows for changed files */
  async affectedFlows(repoId: string, changedFiles: string[]): Promise<CRGAffectedFlowsResult> {
    return this.call<CRGAffectedFlowsResult>("crg_affected_flows", {
      repo_id: repoId,
      changed_files: changedFiles,
    });
  }

  /** Get review context (symbols + dependents) for a file */
  async reviewContext(repoId: string, filePath: string): Promise<CRGReviewContextResult> {
    return this.call<CRGReviewContextResult>("crg_review_context", {
      repo_id: repoId,
      file_path: filePath,
    });
  }

  // ==========================================================================
  // Private
  // ==========================================================================

  private async call<T>(toolName: string, args: Record<string, unknown>): Promise<T> {
    const url = `${this.config.baseUrl}/mcp/call`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.config.apiKey,
        },
        body: JSON.stringify({ tool_name: toolName, arguments: args }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`CRG API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as CRGResponse<T>;

      if (data.is_error || data.error) {
        throw new Error(data.error ?? "CRG tool error");
      }

      const result = data.result;
      if (result && typeof result === "object" && "error" in result) {
        throw new Error((result as { error: string }).error);
      }

      return result as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let _client: CRGClient | null = null;

export function getCRGClient(): CRGClient {
  if (!_client) _client = new CRGClient();
  return _client;
}

/**
 * Format CRG impact result for agent context injection (500-token cap).
 */
export function formatImpactForContext(impact: CRGImpactResult): string {
  const lines = [
    `Blast radius: ${impact.blast_radius} affected files`,
    `Changed: ${impact.changed_files.join(", ")}`,
    `Affected: ${impact.affected_files.slice(0, 10).join(", ")}`,
  ];
  if (impact.affected_files.length > 10) {
    lines.push(`... and ${impact.affected_files.length - 10} more`);
  }
  return lines.join("\n").slice(0, 2000); // ~500 tokens
}
