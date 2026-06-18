import { Shield, Lock } from 'lucide-react';

const brand = {
  primary: '#1F3C88',
  accent: '#2EC4B6',
};

export function InstituteFooter() {
  return (
    <footer className="bg-white border-t border-gray-100 py-2.5 px-4 font-['Inter',sans-serif]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-[9px] text-gray-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Shield size={9} style={{ color: brand.accent }} />
              <span>Enterprise Grade Security</span>
            </div>
            <div className="flex items-center gap-1">
              <Lock size={9} style={{ color: brand.accent }} />
              <span>DPDP Compliant</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Terms</span>
            <span className="text-gray-300">·</span>
            <span>Privacy</span>
            <span className="text-gray-300">·</span>
            <span>Support</span>
            <span className="text-gray-300">·</span>
            <span>© 2026 MetryxOne</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
