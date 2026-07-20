import StaticPageLayout from "@/components/landing/StaticPageLayout";

const Terms = () => (
  <StaticPageLayout title="Terms of Service">
    <p className="not-prose rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Draft placeholder — this page is not yet a finalized, legally reviewed terms of service. It will be updated
      before general availability.
    </p>
    <p>
      By using WebdevsAI you agree to use the product responsibly and not to abuse the AI generation, deployment,
      or hosting infrastructure. You own the code your projects generate.
    </p>
    <p>
      The Free plan is provided as-is during this early access period. Paid plans are not yet billable — joining
      the Pro or Enterprise waitlist does not create a billing obligation.
    </p>
    <p>These terms may change as the product evolves. Continued use after an update means you accept the revised terms.</p>
  </StaticPageLayout>
);

export default Terms;
