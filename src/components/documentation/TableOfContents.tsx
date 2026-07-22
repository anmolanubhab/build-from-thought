// path: src/components/documentation/TableOfContents.tsx
import { extractToc } from "@/lib/documentation/markdown";

interface Props {
  markdown: string;
  onJump: (slug: string) => void;
}

export default function TableOfContents({ markdown, onJump }: Props) {
  const toc = extractToc(markdown);
  if (toc.length === 0) {
    return <p className="text-xs px-1" style={{ color: "var(--wb-text-muted)" }}>No headings yet.</p>;
  }
  return (
    <nav className="space-y-0.5">
      {toc.map((item, i) => (
        <button
          key={`${item.slug}-${i}`}
          onClick={() => onJump(item.slug)}
          className="block w-full text-left truncate text-xs py-1 rounded hover:opacity-80 transition-opacity"
          style={{
            paddingLeft: `${(item.level - 1) * 10 + 8}px`,
            color: item.level === 1 ? "var(--wb-text)" : "var(--wb-text-muted)",
            fontWeight: item.level === 1 ? 600 : 400,
          }}
        >
          {item.text}
        </button>
      ))}
    </nav>
  );
}
