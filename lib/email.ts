// © Rayssa Paiva · Todos os direitos reservados
// Envio de e-mail pelo Resend (plano gratuito: 3.000 e-mails/mês).
// Sem RESEND_API_KEY a verificação em duas etapas fica desligada e o login segue só com senha.

export const emailConfigurado = () => !!process.env.RESEND_API_KEY && process.env.DOIS_FATORES !== 'desligado';

export async function enviarEmail(para: string, assunto: string, html: string, texto: string) {
  const base = (process.env.RESEND_API_URL || 'https://api.resend.com').replace(/\/$/, '');
  const de = process.env.EMAIL_FROM || 'Aprendiz+ <acesso@aprendizplus.com.br>';
  const r = await fetch(`${base}/emails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: de, to: [para], subject: assunto, html, text: texto }),
  });
  if (!r.ok) {
    const det = await r.text().catch(() => '');
    console.error('email', r.status, det.slice(0, 300));
    throw new Error('Falha ao enviar e-mail.');
  }
}

export function emailCodigo(nome: string, codigo: string) {
  const primeiro = nome.split(' ')[0];
  const texto = `Olá, ${primeiro}!\n\nSeu código de acesso ao Aprendiz+ é ${codigo}.\nEle vale por 10 minutos.\n\nSe não foi você que tentou entrar, troque sua senha.\n\n© Rayssa Paiva · Aprendiz+`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f7fc;font-family:Montserrat,Arial,sans-serif;color:#0b1a34">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#fff;border:1px solid #dae1ed;border-radius:18px;padding:32px">
<tr><td style="font-size:22px;font-weight:800">Aprendiz<span style="color:#F7941D">+</span></td></tr>
<tr><td style="padding-top:20px;font-size:15px">Olá, ${primeiro.replace(/[<>&"]/g, '')}! Use este código para entrar:</td></tr>
<tr><td align="center" style="padding:24px 0"><div style="display:inline-block;background:#0a2350;color:#fff;font-size:34px;font-weight:800;letter-spacing:10px;padding:14px 24px;border-radius:12px">${codigo}</div></td></tr>
<tr><td style="font-size:13px;color:#4e5e7a">O código vale por 10 minutos. Se não foi você que tentou entrar, troque sua senha.</td></tr>
<tr><td style="padding-top:24px;font-size:11px;color:#9aa6bd">© Rayssa Paiva · Todos os direitos reservados</td></tr>
</table></td></tr></table></body></html>`;
  return { html, texto };
}

export const mascararEmail = (e: string) => {
  const [u, d] = e.split('@');
  return (u.length <= 2 ? u[0] + '*' : u.slice(0, 2) + '*'.repeat(Math.min(6, u.length - 2))) + '@' + d;
};
