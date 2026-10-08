import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Download,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  School as SchoolIcon,
  Layers,
  ChevronDown,
  FileSpreadsheet,
  AlertCircle,
  X,
  Users,
  Award,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { ComponentData, TeacherTraining } from '../types';

interface ComponentDetailViewProps {
  selectedComponent: string;
  componentNames: string[];
  onSelectComponent: (name: string) => void;
  components: Record<string, ComponentData>;
  allSchools: string[]; // Master list of schools from 'GERAL' / 'Profs Geral'
  selectedSchool: string;
  onSelectSchool: (school: string) => void;
}

export const ComponentDetailView: React.FC<ComponentDetailViewProps> = ({
  selectedComponent,
  componentNames,
  onSelectComponent,
  components,
  allSchools,
  selectedSchool,
  onSelectSchool,
}) => {
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'CONCLUIDOS' | 'PENDENTES'>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');

  // Handle "TODOS" vs specific component
  const activeRecords = useMemo(() => {
    if (selectedComponent === 'TODOS') {
      const all: TeacherTraining[] = [];
      componentNames.forEach((name) => {
        const c = components[name];
        if (c) all.push(...c.records);
      });
      return all;
    }
    return components[selectedComponent]?.records || [];
  }, [selectedComponent, componentNames, components]);

  // Count how many teachers from each school are in the currently selected component
  const teachersCountPerSchool = useMemo(() => {
    const map = new Map<string, number>();
    activeRecords.forEach((r) => {
      const s = r.escola || 'Outra';
      map.set(s, (map.get(s) || 0) + 1);
    });
    return map;
  }, [activeRecords]);

  // Filter the 104 master schools by school search query if typed
  const filteredSchoolOptions = useMemo(() => {
    if (!schoolSearchQuery.trim()) return allSchools;
    const q = schoolSearchQuery.toLowerCase();
    return allSchools.filter((s) => s.toLowerCase().includes(q));
  }, [allSchools, schoolSearchQuery]);

  // Filter records based on selected school, status filter, and search input
  const filteredRecords = useMemo(() => {
    return activeRecords.filter((rec) => {
      // 1. School filter
      if (selectedSchool !== 'TODAS') {
        const cleanRecSchool = (rec.escola || '').trim().toUpperCase();
        const cleanSelected = selectedSchool.trim().toUpperCase();
        if (cleanRecSchool !== cleanSelected) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter === 'CONCLUIDOS' && !rec.isCompleted) {
        return false;
      }
      if (statusFilter === 'PENDENTES' && rec.isCompleted) {
        return false;
      }

      // 3. Search term (docente, CPF, escola, area)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchDocente = rec.docente.toLowerCase().includes(q);
        const matchEscola = rec.escola.toLowerCase().includes(q);
        const matchCpf = rec.cpf ? rec.cpf.includes(q) : false;
        const matchArea = rec.area ? rec.area.toLowerCase().includes(q) : false;
        if (!matchDocente && !matchEscola && !matchCpf && !matchArea) {
          return false;
        }
      }

      return true;
    });
  }, [activeRecords, selectedSchool, statusFilter, searchTerm]);

  // Calculate stats for the active selection (component + school)
  const activeStats = useMemo(() => {
    const baseList = selectedSchool === 'TODAS'
      ? activeRecords
      : activeRecords.filter((r) => (r.escola || '').trim().toUpperCase() === selectedSchool.trim().toUpperCase());

    let totalPrevistas = 0;
    let totalConcluidas = 0;
    let totalConcluidos = 0;
    let totalPendentes = 0;

    const concluidosList: TeacherTraining[] = [];
    const pendentesList: TeacherTraining[] = [];

    baseList.forEach((r) => {
      totalPrevistas += r.formacoesPrevistas;
      totalConcluidas += r.formacoesConcluidas;
      if (r.isCompleted) {
        totalConcluidos++;
        concluidosList.push(r);
      } else {
        totalPendentes++;
        pendentesList.push(r);
      }
    });

    const percentual = totalPrevistas > 0
      ? Math.min(100, Math.round((totalConcluidas / totalPrevistas) * 100))
      : (baseList.length > 0 && totalConcluidos === baseList.length ? 100 : 0);

    return {
      totalDocentes: baseList.length,
      totalPrevistas,
      totalConcluidas,
      totalConcluidos,
      totalPendentes,
      percentual,
      concluidosList,
      pendentesList,
    };
  }, [activeRecords, selectedSchool]);

  // Chart data: Distribution or ranking by school for this component
  const chartData = useMemo(() => {
    if (selectedSchool !== 'TODAS') {
      // In single-school mode, show a comparison of Previstas vs Concluídas for that school
      return [
        {
          name: selectedSchool.replace('EE ', ''),
          Previstas: activeStats.totalPrevistas,
          Concluídas: activeStats.totalConcluidas,
          Taxa: activeStats.percentual,
        },
      ];
    }

    // In all-schools mode, aggregate schools that have teachers in this component
    const map = new Map<string, { previstas: number; concluidas: number; total: number; concluidos: number }>();
    activeRecords.forEach((r) => {
      const esc = r.escola || 'Outra';
      if (!map.has(esc)) {
        map.set(esc, { previstas: 0, concluidas: 0, total: 0, concluidos: 0 });
      }
      const item = map.get(esc)!;
      item.previstas += r.formacoesPrevistas;
      item.concluidas += r.formacoesConcluidas;
      item.total += 1;
      if (r.isCompleted) item.concluidos += 1;
    });

    const data: { escola: string; Taxa: number; Concluídas: number; Previstas: number; Docentes: number }[] = [];
    map.forEach((val, esc) => {
      const taxa = val.previstas > 0
        ? Math.min(100, Math.round((val.concluidas / val.previstas) * 100))
        : (val.total > 0 && val.concluidos === val.total ? 100 : 0);

      data.push({
        escola: esc.replace('EE ', ''),
        Taxa: taxa,
        Concluídas: val.concluidas,
        Previstas: val.previstas,
        Docentes: val.total,
      });
    });

    // Top schools by completion rate
    return data.sort((a, b) => b.Taxa - a.Taxa || b.Concluídas - a.Concluídas).slice(0, 15);
  }, [selectedSchool, activeRecords, activeStats]);

  // Download CSV file formatted with Excel UTF-8 BOM
  const handleDownloadCsv = () => {
    const headers = [
      'Componente Curricular',
      'Escola (Mapeada na aba Profs Geral)',
      'Docente',
      'CPF',
      'Área',
      'Formações Previstas',
      'Formações Concluídas',
      '% Conclusão',
      'Situação',
      'Formações Faltantes',
    ];

    const rows = filteredRecords.map((r) => [
      `"${(r.area || selectedComponent).replace(/"/g, '""')}"`,
      `"${(r.escola || '').replace(/"/g, '""')}"`,
      `"${(r.docente || '').replace(/"/g, '""')}"`,
      `"${(r.cpf || '').replace(/"/g, '""')}"`,
      `"${(r.area || '').replace(/"/g, '""')}"`,
      r.formacoesPrevistas,
      r.formacoesConcluidas,
      `"${r.percentual}%"`,
      `"${r.isCompleted ? 'CONCLUÍDO (100%)' : 'PENDENTE'}"`,
      `"${r.isCompleted ? 'Nenhuma pendência' : `Faltam ${r.faltam} formação(ões)`}"`,
    ]);

    // UTF-8 BOM + semicolon separator
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const cleanComp = selectedComponent.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanSchool = (selectedSchool === 'TODAS' ? 'Todas_Escolas' : selectedSchool).replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);

    link.setAttribute('href', url);
    link.setAttribute('download', `Relatorio_Formacoes_${cleanComp}_${cleanSchool}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy formatted text for WhatsApp or Email
  const handleCopyReport = async () => {
    const schoolTitle = selectedSchool === 'TODAS' ? 'Todas as Escolas da URE Sul 3' : selectedSchool;
    let text = `📋 *RELATÓRIO DE FORMAÇÕES - URE SUL 3*\n`;
    text += `*Componente Curricular:* ${selectedComponent}\n`;
    text += `*Escola:* ${schoolTitle}\n`;
    text += `*Progresso:* ${activeStats.percentual}% (${activeStats.totalConcluidas}/${activeStats.totalPrevistas} formações concluídas)\n`;
    text += `*Docentes:* ${activeStats.totalDocentes} professores (${activeStats.totalConcluidos} concluídos / ${activeStats.totalPendentes} pendentes)\n\n`;

    text += `✅ *PROFESSORES QUE CONCLUÍRAM (${activeStats.concluidosList.length}):*\n`;
    if (activeStats.concluidosList.length === 0) {
      text += `_Nenhum docente concluiu ainda._\n`;
    } else {
      activeStats.concluidosList.forEach((r) => {
        text += `• ${r.docente} (${r.escola}) - ${r.formacoesConcluidas}/${r.formacoesPrevistas} (100% Concluído)\n`;
      });
    }

    text += `\n⚠️ *PROFESSORES COM FORMAÇÕES PENDENTES (${activeStats.pendentesList.length}):*\n`;
    if (activeStats.pendentesList.length === 0) {
      text += `_🎉 Todos os professores estão com 100% concluído!_\n`;
    } else {
      activeStats.pendentesList.forEach((r) => {
        text += `• ${r.docente} (${r.escola}) - Concluídas: ${r.formacoesConcluidas}/${r.formacoesPrevistas} (Falta ${r.faltam} formação)\n`;
      });
    }

    text += `\n_Fonte: Planilha FORMAÇÕES URE SUL 2º SEMESTRE_`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleResetFilters = () => {
    onSelectSchool('TODAS');
    setStatusFilter('TODOS');
    setSearchTerm('');
  };

  return (
    <div className="space-y-6">
      {/* 1. MAIN FILTER & SELECTION CARD */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 md:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-700" />
              <span>Filtros de Consulta e Relatórios</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Selecione o componente e a escola para atualizar os dados e gerar o download do relatório CSV.
            </p>
          </div>

          {/* Quick Clear Filters Button */}
          {(selectedSchool !== 'TODAS' || statusFilter !== 'TODOS' || searchTerm) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>

        {/* 2 Primary Dropdowns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Filter 1: Component Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-700" />
                <span>1. Componente Curricular (Aba)</span>
              </span>
              <span className="text-[11px] text-blue-700 font-semibold lowercase">
                {componentNames.length} abas encontradas
              </span>
            </label>
            <div className="relative">
              <select
                id="component-select"
                value={selectedComponent}
                onChange={(e) => onSelectComponent(e.target.value)}
                className="w-full appearance-none bg-slate-50 hover:bg-white border border-slate-300 hover:border-blue-500 font-bold text-slate-900 text-sm px-4 py-3 rounded-xl pr-10 focus:outline-hidden focus:ring-2 focus:ring-blue-600 cursor-pointer transition-all shadow-2xs"
              >
                {componentNames.map((name) => {
                  const count = components[name]?.records.length || 0;
                  return (
                    <option key={name} value={name}>
                      {name} ({count} professores mapeados)
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-600 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Filter 2: School Dropdown (Sourced from master Profs Geral) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <SchoolIcon className="w-4 h-4 text-indigo-600" />
                <span>2. Escola (Mapeada da aba 'Profs Geral')</span>
              </span>
              <span className="text-[11px] text-indigo-700 font-semibold lowercase">
                {allSchools.length} escolas da URE Sul 3
              </span>
            </label>
            <div className="relative">
              <select
                id="school-select"
                value={selectedSchool}
                onChange={(e) => onSelectSchool(e.target.value)}
                className="w-full appearance-none bg-slate-50 hover:bg-white border border-slate-300 hover:border-indigo-500 font-semibold text-slate-900 text-sm px-4 py-3 rounded-xl pr-10 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 cursor-pointer transition-all shadow-2xs"
              >
                <option value="TODAS">
                  ⭐ Todas as Escolas ({allSchools.length} unidades da URE Sul 3)
                </option>
                {allSchools.map((school) => {
                  const teacherCountInComponent = teachersCountPerSchool.get(school) || 0;
                  return (
                    <option key={school} value={school}>
                      {school} {teacherCountInComponent > 0 ? `(${teacherCountInComponent} profs em ${selectedComponent})` : ''}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-600 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Secondary Row: Status Filter + Search + CSV Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pt-2">
          {/* Status Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('TODOS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'TODOS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({activeStats.totalDocentes})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('CONCLUIDOS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === 'CONCLUIDOS'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-emerald-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Concluídos ({activeStats.totalConcluidos})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('PENDENTES')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === 'PENDENTES'
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'text-slate-600 hover:text-amber-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Pendentes ({activeStats.totalPendentes})</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar professor, CPF ou escola..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
            />
          </div>

          {/* Action Buttons: CSV Export & Copy Report */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="download-csv-btn"
              onClick={handleDownloadCsv}
              disabled={filteredRecords.length === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white transition-colors shadow-xs cursor-pointer"
              title="Baixar lista em formato CSV compatível com Excel"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Relatório (CSV)</span>
            </button>

            <button
              type="button"
              onClick={handleCopyReport}
              disabled={filteredRecords.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white transition-colors shadow-xs cursor-pointer"
              title="Copiar texto para WhatsApp da equipe"
            >
              {copiedNotification ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copiedNotification ? 'Copiado!' : 'Copiar Resumo'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC SUMMARY KPIs BANNER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-extrabold uppercase tracking-wider text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                {selectedComponent}
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <SchoolIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>{selectedSchool === 'TODAS' ? 'Todas as Escolas (Consolidado)' : selectedSchool}</span>
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {selectedSchool === 'TODAS'
                ? `Desempenho Geral de ${selectedComponent}`
                : `Status de ${selectedComponent} • ${selectedSchool}`}
            </h3>
          </div>

          {/* Progress Percentage Badge */}
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 shrink-0">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">
                Taxa de Conclusão
              </span>
              <span className="text-2xl font-black text-slate-900">
                {activeStats.percentual}%
              </span>
            </div>
            <div className="w-20 bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  activeStats.percentual >= 80
                    ? 'bg-emerald-600'
                    : activeStats.percentual >= 50
                    ? 'bg-blue-600'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${activeStats.percentual}%` }}
              />
            </div>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Teachers */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Professores Mapeados
              </span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">{activeStats.totalDocentes}</span>
              <span className="text-xs text-slate-500 font-medium">docentes</span>
            </div>
          </div>

          {/* Card 2: Formations Progress */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Formações Concluídas
              </span>
              <BookOpen className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-blue-700">{activeStats.totalConcluidas}</span>
              <span className="text-xs text-slate-500 font-medium">de {activeStats.totalPrevistas} prev.</span>
            </div>
          </div>

          {/* Card 3: 100% Concluded */}
          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                100% Concluído
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-800">{activeStats.totalConcluidos}</span>
              <span className="text-xs text-emerald-700 font-medium">professores</span>
            </div>
          </div>

          {/* Card 4: Pending */}
          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                Pendentes / Faltam
              </span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-900">{activeStats.totalPendentes}</span>
              <span className="text-xs text-amber-700 font-medium">professores</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SIDE-BY-SIDE FOCUS PANELS: WHO CONCLUDED VS WHO IS PENDING */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Panel A: Concluded Teachers */}
        <div className="bg-white rounded-2xl border border-emerald-200/90 shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3.5 border-b border-emerald-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                ✓
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-emerald-950">
                  Professores que Concluíram Formações
                </h4>
                <p className="text-[11px] text-emerald-700">
                  {activeStats.concluidosList.length} docente(s) com 100% das formações feitas
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {activeStats.concluidosList.length}
            </span>
          </div>

          <div className="mt-3 divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
            {activeStats.concluidosList.length === 0 ? (
              <p className="py-6 text-xs text-slate-400 text-center italic">
                Nenhum professor com 100% de conclusão neste filtro.
              </p>
            ) : (
              activeStats.concluidosList.map((r, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <strong className="text-slate-900 font-bold block truncate">{r.docente}</strong>
                    <span className="text-[11px] text-slate-500 truncate block">{r.escola}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] shrink-0">
                    {r.formacoesConcluidas}/{r.formacoesPrevistas} (100%)
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel B: Pending Teachers */}
        <div className="bg-white rounded-2xl border border-amber-200/90 shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3.5 border-b border-amber-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                !
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-amber-950">
                  Professores com Formações Pendentes
                </h4>
                <p className="text-[11px] text-amber-700">
                  {activeStats.pendentesList.length} docente(s) que ainda precisam concluir
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full border border-amber-200">
              {activeStats.pendentesList.length}
            </span>
          </div>

          <div className="mt-3 divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
            {activeStats.pendentesList.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs text-emerald-700 font-bold">
                  🎉 Parabéns! Todos os professores desta seleção já concluíram 100%!
                </p>
              </div>
            ) : (
              activeStats.pendentesList.map((r, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <strong className="text-slate-900 font-bold block truncate">{r.docente}</strong>
                    <span className="text-[11px] text-slate-500 truncate block">{r.escola}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[11px]">
                      Falta {r.faltam} {r.faltam === 1 ? 'formação' : 'formações'}
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      {r.formacoesConcluidas} de {r.formacoesPrevistas} feitas
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. COMPARATIVE CHART (When in All Schools mode) */}
      {selectedSchool === 'TODAS' && chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Taxa de Conclusão por Escola em {selectedComponent}
              </h3>
              <p className="text-xs text-slate-500">
                Percentual de conclusão (%) nas unidades escolares com professores neste componente
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
              Top {chartData.length} escolas
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="escola"
                  tick={{ fill: '#475569', fontSize: 10 }}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    border: 'none',
                  }}
                  formatter={(val: any) => [`${val}% concluído`, 'Taxa de Conclusão']}
                />
                <Bar dataKey="Taxa" radius={[4, 4, 0, 0]} barSize={22}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.Taxa >= 80 ? '#059669' : entry.Taxa >= 50 ? '#2563eb' : '#d97706'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 5. FULL DETAILED INTERACTIVE TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Table Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-700" />
              <span>Lista Detalhada de Professores</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Exibindo <strong>{filteredRecords.length}</strong> de {activeStats.totalDocentes} professores filtrados
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={filteredRecords.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white transition-colors cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Tabela (CSV)</span>
          </button>
        </div>

        {/* Table Elements */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Docente</th>
                <th className="px-4 py-3.5">Escola (Mapeada na 1ª Aba)</th>
                <th className="px-4 py-3.5">CPF</th>
                <th className="px-4 py-3.5">Área</th>
                <th className="px-4 py-3.5 text-center">Previstas</th>
                <th className="px-4 py-3.5 text-center">Concluídas</th>
                <th className="px-4 py-3.5 text-center">Progresso</th>
                <th className="px-5 py-3.5 text-right">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs sm:text-sm font-semibold text-slate-700">
                        Nenhum professor encontrado para esta seleção.
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedSchool !== 'TODAS'
                          ? `A escola "${selectedSchool}" pode não ter docentes inscritos em ${selectedComponent}.`
                          : 'Tente alterar os filtros ou o termo de busca.'}
                      </p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                      >
                        Ver todas as escolas
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      {r.docente}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      <span className="inline-flex items-center gap-1.5">
                        <SchoolIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-800">{r.escola}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                      {r.cpf || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      <span className="inline-block max-w-[130px] truncate" title={r.area}>
                        {r.area || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-slate-600 font-medium">
                      {r.formacoesPrevistas}
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-slate-900">
                      {r.formacoesConcluidas}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${
                              r.isCompleted ? 'bg-emerald-600' : 'bg-amber-500'
                            }`}
                            style={{ width: `${r.percentual}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700">
                          {r.percentual}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {r.isCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Concluído</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Falta {r.faltam}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
