import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTA = () => (
  <section className="py-20 lg:py-28">
    <div className="container mx-auto px-4">
      <div className="gradient-bg rounded-2xl py-16 px-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-background/20" />
        <div className="relative z-10">
          <h2 className="font-display text-3xl lg:text-5xl font-extrabold text-primary-foreground mb-6">
            Start Building Your First AI App Today
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">
            Join thousands of developers who ship faster with WebdevsAI.
          </p>
          <Button size="lg" className="bg-background text-foreground hover:bg-background/90 gap-2" asChild>
            <Link to="/signup">Create Your First App <ArrowRight size={18} /></Link>
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default CTA;
