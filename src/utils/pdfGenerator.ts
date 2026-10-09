import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Pedido } from '../types';
import { getStoredSettings } from './settingsStorage';
import { getStatusConfig } from './statusUtils';

export async function generatePedidoPDFFromElement(element: HTMLElement, pedido: Pedido): Promise<void> {
  try {
    const settings = getStoredSettings();
    const accentColor = settings.corPrincipal || '#0066ff';

    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1024,
      onclone: (clonedDoc) => {
        const scripts = Array.from(clonedDoc.querySelectorAll('script'));
        scripts.forEach(s => s.remove());
      }
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = 210;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

    const cleanId = pedido.id.replace('#', '').trim();
    const cleanClienteName = pedido.cliente ? pedido.cliente.split(' ')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '') : 'Venda';
    const fileName = `Comprovante_${cleanId}_${cleanClienteName}.pdf`;

    pdf.save(fileName);
  } catch (err) {
    console.warn('html2canvas error (fallback to vector PDF):', err);
    generatePedidoPDF(pedido);
  }
}

export function generatePedidoPDF(pedido: Pedido): void {
  const settings = getStoredSettings();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColorHex = settings.corPrincipal || '#0066ff';

  const hexToRgb = (hex: string) => {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return [ (num >> 16) & 255, (num >> 8) & 255, num & 255 ];
  };

  const [r, g, b] = hexToRgb(primaryColorHex);

  // Background Watermark text
  try {
    doc.setTextColor(238, 240, 243);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(48);
    // Print rotated watermark in middle of A4 page
    doc.text((settings.nomeEmpresa || 'PRINT3D_BR').toUpperCase(), 105, 140, {
      align: 'center',
      angle: 335
    });
  } catch (e) {
    // ignore watermark errors if angle unsupported in legacy build
  }

  let currentY = 16;

  // 1. Logo or Icon Box
  if (settings.logotipoUrl && settings.logotipoUrl.startsWith('data:image/')) {
    try {
      let format = 'PNG';
      if (settings.logotipoUrl.includes('image/jpeg') || settings.logotipoUrl.includes('image/jpg')) {
        format = 'JPEG';
      } else if (settings.logotipoUrl.includes('image/webp')) {
        format = 'WEBP';
      }
      doc.addImage(settings.logotipoUrl, format, 14, currentY - 2, 20, 20);
    } catch (e) {
      console.warn('Erro ao inserir logo no PDF:', e);
    }
  } else {
    // Dark square box icon matching screen app
    doc.setFillColor(16, 20, 23); // #101417
    doc.roundedRect(14, currentY - 2, 16, 16, 2, 2, 'F');
    doc.setFillColor(r, g, b);
    doc.rect(20, currentY + 4, 4, 4, 'F');
  }

  // Header Company Info
  const textX = (settings.logotipoUrl && settings.logotipoUrl.startsWith('data:image/')) ? 38 : 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(16, 20, 23);
  doc.text(settings.nomeEmpresa || 'Print_3dbr', textX, currentY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 110, 120);
  doc.text((settings.subtituloEmpresa || 'Laboratório de Impressão 3D').toUpperCase(), textX, currentY + 10);

  // Contacts right aligned
  doc.setFontSize(8);
  doc.setTextColor(70, 80, 90);
  let rightY = currentY + 2;
  if (settings.whatsapp) {
    doc.text(`WhatsApp: ${settings.whatsapp}`, 196, rightY, { align: 'right' });
    rightY += 4.5;
  }
  if (settings.instagram) {
    doc.text(`Instagram: ${settings.instagram}`, 196, rightY, { align: 'right' });
    rightY += 4.5;
  }
  if (settings.email) {
    doc.text(`E-mail: ${settings.email}`, 196, rightY, { align: 'right' });
    rightY += 4.5;
  }

  currentY += 20;

  // Horizontal border line
  doc.setDrawColor(16, 20, 23);
  doc.setLineWidth(1);
  doc.line(14, currentY, 196, currentY);

  currentY += 8;

  // 2. Receipt Title & Order Number
  const statusCfg = getStatusConfig(pedido.status);
  const isPendente = pedido.status === 'pendente';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(16, 20, 23);
  doc.text(isPendente ? 'ORÇAMENTO DE IMPRESSÃO 3D' : 'COMPROVANTE DE PEDIDO', 14, currentY);

  // Order ID & Data right aligned
  doc.setFontSize(13);
  doc.text(pedido.id, 196, currentY, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 110, 120);
  doc.text(pedido.data, 196, currentY + 5, { align: 'right' });

  currentY += 12;

  // 3. Customer & Status Info Box (2 side-by-side cards matching web UI)
  const cardWidth = 88;
  const cardHeight = 22;

  // Card 1: Cliente
  doc.setFillColor(249, 250, 251); // bg-gray-50
  doc.roundedRect(14, currentY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(229, 231, 235); // border-gray-200
  doc.setLineWidth(0.4);
  doc.roundedRect(14, currentY, cardWidth, cardHeight, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(156, 163, 175);
  doc.text('CLIENTE', 18, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text(pedido.cliente || 'Cliente não identificado', 18, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text(pedido.telefone || '-', 18, currentY + 17);

  // Card 2: Status
  const card2X = 108;
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(156, 163, 175);
  doc.text('STATUS DO PEDIDO', card2X + 4, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  if (isPendente) {
    doc.setTextColor(180, 83, 9); // amber-700
  } else if (pedido.status === 'cancelado') {
    doc.setTextColor(220, 38, 38); // red-600
  } else if (pedido.status === 'entregue') {
    doc.setTextColor(21, 128, 61); // green-700
  } else {
    doc.setTextColor(2, 132, 199); // sky-600
  }

  doc.text(`${statusCfg.emoji} ${statusCfg.label.toUpperCase()}`, card2X + 4, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(statusCfg.description, card2X + 4, currentY + 17);

  currentY += 28;

  // 4. Products Table matching #101417 header styling
  const tableHead = [['DESCRIÇÃO', 'QTD', 'UNITÁRIO', 'TOTAL']];
  const tableBody = pedido.itens.map(item => [
    item.imagemUrl ? `      ${item.descricao || 'Item impresso 3D'}` : (item.descricao || 'Item impresso 3D'),
    String(item.qtd).padStart(2, '0'),
    `R$ ${item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `R$ ${(item.qtd * item.valorUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  ]);

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [16, 20, 23], // #101417 dark charcoal matching web app
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 4
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' }
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [31, 41, 55],
      cellPadding: 5
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const item = pedido.itens[data.row.index];
        if (item && item.imagemUrl) {
          try {
            const dim = 8;
            doc.addImage(item.imagemUrl, 'JPEG', data.cell.x + 2, data.cell.y + (data.cell.height - dim) / 2, dim, dim);
          } catch (e) {
            // Ignore if image data format issue
          }
        }
      }
    },
    margin: { left: 14, right: 14 }
  });

  // @ts-ignore
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : currentY + 40;

  // 5. Payment, Notes & Totals block
  let footerBlockY = finalY;

  // Left column: Payment & Notes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(156, 163, 175);
  doc.text('MÉTODO DE PAGAMENTO', 14, footerBlockY + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(31, 41, 55);
  const pixInfo = settings.chavePix && pedido.metodoPagamento === 'pix' ? ` (Chave: ${settings.chavePix})` : '';
  doc.text(`${pedido.metodoPagamento.toUpperCase()}${pixInfo}`, 14, footerBlockY + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(156, 163, 175);
  doc.text('OBSERVAÇÕES', 14, footerBlockY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  const splitObs = doc.splitTextToSize(pedido.observacoes || settings.observacoesPadrao || '', 95);
  doc.text(splitObs, 14, footerBlockY + 21);

  // Right column: Totals matching web app dark card
  const totalBoxX = 120;
  const totalBoxWidth = 76;
  const subtotalItens = pedido.itens.reduce((acc, item) => acc + (item.qtd * item.valorUnitario), 0);
  const temDesconto = typeof pedido.desconto === 'number' && pedido.desconto > 0;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 99);
  doc.text('Subtotal', totalBoxX, footerBlockY + 4);
  doc.text(`R$ ${subtotalItens.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 196, footerBlockY + 4, { align: 'right' });

  let offsetLine = 9;
  if (temDesconto) {
    doc.setTextColor(16, 149, 93);
    const pctLabel = pedido.descontoPercentual ? ` (${pedido.descontoPercentual}%)` : '';
    doc.text(`Desconto${pctLabel}`, totalBoxX, footerBlockY + offsetLine);
    doc.text(`- R$ ${(pedido.desconto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 196, footerBlockY + offsetLine, { align: 'right' });
    offsetLine += 5;
  }

  doc.setTextColor(75, 85, 99);
  doc.text('Frete / Entrega', totalBoxX, footerBlockY + offsetLine);
  doc.text('R$ 0,00', 196, footerBlockY + offsetLine, { align: 'right' });

  // Dark Total Box matching screen UI (#101417 with left border accent)
  const totalCardY = footerBlockY + offsetLine + 4;
  doc.setFillColor(16, 20, 23); // #101417
  doc.roundedRect(totalBoxX, totalCardY, totalBoxWidth, 14, 2, 2, 'F');
  
  // Left Accent Bar on total box
  doc.setFillColor(r, g, b);
  doc.rect(totalBoxX, totalCardY, 2.5, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL GERAL', totalBoxX + 6, totalCardY + 9);

  doc.setFontSize(11);
  doc.text(`R$ ${pedido.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 192, totalCardY + 9, { align: 'right' });

  // 6. Footer Thank you note
  const footerY = 275;

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(14, footerY - 8, 196, footerY - 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text(settings.mensagemRodape || 'Obrigado pela preferência!', 105, footerY - 3, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(156, 163, 175);
  doc.text(`Documento emitido por ${settings.nomeEmpresa || 'Print_3dbr'}. É um recibo de prestação de serviços de impressão 3D.`, 105, footerY + 2, { align: 'center' });

  // Filename format
  const cleanId = pedido.id.replace('#', '').trim();
  const cleanClienteName = pedido.cliente ? pedido.cliente.split(' ')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '') : 'Venda';
  const fileName = `Comprovante_${cleanId}_${cleanClienteName}.pdf`;

  doc.save(fileName);
}

