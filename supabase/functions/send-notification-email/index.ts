/**
 * SplitFlow — Supabase Edge Function: send-notification-email (Deno + Nodemailer)
 * 
 * Envío de notificaciones transaccionales por correo electrónico mediante servidor SMTP propio
 * de Google (Gmail) con la cuenta oficial SplitflowNoReplay@gmail.com y la librería 'nodemailer'.
 * 100% gratuito y sin dependencia de servicios de terceros como Resend o SendGrid.
 * 
 * Variables de entorno requeridas en Supabase Secrets:
 * - SMTP_HOST: smtp.gmail.com (por defecto)
 * - SMTP_PORT: 587 (por defecto)
 * - SMTP_USER: SplitflowNoReplay@gmail.com
 * - SMTP_PASS: Contraseña de aplicación generada en la cuenta de Google
 * - SMTP_FROM: SplitflowNoReplay@gmail.com
 */

// Declaración ambiental para el runtime de Deno en Supabase Edge Functions
declare const Deno: any;
import nodemailer from "npm:nodemailer@6.9.16";

// Cabeceras CORS para permitir invocaciones seguras desde el frontend web y móvil
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EmailAttachmentPayload {
  filename: string;
  contentBase64: string;
  contentType?: string;
}

interface NotificationEmailPayload {
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  message: string;
  title?: string;
  action_url?: string;
  action_label?: string;
  reply_to?: string;
  is_internal_report?: boolean;
  attachments?: EmailAttachmentPayload[];
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Plantilla HTML adaptada a la identidad corporativa de SplitFlow (Minimalista, Slate/Indigo, Stripe-like)
function generateSplitFlowEmailHtml(payload: NotificationEmailPayload): string {
  const currentYear = new Date().getFullYear();
  const headingTitle = escapeHtml(payload.title || payload.subject);
  const greeting = payload.recipient_name
    ? `Hola, ${escapeHtml(payload.recipient_name)}:`
    : 'Hola:';
  const badgeText = payload.is_internal_report ? 'Reporte Técnico' : 'Notificación';
  const footerPrimary = payload.is_internal_report
    ? 'Reporte de incidencia enviado desde el módulo interno de soporte de SplitFlow.'
    : 'Has recibido esta notificación porque tienes activados los avisos por correo en tu perfil de SplitFlow.';
  const subNote = payload.is_internal_report
    ? 'Los archivos multimedia adjuntos (imágenes o vídeos) se incluyen directamente en este mensaje para facilitar la reproducción del bug.'
    : 'Las cuentas y balances del grupo se actualizan en tiempo real con el motor inteligente de minimización de deudas de SplitFlow.';
  const ctaLabel = escapeHtml(payload.action_label || 'Abrir en SplitFlow →');
  const safeActionUrl = payload.action_url ? payload.action_url.replace(/&/g, '&amp;') : '';
  const ctaButtonHtml = payload.action_url
    ? `
      <div style="margin: 28px 0 16px 0; text-align: left;">
        <a href="${safeActionUrl}" 
           style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 13px; font-weight: 600; display: inline-block; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          ${ctaLabel}
        </a>
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(payload.subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Encabezado / Logo SplitFlow -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display: inline-block; background-color: #0f172a; border-radius: 8px; padding: 8px 12px; color: #ffffff; font-weight: 700; font-size: 14px; letter-spacing: -0.3px;">
                      SplitFlow
                    </div>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">
                      ${badgeText}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenido Principal -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                ${headingTitle}
              </h1>

              <p style="margin: 0 0 16px 0; font-size: 13px; color: #475569; line-height: 1.6;">
                ${greeting}
              </p>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 16px 0 20px 0;">
                <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.6; white-space: pre-line;">
                  ${escapeHtml(payload.message)}
                </p>
              </div>

              ${ctaButtonHtml}

              <p style="margin: 24px 0 0 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                ${subNote}
              </p>
            </td>
          </tr>

          <!-- Pie de Página -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b;">
                ${footerPrimary}
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${currentYear} SplitFlow &bull; SplitflowNoReplay@gmail.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// Servidor Deno HTTP para la Edge Function
Deno.serve(async (req: Request) => {
  // 1. Manejo de peticiones preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. Solo permitir método POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido. Utiliza POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 3. Validación de autenticación (requiere Bearer token o apikey de Supabase)
    const authHeader = req.headers.get('Authorization') || req.headers.get('apikey');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado: Falta cabecera de autenticación.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Parseo y validación del payload
    const body: NotificationEmailPayload = await req.json();
    const {
      recipient_email,
      subject,
      message,
      title,
      action_url,
      action_label,
      recipient_name,
      reply_to,
      is_internal_report,
      attachments,
    } = body;

    if (!recipient_email || typeof recipient_email !== 'string' || !recipient_email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'El campo recipient_email es obligatorio y debe ser un correo válido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subject || !message) {
      return new Response(
        JSON.stringify({ error: 'Los campos subject y message son obligatorios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar adjuntos seguros si vienen incluidos (ej. capturas o vídeos de reportes)
    const nodemailerAttachments = Array.isArray(attachments)
      ? attachments
          .filter(
            (att) =>
              att &&
              typeof att.filename === 'string' &&
              att.filename.trim().length > 0 &&
              typeof att.contentBase64 === 'string' &&
              att.contentBase64.trim().length > 0
          )
          .slice(0, 5)
          .map((att) => ({
            filename: att.filename.replace(/[/\\?%*:|"<>]/g, '_'),
            content: att.contentBase64.replace(/^data:[^;]+;base64,/, ''),
            encoding: 'base64' as const,
            contentType: att.contentType || 'application/octet-stream',
          }))
      : undefined;

    // 5. Configuración de credenciales SMTP de Gmail
    const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com';
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587', 10);
    const smtpUser = Deno.env.get('SMTP_USER') || 'SplitflowNoReplay@gmail.com';
    const rawPass = Deno.env.get('SMTP_PASS') || 'gxli mpzc hbce lhqf';
    const smtpPass = rawPass ? rawPass.replace(/\s+/g, '') : '';
    const smtpFrom = Deno.env.get('SMTP_FROM') || 'SplitflowNoReplay@gmail.com';

    const fromAddress = `"SplitFlow" <${smtpFrom}>`;

    // Modo Simulado: Si aún no se ha configurado la contraseña de aplicación (SMTP_PASS) en Supabase Secrets,
    // responder éxito simulado sin romper el flujo de la aplicación
    if (!smtpPass) {
      console.info(
        `[send-notification-email] [MODO SIMULADO] SMTP_PASS no configurada. Destinatario: ${recipient_email} | Asunto: "${subject}" | Adjuntos: ${nodemailerAttachments?.length || 0}`
      );
      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: 'Notificación simulada con éxito (falta configurar SMTP_PASS en Supabase secrets con la contraseña de aplicación de Google).',
          recipient: recipient_email,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Creación del transporte SMTP con nodemailer
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true para puerto 465 (SSL), false para 587 (STARTTLS)
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // 7. Generación del HTML corporativo y envío del correo
    const emailHtml = generateSplitFlowEmailHtml({
      recipient_email,
      recipient_name,
      subject,
      title: title || subject,
      message,
      action_url: is_internal_report ? undefined : action_url,
      action_label,
      is_internal_report,
    });

    const cleanReplyTo =
      reply_to && typeof reply_to === 'string' && reply_to.includes('@') ? reply_to.trim() : undefined;

    const sendResult = await transporter.sendMail({
      from: fromAddress,
      to: recipient_email,
      ...(cleanReplyTo ? { replyTo: cleanReplyTo } : {}),
      subject: subject,
      text: message,
      html: emailHtml,
      ...(nodemailerAttachments && nodemailerAttachments.length > 0
        ? { attachments: nodemailerAttachments }
        : {}),
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: sendResult.messageId,
        recipient: recipient_email,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error al enviar el correo mediante SMTP.';
    console.error('[send-notification-email] Error en transporte SMTP:', err);
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
