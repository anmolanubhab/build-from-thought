// path: src/components/landing/PlanInterestDialog.tsx
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { CheckCircle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  plan: "pro" | "enterprise";
}

export default function PlanInterestDialog({ open, onClose, plan }: Props) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setEmail("");
    setMessage("");
    setSubmitted(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("plan_interest").insert({
        email: email.trim(),
        plan,
        message: message.trim() || null,
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

  const isPro = plan === "pro";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md bg-white text-gray-900 border-gray-200">
        {submitted ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="font-semibold text-gray-900">
              {isPro ? "You're on the waitlist!" : "Thanks — we'll be in touch"}
            </p>
            <p className="text-sm text-gray-500">
              {isPro
                ? "We'll email you as soon as Pro plans are available."
                : "Our team will reach out to your email about Enterprise."}
            </p>
            <Button onClick={handleClose} className="mt-2 bg-blue-600 text-white hover:bg-blue-700">Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-gray-900">{isPro ? "Join the Pro waitlist" : "Contact Sales"}</DialogTitle>
              <DialogDescription className="text-gray-500">
                {isPro
                  ? "Pro billing isn't live yet — leave your email and we'll notify you the moment it launches."
                  : "Tell us a bit about your team and we'll follow up about Enterprise."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="plan-interest-email" className="text-gray-700">Email</Label>
                <Input
                  id="plan-interest-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30"
                />
              </div>
              {!isPro && (
                <div className="space-y-1.5">
                  <Label htmlFor="plan-interest-message" className="text-gray-700">What are you looking for? (optional)</Label>
                  <Textarea
                    id="plan-interest-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Team size, use case, timeline..."
                    rows={3}
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} className="border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting || !email.trim()} className="bg-blue-600 text-white hover:bg-blue-700">
                {submitting ? "Submitting..." : isPro ? "Join Waitlist" : "Send"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
