import { Screen } from '../../App';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Shield, Lock, Eye, CheckCircle, AlertTriangle } from 'lucide-react';

interface Props {
  onNavigate: (s: Screen) => void;
}

export function StudentConsentExplainer({ onNavigate }: Props) {
  const isMinor = true;
  const hasConsent = false;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onNavigate('student-exam-list')}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
            data-testid="button-back"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold">Learning Behaviour Insights</h1>
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div className="text-center mb-8">
          <div className="mx-auto h-20 w-20 rounded-full bg-[#0B3C5D] flex items-center justify-center mb-4">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">What are Learning Behaviour Insights?</h2>
          <p className="text-gray-400">
            Understanding how you learn helps us personalize your education journey
          </p>
        </div>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start gap-3">
              <Eye className="h-5 w-5 text-[#4ECDC4] mt-0.5 shrink-0" />
              <div>
                <h3 className="font-medium text-white">What We Observe</h3>
                <p className="text-sm text-gray-400">
                  We analyze patterns in how you approach problems, manage time, and handle challenges during assessments.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-[#4ECDC4] mt-0.5 shrink-0" />
              <div>
                <h3 className="font-medium text-white">Your Privacy</h3>
                <p className="text-sm text-gray-400">
                  All data is encrypted and protected under DPDP Act guidelines. Only you and your authorized guardians can view insights.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-[#4ECDC4] mt-0.5 shrink-0" />
              <div>
                <h3 className="font-medium text-white">Benefits</h3>
                <p className="text-sm text-gray-400">
                  Get personalized study tips, understand your strengths, and discover areas for growth.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isMinor && !hasConsent ? (
          <Card className="bg-amber-900/30 border-amber-600/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-medium text-amber-300">Parent Consent Required</h3>
                  <p className="text-sm text-amber-200/70 mt-1">
                    Since you're under 18, your parent or guardian needs to approve access to Learning Behaviour Insights. 
                    Ask them to grant consent through their Metryx One dashboard.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-teal-900/30 border-teal-600/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-teal-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-medium text-teal-300">Access Approved</h3>
                  <p className="text-sm text-teal-200/70 mt-1">
                    You have full access to Learning Behaviour Insights. Take assessments to build your learning profile.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="pt-4 space-y-3">
          {isMinor && !hasConsent ? (
            <Button 
              className="w-full h-12 bg-gray-700 text-gray-400"
              disabled
              data-testid="button-start-disabled"
            >
              Waiting for Parent Consent
            </Button>
          ) : (
            <Button 
              className="w-full h-12 bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
              onClick={() => onNavigate('assessment-start')}
              data-testid="button-start-assessment"
            >
              Start Behavioural Assessment
            </Button>
          )}
          
          <Button 
            variant="outline"
            className="w-full h-12 border-gray-600 text-gray-300 hover:bg-gray-800"
            onClick={() => onNavigate('student-exam-list')}
            data-testid="button-back-to-exams"
          >
            Back to Exams
          </Button>
        </div>
      </main>
    </div>
  );
}
