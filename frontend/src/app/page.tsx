import { LyricCanvas } from "@/components/lyric-canvas";

export default function HomePage(): JSX.Element {
  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="eyebrow">Lyricist Prototype</p>
        <h1>Canvas</h1>
        <p className="lede">
          Draft lyrics, iterate quickly, and keep your words safe. Each save stamps a
          new revision so you can trace your ideas over time. Clear the archive anytime
          once you are sure you no longer need the history.
        </p>
      </header>
      <LyricCanvas documentId="draft" />
    </main>
  );
}
