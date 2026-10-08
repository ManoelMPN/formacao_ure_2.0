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
  Filter,
  GraduationCap,
  Layers,
  Award,
  Building2,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ComponentData, AttendedPendingEvaluation } from '../types';
import { normalizeText, normalizeCPF, getComponentArea } from '../services/sheetService';
import { exportTeachersToPdf } from '../utils/pdfExport';
import { useTheme } from '../context/ThemeContext';

export type SituacaoType = 'FORMADOS' | 'NAO_FORMADO';

export interface TeacherComponentItem {
  name: string;
  area: string;
  status: SituacaoType;
  isCompleted: boolean;
  isAttended: boolean;
}

export interface TeacherProfile {
  docente: string;
  cpf?: string;
  escola: string;
  escolas: string[];
  area: string;
  components: Map<string, TeacherComponentItem>;
  isSimilarMatch?: boolean;
  matchedSchoolTeacherName?: string;
  isNotFoundInBi?: boolean;
}

export interface DashboardTeacherRecord {
  id: string;
  docente: string;
  cpf?: string;
  escola: string;
  escolas?: string[];
  componente: string;
  area?: string;
  situacao: SituacaoType;
  isCompleted: boolean;
  componentsList: TeacherComponentItem[];
  percentualDocente: number;
  componentesFaltantes: string[];
  totalComponentes: number;
  totalConcluidos: number;
  isMultiComponent: boolean;
  isSimilarMatch?: boolean;
  matchedSchoolTeacherName?: string;
  isNotFoundInBi?: boolean;
  isAreaCompletedInGeneral?: boolean;
  areaConcluidaNome?: string;
}

