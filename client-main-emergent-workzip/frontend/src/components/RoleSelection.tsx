import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Screen } from '../App';
import { User, School, GraduationCap, ArrowRight } from 'lucide-react';
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

interface RoleSelectionProps {
  onNavigate: (screen: Screen) => void;
}

export function RoleSelection({ onNavigate }: RoleSelectionProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <Navbar onNavigate={onNavigate} currentScreen="role-selection" />

      <div className="flex-1 flex items-center justify-center pt-20 p-4">
      <Card className="w-full max-w-2xl shadow-xl border-0">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-14 w-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(11, 60, 93, 0.1)" }}>
            <GraduationCap className="h-7 w-7" style={{ color: "#0B3C5D" }} />
          </div>
          <CardTitle className="text-2xl font-bold" style={{ color: '#0B3C5D' }}>
            Welcome to MetryxOne
          </CardTitle>
          <CardDescription className="text-sm mt-2">
            Choose how you want to access the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4 p-6">
          <button 
            className="group relative rounded-xl border-2 bg-white p-6 text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ borderColor: 'var(--border-subtle)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0B3C5D'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#0B3C5D'; }}
            onClick={() => onNavigate('unified-parent-dashboard')}
            data-testid="button-role-parent"
          >
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(11, 60, 93, 0.08)" }}>
              <User className="h-6 w-6" style={{ color: '#0B3C5D' }} />
            </div>
            <h3 className="text-base font-bold" style={{ color: '#0B3C5D' }}>
              Parent / Guardian
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Track your child's academic progress, manage exams, and view behavioural insights
            </p>
            <div className="mt-3 flex items-center text-xs font-medium" style={{ color: '#4ECDC4' }}>
              Continue as Parent
              <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          <button 
            className="group relative rounded-xl border-2 bg-white p-6 text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ borderColor: 'var(--border-subtle)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4ECDC4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#4ECDC4'; }}
            onClick={() => onNavigate('unified-institute-dashboard')}
            data-testid="button-role-institute"
          >
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(78, 205, 196, 0.08)" }}>
              <School className="h-6 w-6" style={{ color: '#4ECDC4' }} />
            </div>
            <h3 className="text-base font-bold" style={{ color: '#0B3C5D' }}>
              Institute / School
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Manage students, create exam templates, handle enrollments, and track performance
            </p>
            <div className="mt-3 flex items-center text-xs font-medium" style={{ color: '#4ECDC4' }}>
              Continue as Institute
              <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        </CardContent>
      </Card>
      </div>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}
