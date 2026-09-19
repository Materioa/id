<svelte:head>
  <title>Exams</title>
</svelte:head>

<script lang="ts">
  import { makeAdminRequest } from '$lib/api/admin';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { Add01Icon, Delete01Icon, FileEditIcon, Edit01Icon, FloppyDiskIcon, CheckmarkBadge01Icon, CloudUploadIcon, Loading03Icon } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';
  import { addToast } from '$lib/stores/toast';
  import ConfirmModal from '$lib/components/ConfirmModal.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import Checkbox from '$lib/components/Checkbox.svelte';
  import { fade } from 'svelte/transition';

  type Exam = {
    subject: string;
    code: string;
    date: string;
    time: string;
    duration: string;
    global: boolean;
  };

  type Semester = {
    semester: number;
    examPeriod: { name: string; shortName: string };
    exams: Exam[];
    seatingDataUrl?: string;
  };

  type ExamConfig = {
    enabled: boolean;
    viewRotationInterval: number;
    showBeforeDays: number;
    showBeforeDaysViva: number;
    defaultCoverImage: string;
    seatingDataUrl: string;
    semesters: Semester[];
  };

  let showConfigModal = $state(false);
  let isSavingConfig = $state(false);

  // Confirm Modal state
  let isConfirmOpen = $state(false);
  let confirmTitle = $state('');
  let confirmMessage = $state('');
  let onConfirmAction = $state<() => void>(() => {});
  let isUploadingCsv = $state(false);

  async function handleCsvUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      addToast('Please upload a CSV file');
      return;
    }

    isUploadingCsv = true;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const semId = editingExam.semId;
      formData.append('path', `exams/seating/sem-${semId}-${Date.now()}-${file.name}`);
      
      const res = await fetch('/api/v2/admin/upload', {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      editingExam.seatingDataUrl = data.url;
    } catch (err: any) {
      console.error(err);
      addToast('Failed to upload CSV: ' + err.message);
    } finally {
      isUploadingCsv = false;
      input.value = '';
    }
  }

  let error = $state('');
  let activeTab = $state<'active' | 'history'>('active');
  
  let config = $state<ExamConfig>({
    enabled: false,
    viewRotationInterval: 15000,
    showBeforeDays: 9,
    showBeforeDaysViva: 3,
    defaultCoverImage: '',
    seatingDataUrl: '',
    semesters: []
  });

    let isExamModalOpen = $state(false);
  let editingExam = $state({
    semId: 1,
    periodName: 'Mid Semester',
    periodShort: 'Mid Sem',
    seatingDataUrl: '',
    subject: '',
    code: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM',
    duration: '2 Hours',
    global: false,
    origSemIdx: -1,
    origExamIdx: -1
  });

  let allExams = $derived(config.semesters.flatMap((sem, sIdx) => 
    sem.exams.map((ex, eIdx) => ({
      ...ex,
      semId: sem.semester,
      periodName: sem.examPeriod.name,
      periodShort: sem.examPeriod.shortName,
      origSemIdx: sIdx,
      origExamIdx: eIdx
    }))
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

  let activeExams = $derived(allExams.filter(e => new Date(e.date) >= new Date(new Date().setHours(0,0,0,0))));
  let historyExams = $derived(allExams.filter(e => new Date(e.date) < new Date(new Date().setHours(0,0,0,0))));

  async function loadData() {
    isLoading = true;
    error = '';
    try {
      const res: any = await makeAdminRequest('exams/config', 'GET');
      if (res && res.config) {
        config = {
          enabled: res.config.enabled || false,
          viewRotationInterval: res.config.viewRotationInterval || 15000,
          showBeforeDays: res.config.showBeforeDays || 9,
          showBeforeDaysViva: res.config.showBeforeDaysViva || 3,
          defaultCoverImage: res.config.defaultCoverImage || '',
          seatingDataUrl: res.config.seatingDataUrl || '',
          semesters: res.config.semesters || []
        };
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  let isLoading = $state(true);

  onMount(() => {
    loadData();
  });

  async function saveConfig() {
    isSavingConfig = true;
    try {
      await makeAdminRequest('exams/config', 'POST', config);
      addToast('Configuration and schedules saved successfully!');
      cancelEdit();
    } catch (e: any) {
      addToast(`Failed to save config: ${e.message}`);
    } finally {
      isSavingConfig = false;
    }
  }

  function saveExam(e: Event) {
    e.preventDefault();
    const { semId, periodName, periodShort, seatingDataUrl, origSemIdx, origExamIdx, ...examData } = editingExam;
    
    // Remove old exam if editing
    if (origSemIdx !== -1 && origExamIdx !== -1) {
      config.semesters[origSemIdx].exams = config.semesters[origSemIdx].exams.filter((_, i) => i !== origExamIdx);
    }
    
    // Find or create semester
    let targetSem = config.semesters.find(s => s.semester === semId);
    if (!targetSem) {
      targetSem = { semester: semId, examPeriod: { name: periodName, shortName: periodShort }, seatingDataUrl, exams: [] };
      config.semesters.push(targetSem);
    } else {
      // Update period names if they changed
      targetSem.examPeriod.name = periodName;
      targetSem.examPeriod.shortName = periodShort;
      targetSem.seatingDataUrl = seatingDataUrl;
    }
    
    // Add exam
    targetSem.exams.push(examData);
    
    // Cleanup empty semesters
    config.semesters = config.semesters.filter(s => s.exams.length > 0);
    
    saveConfig();
  }

  function editExam(exam: any) {
    isExamModalOpen = true;
    editingExam = { ...exam };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    editingExam = {
      semId: 1,
      periodName: 'Mid Semester',
      periodShort: 'Mid Sem',
      seatingDataUrl: '',
      subject: '',
      code: '',
      date: new Date().toISOString().split('T')[0],
      time: '10:00 AM',
      duration: '2 Hours',
      global: false,
      origSemIdx: -1,
      origExamIdx: -1
    };
  }

  function deleteExam(semIdx: number, examIdx: number) {
    confirmTitle = 'Delete Exam';
    confirmMessage = 'Remove this exam? This action cannot be undone.';
    onConfirmAction = () => {
      config.semesters[semIdx].exams = config.semesters[semIdx].exams.filter((_, i) => i !== examIdx);
      config.semesters = config.semesters.filter(s => s.exams.length > 0);
      saveConfig();
    };
    isConfirmOpen = true;
  }

  async function uploadSeating(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    addToast(`Selected ${input.files.length} file(s) for seating arrangement upload.`);
    input.value = '';
  }
</script>

<div class="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300 h-full flex flex-col">
  <ConfirmModal bind:isOpen={isConfirmOpen} title={confirmTitle} message={confirmMessage} onConfirm={onConfirmAction} confirmText="Delete" />
  
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
    <div>
      <h1 class="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-foreground">Exams & Seating</h1>
      <p class="text-sm text-muted-foreground mt-1">Manage global settings and detailed semester exam schedules.</p>
    </div>
    <div class="flex items-center gap-4">
      <button onclick={saveConfig} disabled={isSavingConfig} class="btn-base btn-primary">
        <HugeiconsIcon icon={FloppyDiskIcon} size={16} />
        {isSavingConfig ? 'Saving...' : 'Save Configuration'}
      </button>
    </div>
  </div>

  {#if error}
    <div class="bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20 text-sm">
      {error}
    </div>
  {/if}

  {#if isLoading}
    <div class="flex items-center justify-center h-48 text-muted-foreground">
      <p class="animate-pulse font-medium">Loading configuration...</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <!-- Left Column: Settings & Form -->
      <div class="lg:col-span-1 border-r border-border/50 sm:pr-8 space-y-12 min-w-0">
        
        <!-- Add / Edit Exam Form -->
        <Modal bind:isOpen={isExamModalOpen} title={editingExam.origSemIdx !== -1 ? 'Edit Exam' : 'Add New Exam'} onClose={cancelEdit}>
          <form onsubmit={(e) => { saveExam(e); isExamModalOpen = false; }} class="space-y-6 px-6 pb-6 pt-2">
            <!-- (Form inner HTML kept roughly same, we just wrapped it) -->
            
            
            <div class="space-y-4">
              <h4 class="text-xs font-semibold text-foreground   mb-2">Semester Settings</h4>
              <div class="grid grid-cols-3 gap-3">
                <div class="space-y-1.5 col-span-1">
                  <label for="semId" class="text-xs font-semibold text-muted-foreground  ">Semester</label>
                  <input id="semId" type="number" bind:value={editingExam.semId} oninput={() => {
                    setTimeout(() => {
                      const existing = config.semesters.find(s => s.semester === editingExam.semId);
                      if (existing) {
                        editingExam.periodName = existing.examPeriod.name;
                        editingExam.periodShort = existing.examPeriod.shortName;
                        editingExam.seatingDataUrl = existing.seatingDataUrl || '';
                      }
                    }, 0);
                  }} required class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" />
                </div>
                <div class="space-y-1.5 col-span-2">
                  <label for="periodName" class="text-xs font-semibold text-muted-foreground  ">Period Name</label>
                  <input id="periodName" type="text" bind:value={editingExam.periodName} required class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="Mid Semester" />
                </div>
              </div>
              
              <div class="space-y-1.5">
                <label for="seatingUrl" class="text-xs font-semibold text-muted-foreground  ">Seating CSV URL (Sem {editingExam.semId})</label>
                <div class="flex flex-col sm:flex-row gap-2 sm:items-center min-w-0">
                  <input type="file" accept=".csv" onchange={handleCsvUpload} class="hidden" id="csvUpload" />
                  <label for="csvUpload" class="cursor-pointer px-3 py-1.5 bg-muted/50 text-foreground text-xs font-medium rounded-md hover:bg-muted transition-colors whitespace-nowrap flex items-center gap-2">
                    <HugeiconsIcon icon={isUploadingCsv ? Loading03Icon : CloudUploadIcon} size={14} class={isUploadingCsv ? 'animate-spin' : ''} />
                    {isUploadingCsv ? 'Uploading...' : 'Upload CSV'}
                  </label>
                  <input id="seatingUrl" type="url" bind:value={editingExam.seatingDataUrl} class="flex-1 min-w-0 bg-transparent border-0 border-b border-border/50 rounded-none px-2 py-1.5 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="https://" />
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <h4 class="text-xs font-semibold text-foreground   mb-2">Exam Details</h4>
              <div class="grid grid-cols-3 gap-3">
                <div class="space-y-1.5 col-span-2">
                  <label for="subject" class="text-xs font-semibold text-muted-foreground  ">Subject</label>
                  <input id="subject" type="text" bind:value={editingExam.subject} required class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="Mathematics" />
                </div>
                <div class="space-y-1.5 col-span-1">
                  <label for="code" class="text-xs font-semibold text-muted-foreground  ">Code</label>
                  <input id="code" type="text" bind:value={editingExam.code} required class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="CS101" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <label for="date" class="text-xs font-semibold text-muted-foreground  ">Date</label>
                  <input id="date" type="date" bind:value={editingExam.date} required class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" />
                </div>
                <div class="space-y-1.5">
                  <label for="time" class="text-xs font-semibold text-muted-foreground  ">Time</label>
                  <input id="time" type="text" bind:value={editingExam.time} required class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="10:00 AM" />
                </div>
              </div>

              <div class="space-y-1.5">
                <label for="duration" class="text-xs font-semibold text-muted-foreground  ">Duration</label>
                <input id="duration" type="text" bind:value={editingExam.duration} required class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="2 Hours" />
              </div>

              <Checkbox bind:checked={editingExam.global} label="Global Exam" />

              <div class="flex items-center gap-3 mt-4">
                <button type="submit" disabled={isSavingConfig} class="w-full btn-base btn-primary mt-4">
                  <HugeiconsIcon icon={editingExam.origSemIdx !== -1 ? Edit01Icon : Add01Icon} size={16} />
                  {editingExam.origSemIdx !== -1 ? 'Update Exam' : 'Add Exam'}
                </button>
                {#if editingExam.origSemIdx !== -1}
                  <button type="button" onclick={cancelEdit} class="w-full btn-base btn-secondary mt-2">
                    Cancel
                  </button>
                {/if}
              </div>
            </div>
          
          </form>
        </Modal>
        
        <div class="mb-6">
          <button onclick={() => isExamModalOpen = true} class="w-full btn-base btn-primary">
            <HugeiconsIcon icon={Add01Icon} size={18} /> Add New Exam
          </button>
        </div>

        <!-- Global Settings -->
        <div class="space-y-4">
          <h2 class="font-semibold text-foreground border-b border-border/50 pb-2">Global Settings</h2>
          
          <div class="flex items-center gap-3 py-2 cursor-pointer transition-colors group">
            <Checkbox bind:checked={config.enabled} />
            <span class="text-sm font-medium text-foreground">Enable Exam System</span>
          </div>

          <div class="space-y-4">
            <div class="space-y-1.5">
              <label for="rotInt" class="text-xs font-semibold text-muted-foreground  ">Rotation Interval (ms)</label>
              <input id="rotInt" type="number" bind:value={config.viewRotationInterval} onchange={saveConfig} class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" />
            </div>
            <div class="space-y-1.5">
              <label for="showBefore" class="text-xs font-semibold text-muted-foreground  ">Show Card Before (Days)</label>
              <input id="showBefore" type="number" bind:value={config.showBeforeDays} onchange={saveConfig} class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" />
            </div>
            <div class="space-y-1.5">
              <label for="vivaBefore" class="text-xs font-semibold text-muted-foreground  ">Show Viva Before (Days)</label>
              <input id="vivaBefore" type="number" bind:value={config.showBeforeDaysViva} onchange={saveConfig} class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" />
            </div>
            <div class="space-y-1.5">
              <label for="defCover" class="text-xs font-semibold text-muted-foreground  ">Default Cover Image</label>
              <input id="defCover" type="url" bind:value={config.defaultCoverImage} onchange={saveConfig} class="w-full bg-transparent border-0 border-b border-border/50 rounded-none px-0 py-2 text-sm focus:ring-0 focus:border-primary outline-none transition-all" placeholder="https://" />
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: List -->
      <div class="lg:col-span-2 space-y-4 sm:pl-4 min-w-0">
        <div class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4 mb-6 border-b border-border/50 pb-4">
          <h3 class="font-semibold text-foreground text-lg">Exam Schedules</h3>
          <div class="flex items-center gap-2 p-1 bg-muted/50 rounded-lg">
            <button 
              onclick={() => activeTab = 'active'}
              class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {activeTab === 'active' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
            >
              Active ({activeExams.length})
            </button>
            <button 
              onclick={() => activeTab = 'history'}
              class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {activeTab === 'history' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
            >
              History ({historyExams.length})
            </button>
          </div>
        </div>

        {#if (activeTab === 'active' ? activeExams : historyExams).length === 0}
          <div class="p-8 border border-border/50 border-dashed rounded-xl text-center text-muted-foreground">
            No {activeTab} exams found.
          </div>
        {:else}
          <div class="overflow-x-auto border border-border/50 rounded-xl bg-card/30">
            <table class="w-full text-sm text-left">
              <thead class="bg-muted/30 text-muted-foreground border-b border-border/50 text-[10px]   font-semibold">
                <tr>
                  <th class="px-4 py-3">Sem</th>
                  <th class="px-4 py-3">Subject</th>
                  <th class="px-4 py-3">Code</th>
                  <th class="px-4 py-3">Date & Time</th>
                  <th class="px-4 py-3">Dur.</th>
                  <th class="px-4 py-3 text-center">Global</th>
                  <th class="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/50">
                {#each (activeTab === 'active' ? activeExams : historyExams) as exam}
                  <tr class="hover:bg-muted/20 transition-colors group">
                    <td class="px-4 py-3 font-medium">Sem {exam.semId}</td>
                    <td class="px-4 py-3 font-medium text-foreground">{exam.subject}</td>
                    <td class="px-4 py-3 text-muted-foreground font-mono">{exam.code}</td>
                    <td class="px-4 py-3">
                      <div class="flex flex-col">
                        <span class="text-foreground">{new Date(exam.date).toLocaleDateString()}</span>
                        <span class="text-xs text-muted-foreground">{exam.time}</span>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-muted-foreground">{exam.duration}</td>
                    <td class="px-4 py-3 text-center">
                      {#if exam.global}
                        <HugeiconsIcon icon={CheckmarkBadge01Icon} size={16} class="text-primary inline" />
                      {:else}
                        <span class="text-muted-foreground">-</span>
                      {/if}
                    </td>
                    <td class="px-4 py-3 text-right">
                      <div class="flex items-center justify-end gap-1">
                        <button onclick={() => editExam({...exam, seatingDataUrl: config.semesters[exam.origSemIdx].seatingDataUrl || ''})} class="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-background transition-colors" title="Edit">
                          <HugeiconsIcon icon={FileEditIcon} size={16} />
                        </button>
                        <button onclick={() => deleteExam(exam.origSemIdx, exam.origExamIdx)} class="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors" title="Delete">
                          <HugeiconsIcon icon={Delete01Icon} size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
