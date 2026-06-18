# MetryxOne — Notification Templates (All 59)

All templates are defined in `src/lib/notifications/templates.ts`.

## Legend

| Column | Meaning |
|---|---|
| ID | Template ID passed to `notificationService.fire(id, variables)` |
| Type | `fyi` = informational, `fya` = action required (user must respond) |
| Priority | `low` / `normal` / `high` / `urgent` |
| Variables | Tokens in `[brackets]` that must be passed when firing |

---

## Security  (IDs 1–6)

| ID | Title | Type | Priority | Body Template | Variables |
|---|---|---|---|---|---|
| 1 | Login OTP | fya | urgent | Your one-time login code is `[code]`. Valid for `[expiry]` minutes. | code, expiry |
| 2 | Password Reset OTP | fya | urgent | Your password reset code is `[code]`. Valid for `[expiry]` minutes. | code, expiry |
| 3 | New Device Login | fyi | high | Your account was accessed from a new device at `[time]`. | time |
| 4 | Suspicious Login Detected | fya | urgent | A suspicious login attempt from `[location]` was detected. | location |
| 5 | Multiple Failed Logins | fya | high | `[count]` failed login attempts were detected on your account. | count |
| 6 | Role Changed | fyi | high | Your role has been changed to `[newRole]` by `[admin]`. | newRole, admin |

---

## Onboarding  (IDs 7–9)

| ID | Title | Type | Priority | Body Template | Variables |
|---|---|---|---|---|---|
| 7 | Welcome to MetryxOne | fyi | normal | Hello `[name]`! Your account is now active. | name |
| 8 | Complete Your Profile | fyi | low | Your profile is `[percent]`% complete. Add the missing details to unlock all features. | percent |
| 9 | Mentor Assigned | fyi | normal | `[mentorName]` has been assigned as your mentor. | mentorName |

---

## Compliance  (IDs 10–11)

| ID | Title | Type | Priority | Body Template | Variables |
|---|---|---|---|---|---|
| 10 | Privacy Policy Updated | fyi | normal | Our privacy policy has been updated effective `[date]`. | date |
| 11 | Guardian Consent Required | fya | high | Your child `[childName]` has been registered. Your consent is required. | childName |

---

## Billing  (IDs 12–16)

| ID | Title | Type | Priority | Body Template | Variables |
|---|---|---|---|---|---|
| 12 | Trial Ending Soon | fya | high | Your free trial ends on `[endDate]`. Upgrade now to keep access. | endDate |
| 13 | Subscription Expired | fya | urgent | Your subscription has expired. Renew now to continue using MetryxOne. | — |
| 14 | Payment Successful | fyi | normal | Your payment of `[amount]` for `[plan]` has been processed. | amount, plan |
| 15 | Payment Failed | fya | urgent | Your payment of `[amount]` could not be processed. Please update your payment method. | amount |
| 16 | Invoice Generated | fyi | normal | Your invoice #`[invoiceNumber]` for `[amount]` has been generated. | invoiceNumber, amount |

---

## Commerce  (IDs 17–21)

| ID | Title | Type | Priority | Body Template | Variables |
|---|---|---|---|---|---|
| 17 | Discount Code Issued | fyi | normal | Use code `[code]` to get `[discount]` off on `[plan]`. | code, discount, plan |
| 18 | Discount Expiring Soon | fyi | normal | Your discount code `[code]` expires on `[expiry]`. | code, expiry |
| 19 | Discount Applied | fyi | low | Discount code `[code]` applied. You saved `[savings]`. | code, savings |
| 20 | Coupon Invalid | fyi | low | The coupon code `[code]` is not valid or has expired. | code |
| 21 | Limited Time Offer | fyi | normal | `[offerTitle]` — `[discount]` off for the next `[hours]` hours. | offerTitle, discount, hours |

---

## Exam / Test Management  (IDs 22–31)

| ID | Title | Type | Priority | Body Template | Variables |
|---|---|---|---|---|---|
| 22 | Test Assigned | fya | high | `[testName]` has been assigned to you by `[assignedBy]`. | testName, assignedBy |
| 23 | Test Rescheduled | fyi | normal | `[testName]` rescheduled from `[oldDate]` to `[newDate]`. | testName, oldDate, newDate |
| 24 | Test Cancelled | fyi | normal | `[testName]` scheduled for `[date]` has been cancelled. | testName, date |
| 25 | Test Window Open | fya | high | `[testName]` is now available until `[deadline]`. | testName, deadline |
| 26 | Test Reminder | fyi | normal | Reminder: `[testName]` starts in `[timeLeft]`. | testName, timeLeft |
| 27 | Test Started | fyi | normal | `[studentName]` has started `[testName]`. | studentName, testName |
| 28 | Test Submitted | fyi | normal | `[testName]` has been submitted. Results coming shortly. | testName |
| 29 | Test Auto-Submitted | fyi | normal | `[testName]` was auto-submitted as time expired. | testName |
| 30 | Test Not Attempted | fyi | high | `[studentName]` did not attempt `[testName]` before the deadline. | studentName, testName |
| 31 | Retest Available | fya | normal | You can now retake `[testName]`. | testName |

---

## Reports  (IDs 32–38)

