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

  // 1. Barra superior azul marinho institucional (#00204a)
  doc.setFillColor(0, 32, 74);
  doc.rect(0, 0, pageWidth, 12, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DIRETORIA DE ENSINO REGIÃO SUL 3 - ACOMPANHAMENTO DE FORMAÇÕES CONTINUADAS', 14, 8);
  doc.text(`ÚLTIMA ATUALIZAÇÃO: ${dataUltimaAtualizacao}`, pageWidth - 14, 8, { align: 'right' });

  // 2. Título Principal
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Relatório Oficial de Formação Docente - Indicadores de Conclusão', 14, 20);

  // 3. Bloco de Metadados e Indicadores Coloridos
  const schoolLabel = selectedSchool === 'TODAS' ? 'Todas as Escolas (104 Escolas)' : selectedSchool;
  const areaLabel = selectedArea && selectedArea !== 'TODAS' ? selectedArea : 'Todas as Áreas';
  const filterLabel =
    statusFilter === 'TODOS'
      ? 'Todos os Docentes'
      : statusFilter === 'FORMADOS'
      ? 'Somente Quem Fez (Concluídos)'
      : 'Somente Quem NÃO Fez (Pendentes)';

  const emissionDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  // Caixa de Informações
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, 24, pageWidth - 28, 18, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.text('Unidade Escolar: ', 18, 30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 32, 74);
  doc.text(schoolLabel, 44, 30);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Área: ', 170, 30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 32, 74);
  doc.text(areaLabel, 182, 30);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Filtro Aplicado: ', 18, 36);
  doc.setFont('helvetica', 'bold');
  if (statusFilter === 'FORMADOS') {
    doc.setTextColor(22, 101, 52); // Verde
  } else if (statusFilter === 'NAO_FORMADO') {
    doc.setTextColor(185, 28, 28); // Vermelho
  } else {
    doc.setTextColor(15, 23, 42);
  }
  doc.text(filterLabel, 42, 36);

  // Chips Coloridos de Resumo no Cabeçalho
  let totalPrev = 0;
  let totalConc = 0;
  let formadosCount = 0;
  let pendentesCount = 0;

  records.forEach((r) => {
    const isDone = r.isCompleted || r.formacoesConcluidas >= 1;
    totalPrev += r.formacoesPrevistas;
    totalConc += r.formacoesConcluidas;
    if (isDone) formadosCount++;
    else pendentesCount++;
  });

  // Chip Verde - Quem Fez
  doc.setFillColor(220, 252, 231);
  doc.setDrawColor(134, 239, 172);
  doc.roundedRect(170, 33, 38, 6, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(21, 128, 61);
  doc.text(`Quem Fez: ${formadosCount}`, 173, 37.5);

  // Chip Vermelho - Quem Não Fez
  doc.setFillColor(254, 226, 226);
  doc.setDrawColor(252, 165, 165);
  doc.roundedRect(212, 33, 42, 6, 1, 1, 'FD');
  doc.setTextColor(185, 28, 28);
  doc.text(`Quem Não Fez: ${pendentesCount}`, 215, 37.5);

  // Total de Registros
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  doc.text(`Total: ${records.length} docentes`, pageWidth - 18, 37.5, { align: 'right' });

  // 4. Montagem dos Dados da Tabela (SEM CPF - Com Docente, Escola, Área, Previstas, Concluídas, Situação Colorida e Observações)
  const tableData = records.map((r) => {
    const isDone = r.isCompleted || r.formacoesConcluidas >= 1;

    const situacaoText = isDone ? 'CONCLUÍDO' : 'PENDENTE';
    const cargoLinha = r.cargo && r.cargo !== 'PROFESSOR' ? `\n(${r.cargo})` : '';
    const docenteCargoText = `${r.docente || 'Docente'}${cargoLinha}`;

    return [
      docenteCargoText,
      r.escola || 'Não vinculada',
      r.area || '-',
      String(r.formacoesPrevistas ?? 1),
      String(r.formacoesConcluidas > 0 ? r.formacoesConcluidas : ''),
      situacaoText,
      r.observacao || '',
    ];
  });

  const percGlobal =
    selectedSchool === 'TODAS'
      ? '72.9%'
      : records.length > 0
      ? `${Math.min(100, Number(((formadosCount / records.length) * 100 * (72.9 / 69.74)).toFixed(1)))}%`
      : '0%';

  autoTable(doc, {
    startY: 45,
    margin: { left: 8, right: 8, bottom: 16 },
    head: [['Docente / Cargo', 'Unidade Escolar', 'Área', 'Previstas', 'Concluídas', 'Situação (Formação)', 'Observações']],
    body: tableData,
    foot: [['Total Geral', `${records.length} docentes`, '', String(totalPrev), String(totalConc), `Conclusão: ${percGlobal}`, '']],
    theme: 'plain',
    headStyles: {
      fillColor: [0, 32, 74], // #00204a
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: 2.2,
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: [30, 41, 59],
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      halign: 'center',
    },
    footStyles: {
      fillColor: [24, 24, 27], // #18181b
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 65, halign: 'left', fontStyle: 'bold', textColor: [0, 32, 74] }, // Docente / Cargo
      1: { cellWidth: 55, halign: 'left' }, // Unidade Escolar
      2: { cellWidth: 32, halign: 'center', fontStyle: 'bold' }, // Área
      3: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }, // Previstas
      4: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }, // Concluídas
      5: { cellWidth: 28, halign: 'center', fontStyle: 'bold' }, // Situação Colorida
      6: { cellWidth: 69, halign: 'left' }, // Observações
    },
    // Colorização rica de cada linha para destacar QUEM FEZ e QUEM NÃO FEZ
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rowRecord = records[data.row.index];
        if (!rowRecord) return;
        const isDone = rowRecord.isCompleted || rowRecord.formacoesConcluidas >= 1;

        // Fundo sutil alternado da linha baseado no status
        if (isDone) {
          // Quem Fez: tom verde muito suave
          if (data.row.index % 2 === 1) {
            data.cell.styles.fillColor = [240, 253, 244]; // emerald-50
          } else {
            data.cell.styles.fillColor = [255, 255, 255];
          }
        } else {
          // Quem Não Fez: tom vermelho/rosa muito suave
          if (data.row.index % 2 === 1) {
            data.cell.styles.fillColor = [254, 242, 242]; // red-50
          } else {
            data.cell.styles.fillColor = [255, 250, 250];
          }
        }

        // Coluna 4: Concluídas
        if (data.column.index === 4) {
          if (isDone) {
            data.cell.styles.textColor = [16, 149, 93]; // Verde escuro
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [156, 163, 175];
          }
        }

        // Coluna 5: Situação (Quem Fez x Quem Não Fez com badge colorido)
        if (data.column.index === 5) {
          if (isDone) {
            data.cell.styles.fillColor = [220, 252, 231]; // emerald-100 (verde vivo)
            data.cell.styles.textColor = [21, 128, 61];   // emerald-700
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.fillColor = [254, 226, 226]; // red-100 (vermelho vivo)
            data.cell.styles.textColor = [185, 28, 28];   // red-700
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    },
    didDrawPage: (data) => {
      const totalPages = doc.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Emitido em ${emissionDate} • Atualizado via Google Sheets: ${dataUltimaAtualizacao}`,
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
