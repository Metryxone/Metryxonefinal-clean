import React from 'react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F5F0E8] text-[#1A1A1A] font-sans overflow-x-hidden selection:bg-[#E8611A] selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto bg-white/90 backdrop-blur-md rounded-2xl px-6 py-3 flex items-center justify-between border border-[#1A1A1A]/10 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#E8611A] rounded-lg flex items-center justify-center text-white font-bold text-xl leading-none">
              M
            </div>
            <span className="font-extrabold text-xl tracking-tight">MetryxOne</span>
          </div>

          <div className="hidden md:flex items-center gap-8 font-medium">
            <a href="#" className="hover:text-[#E8611A] transition-colors">K12</a>
            <a href="#" className="hover:text-[#E8611A] transition-colors">Higher Ed</a>
            <a href="#" className="hover:text-[#E8611A] transition-colors">Families</a>
            <a href="#" className="hover:text-[#E8611A] transition-colors">Enterprise</a>
          </div>

          <div className="flex items-center gap-4">
            <button className="hidden md:block font-bold hover:text-[#E8611A] transition-colors">
              Login
            </button>
            <button className="bg-[#E8611A] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[#D4501A] transition-transform hover:-translate-y-0.5 active:translate-y-0 shadow-[0_4px_14px_rgba(232,97,26,0.3)]">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 relative">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative z-10">
            <div className="absolute -top-12 -left-12 text-[#F5C842] text-6xl opacity-50 select-none animate-pulse">✦</div>
            <h1 className="text-5xl md:text-7xl font-black leading-[1.1] mb-6 tracking-tight">
              Behavioral intelligence, reimagined for{" "}
              <span className="font-['Dancing_Script'] italic text-[#E8611A] font-normal tracking-normal text-6xl md:text-8xl pr-2">
                students
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-700 font-medium mb-10 max-w-xl leading-relaxed">
              Helping your students succeed and thrive through behavioral science, AI coaching, and gamified learning — when and where they need it most.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <button className="bg-[#E8611A] text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-[#D4501A] transition-all hover:-translate-y-1 active:translate-y-0 shadow-[0_8px_24px_rgba(232,97,26,0.3)] flex items-center gap-2">
                Start Free Assessment <span className="text-xl leading-none">→</span>
              </button>
              <div className="flex -space-x-4 ml-2 mt-4 sm:mt-0">
                 {/* Decorative avatars for social proof */}
                 <div className="w-12 h-12 rounded-full border-4 border-[#F5F0E8] bg-gray-200 overflow-hidden"><img src="/__mockup/images/student-hero-1.png" alt="Student" className="w-full h-full object-cover" /></div>
                 <div className="w-12 h-12 rounded-full border-4 border-[#F5F0E8] bg-gray-300 overflow-hidden"><img src="/__mockup/images/student-hero-2.png" alt="Student" className="w-full h-full object-cover" /></div>
                 <div className="w-12 h-12 rounded-full border-4 border-[#F5F0E8] bg-gray-400 overflow-hidden"><img src="/__mockup/images/student-hero-3.png" alt="Student" className="w-full h-full object-cover" /></div>
                 <div className="w-12 h-12 rounded-full border-4 border-[#F5F0E8] bg-[#F5C842] flex items-center justify-center font-bold text-sm">+10k</div>
              </div>
            </div>
          </div>

          <div className="relative h-[600px] hidden lg:block">
            {/* Collage Container */}
            <div className="absolute inset-0">
              {/* Photo 1: Blue panel */}
              <div className="absolute top-10 right-20 w-64 h-72 bg-[#4A90D9] rounded-3xl -rotate-6 shadow-xl p-3 pb-8 transition-transform hover:-rotate-3 duration-300">
                <div className="w-full h-full rounded-2xl overflow-hidden relative">
                  <img src="/__mockup/images/student-hero-1.png" alt="Student 1" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 mix-blend-overlay bg-[#4A90D9] opacity-20"></div>
                </div>
                <div className="absolute -bottom-6 -left-8 text-5xl text-[#1A1A1A] rotate-12 drop-shadow-md">★</div>
              </div>

              {/* Photo 2: Salmon panel */}
              <div className="absolute top-48 left-4 w-56 h-64 bg-[#E87B6D] rounded-3xl rotate-3 shadow-xl p-3 pb-8 z-10 transition-transform hover:rotate-6 duration-300">
                <div className="w-full h-full rounded-2xl overflow-hidden relative">
                  <img src="/__mockup/images/student-hero-2.png" alt="Student 2" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 mix-blend-overlay bg-[#E87B6D] opacity-20"></div>
                </div>
                <div className="absolute -top-8 -right-4 text-4xl text-[#E8611A] rotate-[-15deg]">✧</div>
              </div>

              {/* Photo 3: Yellow panel */}
              <div className="absolute bottom-10 right-10 w-60 h-64 bg-[#F5C842] rounded-3xl rotate-[8deg] shadow-xl p-3 pb-8 z-20 transition-transform hover:rotate-12 duration-300">
                <div className="w-full h-full rounded-2xl overflow-hidden relative">
                  <img src="/__mockup/images/student-hero-3.png" alt="Student 3" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 mix-blend-overlay bg-[#F5C842] opacity-20"></div>
                </div>
                <div className="absolute top-1/2 -left-12 bg-white px-4 py-2 rounded-2xl rounded-tr-none shadow-lg font-bold text-sm transform -rotate-6">
                  "I love learning now!"
                </div>
              </div>
            </div>
            
            {/* Doodle squiggles */}
            <svg className="absolute -z-10 top-0 left-0 w-full h-full opacity-30" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 250 Q 150 50 250 250 T 450 250" stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" strokeDasharray="10 15"/>
              <circle cx="400" cy="100" r="20" stroke="#E8611A" strokeWidth="4" />
              <path d="M100 400 L 150 350 L 200 400" stroke="#4A90D9" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y-2 border-[#1A1A1A]/5 bg-[#F5F0E8]/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x-2 divide-[#1A1A1A]/5">
            <div>
              <div className="text-4xl md:text-5xl font-black text-[#4A90D9] mb-2">500+</div>
              <div className="font-bold text-gray-600 uppercase tracking-wider text-sm">Schools</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-black text-[#E87B6D] mb-2">19</div>
              <div className="font-bold text-gray-600 uppercase tracking-wider text-sm">Behavioral Domains</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-black text-[#F5C842] mb-2">97</div>
              <div className="font-bold text-gray-600 uppercase tracking-wider text-sm">Subdomains</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-black text-[#E8611A] mb-2">10K+</div>
              <div className="font-bold text-gray-600 uppercase tracking-wider text-sm">Students</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute top-20 right-10 text-7xl text-[#E87B6D] opacity-20 -rotate-12">✦</div>
        <div className="absolute bottom-20 left-10 text-6xl text-[#4A90D9] opacity-20 rotate-12">★</div>
        
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black mb-6">
              Everything you need to <br/>
              <span className="relative inline-block mt-2">
                <span className="relative z-10">understand and grow</span>
                <span className="absolute bottom-1 left-0 w-full h-4 bg-[#F5C842]/50 -z-10 -rotate-1"></span>
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-transparent hover:border-[#E8611A] transition-colors group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#4A90D9]/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
              <div className="w-16 h-16 bg-[#4A90D9] rounded-2xl flex items-center justify-center text-white text-2xl mb-8 shadow-lg rotate-3">
                📊
              </div>
              <h3 className="text-2xl font-black mb-4">LBI™ Assessment</h3>
              <p className="text-gray-600 font-medium leading-relaxed">
                Comprehensive evaluation covering 19 domains and 97 subdomains, delivering an instant, actionable behavioral report.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-transparent hover:border-[#E8611A] transition-colors group relative overflow-hidden translate-y-4 md:-translate-y-4">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#E87B6D]/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
              <div className="w-16 h-16 bg-[#E87B6D] rounded-2xl flex items-center justify-center text-white text-2xl mb-8 shadow-lg -rotate-3">
                🎯
              </div>
              <h3 className="text-2xl font-black mb-4">ExamReadiness Index™</h3>
              <p className="text-gray-600 font-medium leading-relaxed">
                Measure psychological and cognitive readiness for high-stakes exams to ensure students perform at their absolute peak.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-transparent hover:border-[#E8611A] transition-colors group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#F5C842]/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
              <div className="w-16 h-16 bg-[#F5C842] rounded-2xl flex items-center justify-center text-white text-2xl mb-8 shadow-lg rotate-6">
                🤖
              </div>
              <h3 className="text-2xl font-black mb-4">AI Mentor (Pragati)</h3>
              <p className="text-gray-600 font-medium leading-relaxed">
                Personalized, empathetic coaching available 24/7 to guide students through challenges and celebrate their wins.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-24 px-6 bg-[#1A1A1A] text-[#F5F0E8] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8cGF0aCBkPSJNMCAwTDggOFpNOCAwTDAgOFoiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')]"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="text-8xl text-[#E8611A] font-['Dancing_Script'] leading-none h-12 mb-4">"</div>
          <h2 className="text-3xl md:text-5xl font-black leading-tight mb-12">
            MetryxOne identified my son's learning gaps in 20 minutes. <span className="text-[#F5C842]">Changed everything.</span>
          </h2>
          <div className="flex items-center justify-center gap-4">
            <div className="w-14 h-14 bg-[#E87B6D] rounded-full flex items-center justify-center font-bold text-xl text-white">
              P
            </div>
            <div className="text-left">
              <div className="font-bold text-xl">Priya S.</div>
              <div className="text-[#F5F0E8]/70 font-medium">Parent of 9th Grader</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg flex items-center justify-center text-white font-bold text-xl leading-none">
              M
            </div>
            <span className="font-black text-xl">MetryxOne</span>
          </div>
          
          <div className="flex gap-6 font-medium text-gray-600">
            <a href="#" className="hover:text-[#E8611A]">Privacy</a>
            <a href="#" className="hover:text-[#E8611A]">Terms</a>
            <a href="#" className="hover:text-[#E8611A]">Contact</a>
          </div>
          
          <div className="text-sm font-bold text-gray-500">
            © 2024 MetryxOne. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
