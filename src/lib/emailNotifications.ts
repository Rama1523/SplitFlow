/**
 * SplitFlow — Email Notification Service
 * Capa de integración en cliente para invocar la Supabase Edge Function 'send-notification-email'
 * y despachar avisos por correo transaccional (Resend) ante eventos clave:
 * 1. Nuevos gastos añadidos y repartos calculados.
 * 2. Transacciones de liquidación de deudas entre usuarios.
 * 3. Notificaciones de invitación a grupos.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { User, Expense, SettlementTransaction, Group } from '../types';

export interface EmailAttachmentPayload {
  filename: string;
  contentBase64: string;
  contentType: string;
}

export interface NotificationEmailPayload {
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

/**
 * Invoca la Edge Function 'send-notification-email' en Supabase.
 * En modo local o si no está configurada, simula el envío sin interrumpir la experiencia.
 */
export async function sendNotificationEmail(
  payload: NotificationEmailPayload
): Promise<{ success: boolean; simulated?: boolean; error?: string }> {
  const cleanEmail = (payload.recipient_email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Correo de destinatario no válido' };
  }

  const payloadToSend: NotificationEmailPayload = {
    ...payload,
    recipient_email: cleanEmail,
    action_url: payload.is_internal_report
      ? undefined
      : payload.action_url || (typeof window !== 'undefined' ? window.location.origin : undefined),
  };

  // 1. Invocación a través de Supabase Edge Functions
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('send-notification-email', {
        body: payloadToSend,
      });

      if (error) {
        console.warn('[emailNotifications] Aviso Edge Function:', error.message);
        let userFriendlyError = error.message;
        if (
          error.message.includes('Failed to send a request') ||
          error.message.includes('not found') ||
          error.message.includes('404')
        ) {
          userFriendlyError =
            'La función "send-notification-email" aún no ha sido creada/desplegada en tu panel de Supabase (Edge Functions). Créala en el panel para habilitar el envío automático.';
        }
        return { success: false, error: userFriendlyError };
      }

      return {
        success: true,
        simulated: data?.simulated || false,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con la Edge Function';
      console.warn('[emailNotifications] Excepción al invocar función:', msg);
      return { success: false, error: msg };
    }
  }

  // 2. Modo Local / Simulado (Desarrollo sin Supabase activo)
  if (typeof window !== 'undefined' && !payload.is_internal_report) {
    console.info(
      `%c[SplitFlow Email]%c Envío a ${cleanEmail} | Asunto: "${payload.subject}"`,
      'background: #0f172a; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
      'color: #0284c7; font-weight: 500;'
    );
  }

  return { success: true, simulated: true };
}

/**
 * Dispara notificaciones por correo a los miembros involucrados en un nuevo gasto,
 * respetando sus preferencias individuales (emailNotifications).
 */
export async function notifyExpenseAdded(params: {
  expense: Expense;
  payer: User;
  group?: Group;
  allMembers: User[];
  formatCurrency?: (val: number) => string;
}): Promise<void> {
  const { expense, payer, group, allMembers, formatCurrency } = params;
  const groupName = group?.name || 'tu grupo';
  const currencySymbol = group?.currency || 'EUR';
  const formatAmount = formatCurrency || ((val: number) => `${val.toFixed(2)} ${currencySymbol}`);

  // Recorrer los splits para notificar a cada usuario involucrado (excluyendo al que pagó)
  for (const split of expense.splits) {
    if (split.userId === payer.id) continue;

    const recipient = allMembers.find((m) => m.id === split.userId);
    if (!recipient || !recipient.email) continue;

    // Verificar si el destinatario tiene activadas las notificaciones por correo
    if (recipient.emailNotifications === false) {
      continue;
    }

    const payerName = payer.name || (payer.username ? `@${payer.username}` : 'Un compañero');
    const totalAmountStr = formatAmount(expense.amount);
    const splitAmountStr = formatAmount(split.amount);

    const title = `Nuevo gasto registrado en ${groupName}`;
    const subject = `[SplitFlow] ${payerName} añadió un gasto: ${expense.description} (${totalAmountStr})`;
    const message = `${payerName} ha añadido un nuevo gasto compartido en el grupo "${groupName}".\n\n` +
      `• Concepto: ${expense.description}\n` +
      `• Monto Total: ${totalAmountStr}\n` +
      `• Tu parte a pagar: ${splitAmountStr}\n` +
      (expense.notes ? `• Notas: ${expense.notes}\n` : '');

    // Despachar en segundo plano sin bloquear la UI
    sendNotificationEmail({
      recipient_email: recipient.email,
      recipient_name: recipient.name,
      subject,
      title,
      message,
    }).catch((err) => console.warn('Error al notificar nuevo gasto:', err));
  }
}

