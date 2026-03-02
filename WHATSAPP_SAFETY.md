# WhatsApp Safety — Guía de Riesgos y Correcciones

Este documento describe todos los riesgos identificados de bloqueo por parte de WhatsApp/Meta en esta implementación de Evolution API, junto con las correcciones aplicadas y las recomendaciones operativas.

---

## Índice

1. [Contexto del problema](#contexto)
2. [Correcciones aplicadas al código](#correcciones-codigo)
3. [Correcciones aplicadas al `.env`](#correcciones-env)
4. [Recomendaciones operativas](#recomendaciones)
5. [Variables de entorno relevantes](#variables)
6. [Tabla resumen de riesgos](#tabla-resumen)

---

## Contexto

WhatsApp/Meta detecta y bloquea números que presentan comportamiento anormal automatizado. Los principales patrones detectados son:

- Reconexiones frecuentes y rápidas
- Verificaciones masivas de números (scraping)
- Lectura masiva de mensajes sin throttling
- Presencia online permanente 24/7
- Identificación como herramienta de terceros conocida
- Envío de mensajes sin rate limiting
- Bucles de respuesta automática

---

## Correcciones aplicadas al código

### C1 — Reconexión con backoff exponencial y límite de intentos
**Archivo:** `src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts`

**Problema:** La reconexión se disparaba inmediatamente ante cualquier desconexión, incluyendo errores 503 temporales del lado de WhatsApp. Reconexiones rápidas y repetidas son detectadas como comportamiento de bot.

**Corrección aplicada:**
- Backoff exponencial: 5s → 10s → 20s → 40s → ... → máximo 5 minutos
- Delay doble para errores 503 (Service Unavailable)
- Máximo 10 intentos por sesión
- Prevención de reconexiones simultáneas (`isReconnecting` flag)
- Reset del contador solo al conectar exitosamente

---

### C2 — Rate limiting en envío de mensajes
**Archivo:** `src/api/routes/sendMessage.router.ts`

**Problema:** No existía ningún rate limiting. Cualquier cliente podía enviar miles de mensajes por segundo.

**Corrección aplicada:**
- Máximo 30 mensajes por minuto por instancia
- Respuesta HTTP 429 con header `Retry-After` al exceder el límite
- Ventana deslizante de 60 segundos

---

### C3 — profilePicture con batches en contacts.upsert
**Archivo:** `src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts` (~línea 907)

**Problema:** `Promise.all` disparaba N requests paralelos a WhatsApp al sincronizar contactos. En cuentas con cientos de contactos esto generaba ráfagas masivas de peticiones.

**Corrección aplicada:**
- Procesamiento en batches de 5 contactos
- Delay de 1 segundo entre batches
- Errores individuales no detienen el proceso completo

---

### C4 — Throttling en readMessages
**Archivo:** `src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts` (~línea 1282)

**Problema:** `readMessages` se llamaba por cada mensaje en el loop sin ningún delay. En sincronización inicial de historial esto generaba cientos de llamadas consecutivas.

**Corrección aplicada:**
- Acumulación de keys en batch de 10 mensajes
- Envío del batch cada 500ms
- Un solo `readMessages` por batch en lugar de N individuales

---

### A5 — Tope máximo en delay de sendPresence
**Archivo:** `src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts` (~línea 2229)

**Problema:** El parámetro `delay` no tenía límite máximo. Un delay de horas generaba bucles interminables de `presenceUpdate('composing')`.

**Corrección aplicada:**
- Tope máximo de 60 segundos (60.000 ms)
- Validación aplicada antes del loop de presencia

---

### A6 — Eliminación de doble llamada a whatsappNumber
**Archivo:** `src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts` (~línea 2001)

**Problema:** `fetchProfile` llamaba dos veces a `whatsappNumber()` para el mismo JID, duplicando las verificaciones contra los servidores de WhatsApp.

**Corrección aplicada:**
- Una sola llamada; reutilización del resultado `onWhatsapp` ya obtenido

---

### M2+M3 — retryRequestDelayMs y maxMsgRetryCount
**Archivo:** `src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts` (~línea 718)

**Problema:** `retryRequestDelayMs: 350ms` con `maxMsgRetryCount: 4` generaba ráfagas de 4 reintentos en ~1.4 segundos por mensaje fallido.

**Corrección aplicada:**
- `retryRequestDelayMs`: 350ms → 1000ms
- `maxMsgRetryCount`: 4 → 2

---

### M4 — Delay entre envíos en loop de invitaciones de grupo
**Archivo:** `src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts` (~línea 4430)

**Problema:** Envío secuencial a múltiples números sin ningún delay entre mensajes.

**Corrección aplicada:**
- Delay de 1.5 segundos entre cada envío de invitación

---

### M5 — debounceTime default en chatbots
**Archivo:** `src/api/integrations/chatbot/base-chatbot.controller.ts` (~línea 408)

**Problema:** El debounce por defecto de 1 segundo era insuficiente. Con 1s el bot puede responder múltiples veces a mensajes enviados rápidamente.

**Corrección aplicada:**
- `debounceTime` default: 1 → 5 segundos

---

### M6 — listeningFromMe default en chatbots
**Archivo:** `src/api/integrations/chatbot/base-chatbot.controller.ts` (~línea 405)

**Problema:** `listeningFromMe: true` por defecto podía provocar que el bot respondiera a sus propios mensajes en ciertos escenarios de emit manual.

**Corrección aplicada:**
- `listeningFromMe` default: `true` → `false`

---

## Correcciones aplicadas al `.env`

### C1-env — Comillas en DATABASE_CONNECTION_URI (causaba error P1013)
```bash
# ANTES ❌
DATABASE_CONNECTION_URI="postgresql://..."

# DESPUÉS ✅
DATABASE_CONNECTION_URI=postgresql://...
```

### A1-env — Identificador de sesión de WhatsApp
```bash
# ANTES ❌ (Meta conoce esta herramienta)
CONFIG_SESSION_PHONE_CLIENT=Evolution API

# DESPUÉS ✅
CONFIG_SESSION_PHONE_CLIENT=WhatsApp
```

### A2-env — Límite de intentos de QR
```bash
# ANTES ❌ (30 reconexiones por QR fallido)
QRCODE_LIMIT=30

# DESPUÉS ✅
QRCODE_LIMIT=10
```

### A3-env — Reintentos de webhook
```bash
# ANTES ❌ (con URL ngrok: bloquea event loop por horas)
WEBHOOK_RETRY_MAX_ATTEMPTS=10

# DESPUÉS ✅
WEBHOOK_RETRY_MAX_ATTEMPTS=3
```

### A4-env — Presencia en webhook
```bash
# ANTES ❌ (evento de alta frecuencia, decenas por minuto)
WEBHOOK_EVENTS_PRESENCE_UPDATE=true

# DESPUÉS ✅
WEBHOOK_EVENTS_PRESENCE_UPDATE=false
```

### A8-env — Variables duplicadas
Se eliminaron las definiciones duplicadas de `STORE_CLEANING_INTERVAL`, `CHROME_ARGS` y `CHROME_HEADLESS` que tenían valores diferentes. La segunda instancia de `CHROME_ARGS` tenía flags incompletos y un typo (`--disable-soble-software-rasterizer`).

### M1-env — Log level en producción
```bash
# ANTES ❌ (VERBOSE y DEBUG ralentizan producción)
LOG_LEVEL=ERROR,WARN,DEBUG,INFO,LOG,VERBOSE,DARK

# DESPUÉS ✅
LOG_LEVEL=ERROR,WARN,INFO,LOG
```

### S1-env — API key débil
```bash
# ANTES ❌ (clave pública en el repositorio)
AUTHENTICATION_API_KEY=BQYHJGJHJ

# DESPUÉS ✅ (cambiar por una clave segura generada aleatoriamente)
AUTHENTICATION_API_KEY=<generar con: openssl rand -hex 32>
```

### S2-env — CORS abierto
```bash
# ANTES ❌
CORS_ORIGIN=*

# DESPUÉS ✅
CORS_ORIGIN=https://drsem.server.andromind.mx
```

---

## Recomendaciones operativas

### URL del webhook global
La URL de ngrok (`ngrok-free.app`) expira y cambia. Cuando expira, todos los webhooks fallan con timeout durante la cadena de reintentos. **Usar una URL permanente** para producción.

Si debes usar ngrok temporalmente, configura:
```bash
WEBHOOK_RETRY_MAX_ATTEMPTS=2
WEBHOOK_REQUEST_TIMEOUT_MS=10000
```

### alwaysOnline en instancias
Configurar `alwaysOnline: false` al crear instancias. Un número online 24/7 sin actividad humana es señal clara de bot.

### syncFullHistory
Evitar `syncFullHistory: true` en producción. Si se necesita historial, habilitarlo solo una vez en la primera conexión y luego desactivarlo.

### Verificación masiva de números (onWhatsApp)
El caché está configurado para 7 días (`DATABASE_SAVE_IS_ON_WHATSAPP_DAYS=7`). No reducir este valor, ya que aumentar las verificaciones hacia los servidores de WhatsApp incrementa el riesgo de bloqueo.

### Envío masivo de mensajes
Con el rate limiting implementado (30 msg/min por instancia), para campañas grandes distribuir el envío en múltiples instancias o aumentar el tiempo entre mensajes.

---

## Variables de entorno relevantes

| Variable | Valor actual | Valor recomendado | Impacto |
|----------|-------------|-------------------|---------|
| `QRCODE_LIMIT` | 10 | 5-10 | Reconexiones por QR |
| `WEBHOOK_RETRY_MAX_ATTEMPTS` | 3 | 2-3 | Bloqueo del event loop |
| `WEBHOOK_EVENTS_PRESENCE_UPDATE` | false | false | Frecuencia de webhooks |
| `CONFIG_SESSION_PHONE_CLIENT` | WhatsApp | WhatsApp | Detección de bot |
| `DATABASE_SAVE_IS_ON_WHATSAPP_DAYS` | 7 | 7-14 | Frecuencia de verificación |
| `LOG_LEVEL` | ERROR,WARN,INFO,LOG | ERROR,WARN,INFO,LOG | Rendimiento |

---

## Tabla resumen de riesgos

| ID | Riesgo | Severidad | Estado |
|----|--------|-----------|--------|
| C1 | Reconexiones sin backoff | 🔴 Crítico | ✅ Corregido |
| C2 | Sin rate limiting en mensajes | 🔴 Crítico | ✅ Corregido |
| C3 | Promise.all de profilePicture | 🔴 Crítico | ✅ Corregido |
| C4 | readMessages sin throttling | 🔴 Crítico | ✅ Corregido |
| A1 | CONFIG_SESSION_PHONE_CLIENT | 🟠 Alto | ✅ Corregido |
| A2 | QRCODE_LIMIT=30 | 🟠 Alto | ✅ Corregido |
| A3 | WEBHOOK_RETRY_MAX_ATTEMPTS=10 | 🟠 Alto | ✅ Corregido |
| A4 | PRESENCE_UPDATE en webhook | 🟠 Alto | ✅ Corregido |
| A5 | sendPresence sin tope de delay | 🟠 Alto | ✅ Corregido |
| A6 | Doble llamada whatsappNumber | 🟠 Alto | ✅ Corregido |
| A8 | Variables duplicadas en .env | 🟠 Alto | ✅ Corregido |
| M1 | Log level verbose en producción | 🟡 Medio | ✅ Corregido |
| M2 | retryRequestDelayMs=350ms | 🟡 Medio | ✅ Corregido |
| M3 | maxMsgRetryCount=4 | 🟡 Medio | ✅ Corregido |
| M4 | Loop de invitaciones sin delay | 🟡 Medio | ✅ Corregido |
| M5 | debounceTime=1s en chatbots | 🟡 Medio | ✅ Corregido |
| M6 | listeningFromMe=true default | 🟡 Medio | ✅ Corregido |
| S1 | API key débil/pública | 🔵 Seguridad | ⚠️ Cambiar manualmente |
| S2 | CORS_ORIGIN=* | 🔵 Seguridad | ✅ Corregido |
| DB1 | Comillas en DATABASE_CONNECTION_URI | 🔴 Crítico | ✅ Corregido |

> ⚠️ **S1** requiere acción manual: generar una nueva API key con `openssl rand -hex 32` y actualizar en el servidor.
