// Semilla curada a mano de los textos de UI más visibles, en zh/ja/pt/vi.
// Se fusiona con lo que ya exista y con lo que genere i18n-translate.mjs.
// Ejecutar: node scripts/i18n-core-seed.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// [es, zh, ja, pt, vi]
const T = [
  ['Guardar','保存','保存','Salvar','Lưu'],
  ['Guardar cambios','保存更改','変更を保存','Salvar alterações','Lưu thay đổi'],
  ['Cancelar','取消','キャンセル','Cancelar','Hủy'],
  ['Cerrar','关闭','閉じる','Fechar','Đóng'],
  ['Editar','编辑','編集','Editar','Sửa'],
  ['Eliminar','删除','削除','Excluir','Xóa'],
  ['Borrar','删除','削除','Excluir','Xóa'],
  ['Quitar','移除','削除','Remover','Bỏ'],
  ['Aceptar','确定','OK','OK','Đồng ý'],
  ['Confirmar','确认','確認','Confirmar','Xác nhận'],
  ['Continuar','继续','続ける','Continuar','Tiếp tục'],
  ['Volver','返回','戻る','Voltar','Quay lại'],
  ['Siguiente','下一步','次へ','Próximo','Tiếp theo'],
  ['Anterior','上一步','前へ','Anterior','Trước'],
  ['Copiar','复制','コピー','Copiar','Sao chép'],
  ['Descargar','下载','ダウンロード','Baixar','Tải xuống'],
  ['Compartir','分享','共有','Compartilhar','Chia sẻ'],
  ['Ajustes','设置','設定','Ajustes','Cài đặt'],
  ['Enviar','发送','送信','Enviar','Gửi'],
  ['Restablecer','重置','リセット','Redefinir','Đặt lại'],
  ['Actualizar','刷新','更新','Atualizar','Làm mới'],
  ['Añadir','添加','追加','Adicionar','Thêm'],
  ['Crear','创建','作成','Criar','Tạo'],
  ['Generar','生成','生成','Gerar','Tạo'],
  ['Listo','完成','完了','Pronto','Xong'],
  ['Buscar','搜索','検索','Buscar','Tìm kiếm'],
  ['Buscar…','搜索…','検索…','Buscar…','Tìm kiếm…'],
  ['Sí','是','はい','Sim','Có'],
  ['No','否','いいえ','Não','Không'],
  ['Aplicar','应用','適用','Aplicar','Áp dụng'],
  ['Ver más','查看更多','もっと見る','Ver mais','Xem thêm'],
  ['Ver todo','查看全部','すべて見る','Ver tudo','Xem tất cả'],
  ['Ocultar','隐藏','非表示','Ocultar','Ẩn'],
  ['Pausar','暂停','一時停止','Pausar','Tạm dừng'],
  ['Activar','启用','有効化','Ativar','Kích hoạt'],
  ['Invitar','邀请','招待','Convidar','Mời'],
  ['Aprobar','批准','承認','Aprovar','Duyệt'],
  ['Avisar','通知','通知','Notificar','Thông báo'],
  ['Salir','退出','ログアウト','Sair','Thoát'],
  ['Entrar','加入','参加','Entrar','Tham gia'],
  ['Unirme','加入','参加する','Entrar','Tham gia'],
  ['Banear','封禁','禁止','Banir','Cấm'],
  ['Auditar','审计','監査','Auditar','Kiểm tra'],
  ['Abrir','打开','開く','Abrir','Mở'],
  ['Ver','查看','表示','Abrir','Mở'],
  ['Ir →','前往 →','移動 →','Ir →','Đi →'],
  ['¡Vamos!','开始吧！','さあ！','Vamos!','Bắt đầu!'],
  // Etiquetas / campos
  ['Inicio','首页','ホーム','Início','Trang chủ'],
  ['Perfil','个人资料','プロフィール','Perfil','Hồ sơ'],
  ['Cuenta','账户','アカウント','Conta','Tài khoản'],
  ['Plan','套餐','プラン','Plano','Gói'],
  ['Correo','邮箱','メール','Email','Email'],
  ['Correos','邮件','メール','Emails','Email'],
  ['Nombre','姓名','名前','Nome','Tên'],
  ['Estado','状态','ステータス','Status','Trạng thái'],
  ['Fecha','日期','日付','Data','Ngày'],
  ['Tipo','类型','タイプ','Tipo','Loại'],
  ['Precio','价格','価格','Preço','Giá'],
  ['Monto','金额','金額','Valor','Số tiền'],
  ['Importe','金额','金額','Valor','Số tiền'],
  ['Método','方式','方法','Método','Phương thức'],
  ['Mensaje','消息','メッセージ','Mensagem','Tin nhắn'],
  ['Asunto','主题','件名','Assunto','Chủ đề'],
  ['Título','标题','タイトル','Título','Tiêu đề'],
  ['Código','代码','コード','Código','Mã'],
  ['código','代码','コード','código','mã'],
  ['Rol','角色','役割','Função','Vai trò'],
  ['Equipo','团队','チーム','Equipe','Nhóm'],
  ['Gastos','支出','経費','Despesas','Chi phí'],
  ['Ventas','销售','売上','Vendas','Doanh số'],
  ['ventas','销售','売上','vendas','doanh số'],
  ['Cobros','收款','支払い','Pagamentos','Thanh toán'],
  ['Ranking','排行榜','ランキング','Ranking','Bảng xếp hạng'],
  ['Puntos','积分','ポイント','Pontos','Điểm'],
  ['Nivel','等级','レベル','Nível','Cấp'],
  ['Niveles','等级','レベル','Níveis','Cấp độ'],
  ['Alumnos','学员','生徒','Alunos','Học viên'],
  ['Traders','交易者','トレーダー','Traders','Nhà giao dịch'],
  ['Mentor','导师','メンター','Mentor','Cố vấn'],
  ['Lección','课程','レッスン','Lição','Bài học'],
  ['Aula','教室','教室','Sala de aula','Lớp học'],
  ['Aulas','教室','教室','Salas de aula','Lớp học'],
  ['aulas','教室','教室','salas de aula','lớp học'],
  ['Anuncio','公告','お知らせ','Anúncio','Thông báo'],
  ['Portada','封面','カバー','Capa','Ảnh bìa'],
  ['Logros','成就','実績','Conquistas','Thành tích'],
  ['En vivo','直播','ライブ','Ao vivo','Trực tiếp'],
  ['Coach','教练','コーチ','Coach','Coach'],
  ['General','通用','一般','Geral','Chung'],
  ['Anual','年付','年額','Anual','Hàng năm'],
  ['anual','年付','年額','anual','hàng năm'],
  ['Mensual','月付','月額','Mensal','Hàng tháng'],
  ['mensual','月付','月額','mensal','hàng tháng'],
  ['Gratis','免费','無料','Grátis','Miễn phí'],
  ['gratis','免费','無料','grátis','miễn phí'],
  ['Activa','已激活','有効','Ativa','Đang hoạt động'],
  ['Activas','已激活','有効','Ativas','Đang hoạt động'],
  ['Activos','活跃','有効','Ativos','Đang hoạt động'],
  ['Pagado','已支付','支払済み','Pago','Đã trả'],
  ['pagado','已支付','支払済み','pago','đã trả'],
  ['pagada','已支付','支払済み','paga','đã trả'],
  ['Manual','手动','手動','Manual','Thủ công'],
  ['Privada','私密','非公開','Privada','Riêng tư'],
  ['Nuevo','新','新規','Novo','Mới'],
  ['Nuevos','新','新規','Novos','Mới'],
  ['Recibo','收据','領収書','Recibo','Biên lai'],
  ['Trades','交易','取引','Trades','Giao dịch'],
  ['Prueba','测试','テスト','Teste','Thử'],
  ['Página','页面','ページ','Página','Trang'],
  ['Ventana','窗口','ウィンドウ','Janela','Cửa sổ'],
  ['Canales','频道','チャンネル','Canais','Kênh'],
  ['reporte','报告','レポート','relatório','báo cáo'],
  ['Tamaño','大小','サイズ','Tamanho','Kích thước'],
  ['Banco','银行','銀行','Banco','Ngân hàng'],
  ['Cripto','加密货币','暗号資産','Cripto','Tiền mã hóa'],
  ['Señales','信号','シグナル','Sinais','Tín hiệu'],
  ['semanal','每周','毎週','semanal','hàng tuần'],
  ['Entorno','环境','環境','Ambiente','Môi trường'],
  ['Puntual','一次性','単発','Único','Một lần'],
  ['puntual','一次性','単発','único','một lần'],
  ['Todo','全部','すべて','Tudo','Tất cả'],
  ['Todos','全部','すべて','Todos','Tất cả'],
  ['Chat','聊天','チャット','Chat','Trò chuyện'],
  ['Cola','队列','キュー','Fila','Hàng đợi'],
  ['Fijar','置顶','ピン留め','Fixar','Ghim'],
  ['Fijado','已置顶','ピン留め済み','Fixado','Đã ghim'],
  ['fijado','已置顶','ピン留め','fixado','đã ghim'],
  ['Quién','谁','誰','Quem','Ai'],
  ['Valor','值','値','Valor','Giá trị'],
  ['Visto','已读','既読','Visto','Đã xem'],
  ['Ahora','现在','今','Agora','Bây giờ'],
  ['ahora','现在','今','agora','bây giờ'],
  ['Baneado','已封禁','禁止済み','Banido','Bị cấm'],
  ['editado','已编辑','編集済み','editado','đã sửa'],
  ['enviada','已发送','送信済み','enviada','đã gửi'],
  ['Margen','利润率','利益率','Margem','Biên'],
  ['Bruto','毛额','総額','Bruto','Gộp'],
  ['Caja','现金','キャッシュ','Caixa','Tiền mặt'],
];

const idx = { zh: 1, ja: 2, pt: 3, vi: 4 };

function loadDict(lang) {
  const path = `lib/i18n/${lang}.ts`;
  if (!existsSync(path)) return {};
  const src = readFileSync(path, 'utf8');
  const m = src.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try { return eval('(' + m[0] + ')'); } catch { return {}; }
}
function saveDict(lang, dict) {
  const entries = Object.entries(dict).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n');
  const body = `// Diccionario ${lang} — clave = texto en español. Núcleo curado a mano +\n`
    + `// relleno de Onyx AI (scripts/i18n-translate.mjs). Editable a mano.\n`
    + `const d: Record<string, string> = {\n${entries}\n};\nexport default d;\n`;
  writeFileSync(`lib/i18n/${lang}.ts`, body);
}

for (const lang of Object.keys(idx)) {
  const dict = loadDict(lang);
  let n = 0;
  for (const row of T) { const es = row[0], val = row[idx[lang]]; if (val && !dict[es]) { dict[es] = val; n++; } }
  saveDict(lang, dict);
  console.log(`[${lang}] +${n} → ${Object.keys(dict).length} entradas`);
}
