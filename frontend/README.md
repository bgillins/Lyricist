# Lyricist Frontend

Local-first canvas prototype built with Next.js 15. This client talks to the FastAPI backend to load and persist lyric drafts through a simple TipTap-powered editor.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.local.example` to `.env.local` and adjust the backend URL if needed. The default assumes the API runs on `http://127.0.0.1:8000`.

## Development

Start the dev server:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser. The home page loads the lyric canvas, a revision feed, and displays save status feedback as you edit and persist text.
Click any timestamp in the history rail to preview that revision; hit **Restore** to promote it back to the top or **Save** to capture tweaks on top of the preview.

## Notes

- The canvas stores data as HTML so future rich-text capabilities can build on the same contract.
- Every save creates a new timestamped revision that appears in the history rail. Click a row to preview it, tap **Restore** to stage that revision, and press **Save** when you're ready to promote it.
- Clear button (double-confirmed) wipes the archive if you want to reset during prototyping.
- Additional panels (GPT, metadata, revision history) will hook into this page as we expand the prototype.
