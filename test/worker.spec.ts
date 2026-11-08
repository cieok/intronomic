import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("Cloudflare KV Local Testing", () => {
  it("successfully writes and reads values from KV", async () => {
    // Write a key-value pair to your local KV binding
    await env.KV.put("test_key", "Hello, Cloudflare KV!");

    // Read the value back
    const value = await env.KV.get("test_key");

    // Assert that the value matches
    expect(value).toBe("Hello, Cloudflare KV!");
  });

  it("returns null for non-existent keys", async () => {
    const missingValue = await env.KV.get("non_existent_key");
    expect(missingValue).toBeNull();
  });
});