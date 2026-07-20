import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import StaticPageLayout from "@/components/landing/StaticPageLayout";
import { ArrowRight } from "lucide-react";

const Contact = () => (
  <StaticPageLayout title="Contact Us">
    <p>
      We're a small team heads-down on the product, so email support isn't live yet. For sales, enterprise, or
      partnership inquiries, use the "Contact Sales" option on the Pricing page — it reaches us directly.
    </p>
    <p>For general questions, the fastest option today is to start on the free plan and reach out from within the app.</p>
    <Button className="bg-blue-600 text-white hover:bg-blue-700 gap-2 mt-2 not-prose" asChild>
      <Link to="/#pricing">
        Go to Pricing <ArrowRight size={16} />
      </Link>
    </Button>
  </StaticPageLayout>
);

export default Contact;
