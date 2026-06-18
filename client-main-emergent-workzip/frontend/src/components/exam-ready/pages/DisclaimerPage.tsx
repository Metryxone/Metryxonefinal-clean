import { Shield, Lock, Clock, Mail, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExamReadyHeader } from '../components/ExamReadyHeader';
import { ExamReadyFooter } from '../components/ExamReadyFooter';

interface Props {
  onNavigate: (screen: string) => void;
}

export function DisclaimerPage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ExamReadyHeader 
        showBack 
        onBack={() => onNavigate('exam-ready')} 
        title="Disclaimer & Privacy" 
      />

      <main className="flex-1 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Shield className="h-16 w-16 text-[#4ECDC4] mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-[#0B3C5D] mb-4">
              Our Commitment to Trust & Privacy
            </h1>
            <p className="text-gray-600">
              At Metryx One, we take your trust seriously. Here's everything you need to know about ExamReadiness Index™.
            </p>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#0B3C5D]">
                  <Shield className="h-5 w-5 text-[#4ECDC4]" />
                  Non-Diagnostic Disclaimer
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600 space-y-4">
                <p>
                  <strong>ExamReadiness Index™ is an LBI-based behavioral assessment tool, not a diagnostic or medical test.</strong>
                </p>
                <p>
                  The assessment is designed to provide parents with insights into their child's psychological readiness for exams - including stress management, focus, emotional regulation, and study habits. The results should be used as a supportive guide for developing exam resilience.
                </p>
                <p>
                  ExamReadiness Index™ does not diagnose learning disabilities, mental health conditions, anxiety disorders, or any medical conditions. It is not a substitute for professional psychological or medical evaluation.
                </p>
                <p>
                  If you have concerns about your child's mental health, anxiety levels, or emotional well-being, please consult qualified professionals such as educational psychologists, licensed counselors, or healthcare providers.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#0B3C5D]">
                  <Lock className="h-5 w-5 text-[#4ECDC4]" />
                  Privacy & Data Protection
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600 space-y-4">
                <p>
                  <strong>We are fully compliant with the Digital Personal Data Protection (DPDP) Act.</strong>
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>All personal data is encrypted in transit and at rest</li>
                  <li>We collect only the minimum data necessary to provide our services</li>
                  <li>Your child's assessment data is never sold to third parties</li>
                  <li>Data is stored on secure servers within India</li>
                  <li>You maintain full control over your data and can request deletion at any time</li>
                </ul>
                <p>
                  For children under 18, parental/guardian consent is required before any assessment. Parents can view, download, or request deletion of their child's data at any time.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#0B3C5D]">
                  <Clock className="h-5 w-5 text-[#4ECDC4]" />
                  Data Retention Policy
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600 space-y-4">
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Assessment data:</strong> Retained for 12 months from the date of completion</li>
                  <li><strong>Reports:</strong> Available for download for 12 months</li>
                  <li><strong>Account information:</strong> Retained until account deletion is requested</li>
                  <li><strong>Anonymous analytics:</strong> May be retained indefinitely for service improvement</li>
                </ul>
                <p>
                  You can request immediate deletion of your data by contacting our support team. Deletion requests are processed within 30 days.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#0B3C5D]">
                  <Mail className="h-5 w-5 text-[#4ECDC4]" />
                  Contact Us
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600 space-y-4">
                <p>
                  If you have any questions about our privacy practices, data handling, or this disclaimer, please contact us:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p><strong>Email:</strong> privacy@metryxone.com</p>
                  <p><strong>Data Protection Officer:</strong> dpo@metryxone.com</p>
                  <p><strong>Support:</strong> support@metryxone.com</p>
                </div>
                <p className="text-sm">
                  Response time: We aim to respond to all inquiries within 48 business hours.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 text-center">
            <Button 
              variant="outline"
              onClick={() => onNavigate('exam-ready')}
              data-testid="btn-back-home"
            >
              <ArrowLeft size={16} className="mr-2" />
              Back to ExamReadiness Index™
            </Button>
          </div>
        </div>
      </main>

      <ExamReadyFooter />
    </div>
  );
}
