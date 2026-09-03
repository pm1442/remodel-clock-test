import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type JobColor = 'green' | 'blue' | 'orange' | 'red';
type Job = { id: string; title: string; client: string; address: string; color: JobColor; status: string };
type Entry = { id: string; jobId: string; jobTitle: string; date: string; start: string; end: string; hours: number };

const PALETTE: Record<JobColor, { background: string; text: string; label: string }> = {
  green: { background: '#DDF3E5', text: '#185C37', label: 'Ready' },
  blue: { background: '#DCEBF8', text: '#155C88', label: 'In progress' },
  orange: { background: '#FCE7C8', text: '#8D4B09', label: 'Waiting' },
  red: { background: '#F9DDE0', text: '#8C2531', label: 'Urgent' },
};

const INITIAL_JOBS: Job[] = [
  { id: '1', title: 'Kitchen remodel', client: 'Miller residence', address: '142 Pine Street', color: 'blue', status: 'Cabinets and trim' },
  { id: '2', title: 'Primary bath update', client: 'Cruz residence', address: '80 East Ridge Road', color: 'green', status: 'Ready to start' },
  { id: '3', title: 'Basement finish', client: 'Franklin residence', address: '18 Oak Lane', color: 'orange', status: 'Waiting on inspection' },
  { id: '4', title: 'Deck rebuild', client: 'Harris residence', address: '326 Meadow Drive', color: 'red', status: 'Material delivery today' },
];

const INITIAL_ENTRIES: Entry[] = [
  { id: 'e1', jobId: '1', jobTitle: 'Kitchen remodel', date: 'Tue, Aug 26', start: '7:04 AM', end: '3:32 PM', hours: 8.47 },
  { id: 'e2', jobId: '3', jobTitle: 'Basement finish', date: 'Wed, Aug 27', start: '7:00 AM', end: '3:30 PM', hours: 8.5 },
];

function Button({ label, onPress, tone = 'primary', icon }: { label: string; onPress: () => void; tone?: 'primary' | 'soft'; icon?: keyof typeof Ionicons.glyphMap }) {
  return <Pressable onPress={onPress} style={[styles.button, tone === 'soft' && styles.softButton]}>
    {icon && <Ionicons name={icon} size={18} color={tone === 'primary' ? '#FFFFFF' : '#802931'} />}
    <Text style={[styles.buttonText, tone === 'soft' && styles.softButtonText]}>{label}</Text>
  </Pressable>;
}

