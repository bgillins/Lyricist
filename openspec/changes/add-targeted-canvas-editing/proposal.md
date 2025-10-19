## Why
- Writers want to direct the GPT collaborator at a specific lyric fragment instead of sending the entire song every time.
- Highlighting lyrics inside the canvas currently has no effect, so users copy/paste snippets manually into the chat which breaks flow and risks losing formatting.
- Feeding the LLM only the relevant section should produce tighter recommendations and reduce the amount of diff noise applied back to the canvas.

## What Changes
- Track the active TipTap selection in `LyricCanvas` and expose helper actions (toolbar button + chat quick action) to ask for help on the highlighted passage.
- Autofill the chat composer with a templated prompt that references the highlight and send the snippet in the `selection` field when the user submits.
- Update chat history and backend prompt helpers so targeted requests are labeled in the transcript and the LLM system prompt emphasizes working on the provided excerpt first.
- Offer an "Apply to selection" preview path that merges returned lyrics only into the highlighted section, falling back to today’s whole-document merge if no selection was provided.

## Impact
- Frontend: extend `LyricCanvas`, chat dock, and diff viewer to handle highlight-aware requests and apply flows; wire selection tracking into API calls.
- Backend: adjust prompt builder / chat service logging to surface highlighted context, ensuring fallbacks respect the selection when OpenAI is disabled.
- UX: additional toolbar affordances and chat copy changes; ensure accessibility (keyboard trigger + ARIA labels) for the highlight action.
