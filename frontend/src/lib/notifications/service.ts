import { NOTIFICATION_TEMPLATES, resolveTemplate } from './templates';
import { notificationStore, LocalNotification } from './store';

interface FireOptions {
  recipientId?: string;
  senderId?: string;
  actionUrl?: string;
  actionLabel?: string;
  expiresAt?: string;
  metadata?: Record<string, string>;
}

export const notificationService = {
  fire(templateId: number, variables: Record<string, string> = {}, options: FireOptions = {}): LocalNotification | null {
    const template = NOTIFICATION_TEMPLATES[templateId];
    if (!template) {
      console.warn(`[NotificationService] Unknown template ID: ${templateId}`);
      return null;
    }

    const resolved = resolveTemplate(templateId, variables);
    if (!resolved) return null;

    return notificationStore.add({
      templateId,
      category: template.category,
      title: resolved.title,
      message: resolved.message,
      type: template.type,
      priority: template.priority,
      isRead: false,
      isAcknowledged: false,
      acknowledgedAt: null,
      isEmailSent: false,
      metadata: options.metadata ? JSON.stringify(options.metadata) : null,
      expiresAt: options.expiresAt ?? null,
      actionUrl: options.actionUrl ?? template.actionUrl ?? null,
      actionLabel: options.actionLabel ?? template.actionLabel ?? null,
      recipientId: options.recipientId ?? 'local',
      senderId: options.senderId ?? null,
    });
  },

  getAll() {
    return notificationStore.getAll();
  },

  getUnreadCount() {
    return notificationStore.getUnreadCount();
  },

  markRead(id: string) {
    notificationStore.markRead(id);
  },

  markAllRead() {
    notificationStore.markAllRead();
  },

  acknowledge(id: string) {
    notificationStore.acknowledge(id);
  },

  delete(id: string) {
    notificationStore.delete(id);
  },

  onChanged(callback: () => void) {
    return notificationStore.onChanged(callback);
  },

  fireWelcome(name: string) {
    return this.fire(7, { name });
  },

  fireNewDeviceLogin() {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return this.fire(3, { time });
  },

  fireTestAssigned(testName: string, assignedBy: string) {
    return this.fire(22, { testName, assignedBy });
  },

  fireTestSubmitted(testName: string) {
    return this.fire(28, { testName });
  },

  fireReportPublished(reportType: string, testName: string) {
    return this.fire(32, { reportType, testName });
  },

  fireAIInsight(studentName: string) {
    return this.fire(33, { studentName });
  },

  fireSessionBooked(mentorName: string, date: string, time: string) {
    return this.fire(45, { mentorName, date, time });
  },

  fireSessionCompleted() {
    return this.fire(51, {});
  },

  firePaymentSuccess(amount: string, plan: string) {
    return this.fire(14, { amount, plan });
  },

  fireTrialEnding(endDate: string) {
    return this.fire(12, { endDate });
  },
};
