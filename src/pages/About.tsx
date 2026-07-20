import StaticPageLayout from "@/components/landing/StaticPageLayout";

const About = () => (
  <StaticPageLayout title="About WebdevsAI">
    <p>
      WebdevsAI is an AI-powered app builder. Describe an idea in plain English and WebdevsAI generates a working
      web application — UI, code, and all — that you can preview, edit, and deploy.
    </p>
    <p>
      The goal is simple: remove the distance between an idea and a live, production-ready app. Every generated
      project ships as real React and TypeScript code you own, with built-in authentication, a live code editor,
      and one-click deployment to the platforms you already use.
    </p>
    <p>
      We're early, and building in the open. If you want to follow along or influence what comes next, join the
      waitlist from the pricing section or start building on the free plan today.
    </p>
  </StaticPageLayout>
);

export default About;
