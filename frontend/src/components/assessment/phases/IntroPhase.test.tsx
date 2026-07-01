import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { IntroPhase } from './IntroPhase';
import type { PhaseProps } from '../types';

// PNG asset import (`@/assets/metryx-logo-transparent.png`) is resolved as a
// URL string by Vite's asset pipeline under vitest — no mock needed.

// ── Test harness ──────────────────────────────────────────────────────────
// PhaseProps carries ~120 fields, most of which IntroPhase never touches in
// the three flows under test. We stub everything to vi.fn() / sensible
// primitives and let each test override the handful of props it cares about.
function makeProps(overrides: Partial<PhaseProps> = {}): PhaseProps {
  const noop = vi.fn();
  const refs = { current: null } as any;
  const base: any = {
    phase: 'intro', setPhase: noop,
    selectedPersona: 'professional', setSelectedPersona: noop,
    primaryPersona: null, setPrimaryPersona: noop,
    isProxy: false, setIsProxy: noop,
    ageBand: '', setAgeBand: noop,
    participantGender: '', setParticipantGender: noop,
    participantCity: '', setParticipantCity: noop,
    participantGoal: '', setParticipantGoal: noop,
    goalTimeline: '', setGoalTimeline: noop,
    concernMetaMap: {}, setConcernMetaMap: noop,
    currentQ: 0, setCurrentQ: noop,
    answers: {}, setAnswers: noop,
    participantName: '', setParticipantName: noop,
    contextField: '', setContextField: noop,
    regEmail: '', setRegEmail: noop,
    selectedConcern: null, setSelectedConcern: noop,
    selectedConcerns: [], setSelectedConcerns: noop,
    concernSearch: '', setConcernSearch: noop,
    concernSuggestions: [],
    concernPersonaFallback: false,
    showConcernSugg: false, setShowConcernSugg: noop,
    concernLoading: false,
    concernHighlight: -1, setConcernHighlight: noop,
    famTermIdx: 0, famTermVisible: true,
    userAge: '', setUserAge: noop,
    assesseeType: '', setAssesseeType: noop,
    requesterName: '', setRequesterName: noop,
    capadexSessionId: null, capadexStage: '', capadexStageIndex: 0, capadexStageColor: '',
    capadexItems: [], capadexAnswers: {}, capadexCurrentQ: 0, setCapadexCurrentQ: noop,
    capadexStageResult: null, capadexProgress: [], capadexLoading: false, capadexError: null,
    concernIntelligence: null, analyzeStep: 0, clarifyAnswers: {}, clarifyCurrentQ: 0,
    capadexRegEmail: '', setCapadexRegEmail: noop,
    capadexPassword: '', setCapadexPassword: noop,
    capadexShowPass: false, setCapadexShowPass: noop,
    capadexRegLoading: false, capadexRegError: null, setCapadexRegError: noop,
    capadexLoginMode: false, setCapadexLoginMode: noop,
    capadexLoginOtpSent: false, capadexLoginOtpLoading: false, capadexLoginOtpError: null,
    capadexExistingName: '',
    capadexOtpDigits: ['','','','','',''], setCapadexOtpDigits: noop,
    capadexOtpLoading: false, capadexOtpError: null, capadexOtpTimer: 0,
    capadexOtpRefs: [refs, refs, refs, refs, refs, refs],
    capadexReturnEmail: '', setCapadexReturnEmail: noop,
    capadexStageCheck: null, capadexStageCheckLoading: false,
    capadexSkipIntent: false, setCapadexSkipIntent: noop,
    capadexUser: null, capadexReport: null,
    rieRecommendations: [], rieHasEscalation: false,
    paymentStageData: null,
    selectedTier: '', setSelectedTier: noop,
    upgradeGoal: '', setUpgradeGoal: noop,
    upgradeUrgency: '', setUpgradeUrgency: noop,
    otpRefs: [refs, refs, refs, refs, refs, refs],
    otpDigits: ['','','','','',''], setOtpDigits: noop,
    otpLoading: false, otpError: null, otpResendTimer: 0,
    regLoading: false, regName: '', setRegName: noop, regPhone: '', setRegPhone: noop,
    emailExistsName: '', reportTab: '', setReportTab: noop,
    progress: 0,
    concernWrapRef: { current: null } as any,
    setConcernLoading: noop, setConcernSuggestions: noop,
    handleAnalyseConcern: noop, handleClarifyAnswer: noop, handleClarifyBack: noop,
    handleBeginAssessment: noop, handleCapadexAnswer: noop,
    handleCompleteStage: noop, handleContinueToNextStage: noop, handleClose: noop,
    handleAnswer: noop, handleRegisterSubmit: noop, handleOtpVerify: noop,
    handleResendOtp: noop, handleStageCheck: noop, handleSkipToNextStage: noop,
    handleCapadexRegister: noop, handleCapadexLoginOtpSend: noop,
    handleCapadexOtpVerify: noop, handleCapadexOtpResend: noop,
    handlePaymentProceed: noop, handlePaymentConfirm: noop, paymentConfirmLoading: false,
    handleViewCurrentReport: noop, capadexPricing: {}, handleUnlockRequest: noop,
    questions: [],
    persona: { color: '#0EA5A4', hint: '', label: '' } as any,
    computeResults: () => ({ domains: [], overallPct: 0, overallLevel: '' }),
    deepLinkError: null,
    handleCapadexPdf: noop, capadexPdfLoading: false, capadexPdfBlobUrl: null,
    capadexPdfFilename: '', capadexPdfError: null,
    handleCapadexEmailReport: noop, capadexEmailLoading: false, capadexEmailSent: false,
    retrieveReportMode: false, setRetrieveReportMode: noop,
    recentSessions: [], recentSessionsLoading: false, handleLoadPreviousReport: noop,
    introEmailStatus: 'idle', introEmailName: '', introEmailVerified: false,
    introOtpSent: false, introOtpDigits: ['','','','','',''], setIntroOtpDigits: noop,
    introOtpLoading: false, introOtpError: null, introOtpTimer: 0,
    introOtpRefs: { current: [null,null,null,null,null,null] } as any,
    handleIntroEmailCheck: noop, handleIntroSendOtp: noop,
    handleIntroOtpVerify: noop, handleIntroOtpResend: noop,
    returningIntent: null, setReturningIntent: noop,
    savedSession: null, handleResumeSession: noop, handleDismissResume: noop,
    incompleteSession: null, continueLoading: false,
    handleContinueIncomplete: noop, handleStartFresh: noop,
  };
  return { ...base, ...overrides } as PhaseProps;
}

