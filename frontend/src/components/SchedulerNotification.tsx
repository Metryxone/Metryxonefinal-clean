import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Clock, Bell, BellRing, Plus, X, Check, ChevronRight, AlertCircle, Trash2, CheckCircle, Timer, BookOpen, FileText, Brain, Target, Repeat } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";



interface ScheduledEvent {
  id: string;
  userId: string;
  childId: string | null;
  eventType: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  endAt: string | null;
  durationMinutes: number | null;
  referenceId: string | null;
  referenceType: string | null;
  reminderOffsets: string[] | null;
  remindersTriggered: string[] | null;
  status: string;
  recurrence: string | null;
  priority: string;
  color: string | null;
  metadata: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childId?: string;
  childName?: string;
  eventType: 'assessment' | 'test' | 'study_session' | 'lbi_review' | 'revision';
  prefillTitle?: string;
  prefillDescription?: string;
  referenceId?: string;
  referenceType?: string;
  onScheduled?: (event: ScheduledEvent) => void;
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  assessment: { label: 'Assessment', icon: Target, color: '#0B3C5D' },
  test: { label: 'Test', icon: FileText, color: BRAND.primary },
  study_session: { label: 'Study Session', icon: BookOpen, color: '#4ECDC4' },
  lbi_review: { label: 'LBI Review', icon: Brain, color: BRAND.accent },
  revision: { label: 'Revision', icon: Timer, color: '#F59E0B' },
};

const REMINDER_OPTIONS = [
  { value: '15m', label: '15 minutes before' },
  { value: '1h', label: '1 hour before' },
  { value: '24h', label: '1 day before' },
  { value: '3d', label: '3 days before' },
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatRelative(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 30) return `In ${Math.ceil(diffDays / 7)} weeks`;
  return formatDate(dateStr);
}

