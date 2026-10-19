import React, { useState, useMemo, useCallback } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Download,
  FileText,
  School,
  Search,
  ChevronDown,
  Check,
  RotateCcw,
  BookOpen,
  GraduationCap,
  Layers,
  Building2,
  PieChart as PieChartIcon,
  MessageSquare,
  Sparkles,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';
import { ComponentData, AttendedPendingEvaluation } from '../types';
import {
  normalizeText,
  getComponentArea,
  getAllLocalObservations,
  syncObservationToOnlineSheet,
  getObservationKey,
} from '../services/sheetService';
import { exportTeachersToPdf } from '../utils/pdfExport';
import { exportTeachersToExcel } from '../utils/excelExport';
import { useTheme } from '../context/ThemeContext';

export type SituacaoType = 'FORMADOS' | 'NAO_FORMADO';

export interface DashboardTeacherRecord {
  id: string;
  docente: string;
  cargo?: string;
  escola: string;
  area: string;
  formacoesPrevistas: number;
  formacoesConcluidas: number;
  situacao: SituacaoType;
  isCompleted: boolean;
  percentual: number;
  faltam: number;
  observacao?: string;
  isMultiRole?: boolean;
  totalRolesInSchool?: number;
}

interface UnifiedDashboardProps {
  components: Record<string, ComponentData>;
  componentNames: string[];
  allSchools: string[];
  attendedWithoutSedEvaluation?: AttendedPendingEvaluation[];
  selectedSchool: string;
  onSelectSchool: (school: string) => void;
  selectedComponent: string;
  onSelectComponent: (component: string) => void;
  sheetUpdatedAt?: string | null;
  isMockData?: boolean;
}

const ALL_AREAS = [
  'ANOS INICIAIS',
  'CIÊNCIAS DA NATUREZA',
  'CIÊNCIAS HUMANAS',
  'LINGUAGENS',
  'LÍNGUA PORTUGUESA',
  'MATEMÁTICA',
  'TECNOLOGIA',
];

