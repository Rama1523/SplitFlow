# SplitFlow — Edge Function: send-notification-email (Gmail SMTP + Nodemailer)

Esta Supabase Edge Function permite el envío gratuito de notificaciones por correo electrónico transaccional para eventos de **SplitFlow** (nuevos gastos, desgloses y liquidaciones de deuda) utilizando directamente un servidor SMTP propio de Google (Gmail) con la cuenta oficial `SplitflowNoReplay@gmail.com` y la librería `nodemailer`.

---

## 1. Pasos para Generar la "Contraseña de Aplicación" en Google

Para que Supabase pueda autenticarse con Gmail sin bloqueos ni captcha:

1. Inicia sesión con la cuenta **SplitflowNoReplay@gmail.com** en [myaccount.google.com](https://myaccount.google.com).
2. En el menú lateral izquierdo, haz clic en **Seguridad**.
3. En la sección *"Cómo inicias sesión en Google"*, asegúrate de tener activada la **Verificación en dos pasos** (si no lo está, actívala con un número de teléfono).
4. Una vez activada, entra directamente en:
   👉 **[myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)**
   *(O escribe "Contraseñas de aplicaciones" en la barra de búsqueda superior de tu cuenta Google)*.
5. Escribe un nombre descriptivo en el campo (ej: `SplitFlow Supabase Edge Function`) y pulsa **Crear**.
6. Google generará una **contraseña de 16 caracteres** dentro de un recuadro amarillo (ej: `abcd efgh ijkl mnop`).
7. Copia esa contraseña de 16 letras (sin espacios). Esa clave será el valor de `SMTP_PASS`.

---

## 2. Configurar los Secretos en Supabase

Ejecuta en tu terminal con Supabase CLI (o agrégalos desde el Dashboard de Supabase en **Settings > Edge Functions > Secrets**):

```bash
supabase link --project-ref fyhvotkgeopjwqxcbiry
supabase secrets set SMTP_HOST="smtp.gmail.com"
supabase secrets set SMTP_PORT="587"
supabase secrets set SMTP_USER="SplitflowNoReplay@gmail.com"
supabase secrets set SMTP_PASS="gxli mpzc hbce lhqf"
supabase secrets set SMTP_FROM="SplitflowNoReplay@gmail.com"
```

---

## 3. Desplegar la Edge Function

Despliega la función en tu proyecto activo de Supabase:

```bash
supabase functions deploy send-notification-email --project-ref fyhvotkgeopjwqxcbiry
```

---

## 4. Prueba Rápida con cURL

```bash
curl -i --location --request POST 'https://<TU-PROJECT-REF>.supabase.co/functions/v1/send-notification-email' \
  --header 'Authorization: Bearer <TU_ANON_O_SERVICE_ROLE_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "recipient_email": "destino@ejemplo.com",
    "subject": "Prueba de notificación SplitFlow",
    "message": "Hola, este es un mensaje de prueba enviado directamente desde el servidor SMTP de Gmail con SplitflowNoReplay@gmail.com.",
    "action_url": "https://splitflow.app"
  }'
```