// Master-row factory matching the 2,488-row capadex_concerns_master schema
// shape that IntroPhase's typeahead filter discriminates against
// (`source === 'master'` triggers the cluster + indian-context haystack).
const masterRow = (id: number, cluster: string, area = cluster) => ({
  id, source: 'master' as const,
  category: 'cap', concern_area: area, parent_worry: '',
  has_assessment: true,
  construct_key: null, construct_label: null, construct_cluster: null,
  concern_id: `CONCERN_${id}`,
  domain: area, concern_cluster: cluster,
  impact_on_child: '', common_indian_context: '',
});

describe('IntroPhase — combobox case-insensitive cluster match', () => {
  it('surfaces the master row when query case differs from concern_cluster', async () => {
    const user = userEvent.setup();
    const setSelectedConcerns = vi.fn();
    const props = makeProps({
      selectedPersona: 'professional',
      concernSuggestions: [
        masterRow(1, 'Exam Stress', 'exam_stress'),
        masterRow(2, 'Workplace Burnout', 'workplace_burnout'),
      ] as any,
      setSelectedConcerns,
    });

    const { rerender } = render(<IntroPhase {...props} />);

    // Mirror the upstream onChange contract: parent owns concernSearch state,
    // so we re-render with the typed value to drive the memoised filter.
    const setConcernSearch = vi.fn((v: string) => {
      rerender(<IntroPhase {...makeProps({
        selectedPersona: 'professional',
        concernSuggestions: props.concernSuggestions,
        setSelectedConcerns,
        concernSearch: v,
        setConcernSearch,
      })} />);
    });
    rerender(<IntroPhase {...makeProps({
      selectedPersona: 'professional',
      concernSuggestions: props.concernSuggestions,
      setSelectedConcerns,
      concernSearch: '',
      setConcernSearch,
    })} />);

    const combobox = screen.getByTestId('concern-search');
    await user.type(combobox, 'EXAM STRESS');

    const dropdown = await screen.findByTestId('concern-typeahead-dropdown');
    const options = within(dropdown).getAllByRole('option');
    // Case-insensitive match should narrow to exactly the "Exam Stress" row.
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent(/Exam Stress/i);

    // Clicking the row routes through addConcern → setSelectedConcerns updater.
    fireEvent.pointerDown(options[0]);
    expect(setSelectedConcerns).toHaveBeenCalledTimes(1);
    const updater = setSelectedConcerns.mock.calls[0][0] as (prev: string[]) => string[];
    expect(updater([])).toEqual(['exam_stress']);
  });
});

