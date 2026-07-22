// path: src/components/documentation/VivaModeView.tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { VivaContentJson } from "@/lib/documentation/types";

const LEVEL_LABEL: Record<string, string> = { basic: "Basic", intermediate: "Intermediate", advanced: "Advanced" };
const LEVEL_COLOR: Record<string, string> = { basic: "#10B981", intermediate: "#3B82F6", advanced: "#A78BFA" };

export default function VivaModeView({ data }: { data: VivaContentJson }) {
  if (!data.categories || data.categories.length === 0) return null;

  return (
    <div className="space-y-6">
      {data.categories.map((cat) => (
        <div key={cat.level}>
          <div className="flex items-center gap-2 mb-2">
            <Badge style={{ background: LEVEL_COLOR[cat.level] ?? "#888", color: "white" }}>{LEVEL_LABEL[cat.level] ?? cat.level}</Badge>
            <span className="text-xs" style={{ color: "var(--wb-text-muted)" }}>{cat.questions.length} questions</span>
          </div>
          <Accordion type="single" collapsible className="rounded-lg border" style={{ borderColor: "var(--wb-line)" }}>
            {cat.questions.map((q, i) => (
              <AccordionItem key={i} value={`${cat.level}-${i}`} style={{ borderColor: "var(--wb-line)" }} className="px-3">
                <AccordionTrigger className="text-sm text-left" style={{ color: "var(--wb-text)" }}>{q.question}</AccordionTrigger>
                <AccordionContent className="text-sm whitespace-pre-wrap" style={{ color: "var(--wb-text-muted)" }}>{q.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </div>
  );
}
