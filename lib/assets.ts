import type { LayerKind } from "./db/schema";

// Search calls return small JSON payloads; downloads carry actual media
// bytes (a Pexels video can be several MB) and get a longer budget. Measured
// directly against Freesound's CDN from this environment: a <1MB preview
// took just over 12s to fully download despite headers arriving in under a
// second, which silently aborted every audio download at the old 12s limit
// right as it was about to finish — not a relevance problem, a timeout too
// tight for the actual transfer speed.
const JSON_TIMEOUT_MS = 8000;
const DOWNLOAD_TIMEOUT_MS = 25000;
const PAGE_SIZE = "15";

/**
 * Downloads a file, optionally only its first `maxBytes`. Measured against
 * Freesound's CDN: it serves ~75KB/s, so a full 1.9MB HQ preview took 27s
 * and blew the render budget — while a 7s clip needs only the first
 * ~200KB of it. The CDN honours Range (206); if a server ignores it and
 * sends the whole file, the stream is cut off at the cap anyway.
 */
export async function fetchBuffer(url: string, opts: { maxBytes?: number } = {}): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = opts.maxBytes ? { Range: `bytes=0-${opts.maxBytes - 1}` } : {};
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok || !res.body) return null;
    if (!opts.maxBytes) return Buffer.from(await res.arrayBuffer());

    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = res.body.getReader();
    while (size < opts.maxBytes) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    return Buffer.concat(chunks).subarray(0, opts.maxBytes);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Enough of the ~80kbps LQ preview for a 7s clip with margin (~12s). */
export const AUDIO_MAX_BYTES = 128_000;

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), JSON_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, headers });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

/**
 * One selectable asset for a layer. Sourcing only resolves metadata and
 * URLs — nothing is downloaded until render time — so the studio can show
 * real previews and let the user shuffle through results cheaply.
 */
export interface LayerCandidate {
  provider: "pexels" | "giphy" | "freesound";
  mediaType: "video" | "image" | "gif" | "audio";
  previewUrl: string;
  renderUrl: string;
  thumbUrl: string | null;
  title: string | null;
  creditName: string | null;
  creditUrl: string | null;
  meta: Record<string, unknown>;
}

// ---------------------------------------------------------------- Pexels

interface PexelsVideoFile {
  link: string;
  width: number;
  height: number;
  file_type: string;
}
interface PexelsVideo {
  id: number;
  url: string;
  image: string;
  duration: number;
  width: number;
  height: number;
  user: { name: string; url: string };
  video_files: PexelsVideoFile[];
}
interface PexelsPhoto {
  id: number;
  url: string;
  alt: string;
  photographer: string;
  photographer_url: string;
  src: { large2x: string; large: string; medium: string; portrait: string };
}

function mp4s(files: PexelsVideoFile[]) {
  return files.filter((f) => f.file_type === "video/mp4" && f.width > 0);
}

/** The file closest to the 720px output. Anything bigger is only download
 * and decode time — the render scales it down to 720 wide regardless. */
function pickRenderFile(files: PexelsVideoFile[]): PexelsVideoFile | null {
  const all = mp4s(files);
  if (all.length === 0) return null;
  const distance = (f: PexelsVideoFile) => Math.abs(Math.min(f.width, f.height) - 720);
  return [...all].sort((a, b) => distance(a) - distance(b) || a.width * a.height - b.width * b.height)[0];
}

/** Smallest watchable file for the in-browser preview, so shuffling stays snappy. */
function pickPreviewFile(files: PexelsVideoFile[]): PexelsVideoFile | null {
  const all = mp4s(files);
  if (all.length === 0) return null;
  const small = all.filter((f) => Math.min(f.width, f.height) >= 300);
  const pool = small.length > 0 ? small : all;
  return [...pool].sort((a, b) => a.width * a.height - b.width * b.height)[0];
}

async function searchBackgrounds(query: string): Promise<LayerCandidate[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];
  const headers = { Authorization: apiKey };

  // Portrait first — fits the 720x1280 canvas with the least cropping.
  for (const orientation of ["portrait", undefined]) {
    const params = new URLSearchParams({ query, per_page: PAGE_SIZE });
    if (orientation) params.set("orientation", orientation);
    const data = await fetchJson<{ videos: PexelsVideo[] }>(
      `https://api.pexels.com/videos/search?${params}`,
      headers
    );
    const candidates: LayerCandidate[] = [];
    for (const v of data?.videos ?? []) {
      const render = pickRenderFile(v.video_files);
      const preview = pickPreviewFile(v.video_files);
      if (!render || !preview) continue;
      candidates.push({
        provider: "pexels",
        mediaType: "video",
        previewUrl: preview.link,
        renderUrl: render.link,
        thumbUrl: v.image,
        title: `Stock video #${v.id}`,
        creditName: v.user?.name ?? null,
        creditUrl: v.url,
        meta: { duration: v.duration, width: v.width, height: v.height },
      });
    }
    if (candidates.length > 0) return candidates;
  }

  for (const orientation of ["portrait", undefined]) {
    const params = new URLSearchParams({ query, per_page: PAGE_SIZE });
    if (orientation) params.set("orientation", orientation);
    const data = await fetchJson<{ photos: PexelsPhoto[] }>(
      `https://api.pexels.com/v1/search?${params}`,
      headers
    );
    const candidates = (data?.photos ?? []).map<LayerCandidate>((p) => ({
      provider: "pexels",
      mediaType: "image",
      previewUrl: p.src.portrait || p.src.large,
      renderUrl: p.src.large2x || p.src.large,
      thumbUrl: p.src.medium,
      title: p.alt || `Stock photo #${p.id}`,
      creditName: p.photographer,
      creditUrl: p.url,
      meta: {},
    }));
    if (candidates.length > 0) return candidates;
  }
  return [];
}

