# Product walkthrough

`artifacts/near-product-walkthrough.mp4` is a 79-second, 1920×1080, 30 fps H.264 walkthrough built with Remotion. It is silent with burned-in chapter captions. Footage records actual local product interactions; pauses are edited for pacing.

The flow covers the agent roster, a marketplace template, creating Opportunity analyst, adding a reusable skill, selecting a service, writing a task brief, approving its local run, reading the private report, task history and the public ledger.

**Local demo is visible throughout.** Evidence, report generation, payments and payouts in this recording use controlled fixtures. The video does not establish live provider connections or real economic execution. Marketplace listings are independent samples.

## Edit and render

From the repository root:

```sh
npm ci
npm run video:studio
npm run video:render
```

Studio: http://localhost:3001/NearWalkthrough. The timeline has one authored node per clip, plus opening and closing scenes. Each source clip is under `walkthrough/public/recordings/`. The same root package and lockfile serve the product and the video.

If using an existing compatible Chrome binary, pass `-- --browser-executable /absolute/path/to/chrome` to the render command. Otherwise Remotion manages its browser download.

## Capture again

Start the product in local fixture mode on port 4173. Capture creates a real persisted demo agent and task in that store. Use a dedicated `SHOP_DATA_DIR` if you want an isolated recording history; an open order must finish before another starts.

```sh
SHOP_DATA_DIR=.runtime/walkthrough npm run dev
# In another terminal, with Playwright Chromium installed:
node scripts/record-walkthrough.mjs
node scripts/prepare-walkthrough.mjs
npm run video:render
```

`WALKTHROUGH_BROWSER` can select a cached Chromium executable. The recorder saves no task access tokens to its metadata. `capture.json` records source timings, created entity IDs, viewport and browser exceptions; `edit.json` records source-to-edited timings. The shipped capture has zero page exceptions.

The T3 native browser was tried first. Its evaluate step timed out twice and its recording stop timed out, so the final footage uses Playwright's actual browser video recording. No screenshots were substituted for action footage.
