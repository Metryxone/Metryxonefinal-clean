import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Statement templates per band
const templates: Record<string, string[]> = {
  A: [
    'I am beginning to understand {name} and can apply it with guidance in straightforward situations.',
    'I am developing awareness of {name} and make an effort to practise it when opportunities arise.',
    'With support, I can demonstrate basic elements of {name} in my day-to-day activities.',
  ],
  B: [
    'I apply {name} independently and consistently in my role, adapting my approach to the context.',
    'I demonstrate solid competence in {name} and handle moderately complex situations without assistance.',
    'I take initiative in {name} and share relevant knowledge or approaches with my peers.',
  ],
  C: [
    'I am recognised as a resource for {name} and mentor others in building this capability.',
    'I lead by example in {name}, shaping how it is applied across teams or the organisation.',
    'I contribute to developing frameworks and best practices related to {name} at an organisational level.',
  ],
};

const subdomains: { domain_code: string; domain_name: string; subdomain_code: string; subdomain_name: string }[] = [
  { domain_code:'COG', domain_name:'Cognitive & Analytical', subdomain_code:'COG01', subdomain_name:'Critical Thinking' },
  { domain_code:'COG', domain_name:'Cognitive & Analytical', subdomain_code:'COG02', subdomain_name:'Problem Solving' },
  { domain_code:'COG', domain_name:'Cognitive & Analytical', subdomain_code:'COG03', subdomain_name:'Analytical Reasoning' },
  { domain_code:'COG', domain_name:'Cognitive & Analytical', subdomain_code:'COG04', subdomain_name:'Decision Making' },
  { domain_code:'COG', domain_name:'Cognitive & Analytical', subdomain_code:'COG05', subdomain_name:'Systems Thinking' },
  { domain_code:'COG', domain_name:'Cognitive & Analytical', subdomain_code:'COG06', subdomain_name:'Quantitative Analysis' },
  { domain_code:'COG', domain_name:'Cognitive & Analytical', subdomain_code:'COG07', subdomain_name:'Research Aptitude' },
  { domain_code:'COM', domain_name:'Communication & Influence', subdomain_code:'COM01', subdomain_name:'Verbal Communication' },
  { domain_code:'COM', domain_name:'Communication & Influence', subdomain_code:'COM02', subdomain_name:'Written Communication' },
  { domain_code:'COM', domain_name:'Communication & Influence', subdomain_code:'COM03', subdomain_name:'Presentation Skills' },
  { domain_code:'COM', domain_name:'Communication & Influence', subdomain_code:'COM04', subdomain_name:'Active Listening' },
  { domain_code:'COM', domain_name:'Communication & Influence', subdomain_code:'COM05', subdomain_name:'Negotiation' },
  { domain_code:'COM', domain_name:'Communication & Influence', subdomain_code:'COM06', subdomain_name:'Stakeholder Management' },
  { domain_code:'COM', domain_name:'Communication & Influence', subdomain_code:'COM07', subdomain_name:'Storytelling & Influence' },
  { domain_code:'LEA', domain_name:'Leadership & People', subdomain_code:'LEA01', subdomain_name:'Team Leadership' },
  { domain_code:'LEA', domain_name:'Leadership & People', subdomain_code:'LEA02', subdomain_name:'Strategic Vision' },
  { domain_code:'LEA', domain_name:'Leadership & People', subdomain_code:'LEA03', subdomain_name:'Coaching & Mentoring' },
  { domain_code:'LEA', domain_name:'Leadership & People', subdomain_code:'LEA04', subdomain_name:'Talent Development' },
  { domain_code:'LEA', domain_name:'Leadership & People', subdomain_code:'LEA05', subdomain_name:'Change Leadership' },
  { domain_code:'LEA', domain_name:'Leadership & People', subdomain_code:'LEA06', subdomain_name:'Decision Authority' },
  { domain_code:'LEA', domain_name:'Leadership & People', subdomain_code:'LEA07', subdomain_name:'Cross-functional Collaboration' },
  { domain_code:'LEA', domain_name:'Leadership & People', subdomain_code:'LEA08', subdomain_name:'Executive Presence' },
  { domain_code:'EXE', domain_name:'Execution & Delivery', subdomain_code:'EXE01', subdomain_name:'Project Management' },
  { domain_code:'EXE', domain_name:'Execution & Delivery', subdomain_code:'EXE02', subdomain_name:'Accountability' },
  { domain_code:'EXE', domain_name:'Execution & Delivery', subdomain_code:'EXE03', subdomain_name:'Prioritization' },
  { domain_code:'EXE', domain_name:'Execution & Delivery', subdomain_code:'EXE04', subdomain_name:'Process Improvement' },
  { domain_code:'EXE', domain_name:'Execution & Delivery', subdomain_code:'EXE05', subdomain_name:'Goal Setting & OKRs' },
  { domain_code:'EXE', domain_name:'Execution & Delivery', subdomain_code:'EXE06', subdomain_name:'Risk Management' },
  { domain_code:'EXE', domain_name:'Execution & Delivery', subdomain_code:'EXE07', subdomain_name:'Resource Optimization' },
  { domain_code:'ADP', domain_name:'Adaptability & Growth', subdomain_code:'ADP01', subdomain_name:'Learning Agility' },
  { domain_code:'ADP', domain_name:'Adaptability & Growth', subdomain_code:'ADP02', subdomain_name:'Resilience' },
  { domain_code:'ADP', domain_name:'Adaptability & Growth', subdomain_code:'ADP03', subdomain_name:'Innovation Mindset' },
  { domain_code:'ADP', domain_name:'Adaptability & Growth', subdomain_code:'ADP04', subdomain_name:'Ambiguity Tolerance' },
  { domain_code:'ADP', domain_name:'Adaptability & Growth', subdomain_code:'ADP05', subdomain_name:'Growth Mindset' },
  { domain_code:'ADP', domain_name:'Adaptability & Growth', subdomain_code:'ADP06', subdomain_name:'Continuous Improvement' },
  { domain_code:'ADP', domain_name:'Adaptability & Growth', subdomain_code:'ADP07', subdomain_name:'Digital Adaptability' },
  { domain_code:'TEC', domain_name:'Technical & Domain', subdomain_code:'TEC01', subdomain_name:'Domain Expertise' },
  { domain_code:'TEC', domain_name:'Technical & Domain', subdomain_code:'TEC02', subdomain_name:'Digital Fluency' },
  { domain_code:'TEC', domain_name:'Technical & Domain', subdomain_code:'TEC03', subdomain_name:'Data Literacy' },
  { domain_code:'TEC', domain_name:'Technical & Domain', subdomain_code:'TEC04', subdomain_name:'Technical Writing' },
  { domain_code:'TEC', domain_name:'Technical & Domain', subdomain_code:'TEC05', subdomain_name:'Product & Process Knowledge' },
  { domain_code:'TEC', domain_name:'Technical & Domain', subdomain_code:'TEC06', subdomain_name:'Regulatory & Compliance Awareness' },
  { domain_code:'TEC', domain_name:'Technical & Domain', subdomain_code:'TEC07', subdomain_name:'Financial Acumen' },
  { domain_code:'TEC', domain_name:'Technical & Domain', subdomain_code:'TEC08', subdomain_name:'AI & Automation Literacy' },
  { domain_code:'EIQ', domain_name:'Emotional & Social Intelligence', subdomain_code:'EIQ01', subdomain_name:'Self-Awareness' },
  { domain_code:'EIQ', domain_name:'Emotional & Social Intelligence', subdomain_code:'EIQ02', subdomain_name:'Self-Regulation' },
  { domain_code:'EIQ', domain_name:'Emotional & Social Intelligence', subdomain_code:'EIQ03', subdomain_name:'Empathy' },
  { domain_code:'EIQ', domain_name:'Emotional & Social Intelligence', subdomain_code:'EIQ04', subdomain_name:'Relationship Building' },
  { domain_code:'EIQ', domain_name:'Emotional & Social Intelligence', subdomain_code:'EIQ05', subdomain_name:'Conflict Resolution' },
  { domain_code:'EIQ', domain_name:'Emotional & Social Intelligence', subdomain_code:'EIQ06', subdomain_name:'Cultural Intelligence' },
  { domain_code:'EIQ', domain_name:'Emotional & Social Intelligence', subdomain_code:'EIQ07', subdomain_name:'Psychological Safety' },
  { domain_code:'CAI', domain_name:'Cognitive & Analytical Intelligence', subdomain_code:'CAI01', subdomain_name:'Numerical Aptitude' },
  { domain_code:'CAI', domain_name:'Cognitive & Analytical Intelligence', subdomain_code:'CAI02', subdomain_name:'Logical Reasoning' },
  { domain_code:'CAI', domain_name:'Cognitive & Analytical Intelligence', subdomain_code:'CAI03', subdomain_name:'Critical Thinking' },
  { domain_code:'CAI', domain_name:'Cognitive & Analytical Intelligence', subdomain_code:'CAI04', subdomain_name:'Analytical Thinking' },
  { domain_code:'CAI', domain_name:'Cognitive & Analytical Intelligence', subdomain_code:'CAI05', subdomain_name:'Problem Solving' },
  { domain_code:'CAI', domain_name:'Cognitive & Analytical Intelligence', subdomain_code:'CAI06', subdomain_name:'Decision Making' },
  { domain_code:'CAI', domain_name:'Cognitive & Analytical Intelligence', subdomain_code:'CAI07', subdomain_name:'Systems Thinking' },
  { domain_code:'CAI', domain_name:'Cognitive & Analytical Intelligence', subdomain_code:'CAI08', subdomain_name:'Conceptual Thinking' },
  { domain_code:'CAI', domain_name:'Cognitive & Analytical Intelligence', subdomain_code:'CAI09', subdomain_name:'Research & Data Analysis' },
  { domain_code:'CAI', domain_name:'Cognitive & Analytical Intelligence', subdomain_code:'CAI10', subdomain_name:'Creativity & Innovation' },
  { domain_code:'CAI', domain_name:'Cognitive & Analytical Intelligence', subdomain_code:'CAI11', subdomain_name:'Spatial Intelligence' },
  { domain_code:'CAI', domain_name:'Cognitive & Analytical Intelligence', subdomain_code:'CAI12', subdomain_name:'Mechanical Reasoning' },
  { domain_code:'CAI', domain_name:'Cognitive & Analytical Intelligence', subdomain_code:'CAI13', subdomain_name:'Metacognition' },
  { domain_code:'CXE', domain_name:'Communication & Expression', subdomain_code:'CXE01', subdomain_name:'Verbal Communication' },
  { domain_code:'CXE', domain_name:'Communication & Expression', subdomain_code:'CXE02', subdomain_name:'Written Communication' },
  { domain_code:'CXE', domain_name:'Communication & Expression', subdomain_code:'CXE03', subdomain_name:'Business Communication' },
  { domain_code:'CXE', domain_name:'Communication & Expression', subdomain_code:'CXE04', subdomain_name:'Presentation Skills' },
  { domain_code:'CXE', domain_name:'Communication & Expression', subdomain_code:'CXE05', subdomain_name:'Active Listening' },
  { domain_code:'CXE', domain_name:'Communication & Expression', subdomain_code:'CXE06', subdomain_name:'Persuasion & Influence' },
  { domain_code:'CXE', domain_name:'Communication & Expression', subdomain_code:'CXE07', subdomain_name:'Assertiveness' },
  { domain_code:'CXE', domain_name:'Communication & Expression', subdomain_code:'CXE08', subdomain_name:'Public Speaking' },
  { domain_code:'CXE', domain_name:'Communication & Expression', subdomain_code:'CXE09', subdomain_name:'Storytelling' },
  { domain_code:'CXE', domain_name:'Communication & Expression', subdomain_code:'CXE10', subdomain_name:'Cross-functional Communication' },
  { domain_code:'CXE', domain_name:'Communication & Expression', subdomain_code:'CXE11', subdomain_name:'Feedback Communication' },
  { domain_code:'CXE', domain_name:'Communication & Expression', subdomain_code:'CXE12', subdomain_name:'Digital Communication' },
  { domain_code:'PES', domain_name:'Personal Effectiveness & Self-Management', subdomain_code:'PES01', subdomain_name:'Self-Motivation' },
  { domain_code:'PES', domain_name:'Personal Effectiveness & Self-Management', subdomain_code:'PES02', subdomain_name:'Discipline' },
  { domain_code:'PES', domain_name:'Personal Effectiveness & Self-Management', subdomain_code:'PES03', subdomain_name:'Resilience' },
  { domain_code:'PES', domain_name:'Personal Effectiveness & Self-Management', subdomain_code:'PES04', subdomain_name:'Adaptability' },
  { domain_code:'PES', domain_name:'Personal Effectiveness & Self-Management', subdomain_code:'PES05', subdomain_name:'Integrity & Ethics' },
  { domain_code:'PES', domain_name:'Personal Effectiveness & Self-Management', subdomain_code:'PES06', subdomain_name:'Accountability' },
  { domain_code:'PES', domain_name:'Personal Effectiveness & Self-Management', subdomain_code:'PES07', subdomain_name:'Self-Awareness' },
  { domain_code:'PES', domain_name:'Personal Effectiveness & Self-Management', subdomain_code:'PES08', subdomain_name:'Emotional Regulation' },
  { domain_code:'PES', domain_name:'Personal Effectiveness & Self-Management', subdomain_code:'PES09', subdomain_name:'Learning Agility' },
  { domain_code:'PES', domain_name:'Personal Effectiveness & Self-Management', subdomain_code:'PES10', subdomain_name:'Growth Mindset' },
  { domain_code:'PES', domain_name:'Personal Effectiveness & Self-Management', subdomain_code:'PES11', subdomain_name:'Energy Management' },
  { domain_code:'PES', domain_name:'Personal Effectiveness & Self-Management', subdomain_code:'PES12', subdomain_name:'Time Management' },
  { domain_code:'PES', domain_name:'Personal Effectiveness & Self-Management', subdomain_code:'PES13', subdomain_name:'Stress Management' },
  { domain_code:'SII', domain_name:'Social & Interpersonal Intelligence', subdomain_code:'SII01', subdomain_name:'Interpersonal Skills' },
  { domain_code:'SII', domain_name:'Social & Interpersonal Intelligence', subdomain_code:'SII02', subdomain_name:'Emotional Intelligence' },
  { domain_code:'SII', domain_name:'Social & Interpersonal Intelligence', subdomain_code:'SII03', subdomain_name:'Teamwork & Collaboration' },
  { domain_code:'SII', domain_name:'Social & Interpersonal Intelligence', subdomain_code:'SII04', subdomain_name:'Conflict Resolution' },
  { domain_code:'SII', domain_name:'Social & Interpersonal Intelligence', subdomain_code:'SII05', subdomain_name:'Cultural Intelligence' },
  { domain_code:'SII', domain_name:'Social & Interpersonal Intelligence', subdomain_code:'SII06', subdomain_name:'Networking' },
  { domain_code:'SII', domain_name:'Social & Interpersonal Intelligence', subdomain_code:'SII07', subdomain_name:'Stakeholder Management' },
  { domain_code:'SII', domain_name:'Social & Interpersonal Intelligence', subdomain_code:'SII08', subdomain_name:'Customer Orientation' },
  { domain_code:'SII', domain_name:'Social & Interpersonal Intelligence', subdomain_code:'SII09', subdomain_name:'Trust Building' },
  { domain_code:'SII', domain_name:'Social & Interpersonal Intelligence', subdomain_code:'SII10', subdomain_name:'Social Awareness' },
  { domain_code:'SII', domain_name:'Social & Interpersonal Intelligence', subdomain_code:'SII11', subdomain_name:'Influence Without Authority' },
  { domain_code:'SII', domain_name:'Social & Interpersonal Intelligence', subdomain_code:'SII12', subdomain_name:'Collaboration Across Teams' },
  { domain_code:'LIN', domain_name:'Leadership & Influence', subdomain_code:'LIN01', subdomain_name:'Leadership Skills' },
  { domain_code:'LIN', domain_name:'Leadership & Influence', subdomain_code:'LIN02', subdomain_name:'People Management' },
  { domain_code:'LIN', domain_name:'Leadership & Influence', subdomain_code:'LIN03', subdomain_name:'Strategic Thinking' },
  { domain_code:'LIN', domain_name:'Leadership & Influence', subdomain_code:'LIN04', subdomain_name:'Decision Leadership' },
  { domain_code:'LIN', domain_name:'Leadership & Influence', subdomain_code:'LIN05', subdomain_name:'Change Management' },
  { domain_code:'LIN', domain_name:'Leadership & Influence', subdomain_code:'LIN06', subdomain_name:'Coaching & Mentoring' },
  { domain_code:'LIN', domain_name:'Leadership & Influence', subdomain_code:'LIN07', subdomain_name:'Execution Leadership' },
  { domain_code:'LIN', domain_name:'Leadership & Influence', subdomain_code:'LIN08', subdomain_name:'Team Building' },
  { domain_code:'LIN', domain_name:'Leadership & Influence', subdomain_code:'LIN09', subdomain_name:'Inspirational Leadership' },
  { domain_code:'LIN', domain_name:'Leadership & Influence', subdomain_code:'LIN10', subdomain_name:'Entrepreneurial Mindset' },
  { domain_code:'EOP', domain_name:'Execution, Operations & Productivity', subdomain_code:'EOP01', subdomain_name:'Task Execution' },
  { domain_code:'EOP', domain_name:'Execution, Operations & Productivity', subdomain_code:'EOP02', subdomain_name:'Project Management' },
  { domain_code:'EOP', domain_name:'Execution, Operations & Productivity', subdomain_code:'EOP03', subdomain_name:'Process Management' },
  { domain_code:'EOP', domain_name:'Execution, Operations & Productivity', subdomain_code:'EOP04', subdomain_name:'Operational Efficiency' },
  { domain_code:'EOP', domain_name:'Execution, Operations & Productivity', subdomain_code:'EOP05', subdomain_name:'Attention to Detail' },
  { domain_code:'EOP', domain_name:'Execution, Operations & Productivity', subdomain_code:'EOP06', subdomain_name:'Multitasking' },
  { domain_code:'EOP', domain_name:'Execution, Operations & Productivity', subdomain_code:'EOP07', subdomain_name:'Resource Management' },
  { domain_code:'EOP', domain_name:'Execution, Operations & Productivity', subdomain_code:'EOP08', subdomain_name:'Goal Execution' },
  { domain_code:'EOP', domain_name:'Execution, Operations & Productivity', subdomain_code:'EOP09', subdomain_name:'Performance Tracking' },
  { domain_code:'CPR', domain_name:'Career & Professional Readiness', subdomain_code:'CPR01', subdomain_name:'Career Awareness' },
  { domain_code:'CPR', domain_name:'Career & Professional Readiness', subdomain_code:'CPR02', subdomain_name:'Professionalism' },
  { domain_code:'CPR', domain_name:'Career & Professional Readiness', subdomain_code:'CPR03', subdomain_name:'Employability Skills' },
  { domain_code:'CPR', domain_name:'Career & Professional Readiness', subdomain_code:'CPR04', subdomain_name:'Interview Skills' },
  { domain_code:'CPR', domain_name:'Career & Professional Readiness', subdomain_code:'CPR05', subdomain_name:'Resume & Profile Building' },
  { domain_code:'CPR', domain_name:'Career & Professional Readiness', subdomain_code:'CPR06', subdomain_name:'Personal Branding' },
  { domain_code:'CPR', domain_name:'Career & Professional Readiness', subdomain_code:'CPR07', subdomain_name:'Organisational Awareness' },
  { domain_code:'CPR', domain_name:'Career & Professional Readiness', subdomain_code:'CPR08', subdomain_name:'Industry Awareness' },
  { domain_code:'DDT', domain_name:'Digital, Data & Technology Skills', subdomain_code:'DDT01', subdomain_name:'Digital Literacy' },
  { domain_code:'DDT', domain_name:'Digital, Data & Technology Skills', subdomain_code:'DDT02', subdomain_name:'Data Literacy' },
  { domain_code:'DDT', domain_name:'Digital, Data & Technology Skills', subdomain_code:'DDT03', subdomain_name:'Technical Skills' },
  { domain_code:'DDT', domain_name:'Digital, Data & Technology Skills', subdomain_code:'DDT04', subdomain_name:'Digital Communication Tools' },
  { domain_code:'DDT', domain_name:'Digital, Data & Technology Skills', subdomain_code:'DDT05', subdomain_name:'Technology Adaptability' },
  { domain_code:'DDT', domain_name:'Digital, Data & Technology Skills', subdomain_code:'DDT06', subdomain_name:'Automation Awareness' },
  { domain_code:'DDT', domain_name:'Digital, Data & Technology Skills', subdomain_code:'DDT07', subdomain_name:'Cyber Awareness' },
  { domain_code:'IEV', domain_name:'Innovation, Entrepreneurship & Value Creation', subdomain_code:'IEV01', subdomain_name:'Innovation Skills' },
  { domain_code:'IEV', domain_name:'Innovation, Entrepreneurship & Value Creation', subdomain_code:'IEV02', subdomain_name:'Entrepreneurial Skills' },
  { domain_code:'IEV', domain_name:'Innovation, Entrepreneurship & Value Creation', subdomain_code:'IEV03', subdomain_name:'Business Acumen' },
  { domain_code:'IEV', domain_name:'Innovation, Entrepreneurship & Value Creation', subdomain_code:'IEV04', subdomain_name:'Financial Literacy' },
  { domain_code:'IEV', domain_name:'Innovation, Entrepreneurship & Value Creation', subdomain_code:'IEV05', subdomain_name:'Design Thinking' },
  { domain_code:'EGR', domain_name:'Ethics, Governance & Responsibility', subdomain_code:'EGR01', subdomain_name:'Ethical Reasoning' },
  { domain_code:'EGR', domain_name:'Ethics, Governance & Responsibility', subdomain_code:'EGR02', subdomain_name:'Compliance Awareness' },
  { domain_code:'EGR', domain_name:'Ethics, Governance & Responsibility', subdomain_code:'EGR03', subdomain_name:'Social Responsibility' },
  { domain_code:'EGR', domain_name:'Ethics, Governance & Responsibility', subdomain_code:'EGR04', subdomain_name:'Accountability Systems' },
  { domain_code:'HWS', domain_name:'Health, Wellbeing & Sustainability', subdomain_code:'HWS01', subdomain_name:'Physical Wellbeing' },
  { domain_code:'HWS', domain_name:'Health, Wellbeing & Sustainability', subdomain_code:'HWS02', subdomain_name:'Mental Wellbeing' },
  { domain_code:'HWS', domain_name:'Health, Wellbeing & Sustainability', subdomain_code:'HWS03', subdomain_name:'Work-Life Balance' },
  { domain_code:'HWS', domain_name:'Health, Wellbeing & Sustainability', subdomain_code:'HWS04', subdomain_name:'Occupational Health Awareness' },
  { domain_code:'GFR', domain_name:'Global & Future Readiness', subdomain_code:'GFR01', subdomain_name:'Global Awareness' },
  { domain_code:'GFR', domain_name:'Global & Future Readiness', subdomain_code:'GFR02', subdomain_name:'Future Skills Orientation' },
  { domain_code:'GFR', domain_name:'Global & Future Readiness', subdomain_code:'GFR03', subdomain_name:'Lifelong Learning Orientation' },
  { domain_code:'GFR', domain_name:'Global & Future Readiness', subdomain_code:'GFR04', subdomain_name:'Remote Work Readiness' },
];

