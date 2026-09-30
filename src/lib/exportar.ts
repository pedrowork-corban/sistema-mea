/**
 * Rasteriza o elemento em PNG de alta resolução.
 * O embed das fontes do Google pode falhar por rede/CORS; nesse caso repete sem
 * embutir as fontes, que ainda sai correto porque a fonte já está no navegador.
 *
 * As bibliotecas entram por import dinâmico: só pesam quando alguém exporta.
 */
async function paraPng(el: HTMLElement): Promise<string> {
  const { toPng } = await import("html-to-image");
  const opcoes = { pixelRatio: 3, cacheBust: true };
  try {
    return await toPng(el, opcoes);
  } catch {
    return await toPng(el, { ...opcoes, skipFonts: true });
  }
}

function nomeSeguro(nome: string) {
  return (
    nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "proposta"
  );
}

function baixar(href: string, nome: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = nome;
  a.click();
}

export async function baixarPng(el: HTMLElement, nome: string) {
  baixar(await paraPng(el), `${nomeSeguro(nome)}.png`);
}

export async function baixarPdf(el: HTMLElement, nome: string) {
  const [{ default: jsPDF }, dataUrl] = await Promise.all([import("jspdf"), paraPng(el)]);
  const largura = el.offsetWidth;
  const altura = el.offsetHeight;

  const pdf = new jsPDF({
    unit: "px",
    format: [largura, altura],
    orientation: altura >= largura ? "portrait" : "landscape",
    compress: true,
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, largura, altura, undefined, "FAST");
  pdf.save(`${nomeSeguro(nome)}.pdf`);
}

/**
 * Copia a imagem para a área de transferência. Nem todo navegador suporta, e
 * mesmo onde suporta a permissão pode ser negada — daí o false em vez de erro.
 */
export async function copiarImagem(el: HTMLElement): Promise<boolean> {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") return false;
  const dataUrl = await paraPng(el);
  const blob = await (await fetch(dataUrl)).blob();
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

export async function copiarTexto(texto: string): Promise<boolean> {
  if (!navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
