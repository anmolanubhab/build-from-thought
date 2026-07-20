import { useEffect, useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  Eye,
  EyeOff,
  MessageSquare,
  Cpu,
  Pencil,
  Rocket,
} from "lucide-react";

const workflow = [
  { icon: MessageSquare, label: "Prompt", desc: "Describe the app you want" },
  { icon: Cpu, label: "Generate", desc: "AI writes the working code" },
  { icon: Pencil, label: "Edit", desc: "Refine it visually or in code" },
  { icon: Rocket, label: "Deploy", desc: "Ship it live in one click" },
];

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const prevBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#ffffff";
    return () => {
      document.body.style.backgroundColor = prevBg;
    };
  }, []);

  if (!isLoading && user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden border-r border-gray-100 flex-col justify-center px-16 xl:px-20">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px circle at 15% 15%, rgba(37,99,235,0.06), transparent 60%), radial-gradient(500px circle at 85% 85%, rgba(6,182,212,0.05), transparent 60%)",
          }}
        />

        <div className="relative fade-up max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-14">
            <span className="text-2xl font-display font-bold text-gray-900">
              Webdevs
              <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">AI</span>
            </span>
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 mb-6">
            <Sparkles size={14} className="text-blue-600" />
            <span className="text-xs font-medium text-gray-700">AI-Powered App Builder</span>
          </div>

          <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-gray-900 mb-4">
            Welcome Back
          </h1>
          <p className="text-gray-500 mb-12 leading-relaxed">
            Sign in to keep building production-ready apps from a single prompt.
          </p>

          <div className="space-y-5">
            {workflow.map(({ icon: Icon, label, desc }, i) => (
              <div key={label} className="flex items-center gap-4 fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="w-11 h-11 rounded-xl border border-gray-200 bg-white shadow-sm flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                {i < workflow.length - 1 && (
                  <div className="flex-1 flex justify-end pr-1">
                    <div className="w-px h-6 bg-gray-200" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative">
        <div
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{
            background: "radial-gradient(500px circle at 50% 0%, rgba(37,99,235,0.06), transparent 60%)",
          }}
        />

        <div className="w-full max-w-md relative z-10">
          <Link to="/" className="flex lg:hidden items-center justify-center gap-2 mb-8">
            <span className="text-2xl font-display font-bold text-gray-900">
              Webdevs
              <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">AI</span>
            </span>
          </Link>

          <div className="rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 p-8">
            <h2 className="text-2xl font-display font-bold text-gray-900 text-center mb-2">Sign in</h2>
            <p className="text-gray-500 text-center text-sm mb-7">Welcome back — enter your details to continue</p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-600">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30 focus:border-blue-400"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30 focus:border-blue-400"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <Checkbox
                    checked={rememberMe}
                    onCheckedChange={(v) => setRememberMe(v === true)}
                    className="border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  Remember me
                </label>
                <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                disabled={loading || !email.trim() || !password.trim()}
                className="w-full bg-blue-600 text-white font-semibold h-11 hover:bg-blue-700 hover:-translate-y-0.5 shadow-sm hover:shadow-lg transition-all"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Continue <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Don't have an account?{" "}
              <Link to="/signup" className="text-blue-600 hover:text-blue-700 hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            By continuing, you agree to our{" "}
            <Link to="/terms" className="text-gray-500 hover:text-gray-700 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-gray-500 hover:text-gray-700 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
