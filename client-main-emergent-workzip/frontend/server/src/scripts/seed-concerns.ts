import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface ConcernRow {
  category: string;
  concern_area: string;
  parent_worry: string;
  impact_on_child: string;
  assessment_type: string;
}

const CATEGORY_ASSESSMENT: Record<string, string> = {
  'Focus': 'lbi',
  'Academics': 'lbi',
  'Behavior': 'lbi',
  'Emotional': 'lbi',
  'Mental Health': 'lbi',
  'Digital': 'lbi',
  'Social': 'lbi',
  'Habits': 'lbi',
  'Career': 'career',
  'Family': 'lbi',
  'Learning': 'lbi',
  'Cognitive': 'lbi',
  'Parenting': 'lbi',
  'Environment': 'lbi',
  'Health': 'lbi',
  'Future Skills': 'lbi',
  'Board Exams': 'exam_ready',
  'Betterment': 'exam_ready',
};

const DATA: ConcernRow[] = [
  { category: 'Focus', concern_area: 'Short attention span', parent_worry: 'My child cannot sit and study', impact_on_child: 'Poor learning', assessment_type: 'lbi' },
  { category: 'Focus', concern_area: 'Easily distracted', parent_worry: 'Gets distracted very quickly', impact_on_child: 'Low productivity', assessment_type: 'lbi' },
  { category: 'Focus', concern_area: 'Screen distraction', parent_worry: 'Always on phone/tablet', impact_on_child: 'Reduced focus', assessment_type: 'lbi' },
  { category: 'Focus', concern_area: 'Inconsistent concentration', parent_worry: 'Sometimes focused, mostly not', impact_on_child: 'Unstable performance', assessment_type: 'lbi' },
  { category: 'Focus', concern_area: 'Difficulty completing tasks', parent_worry: 'Leaves work halfway', impact_on_child: 'Poor outcomes', assessment_type: 'lbi' },
  { category: 'Focus', concern_area: 'Daydreaming', parent_worry: 'Lost in thoughts', impact_on_child: 'Low engagement', assessment_type: 'lbi' },
  { category: 'Focus', concern_area: 'Lack of mental stamina', parent_worry: 'Gets tired quickly while studying', impact_on_child: 'Weak retention', assessment_type: 'lbi' },
  { category: 'Focus', concern_area: 'Avoidance of difficult tasks', parent_worry: 'Avoids tough subjects', impact_on_child: 'Skill gaps', assessment_type: 'lbi' },
  { category: 'Focus', concern_area: 'No deep work ability', parent_worry: 'Cannot study for long hours', impact_on_child: 'Low mastery', assessment_type: 'lbi' },
  { category: 'Focus', concern_area: 'Over multitasking', parent_worry: 'Keeps switching tasks', impact_on_child: 'Inefficiency', assessment_type: 'lbi' },
  { category: 'Academics', concern_area: 'Low marks', parent_worry: 'Marks are very low', impact_on_child: 'Academic risk', assessment_type: 'lbi' },
  { category: 'Academics', concern_area: 'Sudden drop in performance', parent_worry: 'Marks have dropped recently', impact_on_child: 'Concern trigger', assessment_type: 'lbi' },
  { category: 'Academics', concern_area: 'Inconsistent results', parent_worry: 'Sometimes good, sometimes bad', impact_on_child: 'Unpredictability', assessment_type: 'lbi' },
  { category: 'Academics', concern_area: 'Exam fear', parent_worry: 'Panics during exams', impact_on_child: 'Underperformance', assessment_type: 'lbi' },
  { category: 'Academics', concern_area: 'Poor writing skills', parent_worry: 'Cannot present answers well', impact_on_child: 'Low scoring', assessment_type: 'lbi' },
  { category: 'Academics', concern_area: 'Slow writing speed', parent_worry: 'Cannot finish paper on time', impact_on_child: 'Exam loss', assessment_type: 'lbi' },
  { category: 'Academics', concern_area: 'Weak subject foundation', parent_worry: 'Basics are not clear', impact_on_child: 'Long-term gap', assessment_type: 'lbi' },
  { category: 'Academics', concern_area: 'Difficulty in math/science', parent_worry: 'Struggles with concepts', impact_on_child: 'Learning difficulty', assessment_type: 'lbi' },
  { category: 'Academics', concern_area: 'Rote learning dependency', parent_worry: 'Memorizes but doesn\'t understand', impact_on_child: 'Shallow learning', assessment_type: 'lbi' },
  { category: 'Academics', concern_area: 'Homework resistance', parent_worry: 'Doesn\'t want to do homework', impact_on_child: 'Poor discipline', assessment_type: 'lbi' },
  { category: 'Behavior', concern_area: 'Procrastination', parent_worry: 'Delays everything', impact_on_child: 'Time loss', assessment_type: 'lbi' },
  { category: 'Behavior', concern_area: 'Lack of discipline', parent_worry: 'No routine at all', impact_on_child: 'Inconsistency', assessment_type: 'lbi' },
  { category: 'Behavior', concern_area: 'Irregular study habits', parent_worry: 'Studies randomly', impact_on_child: 'Weak structure', assessment_type: 'lbi' },
  { category: 'Behavior', concern_area: 'No goal setting', parent_worry: 'No aim in life', impact_on_child: 'Directionless', assessment_type: 'lbi' },
  { category: 'Behavior', concern_area: 'Easily gives up', parent_worry: 'Quits quickly', impact_on_child: 'Low resilience', assessment_type: 'lbi' },
  { category: 'Behavior', concern_area: 'Dependency on parents', parent_worry: 'Needs constant push', impact_on_child: 'No independence', assessment_type: 'lbi' },
  { category: 'Behavior', concern_area: 'Disorganized lifestyle', parent_worry: 'Very messy routine', impact_on_child: 'Inefficiency', assessment_type: 'lbi' },
  { category: 'Behavior', concern_area: 'Poor time management', parent_worry: 'Cannot manage time', impact_on_child: 'Missed targets', assessment_type: 'lbi' },
  { category: 'Behavior', concern_area: 'Avoidance behavior', parent_worry: 'Escapes responsibilities', impact_on_child: 'Weak accountability', assessment_type: 'lbi' },
  { category: 'Behavior', concern_area: 'Lack of responsibility', parent_worry: 'Doesn\'t take things seriously', impact_on_child: 'Immaturity', assessment_type: 'lbi' },
  { category: 'Emotional', concern_area: 'Low confidence', parent_worry: 'Doesn\'t believe in self', impact_on_child: 'Poor performance', assessment_type: 'lbi' },
  { category: 'Emotional', concern_area: 'Fear of failure', parent_worry: 'Afraid to try', impact_on_child: 'Avoidance', assessment_type: 'lbi' },
  { category: 'Emotional', concern_area: 'Anxiety', parent_worry: 'Always worried', impact_on_child: 'Mental stress', assessment_type: 'lbi' },
  { category: 'Emotional', concern_area: 'Mood swings', parent_worry: 'Emotions change quickly', impact_on_child: 'Instability', assessment_type: 'lbi' },
  { category: 'Emotional', concern_area: 'Overthinking', parent_worry: 'Thinks too much', impact_on_child: 'Mental fatigue', assessment_type: 'lbi' },
  { category: 'Emotional', concern_area: 'Stress', parent_worry: 'Too much pressure', impact_on_child: 'Burnout', assessment_type: 'lbi' },
  { category: 'Emotional', concern_area: 'Negative thinking', parent_worry: 'Always pessimistic', impact_on_child: 'Low motivation', assessment_type: 'lbi' },
  { category: 'Emotional', concern_area: 'Fear of judgment', parent_worry: 'Worried about others', impact_on_child: 'Inhibition', assessment_type: 'lbi' },
  { category: 'Emotional', concern_area: 'Comparison stress', parent_worry: 'Compares with others', impact_on_child: 'Low self-worth', assessment_type: 'lbi' },
  { category: 'Emotional', concern_area: 'Emotional sensitivity', parent_worry: 'Gets hurt easily', impact_on_child: 'Fragility', assessment_type: 'lbi' },
  { category: 'Mental Health', concern_area: 'Test anxiety', parent_worry: 'Freezes in exams', impact_on_child: 'Score drop', assessment_type: 'lbi' },
  { category: 'Mental Health', concern_area: 'Social anxiety', parent_worry: 'Avoids interaction', impact_on_child: 'Isolation', assessment_type: 'lbi' },
  { category: 'Mental Health', concern_area: 'Lack of motivation', parent_worry: 'No interest in anything', impact_on_child: 'Stagnation', assessment_type: 'lbi' },
  { category: 'Mental Health', concern_area: 'Burnout', parent_worry: 'Feels tired always', impact_on_child: 'Withdrawal', assessment_type: 'lbi' },
  { category: 'Mental Health', concern_area: 'Low self-esteem', parent_worry: 'Feels inferior', impact_on_child: 'Confidence loss', assessment_type: 'lbi' },
  { category: 'Mental Health', concern_area: 'Emotional regulation issues', parent_worry: 'Cannot control emotions', impact_on_child: 'Behavioral issues', assessment_type: 'lbi' },
  { category: 'Mental Health', concern_area: 'Withdrawal behavior', parent_worry: 'Keeps to self', impact_on_child: 'Isolation', assessment_type: 'lbi' },
  { category: 'Mental Health', concern_area: 'Fear of speaking', parent_worry: 'Afraid to talk', impact_on_child: 'Communication gap', assessment_type: 'lbi' },
  { category: 'Mental Health', concern_area: 'Pressure from expectations', parent_worry: 'Feels burdened', impact_on_child: 'Stress', assessment_type: 'lbi' },
  { category: 'Mental Health', concern_area: 'Lack of mental resilience', parent_worry: 'Cannot handle failure', impact_on_child: 'Fragility', assessment_type: 'lbi' },
  { category: 'Digital', concern_area: 'Screen addiction', parent_worry: 'Always on screen', impact_on_child: 'Focus loss', assessment_type: 'lbi' },
  { category: 'Digital', concern_area: 'Gaming addiction', parent_worry: 'Plays games excessively', impact_on_child: 'Time waste', assessment_type: 'lbi' },
  { category: 'Digital', concern_area: 'Social media overuse', parent_worry: 'Always scrolling', impact_on_child: 'Distraction', assessment_type: 'lbi' },
  { category: 'Digital', concern_area: 'YouTube addiction', parent_worry: 'Watches endlessly', impact_on_child: 'Reduced productivity', assessment_type: 'lbi' },
  { category: 'Digital', concern_area: 'Late-night phone use', parent_worry: 'Sleeps very late', impact_on_child: 'Poor health', assessment_type: 'lbi' },
  { category: 'Digital', concern_area: 'Dopamine dependency', parent_worry: 'Needs constant stimulation', impact_on_child: 'Low patience', assessment_type: 'lbi' },
  { category: 'Digital', concern_area: 'Reduced offline engagement', parent_worry: 'Doesn\'t play outside', impact_on_child: 'Social impact', assessment_type: 'lbi' },
  { category: 'Digital', concern_area: 'Academic neglect due to phone', parent_worry: 'Studies less due to phone', impact_on_child: 'Performance drop', assessment_type: 'lbi' },
  { category: 'Digital', concern_area: 'Multitasking with devices', parent_worry: 'Studies + phone together', impact_on_child: 'Inefficiency', assessment_type: 'lbi' },
  { category: 'Digital', concern_area: 'Lack of digital discipline', parent_worry: 'No control over usage', impact_on_child: 'Habit damage', assessment_type: 'lbi' },
  { category: 'Social', concern_area: 'Poor communication', parent_worry: 'Cannot express clearly', impact_on_child: 'Weak interaction', assessment_type: 'lbi' },
  { category: 'Social', concern_area: 'Shyness', parent_worry: 'Too shy', impact_on_child: 'Low participation', assessment_type: 'lbi' },
  { category: 'Social', concern_area: 'Lack of friends', parent_worry: 'Doesn\'t socialize', impact_on_child: 'Isolation', assessment_type: 'lbi' },
  { category: 'Social', concern_area: 'Peer pressure', parent_worry: 'Easily influenced', impact_on_child: 'Risk behavior', assessment_type: 'lbi' },
  { category: 'Social', concern_area: 'Conflict with peers', parent_worry: 'Frequent fights', impact_on_child: 'Social issues', assessment_type: 'lbi' },
  { category: 'Social', concern_area: 'Poor listening skills', parent_worry: 'Doesn\'t listen', impact_on_child: 'Miscommunication', assessment_type: 'lbi' },
  { category: 'Social', concern_area: 'Low participation in class', parent_worry: 'Doesn\'t engage', impact_on_child: 'Missed learning', assessment_type: 'lbi' },
  { category: 'Social', concern_area: 'Fear of public speaking', parent_worry: 'Avoids stage', impact_on_child: 'Confidence gap', assessment_type: 'lbi' },
  { category: 'Social', concern_area: 'Lack of teamwork', parent_worry: 'Cannot work in groups', impact_on_child: 'Collaboration issue', assessment_type: 'lbi' },
  { category: 'Social', concern_area: 'Social comparison', parent_worry: 'Feels inferior to peers', impact_on_child: 'Low confidence', assessment_type: 'lbi' },
  { category: 'Habits', concern_area: 'Poor sleep routine', parent_worry: 'Sleeps irregularly', impact_on_child: 'Low energy', assessment_type: 'lbi' },
  { category: 'Habits', concern_area: 'Lack of physical activity', parent_worry: 'No exercise', impact_on_child: 'Health impact', assessment_type: 'lbi' },
  { category: 'Habits', concern_area: 'Poor diet habits', parent_worry: 'Unhealthy eating', impact_on_child: 'Low energy', assessment_type: 'lbi' },
  { category: 'Habits', concern_area: 'No structured routine', parent_worry: 'Day is unplanned', impact_on_child: 'Chaos', assessment_type: 'lbi' },
  { category: 'Habits', concern_area: 'Lack of consistency', parent_worry: 'Cannot follow routine', impact_on_child: 'Instability', assessment_type: 'lbi' },
  { category: 'Habits', concern_area: 'Low discipline', parent_worry: 'No control', impact_on_child: 'Weak habits', assessment_type: 'lbi' },
  { category: 'Habits', concern_area: 'Poor hygiene', parent_worry: 'Neglects self-care', impact_on_child: 'Health risk', assessment_type: 'lbi' },
  { category: 'Habits', concern_area: 'Lack of productivity habits', parent_worry: 'Wastes time', impact_on_child: 'Low output', assessment_type: 'lbi' },
  { category: 'Habits', concern_area: 'No habit formation', parent_worry: 'Cannot build habits', impact_on_child: 'No growth', assessment_type: 'lbi' },
  { category: 'Habits', concern_area: 'Irregular energy cycles', parent_worry: 'Active at wrong times', impact_on_child: 'Inefficiency', assessment_type: 'lbi' },
  { category: 'Career', concern_area: 'No career clarity', parent_worry: 'Doesn\'t know what to do', impact_on_child: 'Confusion', assessment_type: 'career' },
  { category: 'Career', concern_area: 'Too many interests', parent_worry: 'Confused between options', impact_on_child: 'Indecision', assessment_type: 'career' },
  { category: 'Career', concern_area: 'External influence', parent_worry: 'Others deciding career', impact_on_child: 'Misalignment', assessment_type: 'career' },
  { category: 'Career', concern_area: 'Lack of exposure', parent_worry: 'Doesn\'t know options', impact_on_child: 'Limited vision', assessment_type: 'career' },
  { category: 'Career', concern_area: 'Unrealistic goals', parent_worry: 'Dreams not practical', impact_on_child: 'Risk', assessment_type: 'career' },
  { category: 'Career', concern_area: 'No long-term planning', parent_worry: 'No future plan', impact_on_child: 'Uncertainty', assessment_type: 'career' },
  { category: 'Career', concern_area: 'Fear of wrong choice', parent_worry: 'What if we choose wrong', impact_on_child: 'Anxiety', assessment_type: 'career' },
  { category: 'Career', concern_area: 'Lack of skill awareness', parent_worry: 'Doesn\'t know strengths', impact_on_child: 'Misfit', assessment_type: 'career' },
  { category: 'Career', concern_area: 'No guidance', parent_worry: 'No proper advice', impact_on_child: 'Confusion', assessment_type: 'career' },
  { category: 'Career', concern_area: 'Misalignment with abilities', parent_worry: 'Choosing wrong stream', impact_on_child: 'Failure risk', assessment_type: 'career' },
  { category: 'Family', concern_area: 'Lack of communication', parent_worry: 'Doesn\'t talk openly', impact_on_child: 'Disconnect', assessment_type: 'lbi' },
  { category: 'Family', concern_area: 'Parent-child conflict', parent_worry: 'Frequent arguments', impact_on_child: 'Stress', assessment_type: 'lbi' },
  { category: 'Family', concern_area: 'Over-expectation', parent_worry: 'Pressure from parents', impact_on_child: 'Anxiety', assessment_type: 'lbi' },
  { category: 'Family', concern_area: 'Lack of guidance', parent_worry: 'We don\'t know how to help', impact_on_child: 'Confusion', assessment_type: 'lbi' },
  { category: 'Family', concern_area: 'Comparison with siblings', parent_worry: 'Compared at home', impact_on_child: 'Low self-worth', assessment_type: 'lbi' },
  { category: 'Family', concern_area: 'Lack of monitoring', parent_worry: 'We don\'t track properly', impact_on_child: 'Missed issues', assessment_type: 'lbi' },
  { category: 'Family', concern_area: 'Emotional disconnect', parent_worry: 'Not emotionally close', impact_on_child: 'Isolation', assessment_type: 'lbi' },
  { category: 'Family', concern_area: 'Over-dependence on tuition', parent_worry: 'We rely only on coaching', impact_on_child: 'Weak foundation', assessment_type: 'lbi' },
  { category: 'Family', concern_area: 'Confusion about child\'s ability', parent_worry: 'Don\'t understand child', impact_on_child: 'Misjudgment', assessment_type: 'lbi' },
  { category: 'Family', concern_area: 'Fear about future', parent_worry: 'What will happen later', impact_on_child: 'Anxiety', assessment_type: 'lbi' },
  { category: 'Learning', concern_area: 'Learning disabilities (Dyslexia, ADHD, Dysgraphia)', parent_worry: 'Why is my child not learning like others?', impact_on_child: 'Misdiagnosis, academic struggle', assessment_type: 'lbi' },
  { category: 'Learning', concern_area: 'Poor comprehension skills', parent_worry: 'Reads but doesn\'t understand', impact_on_child: 'Weak conceptual learning', assessment_type: 'lbi' },
  { category: 'Learning', concern_area: 'Memory retention issues', parent_worry: 'Forgets whatever studied', impact_on_child: 'Poor exam performance', assessment_type: 'lbi' },
  { category: 'Cognitive', concern_area: 'Low problem-solving ability', parent_worry: 'Cannot think independently', impact_on_child: 'Weak analytical skills', assessment_type: 'lbi' },
  { category: 'Cognitive', concern_area: 'Lack of critical thinking', parent_worry: 'Cannot apply knowledge', impact_on_child: 'Surface-level learning', assessment_type: 'lbi' },
  { category: 'Cognitive', concern_area: 'Slow processing speed', parent_worry: 'Takes too long to understand', impact_on_child: 'Academic delay', assessment_type: 'lbi' },
  { category: 'Emotional', concern_area: 'Anger issues', parent_worry: 'Gets angry very quickly', impact_on_child: 'Relationship & behavior problems', assessment_type: 'lbi' },
  { category: 'Emotional', concern_area: 'Lack of emotional intelligence', parent_worry: 'Cannot understand emotions', impact_on_child: 'Social disconnect', assessment_type: 'lbi' },
  { category: 'Mental Health', concern_area: 'Early signs of depression', parent_worry: 'Seems dull / uninterested', impact_on_child: 'Serious mental health risk', assessment_type: 'lbi' },
  { category: 'Mental Health', concern_area: 'Panic attacks', parent_worry: 'Sudden fear episodes', impact_on_child: 'Academic disruption', assessment_type: 'lbi' },
  { category: 'Digital', concern_area: 'Exposure to inappropriate content', parent_worry: 'What are they watching online?', impact_on_child: 'Behavioral distortion', assessment_type: 'lbi' },
  { category: 'Digital', concern_area: 'Cyberbullying', parent_worry: 'Someone is troubling online', impact_on_child: 'Emotional trauma', assessment_type: 'lbi' },
  { category: 'Social', concern_area: 'Bullying (offline)', parent_worry: 'Child is being bullied in school', impact_on_child: 'Fear, withdrawal', assessment_type: 'lbi' },
  { category: 'Social', concern_area: 'Lack of assertiveness', parent_worry: 'Cannot say no', impact_on_child: 'Peer pressure vulnerability', assessment_type: 'lbi' },
  { category: 'Social', concern_area: 'Influence of wrong peer group', parent_worry: 'Bad friends influencing', impact_on_child: 'Risky behaviors', assessment_type: 'lbi' },
  { category: 'Habits', concern_area: 'Addiction tendencies (beyond screens)', parent_worry: 'Getting addicted easily', impact_on_child: 'Long-term dependency risk', assessment_type: 'lbi' },
  { category: 'Habits', concern_area: 'Lack of self-control', parent_worry: 'Cannot control impulses', impact_on_child: 'Poor decisions', assessment_type: 'lbi' },
  { category: 'Career', concern_area: 'Lack of real-world skills', parent_worry: 'Not ready for real life', impact_on_child: 'Employability gap', assessment_type: 'career' },
  { category: 'Career', concern_area: 'Skill vs marks mismatch', parent_worry: 'Good marks but no skills', impact_on_child: 'Future struggle', assessment_type: 'career' },
  { category: 'Career', concern_area: 'Fear of competition', parent_worry: 'Cannot handle competition', impact_on_child: 'Avoidance mindset', assessment_type: 'career' },
  { category: 'Parenting', concern_area: 'Inconsistent parenting approach', parent_worry: 'We are not aligned as parents', impact_on_child: 'Confusion in child', assessment_type: 'lbi' },
  { category: 'Parenting', concern_area: 'Lack of parenting skills', parent_worry: 'We don\'t know how to guide properly', impact_on_child: 'Wrong interventions', assessment_type: 'lbi' },
  { category: 'Parenting', concern_area: 'Overprotection', parent_worry: 'We do everything for child', impact_on_child: 'Dependency', assessment_type: 'lbi' },
  { category: 'Parenting', concern_area: 'Lack of boundaries', parent_worry: 'Child doesn\'t listen at all', impact_on_child: 'Discipline issues', assessment_type: 'lbi' },
  { category: 'Environment', concern_area: 'School mismatch', parent_worry: 'School not suitable for child', impact_on_child: 'Learning dissatisfaction', assessment_type: 'lbi' },
  { category: 'Environment', concern_area: 'Academic pressure from school', parent_worry: 'Too much syllabus pressure', impact_on_child: 'Stress, burnout', assessment_type: 'lbi' },
  { category: 'Health', concern_area: 'Frequent fatigue', parent_worry: 'Always tired', impact_on_child: 'Low productivity', assessment_type: 'lbi' },
  { category: 'Health', concern_area: 'Hormonal/teen changes impact', parent_worry: 'Behavior changed suddenly', impact_on_child: 'Emotional instability', assessment_type: 'lbi' },
  { category: 'Future Skills', concern_area: 'Lack of creativity', parent_worry: 'No innovative thinking', impact_on_child: 'Limited growth', assessment_type: 'lbi' },
  { category: 'Future Skills', concern_area: 'Lack of curiosity', parent_worry: 'Doesn\'t ask questions', impact_on_child: 'Passive learning', assessment_type: 'lbi' },
  { category: 'Board Exams', concern_area: 'Failure in board exams', parent_worry: 'My child has failed in boards', impact_on_child: 'Emotional breakdown, stigma', assessment_type: 'exam_ready' },
  { category: 'Board Exams', concern_area: 'Compartment exam stress', parent_worry: 'How to clear compartment?', impact_on_child: 'Anxiety, urgency pressure', assessment_type: 'exam_ready' },
  { category: 'Board Exams', concern_area: 'Low board percentage', parent_worry: 'Marks are too low for good college', impact_on_child: 'Limited opportunities', assessment_type: 'exam_ready' },
  { category: 'Board Exams', concern_area: 'Unexpected poor results', parent_worry: 'We expected more marks', impact_on_child: 'Confidence loss', assessment_type: 'exam_ready' },
  { category: 'Board Exams', concern_area: 'Exam performance vs preparation mismatch', parent_worry: 'Studied well but marks are low', impact_on_child: 'Frustration, confusion', assessment_type: 'exam_ready' },
  { category: 'Board Exams', concern_area: 'Time mismanagement in board exam', parent_worry: 'Couldn\'t complete paper', impact_on_child: 'Score loss', assessment_type: 'exam_ready' },
  { category: 'Board Exams', concern_area: 'Poor answer presentation', parent_worry: 'Knows answers but cannot write properly', impact_on_child: 'Low evaluation score', assessment_type: 'exam_ready' },
  { category: 'Board Exams', concern_area: 'Weak exam strategy', parent_worry: 'Doesn\'t know how to attempt paper', impact_on_child: 'Inefficient scoring', assessment_type: 'exam_ready' },
  { category: 'Board Exams', concern_area: 'Panic during board exam', parent_worry: 'Blank out in exam hall', impact_on_child: 'Severe underperformance', assessment_type: 'exam_ready' },
  { category: 'Board Exams', concern_area: 'Lack of revision strategy', parent_worry: 'Didn\'t revise properly', impact_on_child: 'Poor retention', assessment_type: 'exam_ready' },
  { category: 'Board Exams', concern_area: 'Syllabus completion gaps', parent_worry: 'Portions left before exam', impact_on_child: 'Low confidence', assessment_type: 'exam_ready' },
  { category: 'Board Exams', concern_area: 'Overconfidence before exam', parent_worry: 'Thought it was easy', impact_on_child: 'Poor results', assessment_type: 'exam_ready' },
  { category: 'Board Exams', concern_area: 'Burnout before boards', parent_worry: 'Exhausted before exams started', impact_on_child: 'Performance drop', assessment_type: 'exam_ready' },
  { category: 'Board Exams', concern_area: 'External pressure (family/society)', parent_worry: 'Too much pressure for marks', impact_on_child: 'Anxiety, stress', assessment_type: 'exam_ready' },
  { category: 'Board Exams', concern_area: 'Comparison after results', parent_worry: 'Others scored more', impact_on_child: 'Low self-esteem', assessment_type: 'exam_ready' },
  { category: 'Betterment', concern_area: 'Lack of clarity about betterment exams', parent_worry: 'What is improvement exam process?', impact_on_child: 'Confusion, delay', assessment_type: 'exam_ready' },
  { category: 'Betterment', concern_area: 'Fear of repeating failure', parent_worry: 'What if marks don\'t improve again?', impact_on_child: 'Avoidance', assessment_type: 'exam_ready' },
  { category: 'Betterment', concern_area: 'No strategy for improvement exam', parent_worry: 'How to improve marks now?', impact_on_child: 'Ineffective preparation', assessment_type: 'exam_ready' },
  { category: 'Betterment', concern_area: 'Time gap misuse', parent_worry: 'Wasting time after results', impact_on_child: 'Lost opportunity', assessment_type: 'exam_ready' },
  { category: 'Betterment', concern_area: 'Lack of structured re-preparation', parent_worry: 'Doesn\'t know where to restart', impact_on_child: 'Same mistakes repeated', assessment_type: 'exam_ready' },
  { category: 'Betterment', concern_area: 'Concept gaps not fixed', parent_worry: 'Still weak in basics', impact_on_child: 'No improvement', assessment_type: 'exam_ready' },
  { category: 'Betterment', concern_area: 'Psychological setback after failure', parent_worry: 'Lost confidence completely', impact_on_child: 'Withdrawal', assessment_type: 'exam_ready' },
  { category: 'Betterment', concern_area: 'Social stigma of failure', parent_worry: 'What will others say?', impact_on_child: 'Shame, isolation', assessment_type: 'exam_ready' },
  { category: 'Betterment', concern_area: 'Lack of motivation to retry', parent_worry: 'Doesn\'t want to attempt again', impact_on_child: 'Dropout risk', assessment_type: 'exam_ready' },
  { category: 'Betterment', concern_area: 'Wrong study strategy repetition', parent_worry: 'Repeating same mistakes', impact_on_child: 'No score improvement', assessment_type: 'exam_ready' },
  { category: 'Betterment', concern_area: 'Lack of mentorship/guidance', parent_worry: 'No one to guide for improvement', impact_on_child: 'Directionless effort', assessment_type: 'exam_ready' },
  { category: 'Betterment', concern_area: 'Fear of career delay', parent_worry: 'Will this delay future?', impact_on_child: 'Anxiety', assessment_type: 'exam_ready' },
  { category: 'Betterment', concern_area: 'College admission uncertainty', parent_worry: 'Will colleges accept betterment scores?', impact_on_child: 'Confusion', assessment_type: 'exam_ready' },
  { category: 'Betterment', concern_area: 'Peer progression pressure', parent_worry: 'Friends moved ahead', impact_on_child: 'Inferiority feeling', assessment_type: 'exam_ready' },
  { category: 'Betterment', concern_area: 'Emotional recovery after failure', parent_worry: 'Child is mentally down', impact_on_child: 'Long-term confidence impact', assessment_type: 'exam_ready' },
];

async function seed() {
  const existing = await pool.query('SELECT COUNT(*) as cnt FROM concern_areas');
  if (parseInt(existing.rows[0].cnt) > 0) {
    console.log(`Table already has ${existing.rows[0].cnt} rows — clearing and re-seeding...`);
    await pool.query('TRUNCATE concern_areas RESTART IDENTITY');
  }

  let inserted = 0;
  for (let i = 0; i < DATA.length; i++) {
    const d = DATA[i];
    const keywords = [d.category, d.concern_area, d.parent_worry, d.impact_on_child].join(' ').toLowerCase();
    await pool.query(
      `INSERT INTO concern_areas (category, concern_area, parent_worry, impact_on_child, search_keywords, assessment_type, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [d.category, d.concern_area, d.parent_worry, d.impact_on_child, keywords, d.assessment_type, i + 1]
    );
    inserted++;
  }
  console.log(`Seeded ${inserted} concern areas successfully.`);
  await pool.end();
}

seed().catch(e => { console.error(e); process.exit(1); });
