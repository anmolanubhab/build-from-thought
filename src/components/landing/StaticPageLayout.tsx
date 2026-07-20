import type { ReactNode } from "react";
import { useEffect } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

interface Props {
  title: string;
  children: ReactNode;
}

const StaticPageLayout = ({ title, children }: Props) => {
  useEffect(() => {
    const prevBg = document.body.style.backgroundColor;
    const prevTitle = document.title;
    document.body.style.backgroundColor = "#ffffff";
    document.title = `${title} — WebdevsAI`;
    return () => {
      document.body.style.backgroundColor = prevBg;
      document.title = prevTitle;
    };
  }, [title]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Navbar />
      <main className="pt-32 pb-24">
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-gray-900 mb-8 tracking-tight">{title}</h1>
          <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed space-y-5">{children}</div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default StaticPageLayout;