const bands = ['A', 'B', 'C'];

async function run() {
  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  try {
    await client.query('BEGIN');
    for (const sd of subdomains) {
      for (const band of bands) {
        const bandTemplates = templates[band];
        for (let i = 0; i < bandTemplates.length; i++) {
          const itemNo = String(i + 1).padStart(2, '0');
          const code = `${sd.subdomain_code}.${band}.${itemNo}`;
          const text = bandTemplates[i].replace(/{name}/g, sd.subdomain_name);
          try {
            await client.query(
              `INSERT INTO lbi_questions
                (question_code, domain_code, domain_name, subdomain_code, subdomain_name,
                 age_band_code, question_type, question_text, difficulty, status,
                 is_anchor, reverse_scored, weight, keying,
                 option_a, option_b, option_c, option_d, option_e,
                 option_a_score, option_b_score, option_c_score, option_d_score, option_e_score)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
               ON CONFLICT (question_code) DO NOTHING`,
              [
                code, sd.domain_code, sd.domain_name, sd.subdomain_code, sd.subdomain_name,
                band, 'likert', text, 'MEDIUM', 'Active',
                false, false, 1, 'Positive',
                'Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree',
                1, 2, 3, 4, 5,
              ]
            );
            inserted++;
          } catch (e: any) {
            skipped++;
          }
        }
      }
    }
    await client.query('COMMIT');
    console.log(`Done. Inserted: ${inserted}, Skipped (existing): ${skipped}`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
