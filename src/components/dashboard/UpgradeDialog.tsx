// path: src/components/dashboard/UpgradeDialog.tsx
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Zap } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Use the light landing/settings palette instead of the dark Workbench one. */
  light?: boolean;
  /** Which plan this waitlist/contact signup is for; also stored on the plan_interest row. */
  plan?: "pro" | "business" | "enterprise";
}

export default function UpgradeDialog({ open, onClose, light = false, plan = "pro" }: Props) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const planLabel = plan === "business" ? "Business" : plan === "enterprise" ? "Enterprise" : "Pro";
  const isEnterprise = plan === "enterprise";

  const colors = light
    ? { text: "#111827", muted: "#6B7280", accent: "#2563EB", success: "#10b981", surface: "#FFFFFF", line: "#E5E7EB" }
    : { text: "var(--wb-text)", muted: "var(--wb-text-muted)", accent: "var(--wb-ember)", success: "var(--wb-circuit)", surface: "var(--wb-surface)", line: "var(--wb-line)" };

  useEffect(() => {
    if (open) {
      setEmail(user?.email || "");
      setSubmitted(false);
    }
  }, [open, user?.email]);

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("plan_interest").insert({
        email: email.trim(),
        plan,
      } as any);
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      toast({
        title: "Couldn't submit",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className={light ? "bg-white border-gray-200 sm:max-w-md" : "bg-[var(--wb-surface)] border-[var(--wb-line)] sm:max-w-md wb-sans"}
      >
        {submitted ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle className="h-10 w-10 mx-auto" style={{ color: colors.success }} />
            <p className="font-semibold" style={{ color: colors.text }}>
              {isEnterprise ? "Thanks — we'll be in touch!" : "You're on the waitlist!"}
            </p>
            <p className="text-sm" style={{ color: colors.muted }}>
              {isEnterprise
                ? `Our team will reach out to ${email} to talk through Enterprise pricing.`
                : `We'll email you at ${email} as soon as ${planLabel} plans are available.`}
            </p>
            <Button onClick={handleClose} className={`mt-2 ${light ? "bg-blue-600 text-white hover:bg-blue-700" : ""}`}>Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2" style={{ color: colors.text }}>
                <Zap className="h-4 w-4" style={{ color: colors.accent }} />
                {isEnterprise ? "Talk to sales" : `Join the ${planLabel} waitlist`}
              </DialogTitle>
              <DialogDescription style={{ color: colors.muted }}>
                {isEnterprise
                  ? "Enterprise plans are set up per organization — leave your email and our team will reach out."
                  : `${planLabel} billing isn't live yet — leave your email and we'll notify you the moment it launches.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5 py-2">
              <Label htmlFor="upgrade-email" style={{ color: colors.muted }}>Email</Label>
              <Input
                id="upgrade-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={light ? "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30" : undefined}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} className={light ? "border-gray-300 text-gray-700 hover:bg-gray-50" : undefined}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !email.trim()}
                className={light ? "bg-blue-600 text-white hover:bg-blue-700" : undefined}
              >
                {submitting ? "Submitting..." : isEnterprise ? "Request Contact" : "Join Waitlist"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
