<svelte:head>
  <title>Exams & Seating</title>
</svelte:head>

<script lang="ts">
  import { makeAdminRequest } from '$lib/api/admin';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import {
    Add01Icon,
    Delete01Icon,
    Edit01Icon,
    Calendar01Icon,
    Clock01Icon,
    Settings01Icon,
    Link01Icon,
    CloudUploadIcon,
    Loading03Icon,
    CheckmarkCircle01Icon,
    Search01Icon,
    Cancel01Icon,
    CheckmarkBadge01Icon,
    ArrowDown01Icon,
    ArrowUp01Icon,
    RefreshIcon,
    File01Icon
  } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';
  import { addToast } from '$lib/stores/toast';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import Checkbox from '$lib/components/Checkbox.svelte';
  import Dropdown from '$lib/components/Dropdown.svelte';

  const examTypeOptions = [
    { value: 'theory', label: 'Theory' },
    { value: 'viva', label: 'Viva' },
    { value: 'practical', label: 'Practical' }
  ];

  // --- Types matching examdata_old.json ---
  type ExamItem = {
    id?: number | string;
    subject: string;
    type: 'theory' | 'viva' | 'practical';
    code: string;
    date: string; // YYYY-MM-DD
    time: string; // e.g. "14:00" or "09:45"
    duration: string; // e.g. "150 mins", "1.5 hours", "full day"
    aliases?: string[];
    syllabus?: string[];
    seatingDataUrl?: string; // per-exam seating CSV URL override
    coverImage?: string; // per-exam/subject cover image override
  };

  type ExamPeriod = {
    name: string; // e.g. "Viva/Practical", "End Semester", "Mid Semester"
    shortName: string; // e.g. "Viva", "End Sem", "Mid Sem"
    startDate: string; // ISO datetime e.g. "2026-04-15T14:00:00"
    endDate: string; // ISO datetime e.g. "2026-04-27T16:30:00"
  };

  type SemesterSchedule = {
    semester: number;
    examPeriod: ExamPeriod;
    defaultCoverImage?: string; // optional per-period cover image
    seatingDataUrl?: string; // period-level master seating CSV (e.g. viva.csv or mid-sem schedule)
    exams: ExamItem[];
  };

  type ExamConfig = {
    enabled: boolean;
    viewRotationInterval: number;
    showBeforeDays: number;
    showBeforeDaysViva: number;
    defaultCoverImage: string;
    seatingDataUrl?: string;
    semesters: SemesterSchedule[];
  };

  // --- Page State ---
  let config = $state<ExamConfig>({
    enabled: true,
    viewRotationInterval: 15000,
    showBeforeDays: 9,
    showBeforeDaysViva: 3,
    defaultCoverImage: '',
    seatingDataUrl: '',
    semesters: []
  });

  let isLoading = $state(true);
  let isSavingConfig = $state(false);
  let error = $state('');
  let activeTab = $state<'active' | 'history'>('active');
  let searchQuery = $state('');
  let semesterFilter = $state<number | 'all'>('all');

  // History expanded rows state
  let expandedHistoryIndices = $state<Set<number>>(new Set());

  function toggleHistoryExpand(index: number) {
    const next = new Set(expandedHistoryIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    expandedHistoryIndices = next;
  }

  // Available semesters list for filtering
  let availableSemesters = $derived(
    [...new Set(config.semesters.map((s) => s.semester))].sort((a, b) => a - b)
  );

  // Helper to test if a schedule is active vs past
  function isScheduleActive(sched: SemesterSchedule): boolean {
    if (!sched.examPeriod?.endDate) return true;
    const end = new Date(sched.examPeriod.endDate).getTime();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    return end >= todayStart;
  }

  // Derived filtered schedules
  let filteredSchedules = $derived(
    config.semesters
      .map((s, originalIndex) => ({ ...s, originalIndex }))
      .filter((s) => {
        // Tab filter
        const matchesTab = activeTab === 'active' ? isScheduleActive(s) : !isScheduleActive(s);
        if (!matchesTab) return false;

        // Semester filter
        if (semesterFilter !== 'all' && s.semester !== semesterFilter) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesPeriod =
            s.examPeriod.name.toLowerCase().includes(q) ||
            s.examPeriod.shortName.toLowerCase().includes(q) ||
            `sem ${s.semester}`.includes(q) ||
            `semester ${s.semester}`.includes(q);

          const matchesExams = s.exams.some(
            (e) =>
              e.subject.toLowerCase().includes(q) ||
              e.code.toLowerCase().includes(q) ||
              (e.aliases && e.aliases.some((a) => a.toLowerCase().includes(q)))
          );

          return matchesPeriod || matchesExams;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.examPeriod.startDate).getTime();
        const dateB = new Date(b.examPeriod.startDate).getTime();
        return activeTab === 'active' ? dateA - dateB : dateB - dateA;
      })
  );

  let activeCount = $derived(config.semesters.filter(isScheduleActive).length);
  let historyCount = $derived(config.semesters.filter((s) => !isScheduleActive(s)).length);

  // --- Confirm Modal State ---
  let isConfirmOpen = $state(false);
  let confirmTitle = $state('');
  let confirmMessage = $state('');
  let onConfirmAction = $state<() => void>(() => {});

  // --- Global Settings Modal State ---
  let isGlobalSettingsOpen = $state(false);
  let isUploadingGlobalCover = $state(false);

  // --- Schedule Editor Modal State ---
  let isScheduleModalOpen = $state(false);
  let editingScheduleIndex = $state<number | null>(null); // null = new schedule
  let scheduleModalTab = $state<'general' | 'timetable' | 'seating'>('general');
  let isUploadingPeriodCsv = $state(false);
  let isUploadingPeriodCover = $state(false);

  // Form state for Period / Schedule
  interface ScheduleForm {
    semester: number;
    periodName: string;
    periodShortName: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    defaultCoverImage: string;
    seatingDataUrl: string; // period-level master seating CSV URL
    exams: ExamItem[];
  }

  function defaultScheduleForm(): ScheduleForm {
    const now = new Date();
    const startStr = now.toISOString().split('T')[0];
    const endStr = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return {
      semester: 6,
      periodName: 'End Semester',
      periodShortName: 'End Sem',
      startDate: startStr,
      endDate: endStr,
      defaultCoverImage: config.defaultCoverImage || '',
      seatingDataUrl: (config as any).seatingDataUrl || '',
      exams: []
    };
  }

  let scheduleForm = $state<ScheduleForm>(defaultScheduleForm());

  // --- Subject Accordion State (Inside Timetable tab) ---
  let isAddingSubject = $state(false);
  let editingPaperIndex = $state<number | null>(null); // null = closed, number = open accordion index
  let showSubjectAdvanced = $state(false);
  let isUploadingPaperCover = $state(false);

  interface PaperForm {
    id: string | number;
    subject: string;
    type: 'theory' | 'viva' | 'practical';
    code: string;
    date: string;
    time: string;
    duration: string;
    aliasesText: string;
    syllabusText: string;
    seatingDataUrl: string;
    coverImage: string;
  }

  function defaultPaperForm(): PaperForm {
    return {
      id: Date.now(),
      subject: '',
      type: 'theory',
      code: '',
      date: new Date().toISOString().split('T')[0],
      time: '14:00',
      duration: '150 mins',
      aliasesText: '',
      syllabusText: '',
      seatingDataUrl: '',
      coverImage: ''
    };
  }

  let paperForm = $state<PaperForm>(defaultPaperForm());

  // --- API Functions ---
  async function loadConfig() {
    isLoading = true;
    error = '';
    try {
      const res: any = await makeAdminRequest('exams/config', 'GET');
      if (res && res.config) {
        const globalCover = res.config.defaultCoverImage || '';
        const globalSeating = res.config.seatingDataUrl || '';
        const rawSemesters = Array.isArray(res.config.semesters) ? res.config.semesters : [];

        config = {
          enabled: res.config.enabled ?? true,
          viewRotationInterval: res.config.viewRotationInterval || 15000,
          showBeforeDays: res.config.showBeforeDays || 9,
          showBeforeDaysViva: res.config.showBeforeDaysViva || 3,
          defaultCoverImage: globalCover,
          seatingDataUrl: globalSeating,
          semesters: rawSemesters.map((s: any) => ({
            ...s,
            defaultCoverImage:
              s.defaultCoverImage ||
              s.coverImage ||
              s.examPeriod?.defaultCoverImage ||
              s.examPeriod?.coverImage ||
              globalCover ||
              '',
            seatingDataUrl:
              s.seatingDataUrl ||
              s.seatingUrl ||
              (rawSemesters.length <= 1 ? globalSeating : '') ||
              ''
          }))
        };
      }
    } catch (e: any) {
      console.error('Failed to load exam config:', e);
      error = e.message || 'Failed to load exam configuration';
    } finally {
      isLoading = false;
    }
  }

  async function saveFullConfig(silent = false) {
    isSavingConfig = true;
    try {
      await makeAdminRequest('exams/config', 'POST', config);
      if (!silent) {
        addToast('Exam schedules and settings saved successfully!');
      }
    } catch (e: any) {
      console.error('Failed to save exam config:', e);
      addToast(`Save failed: ${e.message || e}`);
    } finally {
      isSavingConfig = false;
    }
  }

  onMount(() => {
    loadConfig();
  });

  // --- File Upload Helper ---
  async function uploadFileToServer(file: File, path: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('materio_auth_token') ||
      '';

    const res = await fetch('/api/v2/admin/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const data = (await res.json()) as any;
    if (!res.ok || !data.url) {
      throw new Error(data.error || 'Upload failed');
    }
    return data.url;
  }

  // Upload Period Master Seating CSV in Modal
  async function handlePeriodCsvUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      addToast('Please select a valid .csv file');
      input.value = '';
      return;
    }

    isUploadingPeriodCsv = true;
    try {
      const sem = scheduleForm.semester;
      const periodName = (scheduleForm.periodShortName || scheduleForm.periodName || 'period').replace(/[^a-zA-Z0-9_-]/g, '');
      const path = `exams/seating/sem${sem}-${periodName}-master-${Date.now()}.csv`;
      const url = await uploadFileToServer(file, path);
      scheduleForm.seatingDataUrl = url;
      addToast('Master period seating file uploaded!');
    } catch (err: any) {
      addToast(`Upload failed: ${err.message || err}`);
    } finally {
      isUploadingPeriodCsv = false;
      input.value = '';
    }
  }

  // Upload Period Banner Cover in Modal
  async function handlePeriodCoverUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    isUploadingPeriodCover = true;
    try {
      const path = `exams/covers/period-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
      const url = await uploadFileToServer(file, path);
      scheduleForm.defaultCoverImage = url;
      addToast('Period banner image uploaded!');
    } catch (err: any) {
      addToast(`Image upload failed: ${err.message || err}`);
    } finally {
      isUploadingPeriodCover = false;
      input.value = '';
    }
  }

  // Upload Subject Cover Image in Accordion Editor
  async function handlePaperCoverUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    isUploadingPaperCover = true;
    try {
      const path = `exams/covers/paper-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
      const url = await uploadFileToServer(file, path);
      paperForm.coverImage = url;
      addToast('Subject cover image uploaded!');
    } catch (err: any) {
      addToast(`Image upload failed: ${err.message || err}`);
    } finally {
      isUploadingPaperCover = false;
      input.value = '';
    }
  }

  // Quick CSV upload for period master seating on card
  async function handleQuickPeriodCsvUpload(scheduleIdx: number, e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      addToast('Please upload a valid .csv file');
      input.value = '';
      return;
    }

    try {
      const sem = config.semesters[scheduleIdx].semester;
      const periodName = (config.semesters[scheduleIdx].examPeriod.shortName || config.semesters[scheduleIdx].examPeriod.name || 'period').replace(/[^a-zA-Z0-9_-]/g, '');
      const path = `exams/seating/sem${sem}-${periodName}-master-${Date.now()}.csv`;
      const url = await uploadFileToServer(file, path);
      config.semesters[scheduleIdx].seatingDataUrl = url;
      await saveFullConfig(true);
      addToast('Period seating file updated!');
    } catch (err: any) {
      addToast(`Upload failed: ${err.message || err}`);
    } finally {
      input.value = '';
    }
  }

  // Upload Global Cover Image
  async function handleGlobalCoverUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    isUploadingGlobalCover = true;
    try {
      const path = `exams/covers/global-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
      const url = await uploadFileToServer(file, path);
      config.defaultCoverImage = url;
      addToast('Global cover image uploaded!');
    } catch (err: any) {
      addToast(`Image upload failed: ${err.message || err}`);
    } finally {
      isUploadingGlobalCover = false;
      input.value = '';
    }
  }

  // Direct quick CSV upload for an existing exam row on page
  async function handleQuickRowCsvUpload(
    scheduleIdx: number,
    examIdx: number,
    e: Event
  ) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      addToast('Please upload a valid .csv file');
      input.value = '';
      return;
    }

    try {
      const sem = config.semesters[scheduleIdx].semester;
      const code = (config.semesters[scheduleIdx].exams[examIdx].code || 'exam').replace(/[^a-zA-Z0-9_-]/g, '');
      const path = `exams/seating/sem${sem}-${code}-${Date.now()}.csv`;
      const url = await uploadFileToServer(file, path);
      config.semesters[scheduleIdx].exams[examIdx].seatingDataUrl = url;
      await saveFullConfig(true);
      addToast('Subject seating file updated & saved!');
    } catch (err: any) {
      addToast(`Upload failed: ${err.message || err}`);
    } finally {
      input.value = '';
    }
  }

  // Upload subject seating override inside Modal -> Seating tab
  async function handleSubjectSeatingUploadInModal(examIndex: number, e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      addToast('Please select a valid .csv file');
      input.value = '';
      return;
    }

    try {
      const sem = scheduleForm.semester;
      const code = (scheduleForm.exams[examIndex].code || 'exam').replace(/[^a-zA-Z0-9_-]/g, '');
      const path = `exams/seating/sem${sem}-${code}-${Date.now()}.csv`;
      const url = await uploadFileToServer(file, path);
      scheduleForm.exams[examIndex].seatingDataUrl = url;
      addToast('Subject seating override uploaded!');
    } catch (err: any) {
      addToast(`Upload failed: ${err.message || err}`);
    } finally {
      input.value = '';
    }
  }

  function removeSubjectSeatingInModal(examIndex: number) {
    scheduleForm.exams[examIndex].seatingDataUrl = undefined;
    addToast('Subject seating override removed (will inherit period seating)');
  }

  // --- Schedule Modal Operations ---
  function openNewScheduleModal() {
    editingScheduleIndex = null;
    scheduleForm = defaultScheduleForm();
    scheduleModalTab = 'general';
    isAddingSubject = false;
    editingPaperIndex = null;
    showSubjectAdvanced = false;
    isScheduleModalOpen = true;
  }

  function editSchedule(schedule: SemesterSchedule, originalIndex: number) {
    editingScheduleIndex = originalIndex;
    scheduleModalTab = 'general';
    isAddingSubject = false;
    editingPaperIndex = null;
    showSubjectAdvanced = false;

    const startIso = schedule.examPeriod.startDate || '';
    const endIso = schedule.examPeriod.endDate || '';

    const resolvedCover =
      schedule.defaultCoverImage ||
      (schedule as any).coverImage ||
      (schedule.examPeriod as any)?.defaultCoverImage ||
      (schedule.examPeriod as any)?.coverImage ||
      config.defaultCoverImage ||
      '';

    const resolvedSeating =
      schedule.seatingDataUrl ||
      (schedule as any).seatingUrl ||
      config.seatingDataUrl ||
      '';

    scheduleForm = {
      semester: schedule.semester,
      periodName: schedule.examPeriod.name,
      periodShortName: schedule.examPeriod.shortName || '',
      startDate: startIso.split('T')[0] || '',
      endDate: endIso.split('T')[0] || '',
      defaultCoverImage: resolvedCover,
      seatingDataUrl: resolvedSeating,
      exams: JSON.parse(JSON.stringify(schedule.exams || []))
    };

    isScheduleModalOpen = true;
  }

  function deleteSchedule(index: number, title: string) {
    confirmTitle = 'Delete exam schedule';
    confirmMessage = `Are you sure you want to delete "${title}"? All subjects and seating links under this schedule will be permanently removed.`;
    onConfirmAction = async () => {
      config.semesters = config.semesters.filter((_, i) => i !== index);
      await saveFullConfig();
      addToast('Exam schedule deleted.');
    };
    isConfirmOpen = true;
  }

  function syncDatesFromSubjects() {
    if (scheduleForm.exams.length === 0) {
      addToast('No subjects to sync dates from');
      return;
    }
    const dates = scheduleForm.exams.map((e) => e.date).filter(Boolean).sort();
    if (dates.length > 0) {
      scheduleForm.startDate = dates[0];
      scheduleForm.endDate = dates[dates.length - 1];
      addToast('Start and end dates synced from timetable!');
    }
  }

  function saveScheduleModal(e?: Event) {
    if (e) e.preventDefault();

    if (!scheduleForm.periodName.trim()) {
      addToast('Period name is required');
      scheduleModalTab = 'general';
      return;
    }

    // Derive short badge if left empty
    let shortName = scheduleForm.periodShortName.trim();
    if (!shortName) {
      const words = scheduleForm.periodName.trim().split(/\s+/);
      shortName = words.length > 1 ? `${words[0]} ${words[1].slice(0, 3)}` : words[0];
    }

    const startStr = scheduleForm.startDate
      ? (scheduleForm.startDate.includes('T') ? scheduleForm.startDate : `${scheduleForm.startDate}T09:00:00`)
      : new Date().toISOString();

    const endStr = scheduleForm.endDate
      ? (scheduleForm.endDate.includes('T') ? scheduleForm.endDate : `${scheduleForm.endDate}T17:00:00`)
      : new Date().toISOString();

    const newSchedule: SemesterSchedule = {
      semester: Number(scheduleForm.semester) || 1,
      examPeriod: {
        name: scheduleForm.periodName.trim(),
        shortName: shortName,
        startDate: startStr,
        endDate: endStr
      },
      defaultCoverImage: scheduleForm.defaultCoverImage.trim() || undefined,
      seatingDataUrl: scheduleForm.seatingDataUrl.trim() || undefined,
      exams: scheduleForm.exams
    };

    if (editingScheduleIndex !== null && editingScheduleIndex >= 0) {
      config.semesters[editingScheduleIndex] = newSchedule;
    } else {
      config.semesters.push(newSchedule);
    }

    isScheduleModalOpen = false;
    saveFullConfig();
  }

  // --- Accordion Subject Operations (Inside Timetable tab) ---
  function startAddSubject() {
    editingPaperIndex = null;
    paperForm = defaultPaperForm();
    if (scheduleForm.startDate) {
      paperForm.date = scheduleForm.startDate.split('T')[0];
    }
    showSubjectAdvanced = false;
    isAddingSubject = true;
  }

  function startEditSubject(exam: ExamItem, index: number) {
    isAddingSubject = false;
    if (editingPaperIndex === index) {
      // Toggle closed
      editingPaperIndex = null;
      showSubjectAdvanced = false;
      return;
    }

    editingPaperIndex = index;
    paperForm = {
      id: exam.id || Date.now(),
      subject: exam.subject || '',
      type: exam.type || 'theory',
      code: exam.code || '',
      date: exam.date || '',
      time: exam.time || '14:00',
      duration: exam.duration || '150 mins',
      aliasesText: Array.isArray(exam.aliases) ? exam.aliases.join(', ') : '',
      syllabusText: Array.isArray(exam.syllabus) ? exam.syllabus.join('\n\n') : '',
      seatingDataUrl: exam.seatingDataUrl || '',
      coverImage: exam.coverImage || ''
    };
    showSubjectAdvanced = !!(exam.aliases?.length || exam.syllabus?.length);
  }

  function cancelSubjectForm() {
    isAddingSubject = false;
    editingPaperIndex = null;
    showSubjectAdvanced = false;
  }

  function saveSubjectForm() {
    if (!paperForm.subject.trim()) {
      addToast('Subject name is required');
      return;
    }

    const aliases = paperForm.aliasesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const syllabus = paperForm.syllabusText
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const examItem: ExamItem = {
      id: paperForm.id || Date.now(),
      subject: paperForm.subject.trim(),
      type: paperForm.type,
      code: paperForm.code.trim(),
      date: paperForm.date,
      time: paperForm.time.trim(),
      duration: paperForm.duration.trim(),
      aliases: aliases.length > 0 ? aliases : undefined,
      syllabus: syllabus.length > 0 ? syllabus : undefined,
      seatingDataUrl: paperForm.seatingDataUrl.trim() || undefined,
      coverImage: paperForm.coverImage.trim() || undefined
    };

    if (editingPaperIndex !== null && editingPaperIndex >= 0) {
      scheduleForm.exams[editingPaperIndex] = examItem;
      addToast('Subject updated');
    } else {
      scheduleForm.exams.push(examItem);
      addToast('Subject added');
    }

    scheduleForm.exams.sort((a, b) => {
      const tA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
      const tB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
      return tA - tB;
    });

    // If schedule dates are unset, auto-sync them
    if (!scheduleForm.startDate || !scheduleForm.endDate) {
      syncDatesFromSubjects();
    }

    isAddingSubject = false;
    editingPaperIndex = null;
    showSubjectAdvanced = false;
  }

  function removeSubject(index: number) {
    if (editingPaperIndex === index) {
      editingPaperIndex = null;
    }
    scheduleForm.exams = scheduleForm.exams.filter((_, i) => i !== index);
  }

  // Quick Seed from standard examdata structure
  function seedDefaultExamData() {
    confirmTitle = 'Load 3-Semester History Template';
    confirmMessage =
      'This will populate your schedule list with the 3 exam periods from the standard exam structure (Viva/Practical with shared viva.csv, End Semester, and Mid Semester with full syllabus & aliases). Existing schedules will be replaced.';
    onConfirmAction = () => {
      config = {
        enabled: true,
        viewRotationInterval: 15000,
        showBeforeDays: 9,
        showBeforeDaysViva: 3,
        defaultCoverImage: '',
        semesters: [
          {
            semester: 6,
            examPeriod: {
              name: 'Viva/Practical',
              shortName: 'Viva',
              startDate: '2026-04-06T09:00:00',
              endDate: '2026-04-11T17:00:00'
            },
            seatingDataUrl: '/assets/data/viva.csv',
            exams: [
              { id: 101, subject: 'Viva/Practical', type: 'viva', code: '303105000', date: '2026-04-06', time: '09:00', duration: 'full day' },
              { id: 102, subject: 'Viva/Practical', type: 'viva', code: '303105000', date: '2026-04-07', time: '09:00', duration: 'full day' },
              { id: 103, subject: 'Viva/Practical', type: 'viva', code: '303105000', date: '2026-04-08', time: '09:00', duration: 'full day' },
              { id: 104, subject: 'Viva/Practical', type: 'viva', code: '303105000', date: '2026-04-09', time: '09:00', duration: 'full day' },
              { id: 105, subject: 'Viva/Practical', type: 'viva', code: '303105000', date: '2026-04-10', time: '09:00', duration: 'full day' },
              { id: 106, subject: 'Viva/Practical', type: 'viva', code: '303105000', date: '2026-04-11', time: '09:00', duration: 'full day' }
            ]
          },
          {
            semester: 6,
            examPeriod: {
              name: 'End Semester',
              shortName: 'End Sem',
              startDate: '2026-04-15T14:00:00',
              endDate: '2026-04-27T16:30:00'
            },
            exams: [
              { id: 201, subject: 'Compiler Design', type: 'theory', code: '303105349', date: '2026-04-15', time: '14:00', duration: '150 mins' },
              { id: 202, subject: 'Machine Learning', type: 'theory', code: '303105353', date: '2026-04-20', time: '14:00', duration: '150 mins' },
              { id: 203, subject: 'MEA(R)N Stack Web Development', type: 'theory', code: '303105385', date: '2026-04-22', time: '14:00', duration: '150 mins' },
              { id: 204, subject: 'Mobile App Development', type: 'theory', code: '303105379', date: '2026-04-24', time: '14:00', duration: '150 mins' },
              { id: 205, subject: 'Quant and Reasoning', type: 'theory', code: '303105311', date: '2026-04-27', time: '14:00', duration: '150 mins' }
            ]
          },
          {
            semester: 6,
            examPeriod: {
              name: 'Mid Semester',
              shortName: 'Mid Sem',
              startDate: '2026-02-16T09:00:00',
              endDate: '2026-02-24T11:15:00'
            },
            exams: [
              {
                id: 1,
                subject: 'Mobile App Development',
                aliases: ['MAD', 'Mobile App', 'Android'],
                code: '303105379',
                type: 'theory',
                date: '2026-02-16',
                time: '09:45',
                duration: '1.5 hours',
                syllabus: [
                  'Android Operating System and Development Environment',
                  'Android Components and Resource Handling',
                  'Android User Interface Elements'
                ]
              },
              {
                id: 2,
                subject: 'Machine Learning',
                aliases: ['ML', 'Machine Learning'],
                code: '303105353',
                type: 'theory',
                date: '2026-02-17',
                time: '09:45',
                duration: '1.5 hours',
                syllabus: ['Unit 1: Introduction to ML', 'Unit 2: Supervised Learning']
              },
              {
                id: 3,
                subject: 'Compiler Design',
                aliases: ['CD', 'Compiler'],
                code: '303105349',
                type: 'theory',
                date: '2026-02-19',
                time: '09:45',
                duration: '1.5 hours'
              },
              {
                id: 4,
                subject: 'MEAN Stack Web Development',
                aliases: ['MEAN', 'Full Stack'],
                code: '303105385',
                type: 'theory',
                date: '2026-02-20',
                time: '09:45',
                duration: '1.5 hours'
              },
              {
                id: 5,
                subject: 'Employability Skills',
                aliases: ['ES', 'Soft Skills'],
                code: '303193353',
                type: 'theory',
                date: '2026-02-23',
                time: '09:45',
                duration: '1 hour'
              },
              {
                id: 6,
                subject: 'Quant and Reasoning',
                aliases: ['QR', 'Aptitude'],
                code: '303105311',
                type: 'theory',
                date: '2026-02-24',
                time: '09:45',
                duration: '1.5 hours'
              }
            ]
          }
        ]
      };
      saveFullConfig();
      addToast('Standard exam history template loaded!');
    };
    isConfirmOpen = true;
  }

  // Format date range nicely
  function formatDateRange(startStr?: string, endStr?: string) {
    if (!startStr) return '';
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : null;

    const startFormatted = start.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });

    if (!end) return startFormatted;

    const endFormatted = end.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return `${startFormatted} – ${endFormatted}`;
  }

  function getTypeBadgeColor(type?: string) {
    switch (type) {
      case 'viva':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'practical':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'theory':
      default:
        return 'bg-primary/10 text-primary border-primary/20';
    }
  }
</script>

<div class="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
  <ConfirmModal
    bind:isOpen={isConfirmOpen}
    title={confirmTitle}
    message={confirmMessage}
    onConfirm={onConfirmAction}
    confirmText={confirmTitle.includes('Delete') ? 'Delete' : 'Confirm'}
  />

  <!-- Page Header -->
  <div
    class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6"
  >
    <div>
      <h1 class="text-2xl sm:text-3xl font-serif font-normal text-foreground tracking-tight">
        Exams & Seating
      </h1>
      <p class="text-muted-foreground mt-1 text-sm">
        Configure semester exam periods, subject timetables, syllabus, and seating arrangements.
      </p>
    </div>
    <div class="flex items-center gap-2.5 flex-wrap">
      <button
        onclick={() => (isGlobalSettingsOpen = true)}
        class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border/60 hover:bg-muted/40 text-foreground text-sm font-medium transition-all shadow-2xs cursor-pointer"
      >
        <HugeiconsIcon icon={Settings01Icon} size={16} />
        <span>Settings</span>
      </button>

      <button
        onclick={openNewScheduleModal}
        class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
      >
        <HugeiconsIcon icon={Add01Icon} size={18} />
        <span>New schedule</span>
      </button>
    </div>
  </div>

  {#if error}
    <div
      class="bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20 text-sm flex items-center justify-between"
    >
      <span>{error}</span>
      <button onclick={loadConfig} class="underline text-xs font-semibold cursor-pointer">Retry</button>
    </div>
  {/if}

  <!-- Tab Switcher & Filter Controls -->
  <div
    class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-3"
  >
    <!-- Active / History Pill Selector -->
    <div class="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl w-fit">
      <button
        onclick={() => (activeTab = 'active')}
        class="px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer {activeTab ===
        'active'
          ? 'bg-background text-foreground shadow-xs'
          : 'text-muted-foreground hover:text-foreground'}"
      >
        Active ({activeCount})
      </button>
      <button
        onclick={() => (activeTab = 'history')}
        class="px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer {activeTab ===
        'history'
          ? 'bg-background text-foreground shadow-xs'
          : 'text-muted-foreground hover:text-foreground'}"
      >
        History ({historyCount})
      </button>
    </div>

    <!-- Search & Semester Filter -->
    <div class="flex items-center gap-3 w-full sm:w-auto">
      {#if availableSemesters.length > 0}
        <select
          bind:value={semesterFilter}
          class="bg-background border border-border/60 rounded-xl px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
        >
          <option value="all">All Semesters</option>
          {#each availableSemesters as sem}
            <option value={sem}>Semester {sem}</option>
          {/each}
        </select>
      {/if}

      <div class="relative flex-1 sm:w-64">
        <HugeiconsIcon
          icon={Search01Icon}
          size={14}
          class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search subjects, codes..."
          class="w-full bg-background border border-border/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary transition-colors"
        />
        {#if searchQuery}
          <button
            onclick={() => (searchQuery = '')}
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={12} />
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Content State -->
  {#if isLoading}
    <div class="flex flex-col items-center justify-center h-56 text-muted-foreground gap-3">
      <HugeiconsIcon icon={Loading03Icon} size={28} class="animate-spin text-primary" />
      <p class="text-sm font-medium">Loading exam schedules...</p>
    </div>
  {:else if filteredSchedules.length === 0}
    <!-- Empty State -->
    <div
      class="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4 border border-dashed border-border/60 rounded-2xl bg-muted/10 p-8 text-center"
    >
      <div class="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center text-primary">
        <HugeiconsIcon icon={Calendar01Icon} size={24} />
      </div>
      <div class="space-y-1 max-w-sm">
        <h3 class="font-semibold text-foreground text-base">
          No {activeTab} schedules found
        </h3>
        <p class="text-xs text-muted-foreground">
          {searchQuery || semesterFilter !== 'all'
            ? 'No exams match your current filter or search criteria.'
            : activeTab === 'active'
              ? 'There are no ongoing or upcoming exam periods scheduled right now.'
              : 'Past exam periods will automatically appear here once their schedule concludes.'}
        </p>
      </div>

      <div class="flex items-center gap-3 pt-2">
        {#if config.semesters.length === 0}
          <button
            type="button"
            onclick={seedDefaultExamData}
            class="text-xs font-medium px-3.5 py-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground transition-colors cursor-pointer"
          >
            Load standard template
          </button>
        {/if}

        <button
          type="button"
          onclick={openNewScheduleModal}
          class="text-xs font-medium px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
        >
          <HugeiconsIcon icon={Add01Icon} size={14} />
          <span>Create exam schedule</span>
        </button>
      </div>
    </div>
  {:else if activeTab === 'active'}
    <!-- ======================================================== -->
    <!-- ACTIVE EXAM CARDS (Rich, uncluttered, pure-icon actions) -->
    <!-- ======================================================== -->
    <div class="space-y-6">
      {#each filteredSchedules as sched}
        {@const customPaperSeatingCount = sched.exams.filter((e) => !!e.seatingDataUrl).length}
        {@const bannerCover = sched.defaultCoverImage || config.defaultCoverImage}

        <div
          class="flex flex-col rounded-2xl border border-border/60 hover:border-border transition-all duration-200 overflow-hidden bg-background shadow-2xs"
        >
          <!-- Optional Period Banner Preview -->
          {#if bannerCover}
            <div class="h-24 bg-muted/20 relative overflow-hidden flex items-center justify-center border-b border-border/40">
              <img
                src={bannerCover}
                alt={sched.examPeriod.name}
                class="w-full h-full object-cover"
                onerror={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              <div class="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent"></div>
              <div class="absolute bottom-2.5 left-5 flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary text-primary-foreground shadow-xs">
                  Semester {sched.semester}
                </span>
                <span class="text-xs font-semibold text-foreground bg-background/80 px-2 py-0.5 rounded-full backdrop-blur-xs">
                  {sched.examPeriod.name}
                </span>
              </div>
            </div>
          {/if}

          <!-- Card Header Bar -->
          <div
            class="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 bg-card/40"
          >
            <div class="space-y-1.5 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                {#if !bannerCover}
                  <span
                    class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20"
                  >
                    Semester {sched.semester}
                  </span>
                {/if}
                <span
                  class="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-muted/70 text-muted-foreground border border-border/40"
                >
                  {sched.examPeriod.shortName || 'Exams'}
                </span>
                <span
                  class="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                >
                  Active
                </span>

                <!-- Period Master Seating Pill (Indicator only) -->
                {#if sched.seatingDataUrl}
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    title="Period master seating active"
                  >
                    <HugeiconsIcon icon={CheckmarkBadge01Icon} size={11} />
                    <span>Master seating file</span>
                  </span>
                {/if}
              </div>

              <h3 class="text-lg sm:text-xl font-serif font-normal text-foreground tracking-tight truncate">
                {sched.examPeriod.name}
              </h3>

              <div class="flex items-center gap-3 text-xs text-muted-foreground flex-wrap pt-0.5">
                <span class="inline-flex items-center gap-1.5">
                  <HugeiconsIcon icon={Calendar01Icon} size={13} class="text-primary" />
                  {formatDateRange(sched.examPeriod.startDate, sched.examPeriod.endDate)}
                </span>
                <span>&bull;</span>
                <span>{sched.exams.length} {sched.exams.length === 1 ? 'subject' : 'subjects'}</span>
                <span>&bull;</span>

                <!-- Seating Status Overview -->
                {#if sched.seatingDataUrl}
                  <span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <HugeiconsIcon icon={Link01Icon} size={12} />
                    Master seating active {customPaperSeatingCount > 0 ? `(${customPaperSeatingCount} custom overrides)` : ''}
                  </span>
                {:else}
                  <span class="inline-flex items-center gap-1 {customPaperSeatingCount === sched.exams.length && sched.exams.length > 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}">
                    <HugeiconsIcon icon={Link01Icon} size={12} />
                    Seating: {customPaperSeatingCount}/{sched.exams.length} linked
                  </span>
                {/if}
              </div>
            </div>

            <!-- Card Actions: PURE ICON BUTTONS (No noisy cluttered text) -->
            <div class="flex items-center gap-1 self-start sm:self-center shrink-0">
              <!-- If Master CSV exists, direct link icon to view -->
              {#if sched.seatingDataUrl}
                <a
                  href={sched.seatingDataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 rounded-lg border border-emerald-500/30 transition-colors"
                  title="Open master seating file (.csv)"
                >
                  <HugeiconsIcon icon={Link01Icon} size={16} />
                </a>
              {/if}

              <!-- Upload / Replace Master Seating CSV Icon -->
              <label
                class="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 border border-border/40 transition-colors cursor-pointer"
                title={sched.seatingDataUrl ? 'Replace master seating file (.csv)' : 'Upload master seating file (.csv)'}
              >
                <HugeiconsIcon icon={CloudUploadIcon} size={16} />
                <input
                  type="file"
                  accept=".csv"
                  onchange={(e) => handleQuickPeriodCsvUpload(sched.originalIndex, e)}
                  class="hidden"
                />
              </label>

              <!-- Edit Schedule Icon -->
              <button
                onclick={() => editSchedule(sched, sched.originalIndex)}
                class="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 border border-border/40 transition-colors cursor-pointer"
                title="Edit schedule details & timetable"
              >
                <HugeiconsIcon icon={Edit01Icon} size={16} />
              </button>

              <!-- Delete Schedule Icon -->
              <button
                onclick={() => deleteSchedule(sched.originalIndex, sched.examPeriod.name)}
                class="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 border border-border/40 transition-colors cursor-pointer"
                title="Delete schedule"
              >
                <HugeiconsIcon icon={Delete01Icon} size={16} />
              </button>
            </div>
          </div>

          <!-- Exam Papers List -->
          {#if sched.exams.length === 0}
            <div class="p-8 text-center text-muted-foreground text-xs">
              No subjects added to this schedule yet.
              <button
                onclick={() => editSchedule(sched, sched.originalIndex)}
                class="text-primary hover:underline ml-1 cursor-pointer font-medium"
              >
                Add subjects
              </button>
            </div>
          {:else}
            <div class="divide-y divide-border/40">
              {#each sched.exams as exam, examIdx}
                <div
                  class="p-4 sm:px-6 hover:bg-muted/15 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <!-- Subject Info + Rendered Cover Image (Preview rendered, no text link) -->
                  <div class="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    {#if exam.coverImage}
                      <div class="w-12 h-12 rounded-xl overflow-hidden bg-muted/30 border border-border/40 shrink-0 shadow-2xs">
                        <img
                          src={exam.coverImage}
                          alt={exam.subject}
                          class="w-full h-full object-cover"
                          onerror={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      </div>
                    {/if}

                    <div class="space-y-1 min-w-0 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span
                          class="px-2 py-0.5 rounded-full text-[10px] font-medium capitalize border {getTypeBadgeColor(
                            exam.type
                          )}"
                        >
                          {exam.type || 'theory'}
                        </span>
                        {#if exam.code}
                          <span class="font-mono text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/40">
                            {exam.code}
                          </span>
                        {/if}
                      </div>

                      <div class="flex items-baseline gap-2">
                        <h4 class="font-medium text-foreground text-sm leading-snug">
                          {exam.subject}
                        </h4>
                        {#if exam.aliases && exam.aliases.length > 0}
                          <span class="text-[11px] text-muted-foreground hidden sm:inline">
                            ({exam.aliases.join(', ')})
                          </span>
                        {/if}
                      </div>

                      {#if exam.syllabus && exam.syllabus.length > 0}
                        <p class="text-[11px] text-muted-foreground/80 line-clamp-1">
                          Syllabus: {exam.syllabus[0].slice(0, 80)}... ({exam.syllabus.length} units)
                        </p>
                      {/if}
                    </div>
                  </div>

                  <!-- Date, Time & Duration Column -->
                  <div class="flex items-center gap-4 text-xs text-muted-foreground shrink-0 flex-wrap md:flex-nowrap">
                    <div class="space-y-0.5 text-left md:text-right">
                      <div class="font-medium text-foreground text-xs flex items-center md:justify-end gap-1.5">
                        <HugeiconsIcon icon={Calendar01Icon} size={12} class="text-primary" />
                        {exam.date ? new Date(exam.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
                      </div>
                      <div class="text-[11px] text-muted-foreground flex items-center md:justify-end gap-1">
                        <HugeiconsIcon icon={Clock01Icon} size={11} />
                        {exam.time || 'To be scheduled'} &bull; {exam.duration || 'Standard'}
                      </div>
                    </div>

                    <!-- Seating Arrangement: PURE ICON ACTIONS (Clean & minimal) -->
                    <div class="pl-3 border-l border-border/40 flex items-center gap-1.5">
                      {#if exam.seatingDataUrl}
                        <!-- Custom override CSV linked -->
                        <a
                          href={exam.seatingDataUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 rounded-lg border border-emerald-500/30 transition-colors"
                          title="View custom subject seating (.csv)"
                        >
                          <HugeiconsIcon icon={Link01Icon} size={14} />
                        </a>

                        <label
                          class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 border border-border/40 transition-colors cursor-pointer"
                          title="Replace subject seating (.csv)"
                        >
                          <HugeiconsIcon icon={CloudUploadIcon} size={14} />
                          <input
                            type="file"
                            accept=".csv"
                            onchange={(e) => handleQuickRowCsvUpload(sched.originalIndex, examIdx, e)}
                            class="hidden"
                          />
                        </label>
                      {:else if sched.seatingDataUrl}
                        <!-- Inherits master period CSV -->
                        <a
                          href={sched.seatingDataUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 border border-border/40 transition-colors"
                          title="Inherits master period seating (click to open)"
                        >
                          <HugeiconsIcon icon={Link01Icon} size={14} />
                        </a>

                        <label
                          class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 border border-border/40 transition-colors cursor-pointer"
                          title="Upload custom seating override for this subject"
                        >
                          <HugeiconsIcon icon={CloudUploadIcon} size={14} />
                          <input
                            type="file"
                            accept=".csv"
                            onchange={(e) => handleQuickRowCsvUpload(sched.originalIndex, examIdx, e)}
                            class="hidden"
                          />
                        </label>
                      {:else}
                        <!-- No CSV attached yet -->
                        <label
                          class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 border border-border/40 transition-colors cursor-pointer"
                          title="Upload seating file (.csv) for this subject"
                        >
                          <HugeiconsIcon icon={CloudUploadIcon} size={14} />
                          <input
                            type="file"
                            accept=".csv"
                            onchange={(e) => handleQuickRowCsvUpload(sched.originalIndex, examIdx, e)}
                            class="hidden"
                          />
                        </label>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <!-- ======================================================== -->
    <!-- ARCHIVAL HISTORY LOG (Rethought, compact, expandable)     -->
    <!-- ======================================================== -->
    <div class="space-y-3">
      {#each filteredSchedules as sched}
        {@const isExpanded = expandedHistoryIndices.has(sched.originalIndex)}
        <div
          class="rounded-xl border border-border/60 bg-background overflow-hidden transition-all duration-200 hover:border-border shadow-2xs"
        >
          <!-- Archival Row Header -->
          <div
            class="p-3.5 sm:px-5 flex items-center justify-between gap-4 bg-card/30"
          >
            <!-- Left: Clean, uncluttered metadata -->
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted/80 text-muted-foreground border border-border/40 shrink-0">
                Sem {sched.semester}
              </span>

              <h3 class="font-serif font-medium text-foreground text-sm sm:text-base tracking-tight truncate">
                {sched.examPeriod.name}
              </h3>

              <span class="text-xs text-muted-foreground shrink-0">
                {formatDateRange(sched.examPeriod.startDate, sched.examPeriod.endDate)}
              </span>

              <span class="text-xs text-muted-foreground/70 shrink-0 hidden sm:inline">
                &bull; {sched.exams.length} {sched.exams.length === 1 ? 'subject' : 'subjects'}
              </span>
            </div>

            <!-- Right: Pure Icon Actions -->
            <div class="flex items-center gap-1 self-end sm:self-center shrink-0">
              {#if sched.seatingDataUrl}
                <a
                  href={sched.seatingDataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 transition-colors"
                  title="Open archived master seating file (.csv)"
                >
                  <HugeiconsIcon icon={Link01Icon} size={15} />
                </a>
              {/if}

              <button
                onclick={() => editSchedule(sched, sched.originalIndex)}
                class="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 transition-colors cursor-pointer"
                title="Edit schedule"
              >
                <HugeiconsIcon icon={Edit01Icon} size={15} />
              </button>

              <button
                onclick={() => deleteSchedule(sched.originalIndex, sched.examPeriod.name)}
                class="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors cursor-pointer"
                title="Delete schedule"
              >
                <HugeiconsIcon icon={Delete01Icon} size={15} />
              </button>

              <!-- Expand/Collapse Timetable Ledger -->
              <button
                onclick={() => toggleHistoryExpand(sched.originalIndex)}
                class="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 transition-colors cursor-pointer border-l border-border/40 ml-1"
                title={isExpanded ? 'Collapse timetable' : 'View past timetable'}
              >
                <HugeiconsIcon icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon} size={15} />
              </button>
            </div>
          </div>

          <!-- Expanded Historical Timetable Ledger -->
          {#if isExpanded}
            <div class="border-t border-border/30 bg-muted/5 p-4 sm:p-5 divide-y divide-border/20 text-xs animate-in fade-in duration-150">
              <div class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-2">
                Historical Timetable & Syllabi
              </div>
              {#if sched.exams.length === 0}
                <p class="py-3 text-muted-foreground">No subjects recorded in this period.</p>
              {:else}
                {#each sched.exams as exam}
                  <div class="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                      {#if exam.coverImage}
                        <div class="w-9 h-9 rounded-lg overflow-hidden bg-muted/30 border border-border/40 shrink-0">
                          <img
                            src={exam.coverImage}
                            alt={exam.subject}
                            class="w-full h-full object-cover"
                            onerror={(e) => {
                              const target = e.currentTarget as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      {/if}

                      <div class="space-y-0.5 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="font-medium text-foreground text-xs">{exam.subject}</span>
                          {#if exam.code}
                            <span class="font-mono text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded">
                              {exam.code}
                            </span>
                          {/if}
                          <span class="capitalize text-[10px] px-1.5 py-0.2 rounded border {getTypeBadgeColor(exam.type)}">
                            {exam.type}
                          </span>
                        </div>
                        {#if exam.syllabus && exam.syllabus.length > 0}
                          <p class="text-[11px] text-muted-foreground/80 line-clamp-1">
                            {exam.syllabus.join(' • ')}
                          </p>
                        {/if}
                      </div>
                    </div>

                    <div class="text-muted-foreground text-[11px] shrink-0 text-left sm:text-right">
                      <div>{exam.date || 'No date'} &bull; {exam.time}</div>
                      <div class="text-[10px] text-muted-foreground/70">{exam.duration}</div>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- ======================================================== -->
  <!-- TABBED SCHEDULE MODAL (General, Timetable, Seating)       -->
  <!-- ======================================================== -->
  <Modal
    bind:isOpen={isScheduleModalOpen}
    title={editingScheduleIndex !== null ? 'Edit exam schedule' : 'New exam schedule'}
    onClose={() => {
      isScheduleModalOpen = false;
      isAddingSubject = false;
      editingPaperIndex = null;
    }}
    maxWidthClass="sm:max-w-2xl lg:max-w-3xl"
  >
    <!-- Modal Navigation Tabs (Separated concerns like promotions modal) -->
    <div class="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl w-fit mb-6 text-xs">
      <button
        type="button"
        onclick={() => (scheduleModalTab = 'general')}
        class="px-3.5 py-1.5 rounded-lg transition-all font-medium cursor-pointer {scheduleModalTab === 'general'
          ? 'bg-background text-foreground shadow-xs'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}"
      >
        General
      </button>
      <button
        type="button"
        onclick={() => (scheduleModalTab = 'timetable')}
        class="px-3.5 py-1.5 rounded-lg transition-all font-medium cursor-pointer flex items-center gap-1.5 {scheduleModalTab === 'timetable'
          ? 'bg-background text-foreground shadow-xs'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}"
      >
        <span>Timetable</span>
        <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-muted/70 text-muted-foreground">
          {scheduleForm.exams.length}
        </span>
      </button>
      <button
        type="button"
        onclick={() => (scheduleModalTab = 'seating')}
        class="px-3.5 py-1.5 rounded-lg transition-all font-medium cursor-pointer flex items-center gap-1.5 {scheduleModalTab === 'seating'
          ? 'bg-background text-foreground shadow-xs'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}"
      >
        <span>Seating</span>
        {#if scheduleForm.seatingDataUrl || scheduleForm.exams.some((e) => !!e.seatingDataUrl)}
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        {/if}
      </button>
    </div>

    <form onsubmit={saveScheduleModal} class="space-y-6">
      <!-- ==================================================== -->
      <!-- TAB 1: GENERAL                                       -->
      <!-- ==================================================== -->
      {#if scheduleModalTab === 'general'}
        <div class="space-y-5 animate-in fade-in duration-200">
          <!-- Semester, Period Name, Badge -->
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div class="sm:col-span-3 space-y-1">
              <label for="schedSem" class="text-xs font-medium text-muted-foreground">Semester</label>
              <input
                id="schedSem"
                type="number"
                min="1"
                max="12"
                bind:value={scheduleForm.semester}
                required
                class="w-full bg-transparent border-0 border-b border-border/70 focus:border-primary rounded-none px-0 py-1.5 text-sm focus:outline-none transition-colors"
                placeholder="6"
              />
            </div>

            <div class="sm:col-span-6 space-y-1">
              <label for="schedPeriodName" class="text-xs font-medium text-muted-foreground">
                Period name
              </label>
              <input
                id="schedPeriodName"
                type="text"
                bind:value={scheduleForm.periodName}
                required
                class="w-full bg-transparent border-0 border-b border-border/70 focus:border-primary rounded-none px-0 py-1.5 text-sm focus:outline-none transition-colors"
                placeholder="e.g. End Semester, Viva / Practical, Mid Semester"
              />
            </div>

            <div class="sm:col-span-3 space-y-1">
              <label for="schedPeriodShort" class="text-xs font-medium text-muted-foreground">
                Badge
              </label>
              <input
                id="schedPeriodShort"
                type="text"
                bind:value={scheduleForm.periodShortName}
                class="w-full bg-transparent border-0 border-b border-border/70 focus:border-primary rounded-none px-0 py-1.5 text-sm focus:outline-none transition-colors"
                placeholder="End Sem"
              />
            </div>
          </div>

          <!-- Date Window with Auto-Sync Option -->
          <div class="space-y-2 pt-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground">Period date window</span>
              {#if scheduleForm.exams.length > 0}
                <button
                  type="button"
                  onclick={syncDatesFromSubjects}
                  class="text-[11px] text-primary hover:underline cursor-pointer inline-flex items-center gap-1 font-medium"
                >
                  <HugeiconsIcon icon={RefreshIcon} size={12} />
                  <span>Sync dates from timetable</span>
                </button>
              {/if}
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label for="schedStartDate" class="text-[11px] text-muted-foreground">Start date</label>
                <input
                  id="schedStartDate"
                  type="date"
                  bind:value={scheduleForm.startDate}
                  required
                  class="w-full bg-transparent border-0 border-b border-border/70 focus:border-primary rounded-none px-0 py-1.5 text-sm focus:outline-none transition-colors"
                />
              </div>

              <div class="space-y-1">
                <label for="schedEndDate" class="text-[11px] text-muted-foreground">End date</label>
                <input
                  id="schedEndDate"
                  type="date"
                  bind:value={scheduleForm.endDate}
                  required
                  class="w-full bg-transparent border-0 border-b border-border/70 focus:border-primary rounded-none px-0 py-1.5 text-sm focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <!-- Banner Cover Image (Rendered only, no text link) -->
          <div class="space-y-2 pt-3 border-t border-border/30">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-muted-foreground">
                Period banner cover image
              </span>
              <div class="flex items-center gap-2">
                {#if config.defaultCoverImage && scheduleForm.defaultCoverImage !== config.defaultCoverImage}
                  <button
                    type="button"
                    onclick={() => (scheduleForm.defaultCoverImage = config.defaultCoverImage)}
                    class="text-[11px] text-primary hover:underline cursor-pointer font-medium"
                  >
                    Use global default
                  </button>
                {/if}
                {#if scheduleForm.defaultCoverImage}
                  <button
                    type="button"
                    onclick={() => (scheduleForm.defaultCoverImage = '')}
                    class="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    Remove image
                  </button>
                {/if}
              </div>
            </div>

            {#if scheduleForm.defaultCoverImage}
              <div class="relative w-full h-36 rounded-2xl overflow-hidden bg-muted/20 border border-border/40 shadow-xs group">
                <img
                  src={scheduleForm.defaultCoverImage}
                  alt="Period banner preview"
                  class="w-full h-full object-cover"
                  onerror={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <div class="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-3">
                  <label
                    class="px-3 py-1.5 rounded-xl bg-background/90 hover:bg-background text-foreground text-xs font-medium shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5 backdrop-blur-xs"
                  >
                    <HugeiconsIcon
                      icon={isUploadingPeriodCover ? Loading03Icon : CloudUploadIcon}
                      size={14}
                      class={isUploadingPeriodCover ? 'animate-spin' : ''}
                    />
                    <span>{isUploadingPeriodCover ? 'Uploading...' : 'Replace banner'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onchange={handlePeriodCoverUpload}
                      class="hidden"
                    />
                  </label>
                </div>
              </div>
            {:else}
              <label
                class="w-full h-28 rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/60 bg-muted/10 hover:bg-muted/20 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon
                  icon={isUploadingPeriodCover ? Loading03Icon : CloudUploadIcon}
                  size={20}
                  class={isUploadingPeriodCover ? 'animate-spin text-primary' : 'text-primary'}
                />
                <div class="text-center">
                  <span class="text-xs font-medium">{isUploadingPeriodCover ? 'Uploading banner image...' : 'Click to upload period banner image'}</span>
                  <p class="text-[10px] text-muted-foreground">PNG, JPG, or WEBP (optional)</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onchange={handlePeriodCoverUpload}
                  class="hidden"
                />
              </label>
            {/if}
          </div>
        </div>
      {/if}

      <!-- ==================================================== -->
      <!-- TAB 2: TIMETABLE (ACCORDION EDIT & RENDERED COVERS)  -->
      <!-- ==================================================== -->
      {#if scheduleModalTab === 'timetable'}
        <div class="space-y-4 animate-in fade-in duration-200">
          <div class="flex items-center justify-between pb-1 border-b border-border/30">
            <div class="text-xs font-medium text-muted-foreground">
              {scheduleForm.exams.length} {scheduleForm.exams.length === 1 ? 'subject' : 'subjects'} in timetable
            </div>

            {#if !isAddingSubject}
              <button
                type="button"
                onclick={startAddSubject}
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all cursor-pointer shadow-2xs"
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                <span>Add subject</span>
              </button>
            {/if}
          </div>

          <!-- Add Subject Accordion Panel (At Top) -->
          {#if isAddingSubject}
            <div class="rounded-xl border border-primary/50 bg-primary/5 p-4 space-y-4 animate-in fade-in duration-200 shadow-2xs">
              <div class="flex items-center justify-between pb-1 border-b border-primary/20">
                <span class="text-xs font-semibold text-foreground">New subject</span>
                <button
                  type="button"
                  onclick={cancelSubjectForm}
                  class="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <!-- Subject essentials -->
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div class="sm:col-span-6 space-y-1">
                  <label for="newPaperSubject" class="text-xs font-medium text-muted-foreground">Subject name</label>
                  <input
                    id="newPaperSubject"
                    type="text"
                    bind:value={paperForm.subject}
                    class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-1.5 text-sm focus:outline-none transition-colors"
                    placeholder="e.g. Compiler Design"
                  />
                </div>

                <div class="sm:col-span-3 space-y-1">
                  <label for="newPaperCode" class="text-xs font-medium text-muted-foreground">Code</label>
                  <input
                    id="newPaperCode"
                    type="text"
                    bind:value={paperForm.code}
                    class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-1.5 text-sm focus:outline-none transition-colors"
                    placeholder="e.g. 303105349"
                  />
                </div>

                <div class="sm:col-span-3 space-y-1">
                  <label for="newPaperType" class="text-xs font-medium text-muted-foreground">Type</label>
                  <Dropdown
                    id="newPaperType"
                    bind:value={paperForm.type}
                    options={examTypeOptions}
                  />
                </div>
              </div>

              <!-- Date, Time, Duration -->
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div class="sm:col-span-4 space-y-1">
                  <label for="newPaperDate" class="text-xs font-medium text-muted-foreground">Date</label>
                  <input
                    id="newPaperDate"
                    type="date"
                    bind:value={paperForm.date}
                    class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-1.5 text-sm focus:outline-none transition-colors"
                  />
                </div>

                <div class="sm:col-span-4 space-y-1">
                  <label for="newPaperTime" class="text-xs font-medium text-muted-foreground">Time</label>
                  <input
                    id="newPaperTime"
                    type="text"
                    bind:value={paperForm.time}
                    class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-1.5 text-sm focus:outline-none transition-colors"
                    placeholder="14:00"
                  />
                </div>

                <div class="sm:col-span-4 space-y-1">
                  <label for="newPaperDuration" class="text-xs font-medium text-muted-foreground">Duration</label>
                  <input
                    id="newPaperDuration"
                    type="text"
                    bind:value={paperForm.duration}
                    class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-1.5 text-sm focus:outline-none transition-colors"
                    placeholder="150 mins"
                  />
                </div>
              </div>

              <!-- Subject Cover Image (Rendered only, no text link) -->
              <div class="space-y-2 pt-1">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-medium text-muted-foreground">
                    Subject cover image (optional)
                  </span>
                  {#if paperForm.coverImage}
                    <button
                      type="button"
                      onclick={() => (paperForm.coverImage = '')}
                      class="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      Remove
                    </button>
                  {/if}
                </div>

                {#if paperForm.coverImage}
                  <div class="flex items-center gap-3">
                    <div class="w-20 h-14 rounded-xl overflow-hidden bg-muted/30 border border-border/40 shrink-0 shadow-xs relative">
                      <img
                        src={paperForm.coverImage}
                        alt="Cover preview"
                        class="w-full h-full object-cover"
                        onerror={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                    <label
                      class="px-3 py-1.5 rounded-lg border border-border/60 hover:bg-muted/50 text-foreground text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <HugeiconsIcon
                        icon={isUploadingPaperCover ? Loading03Icon : CloudUploadIcon}
                        size={14}
                        class={isUploadingPaperCover ? 'animate-spin' : ''}
                      />
                      <span>{isUploadingPaperCover ? 'Uploading...' : 'Change cover image'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onchange={handlePaperCoverUpload}
                        class="hidden"
                      />
                    </label>
                  </div>
                {:else}
                  <label
                    class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-border/80 hover:border-primary/60 bg-muted/10 hover:bg-muted/20 text-xs font-medium text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                  >
                    <HugeiconsIcon
                      icon={isUploadingPaperCover ? Loading03Icon : CloudUploadIcon}
                      size={16}
                      class={isUploadingPaperCover ? 'animate-spin text-primary' : 'text-primary'}
                    />
                    <span>{isUploadingPaperCover ? 'Uploading cover...' : 'Upload cover image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onchange={handlePaperCoverUpload}
                      class="hidden"
                    />
                  </label>
                {/if}
              </div>

              <!-- Additional Options (Aliases & Syllabus) -->
              <div class="pt-1">
                <button
                  type="button"
                  onclick={() => (showSubjectAdvanced = !showSubjectAdvanced)}
                  class="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1 font-medium"
                >
                  <span>{showSubjectAdvanced ? '− Fewer options' : '+ Additional options (aliases, syllabus)'}</span>
                </button>

                {#if showSubjectAdvanced}
                  <div class="space-y-3 pt-3">
                    <div class="space-y-1">
                      <label for="newPaperAliases" class="text-xs font-medium text-muted-foreground">
                        Aliases (comma-separated)
                      </label>
                      <input
                        id="newPaperAliases"
                        type="text"
                        bind:value={paperForm.aliasesText}
                        class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-1.5 text-xs focus:outline-none transition-colors"
                        placeholder="e.g. CD, Compiler"
                      />
                    </div>

                    <div class="space-y-1">
                      <label for="newPaperSyllabus" class="text-xs font-medium text-muted-foreground">
                        Syllabus units (separated by blank lines)
                      </label>
                      <textarea
                        id="newPaperSyllabus"
                        rows="3"
                        bind:value={paperForm.syllabusText}
                        class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-1.5 text-xs focus:outline-none transition-colors"
                        placeholder="Unit 1: Lexical Analysis...&#10;&#10;Unit 2: Syntax Analysis..."
                      ></textarea>
                    </div>
                  </div>
                {/if}
              </div>

              <div class="flex items-center justify-end gap-2 pt-2 border-t border-primary/20">
                <button
                  type="button"
                  onclick={cancelSubjectForm}
                  class="px-3 py-1.5 rounded-lg hover:bg-muted/60 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onclick={saveSubjectForm}
                  class="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all cursor-pointer shadow-2xs"
                >
                  Add subject
                </button>
              </div>
            </div>
          {/if}

          <!-- Accordion Subjects List -->
          {#if scheduleForm.exams.length === 0 && !isAddingSubject}
            <div class="py-10 text-center text-muted-foreground text-xs border border-dashed border-border/50 rounded-xl space-y-2">
              <p>No subjects added yet.</p>
              <button
                type="button"
                onclick={startAddSubject}
                class="text-xs text-primary font-medium hover:underline cursor-pointer"
              >
                + Add first subject
              </button>
            </div>
          {:else}
            <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
              {#each scheduleForm.exams as exam, idx}
                {@const isExpanded = editingPaperIndex === idx}
                <div
                  class="rounded-xl border transition-all duration-200 overflow-hidden {isExpanded
                    ? 'border-primary/50 bg-muted/10 shadow-xs'
                    : 'border-border/40 hover:border-border/70 bg-background'}"
                >
                  <!-- Accordion Header Row -->
                  <div class="p-3 flex items-center justify-between gap-3 text-xs">
                    <button
                      type="button"
                      onclick={() => startEditSubject(exam, idx)}
                      class="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <!-- Rendered Cover Image Thumbnail Preview (No text links) -->
                      {#if exam.coverImage}
                        <div class="w-10 h-10 rounded-lg overflow-hidden bg-muted/30 border border-border/40 shrink-0 shadow-2xs">
                          <img
                            src={exam.coverImage}
                            alt={exam.subject}
                            class="w-full h-full object-cover"
                            onerror={(e) => {
                              const target = e.currentTarget as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      {/if}

                      <div class="space-y-0.5 min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <span class="font-medium text-foreground text-xs truncate">
                            {exam.subject}
                          </span>
                          {#if exam.code}
                            <span class="font-mono text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded">
                              {exam.code}
                            </span>
                          {/if}
                          <span class="text-[10px] capitalize font-medium px-1.5 py-0.2 rounded border {getTypeBadgeColor(exam.type)}">
                            {exam.type}
                          </span>
                        </div>
                        <div class="text-muted-foreground text-[11px] flex items-center gap-2">
                          <span>{exam.date || 'No date'} &bull; {exam.time}</span>
                          <span>&bull;</span>
                          <span>{exam.duration}</span>
                          {#if exam.seatingDataUrl}
                            <span>&bull;</span>
                            <span class="text-emerald-600 dark:text-emerald-400 font-medium">custom seating</span>
                          {/if}
                        </div>
                      </div>
                    </button>

                    <!-- Pure Icon Actions for Accordion Row -->
                    <div class="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onclick={() => startEditSubject(exam, idx)}
                        class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 transition-colors cursor-pointer"
                        title={isExpanded ? 'Collapse editor' : 'Edit subject'}
                      >
                        <HugeiconsIcon icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon} size={15} />
                      </button>
                      <button
                        type="button"
                        onclick={() => removeSubject(idx)}
                        class="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors cursor-pointer"
                        title="Remove subject"
                      >
                        <HugeiconsIcon icon={Delete01Icon} size={15} />
                      </button>
                    </div>
                  </div>

                  <!-- Accordion Expanded Panel (CSS grid-template-rows expansion) -->
                  <div
                    class="grid transition-all duration-250 ease-out border-t {isExpanded ? 'border-border/30' : 'border-transparent'}"
                    style="grid-template-rows: {isExpanded ? '1fr' : '0fr'};"
                  >
                    <div class="overflow-hidden">
                      {#if isExpanded}
                        <div class="p-4 pt-3 space-y-4 bg-muted/5">
                          <!-- Subject essentials -->
                          <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
                            <div class="sm:col-span-6 space-y-1">
                              <label for="paperSubject_{idx}" class="text-xs font-medium text-muted-foreground">Subject name</label>
                              <input
                                id="paperSubject_{idx}"
                                type="text"
                                bind:value={paperForm.subject}
                                class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-1.5 text-sm focus:outline-none transition-colors"
                                placeholder="e.g. Compiler Design"
                              />
                            </div>

                            <div class="sm:col-span-3 space-y-1">
                              <label for="paperCode_{idx}" class="text-xs font-medium text-muted-foreground">Code</label>
                              <input
                                id="paperCode_{idx}"
                                type="text"
                                bind:value={paperForm.code}
                                class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-1.5 text-sm focus:outline-none transition-colors"
                                placeholder="e.g. 303105349"
                              />
                            </div>

                            <div class="sm:col-span-3 space-y-1">
                              <label for="paperType_{idx}" class="text-xs font-medium text-muted-foreground">Type</label>
                              <Dropdown
                                id="paperType_{idx}"
                                bind:value={paperForm.type}
                                options={examTypeOptions}
                              />
                            </div>
                          </div>

                          <!-- Date, Time, Duration -->
                          <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
                            <div class="sm:col-span-4 space-y-1">
                              <label for="paperDate_{idx}" class="text-xs font-medium text-muted-foreground">Date</label>
                              <input
                                id="paperDate_{idx}"
                                type="date"
                                bind:value={paperForm.date}
                                class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-1.5 text-sm focus:outline-none transition-colors"
                              />
                            </div>

                            <div class="sm:col-span-4 space-y-1">
                              <label for="paperTime_{idx}" class="text-xs font-medium text-muted-foreground">Time</label>
                              <input
                                id="paperTime_{idx}"
                                type="text"
                                bind:value={paperForm.time}
                                class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-1.5 text-sm focus:outline-none transition-colors"
                                placeholder="14:00"
                              />
                            </div>

                            <div class="sm:col-span-4 space-y-1">
                              <label for="paperDuration_{idx}" class="text-xs font-medium text-muted-foreground">Duration</label>
                              <input
                                id="paperDuration_{idx}"
                                type="text"
                                bind:value={paperForm.duration}
                                class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-1.5 text-sm focus:outline-none transition-colors"
                                placeholder="150 mins"
                              />
                            </div>
                          </div>

                          <!-- Cover Image (Rendered only, no text link) -->
                          <div class="space-y-2 pt-1">
                            <div class="flex items-center justify-between">
                              <span class="text-xs font-medium text-muted-foreground">
                                Subject cover image
                              </span>
                              {#if paperForm.coverImage}
                                <button
                                  type="button"
                                  onclick={() => (paperForm.coverImage = '')}
                                  class="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer"
                                >
                                  Remove
                                </button>
                              {/if}
                            </div>

                            {#if paperForm.coverImage}
                              <div class="flex items-center gap-3">
                                <div class="w-20 h-14 rounded-xl overflow-hidden bg-muted/30 border border-border/40 shrink-0 shadow-xs relative">
                                  <img
                                    src={paperForm.coverImage}
                                    alt="Cover preview"
                                    class="w-full h-full object-cover"
                                    onerror={(e) => {
                                      const target = e.currentTarget as HTMLImageElement;
                                      target.style.display = 'none';
                                    }}
                                  />
                                </div>
                                <label
                                  class="px-3 py-1.5 rounded-lg border border-border/60 hover:bg-muted/50 text-foreground text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  <HugeiconsIcon
                                    icon={isUploadingPaperCover ? Loading03Icon : CloudUploadIcon}
                                    size={14}
                                    class={isUploadingPaperCover ? 'animate-spin' : ''}
                                  />
                                  <span>{isUploadingPaperCover ? 'Uploading...' : 'Change cover image'}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onchange={handlePaperCoverUpload}
                                    class="hidden"
                                  />
                                </label>
                              </div>
                            {:else}
                              <label
                                class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-border/80 hover:border-primary/60 bg-muted/10 hover:bg-muted/20 text-xs font-medium text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                              >
                                <HugeiconsIcon
                                  icon={isUploadingPaperCover ? Loading03Icon : CloudUploadIcon}
                                  size={16}
                                  class={isUploadingPaperCover ? 'animate-spin text-primary' : 'text-primary'}
                                />
                                <span>{isUploadingPaperCover ? 'Uploading cover...' : 'Upload cover image'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onchange={handlePaperCoverUpload}
                                  class="hidden"
                                />
                              </label>
                            {/if}
                          </div>

                          <!-- Additional Options (Aliases & Syllabus) -->
                          <div class="pt-1">
                            <button
                              type="button"
                              onclick={() => (showSubjectAdvanced = !showSubjectAdvanced)}
                              class="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1 font-medium"
                            >
                              <span>{showSubjectAdvanced ? '− Fewer options' : '+ Additional options (aliases, syllabus)'}</span>
                            </button>

                            {#if showSubjectAdvanced}
                              <div class="space-y-3 pt-3">
                                <div class="space-y-1">
                                  <label for="paperAliases_{idx}" class="text-xs font-medium text-muted-foreground">
                                    Aliases (comma-separated)
                                  </label>
                                  <input
                                    id="paperAliases_{idx}"
                                    type="text"
                                    bind:value={paperForm.aliasesText}
                                    class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-1.5 text-xs focus:outline-none transition-colors"
                                    placeholder="e.g. CD, Compiler"
                                  />
                                </div>

                                <div class="space-y-1">
                                  <label for="paperSyllabus_{idx}" class="text-xs font-medium text-muted-foreground">
                                    Syllabus units (separated by blank lines)
                                  </label>
                                  <textarea
                                    id="paperSyllabus_{idx}"
                                    rows="3"
                                    bind:value={paperForm.syllabusText}
                                    class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-1.5 text-xs focus:outline-none transition-colors"
                                    placeholder="Unit 1: Lexical Analysis...&#10;&#10;Unit 2: Syntax Analysis..."
                                  ></textarea>
                                </div>
                              </div>
                            {/if}
                          </div>

                          <div class="flex items-center justify-end gap-2 pt-2 border-t border-border/20">
                            <button
                              type="button"
                              onclick={cancelSubjectForm}
                              class="px-3 py-1.5 rounded-lg hover:bg-muted/60 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onclick={saveSubjectForm}
                              class="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all cursor-pointer shadow-2xs"
                            >
                              Update subject
                            </button>
                          </div>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- ==================================================== -->
      <!-- TAB 3: SEATING                                       -->
      <!-- ==================================================== -->
      {#if scheduleModalTab === 'seating'}
        <div class="space-y-6 animate-in fade-in duration-200">
          <!-- Section 1: Master Period Seating File -->
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-semibold text-foreground">Master period seating file (.csv)</h4>
                <p class="text-[11px] text-muted-foreground">
                  Applied to all subjects in this exam period (e.g. viva.csv or mid-sem schedule).
                </p>
              </div>
              {#if scheduleForm.seatingDataUrl}
                <button
                  type="button"
                  onclick={() => (scheduleForm.seatingDataUrl = '')}
                  class="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer"
                >
                  Remove
                </button>
              {/if}
            </div>

            <div class="flex items-center gap-2">
              <input
                id="schedMasterCsv"
                type="text"
                bind:value={scheduleForm.seatingDataUrl}
                class="flex-1 bg-transparent border-0 border-b border-border/70 focus:border-primary rounded-none px-0 py-1.5 text-xs font-mono focus:outline-none transition-colors truncate"
                placeholder="Optional: link or upload master .csv"
              />

              {#if scheduleForm.seatingDataUrl}
                <a
                  href={scheduleForm.seatingDataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 rounded-lg border border-emerald-500/30 transition-colors shrink-0"
                  title="Open current master seating file (.csv)"
                >
                  <HugeiconsIcon icon={Link01Icon} size={15} />
                </a>
              {/if}

              <label
                class="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 border border-border/40 transition-colors cursor-pointer shrink-0"
                title="Upload or replace master seating (.csv)"
              >
                <HugeiconsIcon
                  icon={isUploadingPeriodCsv ? Loading03Icon : CloudUploadIcon}
                  size={15}
                  class={isUploadingPeriodCsv ? 'animate-spin' : ''}
                />
                <input
                  type="file"
                  accept=".csv"
                  onchange={handlePeriodCsvUpload}
                  class="hidden"
                />
              </label>
            </div>
          </div>

          <!-- Section 2: Subject-Level Overrides List -->
          <div class="space-y-3 pt-3 border-t border-border/30">
            <div>
              <h4 class="text-xs font-semibold text-foreground">Subject seating overrides</h4>
              <p class="text-[11px] text-muted-foreground">
                Manage seating files for individual subjects. Overrides take precedence over the master period file.
              </p>
            </div>

            {#if scheduleForm.exams.length === 0}
              <p class="text-xs text-muted-foreground py-4 text-center">
                Add subjects in the Timetable tab to configure individual seating files.
              </p>
            {:else}
              <div class="divide-y divide-border/30 border-y border-border/30 max-h-64 overflow-y-auto">
                {#each scheduleForm.exams as exam, examIdx}
                  <div class="py-2.5 px-1 flex items-center justify-between gap-3 text-xs">
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                      <!-- Rendered Cover Image Thumbnail Preview (if available) -->
                      {#if exam.coverImage}
                        <div class="w-8 h-8 rounded-lg overflow-hidden bg-muted/30 border border-border/40 shrink-0">
                          <img
                            src={exam.coverImage}
                            alt={exam.subject}
                            class="w-full h-full object-cover"
                            onerror={(e) => {
                              const target = e.currentTarget as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      {/if}

                      <div class="space-y-0.5 min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <span class="font-medium text-foreground truncate">{exam.subject}</span>
                          {#if exam.code}
                            <span class="font-mono text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded">
                              {exam.code}
                            </span>
                          {/if}
                        </div>

                        <div class="text-[11px]">
                          {#if exam.seatingDataUrl}
                            <span class="text-emerald-600 dark:text-emerald-400 font-medium">Custom seating override active</span>
                          {:else if scheduleForm.seatingDataUrl}
                            <span class="text-muted-foreground">Inherits master period seating</span>
                          {:else}
                            <span class="text-muted-foreground/70">No seating file linked</span>
                          {/if}
                        </div>
                      </div>
                    </div>

                    <!-- Pure Icon Actions for Subject Seating -->
                    <div class="flex items-center gap-1 shrink-0">
                      {#if exam.seatingDataUrl}
                        <a
                          href={exam.seatingDataUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 rounded-lg border border-emerald-500/30 transition-colors"
                          title="Open custom subject seating (.csv)"
                        >
                          <HugeiconsIcon icon={Link01Icon} size={14} />
                        </a>

                        <button
                          type="button"
                          onclick={() => removeSubjectSeatingInModal(examIdx)}
                          class="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors cursor-pointer"
                          title="Remove custom override (revert to master period seating)"
                        >
                          <HugeiconsIcon icon={Delete01Icon} size={14} />
                        </button>
                      {/if}

                      <label
                        class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 border border-border/40 transition-colors cursor-pointer"
                        title={exam.seatingDataUrl ? 'Replace subject seating (.csv)' : 'Upload custom subject seating (.csv)'}
                      >
                        <HugeiconsIcon icon={CloudUploadIcon} size={14} />
                        <input
                          type="file"
                          accept=".csv"
                          onchange={(e) => handleSubjectSeatingUploadInModal(examIdx, e)}
                          class="hidden"
                        />
                      </label>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Modal Footer -->
      <div class="flex items-center justify-between pt-4 border-t border-border/50">
        <button
          type="button"
          onclick={() => (isScheduleModalOpen = false)}
          class="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Cancel
        </button>

        <div class="flex items-center gap-2">
          {#if scheduleModalTab !== 'general'}
            <button
              type="button"
              onclick={() => {
                if (scheduleModalTab === 'seating') scheduleModalTab = 'timetable';
                else if (scheduleModalTab === 'timetable') scheduleModalTab = 'general';
              }}
              class="px-3.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
            >
              Back
            </button>
          {/if}

          {#if scheduleModalTab !== 'seating'}
            <button
              type="button"
              onclick={() => {
                if (scheduleModalTab === 'general') scheduleModalTab = 'timetable';
                else if (scheduleModalTab === 'timetable') scheduleModalTab = 'seating';
              }}
              class="px-3.5 py-2 rounded-xl text-xs font-medium text-foreground bg-muted/60 hover:bg-muted transition-colors cursor-pointer"
            >
              Next
            </button>
          {/if}

          <button
            type="submit"
            disabled={isSavingConfig}
            class="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
          >
            {isSavingConfig ? 'Saving...' : editingScheduleIndex !== null ? 'Save changes' : 'Create schedule'}
          </button>
        </div>
      </div>
    </form>
  </Modal>

  <!-- ======================================================== -->
  <!-- GLOBAL SETTINGS MODAL (Minimalist & Clean)               -->
  <!-- ======================================================== -->
  <Modal
    bind:isOpen={isGlobalSettingsOpen}
    title="Global exam settings"
    onClose={() => (isGlobalSettingsOpen = false)}
    maxWidthClass="sm:max-w-xl"
  >
    <div class="space-y-6">
      <!-- Enable Switch -->
      <div class="flex items-center justify-between pb-4 border-b border-border/40">
        <div class="space-y-0.5">
          <div class="text-sm font-medium text-foreground">Exam feature active</div>
          <div class="text-xs text-muted-foreground">
            Enables exam cards, countdowns, and timeline on student interfaces.
          </div>
        </div>
        <Checkbox bind:checked={config.enabled} />
      </div>

      <!-- Rotation Interval & Lead Times -->
      <div class="space-y-4">
        <div class="space-y-1.5">
          <label for="globInterval" class="text-xs font-medium text-muted-foreground">
            Card view rotation interval (ms)
          </label>
          <input
            id="globInterval"
            type="number"
            min="1000"
            step="1000"
            bind:value={config.viewRotationInterval}
            class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
          />
          <p class="text-[11px] text-muted-foreground">
            Default 15,000ms (15 seconds) shuffle interval between ongoing and upcoming views.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label for="globBefore" class="text-xs font-medium text-muted-foreground">
              Show card before (days)
            </label>
            <input
              id="globBefore"
              type="number"
              min="1"
              bind:value={config.showBeforeDays}
              class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
            />
            <p class="text-[11px] text-muted-foreground">For theory / end-sem exams (e.g. 9 days).</p>
          </div>

          <div class="space-y-1.5">
            <label for="globBeforeViva" class="text-xs font-medium text-muted-foreground">
              Show viva before (days)
            </label>
            <input
              id="globBeforeViva"
              type="number"
              min="1"
              bind:value={config.showBeforeDaysViva}
              class="w-full bg-transparent border-0 border-b border-border/80 focus:border-primary rounded-none px-0 py-2 text-sm focus:outline-none transition-colors"
            />
            <p class="text-[11px] text-muted-foreground">For viva & practical exams (e.g. 3 days).</p>
          </div>
        </div>
      </div>

      <!-- Global Default Cover Image (Rendered only, no text link) -->
      <div class="space-y-2 pt-2 border-t border-border/40">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-muted-foreground">
            Global default cover image
          </span>
          {#if config.defaultCoverImage}
            <button
              type="button"
              onclick={() => (config.defaultCoverImage = '')}
              class="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer"
            >
              Remove image
            </button>
          {/if}
        </div>

        {#if config.defaultCoverImage}
          <div class="relative w-full h-32 rounded-xl overflow-hidden bg-muted/30 border border-border/40 shadow-xs group">
            <img
              src={config.defaultCoverImage}
              alt="Global cover preview"
              class="w-full h-full object-cover"
              onerror={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <div class="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2.5">
              <label
                class="px-3 py-1.5 rounded-lg bg-background/90 hover:bg-background text-foreground text-xs font-medium shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5 backdrop-blur-xs"
              >
                <HugeiconsIcon
                  icon={isUploadingGlobalCover ? Loading03Icon : CloudUploadIcon}
                  size={14}
                  class={isUploadingGlobalCover ? 'animate-spin' : ''}
                />
                <span>{isUploadingGlobalCover ? 'Uploading...' : 'Replace image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onchange={handleGlobalCoverUpload}
                  class="hidden"
                />
              </label>
            </div>
          </div>
        {:else}
          <label
            class="w-full h-24 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/60 bg-muted/10 hover:bg-muted/20 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon
              icon={isUploadingGlobalCover ? Loading03Icon : CloudUploadIcon}
              size={18}
              class={isUploadingGlobalCover ? 'animate-spin text-primary' : 'text-primary'}
            />
            <span class="text-xs font-medium">{isUploadingGlobalCover ? 'Uploading...' : 'Upload global fallback cover image'}</span>
            <input
              type="file"
              accept="image/*"
              onchange={handleGlobalCoverUpload}
              class="hidden"
            />
          </label>
        {/if}
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between pt-4 border-t border-border/50">
        <button
          type="button"
          onclick={() => (isGlobalSettingsOpen = false)}
          class="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Close
        </button>

        <button
          type="button"
          disabled={isSavingConfig}
          onclick={async () => {
            await saveFullConfig();
            isGlobalSettingsOpen = false;
          }}
          class="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all cursor-pointer shadow-xs"
        >
          {isSavingConfig ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </div>
  </Modal>
</div>
