<svelte:head>
  <title>Overview</title>
  <script src="/chart.umd.js"></script>
</svelte:head>

<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { makeAdminRequest } from '$lib/api/admin';
  import { addToast } from '$lib/stores/toast';
  import { goto } from '$app/navigation';
  import Modal from '$lib/components/Modal.svelte';
  import Scritto from '@scritto/svelte';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { BookOpen01Icon, UserGroupIcon, Search01Icon, ShieldBanIcon, Globe02Icon } from '@hugeicons/core-free-icons';
  import D3SemiGlobe, { type LocationPoint } from '$lib/components/D3SemiGlobe.svelte';

  type TopPdf = {
    title: string;
    reads: number;
    unique_readers: number;
  };

  type TopUser = {
    user_id?: string;
    anon_id?: string;
    username?: string;
    display_name?: string;
    participant_type: string;
    reading_time_human: string;
    pdf_reads: number;
    ip_address?: string;
    fingerprint?: string;
  };

  // View Mode: Platform Telemetry vs Google Analytics & Globe
  let activeViewMode = $state<'platform' | 'ga4'>('platform');
  let gaData = $state<any>(null);
  let isLoadingGa = $state(false);
  let selectedGlobeCity = $state<string | null>(null);

  // Canvas element bindings
  let canvasTraffic = $state<HTMLCanvasElement | null>(null);
  let canvasDownloads = $state<HTMLCanvasElement | null>(null);
  let canvasApp = $state<HTMLCanvasElement | null>(null);
  let canvasHardware = $state<HTMLCanvasElement | null>(null);
  let canvasOs = $state<HTMLCanvasElement | null>(null);
  let canvasSubjects = $state<HTMLCanvasElement | null>(null);
  let canvasSources = $state<HTMLCanvasElement | null>(null);
    let canvasHours = $state<HTMLCanvasElement | null>(null);
  let canvasScreen = $state<HTMLCanvasElement | null>(null);
  let canvasClicks = $state<HTMLCanvasElement | null>(null);

  // Active period
  let selectedPeriod = $state('all');
  let isUpdating = $state(false);
  let hoursSubtitle = $state('All-time peak: 18:00 UTC (11:30 PM IST) with 2,274 sessions');
  let cachedAt = $state<string | null>(null);

  // Materio Serene Brand Palette
  const brandPrimary = '#c05a1e';     // Rust / Terracotta CTA
  const brandBlue = '#6a9bcc';        // Serene Blue
  const brandGreen = '#788c5d';       // Serene Sage Green
  const brandAmber = '#d4a000';       // Crunch Amber / Gold
  const brandSlate = '#72726e';       // Brand Neutral Slate
  const brandCoral = '#e18b5b';       // Warm Rust Tint
  const brandMuted = '#8e9087';       // Fog Surface Slate

  const blue = brandBlue;
  const green = brandGreen;
  const amber = brandAmber;
  const gray = brandSlate;
  const coral = brandCoral;
  const muted = brandMuted;

  const PERIOD_DATA: Record<string, any> = {
    all: {
      sessions: '19,057',
      hours: '18,861h',
      avg: '59 min',
      returnU: '2,968',
      downloads: '1,770',
      apps: '21',
      cTraffic: {
        labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
        data: [9596, 1051, 264, 1068, 5168, 824, 1069],
        colors: [amber, blue, blue, blue, amber, blue, blue]
      },
      cSubjects: {
        labels: ['Quant & Reasoning', 'Mobile App Dev', 'Network Security', 'MEAN Stack', 'Machine Learning', 'Cyber Security', 'Data Science', 'Compiler Design'],
        data: [3369, 2123, 2004, 1980, 1667, 1613, 1103, 722]
      },
      cSources: {
        labels: ['Direct', 'Old domain', 'Google', 'WhatsApp', 'Other'],
        data: [10216, 7327, 979, 260, 258]
      },
      cHours: [181, 354, 718, 1064, 1455, 1185, 1035, 1011, 836, 802, 747, 708, 766, 721, 691, 784, 917, 847, 2274, 953, 462, 222, 171, 158],
      cClicks: {
        labels: ['Start reading', 'Share', 'Download', 'MCP banner', 'Home tab', 'Contribute', 'Bug report'],
        data: [60588, 2030, 1770, 944, 920, 550, 403]
      }
    },
    apr: {
      sessions: '9,429',
      hours: '10,265h',
      avg: '79 min',
      returnU: '1,803',
      downloads: '1,049',
      apps: '0',
      cTraffic: {
        labels: ['11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29'],
        data: [48, 285, 414, 604, 538, 457, 355, 382, 582, 690, 926, 816, 740, 677, 445, 622, 626, 133, 90],
        colors: [blue, blue, blue, blue, blue, blue, blue, blue, blue, blue, amber, blue, blue, blue, blue, amber, amber, blue, blue]
      },
      cSubjects: {
        labels: ['Quant & Reasoning', 'Mobile App Dev', 'MEAN Stack', 'Machine Learning', 'Compiler Design', 'Cyber Security'],
        data: [3167, 2114, 1971, 1560, 716, 128]
      },
      cSources: {
        labels: ['Direct', 'Old domain', 'WhatsApp', 'Google', 'Other'],
        data: [4416, 3685, 464, 349, 516]
      },
      cHours: [110, 192, 351, 499, 630, 521, 528, 502, 445, 370, 340, 367, 339, 288, 317, 345, 462, 430, 1382, 610, 295, 155, 78, 76],
      cClicks: {
        labels: ['Start reading', 'Share', 'Download', 'Home tab', 'MCP banner', 'Contribute', 'Bug report'],
        data: [39857, 1289, 1049, 658, 587, 296, 81]
      }
    },
    aug: {
      sessions: '5,168',
      hours: '5,201h',
      avg: '60 min',
      returnU: '892',
      downloads: '507',
      apps: '0',
      cTraffic: {
        labels: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31'],
        data: [42, 35, 68, 71, 88, 92, 110, 140, 185, 210, 260, 295, 340, 310, 280, 240, 220, 195, 180, 165, 150, 140, 130, 120, 115, 105, 95, 88, 80, 72, 65],
        colors: [42, 35, 68, 71, 88, 92, 110, 140, 185, 210, 260, 295, 340, 310, 280, 240, 220, 195, 180, 165, 150, 140, 130, 120, 115, 105, 95, 88, 80, 72, 65].map(v => v >= 250 ? amber : blue)
      },
      cSubjects: {
        labels: ['Network Security', 'Cyber Security', 'Data Science', 'Machine Learning', 'Quant & Reasoning'],
        data: [1850, 1420, 950, 680, 301]
      },
      cSources: {
        labels: ['Direct', 'Google', 'WhatsApp', 'Other'],
        data: [3850, 680, 390, 248]
      },
      cHours: [36, 96, 184, 317, 425, 350, 277, 228, 210, 203, 247, 170, 212, 212, 210, 260, 245, 238, 585, 219, 108, 43, 65, 28],
      cClicks: {
        labels: ['Start reading', 'Download', 'Share', 'MCP banner', 'Bug report', 'Contribute', 'Home tab'],
        data: [14732, 507, 479, 218, 150, 100, 77]
      }
    },
    oct: {
      sessions: '1,069',
      hours: '982h',
      avg: '55 min',
      returnU: '271',
      downloads: '214',
      apps: '21',
      cTraffic: {
        labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        data: [60, 186, 114, 188, 190, 187, 84, 38, 22],
        colors: [60, 186, 114, 188, 190, 187, 84, 38, 22].map(v => v >= 180 ? amber : blue)
      },
      cSubjects: {
        labels: ['Dynamic Prog & DAA', 'Cloud Computing', 'Database Systems', 'Operating Systems', 'Web Tech'],
        data: [380, 245, 190, 112, 55]
      },
      cSources: {
        labels: ['Direct', 'Google', 'WhatsApp', 'Other'],
        data: [820, 140, 65, 44]
      },
      cHours: [13, 23, 44, 75, 118, 90, 61, 44, 34, 48, 42, 40, 55, 41, 47, 46, 35, 50, 96, 49, 20, 6, 10, 4],
      cClicks: {
        labels: ['Promo remind', 'Home tab', 'Settings', 'Share', 'Notifications', 'Leaderboard', 'Start reading'],
        data: [352, 98, 79, 68, 32, 25, 21]
      }
    }
  };

  // Metrics display variables
  let mSessions = $state(PERIOD_DATA.all.sessions);
  let mHours = $state(PERIOD_DATA.all.hours);
  let mAvg = $state(PERIOD_DATA.all.avg);
  let mReturn = $state(PERIOD_DATA.all.returnU);
  let mDownloads = $state(PERIOD_DATA.all.downloads);
  let mApps = $state(PERIOD_DATA.all.apps);

  // Activity tables & ban modal
  let topPdfs = $state<TopPdf[]>([]);
  let topUsers = $state<TopUser[]>([]);
  let isLoadingInsights = $state(true);
  let errorMsg = $state('');
  let searchQuery = $state('');

  let isBanModalOpen = $state(false);
  let banTargetUser = $state<TopUser | null>(null);
  let banReason = $state('');
  let isSubmittingBan = $state(false);

  // Chart instances
  let chTraffic: any = null;
  let chDownloads: any = null;
  let chApp: any = null;
  let chHardware: any = null;
  let chOs: any = null;
  let chSubjects: any = null;
  let chSources: any = null;
    let chHours: any = null;
  let chScreen: any = null;
  let chClicks: any = null;

  let themeObserver: MutationObserver | null = null;

  // Check if dark mode is active
  function checkIsDark(): boolean {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  }

  // Update chart colors dynamically when dark mode changes
  function updateChartTheme() {
    const isDark = checkIsDark();
    const textColor = isDark ? 'rgba(244, 244, 238, 0.85)' : 'rgba(14, 15, 12, 0.7)';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

    if (typeof window !== 'undefined' && (window as any).Chart) {
      (window as any).Chart.defaults.color = textColor;
    }

    const allCharts = [chTraffic, chDownloads, chApp, chHardware, chOs, chSubjects, chSources, chHours, chScreen, chClicks];
    allCharts.forEach((ch) => {
      if (!ch) return;
      if (ch.options?.scales?.x) {
        if (ch.options.scales.x.ticks) ch.options.scales.x.ticks.color = textColor;
        if (ch.options.scales.x.grid) ch.options.scales.x.grid.color = gridColor;
      }
      if (ch.options?.scales?.y) {
        if (ch.options.scales.y.ticks) ch.options.scales.y.ticks.color = textColor;
        if (ch.options.scales.y.grid) ch.options.scales.y.grid.color = gridColor;
      }
      ch.update('none');
    });
  }

  // Reliable Chart.js loader
  function getChartJs(): Promise<any> {
    if (typeof window === 'undefined') return Promise.resolve(null);
    if ((window as any).Chart) return Promise.resolve((window as any).Chart);

    return new Promise((resolve) => {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if ((window as any).Chart) {
          clearInterval(interval);
          resolve((window as any).Chart);
        } else if (attempts > 60) {
          clearInterval(interval);
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
          s.onload = () => resolve((window as any).Chart);
          document.head.appendChild(s);
        }
      }, 30);
    });
  }

  function setPeriod(key: string) {
    selectedPeriod = key;
    const d = PERIOD_DATA[key];
    if (!d) return;

    mSessions = d.sessions;
    mHours = d.hours;
    mAvg = d.avg;
    mReturn = d.returnU;
    mDownloads = typeof d.downloads === 'string' ? d.downloads : (d.summary?.app_downloads || '1,770');
    mApps = d.apps;

    if (chTraffic && d.cTraffic) {
      chTraffic.data.labels = d.cTraffic.labels;
      chTraffic.data.datasets[0].data = d.cTraffic.data;
      chTraffic.data.datasets[0].backgroundColor = d.cTraffic.colors;
      chTraffic.update();
    }

    if (chSubjects && d.cSubjects) {
      chSubjects.data.labels = d.cSubjects.labels;
      chSubjects.data.datasets[0].data = d.cSubjects.data;
      chSubjects.update();
    }

    if (chSources && d.cSources) {
      chSources.data.labels = d.cSources.labels;
      chSources.data.datasets[0].data = d.cSources.data;
      chSources.update();
    }

    if (chHours && d.cHours) {
      chHours.data.datasets[0].data = d.cHours;
      const maxVal = Math.max(...d.cHours);
      const peakIdx = d.cHours.indexOf(maxVal);
      chHours.data.datasets[0].backgroundColor = d.cHours.map((_, i) => i === peakIdx ? amber : blue);
      chHours.update();

      const istHour = (peakIdx + 5.5) % 24;
      const istHourInt = Math.floor(istHour);
      const istMin = istHour % 1 === 0.5 ? '30' : '00';
      const istAmPm = istHourInt >= 12 ? 'PM' : 'AM';
      const ist12 = (istHourInt % 12 || 12).toString().padStart(2, '0');
      const utcStr = peakIdx.toString().padStart(2, '0') + ':00 UTC';
      const istStr = `${ist12}:${istMin} ${istAmPm} IST`;
      const periodName = key === 'all' ? 'All-time' : key === 'apr' ? 'April' : key === 'aug' ? 'August' : 'October';
      hoursSubtitle = `${periodName} peak: ${utcStr} (${istStr}) with ${maxVal.toLocaleString()} sessions`;
    }

    if (chClicks && d.cClicks) {
      chClicks.data.labels = d.cClicks.labels;
      chClicks.data.datasets[0].data = d.cClicks.data;
      chClicks.update();
    }

    if (chScreen && d.cScreen) {
      chScreen.data.labels = d.cScreen.labels;
      chScreen.data.datasets[0].data = d.cScreen.data;
      chScreen.update();
    }

    const dlObj = d.cDownloads || (typeof d.downloads === 'object' ? d.downloads : null);
    if (chDownloads && dlObj) {
      chDownloads.data.labels = Object.keys(dlObj);
      chDownloads.data.datasets[0].data = Object.values(dlObj);
      chDownloads.update();
    }

    if (chApp && d.cApp) {
      chApp.data.labels = d.cApp.labels;
      chApp.data.datasets[0].data = d.cApp.windows;
      chApp.data.datasets[1].data = d.cApp.android;
      chApp.update();
    }

    if (chHardware && d.cHardware) {
      chHardware.data.labels = d.cHardware.labels;
      chHardware.data.datasets[0].data = d.cHardware.data;
      chHardware.update();
    }

    if (chOs && d.cOs) {
      chOs.data.labels = d.cOs.labels;
      chOs.data.datasets[0].data = d.cOs.data;
      chOs.update();
    }
  }

  function formatLastUpdated(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((todayStart.getTime() - dateDayStart.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${timeStr}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${timeStr}`;
    } else if (diffDays > 1 && diffDays < 7) {
      const weekday = date.toLocaleDateString([], { weekday: 'long' });
      return `${weekday} at ${timeStr}`;
    } else {
      const dateFormatted = date.toLocaleDateString([], { day: 'numeric', month: 'short' });
      return `${dateFormatted} at ${timeStr}`;
    }
  }

  async function loadDashboardStats(forceRefresh = false) {
    if (forceRefresh) isUpdating = true;
    try {
      const endpoint = forceRefresh ? 'dashboard-stats?refresh=true' : 'dashboard-stats';
      const res: any = await makeAdminRequest(endpoint, 'GET');
      cachedAt = res.cached_at ? formatLastUpdated(res.cached_at) : null;

      if (res.data?.periods) {
        if (res.data.periods.all) PERIOD_DATA.all = { ...PERIOD_DATA.all, ...res.data.periods.all };
        if (res.data.periods.apr) PERIOD_DATA.apr = { ...PERIOD_DATA.apr, ...res.data.periods.apr };
        if (res.data.periods.aug) PERIOD_DATA.aug = { ...PERIOD_DATA.aug, ...res.data.periods.aug };
        if (res.data.periods.oct) PERIOD_DATA.oct = { ...PERIOD_DATA.oct, ...res.data.periods.oct };
      } else if (res.data?.summary) {
        PERIOD_DATA.all.sessions = res.data.summary.total_sessions;
        PERIOD_DATA.all.hours = res.data.summary.total_reading_hours;
        PERIOD_DATA.all.avg = res.data.summary.avg_reading_min;
        PERIOD_DATA.all.returnU = res.data.summary.return_users;
        PERIOD_DATA.all.downloads = res.data.summary.app_downloads;
        PERIOD_DATA.all.apps = res.data.summary.installed_app_sessions;
      }

      if (forceRefresh) {
        addToast('Updated from Supabase and saved to MongoDB', 'success');
      }

      setPeriod(selectedPeriod);
    } catch (err: any) {
      console.warn('Dashboard stats notice:', err);
    } finally {
      isUpdating = false;
    }
  }

  let gaRange = $state<'today' | '7d' | '30d' | '90d' | 'custom'>('30d');
  let gaCustomStart = $state(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  let gaCustomEnd = $state(new Date().toISOString().split('T')[0]);
  let trendList = $derived<any[]>(gaData?.realtime_trend || Array.from({ length: 30 }, (_, i) => ({ minute: 30 - i, users: 30 + (i % 8) * 2 })));
  let maxTrendUsers = $derived(Math.max(...trendList.map((t: any) => t.users), 1));

  let gaTotalUsers = $state('19,175');
  let gaActiveUsers = $state('2,968');
  let gaViews = $state('248,310');
  let gaAvgTime = $state('59 min');
  let gaRealtime = $state('38');
  let gaEngagementRate = $state('79.2%');

  async function loadGoogleAnalytics(forceRefresh = false) {
    isLoadingGa = true;
    try {
      const params = new URLSearchParams();
      if (forceRefresh) params.set('refresh', 'true');
      params.set('range', gaRange);
      if (gaRange === 'custom') {
        params.set('startDate', gaCustomStart);
        params.set('endDate', gaCustomEnd);
      }
      const res: any = await makeAdminRequest(`google-analytics?${params.toString()}`, 'GET');
      if (res?.data) {
        gaData = {
          ...res.data,
          is_live: res.is_live ?? true
        };
        if (res.data.summary) {
          const s = res.data.summary;
          if (s.total_users) gaTotalUsers = String(s.total_users);
          if (s.active_users) gaActiveUsers = String(s.active_users);
          if (s.views) gaViews = String(s.views);
          if (s.avg_reading_time || s.avg_engagement) gaAvgTime = String(s.avg_reading_time || s.avg_engagement);
          if (s.realtime_users) gaRealtime = String(s.realtime_users);
          if (s.engagement_rate) gaEngagementRate = String(s.engagement_rate);
        }
        if (res.cached_at) {
          cachedAt = formatLastUpdated(res.cached_at);
        }
      }
      if (forceRefresh) {
        addToast('Updated', 'success');
      }
    } catch (e: any) {
      console.warn('Failed to load Google Analytics:', e);
    } finally {
      isLoadingGa = false;
    }
  }

  async function loadInsights() {
    isLoadingInsights = true;
    errorMsg = '';
    try {
      const q = searchQuery ? `?pdfSearch=${encodeURIComponent(searchQuery)}` : '';
      const res: any = await makeAdminRequest(`reading-insights${q}`, 'GET');
      topPdfs = res.top_pdfs || [];
      topUsers = res.top_users || [];
    } catch (e: any) {
      errorMsg = e.message || 'Failed to load reading insights';
    } finally {
      isLoadingInsights = false;
    }
  }

  onMount(async () => {
    await tick();
    await initCharts();
    loadDashboardStats(false);
    loadGoogleAnalytics(false);
    loadInsights();

    // Listen to theme changes on documentElement
    if (typeof document !== 'undefined') {
      themeObserver = new MutationObserver(() => {
        updateChartTheme();
      });
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', updateChartTheme);
    }
  });

  onDestroy(() => {
    themeObserver?.disconnect();
    if (typeof window !== 'undefined') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.removeEventListener('change', updateChartTheme);
    }
  });

  async function initCharts() {
    const Chart = await getChartJs();
    if (!Chart) return;

    const isDark = checkIsDark();
    const textColor = isDark ? 'rgba(244, 244, 238, 0.85)' : 'rgba(14, 15, 12, 0.7)';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

    Chart.defaults.font = { family: 'inherit', size: 11 };
    Chart.defaults.color = textColor;

    // Inline value plugin that adapts to dark mode dynamically
    const barValuePlugin = {
      id: 'barValuePlugin',
      afterDatasetsDraw(chart: any) {
        if (chart.config.type !== 'bar' || chart.config.options?.indexAxis !== 'y') return;
        const { ctx } = chart;
        const isDarkNow = checkIsDark();
        const currentTextColor = isDarkNow ? 'rgba(244, 244, 238, 0.9)' : 'rgba(14, 15, 12, 0.75)';
        ctx.save();
        ctx.font = '500 11px inherit';
        ctx.fillStyle = currentTextColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const isStacked = chart.config.options?.scales?.x?.stacked;
        if (isStacked) {
          const meta0 = chart.getDatasetMeta(0);
          if (meta0 && meta0.data) {
            meta0.data.forEach((bar: any, index: number) => {
              let total = 0;
              let maxX = bar.x;
              chart.data.datasets.forEach((ds: any, dsIdx: number) => {
                total += ds.data[index] || 0;
                const m = chart.getDatasetMeta(dsIdx);
                if (m.data[index] && m.data[index].x > maxX) {
                  maxX = m.data[index].x;
                }
              });
              if (total > 0) {
                ctx.fillText(total.toLocaleString(), maxX + 6, bar.y);
              }
            });
          }
        } else {
          chart.data.datasets.forEach((dataset: any, i: number) => {
            const meta = chart.getDatasetMeta(i);
            if (!meta.hidden && meta.data) {
              meta.data.forEach((bar: any, index: number) => {
                const val = dataset.data[index];
                if (val !== undefined && val !== null && val > 0) {
                  ctx.fillText(val.toLocaleString(), bar.x + 6, bar.y);
                }
              });
            }
          });
        }
        ctx.restore();
      }
    };

    if (!Chart.registry.plugins.get('barValuePlugin')) {
      Chart.register(barValuePlugin);
    }

    const cur = PERIOD_DATA[selectedPeriod] || PERIOD_DATA.all;

    // 1. Daily Traffic
    if (canvasTraffic) {
      chTraffic = new Chart(canvasTraffic, {
        type: 'bar',
        data: {
          labels: cur.cTraffic.labels,
          datasets: [{ data: cur.cTraffic.data, backgroundColor: cur.cTraffic.colors, borderRadius: 3 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor } },
            y: { grid: { color: gridColor }, ticks: { color: textColor } }
          }
        }
      });
    }

    // 2. App Downloads
    if (canvasDownloads) {
      chDownloads = new Chart(canvasDownloads, {
        type: 'bar',
        data: {
          labels: ['File / PDF Downloads', 'Offline Downloads Tab', 'Installed App Sessions', 'Version Info Inquiries', 'Unique App Devices'],
          datasets: [{
            data: [1770, 94, 21, 17, 5],
            backgroundColor: [blue, blue, green, gray, green],
            borderRadius: 3
          }]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          layout: { padding: { right: 45 } },
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor, callback: (v: any) => v >= 1000 ? (v/1000) + 'k' : v } },
            y: { grid: { display: false }, ticks: { color: textColor, autoSkip: false } }
          }
        }
      });
    }

    // 3. App Versions
    if (canvasApp) {
      chApp = new Chart(canvasApp, {
        type: 'bar',
        data: {
          labels: ['v2.1.192', 'v2.1.190', 'v2.1.183', 'v2.1.177', 'v2.1.175', 'v2.1.170', 'v2.1.161', 'v2.1.77'],
          datasets: [
            { label: 'Windows', data: [7, 0, 0, 1, 1, 1, 1, 2], backgroundColor: blue, stack: 's', borderRadius: 2 },
            { label: 'Android', data: [2, 2, 1, 1, 0, 0, 0, 0], backgroundColor: green, stack: 's', borderRadius: 2 }
          ]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          layout: { padding: { right: 35 } },
          plugins: { legend: { display: false } },
          scales: {
            x: { stacked: true, grid: { color: gridColor }, ticks: { color: textColor, precision: 0 } },
            y: { stacked: true, grid: { display: false }, ticks: { color: textColor, autoSkip: false } }
          }
        }
      });
    }

    // 4. App Hardware Models
    if (canvasHardware) {
      chHardware = new Chart(canvasHardware, {
        type: 'bar',
        data: {
          labels: ['Windows PC (x64)', 'Redmi Note 10 Lite', 'Pixel 7', 'OnePlus Nord CE 2', 'Galaxy Tab S7+'],
          datasets: [{
            data: [15, 3, 1, 1, 1],
            backgroundColor: [blue, green, green, green, green],
            borderRadius: 3
          }]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          layout: { padding: { right: 35 } },
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor, precision: 0 } },
            y: { grid: { display: false }, ticks: { color: textColor, autoSkip: false } }
          }
        }
      });
    }

    // 5. Operating Systems
    if (canvasOs) {
      chOs = new Chart(canvasOs, {
        type: 'doughnut',
        data: {
          labels: ['Windows 10/11', 'Android', 'macOS', 'iOS', 'Linux', 'Other'],
          datasets: [{
            data: [9246, 5046, 1170, 1151, 393, 2033],
            backgroundColor: [blue, green, gray, coral, muted, '#888'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } }
        }
      });
    }

    // 6. Subjects
    if (canvasSubjects) {
      chSubjects = new Chart(canvasSubjects, {
        type: 'bar',
        data: {
          labels: cur.cSubjects.labels,
          datasets: [{ data: cur.cSubjects.data, backgroundColor: blue, borderRadius: 3 }]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          layout: { padding: { right: 45 } },
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor } },
            y: { grid: { display: false }, ticks: { color: textColor, autoSkip: false } }
          }
        }
      });
    }

    // 7. Traffic Sources
    if (canvasSources) {
      chSources = new Chart(canvasSources, {
        type: 'doughnut',
        data: {
          labels: cur.cSources.labels,
          datasets: [{ data: cur.cSources.data, backgroundColor: [blue, gray, coral, green, muted], borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } }
        }
      });
    }

    // 9. Hours
    if (canvasHours) {
      chHours = new Chart(canvasHours, {
        type: 'bar',
        data: {
          labels: Array.from({ length: 24 }, (_, i) => String(i)),
          datasets: [{
            data: cur.cHours,
            backgroundColor: Array.from({ length: 24 }, (_, i) => i === 18 ? amber : blue),
            borderRadius: 2
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor, maxTicksLimit: 8 } },
            y: { grid: { color: gridColor }, ticks: { color: textColor } }
          }
        }
      });
    }

    // 10. Screen Viewports
    if (canvasScreen) {
      chScreen = new Chart(canvasScreen, {
        type: 'bar',
        data: {
          labels: ['1536x864', '1680x1050', '1280x800', '393x873', '1280x720', '360x800', '1920x1080'],
          datasets: [{
            data: [4778, 1017, 715, 667, 643, 608, 525],
            backgroundColor: blue,
            borderRadius: 3
          }]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          layout: { padding: { right: 45 } },
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor } },
            y: { grid: { display: false }, ticks: { color: textColor, autoSkip: false } }
          }
        }
      });
    }

    // 11. Click Events
    if (canvasClicks) {
      chClicks = new Chart(canvasClicks, {
        type: 'bar',
        data: {
          labels: cur.cClicks.labels,
          datasets: [{
            data: cur.cClicks.data,
            backgroundColor: blue,
            borderRadius: 3
          }]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          layout: { padding: { right: 55 } },
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor, callback: (v: any) => v >= 1000 ? Math.round(v/1000) + 'k' : v } },
            y: { grid: { display: false }, ticks: { color: textColor, autoSkip: false } }
          }
        }
      });
    }
  }

  function getDisplayName(user: TopUser) {
    if (user.participant_type === 'anon' || (!user.user_id && user.anon_id)) return 'Anonymous';
    return user.display_name || user.username || user.user_id || 'Unknown User';
  }

  function handleSearch(e: Event) {
    e.preventDefault();
    loadInsights();
  }

  function openBanModal(user: TopUser) {
    banTargetUser = user;
    banReason = '';
    isBanModalOpen = true;
  }

  function closeBanModal() {
    isBanModalOpen = false;
    banTargetUser = null;
    banReason = '';
  }

  async function handleApplyBan() {
    if (!banTargetUser) return;
    if (!banReason.trim()) {
      addToast('Please enter a reason for the ban', 'warning');
      return;
    }

    isSubmittingBan = true;
    try {
      const isAnon = banTargetUser.participant_type === 'anon' || (!banTargetUser.user_id && Boolean(banTargetUser.anon_id || banTargetUser.username));
      const payload: any = {
        target_type: isAnon ? 'anonymous' : 'account',
        reason: banReason.trim(),
        body: banReason.trim()
      };

      if (isAnon) {
        const anonId = banTargetUser.anon_id || banTargetUser.username;
        payload.anon_id = anonId;
        payload.fingerprint = banTargetUser.fingerprint || (anonId ? anonId.split('-')[0] : undefined);
        payload.ip = banTargetUser.ip_address || undefined;
      } else {
        payload.user_id = banTargetUser.user_id;
        payload.username = banTargetUser.username;
        payload.display_name = banTargetUser.display_name;
      }

      await makeAdminRequest('bans', 'POST', payload);
      addToast(`Ban rule applied for ${getDisplayName(banTargetUser)}`, 'success');
      closeBanModal();
    } catch (err: any) {
      addToast(`Failed to ban: ${err.message}`, 'error');
    } finally {
      isSubmittingBan = false;
    }
  }

  function openInBanManager() {
    if (!banTargetUser) return;
    const isAnon = banTargetUser.participant_type === 'anon' || (!banTargetUser.user_id && Boolean(banTargetUser.anon_id || banTargetUser.username));
    const params = new URLSearchParams();

    if (isAnon) {
      params.set('banType', 'anonymous');
      const anonId = banTargetUser.anon_id || banTargetUser.username || '';
      if (anonId) params.set('anonId', anonId);
      const fp = banTargetUser.fingerprint || (anonId ? anonId.split('-')[0] : '');
      if (fp) params.set('fingerprint', fp);
      if (banTargetUser.ip_address) params.set('ip', banTargetUser.ip_address);
    } else {
      params.set('banType', 'account');
      if (banTargetUser.user_id) params.set('userId', banTargetUser.user_id);
      if (banTargetUser.username) params.set('username', banTargetUser.username);
      if (banTargetUser.display_name) params.set('displayName', banTargetUser.display_name);
    }

    closeBanModal();
    goto(`/admin/bans?${params.toString()}`);
  }
</script>

<style>
  .dash-container {
    font-family: inherit;
    color: hsl(var(--foreground));
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    
    
    color: hsl(var(--muted-foreground));
    margin-bottom: 8px;
    margin-top: 6px;
  }

  .dash-card {
    background-color: hsl(var(--card)) !important;
    border: 1px solid hsl(var(--border)) !important;
  }

  .dash-text-title {
    color: hsl(var(--foreground)) !important;
  }

  .dash-text-sub {
    color: hsl(var(--muted-foreground)) !important;
  }

  :global(.dash-container) {
    font-family: var(--font-openrunde), 'OpenRunde', sans-serif !important;
  }

  h1, h2, h3, .dash-text-title, .section-label, .dash-metric-val, .font-quadrant {
    font-family: var(--font-quadrant), var(--font-serif), 'Quadrant', Georgia, serif !important;
    letter-spacing: -0.015em;
  }

  .dash-metric-val {
    color: hsl(var(--foreground)) !important;
    font-weight: 400 !important;
    display: inline-flex;
    align-items: baseline;
  }

  .dash-metric-val :global(scritto-text) {
    font-family: inherit !important;
    font-weight: inherit !important;
    letter-spacing: inherit !important;
  }

  .dash-metric-lbl, .dash-text-sub, table, button, input {
    font-family: var(--font-openrunde), 'OpenRunde', sans-serif !important;
  }

  @media print {
    /* Allow browser print engine to paginate the entire report across multiple pages */
    :global(html),
    :global(body),
    :global(body *),
    :global(#app),
    :global([data-sveltekit-preload-data]),
    :global(div),
    :global(main) {
      overflow: visible !important;
      overflow-y: visible !important;
      overflow-x: visible !important;
    }

    :global(html),
    :global(body),
    :global(#app),
    :global([data-sveltekit-preload-data]),
    :global(div:has(> main)),
    :global(div:has(> .dash-container)),
    :global(main),
    .dash-container {
      height: auto !important;
      min-height: auto !important;
      max-height: none !important;
      position: static !important;
      display: block !important;
      padding: 0 !important;
    }

    :global(aside),
    :global(header),
    :global(nav),
    :global(.no-print),
    .no-print {
      display: none !important;
    }

    :global(body) {
      background: #ffffff !important;
      color: #0e0f0c !important;
    }

    .print-header {
      display: block !important;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid #d5d5d2;
    }

    .dash-card {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      border: 1px solid #e3e3e3 !important;
      background: #ffffff !important;
      box-shadow: none !important;
      margin-bottom: 16px !important;
    }

    .section-label {
      break-after: avoid !important;
      page-break-after: avoid !important;
      color: #72726e !important;
      margin-top: 18px !important;
    }

    canvas {
      max-width: 100% !important;
    }
  }

  .print-header {
    display: none;
  }
</style>

<div class="dash-container p-6 max-w-7xl mx-auto space-y-6">

  <!-- Print Header -->
  <div class="print-header">
    <h1 class="text-xl font-bold">Materio — Overview & Analytics</h1>
    <p class="text-xs text-gray-500 mt-0.5">Printed on {new Date().toLocaleDateString()}</p>
  </div>
  <!-- Action Bar with Apple Segmented Control -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
    <div class="flex items-center gap-3">
      <h1 class="text-2xl font-normal text-foreground dash-text-title tracking-tight">Overview</h1>
      {#if cachedAt}
        <span class="text-xs text-muted-foreground dash-text-sub hidden sm:inline">• {cachedAt}</span>
      {/if}
    </div>

    <!-- Segmented Tab Picker & Controls -->
    <div class="flex items-center gap-2">
      <!-- Apple-style Segmented Control: Just Platform and Google -->
      <div class="inline-flex p-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08]">
        <button
          type="button"
          onclick={() => activeViewMode = 'platform'}
          class="px-3.5 py-1 text-xs font-medium rounded-md transition-all {activeViewMode === 'platform' ? 'bg-background text-foreground shadow-2xs font-semibold' : 'text-muted-foreground hover:text-foreground'}"
        >
          Platform
        </button>
        <button
          type="button"
          onclick={() => { activeViewMode = 'ga4'; if (!gaData) loadGoogleAnalytics(false); }}
          class="px-3.5 py-1 text-xs font-medium rounded-md transition-all {activeViewMode === 'ga4' ? 'bg-background text-foreground shadow-2xs font-semibold' : 'text-muted-foreground hover:text-foreground'}"
        >
          Google
        </button>
      </div>

      <button 
        type="button"
        onclick={() => activeViewMode === 'platform' ? loadDashboardStats(true) : loadGoogleAnalytics(true)}
        disabled={isUpdating || isLoadingGa}
        class="px-3 py-1 text-xs font-medium rounded-lg border border-border/80 bg-card hover:bg-muted text-foreground transition-colors disabled:opacity-50 shadow-2xs flex items-center gap-1.5"
      >
        {#if isUpdating || isLoadingGa}
          <span class="w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
          Updating...
        {:else}
          Update
        {/if}
      </button>

      <button 
        type="button"
        onclick={() => window.print()}
        class="px-3 py-1 text-xs font-medium rounded-lg border border-border/80 bg-card hover:bg-muted text-foreground transition-colors shadow-2xs"
      >
        PDF
      </button>
    </div>
  </div>

  {#if errorMsg}
    <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs no-print">
      {errorMsg}
    </div>
  {/if}

  <!-- PLATFORM TELEMETRY VIEW (Kept in DOM to preserve Canvas charts on tab switch) -->
  <div class={activeViewMode === 'platform' ? 'space-y-6' : 'hidden'}>
    <!-- Monthly Period Tabs (Segmented bar from forms page, scrollable x-axis) -->
    <div class="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl w-max max-w-full overflow-x-auto no-scrollbar no-print">
      <button 
        type="button"
        onclick={() => setPeriod('all')}
        class="px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 {selectedPeriod === 'all' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
      >
        All-Time
      </button>
      <button 
        type="button"
        onclick={() => setPeriod('apr')}
        class="px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 {selectedPeriod === 'apr' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
      >
        April 2026
      </button>
      <button 
        type="button"
        onclick={() => setPeriod('aug')}
        class="px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 {selectedPeriod === 'aug' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
      >
        August 2026
      </button>
      <button 
        type="button"
        onclick={() => setPeriod('oct')}
        class="px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 {selectedPeriod === 'oct' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}"
      >
        October 2026
      </button>
    </div>

    <!-- Metrics Grid: 6 Simple Flat Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div class="dash-card bg-card border border-border/80 rounded-xl p-3.5">
        <div class="text-2xl sm:text-3xl font-serif font-normal text-foreground dash-metric-val tracking-tight">
          <Scritto value={mSessions} />
        </div>
        <div class="text-xs text-muted-foreground dash-metric-lbl mt-0.5">Total sessions</div>
      </div>

      <div class="dash-card bg-card border border-border/80 rounded-xl p-3.5">
        <div class="text-2xl sm:text-3xl font-serif font-normal text-foreground dash-metric-val tracking-tight">
          <Scritto value={mHours} />
        </div>
        <div class="text-xs text-muted-foreground dash-metric-lbl mt-0.5">Reading time</div>
      </div>

      <div class="dash-card bg-card border border-border/80 rounded-xl p-3.5">
        <div class="text-2xl sm:text-3xl font-serif font-normal text-foreground dash-metric-val tracking-tight">
          <Scritto value={mAvg} />
        </div>
        <div class="text-xs text-muted-foreground dash-metric-lbl mt-0.5">Avg / session</div>
      </div>

      <div class="dash-card bg-card border border-border/80 rounded-xl p-3.5">
        <div class="text-2xl sm:text-3xl font-serif font-normal text-foreground dash-metric-val tracking-tight">
          <Scritto value={mReturn} />
        </div>
        <div class="text-xs text-muted-foreground dash-metric-lbl mt-0.5">Return users</div>
      </div>

      <div class="dash-card bg-card border border-border/80 rounded-xl p-3.5">
        <div class="text-2xl sm:text-3xl font-serif font-normal text-foreground dash-metric-val tracking-tight">
          <Scritto value={mDownloads} />
        </div>
        <div class="text-xs text-muted-foreground dash-metric-lbl mt-0.5">Downloads</div>
      </div>

      <div class="dash-card bg-card border border-border/80 rounded-xl p-3.5">
        <div class="text-2xl sm:text-3xl font-serif font-normal text-foreground dash-metric-val tracking-tight">
          <Scritto value={mApps} />
        </div>
        <div class="text-xs text-muted-foreground dash-metric-lbl mt-0.5">App sessions</div>
      </div>
    </div>

    <!-- Daily Traffic: Full Width -->
    <div class="section-label">Daily traffic — sessions per day</div>
      <div class="dash-card bg-card border border-border/80 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="text-xs font-medium text-foreground dash-text-title">Volume across selected timeframe</div>
          </div>
          <div class="flex items-center gap-3 text-xs text-muted-foreground dash-text-sub">
            <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-[2px] inline-block" style="background:#6a9bcc"></span>sessions</span>
            <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-[2px] inline-block" style="background:#d4a000"></span>exam crunch days</span>
          </div>
        </div>
        <div style="position: relative; width: 100%; height: 180px;">
          <canvas bind:this={canvasTraffic}></canvas>
        </div>
      </div>

    <!-- Row 1: App Downloads & Versions (Horizontal Bars with Visible Counts) -->
    <div class="section-label">App telemetry & download metrics</div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="dash-card bg-card border border-border/80 rounded-xl p-4">
        <div class="text-xs font-medium text-foreground dash-text-title mb-1">App downloads & actions</div>
        <div class="text-[11px] text-muted-foreground dash-text-sub mb-3">Direct downloads and interaction events</div>
        <div style="position: relative; width: 100%; height: 200px;">
          <canvas bind:this={canvasDownloads}></canvas>
        </div>
      </div>

      <div class="dash-card bg-card border border-border/80 rounded-xl p-4">
        <div class="text-xs font-medium text-foreground dash-text-title mb-1">App versions</div>
        <div class="text-[11px] text-muted-foreground dash-text-sub mb-3">Active sessions stacked by platform</div>
        <div style="position: relative; width: 100%; height: 200px;">
          <canvas bind:this={canvasApp}></canvas>
        </div>
      </div>
    </div>

    <!-- Row 2: Hardware Models & Operating Systems -->
    <div class="section-label">Hardware & operating systems</div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="dash-card bg-card border border-border/80 rounded-xl p-4">
        <div class="text-xs font-medium text-foreground dash-text-title mb-1">App hardware models</div>
        <div class="text-[11px] text-muted-foreground dash-text-sub mb-3">Physical devices logging app telemetry</div>
        <div style="position: relative; width: 100%; height: 200px;">
          <canvas bind:this={canvasHardware}></canvas>
        </div>
      </div>

      <div class="dash-card bg-card border border-border/80 rounded-xl p-4">
        <div class="text-xs font-medium text-foreground dash-text-title mb-1">Operating systems</div>
        <div class="text-[11px] text-muted-foreground dash-text-sub mb-3">Desktop vs mobile distribution</div>
        <div style="position: relative; width: 100%; height: 200px;">
          <canvas bind:this={canvasOs}></canvas>
        </div>
      </div>
    </div>

    <!-- Row 3: Subjects & Traffic Sources -->
    <div class="section-label">Core syllabus & traffic sources</div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="dash-card bg-card border border-border/80 rounded-xl p-4">
        <div class="text-xs font-medium text-foreground dash-text-title mb-1">Reading time by subject</div>
        <div class="text-[11px] text-muted-foreground dash-text-sub mb-3">Hours spent reading syllabus modules</div>
        <div style="position: relative; width: 100%; height: 210px;">
          <canvas bind:this={canvasSubjects}></canvas>
        </div>
      </div>

      <div class="dash-card bg-card border border-border/80 rounded-xl p-4">
        <div class="text-xs font-medium text-foreground dash-text-title mb-1">Traffic sources</div>
        <div class="text-[11px] text-muted-foreground dash-text-sub mb-3">Referral channel distribution</div>
        <div style="position: relative; width: 100%; height: 210px;">
          <canvas bind:this={canvasSources}></canvas>
        </div>
      </div>
    </div>

    <!-- Activity by Hour -->
    <div class="section-label">Hourly activity patterns</div>
    <div class="dash-card bg-card border border-border/80 rounded-xl p-4">
      <div class="text-xs font-medium text-foreground dash-text-title mb-1">Activity by hour (UTC / IST)</div>
      <div class="text-[11px] text-muted-foreground dash-text-sub mb-3">{hoursSubtitle}</div>
      <div style="position: relative; width: 100%; height: 200px;">
        <canvas bind:this={canvasHours}></canvas>
      </div>
    </div>

    <!-- Row 5: Viewports & Click Events -->
    <div class="section-label">Screen viewports & user interactions</div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="dash-card bg-card border border-border/80 rounded-xl p-4">
        <div class="text-xs font-medium text-foreground dash-text-title mb-1">Top screen viewports</div>
        <div class="text-[11px] text-muted-foreground dash-text-sub mb-3">1536x864 is 125% FHD laptop standard</div>
        <div style="position: relative; width: 100%; height: 200px;">
          <canvas bind:this={canvasScreen}></canvas>
        </div>
      </div>

      <div class="dash-card bg-card border border-border/80 rounded-xl p-4">
        <div class="text-xs font-medium text-foreground dash-text-title mb-1">Click events</div>
        <div class="text-[11px] text-muted-foreground dash-text-sub mb-3">Total recorded action volume</div>
        <div style="position: relative; width: 100%; height: 200px;">
          <canvas bind:this={canvasClicks}></canvas>
        </div>
      </div>
    </div>

    <!-- Detailed Tables: Top PDFs & Top Readers -->
    <div class="section-label">Top content & reader activity</div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Top PDFs -->
      <div class="dash-card rounded-xl p-4 flex flex-col h-[460px]">
        <div class="flex items-center justify-between gap-3 mb-3">
          <h3 class="text-xs font-medium text-foreground dash-text-title flex items-center gap-1.5">
            <HugeiconsIcon icon={BookOpen01Icon} size={16} class="text-primary" />
            Top PDFs Read
          </h3>
          <form onsubmit={handleSearch} class="relative w-44 no-print">
            <HugeiconsIcon icon={Search01Icon} size={13} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground dash-text-sub" />
            <input 
              type="text" 
              bind:value={searchQuery} 
              placeholder="Search..." 
              class="w-full h-7 pl-7 pr-2.5 text-xs bg-muted/40 border border-border/50 rounded-lg focus:outline-none text-foreground dash-text-title"
            />
          </form>
        </div>

        <div class="flex-1 overflow-auto -mx-1 px-1">
          {#if isLoadingInsights}
            <div class="flex items-center justify-center h-28 text-muted-foreground dash-text-sub text-xs">Loading...</div>
          {:else if topPdfs.length === 0}
            <div class="flex items-center justify-center h-28 text-muted-foreground dash-text-sub text-xs">No PDF data found.</div>
          {:else}
            <table class="w-full text-xs text-left">
              <thead class="text-[11px] text-muted-foreground dash-text-sub sticky top-0 bg-card z-10 border-b border-border/40">
                <tr>
                  <th class="px-2 py-1.5 font-medium">#</th>
                  <th class="px-2 py-1.5 font-medium">PDF Title</th>
                  <th class="px-2 py-1.5 font-medium text-right">Reads</th>
                  <th class="px-2 py-1.5 font-medium text-right">Readers</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/30">
                {#each topPdfs as pdf, i}
                  <tr class="hover:bg-muted/20 transition-colors">
                    <td class="px-2 py-1.5 text-muted-foreground dash-text-sub">{i + 1}</td>
                    <td class="px-2 py-1.5 font-medium text-foreground dash-text-title truncate max-w-[180px]" title={pdf.title}>{pdf.title || 'Untitled'}</td>
                    <td class="px-2 py-1.5 text-right tabular-nums text-foreground dash-text-title">{pdf.reads}</td>
                    <td class="px-2 py-1.5 text-right tabular-nums text-muted-foreground dash-text-sub">{pdf.unique_readers}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>
      </div>

      <!-- Top Readers -->
      <div class="dash-card rounded-xl p-4 flex flex-col h-[460px]">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xs font-medium text-foreground dash-text-title flex items-center gap-1.5">
            <HugeiconsIcon icon={UserGroupIcon} size={16} class="text-primary" />
            Top Readers
          </h3>
        </div>

        <div class="flex-1 overflow-auto -mx-1 px-1">
          {#if isLoadingInsights}
            <div class="flex items-center justify-center h-28 text-muted-foreground dash-text-sub text-xs">Loading...</div>
          {:else if topUsers.length === 0}
            <div class="flex items-center justify-center h-28 text-muted-foreground dash-text-sub text-xs">No user data found.</div>
          {:else}
            <table class="w-full text-xs text-left">
              <thead class="text-[11px] text-muted-foreground dash-text-sub sticky top-0 bg-card z-10 border-b border-border/40">
                <tr>
                  <th class="px-2 py-1.5 font-medium">#</th>
                  <th class="px-2 py-1.5 font-medium">User</th>
                  <th class="px-2 py-1.5 font-medium text-right">Time</th>
                  <th class="px-2 py-1.5 font-medium text-right">PDFs</th>
                  <th class="px-2 py-1.5 font-medium text-right no-print">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/30">
                {#each topUsers as user, i}
                  <tr class="hover:bg-muted/20 transition-colors group">
                    <td class="px-2 py-1.5 text-muted-foreground dash-text-sub">{i + 1}</td>
                    <td class="px-2 py-1.5">
                      <div class="flex flex-col">
                        <span class="font-medium text-foreground dash-text-title truncate max-w-[130px]" title={getDisplayName(user)}>{getDisplayName(user)}</span>
                        {#if user.participant_type === 'anon' || (!user.user_id && user.anon_id)}
                          <span class="text-[10px] text-muted-foreground dash-text-sub font-mono">{String(user.anon_id || user.username).slice(-8)}</span>
                        {:else if user.username}
                          <span class="text-[10px] text-muted-foreground dash-text-sub truncate">@{user.username}</span>
                        {/if}
                      </div>
                    </td>
                    <td class="px-2 py-1.5 text-right tabular-nums text-primary font-medium">{user.reading_time_human || '00:00:00'}</td>
                    <td class="px-2 py-1.5 text-right tabular-nums text-muted-foreground dash-text-sub">{user.pdf_reads || 0}</td>
                    <td class="px-2 py-1.5 text-right no-print">
                      <button 
                        type="button"
                        onclick={() => openBanModal(user)}
                        class="p-1 rounded text-muted-foreground dash-text-sub hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Ban"
                      >
                        <HugeiconsIcon icon={ShieldBanIcon} size={14} />
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>
      </div>

    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- GOOGLE ANALYTICS & D3 SEMI-GLOBE VIEW (Apple-grade minimal layout) -->
  <!-- ========================================================================= -->
  <div class={activeViewMode === 'ga4' ? 'space-y-6' : 'hidden'}>
    <!-- Date Range Picker Controls -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="inline-flex items-center gap-1 p-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-xs">
        {#each [
          { id: 'today', label: 'Today' },
          { id: '7d', label: '7 days' },
          { id: '30d', label: '30 days' },
          { id: '90d', label: '90 days' },
          { id: 'custom', label: 'Custom' }
        ] as r}
          <button
            type="button"
            onclick={() => { gaRange = r.id as any; if (r.id !== 'custom') loadGoogleAnalytics(false); }}
            class="px-3 py-1 rounded-md transition-all font-medium {gaRange === r.id ? 'bg-background text-foreground shadow-2xs font-semibold' : 'text-muted-foreground hover:text-foreground'}"
          >
            {r.label}
          </button>
        {/each}
      </div>

      {#if gaRange === 'custom'}
        <div class="flex items-center gap-2 text-xs">
          <input
            type="date"
            bind:value={gaCustomStart}
            class="px-2.5 py-1 rounded-lg border border-border/70 bg-card text-foreground font-mono text-xs"
          />
          <span class="text-muted-foreground">to</span>
          <input
            type="date"
            bind:value={gaCustomEnd}
            class="px-2.5 py-1 rounded-lg border border-border/70 bg-card text-foreground font-mono text-xs"
          />
          <button
            type="button"
            onclick={() => loadGoogleAnalytics(false)}
            class="px-3 py-1 rounded-lg bg-foreground text-background font-medium hover:opacity-90 transition-opacity"
          >
            Apply
          </button>
        </div>
      {/if}
    </div>

    <!-- All 6 KPI Grid Cards (Identical layout and animation style as platform telemetry) -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div class="dash-card bg-card border border-border/80 rounded-xl p-3.5">
        <div class="text-2xl sm:text-3xl font-serif font-normal text-foreground dash-metric-val tracking-tight">
          <Scritto value={gaTotalUsers} />
        </div>
        <div class="text-xs text-muted-foreground dash-metric-lbl mt-0.5">Total users</div>
      </div>

      <div class="dash-card bg-card border border-border/80 rounded-xl p-3.5">
        <div class="text-2xl sm:text-3xl font-serif font-normal text-foreground dash-metric-val tracking-tight">
          <Scritto value={gaActiveUsers} />
        </div>
        <div class="text-xs text-muted-foreground dash-metric-lbl mt-0.5">Active readers</div>
      </div>

      <div class="dash-card bg-card border border-border/80 rounded-xl p-3.5">
        <div class="text-2xl sm:text-3xl font-serif font-normal text-foreground dash-metric-val tracking-tight">
          <Scritto value={gaViews} />
        </div>
        <div class="text-xs text-muted-foreground dash-metric-lbl mt-0.5">Screen views</div>
      </div>

      <div class="dash-card bg-card border border-border/80 rounded-xl p-3.5">
        <div class="text-2xl sm:text-3xl font-serif font-normal text-foreground dash-metric-val tracking-tight">
          <Scritto value={gaAvgTime} />
        </div>
        <div class="text-xs text-muted-foreground dash-metric-lbl mt-0.5">Average study time</div>
      </div>

      <div class="dash-card bg-card border border-border/80 rounded-xl p-3.5 relative overflow-hidden">
        <div class="text-2xl sm:text-3xl font-serif font-normal text-foreground dash-metric-val tracking-tight">
          <Scritto value={gaRealtime} />
        </div>
        <div class="text-xs text-muted-foreground dash-metric-lbl mt-0.5">Realtime active</div>
      </div>

      <div class="dash-card bg-card border border-border/80 rounded-xl p-3.5">
        <div class="text-2xl sm:text-3xl font-serif font-normal text-foreground dash-metric-val tracking-tight">
          <Scritto value={gaEngagementRate} />
        </div>
        <div class="text-xs text-muted-foreground dash-metric-lbl mt-0.5">Engagement rate</div>
      </div>
    </div>

    <!-- Realtime Sparkline (Peak color coded with amber, clean) -->
    <div class="dash-card bg-card border border-border/70 rounded-xl p-4">
      <div class="flex items-center justify-between mb-2">
        <div>
          <div class="text-xs font-semibold text-foreground dash-text-title flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Realtime activity (past 30 minutes)
          </div>
          <div class="text-[11px] text-muted-foreground mt-0.5">
            Minute-by-minute readership sessions
          </div>
        </div>
      </div>

      <!-- Sparkline bar chart -->
      <div class="h-14 flex items-end gap-1 sm:gap-1.5 pt-2">
        {#each trendList as point}
          {@const hPercent = Math.max(15, Math.min(100, (point.users / maxTrendUsers) * 100))}
          {@const isPeak = point.users === maxTrendUsers}
          <div
            class="flex-1 rounded-xs transition-all relative group cursor-pointer {isPeak ? 'bg-[#c05a1e]' : 'bg-[#6a9bcc]/40 hover:bg-[#6a9bcc]'}"
            style="height: {hPercent}%;"
          >
            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block px-1.5 py-0.5 bg-popover text-popover-foreground text-[10px] rounded font-mono shadow-sm z-20 pointer-events-none whitespace-nowrap">
              {point.users} users • {point.minute === 0 ? 'just now' : `${point.minute}m ago`}
            </div>
          </div>
        {/each}
      </div>
      <div class="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 font-mono">
        <span>30 min ago</span>
        <span>15 min ago</span>
        <span>Now</span>
      </div>
    </div>

    <!-- MAIN HERO: 3D D3.js SEMI-GLOBE DOME MATCHING REFERENCE IMAGE -->
    <div class="dash-card bg-card border border-border/70 rounded-2xl p-4">
      <div class="flex items-center justify-between mb-3 px-1">
        <h2 class="text-xs font-semibold text-foreground dash-text-title">Geographic distribution</h2>
        <div class="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-[#56ab46]"></span> Sessions</span>
          <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-[#4688cf]"></span> Views</span>
        </div>
      </div>

      <D3SemiGlobe 
        locations={gaData?.locations || []} 
        bind:selectedCity={selectedGlobeCity}
        height={460} 
      />
    </div>

    <!-- 2 Column Breakdown Tables: Top Cities & Top Pages -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Top Cities Table -->
      <div class="dash-card rounded-2xl p-4 flex flex-col h-[400px]">
        <div class="flex items-center justify-between mb-3 pb-2 border-b border-border/40">
          <h3 class="text-xs font-semibold text-foreground dash-text-title">Top locations</h3>
        </div>
        <div class="flex-1 overflow-auto">
          <table class="w-full text-xs text-left">
            <thead class="text-[11px] text-muted-foreground sticky top-0 bg-card z-10 border-b border-border/30">
              <tr>
                <th class="py-1.5 px-2 font-medium">#</th>
                <th class="py-1.5 px-2 font-medium">City</th>
                <th class="py-1.5 px-2 font-medium text-right">Readers</th>
                <th class="py-1.5 px-2 font-medium text-right">Views</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/20">
              {#each (gaData?.top_cities || gaData?.locations || []).slice(0, 30) as loc, i}
                <tr 
                  onclick={() => selectedGlobeCity = loc.city}
                  class="hover:bg-muted/30 transition-colors cursor-pointer {selectedGlobeCity === loc.city ? 'bg-primary/10' : ''}"
                >
                  <td class="py-2 px-2 text-muted-foreground">{i + 1}</td>
                  <td class="py-2 px-2">
                    <span class="font-medium text-foreground">{loc.city}</span>
                    <span class="text-[10px] text-muted-foreground ml-1.5">{loc.region ? `${loc.region}, ` : ''}{loc.country}</span>
                  </td>
                  <td class="py-2 px-2 text-right tabular-nums font-mono font-medium">{loc.users.toLocaleString()}</td>
                  <td class="py-2 px-2 text-right tabular-nums font-mono text-primary font-medium">{loc.views.toLocaleString()}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top Read Pages Table -->
      <div class="dash-card rounded-2xl p-4 flex flex-col h-[400px]">
        <div class="flex items-center justify-between mb-3 pb-2 border-b border-border/40">
          <h3 class="text-xs font-semibold text-foreground dash-text-title">Top pages</h3>
        </div>
        <div class="flex-1 overflow-auto">
          <table class="w-full text-xs text-left">
            <thead class="text-[11px] text-muted-foreground sticky top-0 bg-card z-10 border-b border-border/30">
              <tr>
                <th class="py-1.5 px-2 font-medium">Path</th>
                <th class="py-1.5 px-2 font-medium text-right">Views</th>
                <th class="py-1.5 px-2 font-medium text-right">Avg time</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/20">
              {#each (gaData?.top_pages || []) as p}
                <tr class="hover:bg-muted/20 transition-colors">
                  <td class="py-2 px-2">
                    <div class="font-medium text-foreground font-mono text-[11px] truncate max-w-[200px]" title={p.path}>{p.path}</div>
                    <div class="text-[10px] text-muted-foreground truncate max-w-[200px]">{p.title}</div>
                  </td>
                  <td class="py-2 px-2 text-right tabular-nums font-mono text-foreground font-medium">{p.views.toLocaleString()}</td>
                  <td class="py-2 px-2 text-right tabular-nums font-mono text-muted-foreground font-medium">{p.avgTime || '4m 30s'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Traffic Channels & Acquisition (Flat solid bars, NO gradients) -->
    <div class="dash-card rounded-2xl p-4">
      <h3 class="text-xs font-semibold text-foreground dash-text-title mb-1">Traffic channels</h3>
      <div class="text-[11px] text-muted-foreground mb-3">Incoming reader discovery sources</div>

      <div class="space-y-3 pt-1">
        {#each (gaData?.traffic_sources || []) as ch}
          <div>
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="font-medium text-foreground">{ch.channel}</span>
              <span class="font-mono text-muted-foreground">{ch.sessions?.toLocaleString() || 0} sessions ({ch.percentage}%)</span>
            </div>
            <div class="w-full h-2 bg-muted/60 rounded-full overflow-hidden">
              <div 
                class="h-full bg-[#4889c8] rounded-full transition-all duration-500" 
                style="width: {ch.percentage}%;"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Minimal Connection Status Footer -->
    <div class="flex items-center justify-between text-[11px] text-muted-foreground px-1 py-1">
      <div class="flex items-center gap-2">
        <span class="w-1.5 h-1.5 rounded-full {gaData?.is_live ? 'bg-emerald-500' : 'bg-zinc-400'}"></span>
        <span>{gaData?.is_live ? 'Google Analytics 4' : 'Platform data'}</span>
      </div>
    </div>
  </div>

  <!-- Quick Ban Modal -->
  <Modal bind:isOpen={isBanModalOpen} title="Ban User" onClose={closeBanModal}>
    {#if banTargetUser}
      <div class="space-y-4">
        <div class="text-xs">
          <span class="text-muted-foreground dash-text-sub">Target: </span>
          <span class="font-medium text-foreground dash-text-title">{getDisplayName(banTargetUser)}</span>
          {#if banTargetUser.username && banTargetUser.participant_type !== 'anon'}
            <span class="text-muted-foreground dash-text-sub"> (@{banTargetUser.username})</span>
          {/if}
        </div>

        <div class="space-y-1">
          <label for="modalBanReason" class="text-xs font-medium text-muted-foreground dash-text-sub block">
            Reason
          </label>
          <textarea
            id="modalBanReason"
            rows="3"
            bind:value={banReason}
            placeholder="Suspension reason..."
            required
            class="w-full bg-muted/20 border border-border/60 rounded-lg p-2.5 text-xs text-foreground dash-text-title focus:border-primary outline-none transition-all resize-y"
          ></textarea>
        </div>

        <div class="flex items-center justify-between pt-3">
          <button
            type="button"
            onclick={openInBanManager}
            class="text-xs text-muted-foreground dash-text-sub hover:text-foreground dash-text-title transition-colors underline underline-offset-4"
          >
            Open in Ban Manager
          </button>
          
          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={closeBanModal}
              class="btn-base btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onclick={handleApplyBan}
              disabled={isSubmittingBan}
              class="btn-base btn-destructive text-xs"
            >
              {isSubmittingBan ? 'Applying...' : 'Apply Ban'}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </Modal>

</div>
