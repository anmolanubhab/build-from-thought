import { useEffect } from "react";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import TrustedStats from "@/components/landing/TrustedStats";
import Features from "@/components/landing/Features";
import Demo from "@/components/landing/Demo";
import HowItWorks from "@/components/landing/HowItWorks";
import Templates from "@/components/landing/Templates";
import DeployAnywhere from "@/components/landing/DeployAnywhere";
import Pricing from "@/components/landing/Pricing";
import Roadmap from "@/components/landing/Roadmap";
import SocialProof from "@/components/landing/SocialProof";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

const Index = () => {
  useEffect(() => {
    const prevBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#ffffff";
    return () => {
      document.body.style.backgroundColor = prevBg;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
      <Navbar />
      <Hero />
      <TrustedStats />
      <Features />
      <Demo />
      <HowItWorks />
      <Templates />
      <DeployAnywhere />
      <Pricing />
      <Roadmap />
      <SocialProof />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;
