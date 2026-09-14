<script lang="ts">
  import { makeAdminRequest } from '$lib/api/admin';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { CloudUploadIcon, Add01Icon, Delete01Icon, Upload01Icon } from '@hugeicons/core-free-icons';
  import { addToast } from '$lib/stores/toast';
  import Checkbox from '$lib/components/Checkbox.svelte';
  import Dropdown from '$lib/components/Dropdown.svelte';

  // Constants
  const SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9 (Miscellaneous)'];
  const CATEGORIES = [
    'Syllabus', 'Chapters', 'Presentations', 'Assignments', 'Question Banks', 'Lab', 
    'Previous Year Papers', 'Reference Books', 'Lecture Notes', 'Handwritten Notes',
    'NPTEL Book', 'NPTEL Assignment with Solutions', 'NPTEL Weekly Materials', 'Other'
  ];

  let semesterSubjectMappings: Record<string, string[]> = $state({
    "1": ["Engineering Mathematics I", "Physics", "Chemistry", "Engineering Graphics", "Basic Electrical Engineering", "Programming for Problem Solving"],
    "2": ["Engineering Mathematics II", "Physics II", "Chemistry II", "Engineering Mechanics", "Basic Electronics Engineering", "Engineering Graphics II"],
    "3": ["Engineering Mathematics III", "Data Structures and Algorithms", "Digital Logic Design", "Computer Organization", "Object Oriented Programming", "Database Management Systems"],
    "4": ["Engineering Mathematics IV", "Operating Systems", "Computer Networks", "Software Engineering", "Theory of Computation", "Microprocessors"],
    "5": ["Machine Learning", "Artificial Intelligence", "Compiler Design", "Computer Graphics", "Distributed Systems", "Web Technologies"],
    "6": ["Data Mining", "Information Security", "Mobile Computing", "Cloud Computing", "Internet of Things", "Elective I"],
    "7": ["Major Project I", "Advanced Algorithms", "Blockchain Technology", "DevOps", "Elective II", "Internship"],
    "8": ["Major Project II", "Industry Training", "Seminar", "Elective III", "Placement Training", "Final Viva"]
  });

  import { onMount } from 'svelte';
  
  onMount(async () => {
    try {
      const response = await makeAdminRequest('cdn?path=databases/semester-subjects.json', 'GET') as any;
      if (response && response.download_url) {
        const mappingResponse = await fetch(response.download_url);
        if (mappingResponse.ok) {
          semesterSubjectMappings = await mappingResponse.json();
        }
      }
    } catch (e) {
      console.warn('Failed to load semester-subject mappings from GitHub/CDN, using defaults');
    }
  });

  type UploadSection = {
    id: number;
    semester: string;
    subject: string;
    customSubject: string;
    category: string;
    customCategory: string;
    files: { file: File; name: string }[];
  };

  let sections = $state<UploadSection[]>([{
    id: Date.now(),
    semester: '',
    subject: '',
    customSubject: '',
    category: '',
    customCategory: '',
    files: []
  }]);

  let isUploading = $state(false);
  let uploadProgress = $state(0);
  let uploadStatus = $state('');
  let autoPushNotify = $state(true);
  
  let draggedItemIndex = $state<number | null>(null);
  let draggedSectionId = $state<number | null>(null);

  let matchPreviousSemester = $state(false);
  let matchPreviousSubject = $state(false);
  let matchBoth = $state(false);

  function handleIndividualChange() {
    matchBoth = matchPreviousSemester && matchPreviousSubject;
  }

  function handleBothChange() {
    matchPreviousSemester = matchBoth;
    matchPreviousSubject = matchBoth;
  }

  function addSection() {
    const lastSection = sections.length > 0 ? sections[sections.length - 1] : null;
    
    sections.push({
      id: Date.now(),
      semester: matchPreviousSemester && lastSection ? lastSection.semester : '',
      subject: matchPreviousSubject && lastSection ? lastSection.subject : '',
      customSubject: matchPreviousSubject && lastSection ? lastSection.customSubject : '',
      category: '',
      customCategory: '',
      files: []
    });
  }

  function removeSection(id: number) {
    sections = sections.filter(s => s.id !== id);
  }

  function handleFileDrop(e: DragEvent, section: UploadSection) {
    e.preventDefault();
    if (e.dataTransfer?.files) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
      section.files = [...section.files, ...newFiles.map(f => ({ file: f, name: f.name.replace('.pdf', '') }))];
    }
  }

  function handleFileInput(e: Event, section: UploadSection) {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files).filter(f => f.type === 'application/pdf');
      section.files = [...section.files, ...newFiles.map(f => ({ file: f, name: f.name.replace('.pdf', '') }))];
    }
  }

  function removeFile(section: UploadSection, index: number) {
    section.files.splice(index, 1);
  }

  function handleDragStart(e: DragEvent, sectionId: number, index: number) {
    draggedItemIndex = index;
    draggedSectionId = sectionId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOver(e: DragEvent, sectionId: number, index: number) {
    e.preventDefault();
    if (draggedSectionId === sectionId && draggedItemIndex !== null && draggedItemIndex !== index) {
      const section = sections.find(s => s.id === sectionId);
      if (section) {
        const items = [...section.files];
        const draggedItem = items[draggedItemIndex];
        items.splice(draggedItemIndex, 1);
        items.splice(index, 0, draggedItem);
        section.files = items;
        draggedItemIndex = index;
      }
    }
  }

  function handleDragEnd() {
    draggedItemIndex = null;
    draggedSectionId = null;
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  async function uploadAll() {
    // Validate
    for (const section of sections) {
      if (!section.semester || (!section.subject && !section.customSubject) || (!section.category && !section.customCategory)) {
        addToast('Please fill out all fields for each section.', 'warning');
        return;
      }
      if (section.files.length === 0) {
        addToast('Please add at least one file to each section.', 'warning');
        return;
      }
      for (const fileObj of section.files) {
        if (!fileObj.name.trim()) {
          addToast('File names cannot be empty.', 'warning');
          return;
        }
      }
    }

    isUploading = true;
    uploadProgress = 0;
    uploadStatus = 'Preparing files...';
    
    try {
      // Collect all valid files across all sections
      const stagedFiles = [];
      let totalFiles = 0;
      for (const section of sections) {
        totalFiles += section.files.length;
      }

      let processedFiles = 0;

      for (const section of sections) {
        const finalSubject = section.subject || section.customSubject;
        const finalCategory = section.category === 'Other' ? section.customCategory : section.category;
        
        // Path logic matching legacy BTech
        const semClean = section.semester.replace(' (Miscellaneous)', '');
        const pathBase = `pdfs/${semClean}/${finalSubject}/${finalCategory}`;
        
        for (const fileObj of section.files) {
          uploadStatus = `Processing ${fileObj.name}.pdf...`;
          const base64Content = await fileToBase64(fileObj.file);
          
          stagedFiles.push({
            path: `${pathBase}/${fileObj.name}.pdf`,
            content: base64Content
          });

          processedFiles++;
          uploadProgress = Math.round((processedFiles / totalFiles) * 50); // First 50% for processing
        }
      }
      
      uploadStatus = 'Committing files to GitHub...';
      
      const payload = {
        stagedFiles,
        autoPushNotify,
        commitMessage: `Added ${totalFiles} new material(s) via Admin Panel`
      };

      await makeAdminRequest('cdn?commit=true', 'POST', payload);
      
      uploadProgress = 100;
      uploadStatus = 'All files uploaded successfully!';
      setTimeout(() => {
        isUploading = false;
        uploadStatus = '';
        uploadProgress = 0;
        // Reset
        sections = [{
          id: Date.now(),
          semester: '',
          subject: '',
          customSubject: '',
          category: '',
          customCategory: '',
          files: []
        }];
      }, 3000);
    } catch (e: any) {
      addToast(`Upload failed: ${e.message}`, 'error');
      isUploading = false;
    }
  }
</script>

<div class="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
  <div class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-foreground tracking-tight">Course Uploads</h1>
      <p class="text-muted-foreground mt-1 text-sm">Upload course materials directly to the CDN.</p>
    </div>
    <div class="flex items-center gap-3">
      <button onclick={addSection} class="btn-base btn-secondary">
        <HugeiconsIcon icon={Add01Icon} size={16} />
        Add Section
      </button>
      <button onclick={uploadAll} disabled={isUploading} class="btn-base btn-primary">
        <HugeiconsIcon icon={Upload01Icon} size={16} />
        {isUploading ? 'Uploading...' : 'Upload All'}
      </button>
    </div>
  </div>

  {#if isUploading}
    <div class="bg-card border border-border p-6 rounded-2xl shadow-sm">
      <div class="flex justify-between text-sm mb-2 font-medium">
        <span>{uploadStatus}</span>
        <span>{uploadProgress}%</span>
      </div>
      <div class="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <div class="h-full bg-primary transition-all duration-300" style="width: {uploadProgress}%"></div>
      </div>
    </div>
  {/if}

  <div class="space-y-4">
    <div class="p-4 bg-muted/20 border border-border/50 rounded-xl">
      <h3 class="text-sm font-semibold text-foreground mb-3">Upload Settings</h3>
      <div class="flex flex-col gap-3">
        <Checkbox 
          id="autoPushNotify" 
          bind:checked={autoPushNotify} 
          label="Automatically create a notification when materials are uploaded" 
        />
        
        <div class="pt-2 border-t border-border/50 flex flex-col sm:flex-row gap-4 sm:items-center">
          <span class="text-sm font-medium text-foreground mr-2">When adding a new section:</span>
          <Checkbox 
            id="matchBoth" 
            bind:checked={matchBoth} 
            onchange={handleBothChange}
            label="Match Both" 
          />
          <Checkbox 
            id="matchPrevSem" 
            bind:checked={matchPreviousSemester} 
            onchange={handleIndividualChange}
            label="Match Previous Semester" 
          />
          <Checkbox 
            id="matchPrevSubj" 
            bind:checked={matchPreviousSubject} 
            onchange={handleIndividualChange}
            label="Match Previous Subject" 
          />
        </div>
      </div>
    </div>
  </div>

  <div class="space-y-6">
    {#each sections as section (section.id)}
      <div class="bg-transparent border-b border-border/50 pb-8">
        <div class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4 mb-6">
          <h3 class="font-semibold text-foreground flex items-center gap-2">
            Section
          </h3>
          {#if sections.length > 1}
            <button onclick={() => removeSection(section.id)} class="text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition-colors">
              <HugeiconsIcon icon={Delete01Icon} size={16} />
            </button>
          {/if}
        </div>
        
        <div class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Semester -->
            <div class="space-y-2">
              <div class="text-sm font-medium text-foreground">Semester</div>
              <Dropdown 
                bind:value={section.semester} 
                options={SEMESTERS.map(s => ({ value: s, label: `Semester ${s}` }))}
                placeholder="Select Semester"
              />
            </div>

            <!-- Subject -->
            <div class="space-y-2">
              <div class="text-sm font-medium text-foreground">Subject</div>
              {#if section.semester && semesterSubjectMappings[section.semester.replace(' (Miscellaneous)', '')]}
                <Dropdown 
                  bind:value={section.subject} 
                  options={[
                    ...semesterSubjectMappings[section.semester.replace(' (Miscellaneous)', '')].map(s => ({ value: s, label: s })),
                    { value: 'Other', label: 'Add New Subject...' }
                  ]}
                  placeholder="Select Subject"
                />
              {:else}
                <Dropdown 
                  disabled
                  placeholder="Select Semester First"
                />
              {/if}

              {#if section.subject === 'Other' || (!semesterSubjectMappings[section.semester.replace(' (Miscellaneous)', '')] && section.semester)}
                <input aria-label="Custom subject" id={`subj-custom-${section.id}`} type="text" bind:value={section.customSubject} placeholder="Type subject name..." class="w-full h-10 px-3 mt-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all" />
              {/if}
            </div>

            <!-- Category -->
            <div class="space-y-2">
              <div class="text-sm font-medium text-foreground">Category</div>
              <Dropdown 
                bind:value={section.category} 
                options={CATEGORIES.map(c => ({ value: c, label: c }))}
                placeholder="Select Category"
              />
              {#if section.category === 'Other'}
                <input aria-label="Custom category" type="text" bind:value={section.customCategory} placeholder="Custom category..." class="w-full h-10 px-3 mt-2 rounded-xl border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all" />
              {/if}
            </div>
          </div>

          <!-- Upload Area -->
          <div class="space-y-2">
            <div class="text-sm font-medium text-foreground">Files (PDF only)</div>
            <div 
              class="border-2 border-dashed border-border rounded-xl p-8 text-center hover:bg-muted/30 transition-colors cursor-pointer group"
              ondragover={(e) => e.preventDefault()}
              ondrop={(e) => handleFileDrop(e, section)}
              onclick={() => document.getElementById(`file-${section.id}`)?.click()}
              onkeydown={(e) => e.key === 'Enter' && document.getElementById(`file-${section.id}`)?.click()}
              role="button"
              tabindex="0"
            >
              <input type="file" id={`file-${section.id}`} multiple accept=".pdf" class="hidden" onchange={(e) => handleFileInput(e, section)} />
              <div class="flex flex-col items-center justify-center gap-3">
                <div class="h-12 w-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center group-hover:scale-110 transition-transform">
                  <HugeiconsIcon icon={CloudUploadIcon} size={24} />
                </div>
                <div>
                  <p class="font-medium text-foreground">Click to upload or drag and drop</p>
                  <p class="text-xs text-muted-foreground mt-1">Only .pdf files are supported</p>
                </div>
              </div>
            </div>
          </div>

          <!-- File List -->
          {#if section.files.length > 0}
            <div class="space-y-3">
              <h4 class="text-sm font-medium text-foreground">Selected Files ({section.files.length}) - Drag to reorder</h4>
              <div class="grid grid-cols-1 gap-3">
                {#each section.files as fileObj, i}
                  <div 
                    role="listitem"
                    draggable="true"
                    ondragstart={(e) => handleDragStart(e, section.id, i)}
                    ondragover={(e) => handleDragOver(e, section.id, i)}
                    ondragend={handleDragEnd}
                    class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50 gap-3 cursor-move hover:bg-muted/50 transition-colors {draggedItemIndex === i && draggedSectionId === section.id ? 'opacity-50' : ''}"
                  >
                    <div class="flex items-center gap-3 w-full">
                      <HugeiconsIcon icon={CloudUploadIcon} size={16} class="text-muted-foreground shrink-0" />
                      <div class="flex items-center gap-1 w-full max-w-[200px] sm:max-w-[300px]">
                        <input 
                          type="text" 
                          bind:value={fileObj.name} 
                          class="w-full bg-background border border-input rounded-md px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder="File name"
                        />
                        <span class="text-muted-foreground text-sm">.pdf</span>
                      </div>
                    </div>
                    <button type="button" onclick={() => removeFile(section, i)} class="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-1.5 hover:bg-destructive/10 rounded-lg">
                      <HugeiconsIcon icon={Delete01Icon} size={16} />
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>
