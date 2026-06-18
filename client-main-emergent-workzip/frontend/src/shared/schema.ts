export interface User {
  id: string;
  fullName: string;
  email?: string;
  mobile?: string;
  role: string;
  roles: string[];
  isVerified: boolean;
  profilePicture?: string;
}

export interface Child {
  id: string;
  parentId: string;
  name: string;
  age?: number;
  grade?: string;
  school?: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  language?: string;
  board?: string;
  educationBoard?: string;
  city?: string;
  state?: string;
  specialNeeds?: string;
  studyHoursPerDay?: number;
  favoriteSubjects?: string[];
  weakSubjects?: string[];
  learningStyle?: string;
  careerInterest?: string;
  relationship?: string;
  schoolType?: string;
  medium?: string;
  extracurricular?: string;
  emergencyContact?: string;
  medicalConditions?: string;
  studentUserId?: string;
  consentGiven: boolean;
  lbiConsent?: boolean;
  consentGivenAt?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InsertChild {
  parentId: string;
  name: string;
  age?: number;
  grade?: string;
  school?: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  language?: string;
  board?: string;
  city?: string;
  state?: string;
  specialNeeds?: string;
  studyHoursPerDay?: number;
  favoriteSubjects?: string[];
  weakSubjects?: string[];
  learningStyle?: string;
  careerInterest?: string;
  relationship?: string;
  schoolType?: string;
  medium?: string;
  extracurricular?: string;
  emergencyContact?: string;
  medicalConditions?: string;
  avatarUrl?: string;
  lbiConsent?: boolean;
  consentGiven?: boolean;
}

export interface LbiCategory {
  id: string;
  userId: string;
  name: string;
  score?: number;
  createdAt: string;
}

export interface InsertLbiCategory {
  userId: string;
  name: string;
  score?: number;
}

export interface BehaviouralInsight {
  id: string;
  childId: string;
  category: string;
  insight: string;
  recommendation: string;
  createdAt: string;
}

export interface ChildExam {
  id: string;
  childId: string;
  title: string;
  subject?: string;
  status: 'pending' | 'in_progress' | 'completed';
  score?: number;
  totalMarks?: number;
  scheduledAt?: string;
  completedAt?: string;
  createdAt: string;
}
