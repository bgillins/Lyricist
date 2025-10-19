## 1. Frontend Selection Capture
- [x] 1.1 Track the current TipTap selection (text + HTML) in `LyricCanvas`.
- [x] 1.2 Surface highlight-aware affordances (toolbar button, keyboard shortcut, chat quick action) that call the assistant with the active selection.

## 2. Chat Request Plumbing
- [x] 2.1 Include the selection payload in `useChatSession` requests and annotate chat history entries when a targeted request is sent.
- [x] 2.2 Support applying assistant options only to the selected range, keeping today’s whole-document merge as fallback.

## 3. Backend Prompt Updates
- [x] 3.1 Ensure prompt builder and chat service prioritize `selection` text when present and document any behavioral tweaks.
- [x] 3.2 Extend stub/fallback responses to echo the highlighted passage so targeted flows stay useful without OpenAI.

## 4. QA & Docs
- [ ] 4.1 Smoke-test whole-document and selection-only flows (create, revise, accept, revert) across both OpenAI-enabled and stub modes.
- [x] 4.2 Update relevant README or help text describing highlight-based assistance.