/**
 * Dispara notificación al receptor de una liquidación o pago de deuda registrado.
 */
export async function notifySettlementRecorded(params: {
  settlement: SettlementTransaction;
  payer: User;
  receiver: User;
  groupName?: string;
  formatCurrency?: (val: number) => string;
}): Promise<void> {
  const { settlement, payer, receiver, groupName = 'tu grupo', formatCurrency } = params;

  if (!receiver.email || receiver.emailNotifications === false) {
    return;
  }

  const formatAmount = formatCurrency || ((val: number) => `${val.toFixed(2)} ${settlement.currency || 'EUR'}`);
  const amountStr = formatAmount(settlement.amount);
  const payerName = payer.name || (payer.username ? `@${payer.username}` : 'Un compañero');
  const method = settlement.paymentMethod ? `mediante ${settlement.paymentMethod}` : '';

  const title = `Liquidación de deuda registrada en ${groupName}`;
  const subject = `[SplitFlow] ${payerName} ha registrado un pago de ${amountStr}`;
  const message = `${payerName} ha registrado una transferencia / liquidación de ${amountStr} ${method} en el grupo "${groupName}".\n\n` +
    `Tu balance pendiente ha sido reducido en la aplicación. Entra en SplitFlow para comprobar tus saldos actualizados.`;

  sendNotificationEmail({
    recipient_email: receiver.email,
    recipient_name: receiver.name,
    subject,
    title,
    message,
  }).catch((err) => console.warn('Error al notificar liquidación:', err));
}

/**
 * Dispara notificación por correo ante una nueva invitación enviada a un usuario.
 */
export async function notifyGroupInvitation(params: {
  sender: User;
  recipientEmail: string;
  recipientName?: string;
  groupName: string;
  inviteCode?: string;
}): Promise<void> {
  const { sender, recipientEmail, recipientName, groupName, inviteCode } = params;

  if (!recipientEmail || !recipientEmail.includes('@')) {
    return;
  }

  const senderName = sender.name || (sender.username ? `@${sender.username}` : 'Un compañero');
  const title = `Invitación al grupo "${groupName}"`;
  const subject = `[SplitFlow] ${senderName} te ha invitado a unirte a "${groupName}"`;
  const message = `${senderName} te ha invitado a formar parte del grupo de gastos "${groupName}" en SplitFlow.\n\n` +
    (inviteCode ? `• Código de acceso rápido: ${inviteCode}\n\n` : '') +
    `Inicia sesión con tu usuario o regístrate para revisar los balances compartidos y gestionar las cuentas juntos.`;

  sendNotificationEmail({
    recipient_email: recipientEmail,
    recipient_name: recipientName,
    subject,
    title,
    message,
  }).catch((err) => console.warn('Error al notificar invitación por email:', err));
}

/**
 * Dispara notificación por correo cuando un usuario es designado como nuevo administrador de un grupo.
 */