export function ScheduleDialog({ open, onOpenChange, childId, childName, eventType, prefillTitle, prefillDescription, referenceId, referenceType, onScheduled }: ScheduleDialogProps) {
  const [title, setTitle] = useState(prefillTitle || '');
  const [description, setDescription] = useState(prefillDescription || '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [duration, setDuration] = useState<number>(60);
  const [selectedReminders, setSelectedReminders] = useState<string[]>(['1h', '24h']);
  const [priority, setPriority] = useState('normal');
  const [recurrence, setRecurrence] = useState('none');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setTitle(prefillTitle || '');
      setDescription(prefillDescription || '');
      setSelectedDate(undefined);
      setSelectedTime('09:00');
      setDuration(60);
      setSelectedReminders(['1h', '24h']);
      setPriority('normal');
      setRecurrence('none');
    }
  }, [open, prefillTitle, prefillDescription]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/scheduled-events', data);
      return res.json();
    },
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({ title: 'Scheduled', description: `${title} has been scheduled successfully` });
      onScheduled?.(event);
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to schedule event', variant: 'destructive' });
    },
  });

  const handleSchedule = () => {
    if (!selectedDate || !title.trim()) {
      toast({ title: 'Missing info', description: 'Please provide a title and date', variant: 'destructive' });
      return;
    }
    const scheduledAt = new Date(selectedDate);
    const [hours, minutes] = selectedTime.split(':').map(Number);
    scheduledAt.setHours(hours, minutes, 0, 0);

    const endAt = new Date(scheduledAt.getTime() + duration * 60000);

    createMutation.mutate({
      childId,
      eventType,
      title: title.trim(),
      description: description.trim() || undefined,
      scheduledAt: scheduledAt.toISOString(),
      endAt: endAt.toISOString(),
      durationMinutes: duration,
      referenceId,
      referenceType,
      reminderOffsets: selectedReminders,
      recurrence: recurrence === 'none' ? null : recurrence,
      priority,
    });
  };

  const config = EVENT_TYPE_CONFIG[eventType] || EVENT_TYPE_CONFIG.assessment;
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.color}15` }}>
              <Icon size={16} style={{ color: config.color }} />
            </div>
            Schedule {config.label}
          </DialogTitle>
          <DialogDescription>
            {childName ? `For ${childName} · ` : ''}Set date, time and reminders
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title</Label>
            <Input
              data-testid="schedule-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`e.g., ${config.label} session`}
              className="h-9"
            />
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description (optional)</Label>
            <Textarea
              data-testid="schedule-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes or details..."
              className="h-16 resize-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    data-testid="schedule-date-picker"
                    variant="outline"
                    className="w-full h-9 justify-start text-left font-normal text-sm"
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {selectedDate ? selectedDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Time</Label>
              <Input
                data-testid="schedule-time-input"
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Duration</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger data-testid="schedule-duration-select" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="schedule-priority-select" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              <Bell size={12} className="inline mr-1" />
              Reminders
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {REMINDER_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors text-sm"
                  style={selectedReminders.includes(opt.value) ? { borderColor: BRAND.accent, backgroundColor: `${BRAND.accent}08` } : {}}
                >
                  <Checkbox
                    data-testid={`reminder-${opt.value}`}
                    checked={selectedReminders.includes(opt.value)}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedReminders([...selectedReminders, opt.value]);
                      else setSelectedReminders(selectedReminders.filter(r => r !== opt.value));
                    }}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              <Repeat size={12} className="inline mr-1" />
              Repeat
            </Label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger data-testid="schedule-recurrence-select" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No repeat</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="schedule-cancel-btn" className="h-9">
            Cancel
          </Button>
          <Button
            data-testid="schedule-confirm-btn"
            onClick={handleSchedule}
            disabled={!selectedDate || !title.trim() || createMutation.isPending}
            className="h-9"
            style={{ backgroundColor: BRAND.primary }}
          >
            {createMutation.isPending ? 'Scheduling...' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UpcomingScheduleProps {
  childId?: string;
  eventTypes?: string[];
  maxItems?: number;
  compact?: boolean;
  onScheduleNew?: () => void;
  showHeader?: boolean;
}

export function UpcomingSchedule({ childId, eventTypes, maxItems = 5, compact = false, onScheduleNew, showHeader = true }: UpcomingScheduleProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = new URLSearchParams();
  if (childId) params.set('childId', childId);
  params.set('status', 'scheduled');
  const fromDate = new Date();
  params.set('fromDate', fromDate.toISOString());

  const { data: events = [], isLoading } = useQuery<ScheduledEvent[]>({
    queryKey: ['/api/scheduled-events', childId, 'scheduled'],
    queryFn: async () => {
      const res = await fetch(`/api/scheduled-events?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/scheduled-events/${id}/complete`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-events'] });
      toast({ title: 'Completed', description: 'Event marked as completed' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/scheduled-events/${id}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-events'] });
      toast({ title: 'Cancelled', description: 'Event has been cancelled' });
    },
  });

  const filteredEvents = eventTypes
    ? events.filter(e => eventTypes.includes(e.eventType))
    : events;
  const displayEvents = filteredEvents.slice(0, maxItems);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: BRAND.primary }}></div>
      </div>
    );
  }

  if (displayEvents.length === 0 && !showHeader) return null;

  return (
    <div>
      {showHeader && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon size={14} style={{ color: BRAND.primary }} />
            <span className="text-sm font-semibold" style={{ color: BRAND.primary }}>Upcoming Schedule</span>
            {displayEvents.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{displayEvents.length}</Badge>
            )}
          </div>
          {onScheduleNew && (
            <Button
              data-testid="schedule-new-btn"
              variant="outline"
              size="sm"
              onClick={onScheduleNew}
              className="h-7 text-xs gap-1"
            >
              <Plus size={12} />
              Schedule
            </Button>
          )}
        </div>
      )}

      {displayEvents.length === 0 ? (
        <div className="text-center py-6 border rounded-lg bg-muted/30">
          <CalendarIcon size={24} className="mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">No upcoming events scheduled</p>
          {onScheduleNew && (
            <Button
              data-testid="schedule-empty-btn"
              variant="link"
              size="sm"
              onClick={onScheduleNew}
              className="mt-1 text-xs h-6"
              style={{ color: BRAND.primary }}
            >
              Schedule your first event
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {displayEvents.map((event) => {
            const config = EVENT_TYPE_CONFIG[event.eventType] || EVENT_TYPE_CONFIG.assessment;
            const Icon = config.icon;
            const isPast = new Date(event.scheduledAt) < new Date();
            const isToday = formatRelative(event.scheduledAt) === 'Today';
            const isTomorrow = formatRelative(event.scheduledAt) === 'Tomorrow';

            return (
              <div
                key={event.id}
                data-testid={`schedule-event-${event.id}`}
                className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/30 transition-colors group"
                style={{ borderLeftWidth: 3, borderLeftColor: config.color }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${config.color}12` }}>
                  <Icon size={14} style={{ color: config.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    {event.priority === 'high' && (
                      <AlertCircle size={12} className="text-red-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock size={10} />
                      {formatTime(event.scheduledAt)}
                    </span>
                    {event.durationMinutes && (
                      <span className="text-[11px] text-muted-foreground">· {event.durationMinutes}min</span>
                    )}
                    {event.reminderOffsets && event.reminderOffsets.length > 0 && (
                      <span className="text-[11px] flex items-center gap-0.5" style={{ color: BRAND.accent }}>
                        <BellRing size={10} />
                        {event.reminderOffsets.length}
                      </span>
                    )}
                    {event.recurrence && event.recurrence !== 'none' && (
                      <span className="text-[11px] flex items-center gap-0.5 text-muted-foreground">
                        <Repeat size={10} />
                        {event.recurrence}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Badge
                    variant={isToday ? 'default' : 'secondary'}
                    className="text-[10px] px-1.5 py-0"
                    style={isToday ? { backgroundColor: BRAND.accent } : isTomorrow ? { backgroundColor: '#F59E0B20', color: '#F59E0B' } : {}}
                  >
                    {formatRelative(event.scheduledAt)}
                  </Badge>
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <Button
                      data-testid={`complete-event-${event.id}`}
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label="Mark complete" onClick={() => completeMutation.mutate(event.id)}
                    >
                      <Check size={12} className="text-teal-600" />
                    </Button>
                    <Button
                      data-testid={`cancel-event-${event.id}`}
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label="Cancel" onClick={() => cancelMutation.mutate(event.id)}
                    >
                      <X size={12} className="text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ScheduleCalendarViewProps {
  childId?: string;
  eventTypes?: string[];
}

export function ScheduleCalendarView({ childId, eventTypes }: ScheduleCalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<'assessment' | 'test' | 'study_session' | 'lbi_review' | 'revision'>('study_session');

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const params = new URLSearchParams();
  if (childId) params.set('childId', childId);
  params.set('fromDate', startOfMonth.toISOString());
  params.set('toDate', endOfMonth.toISOString());

  const { data: events = [] } = useQuery<ScheduledEvent[]>({
    queryKey: ['/api/scheduled-events', childId, 'calendar', startOfMonth.toISOString()],
    queryFn: async () => {
      const res = await fetch(`/api/scheduled-events?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const eventDates = events.reduce<Record<string, ScheduledEvent[]>>((acc, event) => {
    const dateKey = new Date(event.scheduledAt).toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  const selectedDateEvents = selectedDate
    ? (eventDates[selectedDate.toDateString()] || [])
    : [];

  const modifiers = {
    hasEvents: Object.keys(eventDates).map(d => new Date(d)),
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarIcon size={16} style={{ color: BRAND.primary }} />
            Schedule Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedEventType} onValueChange={(v: any) => setSelectedEventType(v)}>
              <SelectTrigger data-testid="calendar-event-type-select" className="h-7 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              data-testid="calendar-schedule-btn"
              size="sm"
              onClick={() => setScheduleDialogOpen(true)}
              className="h-7 text-xs gap-1"
              style={{ backgroundColor: BRAND.primary }}
            >
              <Plus size={12} />
              New
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4">
          <div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={modifiers}
              modifiersClassNames={{
                hasEvents: 'font-bold',
              }}
            />
          </div>

          <div className="min-h-[200px]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">
                {selectedDate ? selectedDate.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a date'}
              </h4>
              <Badge variant="outline" className="text-[10px]">{selectedDateEvents.length} events</Badge>
            </div>

            {selectedDateEvents.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-muted/20">
                <CalendarIcon size={20} className="mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No events on this day</p>
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2 pr-2">
                  {selectedDateEvents.map(event => {
                    const cfg = EVENT_TYPE_CONFIG[event.eventType] || EVENT_TYPE_CONFIG.assessment;
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={event.id}
                        className="flex items-center gap-2.5 p-2 rounded-lg border"
                        style={{ borderLeftWidth: 3, borderLeftColor: cfg.color }}
                      >
                        <div className="w-7 h-7 rounded flex items-center justify-center" style={{ backgroundColor: `${cfg.color}12` }}>
                          <Icon size={13} style={{ color: cfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{event.title}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock size={9} />
                            {formatTime(event.scheduledAt)}
                            {event.durationMinutes && ` · ${event.durationMinutes}min`}
                          </p>
                        </div>
                        <Badge
                          className="text-[9px] px-1"
                          style={{ backgroundColor: `${cfg.color}15`, color: cfg.color, border: 'none' }}
                        >
                          {cfg.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </CardContent>

      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        childId={childId}
        eventType={selectedEventType}
      />
    </Card>
  );
}

interface QuickScheduleButtonProps {
  eventType: 'assessment' | 'test' | 'study_session' | 'lbi_review' | 'revision';
  title?: string;
  description?: string;
  childId?: string;
  childName?: string;
  referenceId?: string;
  referenceType?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
  label?: string;
}

export function QuickScheduleButton({ eventType, title, description, childId, childName, referenceId, referenceType, variant = 'outline', size = 'sm', className, label }: QuickScheduleButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        data-testid={`quick-schedule-${eventType}-btn`}
        variant={variant}
        size={size}
        onClick={() => setDialogOpen(true)}
        className={`gap-1 ${className || ''}`}
      >
        <CalendarIcon size={12} />
        {label || 'Schedule'}
      </Button>
      <ScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        childId={childId}
        childName={childName}
        eventType={eventType}
        prefillTitle={title}
        prefillDescription={description}
        referenceId={referenceId}
        referenceType={referenceType}
      />
    </>
  );
}

export default ScheduleDialog;
