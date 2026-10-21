import React from 'react';
import { createRoot } from 'react-dom/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Pedido } from '../types';
import { getStoredSettings } from './settingsStorage';
import { getStatusConfig } from './statusUtils';
import { formatCompactDate } from './dateUtils';
import { DocumentoOrcamento } from '../components/DocumentoOrcamento';

export async function generatePedidoPDFFromElement(element: HTMLElement, pedido: Pedido): Promise<void> {
  try {
    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 850,
      onclone: (clonedDoc) => {
        const scripts = Array.from(clonedDoc.querySelectorAll('script'));
        scripts.forEach(s => s.remove());
        const clonedElement = clonedDoc.querySelector('[data-documento-orcamento="true"]') as HTMLElement;
        if (clonedElement) {
          clonedElement.style.width = '820px';
          clonedElement.style.maxWidth = '820px';
          clonedElement.style.minWidth = '820px';
          clonedElement.style.boxSizing = 'border-box';
        }
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
    const cleanClienteName = pedido.cliente 
      ? pedido.cliente.split(' ')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '') 
      : 'Venda';
    const fileName = `Orcamento_${cleanId}_${cleanClienteName}.pdf`;

    pdf.save(fileName);
  } catch (err) {
    console.warn('html2canvas error (fallback to vector PDF):', err);
    generatePedidoVectorPDF(pedido);
  }
}

export async function generatePedidoPDF(pedido: Pedido): Promise<void> {
  if (typeof document !== 'undefined') {
    // 1. Verifica se há um DocumentoOrcamento visível na tela (ex: modal ComprovanteView aberto)
    const existingElement = document.querySelector('[data-documento-orcamento="true"]') as HTMLElement;
    if (existingElement && existingElement.offsetHeight > 0) {
      await generatePedidoPDFFromElement(existingElement, pedido);
      return;
    }

    // 2. Renderização em container temporário ativo no DOM com coordenadas válidas para html2canvas
    const container = document.createElement('div');
    container.id = 'temp-pdf-render-root';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '820px';
    container.style.zIndex = '999999';
    container.style.pointerEvents = 'none';
    container.style.backgroundColor = '#ffffff';
    container.style.opacity = '0.01';
    document.body.appendChild(container);

    const root = createRoot(container);
    const settings = getStoredSettings();

    try {
      await new Promise<void>((resolve) => {
        root.render(
          React.createElement(DocumentoOrcamento, {
            pedido,
            settings
          })
        );
        setTimeout(resolve, 350);
      });

      const elementToCapture = (container.firstElementChild as HTMLElement) || container;
      await generatePedidoPDFFromElement(elementToCapture, pedido);
    } catch (err) {
      console.warn('Falha no renderizador DOM do PDF, executando fallback vetorial:', err);
      generatePedidoVectorPDF(pedido);
    } finally {
      try {
        root.unmount();
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      } catch {
        // cleanup safe
      }
    }
  } else {
    generatePedidoVectorPDF(pedido);
  }
}

