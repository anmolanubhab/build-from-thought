import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTA = () => (
  <section className="py-20 lg:py-28 bg-white">
    <div className="container mx-auto px-4">
      <div className="relative overflow-hidden rounded-3xl bg-gray-900 py-16 px-8 text-center">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(500px circle at 50% -10%, rgba(37,99,235,0.35), transparent 60%)",
          }}
        />
        <div className="relative z-10">
          <h2 className="font-display text-3xl lg:text-5xl font-extrabold text-white mb-6 tracking-tight">
            Start building your first AI app today
          </h2>
          <p className="text-gray-300 mb-9 max-w-lg mx-auto text-lg">
            Turn your idea into a production-ready app in minutes — no credit card required.
          </p>
          <Button
            size="lg"
            className="bg-white text-gray-900 hover:bg-gray-100 hover:-translate-y-0.5 shadow-lg transition-all gap-2 px-7"
            asChild
          >
            <Link to="/signup">
              Create Your First App <ArrowRight size={18} />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default CTA;
