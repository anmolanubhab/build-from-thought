import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import TrustedStats from "@/components/landing/TrustedStats";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import Demo from "@/components/landing/Demo";
import Templates from "@/components/landing/Templates";
import Pricing from "@/components/landing/Pricing";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />
      <Hero />
      <TrustedStats />
      <HowItWorks />
      <Features />
      <Demo />
      <Templates />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;
