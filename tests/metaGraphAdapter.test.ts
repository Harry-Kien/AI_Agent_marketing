import { describe, expect, it, vi } from "vitest";
import { createMetaGraphClient, createMetaGraphConfig } from "../src/integrations/metaGraphAdapter";

describe("guarded Meta Graph adapter", () => {
  it("builds a read-only client without putting the token in the URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "123", name: "AI SME" }) });
    const client = createMetaGraphClient(createMetaGraphConfig({ META_PAGE_ID: "123", META_PAGE_ACCESS_TOKEN: "top-secret", META_GRAPH_API_VERSION: "v23.0" }), fetchMock);
    expect(await client.checkPageIdentity()).toEqual({ id: "123", name: "AI SME" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://graph.facebook.com/v23.0/123?fields=id%2Cname");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("top-secret");
  });

  it("hard-blocks publication unless flag, approval and exact preview are present", async () => {
    const fetchMock = vi.fn();
    const disabled = createMetaGraphClient(createMetaGraphConfig({ META_PAGE_ID: "123", META_PAGE_ACCESS_TOKEN: "secret" }), fetchMock);
    await expect(disabled.publish({ message: "Hello", approvalId: "APR-1", confirmationText: "Hello" })).rejects.toThrow(/disabled/i);
    const enabled = createMetaGraphClient(createMetaGraphConfig({ META_PAGE_ID: "123", META_PAGE_ACCESS_TOKEN: "secret", META_PUBLISH_ENABLED: "true" }), fetchMock);
    await expect(enabled.publish({ message: "Hello", approvalId: "", confirmationText: "Hello" })).rejects.toThrow(/approval/i);
    await expect(enabled.publish({ message: "Hello", approvalId: "APR-1", confirmationText: "Different" })).rejects.toThrow(/preview/i);
  });

  it("publishes only confirmed content and returns evidence", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "123_456" }) });
    const client = createMetaGraphClient(createMetaGraphConfig({ META_PAGE_ID: "123", META_PAGE_ACCESS_TOKEN: "secret", META_PUBLISH_ENABLED: "true" }), fetchMock);
    expect((await client.publish({ message: "Approved", approvalId: "APR-1", confirmationText: "Approved" })).postId).toBe("123_456");
  });
});
