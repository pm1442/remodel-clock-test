import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import './styles.css';

type JobColor = 'green' | 'blue' | 'orange' | 'red';
type Job = { id: string; title: string; client_name: string; address: string | null; color: JobColor; status: string; archived: boolean };
type TimeEntry = { id: string; employee_id: string; job_id: string; clock_in: string; clock_out: string | null; paused_at: string | null; paused_seconds: number; jobs: { title: string }[] | null };
type Profile = { id: string; company_id: string; full_name: string; role: 'owner' | 'employee' };
type JobTask = { id: string; job_id: string; title: string; suggested_person: '' | 'Philip' | 'Jason' | 'Russel'; details: string; completed: boolean };
type TaskAttachment = { id: string; task_id: string; file_name: string; file_path: string; mime_type: string | null; file_size: number; created_at: string };

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
function formatTime(value: string) { return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value)); }

function SignIn({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError || !data.session) setError(signInError?.message ?? 'Unable to sign in.');
    else onSignedIn(data.session);
  }
  return <main className="signin-shell"><section className="signin-card"><div className="wordmark">RIDGEPOINT</div><h1>Remodel Clock</h1><p>Sign in to see jobs and clock time for RidgePoint Remodeling.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>{error && <p className="form-error">{error}</p>}<button disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button></form></section></main>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [active, setActive] = useState<TimeEntry | null>(null);
  const [tab, setTab] = useState<'jobs' | 'clock' | 'timesheet'>('jobs');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [openedJobId, setOpenedJobId] = useState('');
  const [crewColors, setCrewColors] = useState({ Philip: 'burgundy', Jason: 'blue', Russel: 'green' });
  const [tasks, setTasks] = useState<Record<string, JobTask[]>>({});
  const [attachments, setAttachments] = useState<Record<string, TaskAttachment[]>>({});
  const [showJobTotals, setShowJobTotals] = useState(false);
  const [openTaskId, setOpenTaskId] = useState('');
  const [taskDraft, setTaskDraft] = useState<{ id: string; suggested_person: JobTask['suggested_person']; details: string } | null>(null);
  const [uploadingTaskId, setUploadingTaskId] = useState('');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [timeEditor, setTimeEditor] = useState<{ entry: TimeEntry | null; day: string; hours: string; jobId: string } | null>(null);
  const [printMode, setPrintMode] = useState<'payroll' | 'jobs' | null>(null);
  const [showJobForm, setShowJobForm] = useState(false);
  const [jobForm, setJobForm] = useState({ title: '', client_name: '', address: '', color: 'green' as JobColor, status: 'Ready to start' });
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh(userId = session?.user.id) {
    if (!userId) return;
    setLoading(true);
    const { data: profileData, error: profileError } = await supabase.from('profiles').select('id, company_id, full_name, role').eq('id', userId).single();
    if (profileError || !profileData) { setNotice(`Profile could not load: ${profileError?.message ?? 'No matching profile was returned.'}`); setLoading(false); return; }
    setProfile(profileData as Profile);
    const [{ data: jobData }, { data: entryData }, { data: activeData }, { data: taskData }, { data: attachmentData }] = await Promise.all([
      supabase.from('jobs').select('id, title, client_name, address, color, status, archived').eq('company_id', profileData.company_id).eq('archived', false).order('created_at', { ascending: false }),
      supabase.from('time_entries').select('id, employee_id, job_id, clock_in, clock_out, paused_at, paused_seconds, jobs(title)').eq('employee_id', userId).order('clock_in', { ascending: false }),
      supabase.from('time_entries').select('id, employee_id, job_id, clock_in, clock_out, paused_at, paused_seconds, jobs(title)').eq('employee_id', userId).is('clock_out', null).maybeSingle(),
      supabase.from('job_tasks').select('id, job_id, title, suggested_person, details, completed').eq('company_id', profileData.company_id).order('created_at'),
      supabase.from('job_task_attachments').select('id, task_id, file_name, file_path, mime_type, file_size, created_at').eq('company_id', profileData.company_id).order('created_at'),
    ]);
    const loadedActive = (activeData ?? null) as TimeEntry | null;
    const loadedJobs = (jobData ?? []) as Job[];
    const taskGroups = ((taskData ?? []) as JobTask[]).reduce<Record<string, JobTask[]>>((all, task) => { (all[task.job_id] ??= []).push(task); return all; }, {});
    const attachmentGroups = ((attachmentData ?? []) as TaskAttachment[]).reduce<Record<string, TaskAttachment[]>>((all, attachment) => { (all[attachment.task_id] ??= []).push(attachment); return all; }, {});
    setTasks(taskGroups); setAttachments(attachmentGroups); setJobs(loadedJobs); setEntries((entryData ?? []) as TimeEntry[]); setActive(loadedActive);
    // An open shift always wins: its job must never change just because the app refreshed.
    setSelectedJobId((previous) => loadedActive?.job_id ?? previous ?? loadedJobs[0]?.id ?? ''); setLoading(false);
  }

  useEffect(() => { supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) refresh(data.session.user.id); else setLoading(false); }); const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); if (next) refresh(next.user.id); else { setProfile(null); setJobs([]); setEntries([]); } }); return () => listener.subscription.unsubscribe(); }, []);
  useEffect(() => { if (!profile) return; const channel = supabase.channel('ridgepoint-jobs').on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `company_id=eq.${profile.company_id}` }, () => refresh()).subscribe(); return () => { supabase.removeChannel(channel); }; }, [profile?.company_id]);

  const currentJob = jobs.find((job) => job.id === selectedJobId);
  const activeJob = active ? jobs.find((job) => job.id === active.job_id) : undefined;
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
  const hours = periodEntries.reduce((total, entry) => total + toHours(entry), 0);
  const jobTitle = (entry: TimeEntry) => jobs.find((job) => job.id === entry.job_id)?.title ?? 'Unassigned job';
  const jobTotals = useMemo(() => Object.values(periodEntries.reduce<Record<string, { title: string; hours: number }>>((total, entry) => { const title = jobTitle(entry); const current = total[entry.job_id] ?? { title, hours: 0 }; current.hours += toHours(entry); total[entry.job_id] = current; return total; }, {})), [periodEntries, jobs]);
  const weekOneEnd = new Date(start); weekOneEnd.setDate(weekOneEnd.getDate() + 7);
  const weekOneHours = periodEntries.filter((entry) => new Date(entry.clock_in) < weekOneEnd).reduce((total, entry) => total + toHours(entry), 0);
  const weekTwoHours = hours - weekOneHours;
  const overtimeHours = Math.max(0, weekOneHours - 40) + Math.max(0, weekTwoHours - 40);
  const regularHours = hours - overtimeHours;
  const grossPay = regularHours * 35 + overtimeHours * 52.5;
  function printTimesheet(mode: 'payroll' | 'jobs') { setPrintMode(mode); }

  async function addJob(event: FormEvent) {
    event.preventDefault(); if (!profile) return;
    const { error } = await supabase.from('jobs').insert({ ...jobForm, company_id: profile.company_id });
    if (error) setNotice(error.message); else { setJobForm({ title: '', client_name: '', address: '', color: 'green', status: 'Ready to start' }); setShowJobForm(false); await refresh(); }
  }
  async function clockIn() { if (!profile || !selectedJobId) return setNotice('Choose a job first.'); const { error } = await supabase.from('time_entries').insert({ company_id: profile.company_id, employee_id: profile.id, job_id: selectedJobId, clock_in: new Date().toISOString() }); if (error) setNotice(error.message); else await refresh(); }
  async function pauseClock() { if (!active || active.paused_at) return; const { error } = await supabase.from('time_entries').update({ paused_at: new Date().toISOString() }).eq('id', active.id); if (error) setNotice(error.message); else await refresh(); }
  async function resumeClock() { if (!active || !active.paused_at) return; const { error } = await supabase.from('time_entries').update({ paused_at: null, paused_seconds: (active.paused_seconds ?? 0) + currentPauseSeconds(active) }).eq('id', active.id); if (error) setNotice(error.message); else await refresh(); }
  async function clockOut() { if (!active) return; const { error } = await supabase.from('time_entries').update({ clock_out: new Date().toISOString(), paused_at: null, paused_seconds: (active.paused_seconds ?? 0) + currentPauseSeconds(active) }).eq('id', active.id); if (error) setNotice(error.message); else await refresh(); }
  function adjust(entry: TimeEntry) { setTimeEditor({ entry, day: entry.clock_in.slice(0, 10), hours: toHours(entry).toFixed(2), jobId: entry.job_id }); }
  function addHours() { setTimeEditor({ entry: null, day: start.toISOString().slice(0, 10), hours: '', jobId: selectedJobId }); }
  async function saveHours(event: FormEvent) { event.preventDefault(); if (!profile || !timeEditor || !timeEditor.jobId || !Number(timeEditor.hours)) return setNotice('Choose a job and enter hours.'); const startAt = new Date(`${timeEditor.day}T08:00:00`).toISOString(); const endAt = new Date(new Date(startAt).getTime() + Number(timeEditor.hours) * 3_600_000).toISOString(); const query = timeEditor.entry ? supabase.from('time_entries').update({ job_id: timeEditor.jobId, clock_in: startAt, clock_out: endAt, edited_at: new Date().toISOString() }).eq('id', timeEditor.entry.id) : supabase.from('time_entries').insert({ company_id: profile.company_id, employee_id: profile.id, job_id: timeEditor.jobId, clock_in: startAt, clock_out: endAt, edited_at: new Date().toISOString() }); const { error } = await query; if (error) setNotice(error.message); else { setTimeEditor(null); await refresh(); } }
  async function addTask(jobId: string) { if (!profile) return; const title = window.prompt('Task note'); if (!title) return; const { error } = await supabase.from('job_tasks').insert({ company_id: profile.company_id, job_id: jobId, title }); if (error) setNotice(error.message); else await refresh(); }
  async function updateTask(task: JobTask, changes: Partial<JobTask>) { const { error } = await supabase.from('job_tasks').update(changes).eq('id', task.id); if (error) setNotice(error.message); else await refresh(); }
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
    if (uploadError) { setUploadingTaskId(''); return setNotice(uploadError.message); }
    const { error: recordError } = await supabase.from('job_task_attachments').insert({ company_id: profile.company_id, task_id: task.id, file_name: file.name, file_path: filePath, mime_type: file.type || null, file_size: file.size });
    setUploadingTaskId('');
    if (recordError) setNotice(recordError.message); else await refresh();
  }
  async function openAttachment(attachment: TaskAttachment) {
    const { data, error } = await supabase.storage.from('task-attachments').createSignedUrl(attachment.file_path, 120);
    if (error || !data?.signedUrl) setNotice(error?.message ?? 'Could not open that file.'); else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }
  async function signOut() { await supabase.auth.signOut(); }

  if (!session) return <SignIn onSignedIn={setSession} />;
  if (loading) return <main className="loading">Loading RidgePoint Remodel Clock...</main>;
  if (!profile) return <main className="loading"><p>{notice}</p><button onClick={signOut}>Sign out</button></main>;
  return <main className="app-shell"><header><div><div className="wordmark">RIDGEPOINT</div><span>Remodel Clock</span></div><div className="user"><strong>{profile.full_name}</strong><button className="text-button" onClick={signOut}>Sign out</button></div></header><nav>{(['jobs', 'clock', 'timesheet'] as const).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item === 'jobs' ? 'Jobs' : item === 'clock' ? 'Time clock' : 'Timesheet'}</button>)}</nav>{notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>Dismiss</button></div>}
    {tab === 'jobs' && <section>
      {openedJobId ? <>
        <button className="ghost" onClick={() => setOpenedJobId('')}>Back to jobs</button>
        <p className="kicker">PO JOB NOTES</p><h1>{jobs.find((job) => job.id === openedJobId)?.title}</h1>
        <button onClick={() => addTask(openedJobId)}>Add note</button>
        <div className="task-notes">
          {(tasks[openedJobId] ?? []).map((task) => <article className={`task-note ${task.suggested_person ? crewColors[task.suggested_person] : ''} ${task.completed ? 'done' : ''}`} key={task.id}>
            <button className="task-open" onClick={() => { setTaskDraft({ id: task.id, suggested_person: task.suggested_person, details: task.details }); setOpenTaskId(task.id); }}><span>{task.title}</span><small>{task.completed ? 'Completed' : 'Open'}</small></button>
            <div className="task-row-actions">{task.suggested_person && <span className={`crew-tag ${crewColors[task.suggested_person]}`}>{task.suggested_person}</span>}<button className="text-button" onClick={() => updateTask(task, { completed: !task.completed })}>{task.completed ? 'Reopen' : 'Complete'}</button></div>
          </article>)}
          {!(tasks[openedJobId]?.length) && <div className="empty">No notes yet. Add the first job note.</div>}
        </div>
      </> : <><div className="section-head"><div><p className="kicker">JOB BOARD</p><h1>Pending jobs</h1></div><button onClick={() => setShowJobForm(true)}>Add job</button></div><div className="crew-panel"><strong>Demo crew color key</strong>{(Object.keys(crewColors) as (keyof typeof crewColors)[]).map((name) => <label key={name}>{name}<select value={crewColors[name]} onChange={(event) => setCrewColors({ ...crewColors, [name]: event.target.value })}><option value="burgundy">Burgundy</option><option value="blue">Blue</option><option value="green">Green</option><option value="orange">Orange</option><option value="purple">Purple</option></select></label>)}</div><div className="job-grid">{jobs.length ? jobs.map((job) => <article className="job" key={job.id} onClick={() => { setSelectedJobId(job.id); setOpenedJobId(job.id); }}><span className={`color ${COLORS[job.color].className}`}></span><div><h2>{job.title}</h2><p>{job.client_name}{job.address ? ` | ${job.address}` : ''}</p><small className={COLORS[job.color].className}>{job.status}</small></div><b>›</b></article>) : <div className="empty">No jobs yet. Add the first pending job.</div>}</div></>}
    </section>}
    {tab === 'clock' && <section className="clock"><p className="kicker">TIME CLOCK</p><h1>{active ? (active.paused_at ? 'Your clock is paused' : 'You are clocked in') : 'Clock time'}</h1><div className="clock-status"><small>{active?.paused_at ? 'CLOCK PAUSED' : active ? 'CLOCKED IN AT' : 'SELECT A JOB'}</small><strong>{active ? formatTime(active.clock_in) : 'Ready when you are'}</strong><span>{active ? activeJob?.title ?? 'Current job' : currentJob?.title ?? 'Choose a job below.'}</span></div>{!active && <label className="job-select">Working on<select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}><option value="">Select a job</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title} - {job.client_name}</option>)}</select></label>}{active ? <div className="clock-actions"><button className="ghost" onClick={active.paused_at ? resumeClock : pauseClock}>{active.paused_at ? 'Resume clock' : 'Pause clock'}</button><button onClick={clockOut}>Clock out</button></div> : <button className="wide" onClick={clockIn}>Clock in</button>}<p className="helper">Your selected job is locked for this shift. Pause time for lunch or an interruption; paused time is not counted.</p></section>}
    {tab === 'timesheet' && <section><p className="kicker">{isPastPeriod ? 'PAST PAY PERIOD' : 'CURRENT PAY PERIOD'}</p><h1>{formatDate(start)} - {formatDate(end)}</h1><p className="period-note">Two weeks, Thursday through Wednesday</p><label className="period-picker">View pay period<select value={periodOffset} onChange={(event) => setPeriodOffset(Number(event.target.value))}>{periodOptions.map((period) => <option key={period.offset} value={period.offset}>{period.offset === 0 ? 'Current: ' : ''}{formatDate(period.start)} - {formatDate(period.end)}</option>)}</select></label>{isPastPeriod && <p className="past-period-note">Past pay period. Only the account owner can add or adjust these hours.</p>}<div className="hours"><strong>{hours.toFixed(2)}</strong><span>Total hours</span></div><div className="overtime-summary"><span>Regular: {regularHours.toFixed(2)} h</span><span>Overtime: {overtimeHours.toFixed(2)} h</span></div><div className="timesheet-actions">{canEditPeriod && <button onClick={addHours}>Add hours for a day</button>}<button className="ghost compact" onClick={() => setShowJobTotals(!showJobTotals)}>{showJobTotals ? 'Hide job breakdown' : 'View hours by job'}</button></div>{showJobTotals && <div className="job-breakdown"><strong>Hours by job</strong>{jobTotals.map((job) => <div key={job.title}><span>{job.title}</span><b>{job.hours.toFixed(2)} h</b></div>)}</div>}<div className="entries">{periodEntries.length ? periodEntries.map((entry) => <article className="entry" key={entry.id}><div><h2>{jobTitle(entry)}</h2><p>{formatDate(new Date(entry.clock_in))} | {formatTime(entry.clock_in)}{entry.clock_out ? ` - ${formatTime(entry.clock_out)}` : ' - still clocked in'}</p></div><div><strong>{toHours(entry).toFixed(2)} h</strong>{entry.clock_out && canEditPeriod && <button className="text-button" onClick={() => adjust(entry)}>Adjust hours</button>}</div></article>) : <div className="empty">No time entered in this pay period.</div>}</div><div className="timesheet-actions"><button className="wide ghost" onClick={() => printTimesheet('payroll')}>Print/share payroll timesheet</button><button className="wide ghost" onClick={() => printTimesheet('jobs')}>Print/share job-hour summary</button></div></section>}
    {printMode && <section className="print-sheet"><div className="preview-bar"><strong>Print-ready preview</strong><button className="text-button" onClick={() => setPrintMode(null)}>Close preview</button></div><div className="wordmark">RIDGEPOINT REMODELING</div>{printMode === 'jobs' ? <><h1>Hours by job - {profile.full_name}</h1><p>{formatDate(start)} - {formatDate(end)} | Two-week pay period</p><div className="print-total"><strong>{hours.toFixed(2)}</strong><span>Total hours across all jobs</span></div><h2>Job-hour summary</h2>{jobTotals.map((job) => <div className="print-row" key={job.title}><span>{job.title}</span><b>{job.hours.toFixed(2)} h</b></div>)}</> : <><h1>Timesheet - {profile.full_name}</h1><p>{formatDate(start)} - {formatDate(end)} | Two-week pay period</p><div className="print-total"><strong>{hours.toFixed(2)}</strong><span>Total hours</span></div><div className="print-grid"><span>Regular hours</span><b>{regularHours.toFixed(2)}</b><span>Overtime hours</span><b>{overtimeHours.toFixed(2)}</b><span>Hourly rate</span><b>$35.00</b><span>Overtime rate</span><b>$52.50</b><span>Estimated gross pay</span><b>${grossPay.toFixed(2)}</b></div></>}<p className="print-foot">Generated for payroll review.</p><button className="wide print-action" onClick={() => window.print()}>Print this timesheet</button></section>}
    {openTaskId && openedJobId && (() => { const task = (tasks[openedJobId] ?? []).find((item) => item.id === openTaskId); if (!task) return null; const draft = taskDraft?.id === task.id ? taskDraft : { id: task.id, suggested_person: task.suggested_person, details: task.details }; return <div className="modal task-modal"><section className={`task-detail-card ${draft.suggested_person ? crewColors[draft.suggested_person] : ''}`}><div className="task-detail-head"><div><p className="kicker">TASK DETAILS</p><h2>{task.title}</h2></div><button className="text-button" onClick={() => { setTaskDraft(null); setOpenTaskId(''); }}>Close</button></div><label>Suggested person<select value={draft.suggested_person} onChange={(event) => setTaskDraft({ ...draft, suggested_person: event.target.value as JobTask['suggested_person'] })}><option value="">Choose later</option><option value="Philip">Philip</option><option value="Jason">Jason</option><option value="Russel">Russel</option></select></label><label>Notes<textarea value={draft.details} placeholder="Add measurements, materials, or anything the crew needs to know." onChange={(event) => setTaskDraft({ ...draft, details: event.target.value })} /></label><div className="attachments"><div><strong>Photos and files</strong><p>Add plans, photos, receipts, or other job documents.</p></div><label className="upload-control"><span>{uploadingTaskId === task.id ? 'Uploading...' : 'Add photo or file'}</span><input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" disabled={uploadingTaskId === task.id} onChange={(event) => { void uploadAttachment(task, event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>{(attachments[task.id] ?? []).length ? <div className="attachment-list">{(attachments[task.id] ?? []).map((attachment) => <button className="attachment" key={attachment.id} onClick={() => openAttachment(attachment)}><span>{attachment.mime_type?.startsWith('image/') ? 'Photo' : 'File'}</span><strong>{attachment.file_name}</strong><small>{(attachment.file_size / 1_048_576).toFixed(1)} MB</small></button>)}</div> : <p className="attachment-empty">No files attached yet.</p>}</div><button className="wide" onClick={() => saveAndCloseTask(task)}>Save and Close</button></section></div>; })()}
    {timeEditor && <div className="modal"><form className="modal-card" onSubmit={saveHours}><h2>{timeEditor.entry ? 'Adjust hours' : 'Add hours'}</h2><label>Day<input type="date" value={timeEditor.day} min={start.toISOString().slice(0, 10)} max={end.toISOString().slice(0, 10)} onChange={(event) => setTimeEditor({ ...timeEditor, day: event.target.value })} required /></label><label>Job<select value={timeEditor.jobId} onChange={(event) => setTimeEditor({ ...timeEditor, jobId: event.target.value })}><option value="">Choose a job</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label><label>Hours<input type="number" step="0.25" min="0" value={timeEditor.hours} onChange={(event) => setTimeEditor({ ...timeEditor, hours: event.target.value })} required /></label><div className="modal-actions"><button type="button" className="ghost" onClick={() => setTimeEditor(null)}>Cancel</button><button>Save hours</button></div></form></div>}
    {showJobForm && <div className="modal"><form className="modal-card" onSubmit={addJob}><h2>Add pending job</h2><label>Job name<input value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} required /></label><label>Customer<input value={jobForm.client_name} onChange={(e) => setJobForm({ ...jobForm, client_name: e.target.value })} required /></label><label>Address<input value={jobForm.address} onChange={(e) => setJobForm({ ...jobForm, address: e.target.value })} /></label><label>Task color<select value={jobForm.color} onChange={(e) => setJobForm({ ...jobForm, color: e.target.value as JobColor })}>{Object.entries(COLORS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label><div className="modal-actions"><button type="button" className="ghost" onClick={() => setShowJobForm(false)}>Cancel</button><button>Add job</button></div></form></div>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
