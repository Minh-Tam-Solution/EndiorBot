/**
 * Kimi Coding Provider Tests
 *
 * ADR-053: Primary kimi backend via CEO subscription.
 *
 * @module tests/providers/kimi-coding
 * @sprint 145
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KimiCodingProvider } from "../../../src/providers/kimi-coding/index.js";

describe("KimiCodingProvider", () => {
  let provider: KimiCodingProvider;

  beforeEach(() => {
    provider = new KimiCodingProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct provider metadata", () => {
    expect(provider.id).toBe("kimi-coding");
    expect(provider.name).toBe("Kimi Coding (CEO subscription)");
    // Subscription serves kimi-for-coding (K2.7, default) + k3 + k3-256k.
    expect(provider.models).toHaveLength(3);
    expect(provider.models[0]?.id).toBe("kimi-for-coding");
    expect(provider.models[0]?.contextWindow).toBe(256000);
    expect(provider.models.map((m) => m.id)).toEqual(["kimi-for-coding", "k3", "k3-256k"]);
  });

  it("should initialize with default endpoint", async () => {
    const initSpy = vi.spyOn(provider["inner"], "initialize").mockResolvedValue(undefined);

    await provider.initialize({ apiKey: "sk-test" });

    expect(initSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "sk-test",
        baseUrl: "https://api.kimi.com/coding",
        timeout: 60000,
      })
    );
  });

  it("should initialize with custom baseUrl", async () => {
    const initSpy = vi.spyOn(provider["inner"], "initialize").mockResolvedValue(undefined);

    await provider.initialize({ apiKey: "sk-test", baseUrl: "https://custom.kimi.com/v1" });

    expect(initSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "sk-test",
        baseUrl: "https://custom.kimi.com/v1",
      })
    );
  });

  it("should normalize non-coding model names to kimi-for-coding", async () => {
    const chatSpy = vi.spyOn(provider["inner"], "chat").mockResolvedValue({
      content: "test response",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });

    await provider.chat({
      model: "claude-sonnet-4",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(chatSpy).toHaveBeenCalledWith(
      expect.objectContaining({ model: "kimi-for-coding" })
    );
  });

  it("should pass through kimi-for-coding model name", async () => {
    const chatSpy = vi.spyOn(provider["inner"], "chat").mockResolvedValue({
      content: "test response",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });

    await provider.chat({
      model: "kimi-for-coding",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(chatSpy).toHaveBeenCalledWith(
      expect.objectContaining({ model: "kimi-for-coding" })
    );
  });

  it("should delegate healthCheck to inner provider", async () => {
    const healthSpy = vi
      .spyOn(provider["inner"], "healthCheck")
      .mockResolvedValue({ status: "healthy", latencyMs: 120 });

    const health = await provider.healthCheck();

    expect(health.status).toBe("healthy");
    expect(health.latencyMs).toBe(120);
  });

  it("should delegate dispose to inner provider", async () => {
    const disposeSpy = vi.spyOn(provider["inner"], "dispose").mockResolvedValue(undefined);

    await provider.dispose();

    expect(disposeSpy).toHaveBeenCalled();
  });
});
