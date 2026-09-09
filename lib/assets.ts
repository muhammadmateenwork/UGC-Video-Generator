// Search calls return small JSON payloads; downloads carry actual media
// bytes (a Pexels video can be several MB) and get a longer budget. Measured
// directly against Freesound's CDN from this environment: a <1MB preview
// took just over 12s to fully download despite headers arriving in under a
// second, which silently aborted every audio download at the old 12s limit
// right as it was about to finish — not a relevance problem, a timeout too
// tight for the actual transfer speed.
const JSON_TIMEOUT_MS = 8000;
const DOWNLOAD_TIMEOUT_MS = 25000;

async function fetchBuffer(url: string, headers?: Record<string, string>): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, headers });
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

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

export interface SourcedBackground {
  type: "video" | "image";
  buffer: Buffer;
}

interface PexelsVideoFile {
  link: string;
  width: number;
  height: number;
  quality: string;
  file_type: string;
}
interface PexelsVideo {
  video_files: PexelsVideoFile[];
}
interface PexelsVideoSearch {
  videos: PexelsVideo[];
}
interface PexelsPhoto {
  src: { large2x: string; large: string; original: string };
}
interface PexelsPhotoSearch {
  photos: PexelsPhoto[];
}

function pickBestVideoFile(files: PexelsVideoFile[]): PexelsVideoFile | null {
  const mp4s = files.filter((f) => f.file_type === "video/mp4");
  if (mp4s.length === 0) return null;
  // Prefer HD-ish quality without grabbing 4K (slow to download/decode for a 7s clip).
  const sized = mp4s.filter((f) => f.width >= 480 && f.width <= 1280);
  const pool = sized.length > 0 ? sized : mp4s;
  return pool.sort((a, b) => b.width - a.width)[0];
}

/** Pexels video search, then photo fallback. Tries portrait first (fits our
 * 720x1280 canvas with less cropping), then any orientation. */
export async function sourceBackground(query: string): Promise<SourcedBackground | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;
  const headers = { Authorization: apiKey };

  for (const orientation of ["portrait", undefined]) {
    const params = new URLSearchParams({ query, per_page: "5" });
    if (orientation) params.set("orientation", orientation);
    const data = await fetchJson<PexelsVideoSearch>(
      `https://api.pexels.com/videos/search?${params}`,
      headers
    );
    const video = data?.videos?.find((v) => pickBestVideoFile(v.video_files));
    const file = video ? pickBestVideoFile(video.video_files) : null;
    if (file) {
      const buffer = await fetchBuffer(file.link);
      if (buffer) return { type: "video", buffer };
    }
  }

  for (const orientation of ["portrait", undefined]) {
    const params = new URLSearchParams({ query, per_page: "5" });
    if (orientation) params.set("orientation", orientation);
    const data = await fetchJson<PexelsPhotoSearch>(
      `https://api.pexels.com/v1/search?${params}`,
      headers
    );
    const photo = data?.photos?.[0];
    if (photo) {
      const buffer = await fetchBuffer(photo.src.large2x || photo.src.large || photo.src.original);
      if (buffer) return { type: "image", buffer };
    }
  }

  return null;
}

interface GiphyImage {
  url: string;
  width?: string;
  height?: string;
}
interface GiphyGif {
  user?: { is_verified?: boolean } | null;
  images: {
    downsized?: GiphyImage;
    original?: GiphyImage;
    fixed_height?: GiphyImage;
  };
}
interface GiphySearch {
  data: GiphyGif[];
}

const MIN_GIF_WIDTH = 150;

function giphyPreviewImage(gif: GiphyGif): GiphyImage | null {
  return gif.images.downsized || gif.images.fixed_height || gif.images.original || null;
}

/** Giphy GIF search, with two quality passes over the candidate pool rather
 * than blindly taking the first hit — confirmed by actually downloading and
 * inspecting frames, not assumed:
 * 1. Official network/brand-channel uploads (a late-night show's own Peacock
 *    account, a network's own clip, etc.) are meaningfully more likely to
 *    carry a burned-in channel bug/watermark than an unattributed community
 *    upload of the same reaction. Prefer `user` being absent/unverified.
 * 2. Very small source GIFs look visibly pixelated once scaled up to the
 *    overlay width in the final composite. Prefer ones above a minimum
 *    native width when size data is available. */
export async function sourceGif(query: string): Promise<Buffer | null> {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    api_key: apiKey,
    q: query,
    limit: "10",
    rating: "pg-13",
  });
  const data = await fetchJson<GiphySearch>(`https://api.giphy.com/v1/gifs/search?${params}`);
  const candidates = data?.data ?? [];
  if (candidates.length === 0) return null;

  const unbranded = candidates.filter((g) => !g.user?.is_verified);
  const brandFiltered = unbranded.length > 0 ? unbranded : candidates;

  const wellSized = brandFiltered.filter((g) => {
    const img = giphyPreviewImage(g);
    const width = img?.width ? parseInt(img.width, 10) : null;
    return width === null || width >= MIN_GIF_WIDTH;
  });
  const finalPool = wellSized.length > 0 ? wellSized : brandFiltered;

  const url = giphyPreviewImage(finalPool[0])?.url;
  if (!url) return null;
  return fetchBuffer(url);
}

interface FreesoundResult {
  previews: { "preview-hq-mp3"?: string; "preview-lq-mp3"?: string };
}
interface FreesoundSearch {
  results: FreesoundResult[];
}

/** Freesound text search for trending-feeling background music, sorted by
 * download count as a proxy for "trending" among a free-tier catalog. */
export async function sourceAudio(query: string): Promise<Buffer | null> {
  const apiKey = process.env.FREESOUND_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    query,
    fields: "id,name,previews",
    filter: "duration:[4 TO 60]",
    sort: "downloads_desc",
    page_size: "5",
  });
  const data = await fetchJson<FreesoundSearch>(
    `https://freesound.org/apiv2/search/text/?${params}`,
    { Authorization: `Token ${apiKey}` }
  );
  const result = data?.results?.[0];
  const url = result?.previews["preview-hq-mp3"] || result?.previews["preview-lq-mp3"];
  if (!url) return null;
  return fetchBuffer(url);
}
