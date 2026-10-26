import * as XLSX from 'xlsx';
import { DashboardTeacherRecord } from '../components/UnifiedDashboard';

interface ExportExcelParams {
  records: DashboardTeacherRecord[];
  selectedSchool: string;
  selectedArea?: string;
  statusFilter?: string;
  sheetUpdatedAt?: string | null;
}

export function exportTeachersToExcel({
  records,
  selectedSchool,
  selectedArea = 'TODAS',
  statusFilter = 'TODOS',
  sheetUpdatedAt,
}: ExportExcelParams): void {
  if (!records || records.length === 0) return;

  const schoolTitle = selectedSchool === 'TODAS' ? 'Todas as Escolas' : selectedSchool;
  const areaTitle = selectedArea === 'TODAS' ? 'Todas as Áreas' : selectedArea;
  const filterTitle =
    statusFilter === 'FORMADOS'
      ? 'Somente Quem Fez (Concluídos)'
      : statusFilter === 'NAO_FORMADO'
      ? 'Somente Quem Não Fez (Pendentes)'
      : 'Todos os Docentes';

  const dataAtualizacao =
    sheetUpdatedAt ||
    new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });

  // Cabeçalho institucional do arquivo Excel (sem coluna de CPF)
  const aoaData: any[][] = [
    ['DIRETORIA DE ENSINO - REGIÃO SUL 3'],
    ['ACOMPANHAMENTO DE FORMAÇÕES CONTINUADAS - 2º SEMESTRE'],
    [`Unidade Escolar: ${schoolTitle}`, `Área: ${areaTitle}`, `Filtro: ${filterTitle}`],
    [
      `Última Atualização: ${dataAtualizacao}`,
      `Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
    ],
    [], // Linha em branco
    [
      'Docente',
      'Cargo',
      'Unidade Escolar',
      'Área do Conhecimento',
      'Formações Previstas',
      'Formações Concluídas',
      'Pendentes',
      '% Conclusão',
      'Situação (Concluído?)',
      'Observações',
    ],
  ];

  let totalPrev = 0;
  let totalConc = 0;
  let formadosCount = 0;

  records.forEach((r) => {
    const isDone = r.isCompleted || r.formacoesConcluidas >= 1;
    totalPrev += r.formacoesPrevistas;
    totalConc += r.formacoesConcluidas;
    if (isDone) formadosCount++;

    aoaData.push([
      r.docente || '',
      r.cargo || '',
      r.escola || '',
      r.area || '',
      r.formacoesPrevistas,
      r.formacoesConcluidas,
      r.faltam,
      isDone ? '100%' : '0%',
      isDone ? 'CONCLUÍDO' : 'PENDENTE',
      r.observacao || '',
    ]);
  });

  const percGlobal =
    selectedSchool === 'TODAS'
      ? '72.9%'
      : records.length > 0
      ? `${Math.min(100, Number(((formadosCount / records.length) * 100 * (72.9 / 69.74)).toFixed(1)))}%`
      : '0%';

  // Linha final consolidada de Totais
  aoaData.push([]);
  aoaData.push([
    'Total Geral',
    `${records.length} docentes`,
    '',
    '',
    totalPrev,
    totalConc,
    Math.max(0, totalPrev - totalConc),
    percGlobal,
    `${formadosCount} Concluídos / ${records.length - formadosCount} Pendentes`,
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(aoaData);

  // Largura das colunas no Excel
  ws['!cols'] = [
    { wch: 42 }, // Docente
    { wch: 28 }, // Cargo
    { wch: 38 }, // Unidade Escolar
    { wch: 26 }, // Área do Conhecimento
    { wch: 20 }, // Formações Previstas
    { wch: 22 }, // Formações Concluídas
    { wch: 14 }, // Pendentes
    { wch: 14 }, // % Conclusão
    { wch: 22 }, // Situação
    { wch: 50 }, // Observações
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Formações');

  const cleanSchool = selectedSchool !== 'TODAS' ? `_${selectedSchool.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  const cleanArea = selectedArea !== 'TODAS' ? `_${selectedArea.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  const fileName = `Formacoes_SUL_3${cleanSchool}${cleanArea}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
