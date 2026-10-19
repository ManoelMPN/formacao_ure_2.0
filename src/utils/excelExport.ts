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
      ? 'Concluídos'
      : statusFilter === 'NAO_FORMADO'
      ? 'Pendentes'
      : 'Todos';

  const dataAtualizacao = sheetUpdatedAt || '02/10/2026';

  // Cabeçalho institucional do arquivo Excel
  const aoaData: any[][] = [
    ['DIRETORIA DE ENSINO - REGIÃO URE SUL 3'],
    ['ACOMPANHAMENTO DE FORMAÇÕES CONTINUADAS - 2º SEMESTRE'],
    [`Unidade Escolar: ${schoolTitle}`, `Área: ${areaTitle}`, `Filtro: ${filterTitle}`],
    [`Última Atualização da Planilha: ${dataAtualizacao}`, `Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`],
    [], // Linha em branco
    [
      'Docente / Cargo',
      'Unidade Escolar',
      'Área do Conhecimento',
      'Formações Previstas',
      'Formações Concluídas',
      'Pendentes',
      '% Conclusão',
      'Concluído?',
      'Observações',
    ],
  ];

  let totalPrev = 0;
  let totalConc = 0;

  records.forEach((r) => {
    const isDone = r.isCompleted || (r.formacoesPrevistas > 0 && r.formacoesConcluidas >= r.formacoesPrevistas);
    totalPrev += r.formacoesPrevistas;
    totalConc += r.formacoesConcluidas;

    const cargoTexto = r.cargo ? ` - ${r.cargo}` : '';

    aoaData.push([
      `${r.docente}${cargoTexto}`,
      r.escola,
      r.area,
      r.formacoesPrevistas,
      r.formacoesConcluidas,
      r.faltam,
      `${r.percentual}%`,
      isDone ? 'SIM' : 'NÃO',
      r.observacao || '',
    ]);
  });

  // Linha final consolidada
  aoaData.push([]);
  aoaData.push([
    `Total: ${records.length} atribuições / docentes`,
    '',
    '',
    totalPrev,
    totalConc,
    Math.max(0, totalPrev - totalConc),
    totalPrev > 0 ? `${((totalConc / totalPrev) * 100).toFixed(1)}%` : '0%',
    '',
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(aoaData);

  // Largura das colunas no Excel
  ws['!cols'] = [
    { wch: 50 }, // Docente / Cargo
    { wch: 38 }, // Unidade Escolar
    { wch: 24 }, // Área do Conhecimento
    { wch: 20 }, // Formações Previstas
    { wch: 22 }, // Formações Concluídas
    { wch: 14 }, // Pendentes
    { wch: 14 }, // % Conclusão
    { wch: 14 }, // Concluído?
    { wch: 50 }, // Observações
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Formações');

  const cleanSchool = selectedSchool !== 'TODAS' ? `_${selectedSchool.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  const cleanArea = selectedArea !== 'TODAS' ? `_${selectedArea.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  const fileName = `Formacoes_URE_Sul_3${cleanSchool}${cleanArea}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