export default function App() {
  const [tab, setTab] = useState<'jobs' | 'clock' | 'timesheet'>('jobs');
  const [jobs, setJobs] = useState(INITIAL_JOBS);
  const [entries, setEntries] = useState(INITIAL_ENTRIES);
  const [selectedJobId, setSelectedJobId] = useState('1');
  const [activeEntry, setActiveEntry] = useState<Entry | null>(null);
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [newJob, setNewJob] = useState({ title: '', client: '', address: '', color: 'green' as JobColor });
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);

  const total = useMemo(() => entries.reduce((sum, entry) => sum + entry.hours, 0) + (activeEntry ? 0 : 0), [entries, activeEntry]);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];

  function clockIn() {
    const now = new Date();
    const entry: Entry = { id: String(Date.now()), jobId: selectedJob.id, jobTitle: selectedJob.title, date: 'Today', start: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), end: '', hours: 0 };
    setActiveEntry(entry);
  }
  function clockOut() {
    if (!activeEntry) return;
    const finish = new Date();
    const updated = { ...activeEntry, end: finish.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), hours: 8 };
    setEntries([updated, ...entries]);
    setActiveEntry(null);
  }
  function addJob() {
    if (!newJob.title.trim() || !newJob.client.trim()) return Alert.alert('Add a job name and customer first.');
    setJobs([{ id: String(Date.now()), title: newJob.title.trim(), client: newJob.client.trim(), address: newJob.address.trim() || 'Address not added', color: newJob.color, status: PALETTE[newJob.color].label }, ...jobs]);
    setNewJob({ title: '', client: '', address: '', color: 'green' });
    setAddJobOpen(false);
  }
  function saveEdit() {
    if (!editing) return;
    setEntries(entries.map((entry) => entry.id === editing.id ? editing : entry));
    setEditOpen(false);
  }

  return <SafeAreaView style={styles.safe}>
    <StatusBar style="dark" />
    <View style={styles.topBar}>
      <View><Text style={styles.brand}>Remodel Clock</Text><Text style={styles.brandSub}>RidgePoint Remodeling</Text></View>
      <View style={styles.avatar}><Text style={styles.avatarText}>PM</Text></View>
    </View>

    {tab === 'jobs' && <View style={styles.screen}>
      <View style={styles.titleRow}><View><Text style={styles.eyebrow}>JOB BOARD</Text><Text style={styles.title}>Pending jobs</Text></View><Button label="Add job" icon="add" onPress={() => setAddJobOpen(true)} /></View>
      <FlatList data={jobs} keyExtractor={(job) => job.id} contentContainerStyle={styles.list} renderItem={({ item }) => <Pressable style={styles.jobRow} onPress={() => { setSelectedJobId(item.id); setTab('clock'); }}>
        <View style={[styles.colorBlock, { backgroundColor: PALETTE[item.color].background }]}><Ionicons name="construct-outline" size={24} color={PALETTE[item.color].text} /></View>
        <View style={styles.jobInfo}><Text style={styles.jobTitle}>{item.title}</Text><Text style={styles.jobMeta}>{item.client}  |  {item.address}</Text><Text style={[styles.status, { color: PALETTE[item.color].text }]}>{item.status}</Text></View>
        <Ionicons name="chevron-forward" size={20} color="#8A938E" />
      </Pressable>} />
    </View>}

    {tab === 'clock' && <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.eyebrow}>TIME CLOCK</Text><Text style={styles.title}>Today</Text>
      <View style={styles.clockCard}><Text style={styles.clockLabel}>{activeEntry ? 'CLOCKED IN' : 'NOT CLOCKED IN'}</Text><Text style={styles.clockTime}>{activeEntry ? activeEntry.start : '7:00 AM'}</Text><Text style={styles.clockJob}>{activeEntry ? activeEntry.jobTitle : 'Choose a job, then start your day.'}</Text></View>
      <Text style={styles.fieldLabel}>Working on</Text>
      <View style={styles.jobPicker}>{jobs.map((job) => <Pressable key={job.id} onPress={() => setSelectedJobId(job.id)} style={[styles.pickJob, selectedJob.id === job.id && styles.pickJobSelected]}><View style={[styles.smallColor, { backgroundColor: PALETTE[job.color].background }]} /><Text style={styles.pickJobText}>{job.title}</Text>{selectedJob.id === job.id && <Ionicons name="checkmark" size={18} color="#802931" />}</Pressable>)}</View>
      <Button label={activeEntry ? 'Clock out' : 'Clock in'} icon={activeEntry ? 'stop-circle-outline' : 'play-circle-outline'} onPress={activeEntry ? clockOut : clockIn} />
      <Text style={styles.helper}>Clocked time is tied to the job you select. You can correct it from your timesheet.</Text>
    </ScrollView>}

    {tab === 'timesheet' && <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.eyebrow}>CURRENT PAY PERIOD</Text><Text style={styles.title}>Aug 21 - Sep 3</Text><Text style={styles.periodNote}>Thursday through Wednesday | 2 weeks</Text>
      <View style={styles.hoursBox}><Text style={styles.hoursValue}>{total.toFixed(2)}</Text><Text style={styles.hoursLabel}>total hours</Text></View>
      {entries.map((entry) => <View style={styles.entry} key={entry.id}><View style={styles.entryInfo}><Text style={styles.entryTitle}>{entry.jobTitle}</Text><Text style={styles.entryMeta}>{entry.date} | {entry.start} - {entry.end}</Text></View><View><Text style={styles.entryHours}>{entry.hours.toFixed(2)} h</Text><Pressable onPress={() => { setEditing(entry); setEditOpen(true); }}><Text style={styles.edit}>Adjust</Text></Pressable></View></View>)}
      <Button label="Create PDF timesheet" icon="document-text-outline" onPress={() => Alert.alert('PDF export', 'The production version will create and share the branded pay-period PDF here.')} />
    </ScrollView>}

    <View style={styles.nav}>{([{ key: 'jobs', label: 'Jobs', icon: 'list-outline' }, { key: 'clock', label: 'Clock', icon: 'time-outline' }, { key: 'timesheet', label: 'Timesheet', icon: 'document-text-outline' }] as const).map((item) => <Pressable key={item.key} style={styles.navItem} onPress={() => setTab(item.key)}><Ionicons name={item.icon} size={23} color={tab === item.key ? '#802931' : '#848484'} /><Text style={[styles.navText, tab === item.key && styles.navTextActive]}>{item.label}</Text></Pressable>)}</View>

    <Modal visible={addJobOpen} transparent animationType="slide"><View style={styles.modalShade}><View style={styles.sheet}><Text style={styles.sheetTitle}>Add pending job</Text><TextInput placeholder="Job name" value={newJob.title} onChangeText={(title) => setNewJob({ ...newJob, title })} style={styles.input} /><TextInput placeholder="Customer name" value={newJob.client} onChangeText={(client) => setNewJob({ ...newJob, client })} style={styles.input} /><TextInput placeholder="Job address" value={newJob.address} onChangeText={(address) => setNewJob({ ...newJob, address })} style={styles.input} /><Text style={styles.fieldLabel}>Color</Text><View style={styles.colorChoices}>{(Object.keys(PALETTE) as JobColor[]).map((color) => <Pressable key={color} onPress={() => setNewJob({ ...newJob, color })} style={[styles.colorChoice, { backgroundColor: PALETTE[color].background }, newJob.color === color && styles.colorChoiceSelected]}><Text style={{ color: PALETTE[color].text }}>{PALETTE[color].label}</Text></Pressable>)}</View><Button label="Save job" onPress={addJob} /><Pressable onPress={() => setAddJobOpen(false)}><Text style={styles.cancel}>Cancel</Text></Pressable></View></View></Modal>
    <Modal visible={editOpen} transparent animationType="slide"><View style={styles.modalShade}><View style={styles.sheet}><Text style={styles.sheetTitle}>Adjust time</Text><Text style={styles.adjustLabel}>{editing?.jobTitle}</Text><TextInput keyboardType="decimal-pad" value={editing?.hours.toString() ?? ''} onChangeText={(value) => setEditing(editing ? { ...editing, hours: Number(value) || 0 } : null)} style={styles.input} /><Text style={styles.helper}>Enter the correct decimal hours. Example: 8.50 for 8 hours 30 minutes.</Text><Button label="Save adjustment" onPress={saveEdit} /><Pressable onPress={() => setEditOpen(false)}><Text style={styles.cancel}>Cancel</Text></Pressable></View></View></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' }, topBar: { height: 72, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF' }, brand: { color: '#802931', fontSize: 20, fontWeight: '800' }, brandSub: { marginTop: 2, color: '#848484', fontSize: 12, fontWeight: '600' }, avatar: { backgroundColor: '#802931', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontSize: 12, fontWeight: '800' }, screen: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 108 }, eyebrow: { color: '#848484', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, title: { color: '#2E2526', fontSize: 31, fontWeight: '800', marginTop: 5, letterSpacing: -0.7 }, titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }, button: { minHeight: 46, borderRadius: 12, paddingHorizontal: 16, backgroundColor: '#802931', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#802931', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }, buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' }, softButton: { backgroundColor: '#F3E5E6', shadowOpacity: 0 }, softButtonText: { color: '#802931' }, list: { gap: 11 }, jobRow: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#FFFFFF', borderRadius: 14, gap: 13 }, colorBlock: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, jobInfo: { flex: 1 }, jobTitle: { color: '#2E2526', fontSize: 16, fontWeight: '800' }, jobMeta: { color: '#848484', fontSize: 12, marginTop: 3 }, status: { fontSize: 12, fontWeight: '700', marginTop: 6 }, clockCard: { marginTop: 18, padding: 24, borderRadius: 16, backgroundColor: '#802931', alignItems: 'center' }, clockLabel: { color: '#F4DADD', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 }, clockTime: { color: '#FFFFFF', fontSize: 42, fontWeight: '800', marginTop: 6 }, clockJob: { color: '#F8EBEC', fontSize: 14, textAlign: 'center', marginTop: 4 }, fieldLabel: { color: '#4A4142', fontWeight: '800', fontSize: 13, marginTop: 25, marginBottom: 8 }, jobPicker: { gap: 7, marginBottom: 22 }, pickJob: { minHeight: 47, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 10 }, pickJobSelected: { borderWidth: 2, borderColor: '#802931' }, smallColor: { width: 14, height: 14, borderRadius: 7 }, pickJobText: { flex: 1, color: '#2E2526', fontWeight: '700' }, helper: { color: '#848484', lineHeight: 19, fontSize: 13, marginTop: 14 }, periodNote: { color: '#848484', marginTop: 6, fontSize: 13 }, hoursBox: { marginVertical: 22, backgroundColor: '#F3E5E6', borderRadius: 14, padding: 19, flexDirection: 'row', alignItems: 'baseline', gap: 8 }, hoursValue: { color: '#802931', fontSize: 32, fontWeight: '800' }, hoursLabel: { color: '#802931', fontWeight: '700' }, entry: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 13, padding: 15, marginBottom: 10 }, entryInfo: { flex: 1, paddingRight: 10 }, entryTitle: { color: '#2E2526', fontWeight: '800', fontSize: 15 }, entryMeta: { marginTop: 4, color: '#848484', fontSize: 12 }, entryHours: { color: '#802931', fontWeight: '800', textAlign: 'right' }, edit: { color: '#802931', marginTop: 9, fontWeight: '800', fontSize: 12 }, nav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 72, flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#E4E4E4', paddingTop: 9 }, navItem: { alignItems: 'center', minWidth: 74, gap: 3 }, navText: { color: '#848484', fontSize: 11, fontWeight: '700' }, navTextActive: { color: '#802931' }, modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(47, 21, 24, 0.38)' }, sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22, paddingBottom: 38 }, sheetTitle: { color: '#2E2526', fontSize: 23, fontWeight: '800', marginBottom: 17 }, input: { height: 49, backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 13, color: '#2E2526', marginBottom: 10, borderWidth: 1, borderColor: '#E4E4E4' }, colorChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }, colorChoice: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 }, colorChoiceSelected: { borderWidth: 2, borderColor: '#802931' }, cancel: { color: '#802931', textAlign: 'center', paddingTop: 17, fontWeight: '800' }, adjustLabel: { color: '#848484', marginBottom: 12, fontWeight: '700' },
});
