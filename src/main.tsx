import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { supabase } from './lib/supabase';
import './styles.css';

type JobColor = 'green' | 'blue' | 'orange' | 'red';
type Job = { id: string; title: string; client_name: string; address: string | null; color: JobColor; status: string; archived: boolean };
type TimeEntry = { id: string; employee_id: string; job_id: string; clock_in: string; clock_out: string | null; paused_at: string | null; paused_seconds: number; break_start: string | null; break_end: string | null; jobs: { title: string }[] | null };
type Profile = { id: string; company_id: string; full_name: string; role: 'owner' | 'employee' };
type JobTask = { id: string; job_id: string; title: string; suggested_person: '' | 'Philip' | 'Jason' | 'Russel'; details: string; completed: boolean };
type TaskAttachment = { id: string; task_id: string; file_name: string; file_path: string; mime_type: string | null; file_size: number; created_at: string };
type OffDay = { id: string; day: string; status: 'off' };
type AssistantMessage = { role: 'assistant' | 'user'; content: string };
type Receipt = { id: string; job_id: string; employee_id: string; file_name: string; file_path: string; mime_type: string | null; file_size: number; created_at: string };
type TimeBlock = { jobId: string; startTime: string; endTime: string; breakMinutes: string; breakStart: string; breakEnd: string };
type TimeEditor = { entry: TimeEntry | null; kind: 'worked' | 'off'; day: string; blocks: TimeBlock[] };

const COLORS: Record<JobColor, { label: string; className: string }> = {
  green: { label: 'Ready', className: 'green' },
  blue: { label: 'In progress', className: 'blue' },
  orange: { label: 'Waiting', className: 'orange' },
  red: { label: 'Urgent', className: 'red' },
};

function toHours(entry: TimeEntry) {
  if (!entry.clock_out) return 0;
  const elapsed = new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime();
  return Math.max(0, elapsed - (entry.paused_seconds ?? 0) * 1000) / 3_600_000;
}

function currentPauseSeconds(entry: TimeEntry) {
  if (!entry.paused_at) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(entry.paused_at).getTime()) / 1000));
}

function payPeriodStart(now = new Date()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const daysSinceThursday = (date.getDay() + 3) % 7;
  date.setDate(date.getDate() - daysSinceThursday);
  const anchor = new Date(2026, 7, 20);
  const elapsedWeeks = Math.floor((date.getTime() - anchor.getTime()) / 604_800_000);
  if (elapsedWeeks % 2 !== 0) date.setDate(date.getDate() - 7);
  return date;
}

