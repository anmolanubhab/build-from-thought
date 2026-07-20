import StaticPageLayout from "@/components/landing/StaticPageLayout";

const Privacy = () => (
  <StaticPageLayout title="Privacy Policy">
    <p className="not-prose rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Draft placeholder — this page is not yet a finalized, legally reviewed privacy policy. It will be updated
      before general availability.
    </p>
    <p>
      WebdevsAI collects the account information you provide (such as your email address) and the data needed to
      operate the product — including your projects, generated code, and deployment configuration.
    </p>
    <p>
      We use Supabase for authentication and data storage, and third-party services you explicitly connect (such
      as Vercel, Netlify, or GitHub) for deployment. We do not sell your data.
    </p>
    <p>
      Questions about your data can be directed to us via the Contact page once support channels are live.
    </p>
  </StaticPageLayout>
);

export default Privacy;
