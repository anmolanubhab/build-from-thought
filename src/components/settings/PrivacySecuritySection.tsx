// path: src/components/settings/PrivacySecuritySection.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import SettingsCard from "./SettingsCard";

interface TotpFactor {
  id: string;
  status: "verified" | "unverified";
  friendly_name?: string;
  created_at: string;
}

interface EnrollData {
  id: string;
  totp: {
    qr_code: string;
    secret: string;
    uri: string;
  };
}

export default function PrivacySecuritySection() {
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [unenrollingId, setUnenrollingId] = useState<string | null>(null);
  const [startingEnroll, setStartingEnroll] = useState(false);

  const refreshFactors = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors((data?.totp as TotpFactor[]) || []);
    } catch (err) {
      toast({
        title: "Couldn't load two-factor status",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoadingFactors(false);
    }
  };

  useEffect(() => {
    refreshFactors();
  }, []);

  const verifiedFactor = factors.find((f) => f.status === "verified");

  const startEnroll = async () => {
    setStartingEnroll(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setEnrollData(data as EnrollData);
      setVerified(false);
      setVerifyCode("");
      setEnrolling(true);
    } catch (err) {
      toast({
        title: "Couldn't start enrollment",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setStartingEnroll(false);
    }
  };

  const verifyEnroll = async () => {
    if (!enrollData || verifyCode.length !== 6) return;
    setVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollData.id,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollData.id,
        challengeId: challengeData.id,
        code: verifyCode,
      });
      if (verifyError) throw verifyError;

      setVerified(true);
      setEnrolling(false);
      setEnrollData(null);
      setVerifyCode("");
      toast({ title: "Two-factor authentication enabled" });
      refreshFactors();
    } catch (err) {
      toast({
        title: "Couldn't verify code",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleDialogOpenChange = async (open: boolean) => {
    if (!open && enrollData && !verified) {
      // Abandoned enrollment without verifying — clean up the unverified factor.
      try {
        await supabase.auth.mfa.unenroll({ factorId: enrollData.id });
      } catch {
        // best-effort cleanup, ignore errors
      }
      setEnrollData(null);
      setVerifyCode("");
    }
    setEnrolling(open);
  };

  const removeFactor = async (factorId: string) => {
    setUnenrollingId(factorId);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast({ title: "Two-factor authentication removed" });
      refreshFactors();
    } catch (err) {
      toast({
        title: "Couldn't remove two-factor authentication",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setUnenrollingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <SettingsCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Two-factor authentication</h3>
        <p className="text-xs text-gray-500 mb-4">
          Add an extra layer of security to your account with an authenticator app.
        </p>

        {!loadingFactors && verifiedFactor && (
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-start gap-3 min-w-0">
              <ShieldCheck className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  Two-factor authentication is enabled
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {verifiedFactor.friendly_name || "Authenticator app"} · added{" "}
                  {new Date(verifiedFactor.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
              disabled={unenrollingId === verifiedFactor.id}
              onClick={() => removeFactor(verifiedFactor.id)}
            >
              {unenrollingId === verifiedFactor.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Remove"
              )}
            </Button>
          </div>
        )}

        {!loadingFactors && !verifiedFactor && (
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-start gap-3 min-w-0">
              <ShieldOff className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  Two-factor authentication is not enabled
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Protect your account with a one-time code from an authenticator app.
                </p>
              </div>
            </div>
            <Button
              onClick={startEnroll}
              disabled={startingEnroll}
              className="bg-blue-600 text-white hover:bg-blue-700 shrink-0"
            >
              {startingEnroll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Enable two-factor authentication"
              )}
            </Button>
          </div>
        )}
      </SettingsCard>

      {enrolling && enrollData && (
        <Dialog open={enrolling} onOpenChange={handleDialogOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set up two-factor authentication</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <img src={enrollData.totp.qr_code} className="mx-auto w-48 h-48" alt="Two-factor authentication QR code" />
              <p className="text-xs text-gray-500 text-center">
                Scan this QR code with your authenticator app (Google Authenticator, 1Password,
                Authy, etc.), then enter the 6-digit code it shows.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="verify-code" className="text-gray-600">
                  Verification code
                </Label>
                <Input
                  id="verify-code"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="000000"
                  className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500/30 text-center tracking-widest"
                />
              </div>
              <Button
                onClick={verifyEnroll}
                disabled={verifying || verifyCode.length !== 6}
                className="bg-blue-600 text-white hover:bg-blue-700 w-full"
              >
                {verifying ? "Verifying..." : "Verify & enable"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