function formatDate(date: Date) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date); }
function formatFullDate(date: Date) { return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(date); }
function formatWeekday(date: Date) { return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date); }
function formatTime(value: string) { return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value)); }
function localDateValue(value: string) { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function localTimeValue(value: string) { const date = new Date(value); return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }
function breakTimeValue(value: string | null) { return value ? value.slice(0, 5) : ''; }
function minutesBetween(day: string, startTime: string, endTime: string) { const start = new Date(`${day}T${startTime}:00`); const end = new Date(`${day}T${endTime}:00`); return !Number.isNaN(start.getTime()) && end > start ? (end.getTime() - start.getTime()) / 60_000 : 0; }
function hoursBetween(day: string, startTime: string, endTime: string, breakMinutes = 0) { const start = new Date(`${day}T${startTime}:00`); const end = new Date(`${day}T${endTime}:00`); return !Number.isNaN(start.getTime()) && end > start ? Math.max(0, (end.getTime() - start.getTime()) / 3_600_000 - breakMinutes / 60) : 0; }
function makeTimeBlock(jobId = '', startTime = '08:00', endTime = '17:00'): TimeBlock { return { jobId, startTime, endTime, breakMinutes: '30', breakStart: '12:00', breakEnd: '12:30' }; }

function SignIn({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError || !data.session) setError(signInError?.message ?? 'Unable to sign in.');
    else onSignedIn(data.session);
  }
  async function sendPasswordReset() {
    if (!email.trim()) { setError('Enter your sign-in email first, then choose Forgot password.'); return; }
    setBusy(true); setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setBusy(false);
    if (resetError) setError(resetError.message); else setResetSent(true);
  }
  return <main className="signin-shell"><section className="signin-card"><div className="signin-brand"><img src="/pwa-icon-3.png" alt="RidgePoint" /><span>Jobs &amp; Clock</span></div><p>Sign in to see jobs and clock time for RidgePoint Remodeling.</p><form onSubmit={submit}><label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setResetSent(false); }} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>{error && <p className="form-error">{error}</p>}{resetSent && <p className="reset-success">Check your email for a secure password-reset link.</p>}<button disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button><button type="button" className="signin-reset" disabled={busy} onClick={() => void sendPasswordReset()}>Forgot password?</button></form></section></main>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [companyProfiles, setCompanyProfiles] = useState<Profile[]>([]);
  const [timesheetEmployeeId, setTimesheetEmployeeId] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [offDays, setOffDays] = useState<OffDay[]>([]);
  const [active, setActive] = useState<TimeEntry | null>(null);
  const [tab, setTab] = useState<'jobs' | 'clock' | 'timesheet' | 'receipts' | 'assistant'>('jobs');
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([{ role: 'assistant', content: 'Hi — I can help you find RidgePoint jobs, task notes, and your time entries. What do you need?' }]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [openedJobId, setOpenedJobId] = useState('');
  const [crewColors, setCrewColors] = useState({ Philip: 'burgundy', Jason: 'blue', Russel: 'green' });
  const [tasks, setTasks] = useState<Record<string, JobTask[]>>({});
  const [attachments, setAttachments] = useState<Record<string, TaskAttachment[]>>({});
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptJobId, setReceiptJobId] = useState('');
  const [openedReceiptJobId, setOpenedReceiptJobId] = useState('');
  const [receiptPickerOpen, setReceiptPickerOpen] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [deletingReceiptId, setDeletingReceiptId] = useState('');
  const [showJobTotals, setShowJobTotals] = useState(false);
  const [openTaskId, setOpenTaskId] = useState('');
  const [taskDraft, setTaskDraft] = useState<{ id: string; suggested_person: JobTask['suggested_person']; details: string } | null>(null);
  const [uploadingTaskId, setUploadingTaskId] = useState('');
  const [deletingAttachmentId, setDeletingAttachmentId] = useState('');
  const [attachmentPickerTaskId, setAttachmentPickerTaskId] = useState('');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [timeEditor, setTimeEditor] = useState<TimeEditor | null>(null);
  const [printMode, setPrintMode] = useState<'payroll' | 'jobs' | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [jobForm, setJobForm] = useState({ title: '', client_name: '', address: '', color: 'green' as JobColor, status: 'Ready to start' });
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAccount, setShowAccount] = useState(false);
  const [accountLinkSent, setAccountLinkSent] = useState(false);
  const [accountVerified, setAccountVerified] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountForm, setAccountForm] = useState({ email: '', fullName: '', password: '', confirmPassword: '' });
  const [now, setNow] = useState(() => new Date());
  const printDocumentRef = useRef<HTMLDivElement>(null);

  async function refresh(userId = session?.user.id, forcedTimesheetEmployeeId?: string) {
    if (!userId) return;
    setLoading(true);
    const { data: profileData, error: profileError } = await supabase.from('profiles').select('id, company_id, full_name, role').eq('id', userId).single();
    if (profileError || !profileData) { setNotice(`Profile could not load: ${profileError?.message ?? 'No matching profile was returned.'}`); setLoading(false); return; }
    setProfile(profileData as Profile);
    const timeEmployeeId = profileData.role === 'owner' ? (forcedTimesheetEmployeeId || timesheetEmployeeId || userId) : userId;
    const [{ data: jobData }, { data: entryData }, { data: activeData }, { data: taskData }, { data: attachmentData }, { data: offDayData }, { data: receiptData }, { data: memberData }] = await Promise.all([
      supabase.from('jobs').select('id, title, client_name, address, color, status, archived').eq('company_id', profileData.company_id).eq('archived', false).order('created_at', { ascending: false }),
      supabase.from('time_entries').select('id, employee_id, job_id, clock_in, clock_out, paused_at, paused_seconds, break_start, break_end, jobs(title)').eq('employee_id', timeEmployeeId).order('clock_in', { ascending: false }),
      supabase.from('time_entries').select('id, employee_id, job_id, clock_in, clock_out, paused_at, paused_seconds, break_start, break_end, jobs(title)').eq('employee_id', userId).is('clock_out', null).maybeSingle(),
      supabase.from('job_tasks').select('id, job_id, title, suggested_person, details, completed').eq('company_id', profileData.company_id).order('created_at'),
      supabase.from('job_task_attachments').select('id, task_id, file_name, file_path, mime_type, file_size, created_at').eq('company_id', profileData.company_id).order('created_at'),
      supabase.from('time_off_days').select('id, day, status').eq('employee_id', timeEmployeeId).order('day', { ascending: false }),
      supabase.from('receipts').select('id, job_id, employee_id, file_name, file_path, mime_type, file_size, created_at').eq('company_id', profileData.company_id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, company_id, full_name, role').eq('company_id', profileData.company_id).order('full_name'),
    ]);
    const loadedActive = (activeData ?? null) as TimeEntry | null;
    const loadedJobs = (jobData ?? []) as Job[];
    const taskGroups = ((taskData ?? []) as JobTask[]).reduce<Record<string, JobTask[]>>((all, task) => { (all[task.job_id] ??= []).push(task); return all; }, {});
    const attachmentGroups = ((attachmentData ?? []) as TaskAttachment[]).reduce<Record<string, TaskAttachment[]>>((all, attachment) => { (all[attachment.task_id] ??= []).push(attachment); return all; }, {});
    setTasks(taskGroups); setAttachments(attachmentGroups); setJobs(loadedJobs); setEntries((entryData ?? []) as TimeEntry[]); setOffDays((offDayData ?? []) as OffDay[]); setReceipts((receiptData ?? []) as Receipt[]); setCompanyProfiles((memberData ?? []) as Profile[]); setActive(loadedActive);
    // An open shift always wins: its job must never change just because the app refreshed.
    setSelectedJobId((previous) => loadedActive?.job_id ?? previous ?? loadedJobs[0]?.id ?? ''); setReceiptJobId((previous) => previous || loadedJobs[0]?.id || ''); setLoading(false);
  }

  useEffect(() => { supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) refresh(data.session.user.id); else setLoading(false); }); const { data: listener } = supabase.auth.onAuthStateChange((event, next) => { setSession(next); if (event === 'PASSWORD_RECOVERY' && next) { setAccountForm((previous) => ({ ...previous, email: next.user.email ?? previous.email, fullName: previous.fullName || profile?.full_name || '' })); setAccountVerified(true); setAccountLinkSent(true); setShowAccount(true); setNotice('Email verified. You can now choose a new password or sign-in email.'); } if (next) refresh(next.user.id); else { setProfile(null); setJobs([]); setEntries([]); } }); return () => listener.subscription.unsubscribe(); }, []);
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => undefined); }, []);
  useEffect(() => { if (!profile) return; const channel = supabase.channel('ridgepoint-jobs').on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `company_id=eq.${profile.company_id}` }, () => refresh()).subscribe(); return () => { supabase.removeChannel(channel); }; }, [profile?.company_id]);
  useEffect(() => { if (profile?.role === 'owner' && timesheetEmployeeId) void refresh(undefined, timesheetEmployeeId); }, [timesheetEmployeeId]);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);

  const currentJob = jobs.find((job) => job.id === selectedJobId);
  const activeJob = active ? jobs.find((job) => job.id === active.job_id) : undefined;
  const viewedTimesheetEmployeeId = profile?.role === 'owner' ? (timesheetEmployeeId || profile.id) : profile?.id || '';
  const viewedTimesheetEmployee = companyProfiles.find((member) => member.id === viewedTimesheetEmployeeId) ?? profile;
  const clockHourAngle = ((now.getHours() % 12) + now.getMinutes() / 60) * 30;
  const clockMinuteAngle = (now.getMinutes() + now.getSeconds() / 60) * 6;
  const clockSecondAngle = now.getSeconds() * 6;
  const currentPayPeriodStart = payPeriodStart();
  const periodOptions = useMemo(() => {
    const oldestEntry = entries.reduce<Date | null>((oldest, entry) => {
      const date = new Date(entry.clock_in); return !oldest || date < oldest ? date : oldest;
    }, null);
    const earliestPeriod = oldestEntry ? payPeriodStart(oldestEntry) : currentPayPeriodStart;
    const count = Math.max(1, Math.ceil((currentPayPeriodStart.getTime() - earliestPeriod.getTime()) / (14 * 86_400_000)) + 1);
    return Array.from({ length: count }, (_, offset) => {
      const periodStart = new Date(currentPayPeriodStart); periodStart.setDate(periodStart.getDate() - offset * 14);
      const periodEnd = new Date(periodStart); periodEnd.setDate(periodEnd.getDate() + 13);
      return { offset, start: periodStart, end: periodEnd };
    });
  }, [entries, currentPayPeriodStart.getTime()]);
  const start = new Date(currentPayPeriodStart); start.setDate(start.getDate() - periodOffset * 14); const end = new Date(start); end.setDate(end.getDate() + 13); end.setHours(23, 59, 59, 999);
  const isPastPeriod = periodOffset > 0;
  const canEditPeriod = !isPastPeriod || profile?.role === 'owner';
  const periodEntries = useMemo(() => entries.filter((entry) => { const clockIn = new Date(entry.clock_in); return clockIn >= start && clockIn <= end; }), [entries, start.getTime(), end.getTime()]);
  const periodOffDays = useMemo(() => offDays.filter((offDay) => { const day = new Date(`${offDay.day}T12:00:00`); return day >= start && day <= end; }), [offDays, start.getTime(), end.getTime()]);
  const hours = periodEntries.reduce((total, entry) => total + toHours(entry), 0);
  const jobTitle = (entry: TimeEntry) => jobs.find((job) => job.id === entry.job_id)?.title ?? entry.jobs?.[0]?.title ?? 'Unassigned job';
  const jobTotals = useMemo(() => Object.values(periodEntries.reduce<Record<string, { title: string; hours: number }>>((total, entry) => { const title = jobTitle(entry); const current = total[entry.job_id] ?? { title, hours: 0 }; current.hours += toHours(entry); total[entry.job_id] = current; return total; }, {})), [periodEntries, jobs]);
  const dailyEntries = useMemo(() => Object.values(periodEntries.reduce<Record<string, { day: string; entries: TimeEntry[]; hours: number }>>((all, entry) => { const day = localDateValue(entry.clock_in); const current = all[day] ?? { day, entries: [], hours: 0 }; current.entries.push(entry); current.hours += toHours(entry); all[day] = current; return all; }, {})).map((group) => ({ ...group, entries: group.entries.sort((a, b) => a.clock_in.localeCompare(b.clock_in)) })).sort((a, b) => b.day.localeCompare(a.day)), [periodEntries]);
  const printableDays = useMemo(() => { const rows: Array<{ day: string; entries: TimeEntry[]; hours: number; off: boolean }> = dailyEntries.map((day) => ({ ...day, off: false })); periodOffDays.forEach((offDay) => { if (!rows.some((day) => day.day === offDay.day)) rows.push({ day: offDay.day, entries: [], hours: 0, off: true }); }); return rows.sort((a, b) => b.day.localeCompare(a.day)); }, [dailyEntries, periodOffDays]);
  const weekOneEnd = new Date(start); weekOneEnd.setDate(weekOneEnd.getDate() + 7);
  const weekOneHours = periodEntries.filter((entry) => new Date(entry.clock_in) < weekOneEnd).reduce((total, entry) => total + toHours(entry), 0);
  const weekTwoHours = hours - weekOneHours;
  const overtimeHours = Math.max(0, weekOneHours - 40) + Math.max(0, weekTwoHours - 40);
  const regularHours = hours - overtimeHours;
  const grossPay = regularHours * 35 + overtimeHours * 52.5;
  function printTimesheet(mode: 'payroll' | 'jobs') { setPrintMode(mode); }
  async function capturePayrollTimesheet() {
    if (!printDocumentRef.current) throw new Error('Timesheet preview is not ready yet.');
    return html2canvas(printDocumentRef.current, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
  }
  async function captureShareImage() {
    if (!printDocumentRef.current) throw new Error('Timesheet preview is not ready yet.');
    const staging = document.createElement('div');
    const clone = printDocumentRef.current.cloneNode(true) as HTMLDivElement;
    staging.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;padding:0;background:#fff;pointer-events:none;';
    clone.style.width = '900px'; clone.style.maxWidth = 'none';
    staging.appendChild(clone); document.body.appendChild(staging);
    try {
      const sheet = await html2canvas(clone, { backgroundColor: '#ffffff', scale: 1.5, useCORS: true, windowWidth: 1024 });
      const outerMargin = 72; const sheetWidth = 1296; const scale = sheetWidth / sheet.width; const sheetHeight = Math.round(sheet.height * scale);
      const canvas = document.createElement('canvas'); canvas.width = sheetWidth + outerMargin * 2; canvas.height = sheetHeight + outerMargin * 2;
      const context = canvas.getContext('2d'); if (!context) throw new Error('Could not prepare the shared image.');
      context.fillStyle = '#edf3f2'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffffff'; context.fillRect(outerMargin, outerMargin, sheetWidth, sheetHeight);
      context.drawImage(sheet, outerMargin, outerMargin, sheetWidth, sheetHeight);
      return canvas;
    } finally { staging.remove(); }
  }
  function downloadBlob(blob: Blob, fileName: string) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = fileName; link.click(); URL.revokeObjectURL(url); }
  async function saveTimesheetImage() { try { setExportBusy(true); const canvas = await capturePayrollTimesheet(); const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png')); if (!blob) throw new Error('Could not create image.'); downloadBlob(blob, `ridgepoint-timesheet-${start.toISOString().slice(0, 10)}.png`); } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save image.'); } finally { setExportBusy(false); } }
  async function shareTimesheet() { try { setExportBusy(true); const canvas = await captureShareImage(); const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', .94)); if (!blob) throw new Error('Could not create image.'); const file = new File([blob], `ridgepoint-timesheet-${start.toISOString().slice(0, 10)}.jpg`, { type: 'image/jpeg' }); if (navigator.canShare?.({ files: [file] }) && navigator.share) await navigator.share({ title: 'RidgePoint timesheet', files: [file] }); else downloadBlob(blob, file.name); } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice(error instanceof Error ? error.message : 'Could not share timesheet.'); } finally { setExportBusy(false); } }
  async function saveTimesheetPdf() { try { setExportBusy(true); const canvas = await capturePayrollTimesheet(); const image = canvas.toDataURL('image/png'); const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' }); const pageWidth = pdf.internal.pageSize.getWidth(); const pageHeight = pdf.internal.pageSize.getHeight(); const margin = 28; const width = pageWidth - margin * 2; const height = canvas.height * width / canvas.width; pdf.addImage(image, 'PNG', margin, margin, width, Math.min(height, pageHeight - margin * 2)); pdf.save(`ridgepoint-timesheet-${start.toISOString().slice(0, 10)}.pdf`); } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save PDF.'); } finally { setExportBusy(false); } }

  async function saveJob(event: FormEvent) {
    event.preventDefault(); if (!profile) return;
    const { error } = editingJob
      ? await supabase.from('jobs').update(jobForm).eq('id', editingJob.id)
      : await supabase.from('jobs').insert({ ...jobForm, company_id: profile.company_id });
    if (error) setNotice(error.message); else { setJobForm({ title: '', client_name: '', address: '', color: 'green', status: 'Ready to start' }); setEditingJob(null); setShowJobForm(false); await refresh(); }
  }
  function editJob(job: Job) { setEditingJob(job); setJobForm({ title: job.title, client_name: job.client_name, address: job.address ?? '', color: job.color, status: job.status }); setShowJobForm(true); }
  async function deleteJob(job: Job) { if (!window.confirm(`Remove “${job.title}” from the active job board? Its existing time records and notes will stay safe for payroll history.`)) return; const { error } = await supabase.from('jobs').update({ archived: true }).eq('id', job.id); if (error) setNotice(error.message); else { if (selectedJobId === job.id) setSelectedJobId(''); if (openedJobId === job.id) setOpenedJobId(''); await refresh(); } }
  async function clockIn() { if (!profile || !selectedJobId) return setNotice('Choose a job first.'); const { error } = await supabase.from('time_entries').insert({ company_id: profile.company_id, employee_id: profile.id, job_id: selectedJobId, clock_in: new Date().toISOString() }); if (error) setNotice(error.message); else await refresh(); }
  async function pauseClock() { if (!active || active.paused_at) return; const { error } = await supabase.from('time_entries').update({ paused_at: new Date().toISOString() }).eq('id', active.id); if (error) setNotice(error.message); else await refresh(); }
  async function resumeClock() { if (!active || !active.paused_at) return; const { error } = await supabase.from('time_entries').update({ paused_at: null, paused_seconds: (active.paused_seconds ?? 0) + currentPauseSeconds(active) }).eq('id', active.id); if (error) setNotice(error.message); else await refresh(); }
  async function clockOut() { if (!active) return; const { error } = await supabase.from('time_entries').update({ clock_out: new Date().toISOString(), paused_at: null, paused_seconds: (active.paused_seconds ?? 0) + currentPauseSeconds(active) }).eq('id', active.id); if (error) setNotice(error.message); else await refresh(); }
  async function deleteHours(entry: TimeEntry) { if (!window.confirm(`Delete ${toHours(entry).toFixed(2)} hours for ${jobTitle(entry)}? This cannot be undone.`)) return; const { error } = await supabase.from('time_entries').delete().eq('id', entry.id); if (error) setNotice(error.message); else await refresh(); }
  function adjust(entry: TimeEntry) { const customBreak = Boolean(entry.break_start && entry.break_end); setTimeEditor({ entry, kind: 'worked', day: localDateValue(entry.clock_in), blocks: [{ jobId: entry.job_id, startTime: localTimeValue(entry.clock_in), endTime: entry.clock_out ? localTimeValue(entry.clock_out) : '', breakMinutes: customBreak ? 'custom' : String(Math.round((entry.paused_seconds ?? 0) / 60)), breakStart: customBreak ? breakTimeValue(entry.break_start) : '12:00', breakEnd: customBreak ? breakTimeValue(entry.break_end) : '12:30' }] }); }
  function addHours() { setTimeEditor({ entry: null, kind: 'worked', day: start.toISOString().slice(0, 10), blocks: [makeTimeBlock(selectedJobId)] }); }
  function updateTimeBlock(index: number, changes: Partial<TimeBlock>) { if (!timeEditor) return; setTimeEditor({ ...timeEditor, blocks: timeEditor.blocks.map((block, blockIndex) => blockIndex === index ? { ...block, ...changes } : block) }); }
  function addTimeBlock() { if (!timeEditor) return; const previous = timeEditor.blocks.at(-1); const startTime = previous?.endTime || '08:00'; const endHour = Math.min(23, Number(startTime.slice(0, 2)) + 1); const endTime = `${String(endHour).padStart(2, '0')}:${startTime.slice(3)}`; setTimeEditor({ ...timeEditor, blocks: [...timeEditor.blocks, makeTimeBlock(previous?.jobId ?? selectedJobId, startTime, endTime)] }); }
  function removeTimeBlock(index: number) { if (!timeEditor || timeEditor.blocks.length === 1) return; setTimeEditor({ ...timeEditor, blocks: timeEditor.blocks.filter((_, blockIndex) => blockIndex !== index) }); }
  async function deleteOffDay(offDay: OffDay) { if (!window.confirm(`Remove Off status for ${formatDate(new Date(`${offDay.day}T12:00:00`))}?`)) return; const { error } = await supabase.from('time_off_days').delete().eq('id', offDay.id); if (error) setNotice(error.message); else await refresh(); }
  async function saveHours(event: FormEvent) {
    event.preventDefault(); if (!profile || !timeEditor || !viewedTimesheetEmployeeId) return;
    if (timeEditor.kind === 'off') {
      const { error } = await supabase.from('time_off_days').upsert({ company_id: profile.company_id, employee_id: viewedTimesheetEmployeeId, day: timeEditor.day, status: 'off' }, { onConflict: 'employee_id,day' });
      if (error) setNotice(error.message); else { setTimeEditor(null); await refresh(); } return;
    }
    const prepared: Array<{ job_id: string; clock_in: string; clock_out: string; paused_at: null; paused_seconds: number; break_start: string | null; break_end: string | null; edited_at: string }> = [];
    for (const block of timeEditor.blocks) {
      if (!block.jobId || !block.startTime || !block.endTime) return setNotice('Choose a job, start time, and end time for every time block.');
      const startAt = new Date(`${timeEditor.day}T${block.startTime}:00`); const endAt = new Date(`${timeEditor.day}T${block.endTime}:00`);
      const customBreak = block.breakMinutes === 'custom'; const breakMinutes = customBreak ? minutesBetween(timeEditor.day, block.breakStart, block.breakEnd) : Number(block.breakMinutes);
      const breakStartAt = new Date(`${timeEditor.day}T${block.breakStart}:00`); const breakEndAt = new Date(`${timeEditor.day}T${block.breakEnd}:00`);
      if (endAt <= startAt) return setNotice('Each time block must end after it starts.');
      if (customBreak && (breakMinutes <= 0 || breakStartAt < startAt || breakEndAt > endAt)) return setNotice('A custom break must fall inside its time block.');
      if (breakMinutes < 0 || breakMinutes * 60_000 >= endAt.getTime() - startAt.getTime()) return setNotice('Break time must be shorter than its time block.');
      prepared.push({ job_id: block.jobId, clock_in: startAt.toISOString(), clock_out: endAt.toISOString(), paused_at: null, paused_seconds: Math.round(breakMinutes * 60), break_start: customBreak ? block.breakStart : null, break_end: customBreak ? block.breakEnd : null, edited_at: new Date().toISOString() });
    }
    const ordered = [...prepared].sort((a, b) => a.clock_in.localeCompare(b.clock_in));
    if (ordered.some((block, index) => index > 0 && block.clock_in < ordered[index - 1].clock_out)) return setNotice('Time blocks cannot overlap. Adjust the times, then save again.');
    const { error } = timeEditor.entry
      ? await supabase.from('time_entries').update(prepared[0]).eq('id', timeEditor.entry.id)
      : await supabase.from('time_entries').insert(prepared.map((block) => ({ company_id: profile.company_id, employee_id: viewedTimesheetEmployeeId, ...block })));
    if (error) setNotice(error.message); else { setTimeEditor(null); await refresh(); }
  }
  async function addTask(jobId: string) { if (!profile) return; const title = window.prompt('Task note'); if (!title) return; const { error } = await supabase.from('job_tasks').insert({ company_id: profile.company_id, job_id: jobId, title }); if (error) setNotice(error.message); else await refresh(); }
  async function updateTask(task: JobTask, changes: Partial<JobTask>) { const { error } = await supabase.from('job_tasks').update(changes).eq('id', task.id); if (error) setNotice(error.message); else await refresh(); }
  async function deleteTask(task: JobTask) { if (!window.confirm(`Delete note “${task.title}”? This cannot be undone.`)) return; const { error } = await supabase.from('job_tasks').delete().eq('id', task.id); if (error) setNotice(error.message); else { if (openTaskId === task.id) { setOpenTaskId(''); setTaskDraft(null); } await refresh(); } }
  async function saveAndCloseTask(task: JobTask) {
    const draft = taskDraft?.id === task.id ? taskDraft : task;
    const { error } = await supabase.from('job_tasks').update({ suggested_person: draft.suggested_person, details: draft.details }).eq('id', task.id);
    if (error) return setNotice(error.message);
    setTaskDraft(null); setOpenTaskId(''); await refresh();
  }
  async function uploadAttachment(task: JobTask, file: File | undefined) {
    if (!profile || !file) return;
    if (file.size > 20 * 1024 * 1024) return setNotice('Please choose a file smaller than 20 MB.');
    setUploadingTaskId(task.id);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const filePath = `${profile.company_id}/${task.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('task-attachments').upload(filePath, file, { contentType: file.type || undefined });
    if (uploadError) { setUploadingTaskId(''); return setNotice(/bucket not found/i.test(uploadError.message) ? 'Task file storage is not set up yet. Run fix_task_attachments_bucket.sql in Supabase, then try again.' : uploadError.message); }
    const { error: recordError } = await supabase.from('job_task_attachments').insert({ company_id: profile.company_id, task_id: task.id, file_name: file.name, file_path: filePath, mime_type: file.type || null, file_size: file.size });
    setUploadingTaskId('');
    if (recordError) setNotice(recordError.message); else await refresh();
  }
  async function openAttachment(attachment: TaskAttachment) {
    const { data, error } = await supabase.storage.from('task-attachments').createSignedUrl(attachment.file_path, 120);
    if (error || !data?.signedUrl) setNotice(error?.message ?? 'Could not open that file.'); else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }
  async function deleteAttachment(attachment: TaskAttachment) {
    if (!window.confirm(`Delete “${attachment.file_name}”? This cannot be undone.`)) return;
    setDeletingAttachmentId(attachment.id);
    const { error: storageError } = await supabase.storage.from('task-attachments').remove([attachment.file_path]);
    if (storageError) { setDeletingAttachmentId(''); return setNotice(storageError.message); }
    const { error } = await supabase.from('job_task_attachments').delete().eq('id', attachment.id);
    setDeletingAttachmentId('');
    if (error) setNotice(error.message); else await refresh();
  }
  async function uploadReceipt(file: File | undefined) {
    if (!profile || !file) return;
    if (!receiptJobId) return setNotice('Choose the job this receipt belongs to first.');
    if (file.size > 20 * 1024 * 1024) return setNotice('Please choose a receipt smaller than 20 MB.');
    setUploadingReceipt(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const filePath = `${profile.company_id}/${receiptJobId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, file, { contentType: file.type || undefined });
    if (uploadError) { setUploadingReceipt(false); return setNotice(/bucket not found/i.test(uploadError.message) ? 'Receipt storage is not set up yet. Run fix_receipts_bucket.sql in Supabase, then try again.' : uploadError.message); }
    const { error: recordError } = await supabase.from('receipts').insert({ company_id: profile.company_id, job_id: receiptJobId, employee_id: profile.id, file_name: file.name, file_path: filePath, mime_type: file.type || null, file_size: file.size });
    setUploadingReceipt(false); setReceiptPickerOpen(false);
    if (recordError) setNotice(recordError.message); else await refresh();
  }
  async function openReceipt(receipt: Receipt) {
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(receipt.file_path, 120);
    if (error || !data?.signedUrl) setNotice(error?.message ?? 'Could not open that receipt.'); else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }
  async function receiptBlob(receipt: Receipt) {
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(receipt.file_path, 120);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not access that receipt.');
    const response = await fetch(data.signedUrl);
    if (!response.ok) throw new Error('Could not download that receipt.');
    return response.blob();
  }
  async function downloadReceipt(receipt: Receipt) { try { const blob = await receiptBlob(receipt); downloadBlob(blob, receipt.file_name); } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not download that receipt.'); } }
  async function shareReceipt(receipt: Receipt) { try { const blob = await receiptBlob(receipt); const file = new File([blob], receipt.file_name, { type: receipt.mime_type || blob.type || 'application/octet-stream' }); if (navigator.canShare?.({ files: [file] }) && navigator.share) await navigator.share({ title: receipt.file_name, files: [file] }); else downloadBlob(blob, receipt.file_name); } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice(error instanceof Error ? error.message : 'Could not share that receipt.'); } }
  async function deleteReceipt(receipt: Receipt) {
    if (!window.confirm(`Delete “${receipt.file_name}”? This cannot be undone.`)) return;
    setDeletingReceiptId(receipt.id);
    const { error: storageError } = await supabase.storage.from('receipts').remove([receipt.file_path]);
    if (storageError) { setDeletingReceiptId(''); return setNotice(storageError.message); }
    const { error } = await supabase.from('receipts').delete().eq('id', receipt.id);
    setDeletingReceiptId('');
    if (error) setNotice(error.message); else await refresh();
  }
  function openAccount() {
    setAccountForm({ email: session?.user.email ?? '', fullName: profile?.full_name ?? '', password: '', confirmPassword: '' });
    setAccountLinkSent(false); setAccountVerified(false); setShowAccount(true);
  }
  async function sendAccountRecoveryLink() {
    const email = session?.user.email;
    if (!email) return setNotice('This account does not have an email address to verify.');
    setAccountBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setAccountBusy(false);
    if (error) setNotice(error.message); else { setAccountLinkSent(true); setNotice(`A secure reset link was sent to ${email}.`); }
  }
  async function saveAccount(event: FormEvent) {
    event.preventDefault();
    if (!profile || !session || !accountVerified) return;
    if (accountForm.password && accountForm.password.length < 8) return setNotice('Use at least 8 characters for the new password.');
    if (accountForm.password !== accountForm.confirmPassword) return setNotice('New password and confirmation do not match.');
    setAccountBusy(true);
    const authUpdates: { email?: string; password?: string } = {};
    if (accountForm.email.trim() && accountForm.email.trim().toLowerCase() !== session.user.email?.toLowerCase()) authUpdates.email = accountForm.email.trim().toLowerCase();
    if (accountForm.password) authUpdates.password = accountForm.password;
    if (Object.keys(authUpdates).length) { const { error } = await supabase.auth.updateUser(authUpdates); if (error) { setAccountBusy(false); return setNotice(error.message); } }
    if (accountForm.fullName.trim() && accountForm.fullName.trim() !== profile.full_name) { const { error } = await supabase.from('profiles').update({ full_name: accountForm.fullName.trim() }).eq('id', profile.id); if (error) { setAccountBusy(false); return setNotice(error.message); } }
    setAccountBusy(false); setShowAccount(false); await refresh(); setNotice(authUpdates.email ? 'Account saved. Confirm the new email from its inbox before using it to sign in.' : 'Account saved.');
  }
  async function askAssistant(event: FormEvent) {
    event.preventDefault();
    const question = assistantInput.trim();
    if (!question || !session || !profile || assistantBusy) return;
    const nextMessages = [...assistantMessages, { role: 'user' as const, content: question }];
    setAssistantMessages(nextMessages); setAssistantInput(''); setAssistantBusy(true);
    const context = {
      user: profile.full_name,
      jobs: jobs.map((job) => ({ title: job.title, client: job.client_name, address: job.address, status: job.status, tasks: (tasks[job.id] ?? []).map((task) => ({ title: task.title, details: task.details, suggestedPerson: task.suggested_person || 'Not assigned', completed: task.completed })) })),
      timeEntries: entries.slice(0, 80).map((entry) => ({ job: jobTitle(entry), clockIn: entry.clock_in, clockOut: entry.clock_out, hours: toHours(entry).toFixed(2), breakMinutes: Math.round((entry.paused_seconds ?? 0) / 60) })),
      offDays: offDays.slice(0, 40),
    };
    try {
      const response = await fetch('/api/ridgepoint-assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ question, context }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'The assistant could not answer right now.');
      setAssistantMessages((messages) => [...messages, { role: 'assistant', content: result.answer ?? 'I could not find an answer in RidgePoint data.' }]);
    } catch (error) {
      setAssistantMessages((messages) => [...messages, { role: 'assistant', content: `Sorry — ${error instanceof Error ? error.message : 'the assistant could not answer right now.'}` }]);
    } finally { setAssistantBusy(false); }
  }
  async function signOut() { await supabase.auth.signOut(); }

  if (!session) return <SignIn onSignedIn={setSession} />;
  if (loading) return <main className="loading">Loading RidgePoint Remodel Clock...</main>;
  if (!profile) return <main className="loading"><p>{notice}</p><button onClick={signOut}>Sign out</button></main>;
  return <main className="app-shell"><header><div className="header-brand"><img className="header-logo" src="/pwa-icon-3.png" alt="RidgePoint" /><span>Jobs &amp; Clock</span></div><div className="user"><strong>{profile.full_name}</strong><button className="text-button" onClick={openAccount}>Account</button><button className="text-button" onClick={signOut}>Sign out</button></div></header><nav>{(['jobs', 'clock', 'timesheet', 'receipts', 'assistant'] as const).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item === 'jobs' ? 'Jobs' : item === 'clock' ? 'Time clock' : item === 'timesheet' ? 'Timesheet' : item === 'receipts' ? 'Receipts' : 'Ask RidgePoint'}</button>)}</nav>{notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>Dismiss</button></div>}
    {tab === 'jobs' && <section>
      {openedJobId ? <>
        <button className="ghost" onClick={() => setOpenedJobId('')}>Back to jobs</button>
        <p className="kicker">PO JOB NOTES</p><h1>{jobs.find((job) => job.id === openedJobId)?.title}</h1>
        <button onClick={() => addTask(openedJobId)}>Add note</button>
        <div className="task-notes">
          {(tasks[openedJobId] ?? []).map((task) => <article className={`task-note ${task.suggested_person ? crewColors[task.suggested_person] : ''} ${task.completed ? 'done' : ''}`} key={task.id}>
            <button className="task-open" onClick={() => { setTaskDraft({ id: task.id, suggested_person: task.suggested_person, details: task.details }); setOpenTaskId(task.id); }}><span>{task.title}</span><small>{task.completed ? 'Completed' : 'Open'}</small></button>
            <div className="task-row-actions">{task.suggested_person && <span className={`crew-tag ${crewColors[task.suggested_person]}`}>{task.suggested_person}</span>}<button className="text-button" onClick={() => updateTask(task, { completed: !task.completed })}>{task.completed ? 'Reopen' : 'Complete'}</button><button className="text-button delete-button" onClick={() => void deleteTask(task)}>Delete</button></div>
          </article>)}
          {!(tasks[openedJobId]?.length) && <div className="empty">No notes yet. Add the first job note.</div>}
        </div>
      </> : <>
        <div className="section-head"><div><p className="kicker">JOB BOARD</p><h1>Pending jobs</h1></div><button onClick={() => { setEditingJob(null); setJobForm({ title: '', client_name: '', address: '', color: 'green', status: 'Ready to start' }); setShowJobForm(true); }}>Add job</button></div>
        <div className="crew-panel"><strong>Demo crew color key</strong>{(Object.keys(crewColors) as (keyof typeof crewColors)[]).map((name) => <label key={name}>{name}<select value={crewColors[name]} onChange={(event) => setCrewColors({ ...crewColors, [name]: event.target.value })}><option value="burgundy">Burgundy</option><option value="blue">Blue</option><option value="green">Green</option><option value="orange">Orange</option><option value="purple">Purple</option></select></label>)}</div>
        <div className="job-grid">{jobs.length ? jobs.map((job) => { const jobTasks = tasks[job.id] ?? []; const openCount = jobTasks.filter((task) => !task.completed).length; return <article className="job" key={job.id} onClick={() => { setSelectedJobId(job.id); setOpenedJobId(job.id); }}><span className={`color ${COLORS[job.color].className}`}></span><div><h2>{job.title}</h2><p>{job.client_name}{job.address ? ` | ${job.address}` : ''}</p><div className="job-meta"><small className={COLORS[job.color].className}>{job.status}</small><span>{openCount ? `${openCount} open ${openCount === 1 ? 'task' : 'tasks'}` : 'No open tasks'}</span></div></div><div className="job-card-actions"><button className="text-button" onClick={(event) => { event.stopPropagation(); editJob(job); }}>Edit</button><button className="text-button delete-button" onClick={(event) => { event.stopPropagation(); void deleteJob(job); }}>Delete</button></div><b>›</b></article>; }) : <div className="empty">No jobs yet. Add the first pending job.</div>}</div>
      </>}
    </section>}
    {tab === 'clock' && <section className="clock clock-panel"><div className="clock-heading"><div><p className="kicker">TIME CLOCK</p><h1>{active ? (active.paused_at ? 'Paused' : 'On the clock') : 'Ready to start'}</h1></div><span className={`clock-state ${active?.paused_at ? 'paused' : active ? 'active' : ''}`}>{active?.paused_at ? 'Paused' : active ? 'Working' : 'Off clock'}</span></div><div className="analog-clock" aria-label={`Current time ${formatTime(now.toISOString())}`}><span className="clock-tick tick-12">12</span><span className="clock-tick tick-3">3</span><span className="clock-tick tick-6">6</span><span className="clock-tick tick-9">9</span><i className="clock-hand hour-hand" style={{ transform: `translateX(-50%) rotate(${clockHourAngle}deg)` }}></i><i className="clock-hand minute-hand" style={{ transform: `translateX(-50%) rotate(${clockMinuteAngle}deg)` }}></i><i className="clock-hand second-hand" style={{ transform: `translateX(-50%) rotate(${clockSecondAngle}deg)` }}></i><b className="clock-pin"></b><div className="clock-readout"><strong>{formatTime(now.toISOString())}</strong><span>{active?.paused_at ? 'Time is paused' : active ? `Started ${formatTime(active.clock_in)}` : 'Select a job to begin'}</span></div></div><div className="clock-job-summary"><span>{active ? 'Working on' : 'Next job'}</span><strong>{active ? activeJob?.title ?? 'Current job' : currentJob?.title ?? 'Choose a job below.'}</strong></div>{!active && <label className="job-select">Working on<select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}><option value="">Select a job</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title} - {job.client_name}</option>)}</select></label>}<div className="clock-actions">{active ? <><button className="clock-primary" onClick={clockOut}>Stop clock</button><button className="ghost" onClick={active.paused_at ? resumeClock : pauseClock}>{active.paused_at ? 'Resume' : 'Pause'}</button></> : <><button className="clock-primary" onClick={clockIn}>Start clock</button><button className="ghost" onClick={() => setTab('jobs')}>View jobs</button></>}</div><p className="helper">Your selected job stays locked for this shift. Pause time for lunch or an interruption; paused time is not counted.</p></section>}
    {tab === 'timesheet' && profile.role === 'owner' && <section className="timesheet-viewer"><div><p className="kicker">OWNER VIEW</p><strong>Viewing hours for</strong><span>Switch between your crew without signing into their accounts.</span></div><label><select value={viewedTimesheetEmployeeId} onChange={(event) => setTimesheetEmployeeId(event.target.value)}>{companyProfiles.map((member) => <option key={member.id} value={member.id}>{member.full_name}{member.id === profile.id ? ' (you)' : ''}</option>)}</select></label></section>}
    {tab === 'timesheet' && <section><p className="kicker">{isPastPeriod ? 'PAST PAY PERIOD' : 'CURRENT PAY PERIOD'}</p><h1>{formatDate(start)} - {formatDate(end)}</h1><p className="period-note">{viewedTimesheetEmployee?.full_name}'s time, two weeks Thursday through Wednesday</p><label className="period-picker">View pay period<select value={periodOffset} onChange={(event) => setPeriodOffset(Number(event.target.value))}>{periodOptions.map((period) => <option key={period.offset} value={period.offset}>{period.offset === 0 ? 'Current: ' : ''}{formatDate(period.start)} - {formatDate(period.end)}</option>)}</select></label>{isPastPeriod && <p className="past-period-note">Past pay period. Only the account owner can add or adjust these hours.</p>}<div className="hours"><strong>{hours.toFixed(2)}</strong><span>Total hours</span></div><div className="overtime-summary"><span>Regular: {regularHours.toFixed(2)} h</span><span>Overtime: {overtimeHours.toFixed(2)} h</span></div><div className="timesheet-actions">{canEditPeriod && <button onClick={addHours}>Add hours for a day</button>}<button className="ghost compact" onClick={() => setShowJobTotals(!showJobTotals)}>{showJobTotals ? 'Hide job breakdown' : 'View hours by job'}</button></div>{showJobTotals && <div className="job-breakdown"><strong>Hours by job</strong>{jobTotals.map((job) => <div key={job.title}><span>{job.title}</span><b>{job.hours.toFixed(2)} h</b></div>)}</div>}<div className="entries">{(dailyEntries.length || periodOffDays.length) ? <>{dailyEntries.map((day) => <article className="day-entry" key={day.day}><div className="day-entry-head"><div><h2>{formatFullDate(new Date(`${day.day}T12:00:00`))}</h2><p>{day.entries.length === 1 ? '1 time block' : `${day.entries.length} time blocks`}</p></div><strong>{day.hours.toFixed(2)} h</strong></div><div className="time-block-list">{day.entries.map((entry) => <div className="time-block-row" key={entry.id}><div><strong>{jobTitle(entry)}</strong><p>{formatTime(entry.clock_in)}{entry.clock_out ? ` - ${formatTime(entry.clock_out)}` : ' - still clocked in'}{entry.paused_seconds ? ` · ${Math.round(entry.paused_seconds / 60)} min break` : ''}</p></div><div><b>{toHours(entry).toFixed(2)} h</b>{entry.clock_out && canEditPeriod && <div className="entry-actions"><button className="text-button" onClick={() => adjust(entry)}>Adjust</button><button className="text-button delete-button" onClick={() => deleteHours(entry)}>Delete</button></div>}</div></div>)}</div></article>)}{periodOffDays.map((offDay) => <article className="entry off-entry" key={offDay.id}><div><h2>Off</h2><p>{formatDate(new Date(`${offDay.day}T12:00:00`))}</p></div>{canEditPeriod && <button className="text-button delete-button" onClick={() => deleteOffDay(offDay)}>Remove</button>}</article>)}</> : <div className="empty">No time entered in this pay period.</div>}</div><div className="timesheet-actions"><button className="wide ghost" onClick={() => printTimesheet('payroll')}>Print/share payroll timesheet</button><button className="wide ghost" onClick={() => printTimesheet('jobs')}>Print/share job-hour summary</button></div></section>}
    {tab === 'receipts' && <section className="receipts-page"><div className="section-head"><div><p className="kicker">JOB EXPENSES</p><h1>Receipts</h1></div></div><div className="receipt-upload"><div><strong>Add a receipt</strong><p>Choose the job first, then take a photo or add one from your gallery.</p></div><label>Receipt for job<select value={receiptJobId} onChange={(event) => setReceiptJobId(event.target.value)}><option value="">Choose a job</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title} - {job.client_name}</option>)}</select></label><button disabled={uploadingReceipt || !receiptJobId} onClick={() => setReceiptPickerOpen(!receiptPickerOpen)}>{uploadingReceipt ? 'Uploading...' : 'Add receipt'}</button>{receiptPickerOpen && <div className="receipt-picker"><strong>Choose receipt source</strong><div><label className="upload-control"><span>Photos</span><input type="file" accept="image/*" onChange={(event) => { void uploadReceipt(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label><label className="upload-control"><span>Camera</span><input type="file" accept="image/*" capture="environment" onChange={(event) => { void uploadReceipt(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label><label className="upload-control"><span>File</span><input type="file" accept="image/*,application/pdf" onChange={(event) => { void uploadReceipt(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label></div><button className="text-button" onClick={() => setReceiptPickerOpen(false)}>Cancel</button></div>}</div>{openedReceiptJobId ? <div className="receipt-detail"><button className="ghost compact" onClick={() => setOpenedReceiptJobId('')}>Back to receipt jobs</button><h2>{jobs.find((job) => job.id === openedReceiptJobId)?.title ?? 'Receipts'}</h2><div className="receipt-list">{receipts.filter((receipt) => receipt.job_id === openedReceiptJobId).length ? receipts.filter((receipt) => receipt.job_id === openedReceiptJobId).map((receipt) => <article className="receipt-card" key={receipt.id}><button className="receipt-open" onClick={() => openReceipt(receipt)}><span>{receipt.mime_type?.startsWith('image/') ? 'Photo receipt' : 'Receipt file'}</span><div><strong>{receipt.file_name}</strong><p>{formatFullDate(new Date(receipt.created_at))}</p></div></button><div className="receipt-actions"><button className="text-button" onClick={() => void shareReceipt(receipt)}>Share</button><button className="text-button" onClick={() => void downloadReceipt(receipt)}>Download</button><button className="text-button delete-button" disabled={deletingReceiptId === receipt.id} onClick={() => void deleteReceipt(receipt)}>{deletingReceiptId === receipt.id ? 'Deleting...' : 'Delete'}</button></div></article>) : <div className="empty">No receipts for this job yet.</div>}</div></div> : <div className="receipt-job-list">{jobs.length ? jobs.map((job) => { const count = receipts.filter((receipt) => receipt.job_id === job.id).length; return <button className="receipt-job-card" key={job.id} onClick={() => setOpenedReceiptJobId(job.id)}><div><strong>{job.title}</strong><span>{job.client_name}</span></div><b>{count} {count === 1 ? 'receipt' : 'receipts'}</b></button>; }) : <div className="empty">No jobs yet. Add a job before saving receipts.</div>}</div>}</section>}
    {tab === 'assistant' && <section className="assistant-page"><div className="assistant-intro"><p className="kicker">RIDGEPOINT ASSISTANT</p><h1>How can I help?</h1><p>Ask about your RidgePoint jobs, task notes, and your time entries.</p></div><div className="assistant-prompts">{['What tasks are still open?', 'What jobs are in progress?', 'Show my most recent time entries.'].map((prompt) => <button className="ghost compact" key={prompt} onClick={() => setAssistantInput(prompt)}>{prompt}</button>)}</div><div className="assistant-thread" aria-live="polite">{assistantMessages.map((message, index) => <article className={`assistant-message ${message.role}`} key={`${message.role}-${index}`}><strong>{message.role === 'assistant' ? 'RidgePoint' : profile.full_name}</strong><p>{message.content}</p></article>)}{assistantBusy && <article className="assistant-message assistant"><strong>RidgePoint</strong><p>Looking through your RidgePoint information…</p></article>}</div><form className="assistant-compose" onSubmit={askAssistant}><textarea value={assistantInput} onChange={(event) => setAssistantInput(event.target.value)} placeholder="Ask about jobs, task notes, or time…" rows={2} disabled={assistantBusy} /><button disabled={assistantBusy || !assistantInput.trim()}>{assistantBusy ? 'Thinking…' : 'Ask'}</button></form><p className="assistant-note">Answers use RidgePoint information available to your signed-in account. This assistant does not search the public web.</p></section>}
    {printMode && <section className="print-sheet">
      <div className="preview-bar"><strong>Print-ready preview</strong><button className="text-button" onClick={() => setPrintMode(null)}>Close preview</button></div>
      <div className="print-document" ref={printDocumentRef}>
        <div className="print-header">
          <div className="print-brand">
            <img className="print-logo" src="/ridgepoint-remodeling-logo.png" alt="RidgePoint Remodeling" />
            <div>
              <p className="print-eyebrow">{printMode === 'jobs' ? 'JOB-HOUR SUMMARY' : 'PAYROLL TIMESHEET'}</p>
              <h1>{viewedTimesheetEmployee?.full_name ?? profile.full_name}</h1>
              <p className="print-period">Pay period: {formatDate(start)} - {formatDate(end)}</p>
            </div>
          </div>
          <div className="print-meta">
            <span>Submitted</span><strong>{formatFullDate(new Date())}</strong>
            <span>Pay schedule</span><strong>Two weeks, Thursday through Wednesday</strong>
          </div>
        </div>
        {printMode === 'jobs' ? <>
          <h2>Job-hour summary</h2>
          {jobTotals.map((job) => <div className="print-row" key={job.title}><span>{job.title}</span><b>{job.hours.toFixed(2)} h</b></div>)}
          <div className="print-total print-total-bottom"><strong>{hours.toFixed(2)}</strong><span>Total hours across all jobs</span></div>
        </> : <>
          <div className="print-time-table"><div className="print-time-head"><span>Date</span><span>Time worked</span><span>Break</span><span>Hours</span></div>{printableDays.length ? printableDays.map((day) => <div className={`print-time-row ${day.off ? 'print-off-row' : ''}`} key={day.day}><div><strong>{formatDate(new Date(`${day.day}T12:00:00`))}</strong><small>{formatWeekday(new Date(`${day.day}T12:00:00`))}</small></div><div>{day.off ? <span>Off</span> : day.entries.map((entry) => <span key={entry.id}>{formatTime(entry.clock_in)} - {entry.clock_out ? formatTime(entry.clock_out) : 'Open'}</span>)}</div><div>{day.off ? '-' : `${Math.round(day.entries.reduce((total, entry) => total + (entry.paused_seconds ?? 0), 0) / 60)} min`}</div><b>{day.off ? 'Off' : day.hours.toFixed(2)}</b></div>) : <p className="print-empty">No worked hours or off days entered for this pay period.</p>}</div>
          <div className="print-summary"><div><span>Regular hours</span><strong>{regularHours.toFixed(2)}</strong></div><div><span>Overtime hours</span><strong>{overtimeHours.toFixed(2)}</strong></div><div><span>Gross pay</span><strong>${grossPay.toFixed(2)}</strong></div><div className="print-total"><strong>{hours.toFixed(2)}</strong><span>Total hours</span></div></div>
        </>}
        <p className="print-foot">Generated for payroll review.</p>
      </div>
      {printMode === 'payroll' && <div className="print-export-actions"><button type="button" className="ghost compact" disabled={exportBusy} onClick={() => void shareTimesheet()}>Share</button><button type="button" className="ghost compact" disabled={exportBusy} onClick={() => void saveTimesheetImage()}>Save image</button><button type="button" className="ghost compact" disabled={exportBusy} onClick={() => void saveTimesheetPdf()}>Save PDF</button></div>}
      <button className="wide print-action" onClick={() => window.print()}>Print this timesheet</button>
    </section>}
    {openTaskId && openedJobId && (() => { const task = (tasks[openedJobId] ?? []).find((item) => item.id === openTaskId); if (!task) return null; const draft = taskDraft?.id === task.id ? taskDraft : { id: task.id, suggested_person: task.suggested_person, details: task.details }; const chooseAttachment = (file: File | undefined) => { setAttachmentPickerTaskId(''); void uploadAttachment(task, file); }; return <div className="modal task-modal"><section className={`task-detail-card ${draft.suggested_person ? crewColors[draft.suggested_person] : ''}`}><div className="task-detail-head"><div><p className="kicker">TASK DETAILS</p><h2>{task.title}</h2></div><button className="text-button" onClick={() => { setTaskDraft(null); setOpenTaskId(''); }}>Close</button></div><label>Suggested person<select value={draft.suggested_person} onChange={(event) => setTaskDraft({ ...draft, suggested_person: event.target.value as JobTask['suggested_person'] })}><option value="">Choose later</option><option value="Philip">Philip</option><option value="Jason">Jason</option><option value="Russel">Russel</option></select></label><label>Notes<textarea value={draft.details} placeholder="Add measurements, materials, or anything the crew needs to know." onChange={(event) => setTaskDraft({ ...draft, details: event.target.value })} /></label><div className="attachments"><div><strong>Photos and files</strong><p>Add plans, photos, receipts, or other job documents.</p></div><button type="button" className="attachment-add" disabled={uploadingTaskId === task.id} onClick={() => setAttachmentPickerTaskId(task.id)}>{uploadingTaskId === task.id ? 'Uploading...' : 'Add attachment'}</button>{attachmentPickerTaskId === task.id && <div className="attachment-picker"><strong>Choose what to add</strong><div><label className="upload-control"><span>Photos</span><input type="file" accept="image/*" onChange={(event) => { chooseAttachment(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label><label className="upload-control"><span>Camera</span><input type="file" accept="image/*" capture="environment" onChange={(event) => { chooseAttachment(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label><label className="upload-control"><span>File</span><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(event) => { chooseAttachment(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label></div><button type="button" className="text-button" onClick={() => setAttachmentPickerTaskId('')}>Cancel</button></div>}{(attachments[task.id] ?? []).length ? <div className="attachment-list">{(attachments[task.id] ?? []).map((attachment) => <article className="attachment" key={attachment.id}><button className="attachment-open" onClick={() => openAttachment(attachment)}><span>{attachment.mime_type?.startsWith('image/') ? 'Photo' : 'File'}</span><strong>{attachment.file_name}</strong><small>{(attachment.file_size / 1_048_576).toFixed(1)} MB</small></button><button type="button" className="text-button delete-button attachment-delete" disabled={deletingAttachmentId === attachment.id} onClick={() => void deleteAttachment(attachment)}>{deletingAttachmentId === attachment.id ? 'Deleting...' : 'Delete'}</button></article>)}</div> : <p className="attachment-empty">No files attached yet.</p>}</div><button className="wide" onClick={() => saveAndCloseTask(task)}>Save and Close</button></section></div>; })()}
    {timeEditor && <div className="modal"><form className="modal-card time-editor-card" onSubmit={saveHours}><h2>{timeEditor.entry ? 'Adjust hours' : 'Add time'}</h2><label>Day<input type="date" value={timeEditor.day} min={start.toISOString().slice(0, 10)} max={end.toISOString().slice(0, 10)} onChange={(event) => setTimeEditor({ ...timeEditor, day: event.target.value })} required /></label>{!timeEditor.entry && <label>Day type<select value={timeEditor.kind} onChange={(event) => setTimeEditor({ ...timeEditor, kind: event.target.value as 'worked' | 'off' })}><option value="worked">Worked</option><option value="off">Off</option></select></label>}{timeEditor.kind === 'off' ? <p className="off-day-note">This day will appear as Off in the current pay period. No work hours will be added.</p> : <div className="time-block-editor">{timeEditor.blocks.map((block, index) => <div className="time-block-form" key={index}><div className="time-block-form-head"><strong>{timeEditor.blocks.length === 1 ? 'Time worked' : `Time block ${index + 1}`}</strong>{timeEditor.blocks.length > 1 && <button type="button" className="text-button delete-button" onClick={() => removeTimeBlock(index)}>Remove</button>}</div><label>Job<select value={block.jobId} onChange={(event) => updateTimeBlock(index, { jobId: event.target.value })}><option value="">Choose a job</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label><div className="time-fields"><label>Start time<input type="time" value={block.startTime} onChange={(event) => updateTimeBlock(index, { startTime: event.target.value })} required /></label><label>End time<input type="time" value={block.endTime} onChange={(event) => updateTimeBlock(index, { endTime: event.target.value })} required /></label></div><label>Break<select value={block.breakMinutes} onChange={(event) => updateTimeBlock(index, { breakMinutes: event.target.value })}><option value="0">No break</option><option value="15">15 minutes</option><option value="30">30 minutes - lunch</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="custom">Custom time range</option></select></label>{block.breakMinutes === 'custom' && <div className="time-fields break-range"><label>Break starts<input type="time" value={block.breakStart} onChange={(event) => updateTimeBlock(index, { breakStart: event.target.value })} required /></label><label>Break ends<input type="time" value={block.breakEnd} onChange={(event) => updateTimeBlock(index, { breakEnd: event.target.value })} required /></label></div>}<p className="break-summary">Lunch deducted: <strong>{block.breakMinutes === 'custom' ? `${block.breakStart} - ${block.breakEnd} (${Math.round(minutesBetween(timeEditor.day, block.breakStart, block.breakEnd))} min)` : `${block.breakMinutes} min`}</strong></p><p className="time-calculation">Block hours: <strong>{hoursBetween(timeEditor.day, block.startTime, block.endTime, block.breakMinutes === 'custom' ? minutesBetween(timeEditor.day, block.breakStart, block.breakEnd) : Number(block.breakMinutes)).toFixed(2)} h</strong></p></div>)}{!timeEditor.entry && <button type="button" className="ghost add-time-block" onClick={addTimeBlock}>+ Add time block</button>}<p className="day-total">Day total: <strong>{timeEditor.blocks.reduce((total, block) => total + hoursBetween(timeEditor.day, block.startTime, block.endTime, block.breakMinutes === 'custom' ? minutesBetween(timeEditor.day, block.breakStart, block.breakEnd) : Number(block.breakMinutes)), 0).toFixed(2)} h</strong></p></div>}<div className="modal-actions"><button type="button" className="ghost" onClick={() => setTimeEditor(null)}>Cancel</button><button>{timeEditor.kind === 'off' ? 'Save Off day' : timeEditor.blocks.length > 1 ? 'Save all time blocks' : 'Save hours'}</button></div></form></div>}
    {showAccount && <div className="modal"><section className="modal-card account-card"><div><p className="kicker">ACCOUNT SECURITY</p><h2>Update sign-in</h2><p className="account-helper">We verify the email already connected to this account before making changes.</p></div>{!accountVerified ? <div className="account-recovery">{accountLinkSent ? <p>Check your email and open the secure reset link. It will bring you back here to finish updating your account.</p> : <p>We will send a secure, single-use reset link to your current email address.</p>}<button disabled={accountBusy} onClick={() => void sendAccountRecoveryLink()}>{accountBusy ? 'Sending link...' : accountLinkSent ? 'Send another link' : 'Email me a reset link'}</button></div> : <form onSubmit={saveAccount}><label>Display name<input value={accountForm.fullName} onChange={(event) => setAccountForm({ ...accountForm, fullName: event.target.value })} required /></label><label>New sign-in email<input type="email" value={accountForm.email} onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })} required /></label><label>New password <small>Leave blank to keep the current password.</small><input type="password" autoComplete="new-password" value={accountForm.password} onChange={(event) => setAccountForm({ ...accountForm, password: event.target.value })} /></label><label>Confirm new password<input type="password" autoComplete="new-password" value={accountForm.confirmPassword} onChange={(event) => setAccountForm({ ...accountForm, confirmPassword: event.target.value })} /></label><div className="modal-actions"><button type="button" className="ghost" onClick={() => setShowAccount(false)}>Cancel</button><button disabled={accountBusy}>{accountBusy ? 'Saving...' : 'Save account'}</button></div></form>}<button className="text-button account-close" onClick={() => setShowAccount(false)}>Close</button></section></div>}
    {showJobForm && <div className="modal"><form className="modal-card" onSubmit={saveJob}><h2>{editingJob ? 'Edit job' : 'Add pending job'}</h2><label>Job name<input value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} required /></label><label>Customer<input value={jobForm.client_name} onChange={(e) => setJobForm({ ...jobForm, client_name: e.target.value })} required /></label><label>Address<input value={jobForm.address} onChange={(e) => setJobForm({ ...jobForm, address: e.target.value })} /></label><label>Task color<select value={jobForm.color} onChange={(e) => setJobForm({ ...jobForm, color: e.target.value as JobColor })}>{Object.entries(COLORS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label><label>Job status<input value={jobForm.status} onChange={(e) => setJobForm({ ...jobForm, status: e.target.value })} required /></label><div className="modal-actions"><button type="button" className="ghost" onClick={() => { setEditingJob(null); setShowJobForm(false); }}>Cancel</button><button>{editingJob ? 'Save job' : 'Add job'}</button></div></form></div>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
