/**
 * Onyx Trading Live — Backup automático a Google Drive (EXPORTACIÓN LIGERA · JSON)
 * ----------------------------------------------------
 * OBSOLETO si ya activaste la copia COMPLETA a Drive (el .sql.gz que sube la
 * tarea de GitHub vía rclone). Esta versión solo guarda un JSON parcial y sin
 * secretos, útil para revisar, pero NO restaura toda la base.
 *
 * Para dejar SOLO la copia completa en Drive: abre este proyecto en
 * script.google.com y ejecuta UNA vez la función  desinstalarDisparador  (más
 * abajo). Eso apaga la copia diaria en JSON. La copia completa seguirá llegando
 * desde la tarea de GitHub.
 *
 * Corre en TU cuenta de Gmail (Google Apps Script). Cada día baja el backup
 * de Onyx y lo guarda en una carpeta de tu Drive, borrando las copias viejas.
 * Las llaves de Google se quedan en tu cuenta; no viven en tu servidor.
 *
 * CÓMO INSTALARLO:
 *   1) Entra a https://script.google.com  →  Nuevo proyecto.
 *   2) Borra lo que haya y pega TODO este archivo.
 *   3) Rellena los 4 valores de CONFIG de abajo.
 *   4) Menú "Ejecutar" → elige la función  backupNow  (te pedirá permisos: acéptalos).
 *      Debe crear el primer archivo en tu Drive. Compruébalo.
 *   5) Ejecuta UNA vez la función  instalarDisparadorDiario  para que corra solo cada día.
 *   ¡Listo! Ya no tienes que hacer nada más.
 */

// ====================== CONFIG (rellena esto) ======================
var CONFIG = {
  // La URL de tu web, sin barra al final.
  SITE: 'https://www.onyxtradinglive.com',

  // El secreto para bajar el backup. Usa el mismo valor de CRON_SECRET de Vercel,
  // o crea uno nuevo llamado BACKUP_SECRET en Vercel y pon aquí ese valor.
  SECRET: 'PON-AQUI-TU-SECRETO',

  // Nombre de la carpeta en tu Drive donde se guardarán las copias.
  // Si no existe, el script la crea sola.
  FOLDER_NAME: 'Onyx Backups',

  // Cuántas copias conservar (borra las más viejas). 30 = ~1 mes de copias diarias.
  KEEP: 30,
};
// ==================================================================

/** Baja el backup y lo guarda en Drive. Es lo que corre cada día. */
function backupNow() {
  var url = CONFIG.SITE + '/api/admin/backup?export=json&key=' + encodeURIComponent(CONFIG.SECRET);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code !== 200) {
    throw new Error('No se pudo bajar el backup (HTTP ' + code + '): ' + res.getContentText().slice(0, 200));
  }

  var blob = res.getBlob();
  var name = 'onyx-backup-' + stamp_() + '.json';
  blob.setName(name);

  var folder = getFolder_(CONFIG.FOLDER_NAME);
  var file = folder.createFile(blob);
  var size = file.getSize();

  prune_(folder, CONFIG.KEEP);
  recordHistory_(name, size);   // avisa al panel (opcional, no rompe si falla)

  Logger.log('Guardado ' + name + ' (' + Math.round(size / 1024) + ' KB) en "' + CONFIG.FOLDER_NAME + '"');
}

/** Crea el disparador diario (córrela UNA vez). */
function instalarDisparadorDiario() {
  // Evita duplicados: borra disparadores previos de backupNow.
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backupNow') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('backupNow').timeBased().everyDays(1).atHour(4).create(); // ~4am
  Logger.log('Disparador diario instalado (todos los días alrededor de las 4am).');
}

/** Apaga la copia diaria en JSON (córrela UNA vez para dejar solo la copia completa). */
function desinstalarDisparador() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backupNow') { ScriptApp.deleteTrigger(t); n++; }
  });
  Logger.log('Disparadores de backupNow eliminados: ' + n + '. Ya no se guardará el JSON diario.');
}

// ------------------------- utilidades -------------------------

function stamp_() {
  var d = new Date();
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
}

function getFolder_(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

/** Deja solo las 'keep' copias más recientes; borra el resto. */
function prune_(folder, keep) {
  var files = [];
  var it = folder.getFilesByType('application/json');
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf('onyx-backup-') === 0) files.push(f);
  }
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  for (var i = keep; i < files.length; i++) files[i].setTrashed(true);
}

/** Avisa al panel de Onyx que hubo copia (para el historial). Si falla, no pasa nada. */
function recordHistory_(file, size) {
  try {
    UrlFetchApp.fetch(CONFIG.SITE + '/api/admin/backup', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-cron-secret': CONFIG.SECRET },
      payload: JSON.stringify({ file: file, size: size, dest: 'Google Drive' }),
      muteHttpExceptions: true,
    });
  } catch (e) { /* silencioso */ }
}