export async function notifyAdminPromoted(params: {
  newAdmin: User;
  groupName: string;
  previousAdminName?: string;
  isAutomaticReassignment?: boolean;
}): Promise<void> {
  const { newAdmin, groupName, previousAdminName, isAutomaticReassignment } = params;

  if (!newAdmin.email || newAdmin.emailNotifications === false) {
    return;
  }

  const subject = `¡Has sido designado como el nuevo administrador del grupo ${groupName}!`;
  const title = `Nuevo Administrador en ${groupName}`;
  
  const reasonText = isAutomaticReassignment
    ? `Debido a la salida del administrador anterior del grupo "${groupName}", el sistema te ha reasignado automáticamente como el nuevo administrador.`
    : previousAdminName
    ? `${previousAdminName} te ha transferido el cargo de administrador del grupo "${groupName}".`
    : `Has sido nombrado administrador del grupo "${groupName}".`;

  const message = `¡Hola, ${newAdmin.name || newAdmin.username || 'compañero'}!\n\n` +
    `${reasonText}\n\n` +
    `Como administrador del grupo, ahora tienes permisos exclusivos para:\n` +
    `• Visualizar y compartir el código único de invitación del grupo.\n` +
    `• Gestionar miembros, añadir integrantes y transferir el rol de administrador.\n` +
    `• Configurar los límites de presupuesto y módulos de ingresos.\n\n` +
    `Accede a SplitFlow para gestionar el grupo.`;

  sendNotificationEmail({
    recipient_email: newAdmin.email,
    recipient_name: newAdmin.name,
    subject,
    title,
    message,
  }).catch((err) => console.warn('Error al notificar ascenso a administrador por email:', err));
}

/**
 * Dispara correo de confirmación de cuenta y bienvenida tras el registro,
 * utilizando el cliente de correo oficial SplitflowNoReplay (Edge Function SMTP).
 */
export async function notifyAccountRegistrationConfirmation(user: User): Promise<boolean> {
  if (!user.email || !user.email.includes('@')) {
    return false;
  }

  const displayName = user.name || (user.username ? `@${user.username}` : 'Usuario');
  const usernameTag = user.username ? `@${user.username}` : user.name;
  const subject = `¡Bienvenido a SplitFlow! Confirmación de cuenta de ${usernameTag}`;
  const title = `Tu cuenta en SplitFlow ha sido confirmada`;
  const message = `¡Hola, ${displayName}!\n\n` +
    `Te confirmamos que tu cuenta en SplitFlow ha sido creada y verificada exitosamente con el correo ${user.email}.\n\n` +
    `Tu nombre de usuario para iniciar sesión es @${user.username || user.name}.\n\n` +
    `A partir de este momento puedes acceder a la aplicación para:\n` +
    `• Crear y unirte a grupos para compartir gastos del hogar, viajes y eventos.\n` +
    `• Registrar pagos y dejar que el algoritmo inteligente de minimización simplifique las deudas.\n` +
    `• Definir presupuestos mensuales por categorías y repartir equitativamente o por ingresos.\n\n` +
    `¡Esperamos que disfrutes de una gestión de gastos compartidos clara, justa y sin complicaciones!`;

  try {
    const res = await sendNotificationEmail({
      recipient_email: user.email,
      recipient_name: user.name,
      subject,
      title,
      message,
    });
    return res.success;
  } catch (err) {
    console.warn('Error al enviar confirmación de registro:', err);
    return false;
  }
}

/**
 * Envía el correo oficial de verificación de propiedad del email desde SplitflowNoReplay@gmail.com
 * con un enlace único de activación antes de permitir el inicio de sesión.
 */
export async function sendAccountVerificationEmail(params: {
  email: string;
  name?: string;
  username?: string;
  verificationUrl: string;
}): Promise<{ success: boolean; simulated?: boolean; error?: string }> {
  const cleanEmail = (params.email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Correo electrónico de destinatario no válido.' };
  }

  const displayName = (params.name || params.username || cleanEmail.split('@')[0]).trim();
  const usernameLine = params.username ? ` (@${params.username})` : '';
  const subject = `[SplitFlow] Verifica tu correo electrónico para activar tu cuenta`;
  const title = `Confirma tu dirección de correo en SplitFlow`;
  const message =
    `¡Hola, ${displayName}${usernameLine}!\n\n` +
    `Gracias por registrarte en SplitFlow. Para garantizar que tienes acceso real a esta dirección (${cleanEmail}) y activar tu cuenta, debes confirmar tu correo haciendo clic en el botón inferior.\n\n` +
    `Una vez confirmada, podrás volver a la pantalla de inicio de sesión e introducir tu usuario y contraseña.\n\n` +
    `Si el botón no funciona, copia y pega este enlace en tu navegador:\n${params.verificationUrl}\n\n` +
    `Este enlace caduca en 24 horas. Si no creaste ninguna cuenta en SplitFlow, puedes ignorar este mensaje.`;

  return await sendNotificationEmail({
    recipient_email: cleanEmail,
    recipient_name: displayName,
    subject,
    title,
    message,
    action_url: params.verificationUrl,
    action_label: 'Confirmar mi cuenta en SplitFlow →',
  });
}

