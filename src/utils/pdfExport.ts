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
  const dataUltimaAtualizacao =
    sheetUpdatedAt ||
    new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });

  // 1. Barra superior azul marinho (#00204a)
  doc.setFillColor(0, 32, 74);
  doc.rect(0, 0, pageWidth, 12, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DIRETORIA DE ENSINO REGIÃO SUL 3 - FORMAÇÃO CONTINUADA', 14, 8);
  doc.text(`ÚLTIMA ATUALIZAÇÃO: ${dataUltimaAtualizacao}`, pageWidth - 14, 8, { align: 'right' });

  // 2. Título Principal
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Relatório Oficial de Acompanhamento das Formações Docentes', 14, 21);

  // 3. Bloco de Metadados
  const schoolLabel = selectedSchool === 'TODAS' ? 'Todas as Escolas' : selectedSchool;
  const areaLabel = selectedArea && selectedArea !== 'TODAS' ? selectedArea : 'Todas as Áreas';
  const filterLabel =
    statusFilter === 'TODOS'
      ? 'Todos'
      : statusFilter === 'FORMADOS'
      ? 'Concluídos'
      : 'Pendentes';

  const emissionDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 25, pageWidth - 28, 17, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

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

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Filtro: ', 18, 37);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(filterLabel, 32, 37);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Total listado: ${records.length} registros`, pageWidth - 18, 37, { align: 'right' });

  // 4. Montagem dos Dados da Tabela
  let totalPrev = 0;
  let totalConc = 0;

  const tableData = records.map((r) => {
    const isDone =
      r.isCompleted ||
      (r.formacoesPrevistas > 0 && r.formacoesConcluidas >= r.formacoesPrevistas);
    totalPrev += r.formacoesPrevistas;
    totalConc += r.formacoesConcluidas;

    const situacaoText = isDone ? 'CONCLUÍDO' : 'PENDENTE';
    const cargoLinha = r.cargo ? `\n(${r.cargo})` : '';
    const docenteCargoText = `${r.docente || ''}${cargoLinha}`;

    return [
      r.cpf || '',
      docenteCargoText,
      r.escola || '',
      r.area || '',
      String(r.formacoesPrevistas ?? 1),
      String(r.formacoesConcluidas ?? 0),
      situacaoText,
      r.observacao || '',
    ];
  });

  const percGlobal = totalPrev > 0 ? `${((totalConc / totalPrev) * 100).toFixed(1)}%` : '0%';

  autoTable(doc, {
    startY: 46,
    margin: { left: 8, right: 8, bottom: 16 },
    head: [['CPF', 'Docente / Cargo', 'Unidade Escolar', 'Área', 'Previstas', 'Concluídas', 'Concluído', 'Observações']],
    body: tableData,
    foot: [['Total', '', `${records.length} registros`, '', String(totalPrev), String(totalConc), percGlobal, '']],
    theme: 'plain',
    headStyles: {
      fillColor: [0, 32, 74], // #00204a
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [240, 244, 248], // #f0f4f8
    },
    footStyles: {
      fillColor: [24, 24, 27], // #18181b
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center', fontStyle: 'bold' }, // CPF
      1: { cellWidth: 58, halign: 'left', fontStyle: 'bold', textColor: [0, 32, 74] }, // Docente / Cargo
      2: { cellWidth: 46, halign: 'left' }, // Unidade Escolar
      3: { cellWidth: 28, halign: 'center' }, // Área
      4: { cellWidth: 14, halign: 'center', fontStyle: 'bold' }, // Previstas
      5: { cellWidth: 14, halign: 'center', fontStyle: 'bold', textColor: [5, 150, 105] }, // Concluídas
      6: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, // Concluído
      7: { cellWidth: 75, halign: 'left' }, // Observações
    },
    didDrawPage: (data) => {
      const totalPages = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Emitido em ${emissionDate} • Última atualização: ${dataUltimaAtualizacao}`,
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
  const cleanComp = selectedComponent && selectedComponent !== 'TODOS' ? `_${selectedComponent.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  const cleanFilter = statusFilter !== 'TODOS' ? `_${statusFilter}` : '';
  const fileName = `Relatorio_Formacoes_SUL_3${cleanSchool}${cleanComp}${cleanFilter}.pdf`;

  doc.save(fileName);
}
