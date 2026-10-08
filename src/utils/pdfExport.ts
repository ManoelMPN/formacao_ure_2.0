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

  // 1. Barra decorativa superior no tom azul institucional da URE Sul 3
  doc.setFillColor(0, 32, 74); // #00204a
  doc.rect(0, 0, pageWidth, 12, 'F');

  // Texto na faixa superior
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('URE SUL 3 - FORMAÇÃO CONTINUADA - 2º SEMESTRE', 14, 8);
  doc.text('ATUALIZADO ATÉ 02/10/2026', pageWidth - 14, 8, { align: 'right' });

  // 2. Título Principal do Relatório
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Relatório de Formações Docentes - URE Sul 3', 14, 22);

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

  // Fundo suave do card de identificação
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, 26, pageWidth - 28, 18, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // slate-600

  // Linha 1 de Metadados
  doc.text('Unidade Escolar: ', 18, 32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 32, 74);
  doc.text(schoolLabel, 44, 32);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Área: ', 155, 32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 32, 74);
  doc.text(areaLabel, 168, 32);

  // Linha 2 de Metadados
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Situação Filtrada: ', 18, 39);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(filterLabel, 44, 39);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Última atualização da planilha: ', 105, 39);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(sheetUpdatedAt || 'Sincronizada', 152, 39);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Total listado: ${records.length} docentes`, pageWidth - 18, 39, { align: 'right' });

  // 4. Montagem dos Dados da Tabela com as 3 colunas:
  // Escola | Professor | Situação (Centralizadas)
  const tableData = records.map((r) => {
    const situacaoDetail = r.componentsList && r.componentsList.length > 0
      ? r.componentsList
          .map(
            (c) =>
              `${c.name}: ${c.status === 'FORMADOS' || c.isCompleted ? 'Formado' : 'Não Formado'}`
          )
          .join('\n')
      : r.situacao === 'FORMADOS'
      ? 'Formado'
      : 'Não Formado';

    return [
      r.escola || 'Não informada',
      r.docente || 'Não informado',
      situacaoDetail,
    ];
  });

  autoTable(doc, {
    startY: 48,
    margin: { left: 14, right: 14, bottom: 16 },
    head: [['Escola', 'Professor', 'Situação']],
    body: tableData,
    theme: 'plain',
    headStyles: {
      fillColor: [0, 32, 74], // Azul institucional
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      cellPadding: 2.8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59], // slate-800
      cellPadding: 2.8,
      lineColor: [226, 232, 240], // slate-200
      lineWidth: 0.1,
      halign: 'center',
    },
    // Diferenciação de uma linha da outra com tom suave (Zebra Striping)
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50 suave
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold', textColor: [0, 32, 74], halign: 'center' }, // Escola
      1: { cellWidth: 80, fontStyle: 'bold', halign: 'center' }, // Professor
      2: { cellWidth: 109, halign: 'center', fontStyle: 'bold' }, // Situação
    },
    didDrawPage: (data) => {
      // Rodapé em cada página
      const totalPages = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Emitido em ${emissionDate} • URE Sul 3`,
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
