import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserPublic } from '../api/auth';
import type { JobStatus, Project } from '../types';
import type { WorkbenchSource } from '../lib/workbenchSource';
import { DEFAULT_WORKBENCH_SOURCE } from '../lib/workbenchSource';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppState {
  authToken: string | null;
  user: UserPublic | null;
  setAuth: (token: string, user: UserPublic) => void;
  clearAuth: () => void;
  isAdmin: () => boolean;

  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  simpleMode: boolean;
  setSimpleMode: (simple: boolean) => void;
  toggleSimpleMode: () => void;

  aiPanelOpen: boolean;
  setAiPanelOpen: (open: boolean) => void;
  toggleAiPanel: () => void;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  jobs: JobStatus[];
  setJobs: (jobs: JobStatus[]) => void;
  upsertJob: (job: JobStatus) => void;

  toasts: ToastMessage[];
  addToast: (type: ToastMessage['type'], message: string) => void;
  removeToast: (id: string) => void;

  projects: Project[];
  setProjects: (projects: Project[]) => void;

  researchPassNoteIds: string[];
  setResearchPassNoteIds: (ids: string[]) => void;

  workbenchSource: WorkbenchSource;
  setWorkbenchSource: (source: WorkbenchSource) => void;
  patchWorkbenchSource: (patch: Partial<WorkbenchSource>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      authToken: null,
      user: null,
      setAuth: (token, user) => set({ authToken: token, user }),
      clearAuth: () => set({ authToken: null, user: null }),
      isAdmin: () => get().user?.role === 'admin',

      activeProjectId: null,
      setActiveProjectId: (id) => set({ activeProjectId: id }),

      sidebarCollapsed: false,
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),

      simpleMode: true,
      setSimpleMode: (simple) => set({ simpleMode: simple }),
      toggleSimpleMode: () => set({ simpleMode: !get().simpleMode }),

      aiPanelOpen: false,
      setAiPanelOpen: (open) => set({ aiPanelOpen: open }),
      toggleAiPanel: () => set({ aiPanelOpen: !get().aiPanelOpen }),

      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      jobs: [],
      setJobs: (jobs) => set({ jobs }),
      upsertJob: (job) =>
        set((state) => {
          const idx = state.jobs.findIndex((j) => j.id === job.id);
          if (idx >= 0) {
            const next = [...state.jobs];
            next[idx] = { ...next[idx], ...job };
            return { jobs: next };
          }
          return { jobs: [job, ...state.jobs] };
        }),

      toasts: [],
      addToast: (type, message) => {
        const id = crypto.randomUUID();
        set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
        setTimeout(() => get().removeToast(id), 4000);
      },
      removeToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

      projects: [],
      setProjects: (projects) => set({ projects }),

      researchPassNoteIds: [],
      setResearchPassNoteIds: (ids) => set({ researchPassNoteIds: ids }),

      workbenchSource: DEFAULT_WORKBENCH_SOURCE,
      setWorkbenchSource: (source) => set({ workbenchSource: source }),
      patchWorkbenchSource: (patch) =>
        set((state) => ({ workbenchSource: { ...state.workbenchSource, ...patch } })),
    }),
    {
      name: 'caspa-ui',
      partialize: (state) => ({
        authToken: state.authToken,
        user: state.user,
        activeProjectId: state.activeProjectId,
        sidebarCollapsed: state.sidebarCollapsed,
        simpleMode: state.simpleMode,
        aiPanelOpen: state.aiPanelOpen,
        researchPassNoteIds: state.researchPassNoteIds,
        workbenchSource: state.workbenchSource,
      }),
    },
  ),
);

export function getAuthToken(): string | null {
  return useAppStore.getState().authToken;
}
