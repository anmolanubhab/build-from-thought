import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "What can I build with WebdevsAI?",
    a: "You can generate full web applications — dashboards, marketplaces, portfolios, chat apps, and landing pages — from a single natural-language prompt, then edit the code directly.",
  },
  {
    q: "Do I own the code that's generated?",
    a: "Yes. Every app is production-ready React and TypeScript code that you can export, push to GitHub, and fully own.",
  },
  {
    q: "Which platforms can I deploy to?",
    a: "You can deploy directly to Vercel or Netlify, connect a custom domain, or push the code to your own GitHub repository and host it anywhere.",
  },
  {
    q: "Is authentication included?",
    a: "Yes. Generated apps include built-in sign-up, login, and session handling so you don't have to wire it up yourself.",
  },
  {
    q: "Can I edit the generated app after it's built?",
    a: "Yes. You get a full code editor alongside the live preview, so you can refine layouts, logic, and styling directly.",
  },
  {
    q: "What's included in the free plan?",
    a: "The Free plan includes 5 projects, the AI prompt builder, basic templates, and community support — no credit card required.",
  },
];

const FAQ = () => (
  <section id="faq" className="py-20 lg:py-28 bg-white">
    <div className="container mx-auto px-4">
      <div className="text-center mb-14">
        <span className="text-sm font-semibold text-blue-600 mb-3 block">FAQ</span>
        <h2 className="font-display text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
          Frequently asked questions
        </h2>
        <p className="text-gray-500 max-w-xl mx-auto">Everything you need to know before you get started.</p>
      </div>

      <div className="max-w-2xl mx-auto rounded-2xl border border-gray-200 bg-white px-6 shadow-sm">
        <Accordion type="single" collapsible>
          {faqs.map(({ q, a }, i) => (
            <AccordionItem key={q} value={`item-${i}`} className="border-gray-100">
              <AccordionTrigger className="text-left text-sm font-semibold text-gray-900 hover:no-underline hover:text-blue-600">
                {q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-gray-500 leading-relaxed">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  </section>
);

export default FAQ;
