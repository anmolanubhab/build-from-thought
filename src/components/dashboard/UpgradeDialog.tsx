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
}

export default function UpgradeDialog({ open, onClose }: Props) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
        plan: "pro",
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
      <DialogContent className="bg-[var(--wb-surface)] border-[var(--wb-line)] sm:max-w-md wb-sans">
        {submitted ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle className="h-10 w-10 mx-auto" style={{ color: "var(--wb-circuit)" }} />
            <p className="font-semibold" style={{ color: "var(--wb-text)" }}>You're on the waitlist!</p>
            <p className="text-sm" style={{ color: "var(--wb-text-muted)" }}>
              We'll email you at {email} as soon as Pro plans are available.
            </p>
            <Button onClick={handleClose} className="mt-2">Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2" style={{ color: "var(--wb-text)" }}>
                <Zap className="h-4 w-4" style={{ color: "var(--wb-ember)" }} /> Join the Pro waitlist
              </DialogTitle>
              <DialogDescription style={{ color: "var(--wb-text-muted)" }}>
                Pro billing isn't live yet — leave your email and we'll notify you the moment it launches.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5 py-2">
              <Label htmlFor="upgrade-email" style={{ color: "var(--wb-text-muted)" }}>Email</Label>
              <Input
                id="upgrade-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting || !email.trim()}>
                {submitting ? "Submitting..." : "Join Waitlist"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
