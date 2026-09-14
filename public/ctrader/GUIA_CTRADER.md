# Onyx Trading Live · cTrader — Guía de instalación

> **Español abajo · English at the bottom**
> Estos son cBots de cTrader escritos en C#. Se **compilan dentro de cTrader** (no se "suben" a ningún lado). Pruébalos **primero en una cuenta DEMO**.

---

## 🇪🇸 Español

### Antes de empezar
- Necesitas **cTrader Desktop** (el de tu bróker o cTrader oficial). La versión web no permite compilar cBots.
- Ten a mano tu **API key de Onyx**:
  - **Guardian** → la de *Conectar cuenta* (sirve para sincronizar + proteger).
  - **Copy** → la clave que empieza por `onyx_copy_` (solo para copy trading).
- Haz todo primero en **DEMO**. Cuando funcione, pásalo a real.

### Paso 1 · Descarga el archivo
En tu panel de Onyx:
- **Guardian:** Conectar cuenta → botón **cTrader (cBot)** → descarga `OnyxGuardian.cs`.
- **Copy:** Copy trading → **cTrader (.cs)** → descarga `OnyxCopyMaster.cs` (cuenta que se copia) o `OnyxCopySlave.cs` (cuenta que recibe).

### Paso 2 · Crea el cBot en cTrader
1. Abre **cTrader** → pestaña **Automate** (arriba).
2. Botón **New cBot** (o New → cBot). Ponle un nombre, p. ej. `OnyxGuardian`.
3. Se abre el editor de código. **Borra** todo el contenido de ejemplo.
4. Abre el `.cs` que descargaste con el Bloc de notas, **copia todo** y **pégalo** en el editor.
5. Pulsa **Build** (o el ícono del martillo / F6).
   - Abajo debe decir **Build succeeded**. Si sale algún error, ve a "Si el Build falla".

### Paso 3 · Añádelo a un gráfico y ponlo a correr
1. Abre un gráfico cualquiera (por ejemplo EURUSD; da igual el símbolo, el cBot ve toda la cuenta).
2. En Automate, en tu cBot, pestaña de **parámetros**:
   - **API key (Onyx Guardian):** pega tu clave.
   - **Server URL:** déjalo como está (`https://www.onyxtradinglive.com`) salvo que uses otro dominio.
   - **Sync seconds:** 10 está bien.
   - **Language:** `ES` o `EN`.
3. Pulsa **Play ▶** para iniciarlo.
4. La primera vez cTrader te pedirá permiso de **acceso completo** (red). Acepta — es para hablar con Onyx.
5. En la pestaña **Log** del cBot deberías ver que sincroniza sin errores. En un par de minutos tu cuenta de cTrader aparece en el dashboard de Onyx, igual que una de MetaTrader.

### Paso 4 · Deja que trabaje
- El **Guardian** ya aplica lo que configuraste en la web (break even, trailing, parciales, cerrar todo, bloqueo fuera de plan, cierre de fin de semana).
- Debe quedar **corriendo** para proteger y sincronizar. Si cierras cTrader o paras el cBot, deja de proteger.
- Onyx **nunca abre operaciones solo**; solo gestiona y protege lo que tú abres.

### Copy trading (opcional)
- En la cuenta **que quieres copiar** instala `OnyxCopyMaster.cs` con tu clave `onyx_copy_...`.
- En cada cuenta **que recibe** instala `OnyxCopySlave.cs` con la misma clave Copy.
- Empieza en **DEMO en las dos** para ver latencia y que los símbolos coincidan.

### Si el Build falla
Es normal en un cBot nuevo; suele ser un detalle de una línea. Copia el texto del error (pestaña de errores abajo) y:
- Si menciona **`Account.Currency`** → cámbialo por `Account.Asset.Name`.
- Si menciona un **nombre de método** (por ejemplo `ModifyPosition`, `ClosePosition`) → tu versión de cTrader puede usar otra firma; anótalo y mándamelo, lo ajusto.
- Casi siempre es 1–2 líneas. Envíame el mensaje **exacto** del error y te doy el reemplazo.

### Reglas de seguridad (importante)
- Prueba en **DEMO** antes de dinero real.
- La clave **Guardian** y la **Copy** son distintas: no las mezcles.
- El copy es una **plantilla**: revisa la tabla de alias de símbolos (ej. `GOLD`↔`XAUUSD`) si tu bróker nombra distinto.
- Onyx no da señales ni promete ganancias; solo gestiona el riesgo de lo que tú operas.

---

## 🇬🇧 English

### Before you start
- You need **cTrader Desktop** (from your broker or official cTrader). The web version can't compile cBots.
- Have your **Onyx API key** ready:
  - **Guardian** → the one from *Connect account* (syncs + protects).
  - **Copy** → the key starting with `onyx_copy_` (copy trading only).
- Do everything in **DEMO** first, then move to live.

### Step 1 · Download the file
In your Onyx panel:
- **Guardian:** Connect account → **cTrader (cBot)** → download `OnyxGuardian.cs`.
- **Copy:** Copy trading → **cTrader (.cs)** → `OnyxCopyMaster.cs` (account being copied) or `OnyxCopySlave.cs` (account receiving).

### Step 2 · Create the cBot in cTrader
1. Open **cTrader** → **Automate** tab.
2. **New cBot**, name it e.g. `OnyxGuardian`.
3. In the code editor, **delete** the sample code.
4. Open the downloaded `.cs` in a text editor, **copy all**, **paste** into the editor.
5. Press **Build** (hammer icon / F6). It should say **Build succeeded**.

### Step 3 · Add to a chart and run
1. Open any chart (e.g. EURUSD — the symbol doesn't matter, the bot sees the whole account).
2. In the cBot **parameters**:
   - **API key (Onyx Guardian):** paste your key.
   - **Server URL:** leave as is unless you use another domain.
   - **Sync seconds:** 10 is fine.
   - **Language:** `EN` or `ES`.
3. Press **Play ▶**.
4. Accept the **Full Access** (network) prompt the first time.
5. Check the cBot **Log** for clean syncs. Within a couple of minutes your cTrader account shows up in the Onyx dashboard, just like a MetaTrader one.

### Step 4 · Let it run
- The **Guardian** applies what you set on the web (break even, trailing, partials, close-all, out-of-plan block, weekend close).
- Keep it **running** to protect and sync. If cTrader closes or the bot stops, protection stops too.
- Onyx **never opens trades on its own** — it only manages and protects your trades.

### Copy trading (optional)
- On the account **to copy from**, install `OnyxCopyMaster.cs` with your `onyx_copy_...` key.
- On each **receiving** account, install `OnyxCopySlave.cs` with the same Copy key.
- Start in **DEMO on both** to check latency and symbol matching.

### If the Build fails
Normal for a fresh cBot — usually one line. Copy the exact error and:
- Mentions **`Account.Currency`** → replace with `Account.Asset.Name`.
- Mentions a **method name** (e.g. `ModifyPosition`, `ClosePosition`) → your cTrader version may use a different signature; send it to me and I'll adjust.
- Send me the **exact** error text and I'll give you the fix.

### Safety
- Test in **DEMO** first.
- Guardian key and Copy key are different — don't mix them.
- Copy is a **template**: check the symbol alias table (e.g. `GOLD`↔`XAUUSD`) if your broker names symbols differently.
- Onyx gives no signals and promises no profit; it only manages the risk of what you trade.