describe('IntroPhase — age band accordion stays alive across hyphen + plus options', () => {
  it('accepts both "24-45" and "45+" without crashing the persona accordion', () => {
    const setAgeBand = vi.fn();
    // career_transition_professional is the only sub-persona whose ageBands
    // whitelist includes BOTH '24-45' AND '45+', so both <option> values
    // render in the bound <select>.
    const props = makeProps({
      selectedPersona: 'jobseeker',
      primaryPersona: 'career_transition_professional',
      setAgeBand,
    });
    render(<IntroPhase {...props} />);

    // Progressive-disclosure accordion auto-opens the active sub-persona's
    // track (professional) on mount.
    expect(screen.getByTestId('track-header-professional')).toBeInTheDocument();

    const select = screen.getByTestId('select-age-band') as HTMLSelectElement;
    // Both option values must be present for the change events to be
    // anything more than no-ops.
    const optionValues = Array.from(select.options).map(o => o.value);
    expect(optionValues).toContain('24-45');
    expect(optionValues).toContain('45+');

    expect(() => fireEvent.change(select, { target: { value: '24-45' } })).not.toThrow();
    expect(() => fireEvent.change(select, { target: { value: '45+' } })).not.toThrow();

    // primaryPersona-change useEffect calls setAgeBand('') once on mount,
    // so assert by membership rather than ordinal position.
    expect(setAgeBand).toHaveBeenCalledWith('24-45');
    expect(setAgeBand).toHaveBeenCalledWith('45+');

    // Accordion is still mounted — neither selection unmounted the track row.
    expect(screen.getByTestId('track-header-professional')).toBeInTheDocument();
  });
});

describe('IntroPhase — persona block collapses when resolved upstream', () => {
  // The PersonaJourneyWizard already asks "who is this for?" — so when it hands
  // off (personaResolvedUpstream=true) the classic IntroPhase must NOT re-open
  // the persona picker. It shows a confirmed "Selected · …" summary with the
  // "Change who this is for" escape hatch, both collapsed.
  it('starts the selected track COLLAPSED with a "Selected · …" summary + escape hatch when resolved upstream', () => {
    const props = makeProps({
      // campus_student lives in the "Students & learners" (learner) track.
      primaryPersona: 'campus_student',
      selectedPersona: 'campus',
      personaResolvedUpstream: true,
    } as any);
    render(<IntroPhase {...props} />);

    // The learner track header renders as a confirmed summary…
    const header = screen.getByTestId('track-header-learner');
    expect(header).toHaveTextContent(/Selected ·/i);
    expect(header).toHaveTextContent(/College or university student/i);
    // …and it is COLLAPSED: the sub-persona radio body must not be mounted.
    expect(screen.queryByTestId('track-body-learner')).not.toBeInTheDocument();
    // The escape hatch to reopen the full persona list is present.
    expect(screen.getByTestId('change-persona')).toBeInTheDocument();
    expect(screen.getByText(/Change who this is for/i)).toBeInTheDocument();
  });

  it('legacy path (flag OFF / no upstream) still auto-EXPANDS the selected track', () => {
    // personaResolvedUpstream absent → byte-identical legacy behaviour: the
    // track containing the current selection opens on mount.
    const props = makeProps({
      primaryPersona: 'campus_student',
      selectedPersona: 'campus',
    });
    render(<IntroPhase {...props} />);

    const header = screen.getByTestId('track-header-learner');
    expect(header).toHaveTextContent(/Selected ·/i);
    // Legacy: the body IS expanded (persona radios visible).
    expect(screen.getByTestId('track-body-learner')).toBeInTheDocument();
    expect(screen.getByTestId('persona-campus_student')).toBeInTheDocument();
  });
});

describe('IntroPhase — strict 3-concern correlation cap', () => {
  it('blocks the 4th sequential add and surfaces the cap warning', async () => {
    const user = userEvent.setup();

    // Stateful harness — owns selectedConcerns + concernSearch so addConcern's
    // internal cap check sees the latest array on every Enter key press.
    function Harness() {
      const [selectedConcerns, setSelectedConcerns] = React.useState<string[]>([]);
      const [concernSearch, setConcernSearch] = React.useState('');
      return (
        <IntroPhase {...makeProps({
          selectedPersona: 'professional',
          selectedConcerns,
          setSelectedConcerns,
          concernSearch,
          setConcernSearch,
          // Empty suggestions force the Enter-key path into the free-text
          // addConcern branch (`filteredSuggestions[0]` undefined +
          // `concernSearch.trim().length >= 3`).
          concernSuggestions: [],
        })} />
      );
    }
    render(<Harness />);

    const combobox = screen.getByTestId('concern-search');

    // 4 sequential master-concern adds via the Enter free-text branch.
    for (const label of ['concern_one', 'concern_two', 'concern_three', 'concern_four']) {
      await user.type(combobox, label);
      await user.keyboard('{Enter}');
    }

    // Strict cap: only the first 3 stuck.
    // selectedConcerns chips render with the area string as their text node.
    expect(screen.getByText('concern_one')).toBeInTheDocument();
    expect(screen.getByText('concern_two')).toBeInTheDocument();
    expect(screen.getByText('concern_three')).toBeInTheDocument();
    expect(screen.queryByText('concern_four')).not.toBeInTheDocument();

    // The 4th attempt should surface the explicit "Maximum 3 concerns" note.
    expect(screen.getByText(/Maximum 3 concerns/i)).toBeInTheDocument();
  });
});
