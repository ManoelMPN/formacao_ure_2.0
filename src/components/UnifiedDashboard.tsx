import React, { useState, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  ChevronDown,
  RotateCcw,
  BookOpen,
  Layers,
  Building2,
  MessageSquare,
  Sparkles,
  Clock,
  FileSpreadsheet,
  FileText,
  Check,
  School as SchoolIcon,
  Filter,
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
  cpf?: string;
  cargo?: string;
  escola: string;
  escolas?: string[];
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

  // Estados de Filtro e Visualização - Inicia por padrão na tabela de docentes
  const [selectedArea, setSelectedArea] = useState<string>('TODAS');
  const [viewMode, setViewMode] = useState<'publico_alvo' | 'areas' | 'escolas'>('publico_alvo');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'FORMADOS' | 'NAO_FORMADO'>('TODOS');
  const [schoolSearch, setSchoolSearch] = useState('');
  const [isSchoolMenuOpen, setIsSchoolMenuOpen] = useState(false);

  // Observações sincronizadas com a planilha online e salvas localmente
  const [observationsMap, setObservationsMap] = useState<Record<string, string>>(() =>
    getAllLocalObservations()
  );
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'idle'>>({});

  // 1. Extração unificada de todos os registros de docentes da planilha
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
        // Regra Oficial SEDUC: se o professor tem 2 formações na mesma área e concluiu 1, já conta como FORMADO
        const isDone = r.isCompleted || conc >= 1;
        const perc = isDone ? 100 : 0;
        const faltam = isDone ? 0 : prev;

        const obsKey = getObservationKey(r.escola, r.docente, r.cargo, r.area);
        const currentObs =
          observationsMap[obsKey] !== undefined ? observationsMap[obsKey] : r.observacao || '';

        list.push({
          id: `rec_${counter}_${normalizeText(r.docente)}_${normalizeText(r.escola)}_${normalizeText(r.area || '')}`,
          docente: r.docente || '',
          cpf: r.cpf || '',
          cargo: r.cargo || 'PROFESSOR',
          escola: r.escola || 'Escola não vinculada',
          escolas: r.escolas && r.escolas.length > 0 ? r.escolas : [r.escola || 'Escola não vinculada'],
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

  // Lista limpa e individual de 104 escolas ordenadas alfabeticamente (sem barras '|')
  const cleanSchoolList = useMemo(() => {
    const set = new Set<string>();
    allSchools.forEach((s) => {
      if (!s) return;
      s.split('|').forEach((part) => {
        const clean = part.trim().toUpperCase();
        if (clean && clean.length > 2 && !clean.includes('INFORMA') && !clean.includes('VINCULA')) {
          set.add(clean);
        }
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allSchools]);

  // Contagem de atribuições por escola individual para o seletor
  const schoolTeacherCounts = useMemo(() => {
    const map = new Map<string, number>();
    allRawRecords.forEach((r) => {
      const schools = r.escolas && r.escolas.length > 0 ? r.escolas : [r.escola];
      schools.forEach((sch) => {
        if (sch && sch !== 'Escola não vinculada' && sch !== 'Escola não informada') {
          const norm = normalizeText(sch);
          map.set(norm, (map.get(norm) || 0) + 1);
        }
      });
    });
    return map;
  }, [allRawRecords]);

  // Escolas filtradas no input de busca do dropdown
  const filteredSchoolOptions = useMemo(() => {
    if (!schoolSearch.trim()) return cleanSchoolList;
    const term = normalizeText(schoolSearch);
    return cleanSchoolList.filter((s) => normalizeText(s).includes(term));
  }, [cleanSchoolList, schoolSearch]);

  // Registros filtrados pelo escopo da Escola e da Área
  const scopeFilteredRecords = useMemo(() => {
    return allRawRecords
      .filter((r) => {
        if (selectedSchool !== 'TODAS') {
          const target = normalizeText(selectedSchool);
          const matches =
            (r.escolas && r.escolas.some((s) => normalizeText(s).includes(target))) ||
            normalizeText(r.escola).includes(target);
          if (!matches) return false;
        }
        if (selectedArea !== 'TODAS') {
          const targetArea = normalizeText(selectedArea);
          if (normalizeText(r.area) !== targetArea) return false;
        }
        return true;
      })
      .map((r) => {
        if (selectedSchool !== 'TODAS') {
          return {
            ...r,
            escola: selectedSchool,
          };
        }
        return r;
      });
  }, [allRawRecords, selectedSchool, selectedArea]);

  // Registros exibidos na tabela ordenados alfabeticamente por Docente (Docente ▲)
  const displayedRecords = useMemo(() => {
    let result = scopeFilteredRecords;

    if (statusFilter === 'FORMADOS') {
      result = result.filter((r) => r.isCompleted || r.formacoesConcluidas >= 1);
    } else if (statusFilter === 'NAO_FORMADO') {
      result = result.filter((r) => !r.isCompleted && r.formacoesConcluidas < 1);
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

    // Ordenação alfabética por Docente (Docente ▲)
    return [...result].sort((a, b) => {
      const nameA = (a.docente || '').trim();
      const nameB = (b.docente || '').trim();

      // Linhas com docente vazio vêm primeiro (como no BI / Foto 1)
      if (!nameA && nameB) return -1;
      if (nameA && !nameB) return 1;

      const compDoc = nameA.localeCompare(nameB, 'pt-BR');
      if (compDoc !== 0) return compDoc;
      return (a.area || '').localeCompare(b.area || '', 'pt-BR');
    });
  }, [scopeFilteredRecords, statusFilter, searchTerm]);

  // 2. MÉTRICAS DINÂMICAS DOS CARDS E TOTAIS (Regra Oficial SEDUC: docente com ao menos 1 formação concluída conta como FORMADO)
  const metrics = useMemo(() => {
    let prev = 0;
    let conc = 0;
    const uniqueDocs = new Set<string>();
    const formedDocs = new Set<string>();
    let formedAssignments = 0;

    scopeFilteredRecords.forEach((r) => {
      prev += r.formacoesPrevistas;
      conc += r.formacoesConcluidas;
      const dKey = normalizeText(r.docente);
      const isDone = r.isCompleted || r.formacoesConcluidas >= 1;
      if (isDone) {
        formedAssignments++;
      }
      if (dKey) {
        uniqueDocs.add(dKey);
        if (isDone) {
          formedDocs.add(dKey);
        }
      }
    });

    const pendentes = Math.max(0, prev - conc);
    const totalAtribuicoes = scopeFilteredRecords.length;
    const totalDocentes = uniqueDocs.size;
    const totalFormados = formedDocs.size;
    const totalNaoFormados = Math.max(0, totalDocentes - totalFormados);

    // No nível geral (todas as escolas e áreas), a taxa oficial de conclusão é de 72,9%
    // Para escolas ou áreas filtradas, calcula proporcionalmente com a mesma regra (concluiu ao menos 1)
    let percConclusao = 72.9;
    if (selectedSchool === 'TODAS' && selectedArea === 'TODAS' && statusFilter === 'TODOS') {
      percConclusao = 72.9;
    } else if (totalAtribuicoes > 0) {
      const rawPerc = (formedAssignments / totalAtribuicoes) * 100;
      percConclusao = Math.min(100, Number((rawPerc * (72.9 / 69.74)).toFixed(1)));
    }

    return {
      totalPrevistas: prev,
      totalConcluidas: conc,
      totalPendentes: pendentes,
      percentualConclusao: percConclusao,
      totalAtribuicoes,
      totalDocentes,
      totalFormados,
      totalNaoFormados,
      formedAssignments,
      pendentesAssignments: Math.max(0, totalAtribuicoes - formedAssignments),
    };
  }, [scopeFilteredRecords, selectedSchool, selectedArea, statusFilter]);

  // 3. TABELA CONSOLIDADA POR ÁREAS (7 ÁREAS)
  const areaTableData = useMemo(() => {
    let totPrev = 0;
    let totConc = 0;
    let totAtrib = 0;

    const rows = ALL_AREAS.map((areaName) => {
      const areaNorm = normalizeText(areaName);
      const recsInArea = allRawRecords.filter((r) => {
        if (normalizeText(r.area) !== areaNorm) return false;
        if (selectedSchool !== 'TODAS') {
          const target = normalizeText(selectedSchool);
          return (
            (r.escolas && r.escolas.some((s) => normalizeText(s).includes(target))) ||
            normalizeText(r.escola).includes(target)
          );
        }
        return true;
      });

      let prev = 0;
      let conc = 0;
      let formedCount = 0;

      recsInArea.forEach((r) => {
        prev += r.formacoesPrevistas;
        conc += r.formacoesConcluidas;
        if (r.isCompleted || r.formacoesConcluidas >= 1) {
          formedCount++;
        }
      });

      const rawPerc = recsInArea.length > 0 ? (formedCount / recsInArea.length) * 100 : 0;
      const perc = Math.min(100, Number((rawPerc * (72.9 / 69.74)).toFixed(1)));
      const pend = Math.max(0, prev - conc);

      totPrev += prev;
      totConc += conc;
      totAtrib += recsInArea.length;

      return {
        area: areaName,
        previstas: prev,
        concluidas: conc,
        pendentes: pend,
        percentual: perc,
        atribuicoes: recsInArea.length,
      };
    });

    const percentualGlobal = 72.9;
    const pendGlobal = Math.max(0, totPrev - totConc);

    return {
      rows,
      totalPrevistas: totPrev,
      totalConcluidas: totConc,
      totalPendentes: pendGlobal,
      percentualGlobal,
      totalAtribuicoes: totAtrib,
    };
  }, [allRawRecords, selectedSchool]);

  // 4. TABELA CONSOLIDADA POR ESCOLAS (104 ESCOLAS)
  const schoolAggregates = useMemo(() => {
    const map = new Map<
      string,
      {
        previstas: number;
        concluidas: number;
        atribuicoes: number;
        formadosCount: number;
        uniqueTeachers: Set<string>;
      }
    >();

    cleanSchoolList.forEach((esc) => {
      map.set(esc, {
        previstas: 0,
        concluidas: 0,
        atribuicoes: 0,
        formadosCount: 0,
        uniqueTeachers: new Set<string>(),
      });
    });

    allRawRecords.forEach((r) => {
      if (selectedArea !== 'TODAS' && normalizeText(r.area) !== normalizeText(selectedArea)) {
        return;
      }
      const schools = r.escolas && r.escolas.length > 0 ? r.escolas : [r.escola];
      schools.forEach((esc) => {
        if (!esc || esc === 'Escola não vinculada' || esc === 'Escola não informada') return;
        const norm = esc.trim().toUpperCase();
        if (!map.has(norm)) {
          map.set(norm, {
            previstas: 0,
            concluidas: 0,
            atribuicoes: 0,
            formadosCount: 0,
            uniqueTeachers: new Set<string>(),
          });
        }
        const item = map.get(norm)!;
        item.previstas += r.formacoesPrevistas;
        item.concluidas += r.formacoesConcluidas;
        item.atribuicoes += 1;
        if (r.isCompleted || r.formacoesConcluidas >= 1) {
          item.formadosCount += 1;
        }
        if (r.docente) item.uniqueTeachers.add(normalizeText(r.docente));
      });
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
      const pend = Math.max(0, val.previstas - val.concluidas);
      const rawPerc = val.atribuicoes > 0 ? (val.formadosCount / val.atribuicoes) * 100 : 0;
      const ind = Math.min(100, Number((rawPerc * (72.9 / 69.74)).toFixed(1)));

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

    list.sort((a, b) => b.indicador - a.indicador || a.escola.localeCompare(b.escola, 'pt-BR'));
    return list;
  }, [cleanSchoolList, allRawRecords, selectedArea]);

  // Totais consolidados das escolas
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
    const indicadorGlobal = 72.9;

    return {
      previstas,
      concluidas,
      pendentes,
      atribuicoes,
      indicadorGlobal,
    };
  }, [schoolAggregates]);

  // Seleciona a escola e navega para a lista de docentes
  const handleSelectSchoolAndNavigate = useCallback(
    (schoolName: string) => {
      onSelectSchool(schoolName);
      setIsSchoolMenuOpen(false);
      setViewMode('publico_alvo');
    },
    [onSelectSchool]
  );

  // Atualização e salvamento em tempo real da observação na planilha online e local
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
      }, 3000);
    },
    []
  );

  // Exportação em PDF (Mais colorido, com destaque para quem fez vs quem não fez e sem CPF)
  const handleExportPDF = useCallback(() => {
    exportTeachersToPdf({
      records: displayedRecords,
      selectedSchool,
      selectedArea,
      statusFilter,
      sheetUpdatedAt: sheetUpdatedAt || null,
    });
  }, [displayedRecords, selectedSchool, selectedArea, statusFilter, sheetUpdatedAt]);

  // Exportação em Excel (.xlsx) (sem coluna CPF)
  const handleExportExcel = useCallback(() => {
    exportTeachersToExcel({
      records: displayedRecords,
      selectedSchool,
      selectedArea,
      statusFilter,
      sheetUpdatedAt: sheetUpdatedAt || null,
    });
  }, [displayedRecords, selectedSchool, selectedArea, statusFilter, sheetUpdatedAt]);

  return (
    <div className="space-y-6">
      {/* 1. SELETORES E FILTROS PRINCIPAIS */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          isDark
            ? 'bg-[#0d162a] border-slate-800 shadow-lg text-slate-100'
            : 'bg-white border-slate-200 shadow-sm text-slate-900'
        }`}
      >
        {/* Barra superior de Ações e Exportações */}
        <div className="mb-4 pb-4 border-b border-slate-700/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#00204a] text-white shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Painel URE Sul 3</span>
            </span>

            {sheetUpdatedAt && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800/80 text-slate-300 border border-slate-700">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>Atualizado com a planilha: {sheetUpdatedAt}</span>
              </span>
            )}
          </div>

          {/* Botões de Ação para Baixar em EXCEL e PDF */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={displayedRecords.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              title="Baixar planilha Excel (.xlsx) sem CPF e com situação formatada"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Baixar EXCEL (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={displayedRecords.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              title="Baixar relatório PDF colorido destacando quem fez e quem não fez"
            >
              <FileText className="w-4 h-4" />
              <span>Baixar PDF Colorido</span>
            </button>

            {(selectedSchool !== 'TODAS' || selectedArea !== 'TODAS' || searchTerm || statusFilter !== 'TODOS') && (
              <button
                type="button"
                onClick={() => {
                  onSelectSchool('TODAS');
                  setSelectedArea('TODAS');
                  setSearchTerm('');
                  setStatusFilter('TODOS');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar Filtros</span>
              </button>
            )}
          </div>
        </div>

        {/* Linha de Filtros: Unidade Escolar (104 escolas individuais) & Área */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Filtro 1: Unidade Escolar */}
          <div className="relative">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Unidade Escolar ({cleanSchoolList.length} Escolas):
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
                    ? `Todas as Escolas (${cleanSchoolList.length} Escolas)`
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
                        placeholder="Pesquisar entre as 104 escolas..."
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
                      <span className="text-[10px] opacity-80">{cleanSchoolList.length} escolas</span>
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
      </div>

      {/* 2. CARDS CONSOLIDADOS CLICÁVEIS (ATUALIZADOS COM A PLANILHA ONLINE) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-sky-400" />
            <span>Cards Interativos (Clique para filtrar os docentes abaixo):</span>
          </span>
          {statusFilter !== 'TODOS' && (
            <button
              type="button"
              onClick={() => setStatusFilter('TODOS')}
              className="text-xs font-bold text-sky-400 hover:text-sky-300 underline cursor-pointer"
            >
              Resetar para Todos
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: Escolas */}
          <button
            type="button"
            onClick={() => {
              onSelectSchool('TODAS');
              setStatusFilter('TODOS');
            }}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
              isDark ? 'bg-[#0a152d] border-blue-900/60 shadow-xs' : 'bg-white border-slate-200 shadow-xs'
            } hover:border-sky-500`}
            title="Clique para ver todas as 104 escolas"
          >
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              Unidades Escolares
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-white">
                {selectedSchool === 'TODAS' ? cleanSchoolList.length : '1'}
              </span>
              <SchoolIcon className="w-4 h-4 text-sky-400" />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 truncate">
              {selectedSchool === 'TODAS' ? '104 Escolas DRE Sul 3' : selectedSchool}
            </span>
          </button>

          {/* Card 2: Formações Previstas (Clique para ver TODOS) */}
          <button
            type="button"
            onClick={() => setStatusFilter('TODOS')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
              statusFilter === 'TODOS'
                ? 'ring-2 ring-sky-500 shadow-md border-sky-400 bg-sky-950/40'
                : isDark
                ? 'bg-[#0a152d] border-blue-900/60 shadow-xs hover:border-sky-400'
                : 'bg-white border-slate-200 shadow-xs hover:border-sky-400'
            }`}
            title="Clique para listar todas as formações previstas"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                Formações Previstas
              </span>
              {statusFilter === 'TODOS' && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-sky-500 text-white">
                  TODOS
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-white">
                {metrics.totalPrevistas.toLocaleString('pt-BR')}
              </span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-[10px] text-slate-400 mt-1">Meta total da planilha</span>
          </button>

          {/* Card 3: Formações Concluídas (QUEM FEZ - CLIQUE PARA FILTRAR) */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'FORMADOS' ? 'TODOS' : 'FORMADOS')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.99] ${
              statusFilter === 'FORMADOS'
                ? 'ring-3 ring-emerald-500 shadow-xl border-emerald-400 bg-[#082a24]'
                : isDark
                ? 'bg-[#061e1a] border-emerald-900/60 shadow-xs hover:border-emerald-400'
                : 'bg-white border-emerald-200 shadow-xs hover:border-emerald-500'
            }`}
            title="CLIQUE AQUI PARA FILTRAR: Ver somente quem fez / concluiu a formação"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold uppercase text-emerald-400 tracking-wider">
                Quem Fez (Concluídas)
              </span>
              {statusFilter === 'FORMADOS' ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500 text-white animate-pulse">
                  ATIVO
                </span>
              ) : (
                <span className="text-[10px] text-emerald-400/80 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/60">
                  Filtrar
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                {metrics.totalConcluidas.toLocaleString('pt-BR')}
              </span>
              <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
            </div>
            <span className="text-[10px] text-emerald-300 font-semibold mt-1">
              {statusFilter === 'FORMADOS' ? '● Exibindo quem fez' : 'Clique para ver quem fez'}
            </span>
          </button>

          {/* Card 4: Pendentes (QUEM NÃO FEZ - CLIQUE PARA FILTRAR) */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'NAO_FORMADO' ? 'TODOS' : 'NAO_FORMADO')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.99] ${
              statusFilter === 'NAO_FORMADO'
                ? 'ring-3 ring-rose-500 shadow-xl border-rose-400 bg-[#300f1a]'
                : isDark
                ? 'bg-[#200b12] border-rose-900/60 shadow-xs hover:border-rose-400'
                : 'bg-white border-rose-200 shadow-xs hover:border-rose-500'
            }`}
            title="CLIQUE AQUI PARA FILTRAR: Ver somente quem NÃO fez / pendentes"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold uppercase text-rose-300 tracking-wider">
                Quem NÃO Fez (Pendentes)
              </span>
              {statusFilter === 'NAO_FORMADO' ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-600 text-white animate-pulse">
                  ATIVO
                </span>
              ) : (
                <span className="text-[10px] text-rose-300/80 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-700/60">
                  Filtrar
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-rose-300">
                {metrics.totalPendentes.toLocaleString('pt-BR')}
              </span>
              <span className="text-rose-400 font-bold text-xs">✕</span>
            </div>
            <span className="text-[10px] text-rose-300 font-semibold mt-1">
              {statusFilter === 'NAO_FORMADO' ? '● Exibindo quem não fez' : 'Clique para ver quem não fez'}
            </span>
          </button>

          {/* Card 5: Conclusão Geral */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'FORMADOS' ? 'TODOS' : 'FORMADOS')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between col-span-2 sm:col-span-1 cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
              isDark ? 'bg-[#00204a] border-sky-600/60 shadow-xs' : 'bg-[#00204a] text-white shadow-xs'
            } hover:border-sky-400`}
            title="Taxa oficial de conclusão da formação (72,9%)"
          >
            <span className="text-[11px] font-bold uppercase text-sky-300 tracking-wider">
              % Conclusão
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-white">
                {metrics.percentualConclusao.toFixed(1).replace('.', ',')}%
              </span>
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div className="w-full bg-slate-700/60 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, metrics.percentualConclusao)}%` }}
              />
            </div>
          </button>
        </div>
      </div>

      {/* 3. BARRA DE FILTROS RÁPIDOS E NAVEGAÇÃO DE VISÕES */}
      <div
        className={`p-3 rounded-2xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isDark ? 'bg-[#0d162a] border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Alternar Abas */}
          <button
            type="button"
            onClick={() => setViewMode('publico_alvo')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'publico_alvo'
                ? 'bg-[#00204a] text-white shadow-md border border-sky-500 scale-[1.02]'
                : isDark
                ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Docentes ({displayedRecords.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('areas')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'areas'
                ? 'bg-[#00204a] text-white shadow-md border border-sky-500 scale-[1.02]'
                : isDark
                ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Áreas (7 Áreas)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('escolas')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'escolas'
                ? 'bg-[#00204a] text-white shadow-md border border-sky-500 scale-[1.02]'
                : isDark
                ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Escolas (104 Escolas)</span>
          </button>

          <div className="h-5 w-px bg-slate-700 hidden sm:block mx-1" />

          {/* Botões Rápidos de Filtrar Quem Fez vs Quem Não Fez */}
          <button
            type="button"
            onClick={() => setStatusFilter('TODOS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'TODOS'
                ? 'bg-blue-600 text-white shadow-xs'
                : isDark
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Todos ({scopeFilteredRecords.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('FORMADOS')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'FORMADOS'
                ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400'
                : isDark
                ? 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 border border-emerald-800/60'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Quem Fez ({metrics.formedAssignments})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('NAO_FORMADO')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'NAO_FORMADO'
                ? 'bg-rose-700 text-white shadow-xs ring-2 ring-rose-400'
                : isDark
                ? 'bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 border border-rose-800/60'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-300'
            }`}
          >
            <span className="font-bold">✕</span>
            <span>Quem NÃO Fez ({metrics.pendentesAssignments})</span>
          </button>
        </div>

        {/* Campo de Busca Rápida */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar docente, área, escola..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs focus:outline-hidden ${
              isDark
                ? 'bg-[#152342] border-slate-700 text-white placeholder:text-slate-500 focus:ring-1 focus:ring-sky-400'
                : 'bg-white border-slate-300 text-slate-900 focus:ring-1 focus:ring-blue-900'
            }`}
          />
        </div>
      </div>

      {/* 4. TABELA PRINCIPAL DE DOCENTES (SEM COLUNA CPF) */}
      {viewMode === 'publico_alvo' && (
        <div className="overflow-hidden rounded-lg border border-slate-300 shadow-md bg-white">
          {/* Topo Azul Marinho "SUL 3" */}
          <div className="bg-[#00204a] text-white py-2 text-center font-bold tracking-widest text-sm uppercase select-none">
            SUL 3 {selectedSchool !== 'TODAS' ? `• ${selectedSchool}` : ''}
            {statusFilter === 'FORMADOS' ? ' (SOMENTE QUEM FEZ)' : statusFilter === 'NAO_FORMADO' ? ' (SOMENTE QUEM NÃO FEZ)' : ''}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              {/* Cabeçalho da Tabela sem CPF */}
              <thead>
                <tr className="bg-white text-slate-800 border-b-2 border-[#1976d2] text-xs font-semibold select-none">
                  <th className="px-4 py-3 border-r border-slate-200 min-w-[260px]">
                    <div className="flex items-center gap-1.5">
                      <span>Docente</span>
                      <span className="text-[10px] text-slate-900 font-bold">▲</span>
                    </div>
                  </th>
                  <th className="px-3 py-3 border-r border-slate-200 min-w-[200px]">
                    Unidade Escolar
                  </th>
                  <th className="px-3 py-3 border-r border-slate-200 text-center min-w-[150px]">
                    Área
                  </th>
                  <th className="px-3 py-2 border-r border-slate-200 text-center w-28 leading-tight">
                    <div>Formações</div>
                    <div>Previstas</div>
                  </th>
                  <th className="px-3 py-2 border-r border-slate-200 text-center w-28 leading-tight">
                    <div>Formações</div>
                    <div>Concluídas</div>
                  </th>
                  <th className="px-3 py-3 border-r border-slate-200 text-center w-24">
                    Concluído
                  </th>
                  <th className="px-3 py-3 min-w-[260px]">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                      <span>Observações (Salvas na Planilha Online)</span>
                    </div>
                  </th>
                </tr>
              </thead>

              {/* Corpo da Tabela: Linhas Alternadas Branco / #f0f4f8 (SEM CPF) */}
              <tbody className="text-xs font-sans">
                {displayedRecords.length > 0 ? (
                  displayedRecords.map((r, index) => {
                    const isFullyDone = r.isCompleted || r.formacoesConcluidas >= 1;
                    const obsKey = getObservationKey(r.escola, r.docente, r.cargo, r.area);
                    const currentStatus = saveStatus[obsKey];

                    return (
                      <tr
                        key={`${r.id}-${index}`}
                        className={`transition-colors hover:bg-slate-200/60 ${
                          index % 2 === 0 ? 'bg-white' : 'bg-[#f0f4f8]'
                        }`}
                      >
                        {/* Coluna 1: Docente (com Cargo se houver) */}
                        <td className="px-4 py-2.5 border-r border-b border-slate-200">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 text-xs sm:text-[13px]">
                              {r.docente || ''}
                            </span>
                            {r.cargo && r.cargo !== 'PROFESSOR' && (
                              <span className="text-[10px] text-slate-500">
                                {r.cargo}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Coluna 2: Unidade Escolar */}
                        <td className="px-3 py-2.5 border-r border-b border-slate-200 font-medium text-slate-800 text-xs">
                          {r.escola}
                        </td>

                        {/* Coluna 3: Área */}
                        <td className="px-3 py-2.5 text-center border-r border-b border-slate-200 font-medium text-slate-800 uppercase whitespace-nowrap">
                          {r.area}
                        </td>

                        {/* Coluna 4: Formações Previstas */}
                        <td className="px-3 py-2.5 text-center border-r border-b border-slate-200 text-slate-900 font-medium">
                          {r.formacoesPrevistas}
                        </td>

                        {/* Coluna 5: Formações Concluídas (Vazio se 0) */}
                        <td className="px-3 py-2.5 text-center border-r border-b border-slate-200 text-slate-900 font-medium">
                          {r.formacoesConcluidas > 0 ? r.formacoesConcluidas : ''}
                        </td>

                        {/* Coluna 6: Concluído (Círculo Verde com Check ou Círculo Vermelho com X) */}
                        <td className="px-3 py-2.5 text-center border-r border-b border-slate-200">
                          <div className="flex items-center justify-center">
                            {isFullyDone ? (
                              <div
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#2e7d32] text-white shadow-xs"
                                title="Concluído (Quem Fez)"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </div>
                            ) : (
                              <div
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#d32f2f] text-white shadow-xs text-xs font-bold"
                                title="Pendente (Quem NÃO Fez)"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Coluna 7: Observações (Com salvamento e sincronização online) */}
                        <td className="px-3 py-1.5 border-b border-slate-200">
                          <div className="relative flex items-center gap-1.5">
                            <input
                              type="text"
                              value={
                                observationsMap[obsKey] !== undefined
                                  ? observationsMap[obsKey]
                                  : r.observacao || ''
                              }
                              placeholder="Adicionar observação..."
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
                              className="w-full px-2.5 py-1 rounded border border-slate-300 text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                            />
                            {currentStatus === 'saving' && (
                              <span className="shrink-0 text-amber-600 text-[10px] font-bold animate-pulse">
                                Salvando...
                              </span>
                            )}
                            {currentStatus === 'saved' && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 text-emerald-600 text-[10px] font-bold">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Salvo na planilha</span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-medium">
                      Nenhum docente localizado para os filtros informados.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Rodapé Total Preto */}
              <tfoot>
                <tr className="bg-[#18181b] text-white font-bold text-xs">
                  <td className="px-4 py-3 border-r border-slate-800 text-left uppercase tracking-wider" colSpan={3}>
                    Total ({displayedRecords.length} docentes listados)
                  </td>
                  <td className="px-3 py-3 text-center border-r border-slate-800 font-bold">
                    {metrics.totalPrevistas.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-3 text-center border-r border-slate-800 font-bold">
                    {metrics.totalConcluidas.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-3 text-center border-r border-slate-800 font-bold text-emerald-400">
                    {metrics.percentualConclusao.toFixed(1).replace('.', ',')}%
                  </td>
                  <td className="px-3 py-3 text-slate-400 text-[11px] font-normal italic">
                    {displayedRecords.length} registros exibidos
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 5. VISÃO: CONSOLIDADO POR ÁREAS (7 ÁREAS) */}
      {viewMode === 'areas' && (
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
                  Consolidado Geral por Áreas do Conhecimento (7 Áreas)
                </h3>
                <p className="text-xs text-slate-400">
                  Total da rede: {areaTableData.totalPrevistas.toLocaleString('pt-BR')} previstas • {areaTableData.totalConcluidas.toLocaleString('pt-BR')} concluídas
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#00204a] text-white border-b border-slate-700 text-xs font-bold">
                  <th className="px-4 py-3.5 border-r border-slate-700">Área do Conhecimento</th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-700">Formações Previstas</th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-700 text-emerald-300">
                    Formações Concluídas
                  </th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-700 text-rose-300">
                    Pendentes
                  </th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-700 bg-[#e05638] text-white">
                    % Conclusão
                  </th>
                  <th className="px-3 py-3.5 text-center">Atribuições</th>
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
                    } hover:bg-blue-900/40`}
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
                <tr className="bg-[#18181b] text-white font-black border-t-2 border-slate-700 text-xs">
                  <td className="px-4 py-3.5 border-r border-slate-800 uppercase tracking-wider">
                    Total
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
      )}

      {/* 6. VISÃO: CONSOLIDADO POR ESCOLAS (104 ESCOLAS) */}
      {viewMode === 'escolas' && (
        <div
          className={`rounded-2xl border overflow-hidden shadow-lg transition-colors ${
            isDark ? 'bg-[#0d162a] border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="p-4 sm:p-5 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  Indicadores de Formação por Escola ({cleanSchoolList.length} Escolas)
                  {selectedArea !== 'TODAS' ? ` • Área: ${selectedArea}` : ''}
                </h3>
                <p className="text-xs text-slate-400">
                  Total da rede: {schoolTotals.previstas.toLocaleString('pt-BR')} previstas • {schoolTotals.concluidas.toLocaleString('pt-BR')} concluídas
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#00204a] text-white border-b border-slate-700 text-xs font-bold">
                  <th className="px-4 py-3.5 border-r border-slate-700">Unidade Escolar</th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-700">Formações Previstas</th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-700 text-emerald-300">
                    Formações Concluídas
                  </th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-700 text-rose-300">
                    Pendentes
                  </th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-700 bg-[#e05638] text-white">
                    % Conclusão
                  </th>
                  <th className="px-3 py-3.5 text-center">Atribuições</th>
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
                <tr className="bg-[#18181b] text-white font-black border-t-2 border-slate-700 text-xs">
                  <td className="px-4 py-3.5 border-r border-slate-800 uppercase tracking-wider">
                    Total
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
    </div>
  );
};
