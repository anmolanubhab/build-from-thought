import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="glow-orb w-[500px] h-[500px] bg-[#ff3cac] top-[-200px] left-[-100px] animate-pulse-glow" />
      <div className="glow-orb w-[400px] h-[400px] bg-[#2b86c5] bottom-[-150px] right-[-100px] animate-pulse-glow" />

      <div className="w-full max-w-md relative z-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src="/logo.png" alt="WebdevsAI" className="h-9 w-auto" />
        </div>

        <div className="glass rounded-2xl p-8">
          <h1 className="text-6xl font-display font-extrabold gradient-text mb-4">404</h1>
          <p className="text-lg font-semibold text-foreground mb-2">Page not found</p>
          <p className="text-sm text-muted-foreground mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Button className="gradient-bg text-primary-foreground hover:opacity-90 gap-2" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /> Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