const BUG_REPORT_MAX_FILES = 5;
const BUG_REPORT_MAX_TOTAL_BYTES = 8 * 1024 * 1024; // 8 MB en crudo (~10.7 MB en base64)
const SUPPORT_INBOX_ADDRESS = 'SplitflowNoReplay@gmail.com';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error(`No se pudo procesar el archivo ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Envía internamente un reporte de incidencia/bug con adjuntos opcionales (imagen o vídeo)
 * hacia SplitflowNoReplay@gmail.com sin exponer al usuario detalles de mensajería electrónica.
 */
export async function sendBugReport(params: {
  user: User;
  subject: string;
  comment: string;
  files?: File[];
}): Promise<{ success: boolean; error?: string }> {
  const cleanSubject = params.subject.trim();
  const cleanComment = params.comment.trim();
  const files = params.files || [];

  if (!cleanSubject || !cleanComment) {
    return { success: false, error: 'validation_required' };
  }

  if (files.length > BUG_REPORT_MAX_FILES) {
    return { success: false, error: 'size_or_count_exceeded' };
  }

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  if (totalBytes > BUG_REPORT_MAX_TOTAL_BYTES) {
    return { success: false, error: 'size_or_count_exceeded' };
  }

  let encodedAttachments: EmailAttachmentPayload[] = [];
  if (files.length > 0) {
    try {
      encodedAttachments = await Promise.all(
        files.map(async (file) => ({
          filename: file.name,
          contentBase64: await fileToBase64(file),
          contentType: file.type || 'application/octet-stream',
        }))
      );
    } catch {
      return { success: false, error: 'attachment_read_failed' };
    }
  }

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Desconocido';
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'N/A';
  const timestamp = new Date().toISOString();
  const reporterHandle = params.user.username ? `@${params.user.username}` : params.user.name;

  const attachmentsSummary =
    encodedAttachments.length > 0
      ? encodedAttachments
          .map((att, idx) => `${idx + 1}. ${att.filename} (${att.contentType})`)
          .join('\n')
      : 'Ninguno';

  const message =
    `Se ha recibido un nuevo reporte de incidencia desde el módulo Reportes de Perfil.\n\n` +
    `• Usuario: ${params.user.name} (${reporterHandle})\n` +
    `• ID de usuario: ${params.user.id}\n` +
    `• Correo de contacto: ${params.user.email || 'No disponible'}\n` +
    `• Fecha (UTC): ${timestamp}\n` +
    `• URL: ${currentUrl}\n` +
    `• Dispositivo / Navegador: ${userAgent}\n\n` +
    `--- ASUNTO ---\n${cleanSubject}\n\n` +
    `--- DESCRIPCIÓN / COMENTARIO ---\n${cleanComment}\n\n` +
    `--- ARCHIVOS ADJUNTOS (${encodedAttachments.length}) ---\n${attachmentsSummary}`;

  const res = await sendNotificationEmail({
    recipient_email: SUPPORT_INBOX_ADDRESS,
    recipient_name: 'Equipo Técnico SplitFlow',
    reply_to: params.user.email || undefined,
    subject: `[SplitFlow Reporte] ${cleanSubject} (${reporterHandle})`,
    title: `Reporte técnico: ${cleanSubject}`,
    message,
    is_internal_report: true,
    attachments: encodedAttachments,
  });

  if (!res.success) {
    return { success: false, error: 'delivery_failed' };
  }

  return { success: true };
}



