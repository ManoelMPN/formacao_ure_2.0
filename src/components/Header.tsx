import React from 'react';
import { RotateCw, Lock, Sun, Moon, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  sheetUpdatedAt: string | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenSheetsModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sheetUpdatedAt,
  isLoading = false,
  onRefresh,
  isRefreshing = false,
  onOpenSheetsModal,
}) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="border-b transition-colors duration-200 bg-[#070d19] dark:bg-[#070d19] border-slate-800/80 text-white">
      {/* Faixa superior no topo estilizada */}
      <div className="h-1 w-full bg-gradient-to-r from-blue-700 via-sky-500 to-indigo-600" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Bloco de Título Totalmente Centralizado */}
        <div className="flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
          {/* Título: FORMAÇÕES - URE SUL 3 */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-white uppercase drop-shadow-sm font-sans">
            FORMAÇÕES - URE SUL 3
          </h1>

          {/* Subtítulo: 2º SEMESTRE */}
          <h2 className="text-sm sm:text-base md:text-lg font-bold tracking-wider text-sky-400 mt-1 uppercase">
            2º SEMESTRE
          </h2>

          {/* Badge: Informações atualizadas até 02/10/2026 */}
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-500/40 text-[11px] sm:text-xs font-semibold text-blue-200 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span>Informações atualizadas até 02/10/2026</span>
          </div>

          {/* Linha de Ações: Sincronizado com o servidor | ADM | Modo Claro/Escuro */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mt-4 text-xs font-semibold">
            {/* 1. Status: Sincronizado com o servidor */}
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
                isLoading || isRefreshing
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                  : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isLoading || isRefreshing ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isLoading || isRefreshing ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
              </span>
              <span>
                {isLoading || isRefreshing ? 'Sincronizando dados...' : 'Sincronizado com o servidor'}
              </span>

              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isLoading || isRefreshing}
                  title={`Atualizar agora (${sheetUpdatedAt || 'Recente'})`}
                  className="ml-1 p-0.5 text-emerald-400/80 hover:text-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RotateCw className={`w-3 h-3 ${isLoading || isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {/* 2. Botão ADM */}
            {onOpenSheetsModal && (
              <button
                type="button"
                onClick={onOpenSheetsModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 hover:text-white transition-all shadow-xs cursor-pointer active:scale-95"
                title="Painel de Administração da Planilha / Conexão Google Sheets"
              >
                <Lock className="w-3.5 h-3.5 text-slate-300" />
                <span>ADM</span>
              </button>
            )}

            {/* 3. Alternador de Modo: Modo Claro / Modo Escuro */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border transition-all shadow-xs cursor-pointer active:scale-95 ${
                isDark
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-300 hover:bg-amber-900/50 hover:text-amber-200'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
              title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-sky-300" />
                  <span>Modo Escuro</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
