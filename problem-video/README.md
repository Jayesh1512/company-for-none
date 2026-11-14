# The cost of connecting everything

A standalone narrated problem-statement film. It contains no product screens, app recordings, project branding, existing walkthrough clips or product capability claims. Every visual is new typography or an abstract vector diagram. The business scenario is illustrative; no market statistics or customer testimony are asserted.

The narrative follows one task through infrastructure setup, scattered context, agent handoffs, unclear spending responsibility, and the resulting human overhead. It ends with the underlying business need: shared context, clear responsibility and visible limits.

Output: `artifacts/agent-problem-statement.mp4`, 1920×1080,30fps,68.47seconds,H.264/AAC. Optional narration subtitles: `artifacts/agent-problem-statement.srt`. Audio uses the installed macOS Daniel synthetic voice and an original programmatically synthesized score; no commercial music, paid models or external stock assets.

## Edit and export

```sh
npm run video:problem:studio
npm run video:problem:render -- --browser-executable '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --concurrency 4
```

Studio: http://localhost:3002/TheAgentProblem. It uses its own entrypoint and public directory and never imports the product walkthrough. Each scene is independently registered and editable. Existing `video:studio`/`video:render` scripts and walkthrough assets are preserved.

The narration script is `story.json`. To rebuild the audio, install/use macOS `say`,Python with NumPy,and FFmpeg/FFprobe,then run `npm run video:problem:prepare`. It writes `timings.json`,`captions.json`,individual voice WAVs,and the normalized stereo narration/score. If the wording or speaking rate changes, update the eight literal scene durations in `src/Root.tsx` to match `timings.json`; current frame total2054. Video and scene timing must remain synchronized before export.

`scripts/score-problem-video.py` composes the score from sine waves and mixes each voice segment at its measured offset. The master is normalized to −16LUFS with a −1.5dB true-peak ceiling. Rendering uses local Remotion and Chrome. No running shop server, real company data, accounts or credentials are needed.
