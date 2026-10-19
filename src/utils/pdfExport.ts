import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DashboardTeacherRecord } from '../components/UnifiedDashboard';

interface ExportPdfParams {
  records: DashboardTeacherRecord[];
  selectedSchool: string;
  selectedComponent?: string;
  selectedArea?: string;
  statusFilter: string;
  sheetUpdatedAt: string | null;
}

export function exportTeachersToPdf({
  records,
  selectedSchool,
  selectedComponent,
  selectedArea,
  statusFilter,
  sheetUpdatedAt,
}: ExportPdfParams) {
  if (!records || records.length === 0) return;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const dataUltimaAtualizacao = sheetUpdatedAt || '02/10/2026';

  // 1. Barra decorativa superior no tom azul institucional da URE Sul 3
  doc.setFillColor(0, 32, 74); // #00204a
  doc.rect(0, 0, pageWidth, 12, 'F');

  // Texto na faixa superior com a data da última atualização
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('URE SUL 3 - FORMAÇÃO CONTINUADA - 2º SEMESTRE', 14, 8);
  doc.text(`ÚLTIMA ATUALIZAÇÃO DA PLANILHA: ${dataUltimaAtualizacao}`, pageWidth - 14, 8, { align: 'right' });

  // 2. Título Principal do Relatório
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Relatório de Formações Docentes - URE Sul 3', 14, 21);

  // 3. Bloco de Identificação e Metadados
  const schoolLabel = selectedSchool === 'TODAS' ? 'Todas as Unidades Escolares' : selectedSchool;
  const areaLabel = selectedArea && selectedArea !== 'TODAS' ? selectedArea : 'Todas as Áreas';
  const filterLabel =
    statusFilter === 'TODOS'
      ? 'Todos'
      : statusFilter === 'FORMADOS'
      ? 'Formados'
      : 'Não Formado';

  const emissionDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  // Fundo do card de identificação
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, 25, pageWidth - 28, 19, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // slate-600

  // Linha 1 de Metadados
  doc.text('Unidade Escolar: ', 18, 31);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 32, 74);
  doc.text(schoolLabel, 44, 31);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Área: ', 155, 31);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 32, 74);
  doc.text(areaLabel, 168, 31);

  // Linha 2 de Metadados - Destaque claro para a data de última atualização
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Situação Filtrada: ', 18, 38);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(filterLabel, 44, 38);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Última Atualização da Planilha: ', 105, 38);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(dataUltimaAtualizacao, 152, 38);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Total listado: ${records.length} docentes`, pageWidth - 18, 38, { align: 'right' });

  // 4. Montagem dos Dados da Tabela (Sem CPF, Cargos na mesma coluna, Unidade Escolar e Observações)
  let totalPrev = 0;
  let totalConc = 0;

  const tableData = records.map((r) => {
    const isDone = r.isCompleted || (r.formacoesPrevistas > 0 && r.formacoesConcluidas >= r.formacoesPrevistas);
    totalPrev += r.formacoesPrevistas;
    totalConc += r.formacoesConcluidas;

    const situacaoText = isDone
      ? 'SIM'
      : r.formacoesConcluidas > 0
      ? `Parcial (${r.formacoesConcluidas}/${r.formacoesPrevistas})`
      : 'NÃO';

    const cargoLinha = r.cargo ? `\n${r.cargo}` : '';
    const docenteCargoText = `${r.docente || 'Não informado'}${cargoLinha}`;

    return [
      docenteCargoText,
      r.escola || 'Não vinculada',
      r.area || '-',
      String(r.formacoesPrevistas ?? 1),
      String(r.formacoesConcluidas ?? 0),
      situacaoText,
      r.observacao || '-',
    ];
  });

  const percGlobal = totalPrev > 0 ? `${((totalConc / totalPrev) * 100).toFixed(1)}%` : '0%';

  autoTable(doc, {
    startY: 48,
    margin: { left: 8, right: 8, bottom: 16 },
    head: [['Docente / Cargo', 'Unidade Escolar', 'Área', 'Prev.', 'Conc.', 'Concluído', 'Observações']],
    body: tableData,
    foot: [['Total', `${records.length} atribuições`, '', String(totalPrev), String(totalConc), percGlobal, '']],
    theme: 'plain',
    headStyles: {
      fillColor: [0, 32, 74], // Azul institucional
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59], // slate-800
      cellPadding: 2,
      lineColor: [226, 232, 240], // slate-200
      lineWidth: 0.1,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50 suave
    },
    footStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { cellWidth: 66, halign: 'left', fontStyle: 'bold', textColor: [0, 32, 74] }, // Docente / Cargo
      1: { cellWidth: 50, halign: 'left' }, // Unidade Escolar
      2: { cellWidth: 30, halign: 'center' }, // Área
      3: { cellWidth: 14, halign: 'center', fontStyle: 'bold' }, // Previstas
      4: { cellWidth: 14, halign: 'center', fontStyle: 'bold', textColor: [5, 150, 105] }, // Concluídas
      5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }, // Concluído
      6: { cellWidth: 85, halign: 'left' }, // Observações
    },
    didDrawPage: (data) => {
      // Rodapé em cada página
      const totalPages = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Emitido em ${emissionDate} • Última atualização da planilha: ${dataUltimaAtualizacao}`,
        14,
        pageHeight - 6
      );
      doc.text(
        `Página ${data.pageNumber} de ${totalPages}`,
        pageWidth - 14,
        pageHeight - 6,
        { align: 'right' }
      );
    },
  });

  const cleanSchool = selectedSchool !== 'TODAS' ? `_${selectedSchool.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  const cleanComp = selectedComponent !== 'TODOS' ? `_${selectedComponent.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  const cleanFilter = statusFilter !== 'TODOS' ? `_${statusFilter}` : '';
  const fileName = `Relatorio_Formacoes_URE_Sul_3${cleanSchool}${cleanComp}${cleanFilter}.pdf`;

  doc.save(fileName);
}