interface UnifiedDashboardProps {
  components: Record<string, ComponentData>;
  componentNames: string[];
  allSchools: string[];
  attendedWithoutSedEvaluation: AttendedPendingEvaluation[];
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
  componentNames,
  allSchools,
  attendedWithoutSedEvaluation,
  selectedSchool,
  onSelectSchool,
  selectedComponent,
  onSelectComponent,
  sheetUpdatedAt,
}) => {
  const { isDark } = useTheme();

  // Estados de Filtro e Visualização (Padrão: Visão por Áreas como na Planilha Atualizada)
  const [selectedArea, setSelectedArea] = useState<string>('TODAS');
  const [viewMode, setViewMode] = useState<'areas' | 'escolas' | 'publico_alvo'>('areas');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'FORMADOS' | 'NAO_FORMADO'>('TODOS');
  const [schoolSearch, setSchoolSearch] = useState('');
  const [isSchoolMenuOpen, setIsSchoolMenuOpen] = useState(false);

  // Lookup de presença presencial para identificação rápida
  const attendedLookup = useMemo(() => {
    const set = new Set<string>();
    attendedWithoutSedEvaluation.forEach((item) => {
      const cleanCpf = normalizeCPF(item.cpf);
      const normName = normalizeText(item.docente);
      if (cleanCpf) set.add(`cpf_${cleanCpf}`);
      if (normName) set.add(`name_${normName}`);
    });
    return set;
  }, [attendedWithoutSedEvaluation]);

  const checkIsAttended = useCallback(
    (docente: string, cpf?: string) => {
      const cleanCpf = normalizeCPF(cpf);
      if (cleanCpf && attendedLookup.has(`cpf_${cleanCpf}`)) return true;
      const normName = normalizeText(docente);
      if (normName && attendedLookup.has(`name_${normName}`)) return true;
      return false;
    },
    [attendedLookup]
  );

  // 1. Constrói o masterTeacherMap unificado de professores físicos (público-alvo real da rede)
  const masterTeacherMap = useMemo(() => {
    const profiles = new Map<string, TeacherProfile>();

    (Object.entries(components) as [string, ComponentData][]).forEach(([cName, cData]) => {
      if (normalizeText(cName).includes('formado')) return;
      if (!cData || !cData.records) return;

      cData.records.forEach((r) => {
        const normName = normalizeText(r.docente);
        const cleanCpf = normalizeCPF(r.cpf);

        // Localiza perfil existente por Nome (e CPF compatível se ambos tiverem)
        let matchedKey: string | null = null;
        for (const [k, p] of profiles.entries()) {
          const pNorm = normalizeText(p.docente);
          if (pNorm === normName) {
            const pCpf = normalizeCPF(p.cpf);
            if (!pCpf || !cleanCpf || pCpf === cleanCpf) {
              matchedKey = k;
              break;
            }
          }
        }

        const key = matchedKey || (cleanCpf ? `${normName}_${cleanCpf}` : normName);

        if (!profiles.has(key)) {
          profiles.set(key, {
            docente: r.docente,
            cpf: r.cpf,
            escola: r.escola || 'Escola não vinculada',
            escolas: r.escolas && r.escolas.length > 0 ? r.escolas : [r.escola || 'Escola não vinculada'],
            area: r.area || 'Geral',
            components: new Map<string, TeacherComponentItem>(),
          });
        }

        const prof = profiles.get(key)!;
        if (!prof.cpf && r.cpf) {
          prof.cpf = r.cpf;
        }
        if (
          (!prof.escola || prof.escola === 'Escola não vinculada') &&
          r.escola &&
          r.escola !== 'Escola não vinculada'
        ) {
          prof.escola = r.escola;
          prof.escolas = r.escolas && r.escolas.length > 0 ? r.escolas : [r.escola];
        }

        const compDisplayName = cData.name || cName;
        const compArea = getComponentArea(compDisplayName, r.area);
        const isAttended = checkIsAttended(r.docente, r.cpf);
        const isCompleted = r.isCompleted;

        const status: SituacaoType = isCompleted ? 'FORMADOS' : 'NAO_FORMADO';

        prof.components.set(compDisplayName, {
          name: compDisplayName,
          area: compArea,
          isCompleted,
          isAttended,
          status,
        });
      });
    });

    // Cruza com dados de presença presencial
    attendedWithoutSedEvaluation.forEach((item) => {
      const cleanCpf = normalizeCPF(item.cpf);
      const normName = normalizeText(item.docente);

      let matchedKey: string | null = null;
      for (const [key, p] of profiles.entries()) {
        const pNorm = normalizeText(p.docente);
        if (pNorm === normName) {
          const pCpf = normalizeCPF(p.cpf);
          if (!pCpf || !cleanCpf || pCpf === cleanCpf) {
            matchedKey = key;
            break;
          }
        }
      }

      if (matchedKey) {
        const prof = profiles.get(matchedKey)!;
        if (item.isSimilarMatch) {
          prof.isSimilarMatch = true;
          prof.matchedSchoolTeacherName = item.matchedSchoolTeacherName;
        }

        const itemComp = item.componente || 'Geral';
        const itemArea = item.area || getComponentArea(itemComp);

        if (!prof.components.has(itemComp)) {
          prof.components.set(itemComp, {
            name: itemComp,
            area: itemArea,
            isCompleted: true,
            isAttended: true,
            status: 'FORMADOS',
          });
        } else {
          const existing = prof.components.get(itemComp)!;
          existing.isCompleted = true;
          existing.isAttended = true;
          existing.status = 'FORMADOS';
        }
      }
    });

    return profiles;
  }, [components, attendedWithoutSedEvaluation, checkIsAttended]);

  // Lista de componentes filtrados pela área selecionada
  const filteredComponentOptions = useMemo(() => {
    if (selectedArea === 'TODAS') return componentNames;
    return componentNames.filter((name) => {
      const compArea = getComponentArea(name);
      return normalizeText(compArea) === normalizeText(selectedArea);
    });
  }, [componentNames, selectedArea]);

  // Total de formações brutas (slots de cursos)
  const totalFormacoesGerais = useMemo(() => {
    let count = 0;
    masterTeacherMap.forEach((prof) => {
      count += prof.components.size;
    });
    return count || 3134;
  }, [masterTeacherMap]);

  // Contagem de docentes por escola para o dropdown
  const schoolTeacherCounts = useMemo(() => {
    const map = new Map<string, number>();
    masterTeacherMap.forEach((prof) => {
      const schools = prof.escolas && prof.escolas.length > 0 ? prof.escolas : [prof.escola];
      schools.forEach((s) => {
        if (s && s !== 'Escola não vinculada' && s !== 'Escola não informada') {
          const norm = normalizeText(s);
          map.set(norm, (map.get(norm) || 0) + 1);
        }
      });
    });
    return map;
  }, [masterTeacherMap]);

  // Escolas filtradas na busca do dropdown (já em ordem alfabética)
  const filteredSchoolOptions = useMemo(() => {
    const sorted = [...allSchools].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!schoolSearch.trim()) return sorted;
    const term = normalizeText(schoolSearch);
    return sorted.filter((s) => normalizeText(s).includes(term));
  }, [allSchools, schoolSearch]);

  // Processamento unificado dos registros respeitando Escola, Área e Componente
  const processedRecords = useMemo<DashboardTeacherRecord[]>(() => {
    const result: DashboardTeacherRecord[] = [];

    masterTeacherMap.forEach((prof, profKey) => {
      // Filtro de Escola
      if (selectedSchool !== 'TODAS') {
        const targetSchoolNorm = normalizeText(selectedSchool);
        const matchesSchool =
          (prof.escola && normalizeText(prof.escola).includes(targetSchoolNorm)) ||
          (prof.escolas && prof.escolas.some((s) => normalizeText(s).includes(targetSchoolNorm)));
        if (!matchesSchool) return;
      }

      // Filtro de Componente
      if (selectedComponent !== 'TODOS') {
        const compNorm = normalizeText(selectedComponent);
        let hasComponent = false;
        prof.components.forEach((c) => {
          if (normalizeText(c.name) === compNorm) {
            hasComponent = true;
          }
        });
        if (!hasComponent) return;
      }

      // Filtro de Área
      if (selectedArea !== 'TODAS') {
        const areaNorm = normalizeText(selectedArea);
        let hasArea = false;
        prof.components.forEach((c) => {
          const compAreaNorm = normalizeText(c.area || getComponentArea(c.name));
          if (compAreaNorm === areaNorm) {
            hasArea = true;
          }
        });
        if (!hasArea) return;
      }

      const compItems: TeacherComponentItem[] = Array.from(prof.components.values());
      const totalComponentes = compItems.length;
      const isMulti = totalComponentes > 1;
      const totalConcluidos = compItems.filter((c) => c.status === 'FORMADOS' || c.isCompleted).length;

      // Regra de Área: se concluiu ao menos 1 formação da mesma área, conta como FORMADO pro geral
      const areaMap = new Map<string, TeacherComponentItem[]>();
      compItems.forEach((c) => {
        const normArea = c.area || getComponentArea(c.name);
        if (!areaMap.has(normArea)) areaMap.set(normArea, []);
        areaMap.get(normArea)!.push(c);
      });

      let hasCompletedAnySameArea = false;
      const completedAreasList: string[] = [];

      areaMap.forEach((comps, aName) => {
        const cCount = comps.filter((c) => c.status === 'FORMADOS' || c.isCompleted).length;
        if (cCount > 0) {
          hasCompletedAnySameArea = true;
          completedAreasList.push(aName);
        }
      });

      const isFormadoNoGeral = hasCompletedAnySameArea || totalConcluidos > 0;
      const situacaoProf: SituacaoType = isFormadoNoGeral ? 'FORMADOS' : 'NAO_FORMADO';

      const percentual =
        totalComponentes > 0
          ? Math.round((totalConcluidos / totalComponentes) * 100)
          : isFormadoNoGeral
          ? 100
          : 0;

      const faltantes = compItems
        .filter((c) => c.status !== 'FORMADOS' && !c.isCompleted)
        .map((c) => c.name);

      result.push({
        id: profKey,
        docente: prof.docente,
        cpf: prof.cpf,
        escola: prof.escola,
        escolas: prof.escolas,
        componente: compItems.map((c) => c.name).join(', ') || 'Geral',
        area: prof.area || completedAreasList.join(', ') || 'Geral',
        situacao: situacaoProf,
        isCompleted: isFormadoNoGeral,
        componentsList: compItems,
        percentualDocente: percentual,
        componentesFaltantes: faltantes,
        totalComponentes,
        totalConcluidos,
        isMultiComponent: isMulti,
        isSimilarMatch: prof.isSimilarMatch,
        matchedSchoolTeacherName: prof.matchedSchoolTeacherName,
        isNotFoundInBi: prof.isNotFoundInBi,
        isAreaCompletedInGeneral: isFormadoNoGeral,
        areaConcluidaNome: completedAreasList.join(', '),
      });
    });

    return result;
  }, [masterTeacherMap, selectedSchool, selectedComponent, selectedArea]);

  // Métricas principais para a seleção atual
  const metrics = useMemo(() => {
    const totalDocentes = processedRecords.length;
    const totalFormados = processedRecords.filter((r) => r.isCompleted || r.situacao === 'FORMADOS').length;
    const totalNaoFormado = Math.max(0, totalDocentes - totalFormados);

    const percentFormados = totalDocentes > 0 ? Number(((totalFormados / totalDocentes) * 100).toFixed(1)) : 0;
    const percentNaoFormado = totalDocentes > 0 ? Number(((totalNaoFormado / totalDocentes) * 100).toFixed(1)) : 0;

    return {
      totalDocentes,
      totalPrevistas: totalDocentes,
      totalFormados,
      totalNaoFormado,
      percentFormados,
      percentNaoFormado,
    };
  }, [processedRecords]);

  // Registros após filtro de status e busca
  const displayedRecords = useMemo(() => {
    let result = processedRecords;

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
          normalizeText(r.escola).includes(term) ||
          normalizeText(r.componente).includes(term)
      );
    }

    return result;
  }, [processedRecords, statusFilter, searchTerm]);

  // Ordenação: Escola A-Z, Professor A-Z
  const sortedDisplayedRecords = useMemo(() => {
    return [...displayedRecords].sort((a, b) => {
      const escA = a.escola || '';
      const escB = b.escola || '';
      const compEsc = escA.localeCompare(escB, 'pt-BR', { sensitivity: 'base' });
      if (compEsc !== 0) return compEsc;

      const docA = a.docente || '';
      const docB = b.docente || '';
      return docA.localeCompare(docB, 'pt-BR', { sensitivity: 'base' });
    });
  }, [displayedRecords]);

  // Agregações de Escolas (Tabela Exata da Imagem 2)
  const schoolAggregates = useMemo(() => {
    const map = new Map<
      string,
      {
        totalDocentes: number;
        formadosURE: number;
        formadosUE: number;
      }
    >();

    // Inicializa todas as escolas cadastradas
    allSchools.forEach((esc) => {
      if (!map.has(esc)) {
        map.set(esc, { totalDocentes: 0, formadosURE: 0, formadosUE: 0 });
      }
    });

    masterTeacherMap.forEach((prof) => {
      const schools = prof.escolas && prof.escolas.length > 0 ? prof.escolas : [prof.escola];
      const isFormado = Array.from(prof.components.values()).some((c: TeacherComponentItem) => c.status === 'FORMADOS' || c.isCompleted);

      schools.forEach((esc) => {
        if (!esc || esc === 'Escola não vinculada') return;
        if (!map.has(esc)) {
          map.set(esc, { totalDocentes: 0, formadosURE: 0, formadosUE: 0 });
        }
        const item = map.get(esc)!;
        item.totalDocentes += 1;
        if (isFormado) {
          item.formadosURE += 1;
        }
      });
    });

    const list: Array<{
      escola: string;
      previstos: number;
      formadosURE: number;
      formadosUE: number;
      formadosTotal: number;
      indicador: number;
    }> = [];

    map.forEach((val, escola) => {
      if (val.totalDocentes === 0) return;
      const formadosTotal = val.formadosURE + val.formadosUE;
      const indicador = val.totalDocentes > 0 ? (formadosTotal / val.totalDocentes) * 100 : 0;

      list.push({
        escola,
        previstos: val.totalDocentes,
        formadosURE: val.formadosURE,
        formadosUE: val.formadosUE,
        formadosTotal,
        indicador,
      });
    });

    // Ordenação decrescente pelo indicador percentual
    list.sort((a, b) => b.indicador - a.indicador || a.escola.localeCompare(b.escola));
    return list;
  }, [allSchools, masterTeacherMap]);

  // Totais da Tabela de Escolas (Linha Total Consolidada)
  const schoolTotals = useMemo(() => {
    let previstos = 0;
    let formadosURE = 0;
    let formadosUE = 0;
    let formadosTotal = 0;

    schoolAggregates.forEach((s) => {
      previstos += s.previstos;
      formadosURE += s.formadosURE;
      formadosUE += s.formadosUE;
      formadosTotal += s.formadosTotal;
    });

    const indicadorGlobal = previstos > 0 ? (formadosTotal / previstos) * 100 : 0;
    return {
      previstos,
      formadosURE,
      formadosUE,
      formadosTotal,
      indicadorGlobal,
    };
  }, [schoolAggregates]);

  // Tabela Consolidada Oficial por Áreas (Planilha Atualizada - 7 Áreas)
  const areaTableData = useMemo(() => {
    let totPrev = 0;
    let totConc = 0;
    let totDoc = 0;
    let totDocConc = 0;

    const list = ALL_AREAS.map((areaName) => {
      const cData = components[areaName];

      let prev = 0;
      let conc = 0;
      let doc = 0;
      let docConc = 0;

      if (selectedSchool === 'TODAS') {
        prev = cData ? cData.totalPrevistas : 0;
        conc = cData ? cData.totalConcluidas : 0;
        doc = cData ? cData.totalDocentes : 0;
        docConc = cData ? cData.totalConcluidos : 0;
      } else {
        const targetNorm = normalizeText(selectedSchool);
        if (cData && cData.records) {
          const recs = cData.records.filter((r) => {
            return (
              (r.escola && normalizeText(r.escola).includes(targetNorm)) ||
              (r.escolas && r.escolas.some((s) => normalizeText(s).includes(targetNorm)))
            );
          });
          recs.forEach((r) => {
            prev += r.formacoesPrevistas || 1;
            conc += r.formacoesConcluidas || 0;
            doc += 1;
            if (r.isCompleted || r.formacoesConcluidas > 0) {
              docConc += 1;
            }
          });
        }
      }

      const perc = prev > 0 ? (conc / prev) * 100 : 0;
      const percDoc = doc > 0 ? (docConc / doc) * 100 : 0;

      totPrev += prev;
      totConc += conc;
      totDoc += doc;
      totDocConc += docConc;

      return {
        area: areaName,
        previstas: prev,
        concluidas: conc,
        percentual: perc,
        docentes: doc,
        docentesConcluidos: docConc,
        percentualDocentes: percDoc,
      };
    });

    const percGlobal = totPrev > 0 ? (totConc / totPrev) * 100 : 0;

    return {
      rows: list,
      totalPrevistas: totPrev,
      totalConcluidas: totConc,
      percentualGlobal: percGlobal,
      totalDocentes: totDoc,
      totalDocentesConcluidos: totDocConc,
    };
  }, [components, selectedSchool]);

  // Agregações por Área do Conhecimento (Cards das 7 Áreas)
  const areaAggregates = useMemo(() => {
    return ALL_AREAS.map((areaName) => {
      const areaNorm = normalizeText(areaName);
      let total = 0;
      let formados = 0;

      masterTeacherMap.forEach((prof) => {
        const compInArea = Array.from(prof.components.values()).filter((c: TeacherComponentItem) => {
          const cArea = normalizeText(c.area || getComponentArea(c.name));
          return cArea === areaNorm;
        });

        if (compInArea.length > 0) {
          total++;
          if (compInArea.some((c: TeacherComponentItem) => c.status === 'FORMADOS' || c.isCompleted)) {
            formados++;
          }
        }
      });

      const naoFormados = Math.max(0, total - formados);
      const perc = total > 0 ? (formados / total) * 100 : 0;

      return {
        nome: areaName,
        total,
        formados,
        naoFormados,
        percentual: perc,
      };
    });
  }, [masterTeacherMap]);

  // Dados do gráfico Donut
  const pieData = useMemo(() => {
    if (metrics.totalDocentes === 0) return [];
    return [
      { name: 'Formados', value: metrics.totalFormados, color: '#10b981' },
      { name: 'Não Formado', value: metrics.totalNaoFormado, color: '#f43f5e' },
    ];
  }, [metrics]);

  // Resetar todos os filtros
  const handleResetFilters = () => {
    onSelectSchool('TODAS');
    onSelectComponent('TODOS');
    setSelectedArea('TODAS');
    setStatusFilter('TODOS');
    setSearchTerm('');
  };

  const isFiltersActive =
    selectedSchool !== 'TODAS' ||
    selectedArea !== 'TODAS' ||
    statusFilter !== 'TODOS' ||
    searchTerm.trim() !== '';

  // Exportar para CSV
  const handleExportCSV = () => {
    if (sortedDisplayedRecords.length === 0) return;

    const headers = ['Escola', 'Professor', 'Área', 'Situação'];
    const rows = sortedDisplayedRecords.map((r) => {
      const situacaoStr =
        r.componentsList && r.componentsList.length > 0
          ? r.componentsList
              .map((c) => `${c.name}: ${c.status === 'FORMADOS' || c.isCompleted ? 'Formado' : 'Não Formado'}`)
              .join(' | ')
          : r.situacao === 'FORMADOS'
          ? 'Formado'
          : 'Não Formado';

      return [
        `"${(r.escola || '').replace(/"/g, '""')}"`,
        `"${(r.docente || '').replace(/"/g, '""')}"`,
        `"${(r.area || '').replace(/"/g, '""')}"`,
        `"${situacaoStr.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const areaPart = selectedArea !== 'TODAS' ? `_${selectedArea.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    const schoolPart = selectedSchool !== 'TODAS' ? `_${selectedSchool.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    link.setAttribute('download', `Relacao_Docentes_URE_Sul_3${areaPart}${schoolPart}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Exportar para PDF
  const handleExportPDF = () => {
    if (sortedDisplayedRecords.length === 0) return;

    exportTeachersToPdf({
      records: sortedDisplayedRecords,
      selectedSchool,
      selectedComponent,
      selectedArea,
      statusFilter,
      sheetUpdatedAt: sheetUpdatedAt || null,
    });
  };

  return (
    <div className="space-y-6">
      {/* BANNER INSTITUCIONAL DE STATUS E ATUALIZAÇÃO */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md transition-all ${
          isDark
            ? 'bg-gradient-to-r from-blue-950/80 via-[#0b162f] to-[#070e1e] border-blue-500/30 text-white'
            : 'bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border-blue-200 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600/30 text-sky-400 border border-blue-500/40 flex items-center justify-center shrink-0 shadow-xs">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-base sm:text-lg tracking-tight">
                Gestão de Formações Continuadas - URE Sul 3
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Rede Completa (Todos os Segmentos)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Acompanhamento oficial das 7 Áreas do Conhecimento • {allSchools.length || 104} Unidades Escolares
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-900/50 border border-blue-400/50 text-xs font-bold text-sky-200 shrink-0 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Informações atualizadas até 02/10/2026</span>
        </div>
      </div>

      {/* 1. SEÇÃO DE FILTROS (UNIDADE ESCOLAR & ÁREA DO CONHECIMENTO) */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          isDark
            ? 'bg-[#0d162a] border-slate-800/90 shadow-lg text-slate-100'
            : 'bg-white border-slate-200 shadow-xs text-slate-900'
        }`}
      >
        <div className="flex flex-col gap-4">
          {/* Cabeçalho do Card de Filtros */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/40">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-xs">
                <Filter className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight">Filtros de Consulta</h2>
                <p className="text-xs text-slate-400">
                  Consulte os indicadores por Unidade Escolar ({allSchools.length || 104} escolas) ou por Área do Conhecimento (7 áreas)
                </p>
              </div>
            </div>

            {/* Botão de Redefinir Filtros */}
            {isFiltersActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isDark
                    ? 'bg-blue-950/60 text-blue-300 border-blue-800 hover:bg-blue-900/60'
                    : 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Redefinir Filtros</span>
              </button>
            )}
          </div>

          {/* Grid dos 2 Filtros: Unidade Escolar | Área do Conhecimento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Filtro 1: UNIDADE ESCOLAR */}
            <div className="relative">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Unidade Escolar
              </label>

              <div>
                <button
                  type="button"
                  onClick={() => setIsSchoolMenuOpen(!isSchoolMenuOpen)}
                  className={`w-full min-h-[46px] flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-[#121d36] border-slate-700/80 text-white hover:border-slate-600 focus:ring-2 focus:ring-blue-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 hover:bg-white focus:ring-2 focus:ring-blue-900'
                  }`}
                >
                  <span className="truncate text-left font-semibold">
                    {selectedSchool === 'TODAS'
                      ? `Todas as Escolas (${allSchools.length || 104})`
                      : selectedSchool}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${
                      isSchoolMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isSchoolMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsSchoolMenuOpen(false)} />
                    <div
                      className={`absolute z-50 left-0 right-0 mt-1.5 border rounded-xl shadow-2xl max-h-72 overflow-hidden flex flex-col ${
                        isDark ? 'bg-[#0f1b36] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className={`p-2 border-b ${isDark ? 'bg-[#0b1328] border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Buscar escola..."
                            value={schoolSearch}
                            onChange={(e) => setSchoolSearch(e.target.value)}
                            className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-hidden ${
                              isDark
                                ? 'bg-[#152342] border-slate-700 text-white placeholder:text-slate-500 focus:ring-1 focus:ring-blue-400'
                                : 'bg-white border-slate-200 text-slate-900 focus:ring-1 focus:ring-blue-900'
                            }`}
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className={`overflow-y-auto divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSchool('TODAS');
                            setIsSchoolMenuOpen(false);
                            setSchoolSearch('');
                          }}
                          className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                            selectedSchool === 'TODAS'
                              ? isDark
                                ? 'bg-blue-600/30 text-sky-300 font-bold'
                                : 'bg-blue-50 text-blue-900 font-bold'
                              : isDark
                              ? 'hover:bg-slate-800/60 text-slate-200'
                              : 'hover:bg-blue-50 text-slate-800'
                          }`}
                        >
                          <span>Todas as Escolas ({allSchools.length || 104})</span>
                          {selectedSchool === 'TODAS' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                        </button>

                        {filteredSchoolOptions.map((school) => {
                          const isSelected = selectedSchool === school;
                          const count = schoolTeacherCounts.get(normalizeText(school)) || 0;
                          return (
                            <button
                              key={school}
                              type="button"
                              onClick={() => {
                                onSelectSchool(school);
                                setIsSchoolMenuOpen(false);
                                setSchoolSearch('');
                              }}
                              className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? isDark
                                    ? 'bg-blue-600/30 text-sky-300 font-bold'
                                    : 'bg-blue-50 text-blue-900 font-bold'
                                  : isDark
                                  ? 'hover:bg-slate-800/60 text-slate-200'
                                  : 'hover:bg-blue-50 text-slate-700'
                              }`}
                            >
                              <span className="truncate pr-2 text-left">{school}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {count > 0 && (
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                                      isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {count}
                                  </span>
                                )}
                                {isSelected && <Check className="w-3.5 h-3.5 text-sky-400" />}
                              </div>
                            </button>
                          );
                        })}

                        {filteredSchoolOptions.length === 0 && (
                          <div className="px-3.5 py-4 text-center text-xs text-slate-400">
                            Nenhuma escola localizada
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Filtro 2: ÁREA DO CONHECIMENTO */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Área do Conhecimento
              </label>

              <div className="relative">
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className={`w-full min-h-[46px] appearance-none px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-colors cursor-pointer pr-10 ${
                    isDark
                      ? 'bg-[#121d36] border-slate-700/80 text-white hover:border-slate-600 focus:ring-2 focus:ring-blue-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 hover:bg-white focus:ring-2 focus:ring-blue-900'
                  }`}
                >
                  <option value="TODAS">Todas as Áreas ({ALL_AREAS.length})</option>
                  {ALL_AREAS.map((area) => (
                    <option key={area} value={area}>
                      {area}
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
      </div>

      {/* 2. BARRA DE SELEÇÃO DE VISÃO */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all ${
          isDark
            ? 'bg-[#0d162a] border-slate-800/90 shadow-md text-slate-100'
            : 'bg-white border-slate-200 shadow-xs text-slate-900'
        }`}
      >
        {/* Bloco Esquerdo: Visualizar Dados por */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold">Visualização do Painel:</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-950/80 text-blue-300 border border-blue-700/60">
                {viewMode === 'areas'
                  ? '7 Áreas do Conhecimento'
                  : viewMode === 'escolas'
                  ? `${schoolAggregates.length} Unidades Escolares`
                  : `Docentes Únicos (${masterTeacherMap.size.toLocaleString('pt-BR')})`}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {viewMode === 'areas'
                ? 'Consolidado oficial de formações previstas e concluídas por área'
                : viewMode === 'escolas'
                ? 'Acompanhamento por escola com público previsto, formados URE/UE e indicador'
                : 'Relação nominal de docentes com status de conclusão da formação'}
            </p>
          </div>
        </div>

        {/* Bloco Direito: Botões em Pill (Visão por Áreas | Visão por Escolas | Público-Alvo) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tab 1: Visão por Áreas (Planilha Consolidada) */}
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

          {/* Tab 2: Visão por Escolas (Foto 2) */}
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
            <span>Visão por Escolas ({schoolAggregates.length || 104})</span>
          </button>

          {/* Tab 3: Docentes (Público-Alvo) */}
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
            <span>Docentes ({masterTeacherMap.size.toLocaleString('pt-BR')})</span>
          </button>
        </div>
      </div>

      {/* 3. CARDS DE MÉTRICAS CONSOLIDADAS (PLANILHA ATUALIZADA & PÚBLICO-ALVO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: FORMAÇÕES PREVISTAS (Planilha) */}
        <div
          className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
            isDark
              ? 'bg-[#0a152d] border-blue-600/60 shadow-md'
              : 'bg-white border-blue-200 shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between w-full">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                FORMAÇÕES PREVISTAS
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">Total consolidado das 7 áreas</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <GraduationCap className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-black text-white block tracking-tight">
              {areaTableData.totalPrevistas.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-700/50 text-[11px] font-semibold text-sky-300">
            Formações distribuídas na rede
          </div>
        </div>

        {/* Card 2: FORMAÇÕES CONCLUÍDAS (Planilha) */}
        <div
          className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
            isDark
              ? 'bg-[#07241d] border-emerald-600/60 shadow-md'
              : 'bg-white border-emerald-200 shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between w-full">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                FORMAÇÕES CONCLUÍDAS
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">Certificações realizadas</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
                {areaTableData.totalConcluidas.toLocaleString('pt-BR')}
              </span>
              <span className="text-lg font-bold text-emerald-300">
                ({areaTableData.percentualGlobal.toFixed(1)}%)
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-700/50 text-[11px] font-semibold text-emerald-300">
            Índice de conclusão geral da planilha
          </div>
        </div>

        {/* Card 3: DOCENTES FORMADOS (Público-Alvo) */}
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
                : 'bg-[#0c1b29] border-emerald-600/40 hover:border-emerald-500'
              : statusFilter === 'FORMADOS'
              ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500'
              : 'bg-white border-emerald-200 hover:border-emerald-400'
          }`}
          title="Clique para ver os docentes formados"
        >
          <div className="flex items-start justify-between w-full">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                DOCENTES FORMADOS
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">Docentes com formação realizada</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Users className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
                {metrics.totalFormados.toLocaleString('pt-BR')}
              </span>
              <span className="text-lg font-bold text-emerald-300">
                ({metrics.percentFormados.toFixed(1)}%)
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] font-semibold text-emerald-200">
              <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-700/60">
                URE: {metrics.totalFormados}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-950/40 border border-emerald-800/40 text-emerald-300/80">
                UE: 0
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-700/50 text-[11px] font-semibold text-emerald-300 hover:underline">
            Filtrar formados →
          </div>
        </div>

        {/* Card 4: DOCENTES NÃO FORMADOS */}
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
              : 'bg-white border-rose-200 hover:border-rose-400'
          }`}
          title="Clique para ver os docentes não formados"
        >
          <div className="flex items-start justify-between w-full">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                DOCENTES NÃO FORMADOS
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">Docentes sem formação concluída</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <XCircle className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-rose-400 tracking-tight">
                {metrics.totalNaoFormado.toLocaleString('pt-BR')}
              </span>
              <span className="text-lg font-bold text-rose-300">
                ({metrics.percentNaoFormado.toFixed(1)}%)
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-700/50 text-[11px] font-semibold text-rose-300 hover:underline">
            Filtrar não formados →
          </div>
        </div>
      </div>

      {/* 4. VISÃO CONDICIONAL: ÁREAS (PLANILHA CONSOLIDADA) OU ESCOLAS (FOTO 2) OU DOCENTES */}
      {viewMode === 'areas' ? (
        /* TABELA CONSOLIDADA OFICIAL POR ÁREA DO CONHECIMENTO (PLANILHA ATUALIZADA) */
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
                    Consolidado de Formações por Área do Conhecimento (7 Áreas)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Acompanhamento oficial das formações previstas, formações concluídas e índice de formação
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const headers = [
                      'Área do Conhecimento',
                      'Formações Previstas',
                      'Formações Concluídas',
                      '% Concluído',
                      'Docentes Previstos',
                      'Docentes Formados',
                    ];
                    const rows = areaTableData.rows.map((r) => [
                      `"${r.area}"`,
                      r.previstas,
                      r.concluidas,
                      `"${r.percentual.toFixed(1).replace('.', ',')}%"`,
                      r.docentes,
                      r.docentesConcluidos,
                    ]);
                    rows.push([
                      '"TOTAL CONSOLIDADO"',
                      areaTableData.totalPrevistas,
                      areaTableData.totalConcluidas,
                      `"${areaTableData.percentualGlobal.toFixed(1).replace('.', ',')}%"`,
                      areaTableData.totalDocentes,
                      areaTableData.totalDocentesConcluidos,
                    ]);
                    const csvContent =
                      '\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', 'Consolidado_Areas_URE_Sul_3.csv');
                    link.click();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar Tabela de Áreas</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#091122] text-slate-200 border-b border-slate-800 text-[11px] font-bold">
                    <th className="px-4 py-3.5 border-r border-slate-800">Área do Conhecimento</th>
                    <th className="px-3 py-3.5 text-center border-r border-slate-800">Formações Previstas</th>
                    <th className="px-3 py-3.5 text-center border-r border-slate-800 text-emerald-400 font-bold">
                      Formações Concluídas
                    </th>
                    <th className="px-3 py-3.5 text-center border-r border-slate-800 bg-[#e05638] text-white font-bold">
                      % Concluído
                    </th>
                    <th className="px-3 py-3.5 text-center border-r border-slate-800">Docentes Previstos</th>
                    <th className="px-3 py-3.5 text-center border-r border-slate-800 text-sky-400">Docentes Formados</th>
                    <th className="px-3 py-3.5 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {areaTableData.rows.map((a, idx) => {
                    const perc = a.percentual;
                    const isHigh = perc >= 50;
                    const isMedium = perc >= 30 && perc < 50;

                    return (
                      <tr
                        key={a.area}
                        className={`transition-colors ${
                          idx % 2 === 0 ? 'bg-[#0c152a]' : 'bg-[#080f1e]'
                        } hover:bg-blue-900/30`}
                      >
                        <td className="px-4 py-3 font-bold text-white border-r border-slate-800">
                          <span className="text-sky-300 uppercase tracking-wide">{a.area}</span>
                        </td>
                        <td className="px-3 py-3 text-center border-r border-slate-800 text-slate-300 font-semibold">
                          {a.previstas.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-3 text-center border-r border-slate-800 text-emerald-400 font-bold">
                          {a.concluidas.toLocaleString('pt-BR')}
                        </td>
                        <td
                          className={`px-3 py-3 text-center font-extrabold border-r border-slate-800 ${
                            isHigh
                              ? 'bg-emerald-900/60 text-emerald-300'
                              : isMedium
                              ? 'bg-amber-900/60 text-amber-300'
                              : 'bg-rose-900/60 text-rose-300'
                          }`}
                        >
                          {perc.toFixed(1).replace('.', ',')}%
                        </td>
                        <td className="px-3 py-3 text-center border-r border-slate-800 text-slate-300">
                          {a.docentes.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-3 text-center border-r border-slate-800 text-sky-300 font-semibold">
                          {a.docentesConcluidos.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedArea(a.area);
                              setViewMode('publico_alvo');
                            }}
                            className="px-2.5 py-1 rounded-md bg-blue-600/30 hover:bg-blue-600 text-sky-200 hover:text-white border border-blue-500/40 text-[11px] font-bold transition-all cursor-pointer"
                          >
                            Ver Docentes →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-black text-white font-black border-t-2 border-slate-700 text-xs">
                    <td className="px-4 py-3.5 border-r border-slate-800 uppercase tracking-wider text-amber-300">
                      TOTAL CONSOLIDADO (7 ÁREAS)
                    </td>
                    <td className="px-3 py-3.5 text-center border-r border-slate-800 text-slate-100">
                      {areaTableData.totalPrevistas.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-3.5 text-center border-r border-slate-800 text-emerald-300">
                      {areaTableData.totalConcluidas.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-3.5 text-center border-r border-slate-800 bg-[#e05638] text-white">
                      {areaTableData.percentualGlobal.toFixed(1).replace('.', ',')}%
                    </td>
                    <td className="px-3 py-3.5 text-center border-r border-slate-800 text-slate-100">
                      {areaTableData.totalDocentes.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-3.5 text-center border-r border-slate-800 text-sky-300">
                      {areaTableData.totalDocentesConcluidos.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-3.5 text-center text-slate-400 text-[11px]">
                      Rede Completa
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Cards Visuais das 7 Áreas */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Cards Individuais por Área de Conhecimento
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {areaTableData.rows.map((a) => (
                <div
                  key={a.area}
                  onClick={() => {
                    setSelectedArea(a.area);
                    setViewMode('publico_alvo');
                  }}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                    selectedArea === a.area
                      ? 'bg-blue-950/80 border-blue-500 ring-2 ring-blue-500 scale-[1.01]'
                      : isDark
                      ? 'bg-[#0d162a] border-slate-800 hover:border-slate-700 hover:scale-[1.01]'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-400 truncate max-w-[190px]">
                      {a.area}
                    </span>
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-700">
                      {a.percentual.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mb-2">
                    <div>
                      <span className="text-2xl font-black text-white">{a.concluidas}</span>
                      <span className="text-xs text-slate-400 ml-1.5">de {a.previstas} previstas</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {a.docentesConcluidos}/{a.docentes} profs
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, a.percentual)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : viewMode === 'escolas' ? (
        /* TABELA COMPLETA DE ESCOLAS COMO NA IMAGEM 2 */
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
                </h3>
                <p className="text-xs text-slate-400">
                  Acompanhamento oficial do público-alvo previsto, formados (URE/UE) e indicador de conclusão
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const headers = [
                  'Escola',
                  'Público-Alvo Previsto',
                  'Formados (URE)',
                  'Formados (UE)',
                  'Total Formados',
                  'Indicador (%)',
                ];
                const rows = schoolAggregates.map((s) => [
                  `"${(s.escola || '').replace(/"/g, '""')}"`,
                  s.previstos,
                  s.formadosURE,
                  s.formadosUE,
                  s.formadosTotal,
                  `"${s.indicador.toFixed(1).replace('.', ',')}%"`,
                ]);
                const csvContent =
                  '\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'Indicadores_Escolas_URE_Sul_3.csv');
                link.click();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors self-start sm:self-auto cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Tabela de Escolas</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#091122] text-slate-200 border-b border-slate-800 text-[11px] font-bold">
                  <th className="px-4 py-3.5 border-r border-slate-800">Escola</th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-800">Público-Alvo Previsto</th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-800">Formados (URE)</th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-800">Formados (UE)</th>
                  <th className="px-3 py-3.5 text-center border-r border-slate-800 text-emerald-400 font-bold">
                    Total Formados
                  </th>
                  <th className="px-3 py-3.5 text-center bg-[#e05638] text-white font-bold">
                    Indicador (% Concluído)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {schoolAggregates.map((s, idx) => {
                  const perc = s.indicador;
                  const isHigh = perc >= 80;
                  const isMedium = perc >= 70 && perc < 80;
                  const isLow = perc < 70;

                  return (
                    <tr
                      key={s.escola}
                      onClick={() => {
                        onSelectSchool(s.escola);
                        setViewMode('publico_alvo');
                      }}
                      className={`transition-colors cursor-pointer ${
                        idx % 2 === 0 ? 'bg-[#0c152a]' : 'bg-[#080f1e]'
                      } hover:bg-blue-900/30`}
                      title="Clique para filtrar docentes desta escola"
                    >
                      <td className="px-4 py-2.5 font-bold text-white border-r border-slate-800 truncate max-w-[320px]">
                        {s.escola}
                      </td>
                      <td className="px-3 py-2.5 text-center border-r border-slate-800 text-slate-300 font-semibold">
                        {s.previstos}
                      </td>
                      <td className="px-3 py-2.5 text-center border-r border-slate-800 text-slate-300">
                        {s.formadosURE || 0}
                      </td>
                      <td className="px-3 py-2.5 text-center border-r border-slate-800 text-slate-300">
                        {s.formadosUE || 0}
                      </td>
                      <td className="px-3 py-2.5 text-center border-r border-slate-800 text-emerald-400 font-bold">
                        {s.formadosTotal}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-center font-extrabold ${
                          isHigh
                            ? 'bg-emerald-700 text-white'
                            : isMedium
                            ? 'bg-amber-600 text-white'
                            : isLow
                            ? 'bg-rose-700 text-white'
                            : 'bg-slate-700 text-white'
                        }`}
                      >
                        {perc.toFixed(1).replace('.', ',')}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-black text-white font-black border-t-2 border-slate-700 text-xs">
                  <td className="px-4 py-3 border-r border-slate-800">
                    Total Geral ({schoolAggregates.length} Escolas)
                  </td>
                  <td className="px-3 py-3 text-center border-r border-slate-800">
                    {schoolTotals.previstos.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-3 text-center border-r border-slate-800">
                    {schoolTotals.formadosURE.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-3 text-center border-r border-slate-800">
                    {schoolTotals.formadosUE.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-3 text-center border-r border-slate-800 text-emerald-300">
                    {schoolTotals.formadosTotal.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-3 text-center bg-[#e05638] text-white">
                    {schoolTotals.indicadorGlobal.toFixed(1).replace('.', ',')}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}

      {/* 5. GRÁFICO E TABELA DE DOCENTES (NOMINAL) */}
      {viewMode === 'publico_alvo' && (
        <>
          {/* Gráfico Donut de Distribuição */}
          <div
            className={`p-5 sm:p-6 rounded-2xl border transition-all text-center ${
              isDark ? 'bg-[#0d162a] border-slate-800 shadow-md' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div className="mb-4 pb-3 border-b border-slate-700/40 text-center">
              <h2 className="text-base sm:text-lg font-bold text-white text-center mx-auto">
                Distribuição de Docentes (Formados vs Não Formados)
                {selectedArea !== 'TODAS' ? ` - Área: ${selectedArea}` : ''}
                {selectedSchool !== 'TODAS' ? ` (${selectedSchool})` : ''}
              </h2>
            </div>

            {metrics.totalDocentes > 0 ? (
              <div className="flex flex-col items-center justify-center">
                <div className="h-60 sm:h-72 w-full max-w-md relative flex items-center justify-center mx-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={105}
                        paddingAngle={3}
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-3xl sm:text-4xl font-black text-white leading-tight">
                      {metrics.totalDocentes.toLocaleString('pt-BR')}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Total
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('FORMADOS')}
                    className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <span className="w-3 h-3 rounded-sm bg-emerald-500 shrink-0" />
                    <span className="text-slate-200">
                      Formados:{' '}
                      <strong className="font-bold text-emerald-400">{metrics.percentFormados.toFixed(1)}%</strong>{' '}
                      ({metrics.totalFormados})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('NAO_FORMADO')}
                    className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <span className="w-3 h-3 rounded-sm bg-rose-500 shrink-0" />
                    <span className="text-slate-200">
                      Não Formado:{' '}
                      <strong className="font-bold text-rose-400">{metrics.percentNaoFormado.toFixed(1)}%</strong>{' '}
                      ({metrics.totalNaoFormado})
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                Nenhum docente localizado para os filtros informados.
              </div>
            )}
          </div>

          {/* Relação de Docentes: Tabela Principal (Nominal) */}
          <div
            className={`rounded-2xl border overflow-hidden shadow-md transition-all ${
              isDark ? 'bg-[#0d162a] border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            {/* Barra de Ações da Tabela */}
            <div
              className={`p-4 sm:p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                isDark ? 'bg-[#0b1328] border-slate-800' : 'bg-slate-50 border-slate-100'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    Relação de Docentes ({sortedDisplayedRecords.length})
                  </h3>
                </div>

                {statusFilter !== 'TODOS' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-900/60 text-blue-300 border border-blue-700">
                    <span>Filtrando:</span>
                    <strong>{statusFilter === 'FORMADOS' ? 'Formados' : 'Não Formado'}</strong>
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

              {/* Busca e Exportações */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar professor..."
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
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    disabled={sortedDisplayedRecords.length === 0}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 transition-colors disabled:opacity-50 cursor-pointer shadow-xs min-h-[38px]"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Exportar PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCSV}
                    disabled={sortedDisplayedRecords.length === 0}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs min-h-[38px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar CSV</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Versão Desktop / Tablet */}
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs border-collapse">
                <thead className="bg-[#091122] text-slate-200 uppercase font-bold text-[11px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5 border-r border-slate-800 text-center">Escola</th>
                    <th className="px-4 py-3.5 border-r border-slate-800 text-center">Professor</th>
                    <th className="px-4 py-3.5 border-r border-slate-800 text-center">Área do Conhecimento</th>
                    <th className="px-4 py-3.5 text-center">Situação da Formação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sortedDisplayedRecords.length > 0 ? (
                    sortedDisplayedRecords.map((r, index) => (
                      <tr
                        key={`${r.id}-${index}`}
                        className={`transition-colors hover:bg-blue-950/40 ${
                          index % 2 === 0 ? 'bg-[#0c152a]' : 'bg-[#080f1e]'
                        }`}
                      >
                        {/* Escola */}
                        <td className="px-4 py-3.5 font-bold text-sky-400 border-r border-slate-800 text-center max-w-[280px]">
                          {r.escola}
                        </td>

                        {/* Professor */}
                        <td className="px-4 py-3.5 text-center border-r border-slate-800 font-bold text-white text-sm">
                          {r.docente}
                        </td>

                        {/* Área */}
                        <td className="px-4 py-3.5 text-center border-r border-slate-800 font-medium text-slate-300 text-xs">
                          {r.area || 'Geral'}
                        </td>

                        {/* Situação */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-[540px] mx-auto">
                            {r.componentsList && r.componentsList.length > 0 ? (
                              r.componentsList.map((comp, cIdx) => (
                                <span
                                  key={`${comp.name}-${cIdx}`}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors shadow-xs ${
                                    comp.status === 'FORMADOS' || comp.isCompleted
                                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/80'
                                      : 'bg-rose-950/60 text-rose-300 border-rose-700/80'
                                  }`}
                                >
                                  {comp.status === 'FORMADOS' || comp.isCompleted ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                  )}
                                  <span>{comp.name}</span>
                                </span>
                              ))
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border shadow-xs ${
                                  r.isCompleted || r.situacao === 'FORMADOS'
                                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/80'
                                    : 'bg-rose-950/60 text-rose-300 border-rose-700/80'
                                }`}
                              >
                                {r.isCompleted || r.situacao === 'FORMADOS' ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span>Formado</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                    <span>Não Formado</span>
                                  </>
                                )}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-400 font-medium">
                        Nenhum docente localizado para os filtros informados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