| ID | Title | Type | Priority | Body Template | Variables |
|---|---|---|---|---|---|
| 32 | Report Published | fyi | normal | Your `[reportType]` report for `[testName]` is now available. | reportType, testName |
| 33 | AI Insight Generated | fyi | normal | New AI-powered insights are available for `[studentName]`. | studentName |
| 34 | Benchmark Report Available | fyi | normal | A comparative benchmark report for `[testName]` is available. | testName |
| 35 | Report Viewed (audit) | fyi | low | `[viewerName]` viewed the report for `[studentName]`. | viewerName, studentName |
| 36 | Refresher Module Unlocked | fyi | normal | Based on your results, a refresher module for `[subject]` has been unlocked. | subject |
| 37 | Weak Area Identified | fyi | normal | AI has identified `[subject]` as an area needing improvement. | subject |
| 38 | Competency Mastered | fyi | normal | Congratulations! `[studentName]` has mastered `[competency]`. | studentName, competency |

---

## AI Tools  (IDs 39–44)

| ID | Title | Type | Priority | Body Template | Variables |
|---|---|---|---|---|---|
| 39 | AI Test Ready for Review | fya | normal | An AI-generated test `[testName]` for `[subject]` is ready for review. | testName, subject |
| 40 | Adaptive Test Ready | fyi | normal | An AI-adaptive test in `[subject]` is ready. | subject |
| 41 | Question Bank Updated | fyi | low | `[count]` new AI-generated questions have been added. | count |
| 42 | AI Study Recommendations | fyi | normal | AI has generated personalized study recommendations. | — |
| 43 | AI Usage Limit Reached | fyi | high | Your AI feature usage has reached the plan limit. | — |
| 44 | AI Generator Error | fyi | normal | The AI test generator encountered an error. Please try again. | — |

---

## Booking / Mentorship  (IDs 45–51)

| ID | Title | Type | Priority | Body Template | Variables |
|---|---|---|---|---|---|
| 45 | Session Booked | fyi | normal | Session with `[mentorName]` booked for `[date]` at `[time]`. | mentorName, date, time |
| 46 | Booking Confirmed | fyi | normal | Your session on `[date]` at `[time]` is confirmed. | date, time |
| 47 | Session Reminder | fyi | normal | Reminder: Your session starts in `[timeLeft]`. | timeLeft |
| 48 | Session Rescheduled | fyi | normal | Session rescheduled from `[oldDate]` to `[newDate]`. | oldDate, newDate |
| 49 | Session Cancelled | fyi | high | Your session on `[date]` has been cancelled. | date |
| 50 | No-Show Alert | fyi | normal | `[studentName]` did not attend the session. | studentName |
| 51 | Session Completed | fya | normal | Your session has been marked as completed. Share your feedback. | — |

---

## Feedback  (IDs 52–53)

| ID | Title | Type | Priority | Body Template | Variables |
|---|---|---|---|---|---|
| 52 | Feedback Requested | fya | normal | How was your session with `[mentorName]`? | mentorName |
| 53 | Rating Received | fyi | low | `[studentName]` rated their session `[rating]`/5. | studentName, rating |

---

## Classes  (IDs 54–59)

| ID | Title | Type | Priority | Body Template | Variables |
|---|---|---|---|---|---|
| 54 | Class Scheduled | fyi | normal | `[className]` has been scheduled for `[date]` at `[time]`. | className, date, time |
| 55 | Class Reminder | fyi | normal | Reminder: `[className]` starts in `[timeLeft]`. | className, timeLeft |
| 56 | Class Link Shared | fyi | normal | The virtual class link for `[className]` is now available. | className |
| 57 | Class Cancelled | fyi | high | `[className]` scheduled for `[date]` has been cancelled. | className, date |
| 58 | Substitute Mentor Assigned | fyi | normal | `[newMentorName]` will be substituting for `[originalMentor]`. | newMentorName, originalMentor |
| 59 | Attendance Marked | fyi | low | `[studentName]` attendance for `[className]`: `[status]`. | studentName, className, status |

---

## How to Fire a Notification

```typescript
import { notificationService } from '@/lib/notifications/service';

// Generic
notificationService.fire(22, {
  testName: 'Math Assessment',
  assignedBy: 'Admin',
});

// Shorthand helpers
notificationService.fireWelcome('Alex');
notificationService.fireTestSubmitted('Math Assessment');
notificationService.fireReportPublished('LBI', 'Math Assessment');
notificationService.fireSessionBooked('Dr. Priya', 'March 15', '10:00 AM');
notificationService.firePaymentSuccess('₹4,999', 'Pro Annual');
notificationService.fireTrialEnding('March 31, 2026');
notificationService.fireAIInsight('Alex');
```

---

## Category Summary

| Category | IDs | Count |
|---|---|---|
| Security | 1–6 | 6 |
| Onboarding | 7–9 | 3 |
| Compliance | 10–11 | 2 |
| Billing | 12–16 | 5 |
| Commerce | 17–21 | 5 |
| Exam / Test | 22–31 | 10 |
| Reports | 32–38 | 7 |
| AI Tools | 39–44 | 6 |
| Booking / Mentorship | 45–51 | 7 |
| Feedback | 52–53 | 2 |
| Classes | 54–59 | 6 |
| **Total** | | **59** |
