import React from 'react';

import { BRAND } from '@/design-system/tokens';
export { BRAND };

export function formatEntityType(type?: string): string {
  if (!type) return '';
  switch (type.toLowerCase()) {
    case 'ngo': return 'NGO';
    case 'lei': return 'LEI';
    default: return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  }
}

export function getStatusBadge(status: string): React.ReactElement {
  const config: Record<string, { bg: string; text: string }> = {
    pending: { bg: '#FEF3C7', text: '#92400E' },
    approved: { bg: '#D1FAE5', text: '#065F46' },
    rejected: { bg: '#FEE2E2', text: '#991B1B' },
    active: { bg: '#D1FAE5', text: '#065F46' },
    suspended: { bg: '#FEE2E2', text: '#991B1B' },
    warning: { bg: '#FEF3C7', text: '#92400E' },
    completed: { bg: '#D1FAE5', text: '#065F46' },
    processing: { bg: '#DBEAFE', text: '#1E40AF' },
    published: { bg: '#D1FAE5', text: '#065F46' },
    draft: { bg: '#F3F4F6', text: '#374151' },
    granted: { bg: '#D1FAE5', text: '#065F46' },
    revoked: { bg: '#FEE2E2', text: '#991B1B' },
    hr_review: { bg: '#FEF3C7', text: '#92400E' },
    legal_review: { bg: '#FED7AA', text: '#9A3412' },
    leadership_approval: { bg: '#E9D5FF', text: '#7C3AED' },
    closed: { bg: '#FEE2E2', text: '#991B1B' },
    applied: { bg: '#DBEAFE', text: '#1E40AF' },
    shortlisted: { bg: '#CCFBF1', text: '#0D9488' },
    payment_pending: { bg: '#FED7AA', text: '#9A3412' },
    training: { bg: '#E0E7FF', text: '#4338CA' },
    pending_training: { bg: '#FEF3C7', text: '#92400E' },
    assessment: { bg: '#FCE7F3', text: '#BE185D' },
    deactivated: { bg: '#F3F4F6', text: '#374151' },
  };
  const c = config[status] || { bg: '#F3F4F6', text: '#374151' };
  return React.createElement(
    'span',
    {
      className: 'px-2.5 py-1 rounded-full text-xs font-medium capitalize',
      style: { backgroundColor: c.bg, color: c.text },
      'data-testid': `badge-status-${status}`,
    },
    (status || '').replace(/_/g, ' ')
  );
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
