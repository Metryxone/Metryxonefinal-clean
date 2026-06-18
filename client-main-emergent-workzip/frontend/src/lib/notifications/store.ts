import { NotificationPriority, NotificationType, NotificationCategory } from './templates';

export interface LocalNotification {
  id: string;
  templateId: number;
  category: NotificationCategory;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  isRead: boolean;
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  isEmailSent: boolean;
  metadata: string | null;
  expiresAt: string | null;
  actionUrl: string | null;
  actionLabel: string | null;
  recipientId: string;
  senderId: string | null;
  createdAt: string;
}

const STORAGE_KEY = 'metryx_notifications';
const MAX_STORED = 200;
const CHANGE_EVENT = 'metryx:notifications:changed';

function generateId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function load(): LocalNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items: LocalNotification[]): void {
  try {
    const trimmed = items.slice(0, MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {}
}

export const notificationStore = {
  getAll(): LocalNotification[] {
    return load();
  },

  getUnreadCount(): number {
    return load().filter(n => !n.isRead).length;
  },

  add(item: Omit<LocalNotification, 'id' | 'createdAt'>): LocalNotification {
    const existing = load();
    const newItem: LocalNotification = {
      ...item,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    save([newItem, ...existing]);
    return newItem;
  },

  markRead(id: string): void {
    const items = load().map(n => n.id === id ? { ...n, isRead: true } : n);
    save(items);
  },

  markAllRead(): void {
    const items = load().map(n => ({ ...n, isRead: true }));
    save(items);
  },

  acknowledge(id: string): void {
    const items = load().map(n =>
      n.id === id ? { ...n, isAcknowledged: true, acknowledgedAt: new Date().toISOString() } : n
    );
    save(items);
  },

  delete(id: string): void {
    const items = load().filter(n => n.id !== id);
    save(items);
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  },

  onChanged(callback: () => void): () => void {
    window.addEventListener(CHANGE_EVENT, callback);
    return () => window.removeEventListener(CHANGE_EVENT, callback);
  },
};