// ---------------------------------------------------------------- Giphy

interface GiphyImage {
  url: string;
  width?: string;
  height?: string;
}
interface GiphyGif {
  id: string;
  url: string;
  title?: string;
  username?: string;
  user?: { is_verified?: boolean; display_name?: string; username?: string } | null;
  images: {
    downsized?: GiphyImage;
    original?: GiphyImage;
    fixed_width?: GiphyImage;
    fixed_height?: GiphyImage;
    fixed_width_still?: GiphyImage;
  };
}

const MIN_GIF_WIDTH = 150;

/** Giphy search, re-ranked rather than trusting raw order — confirmed by
 * actually downloading and inspecting frames, not assumed:
 * 1. Official network/brand-channel uploads are meaningfully more likely to
 *    carry a burned-in channel bug/watermark than an unattributed community
 *    upload of the same reaction, so unverified uploads rank first.
 * 2. Very small source GIFs look visibly pixelated once scaled up to the
 *    overlay width, so undersized ones rank last. */
async function searchGifs(query: string): Promise<LayerCandidate[]> {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) return [];
  const params = new URLSearchParams({ api_key: apiKey, q: query, limit: "20", rating: "pg-13" });
  const data = await fetchJson<{ data: GiphyGif[] }>(`https://api.giphy.com/v1/gifs/search?${params}`);

  const score = (g: GiphyGif) => {
    const img = g.images.downsized || g.images.original;
    const width = img?.width ? parseInt(img.width, 10) : MIN_GIF_WIDTH;
    return (g.user?.is_verified ? 2 : 0) + (width < MIN_GIF_WIDTH ? 1 : 0);
  };

  return (data?.data ?? [])
    .map((g, i) => ({ g, i, s: score(g) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .flatMap(({ g }) => {
      const render = g.images.downsized || g.images.original || g.images.fixed_width;
      const preview = g.images.fixed_width || render;
      if (!render || !preview) return [];
      return [
        {
          provider: "giphy" as const,
          mediaType: "gif" as const,
          previewUrl: preview.url,
          renderUrl: render.url,
          thumbUrl: g.images.fixed_width_still?.url ?? null,
          title: g.title || "Reaction GIF",
          creditName: g.user?.display_name || g.username || null,
          creditUrl: g.url,
          meta: {
            width: render.width ? Number(render.width) : null,
            height: render.height ? Number(render.height) : null,
          },
        },
      ];
    });
}

// ---------------------------------------------------------------- Freesound

interface FreesoundResult {
  id: number;
  name: string;
  username: string;
  url: string;
  duration: number;
  previews: { "preview-hq-mp3"?: string; "preview-lq-mp3"?: string };
  images?: { waveform_m?: string; waveform_l?: string };
}

/** Freesound text search, sorted by download count as a proxy for
 * "trending" within a free catalog. */
async function searchAudio(query: string): Promise<LayerCandidate[]> {
  const apiKey = process.env.FREESOUND_API_KEY;
  if (!apiKey) return [];
  const params = new URLSearchParams({
    query,
    fields: "id,name,username,url,duration,previews,images",
    filter: "duration:[6 TO 90]",
    sort: "downloads_desc",
    page_size: PAGE_SIZE,
  });
  const data = await fetchJson<{ results: FreesoundResult[] }>(
    `https://freesound.org/apiv2/search/text/?${params}`,
    { Authorization: `Token ${apiKey}` }
  );
  return (data?.results ?? []).flatMap((r) => {
    const hq = r.previews["preview-hq-mp3"];
    const lq = r.previews["preview-lq-mp3"];
    if (!hq && !lq) return [];
    return [
      {
        provider: "freesound" as const,
        mediaType: "audio" as const,
        previewUrl: (hq || lq)!,
        // The render re-encodes to AAC for a phone speaker, and Freesound's CDN
        // is slow enough (measured 75KB/s, sometimes far worse) that the
        // smaller LQ stream is the difference between audio and silence.
        renderUrl: (lq || hq)!,
        thumbUrl: r.images?.waveform_m ?? null,
        title: r.name,
        creditName: r.username,
        creditUrl: r.url,
        meta: { duration: r.duration },
      },
    ];
  });
}

// ---------------------------------------------------------------- public

const SEARCHERS: Record<LayerKind, (q: string) => Promise<LayerCandidate[]>> = {
  background: searchBackgrounds,
  gif: searchGifs,
  audio: searchAudio,
};

export const LAYER_PROVIDER_KEYS: Record<LayerKind, string> = {
  background: "PEXELS_API_KEY",
  gif: "GIPHY_API_KEY",
  audio: "FREESOUND_API_KEY",
};

/**
 * Resolves the `index`-th result for a layer query (wrapping around), plus
 * how many results exist so the UI can show "3 / 15". Returns null only
 * when the provider genuinely has nothing — the renderer has a fallback for
 * every layer, so an empty layer is a degraded clip, never a failed one.
 */
export async function sourceLayer(
  kind: LayerKind,
  query: string,
  index = 0
): Promise<{ candidate: LayerCandidate; index: number; total: number } | null> {
  const results = await SEARCHERS[kind](query);
  if (results.length === 0) return null;
  const i = ((index % results.length) + results.length) % results.length;
  return { candidate: results[i], index: i, total: results.length };
}
