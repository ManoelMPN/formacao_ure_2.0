import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DEFAULT_SCRIPT_URL,
  fetchSheetData,
} from './services/sheetService';
import { SheetState } from './types';
import { Header } from './components/Header';
import { UnifiedDashboard } from './components/UnifiedDashboard';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { ThemeProvider, useTheme } from './context/ThemeContext';

const SCRIPT_STORAGE_KEY = 'ure_sul_3_script_url';

const EMPTY_INITIAL_STATE: SheetState = {
  sheetTitle: 'Gestão de Formações - URE Sul 3',
  sheetUpdatedAt: null,
  profsGeral: [],
  allSchools: [],
  components: {},
  componentNames: [],
  attendedWithoutSedEvaluation: [],
  totalFormadosPresencial: 0,
  lastFetchedAt: null,
  isLoading: true,
  error: null,
  isMockData: false,
  rawUrl: DEFAULT_SCRIPT_URL,
};

function DashboardApp() {
  const { isDark } = useTheme();

  const [sheetState, setSheetState] = useState<SheetState>(() => {
    try {
      const cached = localStorage.getItem('ure_sul_3_cached_state');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.allSchools) && parsed.allSchools.length > 0) {
          return { ...parsed, isLoading: false, error: null };
        }
      }
    } catch {
      // Ignore cache parse error
    }
    return EMPTY_INITIAL_STATE;
  });

  const [scriptUrl, setScriptUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(SCRIPT_STORAGE_KEY);
      if (saved && saved.trim().startsWith('http')) {
        return saved.trim();
      }
    } catch {}
    return DEFAULT_SCRIPT_URL;
  });

  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState<boolean>(false);

  // Default to Consolidated View: All schools, All components
  const [selectedSchool, setSelectedSchool] = useState<string>('TODAS');
  const [selectedComponent, setSelectedComponent] = useState<string>('TODOS');

  const isFetchingRef = useRef(false);

  // Sync data function with timestamp cache-busting for real-time guarantee
  const loadData = useCallback(async (targetUrl: string = scriptUrl, silent: boolean = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!silent) {
      setSheetState((prev) => ({ ...prev, isLoading: true, error: null }));
    }

    try {
      let res = await fetchSheetData(targetUrl);
      if (res.error && targetUrl !== DEFAULT_SCRIPT_URL) {
        console.warn('[Sync Sheet] Failed with custom URL, trying default URL:', res.error);
        res = await fetchSheetData(DEFAULT_SCRIPT_URL);
      }

      if (res.error) {
        console.warn('[Sync Sheet]', res.error);
      }

      if (res.state) {
        const newState = {
          ...res.state,
          isLoading: false,
          error: null,
          isMockData: false,
        };
        setSheetState((prev) => ({
          ...prev,
          ...newState,
        }));
        try {
          localStorage.setItem('ure_sul_3_cached_state', JSON.stringify(res.state));
        } catch {
          // Ignore storage quota error
        }
      } else if (!silent) {
        setSheetState((prev) => ({
          ...prev,
          isLoading: false,
          error: res.error || null,
        }));
      }
    } catch (err: any) {
      console.error('[Sync Sheet Exception]', err);
      if (!silent) {
        setSheetState((prev) => ({
          ...prev,
          isLoading: false,
          error: err?.message || 'Erro ao sincronizar dados',
        }));
      }
    } finally {
      setSheetState((prev) => ({ ...prev, isLoading: false }));
      isFetchingRef.current = false;
    }
  }, [scriptUrl]);

  const handleSaveScriptUrl = async (newUrl: string): Promise<boolean> => {
    const trimmed = newUrl.trim().replace(/^['"]|['"]$/g, '');
    try {
      localStorage.setItem(SCRIPT_STORAGE_KEY, trimmed);
      setScriptUrl(trimmed);
      try {
        localStorage.removeItem('ure_sul_3_cached_state');
      } catch {}
      await loadData(trimmed, false);
      return true;
    } catch {
      return false;
    }
  };

  const handleUploadLocalSpreadsheet = useCallback((newState: SheetState) => {
    setSheetState({
      ...newState,
      isLoading: false,
      error: null,
      isMockData: false,
    });
    try {
      localStorage.setItem('ure_sul_3_cached_state', JSON.stringify(newState));
    } catch {
      // Ignore quota
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData(scriptUrl, false);
  }, [loadData, scriptUrl]);

  // Background auto-sync (every 45 seconds, non-blocking and silent)
  // Automatically pulls fresh data as soon as the spreadsheet is updated in Google Drive/Sheets
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(scriptUrl, true);
    }, 45000);

    const handleFocus = () => {
      loadData(scriptUrl, true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData(scriptUrl, true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [scriptUrl, loadData]);

  const handleRefresh = useCallback(() => {
    try {
      localStorage.removeItem('ure_sul_3_cached_state');
    } catch {}
    loadData(scriptUrl, false);
  }, [scriptUrl, loadData]);

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        isDark
          ? 'bg-[#060b17] text-slate-100 selection:bg-blue-600 selection:text-white'
          : 'bg-slate-50 text-slate-900 selection:bg-blue-900 selection:text-white'
      }`}
    >
      {/* Cabeçalho Institucional Centralizado com Botão de Modo Escuro / Claro */}
      <Header
        sheetUpdatedAt={sheetState.sheetUpdatedAt}
        isLoading={sheetState.isLoading}
        onRefresh={handleRefresh}
        isRefreshing={sheetState.isLoading}
        onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
      />

      {/* Modal de Conexão com a Planilha Google ou Upload */}
      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        currentUrl={scriptUrl}
        onSaveUrl={handleSaveScriptUrl}
        onUploadLocalSpreadsheet={handleUploadLocalSpreadsheet}
        sheetTitle={sheetState.sheetTitle}
        sheetUpdatedAt={sheetState.sheetUpdatedAt}
      />

      {sheetState.error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 w-full">
          <div
            className={`p-3.5 rounded-xl border text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs ${
              isDark
                ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold">Aviso de sincronização:</span>
              <span>{sheetState.error}</span>
            </div>
            <button
              type="button"
              onClick={() => loadData(scriptUrl, false)}
              className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs transition-colors shrink-0 cursor-pointer shadow-2xs"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      )}

      {/* Painel Unificado */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <UnifiedDashboard
          components={sheetState.components}
          componentNames={sheetState.componentNames}
          allSchools={sheetState.allSchools || []}
          attendedWithoutSedEvaluation={sheetState.attendedWithoutSedEvaluation || []}
          selectedSchool={selectedSchool}
          onSelectSchool={setSelectedSchool}
          selectedComponent={selectedComponent}
          onSelectComponent={setSelectedComponent}
          sheetUpdatedAt={sheetState.sheetUpdatedAt}
          isMockData={sheetState.isMockData}
        />
      </main>

      {/* Rodapé Limpo e Centralizado */}
      <footer
        className={`mt-auto border-t py-5 transition-colors ${
          isDark
            ? 'border-slate-800/80 bg-[#070d19]/90 text-slate-400'
            : 'border-slate-200/80 bg-white/80 text-slate-600'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs font-semibold tracking-wide">
          Desenvolvido por Manoel Pereira • Diretoria de Ensino Região URE Sul 3
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DashboardApp />
    </ThemeProvider>
  );
}
