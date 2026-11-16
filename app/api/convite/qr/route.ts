// © Rayssa Paiva · Todos os direitos reservados
// QR code (SVG) do link de convite, só para a instrutora da turma.
import QRCode from 'qrcode';
import { db } from '@/lib/db';
import { erro, sessao } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const s = await sessao();
  if (!s || s.papel !== 'prof') return erro('Sessão expirada.', 401);
  const u = new URL(req.url);
  const turma = u.searchParams.get('turma') || '';
  const [c] = await db()`select c.token from convites c join turmas t on t.id = c.turma_id where c.turma_id = ${turma} and t.instrutor_id = ${s.id}`;
  if (!c) return erro('Convite não encontrado.', 404);
  const link = `${u.origin}/?convite=${c.token}`;
  const svg = await QRCode.toString(link, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#0a2350', light: '#ffffff' } });
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } });
}
