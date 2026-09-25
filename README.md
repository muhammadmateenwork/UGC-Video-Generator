# Cutroom

**Paste a product link, get a 7-second vertical UGC ad, and edit it layer by layer before it renders.**

Cutroom reads a product page, has Gemini plan *one* creative idea, sources four real layers around it (Pexels footage, a caption, a Giphy reaction, Freesound music) and cuts them into a 720×1280 H.264 MP4 with ffmpeg. Projects, layers and every pipeline step are stored in Postgres.

---

## Why it looks like this

The first version of this project was a ChatGPT-style chat clone, as the original brief asked. Redesigning it meant asking what the product actually is. **It's an editor, not a conversation.** A video is four layers on a timeline, and the one thing a chat can't do is let you change one of them without starting over. So:

- **Studio, not chat.** After you paste a link you land in a studio at `/p/[id]`. The left column shows what the AI read and what it decided (the *angle*). The centre is a live preview with a timeline. On the right, each layer has its own card where you can step through results, search again, or rewrite the caption.
- **Preview before you render.** The preview composites the real assets in the browser with the same geometry the renderer uses. Both read one spec, [`lib/composition.ts`](lib/composition.ts): canvas size, caption box, GIF position and on-screen window, fade length. You judge a combination for free and only spend a render once you like it. The timeline shows that same spec, so the GIF clip sits at exactly 0.84–5.46s because that's when ffmpeg shows it.
- **Colour means something.** The palette is warm paper and ink, with one orange accent for the primary action and anything live. Each layer also has its own colour (background blue, caption orange, GIF magenta, audio green), used the same way in the layer cards, the timeline tracks and the diagram on the home page.
- **Three typefaces, three jobs.** Instrument Serif for editorial headlines, Geist for the interface, Geist Mono for anything measured: timecodes, stage timings, the activity log.
- **Nothing is a black box.** The AI's plan is shown as a sentence ("the relief of never guessing calories again"). A badge says whether Gemini planned it or the fallback plan was used. Every stage is logged with its real duration, and every asset is credited to its creator.

### Details that make it feel like a tool

- **Arrange it like an editor.** Drag the caption or GIF on the preview to move it, with a centre guide that snaps. Drag the corner handle to resize. Drag a clip on the timeline to move it in time, or its edges to trim it. Caption, GIF and audio can each be switched off. The caption has text and accent colours and a size slider; the GIF has a size slider and the audio a volume slider. It all lives in one `layout` value per project. `normalizeLayout()` clamps it identically in the browser, the API and the renderer, and ffmpeg places, times and mixes every layer from it. `pnpm test:assemble` renders custom, switched-off and deliberately out-of-range layouts.
- **Four caption styles** (Boxed, Outline, TikTok pills, Pop). Each one is defined once in `captionCss()`, and that definition is used by the MP4 renderer (Satori), the live preview and the style picker's swatches. The swatches are the real style scaled down, not pictures of it.
- **Keyboard-first editing.** Space plays, ←/→ scrub, B/G/A step through the background, GIF and audio results (Shift goes back), C cycles caption styles, R renders, and ? shows the list.
- **Rendering shows on the timeline itself.** A sweep runs across the tracks with the current stage named. Toasts confirm finished renders, copied links and errors.
- **Share links unfurl properly.** Every `/v/[id]` gets its own 1200×630 card, generated from the video's own frame, its caption in its chosen style, the product name and the AI's angle.
- **Phones get a native-editor layout.** A sticky bottom bar keeps Play and Render (or Share) within reach at any scroll position, and uses the system share sheet where there is one.

## Architecture

```
Browser ──fetch──▶ Next.js 16 route handlers ──▶ Neon Postgres (Drizzle)
   ▲                     │
   └── NDJSON stream ◀───┤ prepare: scrape (cheerio) → plan (Gemini) → source (Pexels · Giphy · Freesound)
                         │ render:  download → ffmpeg (ffmpeg-static) → store (Vercel Blob / public/)
```

A project goes through two phases, each streamed live and persisted:

