import { BOOKS } from "../../../packages/corpus/src/books.ts";
import { StudyWorkbench } from "./_components/study-workbench.tsx";

export default function HomePage() {
  return (
    <main>
      <header className="masthead">
        <div>
          <p className="eyebrow">Pure Cambridge Edition · deterministic evidence</p>
          <h1>KJV Scripture Evidence Explorer</h1>
          <p className="lede">Trace exact wording, inspect lexical relationships, and keep every result reproducible.</p>
        </div>
        <div className="version-badge" aria-label="Active versions">
          <span>Corpus</span><strong>KJV-PCE-BP-2010-v1</strong>
          <span>Algorithm</span><strong>1.0.0</strong>
        </div>
      </header>
      <StudyWorkbench books={BOOKS.map((book) => book.name)} />
      <footer>
        <p>The exact KJV text is authoritative for quotations. Similarity is lexical evidence, not proof of interpretation.</p>
      </footer>
    </main>
  );
}
