import { Check, X, ArrowRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExamReadyHeader } from '../components/ExamReadyHeader';
import { ExamReadyFooter } from '../components/ExamReadyFooter';
import { BotWidget } from '../components/BotWidget';

interface Props {
  onNavigate: (screen: string) => void;
}

const COMPARISON_FEATURES = [
  { feature: 'Assessment Duration', mini: '15 minutes', examReady: '30-40 minutes' },
  { feature: 'Behavioral Questions', mini: '20 questions', examReady: '50+ questions' },
  { feature: 'Overall Readiness Score', mini: true, examReady: true },
  { feature: 'Stress & Anxiety Analysis', mini: false, examReady: true },
  { feature: 'Focus & Concentration Assessment', mini: false, examReady: true },
  { feature: 'Emotional Regulation Insights', mini: false, examReady: true },
  { feature: 'Study Habits Evaluation', mini: false, examReady: true },
  { feature: 'Confidence Level Analysis', mini: false, examReady: true },
  { feature: 'Personalized Coping Strategies', mini: false, examReady: true },
  { feature: 'Detailed LBI Report', mini: false, examReady: true },
  { feature: 'Guidance Bot Support', mini: false, examReady: true },
  { feature: 'Save & Resume Assessment', mini: false, examReady: true },
];

export function ComparePage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ExamReadyHeader 
        showBack 
        onBack={() => onNavigate('exam-ready')} 
        title="Compare Plans"
        showDashboardLink
        onDashboard={() => onNavigate('unified-parent-dashboard')}
      />

      <main className="flex-1 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-[#0B3C5D] mb-4">
              Choose the Right Behavioral Assessment
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Compare our LBI assessment tiers and select the depth of behavioral insights you need.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <Card className="border-gray-200">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl text-[#0B3C5D]">Mini Assessment</CardTitle>
                <p className="text-sm text-gray-500">Quick behavioral readiness check</p>
              </CardHeader>
              <CardContent className="text-center">
                <div className="mb-4">
                  <span className="text-4xl font-bold text-[#0B3C5D]">₹299</span>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full border-[#0B3C5D] text-[#0B3C5D]"
                  onClick={() => onNavigate('exam-ready-checkout')}
                  data-testid="btn-select-mini"
                >
                  Select Mini
                </Button>
              </CardContent>
            </Card>

            <Card className="border-[#4ECDC4] border-2 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-[#4ECDC4] text-white">Most Popular</Badge>
              </div>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl text-[#0B3C5D]">ExamReadiness Index™</CardTitle>
                <p className="text-sm text-gray-500">Deep behavioral LBI analysis</p>
              </CardHeader>
              <CardContent className="text-center">
                <div className="mb-4">
                  <span className="text-4xl font-bold text-[#4ECDC4]">₹999</span>
                </div>
                <Button 
                  className="w-full bg-[#4ECDC4] hover:bg-[#4ECDC4]/90"
                  onClick={() => onNavigate('exam-ready-checkout')}
                  data-testid="btn-select-exam-ready"
                >
                  Select ExamReadiness Index™
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl text-[#0B3C5D]">Feature Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="comparison-table">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Feature</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">Mini</th>
                      <th className="text-center py-3 px-4 font-medium text-[#4ECDC4]">ExamReadiness Index™</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_FEATURES.map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-3 px-4 text-gray-700">{row.feature}</td>
                        <td className="py-3 px-4 text-center">
                          {typeof row.mini === 'boolean' ? (
                            row.mini ? (
                              <Check className="inline text-[#4ECDC4]" size={20} />
                            ) : (
                              <X className="inline text-gray-300" size={20} />
                            )
                          ) : (
                            <span className="text-gray-600">{row.mini}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {typeof row.examReady === 'boolean' ? (
                            row.examReady ? (
                              <Check className="inline text-[#4ECDC4]" size={20} />
                            ) : (
                              <X className="inline text-gray-300" size={20} />
                            )
                          ) : (
                            <span className="text-[#4ECDC4] font-medium">{row.examReady}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 text-center">
            <Button 
              size="lg"
              className="bg-[#4ECDC4] hover:bg-[#4ECDC4]/90 px-8"
              onClick={() => onNavigate('exam-ready-checkout')}
              data-testid="btn-proceed-checkout"
            >
              Proceed to Checkout
              <ArrowRight size={20} className="ml-2" />
            </Button>
          </div>
        </div>
      </main>

      <ExamReadyFooter onDisclaimerClick={() => onNavigate('exam-ready-disclaimer')} />
      <BotWidget mode="pre-purchase" context="compare" />
    </div>
  );
}