| Phase | Stages | Leaves the project |
|---|---|---|
| `prepare` | scrape → plan → source | `ready`, with a selected candidate for each layer |
| `render` | download → render → upload | `rendered`, with `video_url` and `render_ms` |

Sourcing only resolves URLs and metadata; nothing is downloaded until render time. That's why swapping a layer takes about 300ms and costs no Gemini quota.

### Data model ([`lib/db/schema.ts`](lib/db/schema.ts))

- **`projects`**: the URL, what was scraped, the layout (JSON), the plan (caption, angle, whether Gemini or the fallback planned it), status, video URL, render time, and an anonymous `owner_id`.
- **`layers`**: the selected asset for each (project, kind): the search query, which result is in use (`candidate_index`), preview and render URLs, and credit. It has a unique index on `(project_id, kind)`.
- **`events`**: an append-only activity log. Each stage writes one row with its measured duration.

### API

| Method | Route | Does |
|---|---|---|
| `GET` | `/api/projects` | Your library |
| `POST` | `/api/projects` `{url}` | Create a draft (accepts a URL, a bare domain, or a sentence containing one) |
| `GET` | `/api/projects/:id` | Project, its layers and activity |
| `PATCH` | `/api/projects/:id` `{caption?, captionStyle?, layout?}` | Edit the caption, its style, or the layout (position, size, timing, colour, on/off, volume) |
| `DELETE` | `/api/projects/:id` | Delete (layers and events cascade) |
| `POST` | `/api/projects/:id/prepare` | Scrape, plan and source, streamed as NDJSON |
| `POST` | `/api/projects/:id/layers/:kind` `{query?, step?}` | Swap one layer: next or previous result, or a new search |
| `POST` | `/api/projects/:id/render` | Download, ffmpeg and store, streamed as NDJSON |

### Correctness details worth knowing

- **No double renders.** The move into `preparing` or `rendering` happens inside the `UPDATE ... WHERE status IN (...)` itself, not as a read followed by a write. Two tabs or a double-click can't start the same render twice. A lock that's older than 90s (for example after a serverless timeout) can be taken over.
- **Ownership without sign-up.** An httpOnly cookie gives each browser an anonymous owner id. Every mutating query filters by it, and someone else's project redirects to its read-only share page.
- **Input safety.** zod validates every body. The server fetches the product URL, so loopback and private-network hosts are refused (basic SSRF protection). Each owner can create 15 projects per hour.
- **Degrades instead of failing.** If Gemini is down or out of quota, the fallback plan is used and labelled as such. An empty layer renders with a fallback (a solid canvas or silence). A failed render keeps the previous video.
- **Stale renders are flagged.** Edit a layer after rendering and the studio marks the video out of date until you render again.

## Running it

```bash
pnpm install
cp .env.local.example .env.local   # fill in DATABASE_URL + the 4 API keys
pnpm db:migrate                    # apply ./drizzle migrations
pnpm dev
```

- `pnpm test:assemble` renders every combination of background, GIF, audio and caption offline and checks each output with ffprobe.
- `pnpm build` runs migrations first, so a deploy can't ship code that's ahead of its schema.
- `pnpm db:studio` opens Drizzle Studio to look at the data.

On Vercel, add Neon from **Storage** (it sets `DATABASE_URL`) and Blob (it sets `BLOB_READ_WRITE_TOKEN`).

## Tradeoffs and what I'd do next

- **Rendering runs inside the request** (up to 60s on Vercel Hobby). A real product would put renders on a queue with a worker. The status column and the takeover-a-stale-lock logic are already shaped for that.
- **Identity is anonymous, per browser.** Signing in (for example with Clerk) would make the library follow you across devices. `owner_id` is already the only thing that would change.
- **Local dev shares the production database** unless you point `DATABASE_URL` at a Neon dev branch, which I'd do for a team.

## How this was built

It was built with Claude Code. Every prompt and response is captured automatically by hooks and committed in [`.agent-logs/`](.agent-logs/). [`CAPTURE-TEST.md`](CAPTURE-TEST.md) explains how the capture works.
