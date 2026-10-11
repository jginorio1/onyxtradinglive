import UserNotifications

// ============================================================
// Onyx Trading Live — Notification Service Extension (iOS)
//
// Qué hace: cuando llega un push con "mutable-content": 1 y una imagen (el logo
// de Onyx), esta extensión descarga esa imagen y la adjunta a la notificación,
// para que iOS la muestre dentro del aviso (el ícono chico sigue siendo el de la
// app, eso Apple no lo deja cambiar).
//
// De dónde saca la URL de la imagen (en este orden):
//   1) userInfo["image"]                → la que manda el servidor en data.image
//   2) userInfo["fcm_options"]["image"] → la que pone FCM con apns.fcm_options.image
//
// No necesita el SDK de Firebase: descarga la imagen con URLSession y la adjunta.
// ============================================================
class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttempt: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        self.bestAttempt = (request.content.mutableCopy() as? UNMutableNotificationContent)
        guard let content = bestAttempt else { contentHandler(request.content); return }

        // 1) Buscar la URL de la imagen en el payload.
        let info = request.content.userInfo
        var urlStr: String? = info["image"] as? String
        if urlStr == nil, let fcm = info["fcm_options"] as? [String: Any] {
            urlStr = fcm["image"] as? String
        }
        guard let s = urlStr, let url = URL(string: s) else {
            contentHandler(content); return
        }

        // 2) Descargar y adjuntar.
        let task = URLSession.shared.downloadTask(with: url) { (tmp, _, _) in
            defer {
                // Pase lo que pase, entregamos la notificación (con o sin imagen).
                contentHandler(content)
            }
            guard let tmp = tmp else { return }
            let dir = URL(fileURLWithPath: NSTemporaryDirectory())
            let ext = url.pathExtension.isEmpty ? "png" : url.pathExtension
            let dst = dir.appendingPathComponent(UUID().uuidString + "." + ext)
            do {
                try FileManager.default.moveItem(at: tmp, to: dst)
                let attach = try UNNotificationAttachment(identifier: "onyx-logo", url: dst, options: nil)
                content.attachments = [attach]
            } catch { /* si falla, se entrega sin imagen */ }
        }
        task.resume()
    }

    override func serviceExtensionTimeWillExpire() {
        // Se acabó el tiempo (iOS da ~30 s): entregamos lo que tengamos.
        if let handler = contentHandler, let content = bestAttempt {
            handler(content)
        }
    }
}
