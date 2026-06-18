import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BotMessage } from '../types';
import { botService } from '../services/apiClient';

interface Props {
  mode: 'pre-purchase' | 'post-purchase';
  attemptId?: string;
  context?: string;
}

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  'pre-purchase': [
    'What is ExamReadiness Index?',
    'How long does the assessment take?',
    'Is this a diagnostic test?',
    'What happens after completion?',
  ],
  'post-purchase': [
    'Explain my report',
    'How can I improve?',
    'What are the next steps?',
    'Schedule a counseling call',
  ],
  'login': [
    'How do I create an account?',
    'I forgot my password',
    'What is MetryxOne?',
    'Is my data secure?',
  ],
  'dashboard': [
    'How do I add a child?',
    'What is LBI assessment?',
    'How to track exam progress?',
    'Explain consent for minors',
  ],
  'exam-ready': [
    'What is ExamReadiness Index?',
    'How does LBI work?',
    'What does the report include?',
    'How much does it cost?',
  ],
  'assessment': [
    'Can I pause the assessment?',
    'How long will this take?',
    'What if I get distracted?',
    'Can I retake the assessment?',
  ],
  'default': [
    'Help me get started',
    'What can MetryxOne do?',
    'Contact support',
    'Privacy and data security',
  ],
};

// Get question category based on context
function getQuestionCategory(context?: string, mode?: string): string {
  if (!context) return mode || 'default';
  
  const ctx = context.toLowerCase();
  if (ctx.includes('login') || ctx.includes('registration') || ctx.includes('forgot')) return 'login';
  if (ctx.includes('dashboard') || ctx.includes('parent')) return 'dashboard';
  if (ctx.includes('exam-ready-assessment') || ctx.includes('assessment')) return 'assessment';
  if (ctx.includes('exam-ready')) return 'exam-ready';
  if (ctx.includes('report')) return 'post-purchase';
  return mode || 'default';
}

// Get greeting based on context
function getGreeting(context?: string): string {
  if (!context) return 'Hi! I\'m here to help. What would you like to know?';
  
  const ctx = context.toLowerCase();
  if (ctx.includes('login') || ctx.includes('registration')) {
    return 'Hi! Need help getting started with MetryxOne? I\'m here to assist!';
  }
  if (ctx.includes('dashboard')) {
    return 'Hi! I can help you navigate your dashboard and answer questions about your child\'s progress.';
  }
  if (ctx.includes('exam-ready')) {
    return 'Hi! I can help you understand ExamReadiness Index™ and the LBI assessment. Ask me anything!';
  }
  if (ctx.includes('assessment')) {
    return 'Hi! I\'m here if you need any help during your assessment. Take your time!';
  }
  return 'Hi! I\'m here to help. What would you like to know?';
}

export function BotWidget({ mode, attemptId, context }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const questionCategory = getQuestionCategory(context, mode);
  const [messages, setMessages] = useState<BotMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: getGreeting(context),
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: BotMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = mode === 'pre-purchase'
        ? await botService.sendPrePurchaseMessage(text, context)
        : await botService.sendPostPurchaseMessage(text, attemptId || '');

      const botMessage: BotMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, botMessage]);
    } catch {
      const fallbackMessage: BotMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, I\'m having trouble connecting. Please try again or contact support@metryxone.com.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 animate-bounce hover:animate-none transition-all duration-300 hover:shadow-xl"
          style={{ backgroundColor: '#4ECDC4' }}
          data-testid="bot-widget-trigger"
        >
          <Sparkles size={24} />
        </Button>
      )}

      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-80 md:w-96 h-[480px] flex flex-col shadow-2xl z-50 overflow-hidden">
          <div className="text-white p-4 flex items-center justify-between" style={{ backgroundColor: '#0B3C5D' }}>
            <div className="flex items-center gap-2">
              <Sparkles size={20} />
              <span className="font-semibold">
                {mode === 'pre-purchase' ? 'Need Help?' : 'Guidance Bot'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20 h-8 w-8"
              data-testid="bot-widget-close"
            >
              <X size={18} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}
                  style={msg.role === 'user' ? { backgroundColor: '#0B3C5D' } : {}}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 px-3 py-2 rounded-lg">
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-gray-200 bg-white">
            <div className="flex flex-wrap gap-1 mb-2">
              {(SUGGESTED_QUESTIONS[questionCategory] || SUGGESTED_QUESTIONS['default']).slice(0, 2).map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20"
                disabled={loading}
                data-testid="bot-input"
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="hover:opacity-90"
                style={{ backgroundColor: '#4ECDC4' }}
                size="icon"
                data-testid="bot-send"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
