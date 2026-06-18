import { useState, useEffect } from 'react';

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('metryx_token');
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
}
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Users, CheckCircle, AlertCircle, Play, Trash2, Send, BookOpen, Target, BarChart3, Sparkles, Wand2, ShieldCheck, TrendingUp, Zap, Brain, Layers, ArrowRight, Timer, Hash, ListChecks, Star, Calendar } from "lucide-react";
import { QuickScheduleButton } from '@/components/SchedulerNotification';

interface Question {
  id: string;
  questionText: string;
  questionType: 'mcq' | 'true_false' | 'short_answer' | 'vsa' | 'sa1' | 'sa2' | 'la' | 'case_based' | 'assertion_reasoning' | 'fill_blank' | 'match_following';
  options?: string[];
  correctAnswer: string;
  marks: number;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  section?: string;
  negativeMarks?: number;
}

interface Test {
  id: string;
  title: string;
  subject: string;
  description?: string;
  duration: number;
  totalMarks: number;
  status: 'draft' | 'published' | 'assigned';
  questions: Question[];
  createdAt: string;
  assignedTo?: string[];
}

interface Child {
  id: string;
  name: string;
  grade?: string;
  educationBoard?: string;
}

interface Props {
  userRole: 'parent' | 'teacher' | 'institute';
  children?: Child[];
  instituteId?: string;
  selectedChildBoard?: string;
  selectedChildGrade?: string;
  selectedChildName?: string;
}

