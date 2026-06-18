/**
 * AIDemoWidget — floating "Try our AI Coach" chat bubble for anonymous visitors.
 * Calls POST /api/chat/message (no auth required). Includes a language selector
 * covering 10+ Indian languages and maintains a persistent sessionId across turns.
 * Public landing-page only. Zero signup needed.
 */
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, X, Loader2, Globe } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; id: string };

type LangCode =
  | "en" | "hi" | "te" | "ta" | "kn" | "mr" | "bn" | "gu" | "ml" | "pa" | "ur";

const LANGUAGES: { code: LangCode; label: string; greeting: string; placeholder: string; suggestions: string[]; footer: string; title: string; subtitle: string }[] = [
  {
    code: "en", label: "English",
    title: "MetryxAI Coach", subtitle: "Live demo · no signup",
    greeting: "Hi! I'm the MetryxOne AI coach — try me out. Ask anything about learning, behavioral intelligence, or how MetryxOne can help your students.",
    placeholder: "Ask the AI coach…", footer: "Powered by MetryxAI · Live demo",
    suggestions: ["What is the Learning Behavior Index?", "How does MetryxOne help JEE/NEET aspirants?", "Is my child's data safe?"],
  },
  {
    code: "hi", label: "हिन्दी",
    title: "मेट्रिक्सएआई कोच", subtitle: "लाइव डेमो · बिना साइन-अप",
    greeting: "नमस्ते! मैं मेट्रिक्सवन का एआई कोच हूँ। पढ़ाई, व्यवहार इंटेलिजेंस, या अपने बच्चे के विकास के बारे में कुछ भी पूछिए।",
    placeholder: "एआई कोच से पूछें…", footer: "मेट्रिक्सएआई · लाइव डेमो",
    suggestions: ["लर्निंग बिहेवियर इंडेक्स क्या है?", "JEE/NEET की तैयारी में कैसे मदद मिलेगी?", "क्या मेरे बच्चे का डेटा सुरक्षित है?"],
  },
  {
    code: "te", label: "తెలుగు",
    title: "మెట్రిక్స్‌AI కోచ్", subtitle: "లైవ్ డెమో · సైన్-అప్ అక్కర్లేదు",
    greeting: "హాయ్! నేను మెట్రిక్స్‌వన్ AI కోచ్‌ని. అభ్యాసం, ప్రవర్తన మేధస్సు, లేదా మీ విద్యార్థికి ఎలా సహాయపడతామో అడగండి.",
    placeholder: "AI కోచ్‌ని అడగండి…", footer: "మెట్రిక్స్‌AI · లైవ్ డెమో",
    suggestions: ["లెర్నింగ్ బిహేవియర్ ఇండెక్స్ ఏమిటి?", "JEE/NEET కి ఎలా సహాయపడతారు?", "నా పిల్లవాడి డేటా సురక్షితమేనా?"],
  },
  {
    code: "ta", label: "தமிழ்",
    title: "MetryxAI பயிற்றுநர்", subtitle: "நேரடி டெமோ · பதிவு தேவையில்லை",
    greeting: "வணக்கம்! நான் MetryxOne AI பயிற்றுநர். கற்றல், நடத்தை நுண்ணறிவு அல்லது உங்கள் குழந்தைக்கு எப்படி உதவுகிறது என்பதைப் பற்றி கேளுங்கள்.",
    placeholder: "AI பயிற்றுநரிடம் கேளுங்கள்…", footer: "MetryxAI · நேரடி டெமோ",
    suggestions: ["Learning Behavior Index என்றால் என்ன?", "JEE/NEET-க்கு எப்படி உதவும்?", "என் குழந்தையின் தரவு பாதுகாப்பா?"],
  },
  {
    code: "kn", label: "ಕನ್ನಡ",
    title: "MetryxAI ಕೋಚ್", subtitle: "ಲೈವ್ ಡೆಮೊ · ಸೈನ್-ಅಪ್ ಬೇಕಿಲ್ಲ",
    greeting: "ನಮಸ್ಕಾರ! ನಾನು MetryxOne AI ಕೋಚ್. ಕಲಿಕೆ, ನಡವಳಿಕೆ ಬುದ್ಧಿಮತ್ತೆ ಅಥವಾ ನಿಮ್ಮ ಮಗುವಿಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡುತ್ತೇವೆ ಎಂದು ಕೇಳಿ.",
    placeholder: "AI ಕೋಚ್‌ನನ್ನು ಕೇಳಿ…", footer: "MetryxAI · ಲೈವ್ ಡೆಮೊ",
    suggestions: ["Learning Behavior Index ಅಂದರೇನು?", "JEE/NEET ಗೆ ಹೇಗೆ ಸಹಾಯ?", "ನನ್ನ ಮಗುವಿನ ಡೇಟಾ ಸುರಕ್ಷಿತವೇ?"],
  },
  {
    code: "mr", label: "मराठी",
    title: "MetryxAI कोच", subtitle: "लाइव्ह डेमो · साइन-अप नको",
    greeting: "नमस्कार! मी MetryxOne चा AI कोच. शिक्षण, वर्तन बुद्धिमत्ता किंवा तुमच्या मुलाला कशी मदत होईल याबद्दल विचारा.",
    placeholder: "AI कोच ला विचारा…", footer: "MetryxAI · लाइव्ह डेमो",
    suggestions: ["Learning Behavior Index म्हणजे काय?", "JEE/NEET तयारीला कशी मदत?", "माझ्या मुलाचा डेटा सुरक्षित आहे का?"],
  },
  {
    code: "bn", label: "বাংলা",
    title: "MetryxAI কোচ", subtitle: "লাইভ ডেমো · সাইন-আপ লাগবে না",
    greeting: "হ্যালো! আমি MetryxOne-এর AI কোচ। পড়াশোনা, আচরণগত বুদ্ধিমত্তা বা আপনার সন্তানকে কীভাবে সাহায্য করব, তা জিজ্ঞাসা করুন।",
    placeholder: "AI কোচকে জিজ্ঞাসা করুন…", footer: "MetryxAI · লাইভ ডেমো",
    suggestions: ["Learning Behavior Index কী?", "JEE/NEET-এর জন্য কীভাবে সাহায্য?", "আমার সন্তানের ডেটা কি নিরাপদ?"],
  },
  {
    code: "gu", label: "ગુજરાતી",
    title: "MetryxAI કોચ", subtitle: "લાઇવ ડેમો · સાઇન-અપ વિના",
    greeting: "નમસ્તે! હું MetryxOne નો AI કોચ છું. શીખવું, વ્યવહાર બુદ્ધિ અથવા તમારા બાળકને કેવી રીતે મદદ કરીએ તે પૂછો.",
    placeholder: "AI કોચને પૂછો…", footer: "MetryxAI · લાઇવ ડેમો",
    suggestions: ["Learning Behavior Index શું છે?", "JEE/NEET ની તૈયારીમાં કેવી મદદ?", "મારા બાળકનો ડેટા સલામત છે?"],
  },
  {
    code: "ml", label: "മലയാളം",
    title: "MetryxAI കോച്ച്", subtitle: "ലൈവ് ഡെമോ · സൈൻ-അപ്പ് ആവശ്യമില്ല",
    greeting: "ഹലോ! ഞാൻ MetryxOne-ന്റെ AI കോച്ച് ആണ്. പഠനം, പെരുമാറ്റ ബുദ്ധിശക്തി, അല്ലെങ്കിൽ നിങ്ങളുടെ കുട്ടിയെ എങ്ങനെ സഹായിക്കാമെന്ന് ചോദിക്കൂ.",
    placeholder: "AI കോച്ചിനോട് ചോദിക്കൂ…", footer: "MetryxAI · ലൈവ് ഡെമോ",
    suggestions: ["Learning Behavior Index എന്താണ്?", "JEE/NEET-ന് എങ്ങനെ സഹായിക്കും?", "എന്റെ കുട്ടിയുടെ ഡാറ്റ സുരക്ഷിതമാണോ?"],
  },
  {
    code: "pa", label: "ਪੰਜਾਬੀ",
    title: "MetryxAI ਕੋਚ", subtitle: "ਲਾਈਵ ਡੈਮੋ · ਸਾਈਨ-ਅੱਪ ਦੀ ਲੋੜ ਨਹੀਂ",
    greeting: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ MetryxOne ਦਾ AI ਕੋਚ ਹਾਂ। ਸਿੱਖਿਆ, ਵਿਵਹਾਰ ਬੁੱਧੀ ਜਾਂ ਤੁਹਾਡੇ ਬੱਚੇ ਦੀ ਮਦਦ ਬਾਰੇ ਕੁਝ ਵੀ ਪੁੱਛੋ।",
    placeholder: "AI ਕੋਚ ਨੂੰ ਪੁੱਛੋ…", footer: "MetryxAI · ਲਾਈਵ ਡੈਮੋ",
    suggestions: ["Learning Behavior Index ਕੀ ਹੈ?", "JEE/NEET ਦੀ ਤਿਆਰੀ 'ਚ ਕਿੰਨੀ ਮਦਦ?", "ਕੀ ਮੇਰੇ ਬੱਚੇ ਦਾ ਡੇਟਾ ਸੁਰੱਖਿਅਤ ਹੈ?"],
  },
  {
    code: "ur", label: "اردو",
    title: "MetryxAI کوچ", subtitle: "لائیو ڈیمو · سائن اپ نہیں چاہیے",
    greeting: "سلام! میں MetryxOne کا AI کوچ ہوں۔ تعلیم، رویہ انٹیلیجنس یا اپنے بچے کی مدد کے بارے میں کچھ بھی پوچھیں۔",
    placeholder: "AI کوچ سے پوچھیں…", footer: "MetryxAI · لائیو ڈیمو",
    suggestions: ["Learning Behavior Index کیا ہے؟", "JEE/NEET کی تیاری میں کیسے مدد؟", "کیا میرے بچے کا ڈیٹا محفوظ ہے؟"],
  },
];

