import React from 'react';
import { ArrowLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CAPADEX_STAGES, METRYX_NAVY, RATING_OPTIONS } from '@/lib/behavioural-insights';
import { PhaseProps } from '../types';

const AGREE_OPTIONS = [
  { value: 1, label: 'Strongly Disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Agree' },
  { value: 5, label: 'Strongly Agree' },
];

const TYPE_HINT: Record<string, string> = {
  mcq:           'Choose the option that best describes your experience',
  likert_agree:  'Rate your level of agreement',
  likert:        'How often does this apply to you?',
};

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function CapadexQPhase(props: PhaseProps) {
  const {
    capadexItems, capadexAnswers, capadexCurrentQ, setCapadexCurrentQ,
    capadexStage, capadexStageIndex, capadexProgress,
    capadexLoading, handleCapadexAnswer, handleCompleteStage, handleClose,
  } = props;

  const item = capadexItems[capadexCurrentQ];
  if (!item) return null;

  const answered    = Object.keys(capadexAnswers).length;
  const total       = capadexItems.length;
  const allAnswered = answered >= total;
  const stageInfo   = CAPADEX_STAGES[capadexStageIndex] || CAPADEX_STAGES[0];
  const isAnswered  = capadexAnswers[item.id] !== undefined;

  const qType = item.question_type || 'likert';

  const mcqOpts = (qType === 'mcq' && item.opt_a)
    ? [item.opt_a, item.opt_b, item.opt_c, item.opt_d]
        .filter(Boolean)
        .map((label, i) => ({ value: i + 1, label: label as string }))
    : null;

  const dbOpts = item.options?.length >= 2
    ? [...item.options].sort((a, b) => a.display_order - b.display_order)
    : null;
  const likertOpts = dbOpts
    ? dbOpts.map(o => ({ value: o.score_value, label: o.option_text }))
    : RATING_OPTIONS;

  const activeOpts =
    qType === 'mcq'          ? (mcqOpts || likertOpts) :
    qType === 'likert_agree' ? AGREE_OPTIONS :
    likertOpts;

  const hint = TYPE_HINT[qType] || TYPE_HINT.likert;

  const handleOptionClick = (optValue: number) => {
    if (isAnswered) return;
    handleCapadexAnswer(item.id, optValue);
  };

  return (
    <div className="flex flex-col select-none" style={{ background: '#f4f6fb' }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════ */}
      <div className="relative px-5 pt-4 pb-5"
        style={{ background: METRYX_NAVY, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>

        {/* Close */}
        <button onClick={handleClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }}>
          <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 300 }}>×</span>
        </button>

        {/* Stage journey pills */}
        <div className="flex items-center gap-0 mb-4 pr-10 overflow-x-auto">
          {CAPADEX_STAGES.map((s, i) => {
            const prog      = capadexProgress.find(p => p.stage_code === s.code);
            const isCurrent = s.code === capadexStage;
            const isDone    = prog?.status === 'completed';
            return (
              <React.Fragment key={s.code}>
                <div className="flex items-center gap-1 shrink-0">
                  {isDone
                    ? <CheckCircle size={10} style={{ color: '#4ECDC4' }} />
                    : <div className="w-1.5 h-1.5 rounded-full"
                        style={{ background: isCurrent ? '#4ECDC4' : 'rgba(255,255,255,0.25)' }} />
                  }
                  <span className="text-[11px] font-semibold uppercase tracking-widest ml-1"
                    style={{
                      color: isDone ? '#4ECDC4' : isCurrent ? '#fff' : 'rgba(255,255,255,0.35)',
                      fontWeight: isCurrent ? 700 : 500,
                    }}>
                    {s.label}
                  </span>
                </div>
                {i < CAPADEX_STAGES.length - 1 && (
                  <div className="mx-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>·</div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Question counter */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>Question</span>
            <span className="text-[28px] font-black leading-none" style={{ color: '#fff', letterSpacing: '-0.5px' }}>
              {capadexCurrentQ + 1}
            </span>
            <span className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>/ {total}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)', letterSpacing: '0.02em' }}>
              {stageInfo.label} Stage
            </span>
            {capadexStage === 'CAP_INS' && (
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(59,130,246,0.22)', color: '#93C5FD', letterSpacing: '0.08em' }}>
                Competency Analysis
              </span>
            )}
          </div>
        </div>

        {/* Segmented progress bar */}
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className="h-[3px] flex-1 rounded-full transition-all duration-300"
              style={{
                background: i < capadexCurrentQ
                  ? '#4ECDC4'
                  : i === capadexCurrentQ
                  ? 'rgba(255,255,255,0.85)'
                  : 'rgba(255,255,255,0.15)',
              }} />
          ))}
        </div>
      </div>

      {/* ══ QUESTION BODY ═══════════════════════════════════════════════ */}
      <div className="px-5 pt-5 pb-4 bg-white" style={{ borderBottom: '1px solid #edf0f7' }}>
        {item.subdomain_code && (
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-[3px] h-4 rounded-full" style={{ background: METRYX_NAVY }} />
            <span className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: METRYX_NAVY, opacity: 0.55 }}>
              {item.subdomain_code.replace(/_/g, ' ')}
            </span>
          </div>
        )}
        <p className="text-[18px] font-semibold leading-[1.55]" style={{ color: '#0f1729' }}>
          {item.question}
        </p>
        <p className="mt-2 text-[12.5px] font-medium" style={{ color: '#8896b3' }}>
          {hint}
        </p>
      </div>

      {/* ══ OPTIONS ═════════════════════════════════════════════════════ */}
      <div className="px-4 py-4 bg-white space-y-2">
        {activeOpts.map((opt, oi) => {
          const isSel  = capadexAnswers[item.id] === opt.value;
          const letter = OPTION_LETTERS[oi] ?? String(oi + 1);

          return (
            <button
              key={opt.value}
              onClick={() => handleOptionClick(opt.value)}
              disabled={isAnswered && !isSel}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-all duration-150 rounded-xl"
              style={{
                background:  isSel ? '#eef1fb' : '#f8f9fc',
                border:      `1.5px solid ${isSel ? METRYX_NAVY : '#e4e8f2'}`,
                cursor:      isAnswered ? (isSel ? 'default' : 'not-allowed') : 'pointer',
                opacity:     isAnswered && !isSel ? 0.45 : 1,
              }}>

              {/* Letter badge */}
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150"
                style={{
                  background: isSel ? METRYX_NAVY : '#eaecf4',
                  color:      isSel ? '#fff' : '#8896b3',
                  fontSize:   11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}>
                {letter}
              </div>

              {/* Option text */}
              <span className="flex-1 text-[14.5px] font-medium leading-snug"
                style={{ color: isSel ? '#0f1729' : '#374163' }}>
                {opt.label}
              </span>

              {/* Radio circle */}
              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-150"
                style={{
                  borderColor: isSel ? METRYX_NAVY : '#c8cedf',
                  background:  isSel ? METRYX_NAVY : 'transparent',
                }}>
                {isSel && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ══ NAVIGATION BAR ══════════════════════════════════════════════ */}
      <div className="px-5 py-4 flex items-center justify-between"
        style={{ background: '#f4f6fb', borderTop: '1px solid #e8ebf3' }}>

        {/* Previous */}
        {capadexCurrentQ > 0
          ? (
            <button
              onClick={() => setCapadexCurrentQ(q => q - 1)}
              className="flex items-center gap-1.5 text-[13px] font-semibold transition-colors hover:opacity-80"
              style={{ color: '#8896b3' }}>
              <ArrowLeft size={13} />
              Previous
            </button>
          )
          : <span />
        }

        {/* Answered count */}
        <span className="text-[12px] font-semibold px-2.5 py-1 rounded"
          style={{ background: '#eceef5', color: '#8896b3', letterSpacing: '0.01em' }}>
          {answered} of {total} answered
        </span>

        {/* Right action: Submit when all done, Next when current is answered but not last, else empty */}
        {allAnswered ? (
          <Button
            className="h-8 px-4 text-[13px] font-semibold rounded text-white transition-all"
            style={{ background: METRYX_NAVY, letterSpacing: '0.02em' }}
            onClick={handleCompleteStage}
            disabled={capadexLoading}>
            {capadexLoading ? 'Scoring…' : 'Submit'}
            {!capadexLoading && <ChevronRight size={13} className="ml-1" />}
          </Button>
        ) : isAnswered && capadexCurrentQ < total - 1 ? (
          <button
            onClick={() => setCapadexCurrentQ(q => q + 1)}
            className="flex items-center gap-1.5 text-[13px] font-semibold transition-colors hover:opacity-80"
            style={{ color: '#8896b3' }}>
            Next
            <ChevronRight size={13} />
          </button>
        ) : (
          <span />
        )}
      </div>

    </div>
  );
}