export function generatePedidoVectorPDF(pedido: Pedido): void {
  const settings = getStoredSettings();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColorHex = settings.corPrincipal || '#0066ff';
  const nomeEmpresa = settings.nomeEmpresa?.trim() || 'Impressão 3D';

  const hexToRgb = (hex: string) => {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const [r, g, b] = hexToRgb(primaryColorHex);

  let currentY = 16;

  // 1. Logo ou Caixa de Marca
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
    // Elegant primary brand box
    doc.setFillColor(r, g, b);
    doc.roundedRect(14, currentY - 2, 18, 18, 2, 2, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(20, currentY + 4, 6, 6, 'F');
  }

  // Header Company Info
  const textX = (settings.logotipoUrl && settings.logotipoUrl.startsWith('data:image/')) ? 38 : 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(nomeEmpresa, textX, currentY + 5);

  if (settings.subtituloEmpresa) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(settings.subtituloEmpresa.toUpperCase(), textX, currentY + 11);
  }

  // Contacts right aligned
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  let rightY = currentY + 1;
  if (settings.whatsapp) {
    doc.text(`WhatsApp: ${settings.whatsapp}`, 196, rightY, { align: 'right' });
    rightY += 4.5;
  }
  if (settings.email) {
    doc.text(`E-mail: ${settings.email}`, 196, rightY, { align: 'right' });
    rightY += 4.5;
  }
  if (settings.instagram) {
    doc.text(`Instagram: ${settings.instagram}`, 196, rightY, { align: 'right' });
    rightY += 4.5;
  }

  currentY += 20;

  // Linha divisória de cabeçalho
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(14, currentY, 196, currentY);

  currentY += 8;

  // 2. Document Title & Order Number
  const statusCfg = getStatusConfig(pedido.status || 'na_fila');
  const isPendente = (pedido.status || 'na_fila') === 'pendente';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('DOCUMENTO DE ATENDIMENTO', 14, currentY);

  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(isPendente ? 'ORÇAMENTO' : 'COMPROVANTE DE PEDIDO', 14, currentY + 6);

  // Badges isolados para Nº Pedido e Emissão (garante zero sobreposição)
  const metaY = currentY - 2;
  const cardH = 13;

  // Card 1: Nº Pedido / Orçamento
  const box1X = 124;
  const box1W = 35;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(box1X, metaY, box1W, cardH, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(box1X, metaY, box1W, cardH, 1.5, 1.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(isPendente ? 'Nº ORÇAMENTO' : 'Nº PEDIDO', box1X + box1W / 2, metaY + 4.5, { align: 'center' });

  // Auto-escala para o ID do pedido se for longo
  let idFontSize = 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(idFontSize);
  while (doc.getTextWidth(pedido.id) > (box1W - 4) && idFontSize > 5.5) {
    idFontSize -= 0.5;
    doc.setFontSize(idFontSize);
  }
  doc.setTextColor(15, 23, 42);
  doc.text(pedido.id, box1X + box1W / 2, metaY + 9.5, { align: 'center' });

  // Card 2: Emissão (com largura adequada e auto-escala para jamais ultrapassar a borda)
  const box2X = 162;
  const box2W = 34;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(box2X, metaY, box2W, cardH, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(box2X, metaY, box2W, cardH, 1.5, 1.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('EMISSÃO', box2X + box2W / 2, metaY + 4.5, { align: 'center' });

  const displayDate = formatCompactDate(pedido.data);
  let dateFontSize = 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(dateFontSize);
  const maxAllowedDateWidth = box2W - 4; // 2mm de margem de segurança de cada lado
  while (doc.getTextWidth(displayDate) > maxAllowedDateWidth && dateFontSize > 5) {
    dateFontSize -= 0.5;
    doc.setFontSize(dateFontSize);
  }
  doc.setTextColor(51, 65, 85);
  doc.text(displayDate, box2X + box2W / 2, metaY + 9.5, { align: 'center' });

  currentY += 15;

  // 3. Customer & Status Info Box (2 side-by-side cards)
  const cardWidth = 88;
  const cardHeight = 22;

  // Card 1: Cliente
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, currentY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, currentY, cardWidth, cardHeight, 2, 2, 'D');

  // Accent Bar
  doc.setFillColor(r, g, b);
  doc.rect(14, currentY, 1.8, cardHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CLIENTE', 19, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(pedido.cliente || 'Cliente não identificado', 19, currentY + 12);

  if (pedido.telefone) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Telefone: ${pedido.telefone}`, 19, currentY + 17.5);
  }

  // Card 2: Status
  const card2X = 108;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('SITUAÇÃO DO PEDIDO', card2X + 5, currentY + 5.5);

  // Status Badge box
  if (isPendente) {
    doc.setFillColor(254, 252, 232); // amber-50
    doc.setDrawColor(254, 240, 138); // amber-200
    doc.roundedRect(card2X + 5, currentY + 8, cardWidth - 10, 7, 1.5, 1.5, 'FD');
    doc.setFillColor(234, 179, 8); // amber-500
    doc.circle(card2X + 9, currentY + 11.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(133, 77, 14); // amber-800
    doc.text(statusCfg.label.toUpperCase(), card2X + 13, currentY + 12.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Validade: 10 dias após emissão', card2X + 5, currentY + 19);
  } else {
    doc.setFillColor(240, 253, 244); // emerald-50
    doc.setDrawColor(187, 247, 208); // emerald-200
    doc.roundedRect(card2X + 5, currentY + 8, cardWidth - 10, 7, 1.5, 1.5, 'FD');
    doc.setFillColor(34, 197, 94); // emerald-500
    doc.circle(card2X + 9, currentY + 11.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(22, 101, 52); // emerald-800
    doc.text(statusCfg.label.toUpperCase(), card2X + 13, currentY + 12.2);
  }

  currentY += 28;

  // 4. Products Table com coluna dedicada e ampla para FOTO (evita sobreposição com o nome do produto!)
  const tableHead = [['#', 'FOTO', 'PRODUTO / SERVIÇO', 'QTD.', 'VALOR UNIT.', 'TOTAL']];
  
  const tableBody = pedido.itens.map((item, idx) => [
    String(idx + 1).padStart(2, '0'),
    '', // Célula exclusiva para renderização da imagem
    item.descricao || 'Item sem descrição',
    `${item.qtd} un`,
    `R$ ${item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `R$ ${(item.qtd * item.valorUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  ]);

  const imageDimension = 26; // 26mm x 26mm (imagem ampla, nítida e destacada)

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42], // slate-900 header
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: 3.5
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', textColor: [100, 116, 139], fontStyle: 'bold' },
      1: { cellWidth: 34, halign: 'center', minCellHeight: 32 },
      2: { cellWidth: 'auto', halign: 'left', fontStyle: 'bold' },
      3: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [15, 23, 42],
      minCellHeight: 32,
      cellPadding: 3.5,
      valign: 'middle'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawCell: (data) => {
      // Desenha imagem exclusivamente na coluna 1 (FOTO) - garantindo isolamento total do nome do produto
      if (data.section === 'body' && data.column.index === 1) {
        const item = pedido.itens[data.row.index];
        if (item && item.imagemUrl) {
          try {
            const imgX = data.cell.x + (data.cell.width - imageDimension) / 2;
            const imgY = data.cell.y + (data.cell.height - imageDimension) / 2;
            
            // Moldura da imagem
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(imgX - 0.5, imgY - 0.5, imageDimension + 1, imageDimension + 1, 1, 1, 'FD');
            doc.addImage(item.imagemUrl, 'JPEG', imgX, imgY, imageDimension, imageDimension);
          } catch {
            // fallback
          }
        } else {
          // Placeholder limpo
          const iconX = data.cell.x + data.cell.width / 2;
          const iconY = data.cell.y + data.cell.height / 2;
          doc.setFillColor(241, 245, 249);
          doc.circle(iconX, iconY, 6, 'F');
          doc.setFontSize(6.5);
          doc.setTextColor(148, 163, 184);
          doc.text('Sem Foto', iconX, iconY + 2, { align: 'center' });
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
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const paymentTitle = `PAGAMENTO VIA ${(pedido.metodoPagamento || 'PIX').toUpperCase()}`;
  doc.text(paymentTitle, 14, footerBlockY + 4);

  const chavePix = settings.chavePix || settings.whatsapp || settings.email || '';

  if (pedido.metodoPagamento === 'pix' || !pedido.metodoPagamento) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Chave PIX:', 14, footerBlockY + 10);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(chavePix || 'A combinar com o vendedor', 14, footerBlockY + 15);

    if (chavePix && nomeEmpresa) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Beneficiário: ${nomeEmpresa}`, 14, footerBlockY + 20);
    }
  }

  // Observações Reais
  const obsText = pedido.observacoes || settings.observacoesPadrao || '';
  if (obsText) {
    const obsStartY = footerBlockY + 27;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('OBSERVAÇÕES', 14, obsStartY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const splitObs = doc.splitTextToSize(obsText, 98);
    doc.text(splitObs, 14, obsStartY + 5);
  }

  // Right column: Financial Summary
  const totalBoxX = 124;
  const totalBoxWidth = 72;
  const subtotalItens = pedido.itens.reduce((acc, item) => acc + (item.qtd * item.valorUnitario), 0);
  const totalQtdItens = pedido.itens.reduce((acc, item) => acc + (Number(item.qtd) || 0), 0);
  const temDesconto = typeof pedido.desconto === 'number' && pedido.desconto > 0;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('RESUMO FINANCEIRO', totalBoxX, footerBlockY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Subtotal (${totalQtdItens} un)`, totalBoxX, footerBlockY + 10);

  doc.setTextColor(15, 23, 42);
  doc.text(`R$ ${subtotalItens.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 196, footerBlockY + 10, { align: 'right' });

  let offsetLine = 15;
  if (temDesconto) {
    doc.setTextColor(16, 185, 129);
    const pctLabel = pedido.descontoPercentual ? ` (${pedido.descontoPercentual}%)` : '';
    doc.text(`Desconto${pctLabel}`, totalBoxX, footerBlockY + offsetLine);
    doc.text(`- R$ ${(pedido.desconto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 196, footerBlockY + offsetLine, { align: 'right' });
    offsetLine += 5;
  }

  // Dark Total Box
  const totalCardY = footerBlockY + offsetLine + 2;
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(totalBoxX, totalCardY, totalBoxWidth, 16, 2, 2, 'F');

  // Left Accent Bar on total box
  doc.setFillColor(r, g, b);
  doc.rect(totalBoxX, totalCardY, 2, 16, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('TOTAL GERAL', totalBoxX + 5, totalCardY + 6);
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text((pedido.metodoPagamento || 'PIX').toUpperCase(), totalBoxX + 5, totalCardY + 11.5);

  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(`R$ ${pedido.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 192, totalCardY + 10.5, { align: 'right' });

  // 6. Footer Note
  const footerY = 280;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, footerY - 5, 196, footerY - 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(settings.mensagemRodape || 'Agradecemos a preferência!', 105, footerY - 1, { align: 'center' });

  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Documento emitido eletronicamente por ${nomeEmpresa}`, 105, footerY + 3.5, { align: 'center' });

  // Filename format
  const cleanId = pedido.id.replace('#', '').trim();
  const cleanClienteName = pedido.cliente 
    ? pedido.cliente.split(' ')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '') 
    : 'Venda';
  const fileName = `Orcamento_${cleanId}_${cleanClienteName}.pdf`;

  doc.save(fileName);
}
