export interface CompressImageOptions {
  maxDim?: number;   // Padrão: 800 para itens, 256 para logotipo
  maxBytes?: number; // Padrão: 150 KB (153.600 bytes) para itens, 100 KB (102.400 bytes) para logotipo
}

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Calcula o tamanho real em bytes a partir de uma Data URL (base64).
 */
export function getDataUrlSizeBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const base64Data = dataUrl.substring(commaIdx + 1);
  const padding = base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.round((base64Data.length * 3) / 4) - padding);
}

/**
 * Comprime e redimensiona uma imagem utilizando Canvas 2D.
 * - Rejeita formatos não suportados e arquivos maiores que 10 MB.
 * - Redimensiona proporcionalmente para maxDim.
 * - Converte para JPEG e reduz a qualidade em passos (0.85, 0.75, 0.65, 0.55).
 * - Lança Error em português se não atingir o limite estipulado.
 */
export async function compressImage(
  file: File,
  opts?: CompressImageOptions
): Promise<string> {
  if (!file) {
    throw new Error('Nenhum arquivo de imagem foi fornecido.');
  }

  // 1. Validação de formato (apenas image/png, image/jpeg, image/webp)
  if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    throw new Error('Formato de arquivo não suportado. Utilize imagens no formato PNG, JPEG ou WebP.');
  }

  // 2. Validação de tamanho máximo de entrada (10 MB)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('O arquivo selecionado é muito grande. O limite máximo é de 10 MB.');
  }

  const maxDim = opts?.maxDim ?? 800;
  const maxBytes = opts?.maxBytes ?? 150 * 1024; // 150 KB padrão

  // 3. Leitura do arquivo para Data URL
  const originalDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo de imagem. Tente novamente.'));
    reader.readAsDataURL(file);
  });

  // 4. Carregamento no elemento Image
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível decodificar o arquivo de imagem. Verifique se o arquivo não está corrompido.'));
    image.src = originalDataUrl;
  });

  // 5. Cálculo das dimensões proporcionais limitadas a maxDim
  let width = img.width;
  let height = img.height;

  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  width = Math.max(1, width);
  height = Math.max(1, height);

  // 6. Desenho no canvas com fundo branco para conversão limpa em JPEG
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Falha ao inicializar o processador gráfico do navegador.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // 7. Compressão progressiva em passos de qualidade estritos
  const qualitySteps = [0.85, 0.75, 0.65, 0.55];
  let finalDataUrl: string | null = null;

  for (const quality of qualitySteps) {
    const candidate = canvas.toDataURL('image/jpeg', quality);
    const candidateBytes = getDataUrlSizeBytes(candidate);

    if (candidateBytes <= maxBytes) {
      finalDataUrl = candidate;
      break;
    }
  }

  // 8. Se ainda ultrapassar o limite com 0.55, lança erro com mensagem amigável em português
  if (!finalDataUrl) {
    const maxKb = Math.round(maxBytes / 1024);
    throw new Error(`A imagem não pôde ser comprimida abaixo do limite de ${maxKb} KB. Por favor, envie uma imagem de menor resolução.`);
  }

  return finalDataUrl;
}
