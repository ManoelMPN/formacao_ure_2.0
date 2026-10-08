import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import {
  Award,
  BookOpen,
  GraduationCap,
  School,
  TrendingUp,
  Search,
  CheckCircle2,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { ComponentData, TeacherGeneral, SchoolAggregate } from '../types';

interface GeneralOverviewProps {
  profsGeral: TeacherGeneral[];
  components: Record<string, ComponentData>;
  componentNames: string[];
  onSelectComponent: (componentName: string) => void;
  onSelectSchool?: (schoolName: string) => void;
}

export const GeneralOverview: React.FC<GeneralOverviewProps> = ({
  profsGeral,
  components,
  componentNames,
  onSelectComponent,
  onSelectSchool,
}) => {
  const [schoolSearch, setSchoolSearch] = useState('');

  // Calculate global statistics across all components
  const globalStats = useMemo(() => {
    let totalPrevistas = 0;
    let totalConcluidas = 0;
    let totalDocentesCadastrados = profsGeral.length;

    const uniqueDocentesAllComponents = new Set<string>();
    let totalDocentesComConclusao100 = 0;

    // School aggregations
    const schoolMap = new Map<string, {
      totalDocentes: Set<string>;
      concluidosDocentes: Set<string>;
      pendentesDocentes: Set<string>;
      previstas: number;
      concluidas: number;
    }>();

    // Ensure all schools in profsGeral exist in map without adding unenrolled teachers
    profsGeral.forEach((p) => {
      const escola = p.escola || 'Outra';
      if (!schoolMap.has(escola)) {
        schoolMap.set(escola, {
          totalDocentes: new Set(),
          concluidosDocentes: new Set(),
          pendentesDocentes: new Set(),
          previstas: 0,
          concluidas: 0,
        });
      }
    });

    componentNames.forEach((compName) => {
      const comp = components[compName];
      if (!comp) return;

      totalPrevistas += comp.totalPrevistas;
      totalConcluidas += comp.totalConcluidas;

      comp.records.forEach((rec) => {
        uniqueDocentesAllComponents.add(rec.docente);
        const escola = rec.escola || 'Escola não vinculada';

        if (!schoolMap.has(escola)) {
          schoolMap.set(escola, {
            totalDocentes: new Set(),
            concluidosDocentes: new Set(),
            pendentesDocentes: new Set(),
            previstas: 0,
            concluidas: 0,
          });
        }

        const sc = schoolMap.get(escola)!;
        sc.totalDocentes.add(rec.docente);
        sc.previstas += rec.formacoesPrevistas;
        sc.concluidas += rec.formacoesConcluidas;

        if (rec.isCompleted) {
          sc.concluidosDocentes.add(rec.docente);
        }
      });
    });

    // Compute pendentes as totalDocentes minus concluidosDocentes
    schoolMap.forEach((sc) => {
      sc.totalDocentes.forEach((doc) => {
        if (!sc.concluidosDocentes.has(doc)) {
          sc.pendentesDocentes.add(doc);
        }
      });
    });

    const percentualGlobal = totalPrevistas > 0
      ? Math.min(100, Math.round((totalConcluidas / totalPrevistas) * 100))
      : 0;

    const schoolAggregates: SchoolAggregate[] = [];
    schoolMap.forEach((val, escola) => {
      const docCount = val.totalDocentes.size;
      const concCount = val.concluidosDocentes.size;
      const pendCount = Math.max(0, docCount - concCount);
      const perc = docCount > 0
        ? Math.min(100, Math.round((concCount / docCount) * 100))
        : 0;

      schoolAggregates.push({
        escola,
        totalDocentes: docCount,
        concluidos: concCount,
        pendentes: pendCount,
        previstas: docCount,
        concluidas: concCount,
        percentual: perc,
      });
    });

    // Sort schools by highest percentage, then name
    schoolAggregates.sort((a, b) => b.percentual - a.percentual || a.escola.localeCompare(b.escola));

    return {
      totalPrevistas,
      totalConcluidas,
      percentualGlobal,
      totalDocentesCadastrados,
      totalDocentesAtivos: uniqueDocentesAllComponents.size || totalDocentesCadastrados,
      totalEscolas: schoolMap.size,
      schoolAggregates,
    };
  }, [profsGeral, components, componentNames]);

  // Chart 1 data: By component
  const componentChartData = useMemo(() => {
    return componentNames.map((name) => {
      const comp = components[name];
      return {
        name,
        Previstas: comp?.totalPrevistas || 0,
        Concluídas: comp?.totalConcluidas || 0,
        Taxa: comp?.percentualGeral || 0,
        Professores: comp?.totalDocentes || 0,
      };
    });
  }, [componentNames, components]);

  // Chart 2 data: By school (filtered by search)
  const filteredSchools = useMemo(() => {
    if (!schoolSearch.trim()) {
      return globalStats.schoolAggregates;
    }
    const q = schoolSearch.toLowerCase();
    return globalStats.schoolAggregates.filter((s) => s.escola.toLowerCase().includes(q));
  }, [globalStats.schoolAggregates, schoolSearch]);

  const topSchoolsChartData = useMemo(() => {
    return filteredSchools.slice(0, 10).map((s) => ({
      escola: s.escola.replace('EE ', ''),
      Taxa: s.percentual,
      Concluídas: s.concluidas,
      Previstas: s.previstas,
      Docentes: s.totalDocentes,
    }));
  }, [filteredSchools]);

  return (
    <div className="space-y-6">
      {/* Overview Header banner */}
      <div className="bg-linear-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30 mb-3">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Painel Consolidado de Formações</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Visão Geral da Diretoria URE Sul 3
          </h2>
          <p className="mt-2 text-sm text-blue-100 leading-relaxed">
            Acompanhamento em tempo real das metas pedagógicas de formação continuada do 2º Semestre. Os dados de cada docente são cruzados automaticamente com a primeira aba (<span className="text-blue-300 font-semibold">Profs Geral</span>) para mapear o status por unidade escolar.
          </p>
        </div>

        {/* Big percentage indicator in banner */}
        <div className="mt-6 sm:mt-0 sm:absolute sm:right-8 sm:top-1/2 sm:-translate-y-1/2 flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/20">
          <div className="text-center sm:text-right">
            <span className="block text-xs uppercase tracking-wider text-blue-200 font-semibold">
              Taxa Global URE Sul 3
            </span>
            <div className="text-3xl sm:text-4xl font-black text-white mt-0.5">
              {globalStats.percentualGlobal}%
            </div>
            <span className="text-xs text-blue-200">
              {globalStats.totalConcluidas} de {globalStats.totalPrevistas} formações
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Concluídas
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">
              {globalStats.totalConcluidas}
            </span>
            <span className="text-xs text-slate-500">
              / {globalStats.totalPrevistas} prev.
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${globalStats.percentualGlobal}%` }}
            />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Formações Pendentes
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">
              {Math.max(0, globalStats.totalPrevistas - globalStats.totalConcluidas)}
            </span>
            <span className="text-xs text-slate-500 ml-2">restantes</span>
          </div>
          <p className="mt-2 text-xs text-amber-700 font-medium">
            {100 - globalStats.percentualGlobal}% a concluir
          </p>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Docentes Mapeados
            </span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">
              {globalStats.totalDocentesAtivos}
            </span>
            <span className="text-xs text-slate-500 ml-2">professores</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Cadastrados na 1ª aba geral
          </p>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Escolas Atendidas
            </span>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <School className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">
              {globalStats.totalEscolas}
            </span>
            <span className="text-xs text-slate-500 ml-2">unidades</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Diretoria URE Sul 3
          </p>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Progress by Curricular Component */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Formações por Componente Curricular
              </h3>
              <p className="text-xs text-slate-500">
                Comparativo de previstas vs concluídas por disciplina
              </p>
            </div>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
              {componentNames.length} {componentNames.length === 1 ? 'Componente' : 'Componentes'}
            </span>
          </div>

          <div className="h-72 w-full mt-2">
            {componentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={componentChartData}
                  margin={{ top: 10, right: 10, left: -15, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#475569', fontSize: 12 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none',
                    }}
                    formatter={(val: any, name: string) => [
                      `${val} ${name === 'Taxa' ? '%' : 'formações'}`,
                      name,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="Previstas" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar dataKey="Concluídas" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum componente curricular encontrado.
              </div>
            )}
          </div>

          {/* Quick jump to component */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Ver detalhes:</span>
            {componentNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onSelectComponent(name)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 transition-colors"
              >
                <span>{name}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Chart 2: Completion rate by School */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Taxa de Conclusão por Escola (%)
              </h3>
              <p className="text-xs text-slate-500">
                Desempenho relativo das unidades escolares da URE Sul 3
              </p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar escola..."
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg w-full sm:w-44 focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="h-72 w-full mt-2">
            {topSchoolsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topSchoolsChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    unit="%"
                  />
                  <YAxis
                    dataKey="escola"
                    type="category"
                    tick={{ fill: '#334155', fontSize: 11 }}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none',
                    }}
                    formatter={(val: any) => [`${val}% concluído`, 'Conclusão']}
                  />
                  <Bar dataKey="Taxa" radius={[0, 4, 4, 0]} barSize={16}>
                    {topSchoolsChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.Taxa >= 80 ? '#10b981' : entry.Taxa >= 50 ? '#3b82f6' : '#f59e0b'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhuma escola encontrada para a busca "{schoolSearch}".
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Exibindo as 10 escolas principais</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> &ge; 80%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> 50% - 79%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> &lt; 50%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* School Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Tabela de Desempenho por Escola da URE Sul 3
            </h3>
            <p className="text-xs text-slate-500">
              Consolidação de todas as disciplinas por unidade escolar
            </p>
          </div>
          <span className="text-xs text-slate-500">
            Total: <strong>{filteredSchools.length}</strong> escolas listadas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Escola</th>
                <th className="px-4 py-3.5 text-center">Docentes Mapeados</th>
                <th className="px-4 py-3.5 text-center">Formações Concluídas</th>
                <th className="px-4 py-3.5 text-center">Previstas</th>
                <th className="px-4 py-3.5 text-center">Taxa</th>
                <th className="px-6 py-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchools.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-3.5 font-medium text-slate-900 flex items-center gap-2">
                    <School className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{item.escola}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center text-slate-700">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md font-medium bg-slate-100 text-slate-800">
                      {item.totalDocentes}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center font-semibold text-emerald-700">
                    {item.concluidas}
                  </td>
                  <td className="px-4 py-3.5 text-center text-slate-600">
                    {item.previstas}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={`font-bold px-2 py-0.5 rounded-md text-xs ${
                        item.percentual >= 80
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : item.percentual >= 50
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {item.percentual}%
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    {onSelectSchool ? (
                      <button
                        type="button"
                        onClick={() => onSelectSchool(item.escola)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        <span>Filtrar</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
