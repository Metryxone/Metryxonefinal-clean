import { useState } from 'react';
import { Mail, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExamReadyHeader } from '../components/ExamReadyHeader';
import { ExamReadyFooter } from '../components/ExamReadyFooter';
import { authService } from '../services/apiClient';

interface Props {
  onNavigate: (screen: string) => void;
  onLoginSuccess: () => void;
  redirectTo?: string;
}

export function LoginPage({ onNavigate, onLoginSuccess }: Props) {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestOtp = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authService.requestOtp(email);
      setStep('otp');
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length < 4) {
      setError('Please enter a valid OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authService.verifyOtp(email, otp);
      onLoginSuccess();
    } catch (err) {
      setError('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = authService.getGoogleLoginUrl();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ExamReadyHeader 
        showBack 
        onBack={() => onNavigate('exam-ready')} 
        title="Sign In" 
      />

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-[#0B3C5D]">
              {step === 'email' ? 'Welcome to ExamReadiness Index™' : 'Enter OTP'}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-2">
              {step === 'email' 
                ? 'Sign in to access your assessment' 
                : `We've sent a code to ${email}`}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {step === 'email' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="parent@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRequestOtp()}
                    disabled={loading}
                    data-testid="input-email"
                  />
                </div>
                <Button 
                  className="w-full bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
                  onClick={handleRequestOtp}
                  disabled={loading}
                  data-testid="btn-request-otp"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin mr-2" />
                  ) : (
                    <Mail size={16} className="mr-2" />
                  )}
                  {loading ? 'Sending...' : 'Send OTP'}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">or continue with</span>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  data-testid="btn-google-login"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="otp">One-Time Password</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                    disabled={loading}
                    className="text-center text-2xl tracking-widest"
                    data-testid="input-otp"
                  />
                </div>
                <Button 
                  className="w-full bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
                  onClick={handleVerifyOtp}
                  disabled={loading}
                  data-testid="btn-verify-otp"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin mr-2" />
                  ) : (
                    <ArrowRight size={16} className="mr-2" />
                  )}
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </Button>
                <button 
                  className="w-full text-sm text-[#0B3C5D] hover:underline"
                  onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                  disabled={loading}
                >
                  Use a different email
                </button>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <ExamReadyFooter onDisclaimerClick={() => onNavigate('exam-ready-disclaimer')} />
    </div>
  );
}