export const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({
  components,
  allSchools,
  selectedSchool,
  onSelectSchool,
  sheetUpdatedAt,
}) => {
  const { isDark } = useTheme();

  // Estados de Filtro e Visualização
  const [selectedArea, setSelectedArea] = useState<string>('TODAS');
  const [viewMode, setViewMode] = useState<'areas' | 'escolas' | 'publico_alvo'>('areas');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'FORMADOS' | 'NAO_FORMADO'>('TODOS');
  const [schoolSearch, setSchoolSearch] = useState('');
  const [isSchoolMenuOpen, setIsSchoolMenuOpen] = useState(false);

  // Observações salvas localmente e sincronizadas online
  const [observationsMap, setObservationsMap] = useState<Record<string, string>>(() =>
    getAllLocalObservations()
  );
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'idle'>>({});

  // Quando uma escola específica é selecionada, exibe automaticamente todos os professores daquela escola com campo de observação
  React.useEffect(() => {
    if (selectedSchool && selectedSchool !== 'TODAS') {
      setViewMode('publico_alvo');
    }
  }, [selectedSchool]);

  // 1. Extração unificada de todas as atribuições / registros de professores da planilha
  const allRawRecords = useMemo(() => {
    const list: DashboardTeacherRecord[] = [];
    let counter = 0;

    (Object.entries(components) as [string, ComponentData][]).forEach(([cName, cData]) => {
      if (normalizeText(cName).includes('formado')) return;
      if (!cData || !cData.records) return;

      cData.records.forEach((r) => {
        counter++;
        const prev = r.formacoesPrevistas > 0 ? r.formacoesPrevistas : 1;
        const conc = r.formacoesConcluidas >= 0 ? r.formacoesConcluidas : 0;
        const isDone = r.isCompleted || (prev > 0 && conc >= prev);
        const perc = prev > 0 ? Math.min(100, Math.round((conc / prev) * 100)) : conc > 0 ? 100 : 0;
        const faltam = isDone ? 0 : Math.max(0, prev - conc);

        const obsKey = getObservationKey(r.escola, r.docente, r.cargo, r.area);
        const currentObs =
          observationsMap[obsKey] !== undefined ? observationsMap[obsKey] : r.observacao || '';

        list.push({
          id: `rec_${counter}_${normalizeText(r.docente)}_${normalizeText(r.escola)}_${normalizeText(r.area || '')}`,
          docente: r.docente,
          cargo: r.cargo || 'PROFESSOR',
          escola: r.escola || 'Escola não vinculada',
          area: r.area || getComponentArea(cName, r.area),
          formacoesPrevistas: prev,
          formacoesConcluidas: conc,
          situacao: isDone ? 'FORMADOS' : 'NAO_FORMADO',
          isCompleted: isDone,
          percentual: perc,
          faltam,
          observacao: currentObs,
        });
      });
    });

    // Mapeia contagem de atribuições por professor na mesma escola
    const schoolProfCount = new Map<string, number>();
    list.forEach((r) => {
      const key = `${normalizeText(r.escola)}::${normalizeText(r.docente)}`;
      schoolProfCount.set(key, (schoolProfCount.get(key) || 0) + 1);
    });

    list.forEach((r) => {
      const key = `${normalizeText(r.escola)}::${normalizeText(r.docente)}`;
      const count = schoolProfCount.get(key) || 1;
      r.isMultiRole = count > 1;
      r.totalRolesInSchool = count;
    });

    return list;
  }, [components, observationsMap]);

  // Contagem de atribuições por escola para o dropdown
  const schoolTeacherCounts = useMemo(() => {
    const map = new Map<string, number>();
    allRawRecords.forEach((r) => {
      if (r.escola && r.escola !== 'Escola não vinculada' && r.escola !== 'Escola não informada') {
        const norm = normalizeText(r.escola);
        map.set(norm, (map.get(norm) || 0) + 1);
      }
    });
    return map;
  }, [allRawRecords]);

  // Escolas filtradas na busca do dropdown
  const filteredSchoolOptions = useMemo(() => {
    const sorted = [...allSchools].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!schoolSearch.trim()) return sorted;
    const term = normalizeText(schoolSearch);
    return sorted.filter((s) => normalizeText(s).includes(term));
  }, [allSchools, schoolSearch]);

  // Registros filtrados pela seleção atual de Escola e Área
  const scopeFilteredRecords = useMemo(() => {
    return allRawRecords.filter((r) => {
      if (selectedSchool !== 'TODAS') {
        const target = normalizeText(selectedSchool);
        if (!normalizeText(r.escola).includes(target)) return false;
      }
      if (selectedArea !== 'TODAS') {
        const targetArea = normalizeText(selectedArea);
        if (normalizeText(r.area) !== targetArea) return false;
      }
      return true;
    });
  }, [allRawRecords, selectedSchool, selectedArea]);

  // Registros exibidos na tabela (com filtro de status e texto)
  const displayedRecords = useMemo(() => {
    let result = scopeFilteredRecords;

    if (statusFilter === 'FORMADOS') {
      result = result.filter((r) => r.isCompleted || r.situacao === 'FORMADOS');
    } else if (statusFilter === 'NAO_FORMADO') {
      result = result.filter((r) => !r.isCompleted && r.situacao !== 'FORMADOS');
    }

    if (searchTerm.trim()) {
      const term = normalizeText(searchTerm);
      result = result.filter(
        (r) =>
          normalizeText(r.docente).includes(term) ||
          normalizeText(r.cargo || '').includes(term) ||
          normalizeText(r.escola).includes(term) ||
          normalizeText(r.area).includes(term) ||
          normalizeText(r.observacao || '').includes(term)
      );
    }

    return [...result].sort((a, b) => {
      const compEsc = (a.escola || '').localeCompare(b.escola || '', 'pt-BR');
      if (compEsc !== 0) return compEsc;
      return (a.docente || '').localeCompare(b.docente || '', 'pt-BR');
    });
  }, [scopeFilteredRecords, statusFilter, searchTerm]);

  // 2. MÉTRICAS DINÂMICAS DOS CARDS
  const metrics = useMemo(() => {
    let prev = 0;
    let conc = 0;
    const uniqueDocs = new Set<string>();
    const formedDocs = new Set<string>();

    scopeFilteredRecords.forEach((r) => {
      prev += r.formacoesPrevistas;
      conc += r.formacoesConcluidas;
      const dKey = normalizeText(r.docente);
      uniqueDocs.add(dKey);
      if (r.isCompleted) {
        formedDocs.add(dKey);
      }
    });

    const pendentes = Math.max(0, prev - conc);
    const percConclusao = prev > 0 ? Number(((conc / prev) * 100).toFixed(1)) : 0;
    const totalAtribuicoes = scopeFilteredRecords.length;
    const totalDocentes = uniqueDocs.size;
    const totalFormados = formedDocs.size;
    const totalNaoFormados = Math.max(0, totalDocentes - totalFormados);

    return {
      totalPrevistas: prev,
      totalConcluidas: conc,
      totalPendentes: pendentes,
      percentualConclusao: percConclusao,
      totalAtribuicoes,
      totalDocentes,
      totalFormados,
      totalNaoFormados,
    };
  }, [scopeFilteredRecords]);

  // 3. TABELA CONSOLIDADA POR ÁREAS (7 ÁREAS)
  const areaTableData = useMemo(() => {
    let totPrev = 0;
    let totConc = 0;
    let totAtrib = 0;
    let totConcluidos = 0;

    const rows = ALL_AREAS.map((areaName) => {
      const areaNorm = normalizeText(areaName);
      const recsInArea = allRawRecords.filter((r) => {
        if (normalizeText(r.area) !== areaNorm) return false;
        if (selectedSchool !== 'TODAS') {
          return normalizeText(r.escola).includes(normalizeText(selectedSchool));
        }
        return true;
      });

      let prev = 0;
      let conc = 0;
      let concCount = 0;

      recsInArea.forEach((r) => {
        prev += r.formacoesPrevistas;
        conc += r.formacoesConcluidas;
        if (r.isCompleted) {
          concCount++;
        }
      });

      const perc = prev > 0 ? (conc / prev) * 100 : 0;
      const pend = Math.max(0, prev - conc);

      totPrev += prev;
      totConc += conc;
      totAtrib += recsInArea.length;
      totConcluidos += concCount;

      return {
        area: areaName,
        previstas: prev,
        concluidas: conc,
        pendentes: pend,
        percentual: perc,
        atribuicoes: recsInArea.length,
        concluidosCount: concCount,
      };
    });

    const percGlobal = totPrev > 0 ? (totConc / totPrev) * 100 : 0;
    const pendGlobal = Math.max(0, totPrev - totConc);

    return {
      rows,
      totalPrevistas: totPrev,
      totalConcluidas: totConc,
      totalPendentes: pendGlobal,
      percentualGlobal: percGlobal,
      totalAtribuicoes: totAtrib,
      totalConcluidos: totConcluidos,
    };
  }, [allRawRecords, selectedSchool]);

  // 4. TABELA CONSOLIDADA POR ESCOLAS
  const schoolAggregates = useMemo(() => {
    const map = new Map<
      string,
      {
        previstas: number;
        concluidas: number;
        atribuicoes: number;
        uniqueTeachers: Set<string>;
      }
    >();

    allSchools.forEach((esc) => {
      map.set(esc, {
        previstas: 0,
        concluidas: 0,
        atribuicoes: 0,
        uniqueTeachers: new Set<string>(),
      });
    });

    allRawRecords.forEach((r) => {
      if (!r.escola || r.escola === 'Escola não vinculada') return;
      if (selectedArea !== 'TODAS' && normalizeText(r.area) !== normalizeText(selectedArea)) {
        return;
      }

      if (!map.has(r.escola)) {
        map.set(r.escola, {
          previstas: 0,
          concluidas: 0,
          atribuicoes: 0,
          uniqueTeachers: new Set<string>(),
        });
      }

      const item = map.get(r.escola)!;
      item.previstas += r.formacoesPrevistas;
      item.concluidas += r.formacoesConcluidas;
      item.atribuicoes += 1;
      item.uniqueTeachers.add(normalizeText(r.docente));
    });

    const list: Array<{
      escola: string;
      previstas: number;
      concluidas: number;
      pendentes: number;
      atribuicoes: number;
      docentesUnicos: number;
      indicador: number;
    }> = [];

    map.forEach((val, escola) => {
      if (val.atribuicoes === 0 && selectedArea !== 'TODAS') return;
      const pend = Math.max(0, val.previstas - val.concluidas);
      const ind = val.previstas > 0 ? (val.concluidas / val.previstas) * 100 : 0;

      list.push({
        escola,
        previstas: val.previstas,
        concluidas: val.concluidas,
        pendentes: pend,
        atribuicoes: val.atribuicoes,
        docentesUnicos: val.uniqueTeachers.size,
        indicador: ind,
      });
    });

    list.sort((a, b) => b.indicador - a.indicador || a.escola.localeCompare(b.escola));
    return list;
  }, [allSchools, allRawRecords, selectedArea]);

  // Totais da Tabela de Escolas
  const schoolTotals = useMemo(() => {
    let previstas = 0;
    let concluidas = 0;
    let atribuicoes = 0;

    schoolAggregates.forEach((s) => {
      previstas += s.previstas;
      concluidas += s.concluidas;
      atribuicoes += s.atribuicoes;
    });

    const pendentes = Math.max(0, previstas - concluidas);
    const indicadorGlobal = previstas > 0 ? (concluidas / previstas) * 100 : 0;

    return {
      previstas,
      concluidas,
      pendentes,
      atribuicoes,
      indicadorGlobal,
    };
  }, [schoolAggregates]);

  // Seleciona a escola e navega automaticamente para a relação de professores
  const handleSelectSchoolAndNavigate = useCallback(
    (schoolName: string) => {
      onSelectSchool(schoolName);
      setIsSchoolMenuOpen(false);
      setViewMode('publico_alvo');
    },
    [onSelectSchool]
  );

  // Atualização e salvamento em tempo real da observação
  const handleUpdateObservation = useCallback(
    async (record: DashboardTeacherRecord, newText: string) => {
      const key = getObservationKey(record.escola, record.docente, record.cargo, record.area);
      setObservationsMap((prev) => ({ ...prev, [key]: newText }));
      setSaveStatus((prev) => ({ ...prev, [key]: 'saving' }));

      await syncObservationToOnlineSheet({
        escola: record.escola,
        docente: record.docente,
        cargo: record.cargo,
        area: record.area,
        observacao: newText,
      });

      setSaveStatus((prev) => ({ ...prev, [key]: 'saved' }));
      setTimeout(() => {
        setSaveStatus((prev) => {
          const clone = { ...prev };
          delete clone[key];
          return clone;
        });
      }, 2500);
    },
    []
  );

  // Exportação em PDF
  const handleExportPDF = useCallback(() => {
    exportTeachersToPdf({
      records: displayedRecords,
      selectedSchool,
      selectedArea,
      statusFilter,
      sheetUpdatedAt: sheetUpdatedAt || null,
    });
  }, [displayedRecords, selectedSchool, selectedArea, statusFilter, sheetUpdatedAt]);

  // Exportação nativa em Excel (.xlsx)
  const handleExportExcel = useCallback(() => {
    exportTeachersToExcel({
      records: displayedRecords,
      selectedSchool,
      selectedArea,
      statusFilter,
      sheetUpdatedAt: sheetUpdatedAt || null,
    });
  }, [displayedRecords, selectedSchool, selectedArea, statusFilter, sheetUpdatedAt]);

  // Exportação em CSV
  const handleExportCSV = useCallback(() => {
    const headers = [
      'Docente / Cargo',
      'Unidade Escolar',
      'Área',
      'Formações Previstas',
      'Formações Concluídas',
      '% Conclusão',
      'Concluído?',
      'Observações',
    ];

    const rows = displayedRecords.map((r) => [
      `"${(`${r.docente}${r.cargo ? ` - ${r.cargo}` : ''}`).replace(/"/g, '""')}"`,
      `"${r.escola.replace(/"/g, '""')}"`,
      `"${r.area.replace(/"/g, '""')}"`,
      r.formacoesPrevistas,
      r.formacoesConcluidas,
      `"${r.percentual}%"`,
      r.isCompleted ? 'SIM' : 'NÃO',
      `"${(r.observacao || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Docentes_Formacoes_URE_Sul_3_${Date.now()}.csv`);
    link.click();
  }, [displayedRecords]);

  return (
    <div className="space-y-6">
      {/* 1. STATUS E FILTROS PRINCIPAIS */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border transition-all ${
          isDark
            ? 'bg-[#0d162a] border-slate-800/90 shadow-lg text-slate-100'
            : 'bg-white border-slate-200 shadow-xs text-slate-900'
        }`}
      >
        {/* Banner com Informações e Ações Rápidas de Exportação */}
        <div className="mb-5 pb-4 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-600 text-white shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Painel de Formações</span>
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-600/60">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Atualizado até 02/10/2026</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer shadow-xs"
              title="Exportar dados filtrados para Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-700 hover:bg-rose-800 text-white transition-colors cursor-pointer shadow-xs"
              title="Exportar dados filtrados para PDF formatado"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Exportar PDF</span>
            </button>

            {(selectedSchool !== 'TODAS' || selectedArea !== 'TODAS' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  onSelectSchool('TODAS');
                  setSelectedArea('TODAS');
                  setSearchTerm('');
                  setStatusFilter('TODOS');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/50 text-rose-300 border border-rose-800/60 hover:bg-rose-900/50 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar Filtros</span>
              </button>
            )}
          </div>
        </div>

        {/* Linha de Filtros: Unidade Escolar & Área do Conhecimento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Filtro 1: Unidade Escolar */}
          <div className="relative">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Unidade Escolar:
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSchoolMenuOpen(!isSchoolMenuOpen)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-left text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-[#152342] border-slate-700 text-white hover:border-blue-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 hover:border-blue-500'
                }`}
              >
                <span className="truncate">
                  {selectedSchool === 'TODAS'
                    ? `Todas as Escolas (${allSchools.length})`
                    : selectedSchool}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
              </button>

              {isSchoolMenuOpen && (
                <div
                  className={`absolute z-50 left-0 right-0 mt-1 rounded-xl border shadow-2xl overflow-hidden max-h-72 flex flex-col ${
                    isDark ? 'bg-[#0d162a] border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="p-2 border-b border-slate-700">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Pesquisar escola..."
                        value={schoolSearch}
                        onChange={(e) => setSchoolSearch(e.target.value)}
                        className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-hidden ${
                          isDark ? 'bg-[#152342] text-white' : 'bg-slate-100 text-slate-900'
                        }`}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="overflow-y-auto flex-1 p-1">
                    <button
                      type="button"
                      onClick={() => handleSelectSchoolAndNavigate('TODAS')}
                      className={`w-full px-3 py-2 rounded-lg text-xs font-bold text-left flex items-center justify-between transition-colors cursor-pointer ${
                        selectedSchool === 'TODAS'
                          ? 'bg-blue-600 text-white'
                          : isDark
                          ? 'text-slate-200 hover:bg-slate-800/80'
                          : 'text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <span>Todas as Escolas</span>
                      <span className="text-[10px] opacity-80">{allSchools.length} escolas</span>
                    </button>

                    {filteredSchoolOptions.map((sch) => {
                      const count = schoolTeacherCounts.get(normalizeText(sch)) || 0;
                      return (
                        <button
                          key={sch}
                          type="button"
                          onClick={() => handleSelectSchoolAndNavigate(sch)}
                          className={`w-full px-3 py-2 rounded-lg text-xs text-left flex items-center justify-between transition-colors cursor-pointer ${
                            selectedSchool === sch
                              ? 'bg-blue-600 text-white font-bold'
                              : isDark
                              ? 'text-slate-300 hover:bg-slate-800/80'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="truncate pr-2">{sch}</span>
                          <span className="text-[10px] opacity-75 shrink-0">
                            {count} atribuições
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Filtro 2: Área do Conhecimento */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Área do Conhecimento:
            </label>
            <div className="relative">
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border appearance-none text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-[#152342] border-slate-700 text-white hover:border-blue-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 hover:border-blue-500'
                }`}
              >
                <option value="TODAS">Todas as Áreas (7 Áreas)</option>
                {ALL_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Informação sobre os dados ativos */}
        <div className="mt-4 pt-3 border-t border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2">
          <div>
            Exibindo:{' '}
            <strong className="text-white">
              {selectedSchool === 'TODAS' ? 'Todas as Escolas' : selectedSchool}
            </strong>{' '}
            • Área:{' '}
            <strong className="text-white">
              {selectedArea === 'TODAS' ? 'Todas as Áreas' : selectedArea}
            </strong>
          </div>
          <div className="text-slate-300">
            Total de atribuições:{' '}
            <strong className="text-white">{metrics.totalAtribuicoes}</strong> (
            {metrics.totalDocentes} docentes únicos)
          </div>
        </div>
      </div>

      {/* 2. BARRA DE NAVEGAÇÃO ENTRE AS VISÕES */}
      <div
        className={`p-2.5 rounded-2xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isDark ? 'bg-[#0d162a] border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('areas')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'areas'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-[1.02]'
                : isDark
                ? 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 border border-slate-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Visão por Áreas (7 Áreas)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('escolas')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'escolas'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-[1.02]'
                : isDark
                ? 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 border border-slate-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Visão por Escolas ({schoolAggregates.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('publico_alvo')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'publico_alvo'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-[1.02]'
                : isDark
                ? 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 border border-slate-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>
              Docentes {selectedSchool !== 'TODAS' ? `(${selectedSchool.split(' ')[0]})` : ''} ({metrics.totalAtribuicoes})
            </span>
          </button>
        </div>
      </div>

      {/* 3. CARDS NO TOPO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: FORMAÇÕES PREVISTAS */}
        <div
          className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
            isDark ? 'bg-[#0a152d] border-blue-600/60 shadow-md' : 'bg-white border-blue-200 shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between w-full">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                FORMAÇÕES PREVISTAS
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedSchool === 'TODAS' ? 'Consolidado total da rede' : `Meta em ${selectedSchool}`}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <GraduationCap className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-black text-white block tracking-tight">
              {metrics.totalPrevistas.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-700/50 text-[11px] font-semibold text-sky-300">
            {metrics.totalAtribuicoes} docentes com formação prevista
          </div>
        </div>

        {/* Card 2: FORMAÇÕES CONCLUÍDAS */}
        <div
          onClick={() => {
            setStatusFilter('FORMADOS');
            setViewMode('publico_alvo');
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('FORMADOS')}
          className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
            isDark
              ? statusFilter === 'FORMADOS'
                ? 'bg-[#07241d] border-emerald-500 ring-2 ring-emerald-400 shadow-md'
                : 'bg-[#07241d] border-emerald-600/60 hover:border-emerald-500'
              : statusFilter === 'FORMADOS'
              ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500'
              : 'bg-white border-emerald-200 hover:border-emerald-400 shadow-xs'
          }`}
          title="Clique para filtrar apenas formações concluídas"
        >
          <div className="flex items-start justify-between w-full">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                FORMAÇÕES CONCLUÍDAS
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">Conclusões registradas</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
                {metrics.totalConcluidas.toLocaleString('pt-BR')}
              </span>
              <span className="text-lg font-bold text-emerald-300">
                ({metrics.percentualConclusao.toFixed(1)}%)
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-700/50 text-[11px] font-semibold text-emerald-300">
            Filtrar concluídos →
          </div>
        </div>

        {/* Card 3: PENDENTES / A CONCLUIR */}
        <div
          onClick={() => {
            setStatusFilter('NAO_FORMADO');
            setViewMode('publico_alvo');
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('NAO_FORMADO')}
          className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
            isDark
              ? statusFilter === 'NAO_FORMADO'
                ? 'bg-[#290d19] border-rose-500 ring-2 ring-rose-400 shadow-md'
                : 'bg-[#1e0e1a] border-rose-600/40 hover:border-rose-500'
              : statusFilter === 'NAO_FORMADO'
              ? 'bg-rose-50 border-rose-600 ring-2 ring-rose-500'
              : 'bg-white border-rose-200 hover:border-rose-400 shadow-xs'
          }`}
          title="Clique para filtrar apenas pendentes"
        >
          <div className="flex items-start justify-between w-full">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                PENDENTES
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">Formações restantes</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <XCircle className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-rose-400 tracking-tight">
                {metrics.totalPendentes.toLocaleString('pt-BR')}
              </span>
              <span className="text-lg font-bold text-rose-300">
                ({(100 - metrics.percentualConclusao).toFixed(1)}%)
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-700/50 text-[11px] font-semibold text-rose-300">
            Filtrar pendentes →
          </div>
        </div>

        {/* Card 4: ÍNDICE DE FORMAÇÃO */}
        <div
          className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
            isDark ? 'bg-[#0f172a] border-slate-700 shadow-md' : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between w-full">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                ÍNDICE DE CONCLUSÃO
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">Percentual atingido</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <PieChartIcon className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {metrics.percentualConclusao.toFixed(1)}%
            </span>
            <div className="w-full bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, metrics.percentualConclusao)}%` }}
              />
            </div>
          </div>
          <div className="pt-2 border-t border-slate-700/50 text-[11px] font-semibold text-slate-300">
            {metrics.totalConcluidas} concluídas de {metrics.totalPrevistas} previstas
          </div>
        </div>
      </div>

      {/* 4. VISÃO: TABELA DE ÁREAS */}
      {viewMode === 'areas' && (
        <div className="space-y-6">
          <div
            className={`rounded-2xl border overflow-hidden shadow-lg transition-colors ${
              isDark ? 'bg-[#0d162a] border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="p-4 sm:p-5 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white">
                    Consolidado por Área do Conhecimento (7 Áreas)
                    {selectedSchool !== 'TODAS' ? ` • ${selectedSchool}` : ''}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Acompanhamento de formações previstas, concluídas e percentual
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#091122] text-slate-200 border-b border-slate-800 text-[11px] font-bold">
                    <th className="px-4 py-3.5 border-r border-slate-800">Área do Conhecimento</th>
                    <th className="px-3 py-3.5 text-center border-r border-slate-800">Formações Previstas</th>
                    <th className="px-3 py-3.5 text-center border-r border-slate-800 text-emerald-400">
                      Formações Concluídas
                    </th>
                    <th className="px-3 py-3.5 text-center border-r border-slate-800 text-rose-400">
                      Pendentes
                    </th>
                    <th className="px-3 py-3.5 text-center border-r border-slate-800 bg-[#e05638] text-white">
                      % Conclusão
                    </th>
                    <th className="px-3 py-3.5 text-center">Atribuições / Docentes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {areaTableData.rows.map((a, idx) => (
                    <tr
                      key={a.area}
                      onClick={() => {
                        setSelectedArea(a.area);
                        setViewMode('publico_alvo');
                      }}
                      className={`transition-colors cursor-pointer ${
                        idx % 2 === 0 ? 'bg-[#0c152a]' : 'bg-[#080f1e]'
                      } hover:bg-blue-900/30`}
                      title="Clique para ver os docentes desta área"
                    >
                      <td className="px-4 py-3 font-bold text-white border-r border-slate-800">
                        {a.area}
                      </td>
                      <td className="px-3 py-3 text-center border-r border-slate-800 text-slate-200 font-semibold">
                        {a.previstas.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-3 text-center border-r border-slate-800 text-emerald-400 font-bold">
                        {a.concluidas.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-3 text-center border-r border-slate-800 text-rose-300 font-semibold">
                        {a.pendentes.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-3 text-center font-extrabold border-r border-slate-800 bg-[#e05638] text-white">
                        {a.percentual.toFixed(1).replace('.', ',')}%
                      </td>
                      <td className="px-3 py-3 text-center text-slate-300">
                        {a.atribuicoes.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-black text-white font-black border-t-2 border-slate-700 text-xs">
                    <td className="px-4 py-3.5 border-r border-slate-800 uppercase tracking-wider">
                      CONSOLIDADO GERAL / TOTAL
                    </td>
                    <td className="px-3 py-3.5 text-center border-r border-slate-800 text-sky-300">
                      {areaTableData.totalPrevistas.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-3.5 text-center border-r border-slate-800 text-emerald-400">
                      {areaTableData.totalConcluidas.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-3.5 text-center border-r border-slate-800 text-rose-300">
                      {areaTableData.totalPendentes.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-3.5 text-center border-r border-slate-800 bg-[#e05638] text-white">
                      {areaTableData.percentualGlobal.toFixed(1).replace('.', ',')}%
                    </td>
                    <td className="px-3 py-3.5 text-center text-slate-200">
                      {areaTableData.totalAtribuicoes.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. VISÃO: TABELA DE ESCOLAS */}
      {viewMode === 'escolas' && (
        <div
          className={`rounded-2xl border overflow-hidden shadow-lg transition-colors ${
            isDark ? 'bg-[#0d162a] border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="p-4 sm:p-5 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center">
                <School className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  Indicadores de Formação por Escola ({schoolAggregates.length} Unidades)
                  {selectedArea !== 'TODAS' ? ` • Área: ${selectedArea}` : ''}
                </h3>
                <p className="text-xs text-slate-400">
                  Acompanhamento consolidado por escola: formações previstas, concluídas e percentual de atendimento
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#091122] text-slate-200 border-b border-slate-800 text-[11px] font-bold">
                  <th className="px-4 py-3.5 border-r border-slate-800">Unidade Escolar</th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-800">Formações Previstas</th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-800 text-emerald-400">
                    Formações Concluídas
                  </th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-800 text-rose-400">
                    Pendentes
                  </th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-800 bg-[#e05638] text-white">
                    % Conclusão
                  </th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-800">Atribuições</th>
                  <th className="px-3 py-3.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {schoolAggregates.map((s, idx) => (
                  <tr
                    key={s.escola}
                    className={`transition-colors ${
                      idx % 2 === 0 ? 'bg-[#0c152a]' : 'bg-[#080f1e]'
                    } hover:bg-blue-900/30`}
                  >
                    <td className="px-4 py-2.5 font-bold text-white border-r border-slate-800 truncate max-w-[320px]">
                      {s.escola}
                    </td>
                    <td className="px-3 py-2.5 text-center border-r border-slate-800 text-slate-300 font-semibold">
                      {s.previstas}
                    </td>
                    <td className="px-3 py-2.5 text-center border-r border-slate-800 text-emerald-400 font-bold">
                      {s.concluidas}
                    </td>
                    <td className="px-3 py-2.5 text-center border-r border-slate-800 text-rose-300">
                      {s.pendentes}
                    </td>
                    <td className="px-3 py-2.5 text-center font-extrabold border-r border-slate-800 bg-[#e05638] text-white">
                      {s.indicador.toFixed(1).replace('.', ',')}%
                    </td>
                    <td className="px-3 py-2.5 text-center border-r border-slate-800 text-slate-300">
                      {s.atribuicoes}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleSelectSchoolAndNavigate(s.escola)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
                      >
                        Ver Docentes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-black text-white font-black border-t-2 border-slate-700 text-xs">
                  <td className="px-4 py-3.5 border-r border-slate-800 uppercase tracking-wider">
                    Total Geral ({schoolAggregates.length} Escolas)
                  </td>
                  <td className="px-3 py-3.5 text-center border-r border-slate-800 text-sky-300">
                    {schoolTotals.previstas.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-3.5 text-center border-r border-slate-800 text-emerald-400">
                    {schoolTotals.concluidas.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-3.5 text-center border-r border-slate-800 text-rose-300">
                    {schoolTotals.pendentes.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-3.5 text-center border-r border-slate-800 bg-[#e05638] text-white">
                    {schoolTotals.indicadorGlobal.toFixed(1).replace('.', ',')}%
                  </td>
                  <td className="px-3 py-3.5 text-center border-r border-slate-800 text-slate-200">
                    {schoolTotals.atribuicoes.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-3.5 text-center text-slate-400">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 6. VISÃO: RELAÇÃO DE DOCENTES (SEM CPF, COM CARGO NA MESMA COLUNA, UNIDADE ESCOLAR E OBSERVAÇÕES NO FINAL) */}
      {viewMode === 'publico_alvo' && (
        <div className="space-y-6">
          <div
            className={`rounded-2xl border overflow-hidden shadow-lg transition-colors ${
              isDark ? 'bg-[#0d162a] border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            {/* Barra Superior da Tabela */}
            <div className="p-4 sm:p-5 border-b border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-white">
                      {selectedSchool === 'TODAS'
                        ? 'Relação de Docentes - Rede Geral'
                        : `Docentes • ${selectedSchool}`}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Total: {metrics.totalPrevistas} previstas • {metrics.totalConcluidas} concluídas ({displayedRecords.length} atribuições listadas)
                    </p>
                  </div>
                </div>

                {statusFilter !== 'TODOS' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-900/60 text-blue-300 border border-blue-700">
                    <span>Filtro:</span>
                    <strong>{statusFilter === 'FORMADOS' ? 'Concluídos' : 'Pendentes'}</strong>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('TODOS')}
                      className="ml-1 text-blue-300 hover:text-white cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>

              {/* Busca e Botões de Exportação (PDF e Excel) */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar docente, cargo, escola..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs focus:outline-hidden ${
                      isDark
                        ? 'bg-[#152342] border-slate-700 text-white placeholder:text-slate-500 focus:ring-1 focus:ring-blue-400'
                        : 'bg-white border-slate-300 text-slate-900 focus:ring-1 focus:ring-blue-900'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* Botão de Exportar Excel */}
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={displayedRecords.length === 0}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs min-h-[36px]"
                    title="Exportar planilha completa em formato Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Exportar Excel</span>
                  </button>

                  {/* Botão de Exportar PDF */}
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    disabled={displayedRecords.length === 0}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 transition-colors disabled:opacity-50 cursor-pointer shadow-xs min-h-[36px]"
                    title="Exportar relatório formatado em PDF"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Exportar PDF</span>
                  </button>

                  {/* Botão de Exportar CSV */}
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    disabled={displayedRecords.length === 0}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs min-h-[36px]"
                    title="Exportar em formato CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>
            </div>

            {/* TABELA COM DOCENTE/CARGO NA MESMA COLUNA, UNIDADE ESCOLAR E OBSERVAÇÕES NO FINAL */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#091122] text-slate-200 border-b border-slate-800 text-[11px] font-bold">
                    <th className="px-4 py-3.5 border-r border-slate-800 min-w-[260px]">
                      Docente / Cargo
                    </th>
                    <th className="px-3 py-3.5 border-r border-slate-800 min-w-[200px]">
                      Unidade Escolar
                    </th>
                    <th className="px-3 py-3.5 border-r border-slate-800 min-w-[140px] text-center">
                      Área
                    </th>
                    <th className="px-3 py-3.5 text-center border-r border-slate-800 w-24">
                      Formações Previstas
                    </th>
                    <th className="px-3 py-3.5 text-center border-r border-slate-800 w-24 text-emerald-400">
                      Formações Concluídas
                    </th>
                    <th className="px-3 py-3.5 text-center border-r border-slate-800 w-24">
                      Concluído
                    </th>
                    <th className="px-3 py-3.5 min-w-[280px]">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                        <span>Observações (Salvas Automaticamente)</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-sans">
                  {displayedRecords.length > 0 ? (
                    displayedRecords.map((r, index) => {
                      const isFullyDone = r.isCompleted || (r.formacoesPrevistas > 0 && r.formacoesConcluidas >= r.formacoesPrevistas);
                      const obsKey = getObservationKey(r.escola, r.docente, r.cargo, r.area);
                      const currentStatus = saveStatus[obsKey];

                      return (
                        <tr
                          key={`${r.id}-${index}`}
                          className={`transition-colors hover:bg-blue-950/40 ${
                            index % 2 === 0 ? 'bg-[#0c152a]' : 'bg-[#080f1e]'
                          }`}
                        >
                          {/* Coluna 1: Docente / Cargo na mesma coluna */}
                          <td className="px-4 py-3 border-r border-slate-800">
                            <div className="flex flex-col">
                              <span className="font-bold text-white text-xs sm:text-sm">
                                {r.docente}
                              </span>
                              <span className="text-[11px] text-sky-400 font-semibold mt-0.5">
                                {r.cargo || 'PROFESSOR'}
                              </span>
                              {r.isMultiRole && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-semibold mt-1">
                                  <span>• Professor possui {r.totalRolesInSchool} atribuições nesta escola (áreas/cargos)</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Coluna 2: Unidade Escolar (Vinda da Planilha Online) */}
                          <td className="px-3 py-3 border-r border-slate-800 font-medium text-slate-200">
                            {r.escola}
                          </td>

                          {/* Coluna 3: Área */}
                          <td className="px-3 py-3 text-center border-r border-slate-800 font-semibold text-slate-300">
                            {r.area}
                          </td>

                          {/* Coluna 4: Formações Previstas */}
                          <td className="px-3 py-3 text-center border-r border-slate-800 font-bold text-white text-sm">
                            {r.formacoesPrevistas}
                          </td>

                          {/* Coluna 5: Formações Concluídas */}
                          <td className="px-3 py-3 text-center border-r border-slate-800 font-extrabold text-emerald-400 text-sm">
                            {r.formacoesConcluidas > 0 ? r.formacoesConcluidas : ''}
                          </td>

                          {/* Coluna 6: Concluído */}
                          <td className="px-3 py-3 text-center border-r border-slate-800">
                            {isFullyDone ? (
                              <div className="flex items-center justify-center" title="Concluído (100%)">
                                <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400 shadow-xs">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              </div>
                            ) : (
                              <div
                                className="flex items-center justify-center"
                                title={
                                  r.formacoesConcluidas > 0
                                    ? `Parcial (${r.formacoesConcluidas}/${r.formacoesPrevistas})`
                                    : 'Não Concluído'
                                }
                              >
                                <div className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500 flex items-center justify-center text-rose-500 shadow-xs">
                                  <span className="text-xs font-black leading-none">✕</span>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Coluna 7: Observações (NO FINAL DE CADA LINHA - SALVAMENTO AUTOMÁTICO) */}
                          <td className="px-3 py-2">
                            <div className="relative flex items-center gap-1.5">
                              <input
                                type="text"
                                value={observationsMap[obsKey] !== undefined ? observationsMap[obsKey] : (r.observacao || '')}
                                placeholder="Inserir observação..."
                                onChange={(e) => {
                                  const text = e.target.value;
                                  setObservationsMap((prev) => ({ ...prev, [obsKey]: text }));
                                }}
                                onBlur={(e) => {
                                  const text = e.target.value;
                                  handleUpdateObservation(r, text);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs transition-all focus:outline-hidden ${
                                  isDark
                                    ? 'bg-[#152342] border-slate-700/80 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:ring-1 focus:ring-amber-600'
                                }`}
                              />
                              {currentStatus === 'saving' && (
                                <span
                                  className="shrink-0 text-amber-400 text-[10px] font-bold animate-pulse"
                                  title="Salvando na planilha online..."
                                >
                                  Salvando...
                                </span>
                              )}
                              {currentStatus === 'saved' && (
                                <span
                                  className="shrink-0 inline-flex items-center gap-0.5 text-emerald-400 text-[10px] font-bold"
                                  title="Salvo com sucesso!"
                                >
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Salvo</span>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-medium">
                        Nenhum docente localizado para os filtros informados.
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Rodapé Total */}
                <tfoot>
                  <tr className="bg-black text-white font-black border-t-2 border-slate-700 text-xs">
                    <td className="px-3 py-3 text-left pl-4 border-r border-slate-800" colSpan={3}>
                      Total ({displayedRecords.length} atribuições)
                    </td>
                    <td className="px-3 py-3 text-center border-r border-slate-800 text-sm font-black">
                      {metrics.totalPrevistas}
                    </td>
                    <td className="px-3 py-3 text-center border-r border-slate-800 text-sm font-black text-emerald-400">
                      {metrics.totalConcluidas}
                    </td>
                    <td className="px-3 py-3 text-center border-r border-slate-800 text-sm font-black">
                      {metrics.percentualConclusao.toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-slate-400 text-[11px] font-normal italic">
                      {displayedRecords.length} registros listados
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
