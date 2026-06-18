export type InterviewCategory = 'Behavioral' | 'Technical' | 'Situational' | 'Role-Specific';

export interface InterviewQuestion {
  q: string;
  hint: string;
}

export const INTERVIEW_QS: Record<InterviewCategory, InterviewQuestion[]> = {
  'Behavioral': [
    { q: 'Tell me about a time you overcame a significant challenge at work.', hint: 'Use STAR method: Situation → Task → Action → Result' },
    { q: 'Describe a situation where you had to work with a difficult team member.', hint: 'Focus on collaboration and conflict resolution skills' },
    { q: 'Give an example of a goal you set and how you achieved it.', hint: 'Quantify the outcome with specific numbers or percentages' },
    { q: 'Tell me about a time you failed. What did you learn?', hint: 'Show self-awareness, accountability, and growth mindset' },
    { q: 'Describe a time you had to adapt to a major change.', hint: 'Emphasize flexibility and positive attitude toward change' },
  ],
  'Technical': [
    { q: "How do you approach debugging a production issue you've never seen before?", hint: 'Walk through systematic diagnosis: logs → reproduce → isolate → fix → prevent' },
    { q: 'Explain a complex technical concept to a non-technical stakeholder.', hint: 'Use analogies and focus on business impact over implementation details' },
    { q: 'How do you stay current with new technologies in your field?', hint: 'Mention specific resources: newsletters, GitHub, conferences, courses' },
    { q: "Walk me through a technical project you're most proud of.", hint: 'Highlight the problem, your approach, tech choices, and measurable outcome' },
    { q: 'How do you ensure code quality in your projects?', hint: 'Discuss: testing, code reviews, linting, documentation, CI/CD' },
  ],
  'Situational': [
    { q: 'If you were given a project with an unrealistic deadline, what would you do?', hint: 'Show communication skills — negotiate scope or timeline proactively' },
    { q: 'How would you handle receiving critical feedback on your work?', hint: 'Show maturity: listen actively, clarify, take action, follow up' },
    { q: 'If two urgent tasks conflict, how do you prioritize?', hint: 'Discuss impact assessment, stakeholder communication, and delegation' },
    { q: "What would you do if you disagreed with your manager's decision?", hint: 'Express disagreement professionally, present data, then commit to the decision' },
    { q: 'How would you handle joining a team with low morale?', hint: 'Show empathy, listening skills, and focus on quick wins to rebuild trust' },
  ],
  'Role-Specific': [
    { q: 'What does your ideal career trajectory look like over the next 5 years?', hint: "Align your ambitions with the company's growth opportunities" },
    { q: 'Why are you the best candidate for this role?', hint: 'Map your top 3 strengths directly to the job description requirements' },
    { q: 'What do you know about our company and why do you want to work here?', hint: 'Research: product, culture, recent news, competitors, and values' },
    { q: 'Describe your ideal work environment and management style.', hint: 'Be honest but frame it positively and show adaptability' },
    { q: "What's your biggest professional accomplishment?", hint: 'Choose something quantifiable and relevant to this role' },
  ],
};

export const INTERVIEW_CATEGORIES = Object.keys(INTERVIEW_QS) as InterviewCategory[];
