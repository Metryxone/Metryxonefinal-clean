export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationType = 'fyi' | 'fya';

export interface NotificationTemplate {
  id: number;
  category: string;
  title: string;
  bodyTemplate: string;
  type: NotificationType;
  priority: NotificationPriority;
  roles: string[];
  variables: string[];
  actionUrl?: string;
  actionLabel?: string;
}

export const TEMPLATES: Record<number, NotificationTemplate> = {
  1:  { id:1,  category:'security',   type:'fya', priority:'urgent', title:'Login OTP',                   bodyTemplate:'Your one-time login code is [code]. Valid for [expiry] minutes.',                         roles:['all'],                    variables:['code','expiry'] },
  2:  { id:2,  category:'security',   type:'fya', priority:'urgent', title:'Password Reset OTP',          bodyTemplate:'Your password reset code is [code]. Valid for [expiry] minutes.',                        roles:['all'],                    variables:['code','expiry'] },
  3:  { id:3,  category:'security',   type:'fyi', priority:'high',   title:'New Device Login',            bodyTemplate:'Your account was accessed from a new device at [time].',                                 roles:['all'],                    variables:['time'] },
  4:  { id:4,  category:'security',   type:'fya', priority:'urgent', title:'Suspicious Login Detected',   bodyTemplate:'A suspicious login attempt from [location] was detected.',                               roles:['all'],                    variables:['location'] },
  5:  { id:5,  category:'security',   type:'fya', priority:'high',   title:'Multiple Failed Logins',      bodyTemplate:'[count] failed login attempts were detected on your account.',                           roles:['all'],                    variables:['count'] },
  6:  { id:6,  category:'security',   type:'fyi', priority:'high',   title:'Role Changed',                bodyTemplate:'Your role has been changed to [newRole] by [admin].',                                    roles:['all'],                    variables:['newRole','admin'] },
  7:  { id:7,  category:'onboarding', type:'fyi', priority:'normal', title:'Welcome to MetryxOne',        bodyTemplate:'Hello [name]! Your account is now active.',                                              roles:['all'],                    variables:['name'] },
  8:  { id:8,  category:'onboarding', type:'fyi', priority:'low',    title:'Complete Your Profile',       bodyTemplate:'Your profile is [percent]% complete. Add the missing details to unlock all features.',   roles:['all'],                    variables:['percent'],        actionLabel:'Complete Profile' },
  9:  { id:9,  category:'onboarding', type:'fyi', priority:'normal', title:'Mentor Assigned',             bodyTemplate:'[mentorName] has been assigned as your mentor.',                                         roles:['student'],                variables:['mentorName'] },
  10: { id:10, category:'compliance', type:'fyi', priority:'normal', title:'Privacy Policy Updated',      bodyTemplate:'Our privacy policy has been updated effective [date].',                                  roles:['all'],                    variables:['date'] },
  11: { id:11, category:'compliance', type:'fya', priority:'high',   title:'Guardian Consent Required',   bodyTemplate:'Your child [childName] has been registered. Your consent is required.',                  roles:['parent'],                 variables:['childName'],      actionLabel:'Give Consent' },
  12: { id:12, category:'billing',    type:'fya', priority:'high',   title:'Trial Ending Soon',           bodyTemplate:'Your free trial ends on [endDate]. Upgrade now to keep access.',                        roles:['all'],                    variables:['endDate'],        actionLabel:'Upgrade Now' },
  13: { id:13, category:'billing',    type:'fya', priority:'urgent', title:'Subscription Expired',        bodyTemplate:'Your subscription has expired. Renew now to continue using MetryxOne.',                  roles:['all'],                    variables:[],                 actionLabel:'Renew Now' },
  14: { id:14, category:'billing',    type:'fyi', priority:'normal', title:'Payment Successful',          bodyTemplate:'Your payment of [amount] for [plan] has been processed.',                               roles:['all'],                    variables:['amount','plan'] },
  15: { id:15, category:'billing',    type:'fya', priority:'urgent', title:'Payment Failed',              bodyTemplate:'Your payment of [amount] could not be processed. Please update your payment method.',   roles:['all'],                    variables:['amount'],         actionLabel:'Update Payment' },
  16: { id:16, category:'billing',    type:'fyi', priority:'normal', title:'Invoice Generated',           bodyTemplate:'Your invoice #[invoiceNumber] for [amount] has been generated.',                       roles:['all'],                    variables:['invoiceNumber','amount'], actionLabel:'View Invoice' },
  17: { id:17, category:'commerce',   type:'fyi', priority:'normal', title:'Discount Code Issued',        bodyTemplate:'Use code [code] to get [discount] off on [plan].',                                      roles:['all'],                    variables:['code','discount','plan'] },
  18: { id:18, category:'commerce',   type:'fyi', priority:'normal', title:'Discount Expiring Soon',      bodyTemplate:'Your discount code [code] expires on [expiry].',                                        roles:['all'],                    variables:['code','expiry'] },
  19: { id:19, category:'commerce',   type:'fyi', priority:'low',    title:'Discount Applied',            bodyTemplate:'Discount code [code] applied. You saved [savings].',                                    roles:['all'],                    variables:['code','savings'] },
  20: { id:20, category:'commerce',   type:'fyi', priority:'low',    title:'Coupon Invalid',              bodyTemplate:'The coupon code [code] is not valid or has expired.',                                   roles:['all'],                    variables:['code'] },
  21: { id:21, category:'commerce',   type:'fyi', priority:'normal', title:'Limited Time Offer',          bodyTemplate:'[offerTitle] — [discount] off for the next [hours] hours.',                            roles:['all'],                    variables:['offerTitle','discount','hours'] },
  22: { id:22, category:'exam',       type:'fya', priority:'high',   title:'Test Assigned',               bodyTemplate:'[testName] has been assigned to you by [assignedBy].',                                 roles:['student'],                variables:['testName','assignedBy'], actionLabel:'Start Test' },
  23: { id:23, category:'exam',       type:'fyi', priority:'normal', title:'Test Rescheduled',            bodyTemplate:'[testName] rescheduled from [oldDate] to [newDate].',                                  roles:['student','teacher'],      variables:['testName','oldDate','newDate'] },
  24: { id:24, category:'exam',       type:'fyi', priority:'normal', title:'Test Cancelled',              bodyTemplate:'[testName] scheduled for [date] has been cancelled.',                                  roles:['student','teacher'],      variables:['testName','date'] },
  25: { id:25, category:'exam',       type:'fya', priority:'high',   title:'Test Window Open',            bodyTemplate:'[testName] is now available until [deadline].',                                        roles:['student'],                variables:['testName','deadline'], actionLabel:'Take Test' },
  26: { id:26, category:'exam',       type:'fyi', priority:'normal', title:'Test Reminder',               bodyTemplate:'Reminder: [testName] starts in [timeLeft].',                                           roles:['student'],                variables:['testName','timeLeft'] },
  27: { id:27, category:'exam',       type:'fyi', priority:'normal', title:'Test Started',                bodyTemplate:'[studentName] has started [testName].',                                                roles:['teacher','admin'],        variables:['studentName','testName'] },
  28: { id:28, category:'exam',       type:'fyi', priority:'normal', title:'Test Submitted',              bodyTemplate:'[testName] has been submitted. Results coming shortly.',                               roles:['student'],                variables:['testName'] },
  29: { id:29, category:'exam',       type:'fyi', priority:'normal', title:'Test Auto-Submitted',         bodyTemplate:'[testName] was auto-submitted as time expired.',                                       roles:['student'],                variables:['testName'] },
  30: { id:30, category:'exam',       type:'fyi', priority:'high',   title:'Test Not Attempted',          bodyTemplate:'[studentName] did not attempt [testName] before the deadline.',                        roles:['teacher','admin'],        variables:['studentName','testName'] },
  31: { id:31, category:'exam',       type:'fya', priority:'normal', title:'Retest Available',            bodyTemplate:'You can now retake [testName].',                                                       roles:['student'],                variables:['testName'],       actionLabel:'Retake Test' },
  32: { id:32, category:'reports',    type:'fyi', priority:'normal', title:'Report Published',            bodyTemplate:'Your [reportType] report for [testName] is now available.',                            roles:['student','parent'],       variables:['reportType','testName'], actionLabel:'View Report' },
  33: { id:33, category:'reports',    type:'fyi', priority:'normal', title:'AI Insight Generated',        bodyTemplate:'New AI-powered insights are available for [studentName].',                             roles:['student','parent','teacher'], variables:['studentName'], actionLabel:'View Insights' },
  34: { id:34, category:'reports',    type:'fyi', priority:'normal', title:'Benchmark Report Available',  bodyTemplate:'A comparative benchmark report for [testName] is available.',                          roles:['student','teacher'],      variables:['testName'],       actionLabel:'View Benchmark' },
  35: { id:35, category:'reports',    type:'fyi', priority:'low',    title:'Report Viewed',               bodyTemplate:'[viewerName] viewed the report for [studentName].',                                    roles:['admin','teacher'],        variables:['viewerName','studentName'] },
  36: { id:36, category:'reports',    type:'fyi', priority:'normal', title:'Refresher Module Unlocked',   bodyTemplate:'Based on your results, a refresher module for [subject] has been unlocked.',           roles:['student'],                variables:['subject'],        actionLabel:'Start Module' },
  37: { id:37, category:'reports',    type:'fyi', priority:'normal', title:'Weak Area Identified',        bodyTemplate:'AI has identified [subject] as an area needing improvement.',                          roles:['student','parent','teacher'], variables:['subject'] },
  38: { id:38, category:'reports',    type:'fyi', priority:'normal', title:'Competency Mastered',         bodyTemplate:'Congratulations! [studentName] has mastered [competency].',                            roles:['student','parent','teacher'], variables:['studentName','competency'] },
  39: { id:39, category:'ai_tools',   type:'fya', priority:'normal', title:'AI Test Ready for Review',    bodyTemplate:'An AI-generated test [testName] for [subject] is ready for review.',                   roles:['teacher','admin'],        variables:['testName','subject'], actionLabel:'Review Test' },
  40: { id:40, category:'ai_tools',   type:'fyi', priority:'normal', title:'Adaptive Test Ready',         bodyTemplate:'An AI-adaptive test in [subject] is ready.',                                           roles:['student'],                variables:['subject'],        actionLabel:'Take Test' },
  41: { id:41, category:'ai_tools',   type:'fyi', priority:'low',    title:'Question Bank Updated',       bodyTemplate:'[count] new AI-generated questions have been added.',                                  roles:['teacher','admin'],        variables:['count'] },
  42: { id:42, category:'ai_tools',   type:'fyi', priority:'normal', title:'AI Study Recommendations',    bodyTemplate:'AI has generated personalized study recommendations.',                                 roles:['student'],                variables:[],                 actionLabel:'View Recommendations' },
  43: { id:43, category:'ai_tools',   type:'fyi', priority:'high',   title:'AI Usage Limit Reached',      bodyTemplate:'Your AI feature usage has reached the plan limit.',                                    roles:['all'],                    variables:[],                 actionLabel:'Upgrade Plan' },
  44: { id:44, category:'ai_tools',   type:'fyi', priority:'normal', title:'AI Generator Error',          bodyTemplate:'The AI test generator encountered an error. Please try again.',                        roles:['teacher','admin'],        variables:[] },
  45: { id:45, category:'booking',    type:'fyi', priority:'normal', title:'Session Booked',              bodyTemplate:'Session with [mentorName] booked for [date] at [time].',                              roles:['student'],                variables:['mentorName','date','time'], actionLabel:'View Booking' },
  46: { id:46, category:'booking',    type:'fyi', priority:'normal', title:'Booking Confirmed',           bodyTemplate:'Your session on [date] at [time] is confirmed.',                                      roles:['student'],                variables:['date','time'] },
  47: { id:47, category:'booking',    type:'fyi', priority:'normal', title:'Session Reminder',            bodyTemplate:'Reminder: Your session starts in [timeLeft].',                                        roles:['student','mentor'],       variables:['timeLeft'] },
  48: { id:48, category:'booking',    type:'fyi', priority:'normal', title:'Session Rescheduled',         bodyTemplate:'Session rescheduled from [oldDate] to [newDate].',                                    roles:['student','mentor'],       variables:['oldDate','newDate'] },
  49: { id:49, category:'booking',    type:'fyi', priority:'high',   title:'Session Cancelled',           bodyTemplate:'Your session on [date] has been cancelled.',                                          roles:['student','mentor'],       variables:['date'] },
  50: { id:50, category:'booking',    type:'fyi', priority:'normal', title:'No-Show Alert',               bodyTemplate:'[studentName] did not attend the session.',                                           roles:['mentor','admin'],         variables:['studentName'] },
  51: { id:51, category:'booking',    type:'fya', priority:'normal', title:'Session Completed',           bodyTemplate:'Your session has been marked as completed. Share your feedback.',                     roles:['student'],                variables:[],                 actionLabel:'Leave Feedback' },
  52: { id:52, category:'feedback',   type:'fya', priority:'normal', title:'Feedback Requested',          bodyTemplate:'How was your session with [mentorName]?',                                             roles:['student'],                variables:['mentorName'],     actionLabel:'Rate Session' },
  53: { id:53, category:'feedback',   type:'fyi', priority:'low',    title:'Rating Received',             bodyTemplate:'[studentName] rated their session [rating]/5.',                                       roles:['mentor','admin'],         variables:['studentName','rating'] },
  54: { id:54, category:'classes',    type:'fyi', priority:'normal', title:'Class Scheduled',             bodyTemplate:'[className] has been scheduled for [date] at [time].',                               roles:['student','teacher'],      variables:['className','date','time'], actionLabel:'View Class' },
  55: { id:55, category:'classes',    type:'fyi', priority:'normal', title:'Class Reminder',              bodyTemplate:'Reminder: [className] starts in [timeLeft].',                                        roles:['student','teacher'],      variables:['className','timeLeft'] },
  56: { id:56, category:'classes',    type:'fyi', priority:'normal', title:'Class Link Shared',           bodyTemplate:'The virtual class link for [className] is now available.',                            roles:['student','teacher'],      variables:['className'],      actionLabel:'Join Class' },
  57: { id:57, category:'classes',    type:'fyi', priority:'high',   title:'Class Cancelled',             bodyTemplate:'[className] scheduled for [date] has been cancelled.',                               roles:['student','teacher'],      variables:['className','date'] },
  58: { id:58, category:'classes',    type:'fyi', priority:'normal', title:'Substitute Mentor Assigned',  bodyTemplate:'[newMentorName] will be substituting for [originalMentor].',                         roles:['student'],                variables:['newMentorName','originalMentor'] },
  59: { id:59, category:'classes',    type:'fyi', priority:'low',    title:'Attendance Marked',           bodyTemplate:'[studentName] attendance for [className]: [status].',                                roles:['student','teacher'],      variables:['studentName','className','status'] },
};

import { getTemplateById } from './templateRepository.js';

export async function resolveTemplate(
  templateId: number,
  variables: Record<string, string>
): Promise<{ title: string; message: string } | null> {
  const t = await getTemplateById(templateId);
  if (!t) return null;
  let body = t.bodyTemplate;
  for (const [key, val] of Object.entries(variables)) {
    body = body.replace(new RegExp(`\\[${key}\\]`, 'g'), val);
  }
  return { title: t.title, message: body };
}
