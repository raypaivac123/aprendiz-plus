// © Rayssa Paiva · Todos os direitos reservados
// Foto de perfil: chega já reduzida pelo navegador (JPEG/PNG/WebP em data URL, até ~150 KB).
const TIPOS = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
export const MAX_FOTO = 200_000; // caracteres da data URL

export function fotoValida(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > MAX_FOTO || !TIPOS.test(v)) return null;
  return v;
}
export const textoSobre = (v: unknown) => String(v ?? '').replace(/\r/g, '').trim().slice(0, 500);
