// path: src/pages/Signup.tsx
import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, User, ArrowRight, Sparkles } from "lucide-react";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { user, isLoading, signup } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      // Redeemed later by AuthContext once the account is actually signed in
      // (signup requires email confirmation first, so there's no session yet).
      localStorage.setItem("pending_referral_id", ref);
    }
    const workspaceCode = params.get("workspace");
    if (workspaceCode) {
      localStorage.setItem("pending_workspace_invite", workspaceCode);
    }
  }, []);

  if (!isLoading && user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signup(name, email, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
        <div className="glow-orb w-[500px] h-[500px] bg-[#784ba0] top-[-200px] right-[-100px] animate-pulse-glow" />
        <div className="w-full max-w-md relative z-10">
          <div className="glass rounded-2xl p-8 text-center">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-display font-bold text-foreground mb-2">Check your email</h1>
            <p className="text-muted-foreground text-sm mb-6">
              We've sent a verification link to <span className="text-foreground font-medium">{email}</span>. Click it to activate your account.
            </p>
            <Link to="/login">
              <Button variant="outline" className="border-primary/50">Go to Login</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="glow-orb w-[500px] h-[500px] bg-[#784ba0] top-[-200px] right-[-100px] animate-pulse-glow" />
      <div className="glow-orb w-[400px] h-[400px] bg-[#ff3cac] bottom-[-150px] left-[-100px] animate-pulse-glow" />

      <div className="w-full max-w-md relative z-10">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <Sparkles className="h-7 w-7 text-primary" />
          <span className="text-2xl font-display font-bold gradient-text">WebdevsAI</span>
        </Link>

        <div className="glass rounded-2xl p-8">
          <h1 className="text-2xl font-display font-bold text-foreground text-center mb-2">Create your account</h1>
          <p className="text-muted-foreground text-center text-sm mb-6">Start building apps with AI</p>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground/80">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="name" type="text" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} className="pl-10 bg-secondary/50 border-border/50 focus:border-primary" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground/80">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-secondary/50 border-border/50 focus:border-primary" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground/80">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-secondary/50 border-border/50 focus:border-primary" required minLength={6} />
              </div>
              {password.length > 0 && password.length < 6 && (
                <p className="text-xs text-destructive">Password must be at least 6 characters</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={loading || !name.trim() || !email.trim() || !password.trim()}
              className="w-full gradient-bg text-primary-foreground font-semibold h-11 hover:opacity-90 transition-opacity"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                <span className="flex items-center gap-2">Create Account <ArrowRight className="h-4 w-4" /></span>
              )}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account? <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
