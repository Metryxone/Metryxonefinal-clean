import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { languages } from '../lib/i18n';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, Check } from 'lucide-react';

interface LanguageSelectorProps {
  variant?: 'default' | 'compact' | 'minimal';
  className?: string;
}

export function LanguageSelector({ variant = 'default', className = '' }: LanguageSelectorProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('metryx_language', langCode);
    setOpen(false);
  };

  if (variant === 'minimal') {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-8 gap-1 text-xs ${className}`}
            data-testid="btn-language-selector"
          >
            <Globe size={14} />
            <span className="hidden sm:inline">{currentLanguage.nativeName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 max-h-80 overflow-y-auto">
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className="flex items-center justify-between cursor-pointer"
              data-testid={`lang-option-${lang.code}`}
            >
              <div className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.nativeName}</span>
              </div>
              {i18n.language === lang.code && (
                <Check size={14} className="text-teal-600" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === 'compact') {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className={`h-8 gap-2 text-xs ${className}`}
            data-testid="btn-language-selector"
          >
            <Globe size={14} />
            {currentLanguage.nativeName}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className="flex items-center justify-between cursor-pointer py-2"
              data-testid={`lang-option-${lang.code}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{lang.flag}</span>
                <div>
                  <p className="text-sm font-medium">{lang.nativeName}</p>
                  <p className="text-xs text-gray-500">{lang.name}</p>
                </div>
              </div>
              {i18n.language === lang.code && (
                <Check size={16} className="text-teal-600" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={`gap-2 ${className}`}
          data-testid="btn-language-selector"
        >
          <Globe size={16} />
          <span className="hidden sm:inline">{currentLanguage.flag}</span>
          <span>{currentLanguage.nativeName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-96 overflow-y-auto">
        <div className="px-3 py-2 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Select Language / भाषा चुनें
          </p>
        </div>
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className="flex items-center justify-between cursor-pointer py-3 px-3"
            data-testid={`lang-option-${lang.code}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{lang.flag}</span>
              <div>
                <p className="text-sm font-medium">{lang.nativeName}</p>
                <p className="text-xs text-gray-500">{lang.name}</p>
              </div>
            </div>
            {i18n.language === lang.code && (
              <div className="flex items-center gap-1 text-teal-600">
                <Check size={16} />
                <span className="text-xs font-medium">Active</span>
              </div>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
