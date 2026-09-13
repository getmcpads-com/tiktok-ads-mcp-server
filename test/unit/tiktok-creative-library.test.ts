import { afterEach, describe, expect, it, vi } from "vitest";
import { collect } from "./catalogue";
import { TikTokClient } from "../../src/platforms/tiktok/client";

/** Synthetic TikTok v1.3 creative-library fixtures; all provider calls are mocked. */

const CONFIG = { accessToken: "test-token" } as const;

type ToolResult = { content: [{ type: "text"; text: string }]; isError?: boolean };

function tiktokTool(name: string) {
  const tool = collect("tiktok_ads", CONFIG).find((t) => t.name === name);
  if (!tool) throw new Error(`tool ${name} introuvable dans le registre tiktok_ads`);
  return tool;
}

function parsePayload(result: ToolResult): Record<string, unknown> {
  expect(result.isError).not.toBe(true);
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

function tiktokResponse(data: unknown, code = 0, message = "OK"): Response {
  return new Response(JSON.stringify({ code, message, request_id: "req-1", data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function lastFetchUrl(fetchMock: ReturnType<typeof vi.fn>): URL {
  const calls = fetchMock.mock.calls;
  return new URL(String(calls[calls.length - 1]?.[0]));
}

const VIDEO_ROW = {
  video_id: "video-fixture-001",
  material_id: "7000000000000000001",
  file_name: "fixture-video.mp4",
  duration: 38.75,
  width: 1080,
  height: 1920,
  size: 13202208,
  bit_rate: 2725617,
  format: "mp4",
  signature: "fixture-video-signature",
  displayable: true,
  allow_download: true,
  preview_url: "https://v16-tt4b.tiktokcdn.com/abc/video/?mime_type=video_mp4",
  preview_url_expire_time: "2026-08-28 18:53:14",
  video_cover_url: "http://p16-common-sign.tiktokcdn.com/cover~noop.image?x-expires=1787943232&x-signature=sig",
  create_time: "2026-07-29T13:30:57Z",
  modify_time: "2026-07-29T13:30:57Z",
};

const IMAGE_ROW = {
  image_id: "ad-site-i18n-sg/fixture-image",
  material_id: "7000000000000000002",
  file_name: "fixture-image.jpg",
  width: 1080,
  height: 1080,
  size: 251468,
  format: "jpeg",
  signature: "fixture-image-signature",
  displayable: true,
  is_carousel_usable: true,
  image_url: "https://p16-ad-site-sign-sg.ibyteimg.com/img~image.jpeg?x-expires=1790513597&x-signature=sig",
  create_time: "2026-07-11T21:36:34Z",
  modify_time: "2026-07-11T21:36:34Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tiktok_list_ad_videos", () => {
  it("liste la bibliothèque vidéo et extrait l'expiration des URLs signées", async () => {
    const fetchMock = vi.fn(async () =>
      tiktokResponse({ list: [VIDEO_ROW], page_info: { page: 1, page_size: 20, total_number: 366, total_page: 19 } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = (await tiktokTool("tiktok_list_ad_videos").handler({
      advertiserId: "7000000000000000003",
    })) as ToolResult;
    const payload = parsePayload(result);

    const url = lastFetchUrl(fetchMock);
    expect(url.origin).toBe("https://business-api.tiktok.com");
    expect(url.pathname).toBe("/open_api/v1.3/file/video/ad/search/");
    expect(url.searchParams.get("advertiser_id")).toBe("7000000000000000003");
    expect(url.searchParams.get("page_size")).toBe("20");

    const videos = payload.videos as Record<string, unknown>[];
    expect(videos).toHaveLength(1);
    expect(videos[0].duration_seconds).toBeCloseTo(38.75);
    expect(videos[0].cover_url_expires_at).toBe(new Date(1787943232 * 1000).toISOString());
    expect((payload.pageInfo as Record<string, unknown>).total_number).toBe(366);
    expect((payload.warnings as unknown[]).length).toBe(0);
  });

  it("transforme une erreur TikTok (code non nul) en warning au lieu d'échouer", async () => {
    const fetchMock = vi.fn(async () => tiktokResponse(null, 40105, "Access token is incorrect"));
    vi.stubGlobal("fetch", fetchMock);

    const result = (await tiktokTool("tiktok_list_ad_videos").handler({
      advertiserId: "123",
    })) as ToolResult;
    const payload = parsePayload(result);

    expect(payload.count).toBe(0);
    const warnings = payload.warnings as string[];
    expect(warnings.some((w) => w.includes("Access token is incorrect"))).toBe(true);
  });
});

describe("tiktok_list_ad_images", () => {
  it("liste la bibliothèque image avec l'expiration ~30 jours extraite de x-expires", async () => {
    const fetchMock = vi.fn(async () =>
      tiktokResponse({ list: [IMAGE_ROW], page_info: { page: 2, page_size: 20, total_number: 99, total_page: 5 } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = (await tiktokTool("tiktok_list_ad_images").handler({
      advertiserId: "7000000000000000003",
      page: 2,
    })) as ToolResult;
    const payload = parsePayload(result);

    const url = lastFetchUrl(fetchMock);
    expect(url.pathname).toBe("/open_api/v1.3/file/image/ad/search/");
    expect(url.searchParams.get("page")).toBe("2");

    const images = payload.images as Record<string, unknown>[];
    expect(images[0].image_id).toBe(IMAGE_ROW.image_id);
    expect(images[0].is_carousel_usable).toBe(true);
    expect(images[0].image_url_expires_at).toBe(new Date(1790513597 * 1000).toISOString());
  });
});

describe("tiktok_get_asset_urls", () => {
  it("re-résout vidéos et images par IDs via les endpoints info", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/file/video/ad/info/")) {
        expect(JSON.parse(url.searchParams.get("video_ids") ?? "[]")).toEqual([VIDEO_ROW.video_id]);
        return tiktokResponse({ list: [VIDEO_ROW] });
      }
      expect(url.pathname).toBe("/open_api/v1.3/file/image/ad/info/");
      expect(JSON.parse(url.searchParams.get("image_ids") ?? "[]")).toEqual([IMAGE_ROW.image_id]);
      return tiktokResponse({ list: [IMAGE_ROW] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = (await tiktokTool("tiktok_get_asset_urls").handler({
      advertiserId: "7000000000000000003",
      videoIds: [VIDEO_ROW.video_id, VIDEO_ROW.video_id],
      imageIds: [IMAGE_ROW.image_id],
    })) as ToolResult;
    const payload = parsePayload(result);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(payload.count).toBe(2);
    expect((payload.videos as Record<string, unknown>[])[0].preview_url).toContain("tiktokcdn.com");
    expect((payload.images as Record<string, unknown>[])[0].image_url_expires_at).toBeTruthy();
  });

  it("répond proprement sans IDs", async () => {
    const fetchMock = vi.fn(async () => tiktokResponse({ list: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = (await tiktokTool("tiktok_get_asset_urls").handler({
      advertiserId: "123",
    })) as ToolResult;
    const payload = parsePayload(result);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(payload.count).toBe(0);
    expect((payload.warnings as string[]).length).toBe(1);
  });
});

describe("piège des statuts /ad/get/ (STATUS_ALL systématique)", () => {
  it("relie aussi les métriques historiques aux assets des annonces archivées", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = new URL(String(input));
      expect(JSON.parse(url.searchParams.get("filtering") ?? "{}")).toEqual({ ad_ids: ["archived"], primary_status: "STATUS_ALL" });
      return tiktokResponse({ list: [{ ad_id: "archived", ad_name: "July video", video_id: VIDEO_ROW.video_id, image_ids: ["images/cover"] }] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const details = await new TikTokClient("test-token").getAdDetails("123", ["archived"]);
    expect(details.get("archived")).toEqual({ name: "July video", assets: [VIDEO_ROW.video_id] });
  });

  it("tiktok_get_creatives force primary_status STATUS_ALL, avec et sans adIds", async () => {
    const fetchMock = vi.fn(async () => tiktokResponse({ list: [], page_info: { page: 1 } }));
    vi.stubGlobal("fetch", fetchMock);

    await tiktokTool("tiktok_get_creatives").handler({ advertiserId: "123" });
    let filtering = JSON.parse(lastFetchUrl(fetchMock).searchParams.get("filtering") ?? "{}");
    expect(filtering.primary_status).toBe("STATUS_ALL");

    await tiktokTool("tiktok_get_creatives").handler({ advertiserId: "123", adIds: ["a1"] });
    filtering = JSON.parse(lastFetchUrl(fetchMock).searchParams.get("filtering") ?? "{}");
    expect(filtering).toEqual({ ad_ids: ["a1"], primary_status: "STATUS_ALL" });
  });

  it("tiktok_get_video_assets découvre les vidéos des ads archivées aussi", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/ad/get/")) {
        const filtering = JSON.parse(url.searchParams.get("filtering") ?? "{}");
        expect(filtering.primary_status).toBe("STATUS_ALL");
        return tiktokResponse({ list: [{ ad_id: "a1", video_id: VIDEO_ROW.video_id }] });
      }
      return tiktokResponse({ list: [VIDEO_ROW] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = (await tiktokTool("tiktok_get_video_assets").handler({
      advertiserId: "123",
      limit: 10,
    })) as ToolResult;
    parsePayload(result);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/ad/get/"))).toBe(true);
  });
});