const SESSION_STORAGE_KEY = "metryx_ai_demo_session";

function getOrCreateSessionId() {
  try {
    let sid = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sid) {
      sid = `demo-${crypto.randomUUID()}`;
      sessionStorage.setItem(SESSION_STORAGE_KEY, sid);
    }
    return sid;
  } catch {
    return `demo-${Math.random().toString(36).slice(2)}`;
  }
}

export function AIDemoWidget() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<LangCode>("en");
  const [langOpen, setLangOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const sessionIdRef = useRef<string>(getOrCreateSessionId());

  const L = LANGUAGES.find((l) => l.code === lang)!;

  // Reset greeting whenever language changes (and before first user msg)
  useEffect(() => {
    setMessages((prev) => {
      const hasUser = prev.some((m) => m.role === "user");
      if (hasUser) return prev;
      return [{ role: "assistant", id: "greet", content: L.greeting }];
    });
  }, [lang, L.greeting]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setMessages((m) => [
      ...m,
      { role: "user", id: crypto.randomUUID(), content: trimmed },
    ]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          sessionId: sessionIdRef.current,
          language: lang,
          context: { userRole: "anonymous_landing_visitor" },
        }),
      });
      const data = await res.json();
      const replyText =
        data?.response ||
        data?.error ||
        "Sorry, I couldn't reach the AI service just now.";
      setMessages((m) => [
        ...m,
        { role: "assistant", id: crypto.randomUUID(), content: replyText },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          id: crypto.randomUUID(),
          content: "Network error — please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          type="button"
          data-testid="ai-demo-widget-launcher"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-[#344E86] to-[#4ECDC4] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(52,78,134,0.35)] ring-1 ring-white/20 transition-transform hover:scale-105 active:scale-95"
        >
          <Sparkles className="h-4 w-4" />
          Try AI Coach
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          data-testid="ai-demo-widget-panel"
          className="fixed bottom-6 right-6 z-50 flex h-[560px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 dark:bg-slate-900 dark:ring-white/10"
        >
          {/* Header */}
          <div className="relative flex items-center justify-between bg-gradient-to-r from-[#344E86] to-[#4ECDC4] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">{L.title}</div>
                <div className="text-[11px] opacity-80">{L.subtitle}</div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Language selector */}
              <div className="relative">
                <button
                  type="button"
                  data-testid="ai-demo-widget-language-toggle"
                  onClick={() => setLangOpen((v) => !v)}
                  className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium hover:bg-white/25"
                  title="Change language"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {L.label}
                </button>
                {langOpen && (
                  <div
                    data-testid="ai-demo-widget-language-menu"
                    className="absolute right-0 top-8 z-10 max-h-64 w-44 overflow-y-auto rounded-xl bg-white py-1 text-slate-800 shadow-xl ring-1 ring-black/10 dark:bg-slate-900 dark:text-slate-100 dark:ring-white/10"
                  >
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        data-testid={`ai-demo-widget-lang-${l.code}`}
                        onClick={() => {
                          setLang(l.code);
                          setLangOpen(false);
                        }}
                        className={`block w-full px-3 py-1.5 text-left text-xs transition-colors ${
                          lang === l.code
                            ? "bg-[#4ECDC4]/15 font-semibold text-[#1D3E8B]"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                data-testid="ai-demo-widget-close"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 hover:bg-white/20"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
            {messages.map((m) => (
              <div
                key={m.id}
                data-testid={`ai-demo-widget-msg-${m.role}`}
                className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-[#344E86] text-white"
                      : "rounded-bl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="mb-3 flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5 text-slate-500 dark:bg-slate-800">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-xs">…</span>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Suggestion chips (before first user msg) */}
          {messages.filter((m) => m.role === "user").length === 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
              {L.suggestions.map((s, i) => (
                <button
                  key={`${lang}-${i}`}
                  data-testid={`ai-demo-suggestion-${i}`}
                  onClick={() => send(s)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 transition-colors hover:border-[#4ECDC4] hover:bg-[#4ECDC4]/5 hover:text-[#2d7c74] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            className="flex items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-800"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              data-testid="ai-demo-widget-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              placeholder={L.placeholder}
              dir={lang === "ur" ? "rtl" : "ltr"}
              className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-[#4ECDC4] focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="submit"
              data-testid="ai-demo-widget-send"
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-[#344E86] to-[#4ECDC4] text-white transition-opacity disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-center text-[10px] uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-950">
            {L.footer}
          </div>
        </div>
      )}
    </>
  );
}