const AI_DEMO_QUESTIONS: Record<string, Question[]> = {
  // ── Mathematics ──
  "Quadratic Equations": [
    { id: 'ai-qe-1', questionText: 'What is the standard form of a quadratic equation?', questionType: 'mcq', options: ['ax² + bx + c = 0', 'ax + b = 0', 'ax³ + bx² + cx + d = 0', 'a/x + b = 0'], correctAnswer: 'ax² + bx + c = 0', marks: 2, difficulty: 'easy' },
    { id: 'ai-qe-2', questionText: 'Find the roots of x² - 5x + 6 = 0.', questionType: 'mcq', options: ['2 and 3', '1 and 6', '-2 and -3', '3 and -2'], correctAnswer: '2 and 3', marks: 3, difficulty: 'medium' },
    { id: 'ai-qe-3', questionText: 'The discriminant of a quadratic equation determines the nature of its roots.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-qe-4', questionText: 'If the discriminant b² - 4ac < 0, what is the nature of roots?', questionType: 'mcq', options: ['Real and equal', 'Real and distinct', 'Complex/Imaginary', 'Zero'], correctAnswer: 'Complex/Imaginary', marks: 3, difficulty: 'hard' },
  ],
  "Linear Equations": [
    { id: 'ai-le-1', questionText: 'What is the solution to 2x + 4 = 10?', questionType: 'mcq', options: ['x = 3', 'x = 7', 'x = 2', 'x = 5'], correctAnswer: 'x = 3', marks: 1, difficulty: 'easy' },
    { id: 'ai-le-2', questionText: 'The graph of a linear equation in two variables is always a straight line.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-le-3', questionText: 'Find the slope of the line 3x - 2y = 6.', questionType: 'mcq', options: ['3/2', '-3/2', '2/3', '-2/3'], correctAnswer: '3/2', marks: 2, difficulty: 'medium' },
    { id: 'ai-le-4', questionText: 'For what value of k do the equations 2x + 3y = 5 and 4x + 6y = k have infinitely many solutions?', questionType: 'mcq', options: ['k = 10', 'k = 5', 'k = 12', 'k = 8'], correctAnswer: 'k = 10', marks: 3, difficulty: 'hard' },
  ],
  "Triangles": [
    { id: 'ai-tr-1', questionText: 'The sum of all angles in a triangle is:', questionType: 'mcq', options: ['90°', '180°', '270°', '360°'], correctAnswer: '180°', marks: 1, difficulty: 'easy' },
    { id: 'ai-tr-2', questionText: 'An equilateral triangle has all three sides equal.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-tr-3', questionText: 'In a right triangle with legs 3 cm and 4 cm, what is the hypotenuse?', questionType: 'mcq', options: ['5 cm', '6 cm', '7 cm', '4.5 cm'], correctAnswer: '5 cm', marks: 2, difficulty: 'medium' },
    { id: 'ai-tr-4', questionText: 'State the SSS congruence criterion.', questionType: 'short_answer', correctAnswer: 'If three sides of one triangle are equal to the three sides of another triangle, the triangles are congruent.', marks: 3, difficulty: 'hard' },
  ],
  "Circles": [
    { id: 'ai-ci-1', questionText: 'The distance from the centre to any point on the circle is called the:', questionType: 'mcq', options: ['Diameter', 'Chord', 'Radius', 'Tangent'], correctAnswer: 'Radius', marks: 1, difficulty: 'easy' },
    { id: 'ai-ci-2', questionText: 'A tangent to a circle is perpendicular to the radius at the point of tangency.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-ci-3', questionText: 'Find the area of a circle with radius 7 cm. (Use π = 22/7)', questionType: 'mcq', options: ['154 cm²', '44 cm²', '77 cm²', '308 cm²'], correctAnswer: '154 cm²', marks: 2, difficulty: 'medium' },
  ],
  "Statistics": [
    { id: 'ai-st-1', questionText: 'Which measure of central tendency is affected most by extreme values?', questionType: 'mcq', options: ['Mean', 'Median', 'Mode', 'Range'], correctAnswer: 'Mean', marks: 1, difficulty: 'easy' },
    { id: 'ai-st-2', questionText: 'The median is always one of the data values.', questionType: 'true_false', correctAnswer: 'false', marks: 1, difficulty: 'medium' },
    { id: 'ai-st-3', questionText: 'Find the mean of: 4, 7, 13, 2, 8, 5, 11.', questionType: 'mcq', options: ['6', '7', '8', '7.14'], correctAnswer: '7.14', marks: 2, difficulty: 'medium' },
    { id: 'ai-st-4', questionText: 'What is the mode of the dataset: 3, 5, 7, 3, 8, 3, 9?', questionType: 'mcq', options: ['3', '5', '7', '8'], correctAnswer: '3', marks: 1, difficulty: 'easy' },
  ],
  "Probability": [
    { id: 'ai-pr-1', questionText: 'What is the probability of getting a head when a fair coin is tossed?', questionType: 'mcq', options: ['1', '1/2', '1/4', '0'], correctAnswer: '1/2', marks: 1, difficulty: 'easy' },
    { id: 'ai-pr-2', questionText: 'The probability of an impossible event is 1.', questionType: 'true_false', correctAnswer: 'false', marks: 1, difficulty: 'easy' },
    { id: 'ai-pr-3', questionText: 'A bag contains 5 red and 3 blue balls. What is the probability of picking a blue ball?', questionType: 'mcq', options: ['3/8', '5/8', '3/5', '1/2'], correctAnswer: '3/8', marks: 2, difficulty: 'medium' },
  ],
  // ── Physics ──
  "Newton's Laws of Motion": [
    { id: 'ai-nl-1', questionText: 'Which law states that every action has an equal and opposite reaction?', questionType: 'mcq', options: ["Newton's First Law", "Newton's Second Law", "Newton's Third Law", "Law of Gravitation"], correctAnswer: "Newton's Third Law", marks: 1, difficulty: 'easy' },
    { id: 'ai-nl-2', questionText: 'F = ma represents which of Newton\'s laws?', questionType: 'mcq', options: ['First Law', 'Second Law', 'Third Law', 'Law of Inertia'], correctAnswer: 'Second Law', marks: 2, difficulty: 'medium' },
    { id: 'ai-nl-3', questionText: 'An object at rest stays at rest unless acted upon by an external force.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-nl-4', questionText: 'A 5 kg object accelerates at 3 m/s². What is the net force acting on it?', questionType: 'mcq', options: ['8 N', '15 N', '2 N', '1.67 N'], correctAnswer: '15 N', marks: 3, difficulty: 'hard' },
  ],
  "Light and Optics": [
    { id: 'ai-lo-1', questionText: 'Light travels fastest in:', questionType: 'mcq', options: ['Water', 'Glass', 'Vacuum', 'Air'], correctAnswer: 'Vacuum', marks: 1, difficulty: 'easy' },
    { id: 'ai-lo-2', questionText: 'The angle of incidence equals the angle of reflection.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-lo-3', questionText: 'Which type of mirror is used in vehicle rear-view mirrors?', questionType: 'mcq', options: ['Concave', 'Convex', 'Plane', 'Parabolic'], correctAnswer: 'Convex', marks: 2, difficulty: 'medium' },
    { id: 'ai-lo-4', questionText: 'A ray of light passes from water (n=1.33) to air (n=1). What happens at the critical angle?', questionType: 'mcq', options: ['Refraction', 'Reflection', 'Total internal reflection', 'Absorption'], correctAnswer: 'Total internal reflection', marks: 3, difficulty: 'hard' },
  ],
  "Electricity": [
    { id: 'ai-el-1', questionText: 'The unit of electric current is:', questionType: 'mcq', options: ['Volt', 'Ohm', 'Ampere', 'Watt'], correctAnswer: 'Ampere', marks: 1, difficulty: 'easy' },
    { id: 'ai-el-2', questionText: 'Ohm\'s Law states that V = IR.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-el-3', questionText: 'What is the resistance of a circuit if V = 12 V and I = 3 A?', questionType: 'mcq', options: ['4 Ω', '36 Ω', '9 Ω', '0.25 Ω'], correctAnswer: '4 Ω', marks: 2, difficulty: 'medium' },
    { id: 'ai-el-4', questionText: 'Three resistors of 2 Ω, 3 Ω and 6 Ω are connected in parallel. Find the equivalent resistance.', questionType: 'mcq', options: ['1 Ω', '11 Ω', '2 Ω', '0.5 Ω'], correctAnswer: '1 Ω', marks: 3, difficulty: 'hard' },
  ],
  // ── Chemistry ──
  "Chemical Bonding": [
    { id: 'ai-cb-1', questionText: 'Which type of bond is formed by sharing of electrons?', questionType: 'mcq', options: ['Ionic bond', 'Covalent bond', 'Metallic bond', 'Hydrogen bond'], correctAnswer: 'Covalent bond', marks: 1, difficulty: 'easy' },
    { id: 'ai-cb-2', questionText: 'NaCl is an example of an ionic compound.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-cb-3', questionText: 'What is the octet rule in chemical bonding?', questionType: 'short_answer', correctAnswer: 'Atoms tend to gain, lose, or share electrons to have 8 electrons in their outermost shell', marks: 3, difficulty: 'medium' },
    { id: 'ai-cb-4', questionText: 'Which of the following has a triple covalent bond?', questionType: 'mcq', options: ['O₂', 'N₂', 'H₂O', 'CO₂'], correctAnswer: 'N₂', marks: 2, difficulty: 'hard' },
  ],
  "Acids, Bases and Salts": [
    { id: 'ai-ab-1', questionText: 'The pH of a neutral solution is:', questionType: 'mcq', options: ['0', '7', '14', '1'], correctAnswer: '7', marks: 1, difficulty: 'easy' },
    { id: 'ai-ab-2', questionText: 'Acids have a pH less than 7.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-ab-3', questionText: 'What is formed when an acid reacts with a base?', questionType: 'mcq', options: ['Salt and water', 'Only salt', 'Only water', 'An oxide'], correctAnswer: 'Salt and water', marks: 2, difficulty: 'medium' },
    { id: 'ai-ab-4', questionText: 'Which indicator turns red in acid and blue in base?', questionType: 'mcq', options: ['Litmus', 'Phenolphthalein', 'Methyl orange', 'Universal indicator'], correctAnswer: 'Litmus', marks: 2, difficulty: 'medium' },
  ],
  "Periodic Table": [
    { id: 'ai-pt-1', questionText: 'Who proposed the modern periodic table?', questionType: 'mcq', options: ['Mendeleev', 'Moseley', 'Newlands', 'Dobereiner'], correctAnswer: 'Moseley', marks: 1, difficulty: 'medium' },
    { id: 'ai-pt-2', questionText: 'Elements in the same group have the same number of valence electrons.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-pt-3', questionText: 'Which group contains the noble gases?', questionType: 'mcq', options: ['Group 1', 'Group 17', 'Group 18', 'Group 2'], correctAnswer: 'Group 18', marks: 1, difficulty: 'easy' },
    { id: 'ai-pt-4', questionText: 'Across a period, atomic radius generally:', questionType: 'mcq', options: ['Increases', 'Decreases', 'Remains the same', 'First increases then decreases'], correctAnswer: 'Decreases', marks: 2, difficulty: 'hard' },
  ],
  // ── Biology ──
  "Photosynthesis": [
    { id: 'ai-ps-1', questionText: 'What is the primary pigment involved in photosynthesis?', questionType: 'mcq', options: ['Chlorophyll', 'Carotenoid', 'Xanthophyll', 'Anthocyanin'], correctAnswer: 'Chlorophyll', marks: 1, difficulty: 'easy' },
    { id: 'ai-ps-2', questionText: 'Photosynthesis takes place in the mitochondria.', questionType: 'true_false', correctAnswer: 'false', marks: 1, difficulty: 'easy' },
    { id: 'ai-ps-3', questionText: 'Write the balanced equation for photosynthesis.', questionType: 'short_answer', correctAnswer: '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂', marks: 3, difficulty: 'medium' },
  ],
  "Cell Structure": [
    { id: 'ai-cs-1', questionText: 'Which organelle is called the powerhouse of the cell?', questionType: 'mcq', options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi body'], correctAnswer: 'Mitochondria', marks: 1, difficulty: 'easy' },
    { id: 'ai-cs-2', questionText: 'Plant cells have a cell wall; animal cells do not.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-cs-3', questionText: 'Which part of the cell controls all cell activities?', questionType: 'mcq', options: ['Cell membrane', 'Nucleus', 'Cytoplasm', 'Vacuole'], correctAnswer: 'Nucleus', marks: 1, difficulty: 'easy' },
    { id: 'ai-cs-4', questionText: 'Describe the function of the endoplasmic reticulum.', questionType: 'short_answer', correctAnswer: 'It is a network of membranes that transports proteins and lipids within the cell.', marks: 3, difficulty: 'hard' },
  ],
  "Human Digestive System": [
    { id: 'ai-hd-1', questionText: 'Digestion of starch begins in the:', questionType: 'mcq', options: ['Stomach', 'Mouth', 'Small intestine', 'Large intestine'], correctAnswer: 'Mouth', marks: 1, difficulty: 'easy' },
    { id: 'ai-hd-2', questionText: 'Bile is produced by the liver.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-hd-3', questionText: 'Where is most nutrient absorption in the digestive system?', questionType: 'mcq', options: ['Stomach', 'Large intestine', 'Small intestine', 'Oesophagus'], correctAnswer: 'Small intestine', marks: 2, difficulty: 'medium' },
  ],
  // ── English ──
  "Grammar and Parts of Speech": [
    { id: 'ai-gm-1', questionText: 'Which part of speech describes a noun?', questionType: 'mcq', options: ['Verb', 'Adverb', 'Adjective', 'Preposition'], correctAnswer: 'Adjective', marks: 1, difficulty: 'easy' },
    { id: 'ai-gm-2', questionText: '"Quickly" is an adverb.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-gm-3', questionText: 'Identify the correct sentence: ', questionType: 'mcq', options: ['She go to school daily.', 'She goes to school daily.', 'She going to school daily.', 'She gone to school daily.'], correctAnswer: 'She goes to school daily.', marks: 2, difficulty: 'medium' },
  ],
  "Reading Comprehension": [
    { id: 'ai-rc-1', questionText: 'The main purpose of reading comprehension is to:', questionType: 'mcq', options: ['Memorise the text', 'Understand and analyse the text', 'Count the words', 'Improve handwriting'], correctAnswer: 'Understand and analyse the text', marks: 1, difficulty: 'easy' },
    { id: 'ai-rc-2', questionText: 'Inference questions require you to read between the lines.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'medium' },
    { id: 'ai-rc-3', questionText: 'Which strategy helps identify the main idea of a passage?', questionType: 'mcq', options: ['Read only the first sentence', 'Look for repeated themes and keywords', 'Count the paragraphs', 'Only read dialogue'], correctAnswer: 'Look for repeated themes and keywords', marks: 2, difficulty: 'medium' },
  ],
  "Letter Writing": [
    { id: 'ai-lw-1', questionText: 'Which part comes first in a formal letter?', questionType: 'mcq', options: ['Body', 'Salutation', "Sender's address", 'Closing'], correctAnswer: "Sender's address", marks: 1, difficulty: 'easy' },
    { id: 'ai-lw-2', questionText: '"Yours faithfully" is used in informal letters.', questionType: 'true_false', correctAnswer: 'false', marks: 1, difficulty: 'easy' },
    { id: 'ai-lw-3', questionText: 'The tone of a formal letter should be:', questionType: 'mcq', options: ['Casual and friendly', 'Polite and professional', 'Emotional', 'Humorous'], correctAnswer: 'Polite and professional', marks: 2, difficulty: 'medium' },
  ],
  // ── Social Studies ──
  "Indian History": [
    { id: 'ai-ih-1', questionText: 'Who led the Dandi March in 1930?', questionType: 'mcq', options: ['Subhas Chandra Bose', 'Mahatma Gandhi', 'Jawaharlal Nehru', 'Bhagat Singh'], correctAnswer: 'Mahatma Gandhi', marks: 1, difficulty: 'easy' },
    { id: 'ai-ih-2', questionText: 'India gained independence on 15 August 1947.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-ih-3', questionText: 'The Sepoy Mutiny of 1857 is also known as:', questionType: 'mcq', options: ['First War of Indian Independence', 'Quit India Movement', 'Non-Cooperation Movement', 'Partition of Bengal'], correctAnswer: 'First War of Indian Independence', marks: 2, difficulty: 'medium' },
  ],
  "Civics and Government": [
    { id: 'ai-cg-1', questionText: 'The head of the Indian state is the:', questionType: 'mcq', options: ['Prime Minister', 'Chief Justice', 'President', 'Speaker'], correctAnswer: 'President', marks: 1, difficulty: 'easy' },
    { id: 'ai-cg-2', questionText: 'India is a federal state with a unitary bias.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'medium' },
    { id: 'ai-cg-3', questionText: 'Fundamental Rights are enshrined in which part of the Indian Constitution?', questionType: 'mcq', options: ['Part I', 'Part III', 'Part IV', 'Part II'], correctAnswer: 'Part III', marks: 2, difficulty: 'medium' },
  ],
  "Physical Geography": [
    { id: 'ai-pg-1', questionText: 'The Himalayas are an example of which type of mountain?', questionType: 'mcq', options: ['Block mountains', 'Fold mountains', 'Volcanic mountains', 'Residual mountains'], correctAnswer: 'Fold mountains', marks: 1, difficulty: 'easy' },
    { id: 'ai-pg-2', questionText: 'The Tropic of Cancer passes through India.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-pg-3', questionText: 'Which is the longest river in India?', questionType: 'mcq', options: ['Yamuna', 'Brahmaputra', 'Ganga', 'Godavari'], correctAnswer: 'Ganga', marks: 1, difficulty: 'easy' },
  ],
  // ── Computer Science ──
  "Programming Basics": [
    { id: 'ai-pb-1', questionText: 'Which of the following is a high-level programming language?', questionType: 'mcq', options: ['Machine language', 'Assembly language', 'Python', 'Binary'], correctAnswer: 'Python', marks: 1, difficulty: 'easy' },
    { id: 'ai-pb-2', questionText: 'A compiler translates high-level code to machine code all at once.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-pb-3', questionText: 'What is the output of: print(2 ** 3) in Python?', questionType: 'mcq', options: ['6', '8', '9', '5'], correctAnswer: '8', marks: 2, difficulty: 'medium' },
    { id: 'ai-pb-4', questionText: 'What does CPU stand for?', questionType: 'mcq', options: ['Central Processing Unit', 'Computer Personal Unit', 'Core Processing Utility', 'Central Program Unit'], correctAnswer: 'Central Processing Unit', marks: 1, difficulty: 'easy' },
  ],
  "Data Structures": [
    { id: 'ai-ds-1', questionText: 'Which data structure follows the LIFO principle?', questionType: 'mcq', options: ['Queue', 'Array', 'Stack', 'Linked List'], correctAnswer: 'Stack', marks: 1, difficulty: 'easy' },
    { id: 'ai-ds-2', questionText: 'A queue follows the FIFO (First In, First Out) principle.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-ds-3', questionText: 'What is the time complexity of binary search?', questionType: 'mcq', options: ['O(n)', 'O(n²)', 'O(log n)', 'O(1)'], correctAnswer: 'O(log n)', marks: 3, difficulty: 'hard' },
  ],
  "Computer Networks": [
    { id: 'ai-cn-1', questionText: 'IP stands for:', questionType: 'mcq', options: ['Internet Protocol', 'Internal Process', 'Integrated Platform', 'Interface Port'], correctAnswer: 'Internet Protocol', marks: 1, difficulty: 'easy' },
    { id: 'ai-cn-2', questionText: 'HTTP is a stateless protocol.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'medium' },
    { id: 'ai-cn-3', questionText: 'Which network device operates at the Network layer of the OSI model?', questionType: 'mcq', options: ['Hub', 'Switch', 'Router', 'Repeater'], correctAnswer: 'Router', marks: 2, difficulty: 'medium' },
  ],
  // ── Economics ──
  "Demand and Supply": [
    { id: 'ai-ds2-1', questionText: 'According to the law of demand, as price increases, quantity demanded:', questionType: 'mcq', options: ['Increases', 'Decreases', 'Stays the same', 'Doubles'], correctAnswer: 'Decreases', marks: 1, difficulty: 'easy' },
    { id: 'ai-ds2-2', questionText: 'A rightward shift in the supply curve indicates an increase in supply.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'medium' },
    { id: 'ai-ds2-3', questionText: 'Equilibrium price is where:', questionType: 'mcq', options: ['Demand > Supply', 'Supply > Demand', 'Demand = Supply', 'Price is lowest'], correctAnswer: 'Demand = Supply', marks: 2, difficulty: 'medium' },
  ],
  "Money and Banking": [
    { id: 'ai-mb-1', questionText: 'Which institution is the central bank of India?', questionType: 'mcq', options: ['SBI', 'RBI', 'SEBI', 'NABARD'], correctAnswer: 'RBI', marks: 1, difficulty: 'easy' },
    { id: 'ai-mb-2', questionText: 'Inflation means a general increase in the price level.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-mb-3', questionText: 'The repo rate is the rate at which:', questionType: 'mcq', options: ['Banks lend to customers', 'RBI lends to commercial banks', 'Banks borrow from each other', 'Government borrows from RBI'], correctAnswer: 'RBI lends to commercial banks', marks: 2, difficulty: 'medium' },
  ],
  // ── Environmental Science ──
  "Ecosystems": [
    { id: 'ai-ec-1', questionText: 'Producers in an ecosystem are:', questionType: 'mcq', options: ['Animals', 'Fungi', 'Green plants', 'Bacteria'], correctAnswer: 'Green plants', marks: 1, difficulty: 'easy' },
    { id: 'ai-ec-2', questionText: 'Decomposers break down dead organic matter.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-ec-3', questionText: 'Which of the following is an abiotic component of an ecosystem?', questionType: 'mcq', options: ['Plants', 'Animals', 'Sunlight', 'Bacteria'], correctAnswer: 'Sunlight', marks: 2, difficulty: 'medium' },
  ],
  "Pollution and Environment": [
    { id: 'ai-pe-1', questionText: 'Which gas is primarily responsible for the greenhouse effect?', questionType: 'mcq', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correctAnswer: 'Carbon dioxide', marks: 1, difficulty: 'easy' },
    { id: 'ai-pe-2', questionText: 'Acid rain is caused by emissions of SO₂ and NOₓ.', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'medium' },
    { id: 'ai-pe-3', questionText: 'The ozone layer protects Earth from:', questionType: 'mcq', options: ['Infrared radiation', 'Ultraviolet radiation', 'Radio waves', 'Gamma rays'], correctAnswer: 'Ultraviolet radiation', marks: 2, difficulty: 'medium' },
  ],
  // ── Hindi ──
  "Hindi Vyakaran": [
    { id: 'ai-hv-1', questionText: 'संज्ञा किसे कहते हैं?', questionType: 'mcq', options: ['किसी भी कार्य का नाम', 'किसी व्यक्ति, वस्तु, स्थान या भाव का नाम', 'क्रिया का नाम', 'विशेषण का नाम'], correctAnswer: 'किसी व्यक्ति, वस्तु, स्थान या भाव का नाम', marks: 1, difficulty: 'easy' },
    { id: 'ai-hv-2', questionText: 'क्रिया वाक्य में कर्ता का काम बताती है।', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-hv-3', questionText: '"सुंदर" शब्द किस शब्द-भेद का उदाहरण है?', questionType: 'mcq', options: ['संज्ञा', 'सर्वनाम', 'विशेषण', 'क्रिया'], correctAnswer: 'विशेषण', marks: 2, difficulty: 'medium' },
  ],
  "Hindi Sahitya": [
    { id: 'ai-hs-1', questionText: 'कबीर दास किस काल के कवि हैं?', questionType: 'mcq', options: ['रीतिकाल', 'आधुनिक काल', 'भक्तिकाल', 'वीरगाथा काल'], correctAnswer: 'भक्तिकाल', marks: 1, difficulty: 'easy' },
    { id: 'ai-hs-2', questionText: 'मुंशी प्रेमचंद एक प्रसिद्ध हिंदी उपन्यासकार हैं।', questionType: 'true_false', correctAnswer: 'true', marks: 1, difficulty: 'easy' },
    { id: 'ai-hs-3', questionText: '"गोदान" उपन्यास किसने लिखा?', questionType: 'mcq', options: ['जयशंकर प्रसाद', 'मुंशी प्रेमचंद', 'महादेवी वर्मा', 'सूर्यकांत त्रिपाठी'], correctAnswer: 'मुंशी प्रेमचंद', marks: 2, difficulty: 'medium' },
  ],
};

/** Maps each subject to its relevant topics in AI_DEMO_QUESTIONS. */
const SUBJECT_TOPICS: Record<string, string[]> = {
  'Mathematics':           ['Quadratic Equations', 'Linear Equations', 'Triangles', 'Circles', 'Statistics', 'Probability'],
  'Physics':               ["Newton's Laws of Motion", 'Light and Optics', 'Electricity'],
  'Chemistry':             ['Chemical Bonding', 'Acids, Bases and Salts', 'Periodic Table'],
  'Biology':               ['Photosynthesis', 'Cell Structure', 'Human Digestive System'],
  'Science':               ['Quadratic Equations', 'Chemical Bonding', 'Photosynthesis', "Newton's Laws of Motion", 'Cell Structure', 'Acids, Bases and Salts'],
  'English':               ['Grammar and Parts of Speech', 'Reading Comprehension', 'Letter Writing'],
  'Social Studies':        ['Indian History', 'Civics and Government', 'Physical Geography'],
  'History':               ['Indian History'],
  'Geography':             ['Physical Geography'],
  'Civics':                ['Civics and Government'],
  'Economics':             ['Demand and Supply', 'Money and Banking'],
  'Computer Science':      ['Programming Basics', 'Data Structures', 'Computer Networks'],
  'Environmental Science': ['Ecosystems', 'Pollution and Environment'],
  'Hindi':                 ['Hindi Vyakaran', 'Hindi Sahitya'],
};

const AI_TOPICS = Object.keys(AI_DEMO_QUESTIONS);

const getDifficultyBadge = (difficulty?: string) => {
  switch (difficulty) {
    case 'easy': return <Badge className="text-[10px] px-1.5 py-0 bg-teal-100 text-teal-700 border-teal-200" data-testid="badge-difficulty-easy">Easy</Badge>;
    case 'medium': return <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200" data-testid="badge-difficulty-medium">Medium</Badge>;
    case 'hard': return <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200" data-testid="badge-difficulty-hard">Hard</Badge>;
    default: return null;
  }
};

const getTestHealthBadge = (test: Test) => {
  const questionCount = test.questions?.length || 0;
  if (test.status === 'draft' && questionCount < 5) {
    return <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200" data-testid={`badge-health-needs-questions-${test.id}`}><AlertCircle className="h-3 w-3 mr-0.5" />Needs Questions</Badge>;
  }
  if (test.status === 'draft') {
    return <Badge className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600 border-gray-200" data-testid={`badge-health-draft-${test.id}`}>Draft</Badge>;
  }
  if (questionCount >= 5 && test.totalMarks > 0) {
    return <Badge className="text-[10px] px-1.5 py-0 bg-teal-100 text-teal-700 border-teal-200" data-testid={`badge-health-ready-${test.id}`}><ShieldCheck className="h-3 w-3 mr-0.5" />Ready</Badge>;
  }
  if (questionCount < 5) {
    return <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200" data-testid={`badge-health-needs-questions-${test.id}`}><AlertCircle className="h-3 w-3 mr-0.5" />Needs Questions</Badge>;
  }
  return null;
};

const SUBJECTS = [
  'Mathematics', 'Science', 'English', 'Hindi', 'Social Studies',
  'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Economics',
  'History', 'Geography', 'Civics', 'Environmental Science'
];

interface ExamSection {
  name: string;
  questionTypes: string[];
  questionCount: number;
  marksPerQuestion: number;
  totalMarks: number;
  internalChoice?: string;
}

interface ExamPattern {
  id: string;
  name: string;
  description: string;
  board: string;
  category: 'board' | 'competitive' | 'school';
  targetClass: string;
  totalMarks: number;
  duration: number;
  sections: ExamSection[];
  hasNegativeMarking: boolean;
  negativeMarkValue?: number;
}

const EXAM_PATTERNS: ExamPattern[] = [
  {
    id: 'cbse-10',
    name: 'CBSE Board Pattern',
    description: 'Standard CBSE Class 10 board exam format with 5 sections',
    board: 'CBSE',
    category: 'board',
    targetClass: 'Class 10',
    totalMarks: 80,
    duration: 180,
    sections: [
      { name: 'Section A', questionTypes: ['mcq', 'assertion_reasoning'], questionCount: 20, marksPerQuestion: 1, totalMarks: 20 },
      { name: 'Section B', questionTypes: ['vsa'], questionCount: 5, marksPerQuestion: 2, totalMarks: 10, internalChoice: 'Attempt any 4 out of 5' },
      { name: 'Section C', questionTypes: ['sa1', 'sa2'], questionCount: 6, marksPerQuestion: 3, totalMarks: 18, internalChoice: 'Attempt any 5 out of 6' },
      { name: 'Section D', questionTypes: ['la'], questionCount: 4, marksPerQuestion: 5, totalMarks: 20, internalChoice: 'Attempt any 3 out of 4' },
      { name: 'Section E', questionTypes: ['case_based'], questionCount: 3, marksPerQuestion: 4, totalMarks: 12, internalChoice: 'Attempt any 2 out of 3' },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'cbse-12',
    name: 'CBSE Board Pattern',
    description: 'Standard CBSE Class 12 board exam format with 5 sections',
    board: 'CBSE',
    category: 'board',
    targetClass: 'Class 12',
    totalMarks: 70,
    duration: 180,
    sections: [
      { name: 'Section A', questionTypes: ['mcq', 'assertion_reasoning'], questionCount: 16, marksPerQuestion: 1, totalMarks: 16 },
      { name: 'Section B', questionTypes: ['vsa', 'sa1'], questionCount: 5, marksPerQuestion: 2, totalMarks: 10 },
      { name: 'Section C', questionTypes: ['sa2'], questionCount: 7, marksPerQuestion: 3, totalMarks: 21, internalChoice: 'Attempt any 6 out of 7' },
      { name: 'Section D', questionTypes: ['la'], questionCount: 3, marksPerQuestion: 5, totalMarks: 15, internalChoice: 'Attempt any 2 out of 3' },
      { name: 'Section E', questionTypes: ['case_based'], questionCount: 3, marksPerQuestion: 4, totalMarks: 8 },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'icse-10',
    name: 'ICSE Board Pattern',
    description: 'ICSE Class 10 exam format with structured sections',
    board: 'ICSE',
    category: 'board',
    targetClass: 'Class 10',
    totalMarks: 80,
    duration: 150,
    sections: [
      { name: 'Section A (Compulsory)', questionTypes: ['mcq', 'fill_blank', 'true_false'], questionCount: 15, marksPerQuestion: 1, totalMarks: 15 },
      { name: 'Section B', questionTypes: ['short_answer', 'sa1'], questionCount: 5, marksPerQuestion: 2, totalMarks: 10, internalChoice: 'Attempt any 4 out of 5' },
      { name: 'Section C', questionTypes: ['sa2'], questionCount: 8, marksPerQuestion: 3, totalMarks: 24, internalChoice: 'Attempt any 6 out of 8' },
      { name: 'Section D', questionTypes: ['la'], questionCount: 5, marksPerQuestion: 5, totalMarks: 25, internalChoice: 'Attempt any 3 out of 5' },
      { name: 'Section E', questionTypes: ['match_following', 'case_based'], questionCount: 2, marksPerQuestion: 3, totalMarks: 6 },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'ts-board',
    name: 'Telangana State Board',
    description: 'TS Board exam pattern with Part A & B structure',
    board: 'Telangana',
    category: 'board',
    targetClass: 'Class 10',
    totalMarks: 80,
    duration: 150,
    sections: [
      { name: 'Part A - Section I', questionTypes: ['vsa'], questionCount: 10, marksPerQuestion: 1, totalMarks: 10 },
      { name: 'Part A - Section II', questionTypes: ['sa1'], questionCount: 4, marksPerQuestion: 2, totalMarks: 8, internalChoice: 'Attempt any 3 out of 4' },
      { name: 'Part B - Section I', questionTypes: ['sa2'], questionCount: 4, marksPerQuestion: 4, totalMarks: 16, internalChoice: 'Attempt any 3 out of 4' },
      { name: 'Part B - Section II', questionTypes: ['la'], questionCount: 5, marksPerQuestion: 8, totalMarks: 40, internalChoice: 'Attempt any 4 out of 5' },
      { name: 'Part C', questionTypes: ['match_following', 'fill_blank'], questionCount: 3, marksPerQuestion: 2, totalMarks: 6 },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'ap-board',
    name: 'AP State Board',
    description: 'Andhra Pradesh Board exam format',
    board: 'Andhra Pradesh',
    category: 'board',
    targetClass: 'Class 10',
    totalMarks: 80,
    duration: 150,
    sections: [
      { name: 'Part A', questionTypes: ['vsa'], questionCount: 10, marksPerQuestion: 1, totalMarks: 10 },
      { name: 'Part B - Section I', questionTypes: ['sa1'], questionCount: 4, marksPerQuestion: 2, totalMarks: 8 },
      { name: 'Part B - Section II', questionTypes: ['sa2'], questionCount: 4, marksPerQuestion: 4, totalMarks: 16, internalChoice: 'Attempt any 3 out of 4' },
      { name: 'Part C', questionTypes: ['la'], questionCount: 5, marksPerQuestion: 8, totalMarks: 40, internalChoice: 'Attempt any 4 out of 5' },
      { name: 'Part D', questionTypes: ['match_following', 'fill_blank'], questionCount: 3, marksPerQuestion: 2, totalMarks: 6 },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'mh-board',
    name: 'Maharashtra State Board',
    description: 'Maharashtra Board SSC exam pattern',
    board: 'Maharashtra',
    category: 'board',
    targetClass: 'Class 10',
    totalMarks: 80,
    duration: 180,
    sections: [
      { name: 'Section A', questionTypes: ['mcq'], questionCount: 5, marksPerQuestion: 1, totalMarks: 5 },
      { name: 'Section B', questionTypes: ['vsa', 'fill_blank', 'true_false'], questionCount: 8, marksPerQuestion: 1, totalMarks: 8 },
      { name: 'Section C', questionTypes: ['sa1', 'sa2'], questionCount: 9, marksPerQuestion: 3, totalMarks: 27, internalChoice: 'Attempt any 7 out of 9' },
      { name: 'Section D', questionTypes: ['la'], questionCount: 4, marksPerQuestion: 5, totalMarks: 20, internalChoice: 'Attempt any 3 out of 4' },
      { name: 'Section E', questionTypes: ['la', 'case_based'], questionCount: 4, marksPerQuestion: 5, totalMarks: 20, internalChoice: 'Attempt any 3 out of 4' },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'jee-main',
    name: 'JEE Main Pattern',
    description: 'JEE Main exam format with negative marking',
    board: 'NTA',
    category: 'competitive',
    targetClass: 'Class 11-12',
    totalMarks: 300,
    duration: 180,
    sections: [
      { name: 'Physics - Section A', questionTypes: ['mcq'], questionCount: 20, marksPerQuestion: 4, totalMarks: 80 },
      { name: 'Physics - Section B', questionTypes: ['short_answer'], questionCount: 5, marksPerQuestion: 4, totalMarks: 20, internalChoice: 'Attempt any 5 out of 10' },
      { name: 'Chemistry - Section A', questionTypes: ['mcq'], questionCount: 20, marksPerQuestion: 4, totalMarks: 80 },
      { name: 'Chemistry - Section B', questionTypes: ['short_answer'], questionCount: 5, marksPerQuestion: 4, totalMarks: 20, internalChoice: 'Attempt any 5 out of 10' },
      { name: 'Mathematics - Section A', questionTypes: ['mcq'], questionCount: 20, marksPerQuestion: 4, totalMarks: 80 },
      { name: 'Mathematics - Section B', questionTypes: ['short_answer'], questionCount: 5, marksPerQuestion: 4, totalMarks: 20, internalChoice: 'Attempt any 5 out of 10' },
    ],
    hasNegativeMarking: true,
    negativeMarkValue: -1,
  },
  {
    id: 'neet',
    name: 'NEET Pattern',
    description: 'NEET UG exam format with negative marking',
    board: 'NTA',
    category: 'competitive',
    targetClass: 'Class 11-12',
    totalMarks: 720,
    duration: 200,
    sections: [
      { name: 'Physics - Section A', questionTypes: ['mcq'], questionCount: 35, marksPerQuestion: 4, totalMarks: 140 },
      { name: 'Physics - Section B', questionTypes: ['mcq'], questionCount: 10, marksPerQuestion: 4, totalMarks: 40, internalChoice: 'Attempt any 10 out of 15' },
      { name: 'Chemistry - Section A', questionTypes: ['mcq'], questionCount: 35, marksPerQuestion: 4, totalMarks: 140 },
      { name: 'Chemistry - Section B', questionTypes: ['mcq'], questionCount: 10, marksPerQuestion: 4, totalMarks: 40, internalChoice: 'Attempt any 10 out of 15' },
      { name: 'Biology - Section A', questionTypes: ['mcq'], questionCount: 35, marksPerQuestion: 4, totalMarks: 140 },
      { name: 'Biology - Section B', questionTypes: ['mcq'], questionCount: 10, marksPerQuestion: 4, totalMarks: 40, internalChoice: 'Attempt any 10 out of 15' },
    ],
    hasNegativeMarking: true,
    negativeMarkValue: -1,
  },
  {
    id: 'unit-test',
    name: 'Unit Test / Chapter Test',
    description: 'Quick assessment for a single chapter or unit',
    board: 'Any',
    category: 'school',
    targetClass: 'Any',
    totalMarks: 25,
    duration: 45,
    sections: [
      { name: 'Section A', questionTypes: ['mcq', 'fill_blank', 'true_false'], questionCount: 5, marksPerQuestion: 1, totalMarks: 5 },
      { name: 'Section B', questionTypes: ['vsa', 'sa1'], questionCount: 5, marksPerQuestion: 2, totalMarks: 10 },
      { name: 'Section C', questionTypes: ['sa2', 'la'], questionCount: 2, marksPerQuestion: 5, totalMarks: 10 },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'half-yearly',
    name: 'Half-Yearly / Annual Exam',
    description: 'Full-length school examination format',
    board: 'Any',
    category: 'school',
    targetClass: 'Any',
    totalMarks: 80,
    duration: 180,
    sections: [
      { name: 'Section A', questionTypes: ['mcq', 'assertion_reasoning'], questionCount: 16, marksPerQuestion: 1, totalMarks: 16 },
      { name: 'Section B', questionTypes: ['vsa'], questionCount: 5, marksPerQuestion: 2, totalMarks: 10 },
      { name: 'Section C', questionTypes: ['sa2'], questionCount: 6, marksPerQuestion: 3, totalMarks: 18, internalChoice: 'Attempt any 5 out of 6' },
      { name: 'Section D', questionTypes: ['la'], questionCount: 4, marksPerQuestion: 5, totalMarks: 20, internalChoice: 'Attempt any 3 out of 4' },
      { name: 'Section E', questionTypes: ['case_based'], questionCount: 4, marksPerQuestion: 4, totalMarks: 16, internalChoice: 'Attempt any 3 out of 4' },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'ka-sslc',
    name: 'Karnataka SSLC',
    description: 'Karnataka State Board SSLC exam format',
    board: 'Karnataka',
    category: 'board',
    targetClass: 'Class 10',
    totalMarks: 80,
    duration: 150,
    sections: [
      { name: 'Section A', questionTypes: ['mcq'], questionCount: 8, marksPerQuestion: 1, totalMarks: 8 },
      { name: 'Section B', questionTypes: ['vsa'], questionCount: 8, marksPerQuestion: 1, totalMarks: 8 },
      { name: 'Section C', questionTypes: ['sa1'], questionCount: 8, marksPerQuestion: 2, totalMarks: 16 },
      { name: 'Section D', questionTypes: ['sa2'], questionCount: 6, marksPerQuestion: 3, totalMarks: 18 },
      { name: 'Section E', questionTypes: ['la'], questionCount: 4, marksPerQuestion: 5, totalMarks: 20, internalChoice: 'Attempt any 3 out of 4' },
      { name: 'Section F', questionTypes: ['case_based'], questionCount: 2, marksPerQuestion: 5, totalMarks: 10 },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'tn-board',
    name: 'Tamil Nadu State Board',
    description: 'TN Board SSLC/HSC exam format',
    board: 'Tamil Nadu',
    category: 'board',
    targetClass: 'Class 10',
    totalMarks: 100,
    duration: 150,
    sections: [
      { name: 'Part I', questionTypes: ['mcq'], questionCount: 15, marksPerQuestion: 1, totalMarks: 15 },
      { name: 'Part II', questionTypes: ['vsa', 'fill_blank'], questionCount: 10, marksPerQuestion: 2, totalMarks: 20, internalChoice: 'Attempt any 10 out of 13' },
      { name: 'Part III', questionTypes: ['sa2'], questionCount: 10, marksPerQuestion: 3, totalMarks: 30, internalChoice: 'Attempt any 10 out of 13' },
      { name: 'Part IV', questionTypes: ['la'], questionCount: 5, marksPerQuestion: 5, totalMarks: 25, internalChoice: 'Attempt any 5 out of 7' },
      { name: 'Part V', questionTypes: ['case_based'], questionCount: 2, marksPerQuestion: 5, totalMarks: 10 },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'ker-board',
    name: 'Kerala State Board',
    description: 'Kerala SSLC exam format',
    board: 'Kerala',
    category: 'board',
    targetClass: 'Class 10',
    totalMarks: 80,
    duration: 150,
    sections: [
      { name: 'Section A', questionTypes: ['mcq', 'fill_blank'], questionCount: 10, marksPerQuestion: 1, totalMarks: 10 },
      { name: 'Section B', questionTypes: ['vsa', 'sa1'], questionCount: 8, marksPerQuestion: 2, totalMarks: 16 },
      { name: 'Section C', questionTypes: ['sa2'], questionCount: 6, marksPerQuestion: 3, totalMarks: 18 },
      { name: 'Section D', questionTypes: ['la'], questionCount: 4, marksPerQuestion: 5, totalMarks: 20, internalChoice: 'Attempt any 3 out of 4' },
      { name: 'Section E', questionTypes: ['case_based'], questionCount: 4, marksPerQuestion: 4, totalMarks: 16 },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'up-board',
    name: 'UP Board',
    description: 'Uttar Pradesh Board exam format',
    board: 'UP',
    category: 'board',
    targetClass: 'Class 10',
    totalMarks: 70,
    duration: 180,
    sections: [
      { name: 'बहुविकल्पीय (MCQ)', questionTypes: ['mcq'], questionCount: 10, marksPerQuestion: 1, totalMarks: 10 },
      { name: 'अतिलघु उत्तरीय (VSA)', questionTypes: ['vsa'], questionCount: 5, marksPerQuestion: 2, totalMarks: 10 },
      { name: 'लघु उत्तरीय (SA)', questionTypes: ['sa2'], questionCount: 5, marksPerQuestion: 3, totalMarks: 15 },
      { name: 'दीर्घ उत्तरीय (LA)', questionTypes: ['la'], questionCount: 5, marksPerQuestion: 5, totalMarks: 25, internalChoice: 'Attempt any 4 out of 5' },
      { name: 'मानचित्र/चित्र (Map/Diagram)', questionTypes: ['case_based'], questionCount: 2, marksPerQuestion: 5, totalMarks: 10 },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'raj-board',
    name: 'Rajasthan Board',
    description: 'RBSE exam format',
    board: 'Rajasthan',
    category: 'board',
    targetClass: 'Class 10',
    totalMarks: 80,
    duration: 180,
    sections: [
      { name: 'Section A', questionTypes: ['mcq', 'true_false'], questionCount: 12, marksPerQuestion: 1, totalMarks: 12 },
      { name: 'Section B', questionTypes: ['vsa'], questionCount: 8, marksPerQuestion: 2, totalMarks: 16 },
      { name: 'Section C', questionTypes: ['sa2'], questionCount: 6, marksPerQuestion: 3, totalMarks: 18, internalChoice: 'Attempt any 5 out of 6' },
      { name: 'Section D', questionTypes: ['la'], questionCount: 4, marksPerQuestion: 5, totalMarks: 20, internalChoice: 'Attempt any 3 out of 4' },
      { name: 'Section E', questionTypes: ['case_based', 'match_following'], questionCount: 4, marksPerQuestion: 3.5, totalMarks: 14 },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'bih-board',
    name: 'Bihar Board',
    description: 'BSEB exam format',
    board: 'Bihar',
    category: 'board',
    targetClass: 'Class 10',
    totalMarks: 80,
    duration: 150,
    sections: [
      { name: 'खण्ड अ (Section A)', questionTypes: ['mcq'], questionCount: 20, marksPerQuestion: 1, totalMarks: 20 },
      { name: 'खण्ड ब (Section B)', questionTypes: ['vsa', 'sa1'], questionCount: 5, marksPerQuestion: 2, totalMarks: 10 },
      { name: 'खण्ड स (Section C)', questionTypes: ['sa2'], questionCount: 6, marksPerQuestion: 3, totalMarks: 18 },
      { name: 'खण्ड द (Section D)', questionTypes: ['la'], questionCount: 4, marksPerQuestion: 5, totalMarks: 20, internalChoice: 'Attempt any 3 out of 4' },
      { name: 'खण्ड ई (Section E)', questionTypes: ['case_based'], questionCount: 3, marksPerQuestion: 4, totalMarks: 12 },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'guj-board',
    name: 'Gujarat Board',
    description: 'GSEB SSC exam format',
    board: 'Gujarat',
    category: 'board',
    targetClass: 'Class 10',
    totalMarks: 80,
    duration: 180,
    sections: [
      { name: 'Section A', questionTypes: ['mcq'], questionCount: 10, marksPerQuestion: 1, totalMarks: 10 },
      { name: 'Section B', questionTypes: ['vsa', 'fill_blank', 'true_false'], questionCount: 10, marksPerQuestion: 1, totalMarks: 10 },
      { name: 'Section C', questionTypes: ['sa1'], questionCount: 8, marksPerQuestion: 2, totalMarks: 16 },
      { name: 'Section D', questionTypes: ['sa2'], questionCount: 6, marksPerQuestion: 3, totalMarks: 18, internalChoice: 'Attempt any 5 out of 6' },
      { name: 'Section E', questionTypes: ['la'], questionCount: 4, marksPerQuestion: 5, totalMarks: 20, internalChoice: 'Attempt any 3 out of 4' },
      { name: 'Section F', questionTypes: ['match_following'], questionCount: 3, marksPerQuestion: 2, totalMarks: 6 },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'wb-board',
    name: 'West Bengal Board',
    description: 'WBBSE Madhyamik exam format',
    board: 'West Bengal',
    category: 'board',
    targetClass: 'Class 10',
    totalMarks: 90,
    duration: 195,
    sections: [
      { name: 'Section A', questionTypes: ['mcq'], questionCount: 15, marksPerQuestion: 1, totalMarks: 15 },
      { name: 'Section B', questionTypes: ['vsa'], questionCount: 10, marksPerQuestion: 1, totalMarks: 10 },
      { name: 'Section C', questionTypes: ['sa1'], questionCount: 10, marksPerQuestion: 2, totalMarks: 20 },
      { name: 'Section D', questionTypes: ['sa2'], questionCount: 5, marksPerQuestion: 3, totalMarks: 15 },
      { name: 'Section E', questionTypes: ['la'], questionCount: 4, marksPerQuestion: 5, totalMarks: 20, internalChoice: 'Attempt any 3 out of 4' },
      { name: 'Section F', questionTypes: ['case_based'], questionCount: 2, marksPerQuestion: 5, totalMarks: 10 },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'isc-12',
    name: 'ISC Board Pattern',
    description: 'ISC Class 12 exam format',
    board: 'ISC',
    category: 'board',
    targetClass: 'Class 12',
    totalMarks: 80,
    duration: 180,
    sections: [
      { name: 'Section A (Compulsory)', questionTypes: ['mcq', 'fill_blank'], questionCount: 15, marksPerQuestion: 1, totalMarks: 15 },
      { name: 'Section B', questionTypes: ['sa1'], questionCount: 5, marksPerQuestion: 2, totalMarks: 10, internalChoice: 'Attempt any 4 out of 5' },
      { name: 'Section C', questionTypes: ['sa2'], questionCount: 6, marksPerQuestion: 3, totalMarks: 18 },
      { name: 'Section D', questionTypes: ['la'], questionCount: 5, marksPerQuestion: 5, totalMarks: 25, internalChoice: 'Attempt any 4 out of 5' },
      { name: 'Section E', questionTypes: ['case_based'], questionCount: 3, marksPerQuestion: 4, totalMarks: 12 },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'nios',
    name: 'NIOS Pattern',
    description: 'National Institute of Open Schooling exam format',
    board: 'NIOS',
    category: 'board',
    targetClass: 'Class 10/12',
    totalMarks: 80,
    duration: 180,
    sections: [
      { name: 'Section A', questionTypes: ['mcq', 'fill_blank', 'true_false'], questionCount: 10, marksPerQuestion: 1, totalMarks: 10 },
      { name: 'Section B', questionTypes: ['vsa'], questionCount: 10, marksPerQuestion: 2, totalMarks: 20 },
      { name: 'Section C', questionTypes: ['sa2'], questionCount: 6, marksPerQuestion: 3, totalMarks: 18 },
      { name: 'Section D', questionTypes: ['la'], questionCount: 4, marksPerQuestion: 5, totalMarks: 20, internalChoice: 'Attempt any 3 out of 4' },
      { name: 'Section E', questionTypes: ['case_based'], questionCount: 3, marksPerQuestion: 4, totalMarks: 12 },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'ib-dp',
    name: 'IB Diploma Pattern',
    description: 'International Baccalaureate DP exam format',
    board: 'IB',
    category: 'board',
    targetClass: 'Class 11-12',
    totalMarks: 100,
    duration: 150,
    sections: [
      { name: 'Paper 1 - MCQ', questionTypes: ['mcq'], questionCount: 30, marksPerQuestion: 1, totalMarks: 30 },
      { name: 'Paper 2 - Short Response', questionTypes: ['sa1', 'sa2'], questionCount: 8, marksPerQuestion: 5, totalMarks: 40, internalChoice: 'Attempt any 6 out of 8' },
      { name: 'Paper 3 - Extended Response', questionTypes: ['la', 'case_based'], questionCount: 4, marksPerQuestion: 7.5, totalMarks: 30, internalChoice: 'Attempt any 2 out of 4' },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'igcse',
    name: 'Cambridge IGCSE',
    description: 'Cambridge IGCSE exam format',
    board: 'IGCSE',
    category: 'board',
    targetClass: 'Class 9-10',
    totalMarks: 100,
    duration: 120,
    sections: [
      { name: 'Paper 1 - Multiple Choice', questionTypes: ['mcq'], questionCount: 40, marksPerQuestion: 1, totalMarks: 40 },
      { name: 'Paper 2 - Structured Questions', questionTypes: ['sa1', 'sa2', 'la'], questionCount: 6, marksPerQuestion: 10, totalMarks: 60, internalChoice: 'Attempt any 4 out of 6' },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'cbse-9',
    name: 'CBSE Pre-Board Pattern',
    description: 'CBSE Class 9 annual exam format',
    board: 'CBSE',
    category: 'board',
    targetClass: 'Class 9',
    totalMarks: 80,
    duration: 180,
    sections: [
      { name: 'Section A', questionTypes: ['mcq', 'assertion_reasoning'], questionCount: 20, marksPerQuestion: 1, totalMarks: 20 },
      { name: 'Section B', questionTypes: ['vsa'], questionCount: 5, marksPerQuestion: 2, totalMarks: 10, internalChoice: 'Attempt any 4 out of 5' },
      { name: 'Section C', questionTypes: ['sa1', 'sa2'], questionCount: 6, marksPerQuestion: 3, totalMarks: 18, internalChoice: 'Attempt any 5 out of 6' },
      { name: 'Section D', questionTypes: ['la'], questionCount: 4, marksPerQuestion: 5, totalMarks: 20, internalChoice: 'Attempt any 3 out of 4' },
      { name: 'Section E', questionTypes: ['case_based'], questionCount: 3, marksPerQuestion: 4, totalMarks: 12, internalChoice: 'Attempt any 2 out of 3' },
    ],
    hasNegativeMarking: false,
  },
  {
    id: 'olympiad',
    name: 'Olympiad Pattern',
    description: 'Science/Math Olympiad format (SOF, HBCSE)',
    board: 'Olympiad',
    category: 'competitive',
    targetClass: 'Class 6-12',
    totalMarks: 60,
    duration: 60,
    sections: [
      { name: 'Section 1 - Logical Reasoning', questionTypes: ['mcq'], questionCount: 10, marksPerQuestion: 1, totalMarks: 10 },
      { name: 'Section 2 - Subject Knowledge', questionTypes: ['mcq'], questionCount: 25, marksPerQuestion: 1, totalMarks: 25 },
      { name: 'Section 3 - Achievers Section', questionTypes: ['mcq'], questionCount: 5, marksPerQuestion: 3, totalMarks: 15 },
      { name: 'Section 4 - Higher Order Thinking', questionTypes: ['mcq'], questionCount: 5, marksPerQuestion: 2, totalMarks: 10 },
    ],
    hasNegativeMarking: false,
  },
];

const QUESTION_TYPE_LABELS: Record<string, { label: string; shortLabel: string; marks: string; color: string }> = {
  'mcq': { label: 'Multiple Choice (MCQ)', shortLabel: 'MCQ', marks: '1', color: '#0B3C5D' },
  'true_false': { label: 'True / False', shortLabel: 'T/F', marks: '1', color: '#9B59B6' },
  'fill_blank': { label: 'Fill in the Blanks', shortLabel: 'FIB', marks: '1', color: '#E67E22' },
  'match_following': { label: 'Match the Following', shortLabel: 'Match', marks: '2-3', color: '#16A085' },
  'assertion_reasoning': { label: 'Assertion & Reasoning', shortLabel: 'A&R', marks: '1', color: '#8E44AD' },
  'vsa': { label: 'Very Short Answer', shortLabel: 'VSA', marks: '1', color: '#3498DB' },
  'short_answer': { label: 'Short Answer', shortLabel: 'SA', marks: '2', color: '#4ECDC4' },
  'sa1': { label: 'Short Answer Type I', shortLabel: 'SA-I', marks: '2', color: '#4ECDC4' },
  'sa2': { label: 'Short Answer Type II', shortLabel: 'SA-II', marks: '3', color: '#27AE60' },
  'la': { label: 'Long Answer', shortLabel: 'LA', marks: '5', color: '#E74C3C' },
  'case_based': { label: 'Case-Based / Source-Based', shortLabel: 'Case', marks: '4', color: '#F39C12' },
};

const BOARD_MATCH_MAP: Record<string, string[]> = {
  'CBSE': ['CBSE'],
  'Central Board of Secondary Education': ['CBSE'],
  'ICSE': ['ICSE', 'ISC'],
  'Indian Certificate of Secondary Education': ['ICSE', 'ISC'],
  'ISC': ['ISC', 'ICSE'],
  'Indian School Certificate': ['ISC', 'ICSE'],
  'Telangana': ['Telangana'],
  'Telangana Board': ['Telangana'],
  'TS': ['Telangana'],
  'Andhra Pradesh': ['Andhra Pradesh'],
  'AP': ['Andhra Pradesh'],
  'AP Board': ['Andhra Pradesh'],
  'Maharashtra': ['Maharashtra'],
  'Maharashtra State Board': ['Maharashtra'],
  'MH': ['Maharashtra'],
  'Karnataka': ['Karnataka'],
  'Karnataka State Board': ['Karnataka'],
  'KA': ['Karnataka'],
  'Tamil Nadu': ['Tamil Nadu'],
  'Tamil Nadu State Board': ['Tamil Nadu'],
  'TN': ['Tamil Nadu'],
  'Kerala': ['Kerala'],
  'Kerala Board': ['Kerala'],
  'KER': ['Kerala'],
  'Uttar Pradesh': ['UP'],
  'UP Board': ['UP'],
  'UP': ['UP'],
  'Rajasthan': ['Rajasthan'],
  'Rajasthan Board': ['Rajasthan'],
  'RBSE': ['Rajasthan'],
  'Bihar': ['Bihar'],
  'Bihar Board': ['Bihar'],
  'BSEB': ['Bihar'],
  'Gujarat': ['Gujarat'],
  'Gujarat Board': ['Gujarat'],
  'GSEB': ['Gujarat'],
  'West Bengal': ['West Bengal'],
  'West Bengal Board': ['West Bengal'],
  'WBBSE': ['West Bengal'],
  'NIOS': ['NIOS'],
  'National Institute of Open Schooling': ['NIOS'],
  'IB': ['IB'],
  'International Baccalaureate': ['IB'],
  'IGCSE': ['IGCSE'],
  'Cambridge IGCSE': ['IGCSE'],
  'NTA': ['NTA'],
};

function getRecommendedPatterns(board?: string, grade?: string): { recommended: ExamPattern[]; others: ExamPattern[] } {
  const matchedBoards = board ? (BOARD_MATCH_MAP[board] || BOARD_MATCH_MAP[board.replace(/ State Board| Board/gi, '')] || []) : [];

  const gradeNum = grade ? parseInt(grade.replace(/\D/g, '')) : 0;
  const gradeClass = gradeNum ? `Class ${gradeNum}` : '';

  const recommended: ExamPattern[] = [];
  const others: ExamPattern[] = [];

  for (const pattern of EXAM_PATTERNS) {
    let isMatch = false;

    if (matchedBoards.length > 0 && matchedBoards.includes(pattern.board)) {
      if (pattern.targetClass === 'Any' || pattern.targetClass.includes('Any')) {
        isMatch = true;
      } else if (gradeClass && pattern.targetClass.includes(String(gradeNum))) {
        isMatch = true;
      } else if (!gradeClass) {
        isMatch = true;
      }
    }

    if (pattern.category === 'school') {
      isMatch = true;
    }

    if (pattern.category === 'competitive' && gradeNum >= 11) {
      isMatch = true;
    }

    if (isMatch) {
      recommended.push(pattern);
    } else {
      others.push(pattern);
    }
  }

  return { recommended, others };
}

function AnimatedStatRing({ value, max, size = 44, strokeWidth = 3, color }: { value: number; max: number; size?: number; strokeWidth?: number; color: string }) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = max > 0 ? Math.min(animatedValue / max, 1) : 0;
  const offset = circumference * (1 - percent);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} opacity={0.1} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 3px ${color}40)` }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={size * 0.28} fontWeight="700">
        {value}
      </text>
    </svg>
  );
}

function SubjectIcon({ subject, size = 14 }: { subject: string; size?: number }) {
  const subjectColors: Record<string, string> = {
    'Mathematics': '#0B3C5D', 'Science': '#4ECDC4', 'English': '#E88D67',
    'Hindi': '#9B59B6', 'Social Studies': '#F39C12', 'Physics': '#3498DB',
    'Chemistry': '#4ECDC4', 'Biology': '#E74C3C', 'Computer Science': '#1ABC9C',
    'Economics': '#E67E22', 'History': '#8E44AD', 'Geography': '#27AE60',
    'Environmental Science': '#16A085'
  };
  const color = subjectColors[subject] || '#0B3C5D';
  return (
    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}10`, border: `1.5px solid ${color}20` }}>
      <BookOpen size={size} style={{ color }} />
    </div>
  );
}

function TestStatsBar({ tests }: { tests: Test[] }) {
  const totalTests = tests.length;
  const totalQuestions = tests.reduce((sum, t) => sum + (t.questions?.length || 0), 0);
  const assignedTests = tests.filter(t => t.status === 'assigned').length;
  const draftTests = tests.filter(t => t.status === 'draft').length;
  const readyTests = tests.filter(t => t.status === 'published' || (t.questions?.length || 0) >= 5).length;

  const stats = [
    { label: 'Total Tests', value: totalTests, max: Math.max(totalTests, 10), icon: Layers, color: '#0B3C5D' },
    { label: 'Questions', value: totalQuestions, max: Math.max(totalQuestions, 50), icon: Hash, color: '#4ECDC4' },
    { label: 'Assigned', value: assignedTests, max: Math.max(totalTests, 5), icon: Send, color: '#E88D67' },
    { label: 'Ready', value: readyTests, max: Math.max(totalTests, 5), icon: ShieldCheck, color: '#4ECDC4' },
  ];

  return (
    <div className="grid grid-cols-4 gap-3" data-testid="test-stats-bar">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: `${stat.color}15`, backgroundColor: `${stat.color}03` }} data-testid={`stat-card-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
          <AnimatedStatRing value={stat.value} max={stat.max} color={stat.color} />
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight" style={{ color: stat.color }} data-testid={`stat-value-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 leading-tight">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DifficultyMeter({ questions }: { questions: Question[] }) {
  const easy = questions.filter(q => q.difficulty === 'easy').length;
  const medium = questions.filter(q => q.difficulty === 'medium').length;
  const hard = questions.filter(q => q.difficulty === 'hard').length;
  const total = questions.length || 1;

  return (
    <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden w-20" data-testid="difficulty-meter">
      <div className="rounded-l-full" style={{ width: `${(easy / total) * 100}%`, backgroundColor: '#4ECDC4', transition: 'width 0.5s ease' }} />
      <div style={{ width: `${(medium / total) * 100}%`, backgroundColor: '#F39C12', transition: 'width 0.5s ease' }} />
      <div className="rounded-r-full" style={{ width: `${(hard / total) * 100}%`, backgroundColor: '#E74C3C', transition: 'width 0.5s ease' }} />
      {easy === 0 && medium === 0 && hard === 0 && <div className="w-full bg-gray-200 rounded-full" />}
    </div>
  );
}

function StatusProgressDots({ status }: { status: string }) {
  const stages = ['draft', 'published', 'assigned'];
  const currentIdx = stages.indexOf(status);

  return (
    <div className="flex items-center gap-1" data-testid="status-progress-dots">
      {stages.map((stage, idx) => (
        <div key={stage} className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full" style={{
            backgroundColor: idx <= currentIdx ? (idx === currentIdx ? '#4ECDC4' : '#0B3C5D') : '#e5e7eb',
            boxShadow: idx === currentIdx ? '0 0 6px rgba(78, 205, 196, 0.5)' : 'none',
            transition: 'all 0.3s ease'
          }} />
          {idx < stages.length - 1 && (
            <div className="h-px w-3" style={{ backgroundColor: idx < currentIdx ? '#0B3C5D' : '#e5e7eb' }} />
          )}
        </div>
      ))}
    </div>
  );
}

function ScoreRingSVG({ score, size = 60 }: { score: number; size?: number }) {
  const [animated, setAnimated] = useState(0);
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - animated / 100);
  const color = score >= 80 ? '#4ECDC4' : score >= 60 ? '#0B3C5D' : score >= 40 ? '#F39C12' : '#E74C3C';

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 150);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={5} opacity={0.1} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 4px ${color}40)` }} />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={size * 0.28} fontWeight="800">
        {score}%
      </text>
      <text x={size / 2} y={size / 2 + 10} textAnchor="middle" fill="#9ca3af" fontSize={8}>
        score
      </text>
    </svg>
  );
}

const DOT_PATTERN_BG = 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'10\' cy=\'10\' r=\'1\' fill=\'%230B3C5D\'/%3E%3C/svg%3E")';

export function TestCreationManager({ userRole, children = [], instituteId, selectedChildBoard, selectedChildGrade, selectedChildName }: Props) {
  const { toast } = useToast();
  
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my-tests');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  
  const [testTitle, setTestTitle] = useState('');
  const [testSubject, setTestSubject] = useState('');
  const [testDescription, setTestDescription] = useState('');
  const [testDuration, setTestDuration] = useState('30');
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<Question['questionType']>('mcq');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [questionMarks, setQuestionMarks] = useState('1');
  const [explanation, setExplanation] = useState('');
  
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  
  const [saving, setSaving] = useState(false);
  
  const [createStep, setCreateStep] = useState(1);
  const [selectedPattern, setSelectedPattern] = useState<ExamPattern | null>(null);
  const [testSections, setTestSections] = useState<ExamSection[]>([]);
  const [activeSection, setActiveSection] = useState('');
  const [hasNegativeMarking, setHasNegativeMarking] = useState(false);
  const [negativeMarkValue, setNegativeMarkValue] = useState('0');
  
  const [isAiGenerateOpen, setIsAiGenerateOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiDifficultyFilter, setAiDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [aiGenerating, setAiGenerating] = useState(false);
  
  // Auto-generate test states
  const [isAutoGenerateOpen, setIsAutoGenerateOpen] = useState(false);
  const [autoTitle, setAutoTitle] = useState('');
  const [autoSubject, setAutoSubject] = useState('');
  const [autoDescription, setAutoDescription] = useState('');
  const [autoDuration, setAutoDuration] = useState('30');
  const [autoBoard, setAutoBoard] = useState('');
  const [autoClass, setAutoClass] = useState('');
  const [autoChapter, setAutoChapter] = useState('');
  const [autoQuestionCount, setAutoQuestionCount] = useState('10');
  const [autoDifficulty, setAutoDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  
  // Education data for dropdowns
  const { data: boards = [] } = useQuery<any[]>({
    queryKey: ['/api/education/boards'],
    queryFn: async () => {
      const res = await fetch('/api/education/boards');
      if (!res.ok) return [];
      return res.json();
    }
  });
  
  const { data: classes = [] } = useQuery<any[]>({
    queryKey: ['/api/education/classes', autoBoard],
    queryFn: async () => {
      if (!autoBoard) return [];
      const res = await fetch(`/api/education/classes/${autoBoard}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!autoBoard
  });
  
  const { data: subjects = [] } = useQuery<any[]>({
    queryKey: ['/api/education/subjects', autoClass],
    queryFn: async () => {
      if (!autoClass) return [];
      const res = await fetch(`/api/education/subjects/${autoClass}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!autoClass
  });
  
  useEffect(() => {
    fetchTests();
  }, []);
  
  const fetchTests = async () => {
    try {
      const response = await authFetch('/api/parent-tests');
      if (response.ok) {
        const data = await response.json();
        setTests(data);
      }
    } catch (error) {
      console.error('Failed to fetch tests:', error);
    }
    setLoading(false);
  };
  
  const addQuestion = () => {
    if (!questionText.trim()) {
      toast({ title: 'Error', description: 'Please enter the question text', variant: 'destructive' });
      return;
    }
    
    if (questionType === 'mcq' && options.filter(o => o.trim()).length < 2) {
      toast({ title: 'Error', description: 'Please provide at least 2 options', variant: 'destructive' });
      return;
    }
    
    if (!correctAnswer.trim()) {
      toast({ title: 'Error', description: 'Please specify the correct answer', variant: 'destructive' });
      return;
    }
    
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      questionText,
      questionType,
      options: questionType === 'mcq' ? options.filter(o => o.trim()) : undefined,
      correctAnswer,
      marks: parseInt(questionMarks) || 1,
      explanation,
      section: activeSection || undefined,
      negativeMarks: hasNegativeMarking ? parseFloat(negativeMarkValue) || 0 : undefined,
    };
    
    setCurrentQuestions([...currentQuestions, newQuestion]);
    resetQuestionForm();
    setIsAddQuestionOpen(false);
    toast({ title: 'Success', description: 'Question added' });
  };
  
  const resetQuestionForm = () => {
    setQuestionText('');
    setQuestionType('mcq');
    setOptions(['', '', '', '']);
    setCorrectAnswer('');
    setQuestionMarks('1');
    setExplanation('');
  };
  
  const createTest = async () => {
    if (!testTitle.trim() || !testSubject) {
      toast({ title: 'Error', description: 'Please fill in title and subject', variant: 'destructive' });
      return;
    }
    
    if (currentQuestions.length === 0) {
      toast({ title: 'Error', description: 'Please add at least one question', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    try {
      const totalMarks = currentQuestions.reduce((sum, q) => sum + q.marks, 0);
      
      const response = await authFetch('/api/parent-tests', {
        method: 'POST',
        body: JSON.stringify({
          title: testTitle,
          subject: testSubject,
          description: testDescription,
          duration: parseInt(testDuration) || 30,
          totalMarks,
          questions: currentQuestions
        })
      });
      
      if (response.ok) {
        toast({ title: 'Success', description: 'Test created successfully' });
        setIsCreateOpen(false);
        resetTestForm();
        fetchTests();
      } else {
        throw new Error('Failed to create test');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create test', variant: 'destructive' });
    }
    setSaving(false);
  };
  
  const assignTest = async () => {
    if (!selectedTest || selectedChildren.length === 0) {
      toast({ title: 'Error', description: 'Please select children to assign', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    try {
      const response = await authFetch(`/api/parent-tests/${selectedTest.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          childIds: selectedChildren,
          dueDate: dueDate || null
        })
      });
      
      if (response.ok) {
        toast({ title: 'Success', description: `Test assigned to ${selectedChildren.length} child(ren)` });
        setIsAssignOpen(false);
        setSelectedChildren([]);
        setDueDate('');
        fetchTests();
      } else {
        throw new Error('Failed to assign test');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to assign test', variant: 'destructive' });
    }
    setSaving(false);
  };
  
  const deleteTest = async (testId: string) => {
    if (!confirm('Are you sure you want to delete this test?')) return;
    
    try {
      const response = await authFetch(`/api/parent-tests/${testId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast({ title: 'Success', description: 'Test deleted' });
        fetchTests();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete test', variant: 'destructive' });
    }
  };
  
  const resetTestForm = () => {
    setTestTitle('');
    setTestSubject('');
    setTestDescription('');
    setTestDuration('30');
    setCurrentQuestions([]);
    setCreateStep(1);
    setSelectedPattern(null);
    setTestSections([]);
    setActiveSection('');
    setHasNegativeMarking(false);
    setNegativeMarkValue('0');
  };
  
  const removeQuestion = (index: number) => {
    setCurrentQuestions(currentQuestions.filter((_, i) => i !== index));
  };
  
  const handleAiGenerate = () => {
    if (!aiTopic) {
      toast({ title: 'Error', description: 'Please select a topic', variant: 'destructive' });
      return;
    }
    setAiGenerating(true);
    setTimeout(() => {
      let questions = AI_DEMO_QUESTIONS[aiTopic] || [];
      if (aiDifficultyFilter !== 'all') {
        questions = questions.filter(q => q.difficulty === aiDifficultyFilter);
      }
      const timestamped = questions.map((q, i) => ({ ...q, id: `ai-${Date.now()}-${i}` }));
      setCurrentQuestions(prev => [...prev, ...timestamped]);
      setAiGenerating(false);
      setIsAiGenerateOpen(false);
      setAiTopic('');
      setAiDifficultyFilter('all');
      toast({ title: 'Success', description: `Added ${timestamped.length} AI-generated questions` });
    }, 800);
  };
  
  const resetAutoGenerateForm = () => {
    setAutoTitle('');
    setAutoSubject('');
    setAutoDescription('');
    setAutoDuration('30');
    setAutoBoard('');
    setAutoClass('');
    setAutoChapter('');
    setAutoQuestionCount('10');
    setAutoDifficulty('mixed');
    setGeneratedQuestions([]);
  };
  
  const generateQuestions = async () => {
    if (!autoSubject) {
      toast({ title: 'Error', description: 'Please select a subject', variant: 'destructive' });
      return;
    }
    
    setAutoGenerating(true);
    try {
      const params = new URLSearchParams({
        subject: autoSubject,
        count: autoQuestionCount,
        difficulty: autoDifficulty
      });
      if (autoBoard) params.append('board', autoBoard);
      if (autoClass) params.append('class', autoClass);
      if (autoChapter) params.append('chapter', autoChapter);
      
      const response = await authFetch(`/api/question-bank/generate?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        const questions: Question[] = data.questions.map((q: any, idx: number) => ({
          id: `auto-${Date.now()}-${idx}`,
          questionText: q.questionText || q.question,
          questionType: q.questionType || 'mcq',
          options: q.options,
          correctAnswer: q.correctAnswer || q.answer,
          marks: q.marks || 1,
          explanation: q.explanation
        }));
        setGeneratedQuestions(questions);
        toast({ title: 'Success', description: `Generated ${questions.length} questions` });
      } else {
        throw new Error('Failed to generate questions');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate questions. Using sample questions.', variant: 'destructive' });
      // Fallback sample questions
      const sampleQuestions: Question[] = Array.from({ length: parseInt(autoQuestionCount) || 5 }, (_, i) => ({
        id: `sample-${Date.now()}-${i}`,
        questionText: `Sample ${autoSubject} question ${i + 1}`,
        questionType: 'mcq' as const,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A',
        marks: 1
      }));
      setGeneratedQuestions(sampleQuestions);
    }
    setAutoGenerating(false);
  };
  
  const createAutoGeneratedTest = async () => {
    if (!autoTitle.trim() || !autoSubject) {
      toast({ title: 'Error', description: 'Please fill in title and subject', variant: 'destructive' });
      return;
    }
    
    if (generatedQuestions.length === 0) {
      toast({ title: 'Error', description: 'Please generate questions first', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    try {
      const totalMarks = generatedQuestions.reduce((sum, q) => sum + q.marks, 0);
      
      const response = await authFetch('/api/parent-tests', {
        method: 'POST',
        body: JSON.stringify({
          title: autoTitle,
          subject: autoSubject,
          description: autoDescription,
          duration: parseInt(autoDuration) || 30,
          totalMarks,
          questions: generatedQuestions
        })
      });
      
      if (response.ok) {
        toast({ title: 'Success', description: 'Auto-generated test created successfully' });
        setIsAutoGenerateOpen(false);
        resetAutoGenerateForm();
        fetchTests();
      } else {
        throw new Error('Failed to create test');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create test', variant: 'destructive' });
    }
    setSaving(false);
  };
  
  const removeGeneratedQuestion = (index: number) => {
    setGeneratedQuestions(generatedQuestions.filter((_, i) => i !== index));
  };
  
  const uniqueTests = tests.filter((test, index, self) => {
    const key = `${test.title}-${test.subject}-${test.totalMarks}-${test.duration}-${test.status}`;
    return index === self.findIndex(t => {
      const tKey = `${t.title}-${t.subject}-${t.totalMarks}-${t.duration}-${t.status}`;
      return tKey === key;
    });
  });

  return (
    <div className="space-y-4" data-testid="test-creation-manager">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(11, 60, 93, 0.08)', border: '1.5px solid rgba(11, 60, 93, 0.15)' }}>
            <ListChecks className="h-5 w-5" style={{ color: '#0B3C5D' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0B3C5D]" data-testid="test-manager-title">
              Test Management
            </h2>
            <p className="text-xs text-muted-foreground">
              Create, manage, and assign tests to your children
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0B3C5D] hover:bg-[#0B3C5D]/90 text-white" data-testid="btn-create-test">
                <Plus className="h-4 w-4 mr-2" />
                Create Test
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {createStep === 1 && <><FileText className="h-5 w-5" style={{ color: '#0B3C5D' }} /> Select Exam Pattern</>}
                {createStep === 2 && <><Target className="h-5 w-5" style={{ color: '#0B3C5D' }} /> Test Details</>}
                {createStep === 3 && <><ListChecks className="h-5 w-5" style={{ color: '#0B3C5D' }} /> Add Questions</>}
              </DialogTitle>
              <DialogDescription>
                {createStep === 1 && 'Choose an exam pattern or create a custom test'}
                {createStep === 2 && 'Configure your test details and review sections'}
                {createStep === 3 && 'Add questions to your test'}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-1.5 flex-1">
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        backgroundColor: createStep >= step ? '#0B3C5D' : '#e5e7eb',
                        color: createStep >= step ? '#fff' : '#9ca3af',
                      }}
                      data-testid={`step-indicator-${step}`}
                    >
                      {createStep > step ? <CheckCircle className="h-4 w-4" /> : step}
                    </div>
                    <span className="text-xs font-medium" style={{ color: createStep >= step ? '#0B3C5D' : '#9ca3af' }}>
                      {step === 1 ? 'Pattern' : step === 2 ? 'Details' : 'Questions'}
                    </span>
                  </div>
                  {step < 3 && <div className="h-px flex-1" style={{ backgroundColor: createStep > step ? '#0B3C5D' : '#e5e7eb' }} />}
                </div>
              ))}
            </div>

            {createStep === 1 && (
              <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-2 pr-3" data-testid="step-pattern-selection">
                {(selectedChildBoard || selectedChildGrade) && (() => {
                  const { recommended, others } = getRecommendedPatterns(selectedChildBoard, selectedChildGrade);
                  return (
                    <>
                      {recommended.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Star className="h-3.5 w-3.5" style={{ color: '#4ECDC4' }} />
                            <h4 className="text-xs font-semibold" style={{ color: '#0B3C5D' }}>
                              Recommended for {selectedChildName || 'your child'}
                            </h4>
                            <Badge className="text-[9px] px-1.5 py-0 ml-1" style={{ backgroundColor: 'rgba(78, 205, 196, 0.1)', color: '#4ECDC4', border: '1px solid rgba(78, 205, 196, 0.2)' }}>
                              {selectedChildBoard || ''} {selectedChildGrade ? `· ${selectedChildGrade}` : ''}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {recommended.map((pattern) => (
                              <button
                                key={pattern.id}
                                onClick={() => {
                                  setSelectedPattern(pattern);
                                  setTestSections([...pattern.sections]);
                                  setTestDuration(String(pattern.duration));
                                  setHasNegativeMarking(pattern.hasNegativeMarking);
                                  setNegativeMarkValue(String(pattern.negativeMarkValue || 0));
                                  if (pattern.sections.length > 0) setActiveSection(pattern.sections[0].name);
                                  setCreateStep(2);
                                }}
                                className="text-left p-3 rounded-lg border-2 hover:shadow-sm transition-all"
                                style={{ borderColor: 'rgba(78, 205, 196, 0.3)', backgroundColor: 'rgba(78, 205, 196, 0.02)' }}
                                data-testid={`pattern-card-${pattern.id}`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-semibold" style={{ color: '#0B3C5D' }}>{pattern.name}</span>
                                  <div className="flex items-center gap-1">
                                    {pattern.hasNegativeMarking && (
                                      <Badge className="text-[9px] px-1 py-0 bg-red-50 text-red-600 border-red-200">-ve</Badge>
                                    )}
                                    <Star className="h-3 w-3" style={{ color: '#4ECDC4' }} />
                                  </div>
                                </div>
                                <p className="text-[10px] text-gray-500 mb-1.5">{pattern.description}</p>
                                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                  <span className="font-medium" style={{ color: '#4ECDC4' }}>{pattern.board}</span>
                                  <span>{pattern.targetClass}</span>
                                  <span>{pattern.totalMarks} marks</span>
                                  <span>{pattern.duration}m</span>
                                  <span>{pattern.sections.length} sections</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {others.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Layers className="h-3.5 w-3.5" style={{ color: '#0B3C5D' }} />
                            <h4 className="text-xs font-semibold" style={{ color: '#0B3C5D' }}>All Other Patterns</h4>
                          </div>
                          {(['board', 'competitive', 'school'] as const).map((category) => {
                            const categoryPatterns = others.filter(p => p.category === category);
                            if (categoryPatterns.length === 0) return null;
                            const categoryLabel = category === 'board' ? 'Board Exams' : category === 'competitive' ? 'Competitive Exams' : 'School Tests';
                            const CategoryIcon = category === 'board' ? FileText : category === 'competitive' ? Zap : BookOpen;
                            return (
                              <div key={category} className="mb-3">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <CategoryIcon className="h-3 w-3" style={{ color: '#9ca3af' }} />
                                  <span className="text-[10px] font-semibold text-gray-400">{categoryLabel}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {categoryPatterns.map((pattern) => (
                                    <button
                                      key={pattern.id}
                                      onClick={() => {
                                        setSelectedPattern(pattern);
                                        setTestSections([...pattern.sections]);
                                        setTestDuration(String(pattern.duration));
                                        setHasNegativeMarking(pattern.hasNegativeMarking);
                                        setNegativeMarkValue(String(pattern.negativeMarkValue || 0));
                                        if (pattern.sections.length > 0) setActiveSection(pattern.sections[0].name);
                                        setCreateStep(2);
                                      }}
                                      className="text-left p-3 rounded-lg border hover:shadow-sm transition-all"
                                      style={{ borderColor: 'rgba(11, 60, 93, 0.12)' }}
                                      data-testid={`pattern-card-${pattern.id}`}
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-semibold" style={{ color: '#0B3C5D' }}>{pattern.name}</span>
                                        {pattern.hasNegativeMarking && (
                                          <Badge className="text-[9px] px-1 py-0 bg-red-50 text-red-600 border-red-200">-ve</Badge>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-gray-500 mb-1.5">{pattern.description}</p>
                                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                        <span className="font-medium" style={{ color: '#4ECDC4' }}>{pattern.board}</span>
                                        <span>{pattern.targetClass}</span>
                                        <span>{pattern.totalMarks} marks</span>
                                        <span>{pattern.duration}m</span>
                                        <span>{pattern.sections.length} sections</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}

                {!selectedChildBoard && !selectedChildGrade && (
                  <>
                    {(['board', 'competitive', 'school'] as const).map((category) => {
                      const categoryPatterns = EXAM_PATTERNS.filter(p => p.category === category);
                      const categoryLabel = category === 'board' ? 'Board Exams' : category === 'competitive' ? 'Competitive Exams' : 'School Tests';
                      const CategoryIcon = category === 'board' ? FileText : category === 'competitive' ? Zap : BookOpen;
                      return (
                        <div key={category}>
                          <div className="flex items-center gap-1.5 mb-2">
                            <CategoryIcon className="h-3.5 w-3.5" style={{ color: '#0B3C5D' }} />
                            <h4 className="text-xs font-semibold" style={{ color: '#0B3C5D' }}>{categoryLabel}</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {categoryPatterns.map((pattern) => (
                              <button
                                key={pattern.id}
                                onClick={() => {
                                  setSelectedPattern(pattern);
                                  setTestSections([...pattern.sections]);
                                  setTestDuration(String(pattern.duration));
                                  setHasNegativeMarking(pattern.hasNegativeMarking);
                                  setNegativeMarkValue(String(pattern.negativeMarkValue || 0));
                                  if (pattern.sections.length > 0) setActiveSection(pattern.sections[0].name);
                                  setCreateStep(2);
                                }}
                                className="text-left p-3 rounded-lg border hover:shadow-sm transition-all"
                                style={{ borderColor: 'rgba(11, 60, 93, 0.12)' }}
                                data-testid={`pattern-card-${pattern.id}`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-semibold" style={{ color: '#0B3C5D' }}>{pattern.name}</span>
                                  {pattern.hasNegativeMarking && (
                                    <Badge className="text-[9px] px-1 py-0 bg-red-50 text-red-600 border-red-200">-ve</Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500 mb-1.5">{pattern.description}</p>
                                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                  <span className="font-medium" style={{ color: '#4ECDC4' }}>{pattern.board}</span>
                                  <span>{pattern.targetClass}</span>
                                  <span>{pattern.totalMarks} marks</span>
                                  <span>{pattern.duration}m</span>
                                  <span>{pattern.sections.length} sections</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Target className="h-3.5 w-3.5" style={{ color: '#4ECDC4' }} />
                    <h4 className="text-xs font-semibold" style={{ color: '#0B3C5D' }}>Custom</h4>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedPattern(null);
                      setTestSections([]);
                      setActiveSection('');
                      setHasNegativeMarking(false);
                      setNegativeMarkValue('0');
                      setCreateStep(2);
                    }}
                    className="w-full text-left p-3 rounded-lg border-2 border-dashed hover:shadow-sm transition-all"
                    style={{ borderColor: 'rgba(78, 205, 196, 0.3)' }}
                    data-testid="pattern-card-custom"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(78, 205, 196, 0.08)', border: '1px solid rgba(78, 205, 196, 0.15)' }}>
                        <Plus className="h-4 w-4" style={{ color: '#4ECDC4' }} />
                      </div>
                      <div>
                        <span className="text-sm font-semibold" style={{ color: '#0B3C5D' }}>Custom Test</span>
                        <p className="text-[10px] text-gray-500">Create a freeform test with your own structure</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
              </ScrollArea>
            )}

            {createStep === 2 && (
              <div className="space-y-4 py-2" data-testid="step-test-details">
                {selectedPattern && (
                  <div className="p-3 rounded-lg border" style={{ borderColor: 'rgba(11, 60, 93, 0.12)', backgroundColor: 'rgba(11, 60, 93, 0.02)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="text-[10px] px-1.5 py-0" style={{ backgroundColor: '#0B3C5D', color: '#fff' }}>{selectedPattern.board}</Badge>
                      <span className="text-xs font-semibold" style={{ color: '#0B3C5D' }}>{selectedPattern.name} — {selectedPattern.targetClass}</span>
                    </div>
                    <p className="text-[10px] text-gray-500">{selectedPattern.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Test Title *</Label>
                    <Input
                      value={testTitle}
                      onChange={(e) => setTestTitle(e.target.value)}
                      placeholder="e.g., Chapter 5 Quiz"
                      className="h-9 text-sm"
                      data-testid="input-test-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Subject *</Label>
                    <Select value={testSubject} onValueChange={setTestSubject}>
                      <SelectTrigger className="h-9 text-sm" data-testid="select-test-subject">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBJECTS.map(subject => (
                          <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Description (optional)</Label>
                  <Textarea
                    value={testDescription}
                    onChange={(e) => setTestDescription(e.target.value)}
                    placeholder="Brief description of the test..."
                    className="text-sm min-h-[50px]"
                    data-testid="input-test-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Duration (minutes)</Label>
                    <Input
                      type="number"
                      value={testDuration}
                      onChange={(e) => setTestDuration(e.target.value)}
                      min="5" max="300"
                      className="h-9 text-sm"
                      data-testid="input-test-duration"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Total Marks</Label>
                    <Input
                      type="number"
                      value={selectedPattern ? String(selectedPattern.totalMarks) : String(currentQuestions.reduce((s, q) => s + q.marks, 0) || '')}
                      disabled={!!selectedPattern}
                      className="h-9 text-sm bg-gray-50"
                      data-testid="input-total-marks"
                    />
                  </div>
                </div>

                {testSections.length > 0 && (
                  <div className="border-t pt-3">
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#0B3C5D' }}>
                      <Layers className="h-3.5 w-3.5" />
                      Section Structure ({testSections.length} sections)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs" data-testid="section-preview-table">
                        <thead>
                          <tr className="border-b" style={{ borderColor: 'rgba(11, 60, 93, 0.1)' }}>
                            <th className="text-left py-1.5 px-2 font-semibold" style={{ color: '#0B3C5D' }}>Section</th>
                            <th className="text-left py-1.5 px-2 font-semibold" style={{ color: '#0B3C5D' }}>Question Types</th>
                            <th className="text-center py-1.5 px-2 font-semibold" style={{ color: '#0B3C5D' }}>Count</th>
                            <th className="text-center py-1.5 px-2 font-semibold" style={{ color: '#0B3C5D' }}>Marks/Q</th>
                            <th className="text-center py-1.5 px-2 font-semibold" style={{ color: '#0B3C5D' }}>Total</th>
                            <th className="text-left py-1.5 px-2 font-semibold" style={{ color: '#0B3C5D' }}>Choice</th>
                          </tr>
                        </thead>
                        <tbody>
                          {testSections.map((section, idx) => (
                            <tr key={idx} className="border-b" style={{ borderColor: 'rgba(11, 60, 93, 0.05)' }}>
                              <td className="py-1.5 px-2 font-medium text-gray-700">{section.name}</td>
                              <td className="py-1.5 px-2">
                                <div className="flex flex-wrap gap-0.5">
                                  {section.questionTypes.map(qt => {
                                    const typeInfo = QUESTION_TYPE_LABELS[qt];
                                    return (
                                      <Badge key={qt} className="text-[9px] px-1 py-0" style={{ backgroundColor: `${typeInfo?.color || '#0B3C5D'}15`, color: typeInfo?.color || '#0B3C5D', border: `1px solid ${typeInfo?.color || '#0B3C5D'}25` }}>
                                        {typeInfo?.shortLabel || qt}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="py-1.5 px-2 text-center text-gray-600">{section.questionCount}</td>
                              <td className="py-1.5 px-2 text-center text-gray-600">{section.marksPerQuestion}</td>
                              <td className="py-1.5 px-2 text-center font-medium" style={{ color: '#0B3C5D' }}>{section.totalMarks}</td>
                              <td className="py-1.5 px-2 text-gray-500 text-[10px]">{section.internalChoice || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {hasNegativeMarking && (
                  <div className="flex items-center gap-2 p-2 rounded-lg border border-red-100 bg-red-50">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="text-xs text-red-600">Negative marking: {negativeMarkValue} per wrong answer</span>
                  </div>
                )}
              </div>
            )}

            {createStep === 3 && (
              <div className="space-y-4 py-2" data-testid="step-add-questions">
                {testSections.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {testSections.map((section) => {
                      const sectionQCount = currentQuestions.filter(q => q.section === section.name).length;
                      const isActive = activeSection === section.name;
                      return (
                        <button
                          key={section.name}
                          onClick={() => setActiveSection(section.name)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
                          style={{
                            backgroundColor: isActive ? '#0B3C5D' : 'transparent',
                            color: isActive ? '#fff' : '#0B3C5D',
                            borderColor: isActive ? '#0B3C5D' : 'rgba(11, 60, 93, 0.15)',
                          }}
                          data-testid={`section-tab-${section.name}`}
                        >
                          {section.name}
                          <span className="ml-1 opacity-70">({sectionQCount}/{section.questionCount})</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold" style={{ color: '#0B3C5D' }}>
                    Questions ({currentQuestions.length})
                    {activeSection && testSections.length > 0 && (
                      <span className="font-normal text-gray-400 ml-1">
                        — {activeSection}: {currentQuestions.filter(q => q.section === activeSection).length}/{testSections.find(s => s.name === activeSection)?.questionCount || 0}
                      </span>
                    )}
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setAiTopic(''); setIsAiGenerateOpen(true); }}
                      className="h-7 text-xs border-[#4ECDC4] text-[#4ECDC4] hover:bg-[#4ECDC4]/10"
                      data-testid="btn-ai-generate-questions"
                    >
                      <Wand2 className="h-3.5 w-3.5 mr-1" />
                      AI Generate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddQuestionOpen(true)}
                      className="h-7 text-xs"
                      data-testid="btn-add-question"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Question
                    </Button>
                  </div>
                </div>

                {currentQuestions.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-xs">No questions added yet</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[220px]">
                    <div className="space-y-2">
                      {(testSections.length > 0 && activeSection
                        ? currentQuestions.filter(q => q.section === activeSection)
                        : currentQuestions
                      ).map((q, index) => {
                        const typeInfo = QUESTION_TYPE_LABELS[q.questionType];
                        return (
                          <div key={q.id} className="flex items-start justify-between p-2.5 bg-gray-50 rounded-lg" data-testid={`question-${index}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <Badge className="text-[10px] px-1.5 py-0" style={{ backgroundColor: `${typeInfo?.color || '#0B3C5D'}15`, color: typeInfo?.color || '#0B3C5D', border: `1px solid ${typeInfo?.color || '#0B3C5D'}25` }}>
                                  {typeInfo?.shortLabel || q.questionType.toUpperCase()}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{q.marks}m</Badge>
                                {getDifficultyBadge(q.difficulty)}
                                {q.section && <Badge variant="outline" className="text-[9px] px-1 py-0">{q.section}</Badge>}
                              </div>
                              <p className="text-xs truncate">{q.questionText}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeQuestion(currentQuestions.indexOf(q))}
                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 shrink-0 ml-1"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}

                {currentQuestions.length > 0 && (
                  <div className="text-xs text-gray-500">
                    Total Marks: {currentQuestions.reduce((sum, q) => sum + q.marks, 0)}
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="flex items-center justify-between gap-2">
              <div>
                {createStep > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateStep(createStep - 1)}
                    className="text-xs h-8"
                    data-testid="btn-step-back"
                  >
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setIsCreateOpen(false); resetTestForm(); }} className="text-xs h-8">Cancel</Button>
                {createStep === 2 && (
                  <Button
                    size="sm"
                    onClick={() => setCreateStep(3)}
                    disabled={!testTitle.trim() || !testSubject}
                    className="bg-[#0B3C5D] hover:bg-[#0B3C5D]/90 text-white text-xs h-8"
                    data-testid="btn-step-next"
                  >
                    Next: Add Questions
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                )}
                {createStep === 3 && (
                  <Button
                    size="sm"
                    onClick={createTest}
                    disabled={saving || currentQuestions.length === 0}
                    className="bg-[#4ECDC4] hover:bg-[#4ECDC4]/90 text-white text-xs h-8"
                    data-testid="btn-save-test"
                  >
                    {saving ? 'Creating...' : 'Create Test'}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
      
      <Dialog open={isAiGenerateOpen} onOpenChange={setIsAiGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-[#4ECDC4]" />
              AI Generate Questions
            </DialogTitle>
            <DialogDescription>
              Select a topic and difficulty level to generate sample questions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Topic *</Label>
              {testSubject && (
                <p className="text-xs text-muted-foreground">Showing topics for <span className="font-medium text-[#0B3C5D]">{testSubject}</span></p>
              )}
              <Select value={aiTopic} onValueChange={setAiTopic}>
                <SelectTrigger data-testid="select-ai-topic">
                  <SelectValue placeholder="Select a topic" />
                </SelectTrigger>
                <SelectContent>
                  {(SUBJECT_TOPICS[testSubject] || AI_TOPICS).map(topic => (
                    <SelectItem key={topic} value={topic}>{topic}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Difficulty Level</Label>
              <Select value={aiDifficultyFilter} onValueChange={(v: any) => setAiDifficultyFilter(v)}>
                <SelectTrigger data-testid="select-ai-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {aiTopic && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Preview: {aiTopic}</p>
                <p className="text-sm font-medium">
                  {(() => {
                    let qs = AI_DEMO_QUESTIONS[aiTopic] || [];
                    if (aiDifficultyFilter !== 'all') qs = qs.filter(q => q.difficulty === aiDifficultyFilter);
                    return `${qs.length} question${qs.length !== 1 ? 's' : ''} will be added`;
                  })()}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAiGenerateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAiGenerate}
              disabled={aiGenerating || !aiTopic}
              className="bg-[#4ECDC4] hover:bg-[#4ECDC4]/90 text-white"
              data-testid="btn-confirm-ai-generate"
            >
              {aiGenerating ? 'Generating...' : 'Generate & Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddQuestionOpen} onOpenChange={setIsAddQuestionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Question</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Question Type</Label>
              <Select value={questionType} onValueChange={(v) => setQuestionType(v as Question['questionType'])}>
                <SelectTrigger data-testid="select-question-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(QUESTION_TYPE_LABELS).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: info.color }} />
                        {info.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Question *</Label>
              <Textarea 
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Enter the question..."
                data-testid="input-question-text"
              />
            </div>
            
            {questionType === 'mcq' && (
              <div className="space-y-2">
                <Label>Options</Label>
                {options.map((opt, index) => (
                  <Input 
                    key={index}
                    value={opt}
                    onChange={(e) => {
                      const newOptions = [...options];
                      newOptions[index] = e.target.value;
                      setOptions(newOptions);
                    }}
                    placeholder={`Option ${index + 1}`}
                    data-testid={`input-option-${index}`}
                  />
                ))}
              </div>
            )}
            
            {questionType === 'true_false' && (
              <div className="space-y-2">
                <Label>Correct Answer</Label>
                <Select value={correctAnswer} onValueChange={setCorrectAnswer}>
                  <SelectTrigger data-testid="select-correct-tf">
                    <SelectValue placeholder="Select answer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {(questionType === 'mcq' || questionType === 'short_answer') && (
              <div className="space-y-2">
                <Label>Correct Answer *</Label>
                <Input 
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  placeholder={questionType === 'mcq' ? 'Enter the correct option text' : 'Enter the answer'}
                  data-testid="input-correct-answer"
                />
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marks</Label>
                <Input 
                  type="number"
                  value={questionMarks}
                  onChange={(e) => setQuestionMarks(e.target.value)}
                  min="1"
                  max="10"
                  data-testid="input-question-marks"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Explanation (optional)</Label>
              <Textarea 
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explanation shown after answering..."
                data-testid="input-explanation"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddQuestionOpen(false)}>Cancel</Button>
            <Button onClick={addQuestion} className="bg-[#4ECDC4] hover:bg-[#4ECDC4]/90 text-white" data-testid="btn-confirm-add-question">
              Add Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <TestStatsBar tests={uniqueTests} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="my-tests" data-testid="tab-my-tests">
            <FileText className="h-4 w-4 mr-1" />
            My Tests
          </TabsTrigger>
          <TabsTrigger value="ai-generate" data-testid="tab-ai-generate">
            <Sparkles className="h-4 w-4 mr-1" />
            AI Generate
          </TabsTrigger>
          <TabsTrigger value="assigned" data-testid="tab-assigned-tests">
            <Users className="h-4 w-4 mr-1" />
            Assigned
          </TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results">
            <BarChart3 className="h-4 w-4 mr-1" />
            Results
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="my-tests" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-3">
              <div className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0B3C5D', borderTopColor: 'transparent' }} />
              <span className="text-sm text-muted-foreground">Loading tests...</span>
            </div>
          ) : uniqueTests.length === 0 ? (
            <Card className="border border-dashed overflow-hidden" data-testid="my-tests-empty-state">
              <CardContent className="py-10 text-center relative">
                <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: DOT_PATTERN_BG, backgroundSize: '20px 20px' }} />
                <div className="relative z-10">
                  <div className="h-16 w-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(11, 60, 93, 0.06)', border: '2px dashed rgba(11, 60, 93, 0.15)' }}>
                    <FileText className="h-8 w-8" style={{ color: '#0B3C5D', opacity: 0.4 }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: '#0B3C5D' }}>No tests created yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Create your first test to start tracking progress</p>
                  <div className="flex justify-center gap-6 mb-4">
                    {[
                      { icon: Wand2, label: 'AI Generate', desc: 'Auto-create from topics' },
                      { icon: Target, label: 'Custom Build', desc: 'Add your own questions' },
                      { icon: Send, label: 'Assign & Track', desc: 'Monitor child progress' },
                    ].map((feature) => (
                      <div key={feature.label} className="text-center w-28">
                        <div className="h-9 w-9 rounded-lg mx-auto mb-1.5 flex items-center justify-center" style={{ backgroundColor: 'rgba(78, 205, 196, 0.08)', border: '1px solid rgba(78, 205, 196, 0.15)' }}>
                          <feature.icon className="h-4 w-4" style={{ color: '#4ECDC4' }} />
                        </div>
                        <p className="text-xs font-medium" style={{ color: '#0B3C5D' }}>{feature.label}</p>
                        <p className="text-[10px] text-gray-400">{feature.desc}</p>
                      </div>
                    ))}
                  </div>
                  <Button onClick={() => setIsCreateOpen(true)} className="bg-[#0B3C5D] hover:bg-[#0B3C5D]/90 text-white text-xs" data-testid="btn-empty-create-test">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Create Your First Test
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {uniqueTests.map(test => {
                const questionCount = test.questions?.length || 0;
                return (
                  <Card key={test.id} className="overflow-hidden hover:shadow-sm transition-shadow" data-testid={`test-card-${test.id}`}>
                    <div className="flex items-stretch">
                      <div className="w-1 shrink-0" style={{
                        backgroundColor: test.status === 'assigned' ? '#4ECDC4' : test.status === 'published' ? '#4ECDC4' : '#0B3C5D',
                        opacity: test.status === 'draft' ? 0.3 : 1
                      }} />
                      <CardContent className="flex items-center justify-between py-3 px-4 flex-1">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <SubjectIcon subject={test.subject} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold truncate" style={{ color: '#0B3C5D' }}>{test.title}</p>
                              {getTestHealthBadge(test)}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                              <span className="flex items-center gap-1"><BookOpen size={10} />{test.subject}</span>
                              <span className="flex items-center gap-1"><Timer size={10} />{test.duration}m</span>
                              <span className="flex items-center gap-1"><Target size={10} />{test.totalMarks} marks</span>
                              <span className="flex items-center gap-1"><Hash size={10} />{questionCount}Q</span>
                              {(() => {
                                const matchedPattern = EXAM_PATTERNS.find(p => p.totalMarks === test.totalMarks && p.duration === test.duration);
                                const sections = new Set((test.questions || []).map(q => q.section).filter(Boolean));
                                return (
                                  <>
                                    {matchedPattern && (
                                      <Badge className="text-[9px] px-1 py-0" style={{ backgroundColor: '#0B3C5D10', color: '#0B3C5D', border: '1px solid #0B3C5D20' }} data-testid={`badge-pattern-${test.id}`}>
                                        {matchedPattern.board} Pattern
                                      </Badge>
                                    )}
                                    {sections.size > 0 && (
                                      <Badge className="text-[9px] px-1 py-0" style={{ backgroundColor: '#4ECDC410', color: '#4ECDC4', border: '1px solid #4ECDC420' }} data-testid={`badge-sections-${test.id}`}>
                                        <Layers size={8} className="mr-0.5" />{sections.size} Sections
                                      </Badge>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <StatusProgressDots status={test.status} />
                              <DifficultyMeter questions={test.questions || []} />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {test.status === 'draft' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-7 text-xs border-[#4ECDC4] text-[#4ECDC4] hover:bg-[#4ECDC4]/10"
                              onClick={() => {
                                setSelectedTest(test);
                                setIsAssignOpen(true);
                              }}
                              data-testid={`btn-assign-${test.id}`}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Assign
                            </Button>
                          )}
                          {test.status === 'assigned' && (
                            <Button 
                              size="sm"
                              className="h-7 text-xs bg-[#0B3C5D] hover:bg-[#0B3C5D]/90 text-white"
                              onClick={() => setSelectedTest(test)}
                              data-testid={`btn-session-${test.id}`}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Start Session
                            </Button>
                          )}
                          <QuickScheduleButton
                            eventType="test"
                            title={test.title}
                            description={`${test.subject} · ${test.totalMarks} marks · ${test.duration} min`}
                            referenceId={test.id}
                            referenceType="test"
                            size="sm"
                            className="h-7 text-xs"
                          />
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => deleteTest(test.id)}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                            data-testid={`btn-delete-${test.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="ai-generate" className="mt-4">
          <Card className="overflow-hidden">
            <div className="relative">
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: DOT_PATTERN_BG, backgroundSize: '20px 20px' }} />
              <CardContent className="p-4 space-y-4 relative z-10">
                <div className="flex items-center gap-3 mb-1">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(78, 205, 196, 0.1)', border: '1.5px solid rgba(78, 205, 196, 0.2)' }}>
                    <Sparkles size={18} style={{ color: '#4ECDC4', filter: 'drop-shadow(0 0 4px rgba(78, 205, 196, 0.4))' }} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold" style={{ color: '#0B3C5D' }}>AI Test Generator</h4>
                    <p className="text-xs text-gray-500">Auto-generate tests from the question bank based on curriculum filters</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(78, 205, 196, 0.08)', border: '1px solid rgba(78, 205, 196, 0.15)' }}>
                    <Zap size={10} style={{ color: '#4ECDC4' }} />
                    <span className="text-[10px] font-medium" style={{ color: '#4ECDC4' }}>AI Powered</span>
                  </div>
                </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Test Title *</Label>
                <Input 
                  value={autoTitle}
                  onChange={(e) => setAutoTitle(e.target.value)}
                  placeholder="e.g., Math Practice Test"
                  className="h-9 text-sm"
                  data-testid="input-auto-test-title"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subject *</Label>
                <Select value={autoSubject} onValueChange={setAutoSubject}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-auto-test-subject">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map(subject => (
                      <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Textarea 
                value={autoDescription}
                onChange={(e) => setAutoDescription(e.target.value)}
                placeholder="Brief description of the test..."
                className="text-sm min-h-[60px]"
                data-testid="input-auto-test-description"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Duration (min)</Label>
                <Input 
                  type="number"
                  value={autoDuration}
                  onChange={(e) => setAutoDuration(e.target.value)}
                  min="5" max="180"
                  className="h-9 text-sm"
                  data-testid="input-auto-test-duration"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">No. of Questions</Label>
                <Input 
                  type="number"
                  value={autoQuestionCount}
                  onChange={(e) => setAutoQuestionCount(e.target.value)}
                  min="1" max="50"
                  className="h-9 text-sm"
                  data-testid="input-auto-question-count"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Difficulty</Label>
                <Select value={autoDifficulty} onValueChange={(v: any) => setAutoDifficulty(v)}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-auto-difficulty">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="border-t pt-3">
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#0B3C5D' }}>
                <Target size={12} />
                Curriculum Filters
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Board</Label>
                  <Select value={autoBoard || "all"} onValueChange={(v) => { setAutoBoard(v === "all" ? "" : v); setAutoClass(''); }}>
                    <SelectTrigger className="h-9 text-sm" data-testid="select-auto-board">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Board</SelectItem>
                      {boards.map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>{b.boardName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Class</Label>
                  <Select value={autoClass || "all"} onValueChange={(v) => { setAutoClass(v === "all" ? "" : v); }}>
                    <SelectTrigger className="h-9 text-sm" data-testid="select-auto-class">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Class</SelectItem>
                      {classes.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.className}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subject</Label>
                  <Select value={autoSubject} onValueChange={setAutoSubject}>
                    <SelectTrigger className="h-9 text-sm" data-testid="select-auto-subject">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.length > 0 ? subjects.map((s: any) => (
                        <SelectItem key={s.id} value={s.subjectName}>{s.subjectName}</SelectItem>
                      )) : (
                        <>
                          <SelectItem value="Mathematics">Mathematics</SelectItem>
                          <SelectItem value="Science">Science</SelectItem>
                          <SelectItem value="English">English</SelectItem>
                          <SelectItem value="Hindi">Hindi</SelectItem>
                          <SelectItem value="Social Science">Social Science</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {boards.length === 0 && (
                <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  No education data found. Ask your Super Admin to seed boards/classes data.
                </p>
              )}
            </div>
            
            <div className="flex justify-center pt-1">
              <Button 
                onClick={generateQuestions}
                disabled={autoGenerating || !autoSubject}
                className="bg-[#0B3C5D] hover:bg-[#0B3C5D]/90 text-white text-sm h-9"
                data-testid="btn-generate-questions"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                {autoGenerating ? 'Generating...' : 'Generate Questions'}
              </Button>
            </div>
            
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold" style={{ color: '#0B3C5D' }}>Generated Questions ({generatedQuestions.length})</h4>
                {generatedQuestions.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    Total: {generatedQuestions.reduce((sum, q) => sum + q.marks, 0)} marks
                  </Badge>
                )}
              </div>
              
              {generatedQuestions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Sparkles className="h-6 w-6 mx-auto mb-1.5 text-gray-300" />
                  <p className="text-xs">Fill in the filters above and click "Generate Questions"</p>
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {generatedQuestions.map((q, index) => (
                      <div key={q.id} className="flex items-start justify-between p-2.5 bg-gray-50 rounded-lg" data-testid={`auto-question-${index}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{q.questionType.toUpperCase()}</Badge>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{q.marks}m</Badge>
                            {getDifficultyBadge(q.difficulty)}
                          </div>
                          <p className="text-xs truncate">{q.questionText}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removeGeneratedQuestion(index)}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 shrink-0 ml-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={resetAutoGenerateForm} className="text-xs h-8">
                Reset
              </Button>
              <Button 
                size="sm"
                onClick={createAutoGeneratedTest}
                disabled={saving || generatedQuestions.length === 0 || !autoTitle.trim() || !autoSubject}
                className="bg-[#4ECDC4] hover:bg-[#4ECDC4]/90 text-white text-xs h-8"
                data-testid="btn-save-auto-test"
              >
                {saving ? 'Creating...' : 'Create Test from Generated Questions'}
              </Button>
            </div>
              </CardContent>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="assigned" className="mt-4">
          <AssignedTestsList />
        </TabsContent>
        
        <TabsContent value="results" className="mt-4">
          <TestResultsAnalytics userRole={userRole} />
        </TabsContent>
      </Tabs>
      
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Test</DialogTitle>
            <DialogDescription>
              Assign "{selectedTest?.title}" to your children
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Children</Label>
              <div className="space-y-2 border rounded-lg p-3">
                {children.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No children found</p>
                ) : (
                  children.map(child => (
                    <div key={child.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`child-${child.id}`}
                        checked={selectedChildren.includes(child.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedChildren([...selectedChildren, child.id]);
                          } else {
                            setSelectedChildren(selectedChildren.filter(id => id !== child.id));
                          }
                        }}
                        data-testid={`checkbox-child-${child.id}`}
                      />
                      <label htmlFor={`child-${child.id}`} className="text-sm">
                        {child.name} {child.grade && `(${child.grade})`}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <Input 
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                data-testid="input-due-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignOpen(false)}>Cancel</Button>
            <Button 
              onClick={assignTest}
              disabled={saving || selectedChildren.length === 0}
              className="bg-[#4ECDC4] hover:bg-[#4ECDC4]/90 text-white"
              data-testid="btn-confirm-assign"
            >
              {saving ? 'Assigning...' : 'Assign Test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssignedTestsList() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchAssignments();
  }, []);
  
  const fetchAssignments = async () => {
    try {
      const response = await authFetch('/api/parent-tests/assignments');
      if (response.ok) {
        const data = await response.json();
        setAssignments(data);
      }
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
    }
    setLoading(false);
  };
  
  if (loading) return (
    <div className="flex items-center justify-center py-10 gap-3">
      <div className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4ECDC4', borderTopColor: 'transparent' }} />
      <span className="text-sm text-muted-foreground">Loading assignments...</span>
    </div>
  );
  
  if (assignments.length === 0) {
    return (
      <Card className="border border-dashed overflow-hidden" data-testid="assigned-empty-state">
        <CardContent className="py-10 text-center relative">
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: DOT_PATTERN_BG, backgroundSize: '20px 20px' }} />
          <div className="relative z-10">
            <div className="h-16 w-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(78, 205, 196, 0.06)', border: '2px dashed rgba(78, 205, 196, 0.15)' }}>
              <Send className="h-8 w-8" style={{ color: '#4ECDC4', opacity: 0.4 }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: '#0B3C5D' }}>No tests assigned yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">Create a test first, then assign it to your children</p>
            <div className="flex justify-center gap-1.5">
              {['Create', 'Assign', 'Monitor'].map((step, idx) => (
                <div key={step} className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: 'rgba(11, 60, 93, 0.06)', color: '#0B3C5D' }}>
                    <span className="font-bold">{idx + 1}</span>
                    <span>{step}</span>
                  </div>
                  {idx < 2 && <ArrowRight size={10} className="text-gray-300" />}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-2">
      {assignments.map(assignment => {
        const statusMap: Record<string, { color: string; bg: string; border: string; label: string; step: number }> = {
          'pending': { color: '#F39C12', bg: 'rgba(243, 156, 18, 0.08)', border: 'rgba(243, 156, 18, 0.15)', label: 'Pending', step: 0 },
          'in_progress': { color: '#0B3C5D', bg: 'rgba(11, 60, 93, 0.08)', border: 'rgba(11, 60, 93, 0.15)', label: 'In Progress', step: 1 },
          'completed': { color: '#4ECDC4', bg: 'rgba(46, 204, 113, 0.08)', border: 'rgba(46, 204, 113, 0.15)', label: 'Completed', step: 2 },
        };
        const statusConfig = statusMap[assignment.status] || { color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.08)', border: 'rgba(156, 163, 175, 0.15)', label: assignment.status, step: 0 };

        return (
          <Card key={assignment.id} className="overflow-hidden" data-testid={`assignment-${assignment.id}`}>
            <div className="flex items-stretch">
              <div className="w-1 shrink-0" style={{ backgroundColor: statusConfig.color }} />
              <CardContent className="flex items-center justify-between py-3 px-4 flex-1">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: statusConfig.bg, border: `1.5px solid ${statusConfig.border}` }}>
                    <Users size={14} style={{ color: statusConfig.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#0B3C5D' }}>{assignment.testTitle}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">Assigned to: {assignment.childName}</span>
                      <Badge className="text-[10px] px-1.5 py-0" style={{ backgroundColor: statusConfig.bg, color: statusConfig.color, border: `1px solid ${statusConfig.border}` }}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5">
                      {['Assigned', 'In Progress', 'Completed'].map((stage, idx) => (
                        <div key={stage} className="flex items-center gap-1">
                          <div className="h-1.5 w-1.5 rounded-full" style={{
                            backgroundColor: idx <= statusConfig.step ? statusConfig.color : '#e5e7eb',
                            boxShadow: idx === statusConfig.step ? `0 0 4px ${statusConfig.color}60` : 'none'
                          }} />
                          {idx < 2 && <div className="h-px w-4" style={{ backgroundColor: idx < statusConfig.step ? statusConfig.color : '#e5e7eb' }} />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {assignment.status === 'completed' && (
                  <ScoreRingSVG score={assignment.score || 0} size={54} />
                )}
              </CardContent>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function TestResultsAnalytics({ userRole }: { userRole: string }) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchResults();
  }, []);
  
  const fetchResults = async () => {
    try {
      const response = await authFetch('/api/parent-tests/results');
      if (response.ok) {
        const data = await response.json();
        setResults(data);
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    }
    setLoading(false);
  };
  
  if (loading) return (
    <div className="flex items-center justify-center py-10 gap-3">
      <div className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0B3C5D', borderTopColor: 'transparent' }} />
      <span className="text-sm text-muted-foreground">Loading results...</span>
    </div>
  );
  
  if (results.length === 0) {
    return (
      <Card className="border border-dashed overflow-hidden" data-testid="results-empty-state">
        <CardContent className="py-10 text-center relative">
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: DOT_PATTERN_BG, backgroundSize: '20px 20px' }} />
          <div className="relative z-10">
            <div className="h-16 w-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(11, 60, 93, 0.06)', border: '2px dashed rgba(11, 60, 93, 0.15)' }}>
              <BarChart3 className="h-8 w-8" style={{ color: '#0B3C5D', opacity: 0.4 }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: '#0B3C5D' }}>No test results yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">Results will appear here after your child completes an assigned test</p>
            <div className="flex justify-center gap-4">
              {[
                { icon: TrendingUp, label: 'Score Trends' },
                { icon: Target, label: 'Accuracy Analysis' },
                { icon: Brain, label: 'Weak Areas' },
              ].map((feature) => (
                <div key={feature.label} className="text-center">
                  <div className="h-8 w-8 rounded-lg mx-auto mb-1 flex items-center justify-center" style={{ backgroundColor: 'rgba(78, 205, 196, 0.08)' }}>
                    <feature.icon className="h-3.5 w-3.5" style={{ color: '#4ECDC4' }} />
                  </div>
                  <p className="text-[10px] text-gray-400">{feature.label}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const avgScore = Math.round(results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length);
  const passedTests = results.filter(r => (r.score || 0) >= 70).length;
  const bestScore = Math.max(...results.map(r => r.score || 0));
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3" data-testid="results-analytics-bar">
        {[
          { label: 'Completed', value: results.length, max: Math.max(results.length, 10), color: '#0B3C5D' },
          { label: 'Avg Score', value: avgScore, max: 100, color: '#4ECDC4' },
          { label: 'Passed', value: passedTests, max: Math.max(results.length, 5), color: '#4ECDC4' },
          { label: 'Best Score', value: bestScore, max: 100, color: '#E88D67' },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: `${stat.color}15`, backgroundColor: `${stat.color}03` }} data-testid={`result-stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
            <AnimatedStatRing value={stat.value} max={stat.max} color={stat.color} />
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight" style={{ color: stat.color }} data-testid={`result-value-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
                {stat.label.includes('Score') ? `${stat.value}%` : stat.value}
              </p>
              <p className="text-xs text-gray-500 leading-tight">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="space-y-2">
        {results.map(result => {
          const scoreColor = (result.score || 0) >= 80 ? '#4ECDC4' : (result.score || 0) >= 60 ? '#0B3C5D' : (result.score || 0) >= 40 ? '#F39C12' : '#E74C3C';
          const scoreLabel = (result.score || 0) >= 80 ? 'Excellent' : (result.score || 0) >= 60 ? 'Good' : (result.score || 0) >= 40 ? 'Average' : 'Needs Improvement';

          return (
            <Card key={result.id} className="overflow-hidden" data-testid={`result-${result.id}`}>
              <div className="flex items-stretch">
                <div className="w-1 shrink-0" style={{ backgroundColor: scoreColor }} />
                <CardContent className="flex items-center justify-between py-3 px-4 flex-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold truncate" style={{ color: '#0B3C5D' }}>{result.testTitle}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{result.subject}</Badge>
                      <Badge className="text-[10px] px-1.5 py-0" style={{ backgroundColor: `${scoreColor}15`, color: scoreColor, border: `1px solid ${scoreColor}25` }}>
                        {scoreLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      {result.childName} · {new Date(result.completedAt).toLocaleDateString()}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-teal-500" />
                        <span className="text-gray-600">Correct: {result.correctAnswers}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-red-400" />
                        <span className="text-gray-600">Incorrect: {result.incorrectAnswers}</span>
                      </div>
                      <span className="text-gray-400">{result.marksObtained}/{result.totalMarks} marks</span>
                    </div>
                    
                    {result.weakAreas && result.weakAreas.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {result.weakAreas.map((area: string, i: number) => (
                          <Badge key={i} className="text-[9px] px-1.5 py-0" style={{ backgroundColor: 'rgba(231, 76, 60, 0.08)', color: '#E74C3C', border: '1px solid rgba(231, 76, 60, 0.15)' }}>
                            {area}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 ml-3">
                    <ScoreRingSVG score={result.score || 0} size={60} />
                  </div>
                </CardContent>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
