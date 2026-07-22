//+------------------------------------------------------------------+
//|  Onyx Manager - MT5                                              |
//|  Gestiona tus operaciones. NUNCA abre operaciones.               |
//|  Manages your trades. It NEVER opens trades.                     |
//|  onyxtradinglive.com                                             |
//+------------------------------------------------------------------+
#property copyright "Onyx Trading Live"
#property link      "https://onyxtradinglive.com"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>

//==================== ENTRADAS / INPUTS ===========================
// Solo tres. Todo lo demas se configura en onyxtradinglive.com
// Only three. Everything else is configured at onyxtradinglive.com

enum ENUM_ONYX_LANG { ONYX_ES = 0, ONYX_EN = 1 };

input string           ApiKey       = "";                              // API key (onyxtradinglive.com)
input ENUM_ONYX_LANG   Idioma       = ONYX_ES;                         // Idioma / Language
input string           ServidorUrl  = "https://onyxtradinglive.com";   // Servidor / Server

//==================== CONSTANTES ==================================
#define EA_VERSION "1.00"
#define PREFIX     "onyxm_"
#define SYNC_SECS  10

CTrade trade;

//==================== ESTADO ======================================
string   g_url;
long     g_login      = 0;
int      g_cfgVersion = -1;
bool     g_managerOn  = false;
string   g_units      = "pips";

bool     g_beOn = false;   double g_beTrigger = 15;   string g_beMode = "above";
double   g_beOffset = 2;   bool   g_beCosts = true;

bool     g_trOn = false;   double g_trStart = 20;     double g_trDistance = 20;

bool     g_ptOn = false;
double   g_ptAt[4];
double   g_ptClose[4];
int      g_ptCount = 0;

datetime g_lastSyncOk = 0;
string   g_lastError  = "";
string   g_events     = "";
string   g_doneCmds   = "";

int   PY = 22;
color COL_BG   = C'26,33,51';
color COL_LINE = C'56,69,95';
color COL_TX   = C'242,245,251';
color COL_MUT  = C'154,166,189';
color COL_ON   = C'52,226,160';
color COL_OFF  = C'90,100,120';
color COL_RED  = C'255,107,125';

//==================== DECLARACIONES ADELANTADAS ===================
void   RunCommand(string cmd);
void   DrawPanel();

//==================== TEXTOS BILINGUES ============================
string T(string es, string en) { return (Idioma == ONYX_ES ? es : en); }

//==================== UTILIDADES JSON =============================
// Parser minimo: el JSON lo genera nuestro servidor, con formato conocido.

string JsonSection(string src, string key)
{
   int p = StringFind(src, "\"" + key + "\"");
   if(p < 0) return "";
   int b = StringFind(src, "{", p);
   if(b < 0) return "";
   int depth = 0;
   for(int i = b; i < StringLen(src); i++)
   {
      ushort ch = StringGetCharacter(src, i);
      if(ch == '{') depth++;
      if(ch == '}') { depth--; if(depth == 0) return StringSubstr(src, b, i - b + 1); }
   }
   return "";
}

string JsonArray(string src, string key)
{
   int p = StringFind(src, "\"" + key + "\"");
   if(p < 0) return "";
   int b = StringFind(src, "[", p);
   if(b < 0) return "";
   int depth = 0;
   for(int i = b; i < StringLen(src); i++)
   {
      ushort ch = StringGetCharacter(src, i);
      if(ch == '[') depth++;
      if(ch == ']') { depth--; if(depth == 0) return StringSubstr(src, b, i - b + 1); }
   }
   return "";
}

string JsonRaw(string src, string key)
{
   int p = StringFind(src, "\"" + key + "\"");
   if(p < 0) return "";
   int c = StringFind(src, ":", p);
   if(c < 0) return "";
   int i = c + 1;
   while(i < StringLen(src) && StringGetCharacter(src, i) == ' ') i++;
   int start = i;
   while(i < StringLen(src))
   {
      ushort ch = StringGetCharacter(src, i);
      if(ch == ',' || ch == '}' || ch == ']') break;
      i++;
   }
   string v = StringSubstr(src, start, i - start);
   StringTrimLeft(v); StringTrimRight(v);
   return v;
}

double JsonNum(string src, string key, double def)
{
   string v = JsonRaw(src, key);
   if(v == "" || v == "null") return def;
   StringReplace(v, "\"", "");
   return (double)StringToDouble(v);
}

bool JsonBool(string src, string key, bool def)
{
   string v = JsonRaw(src, key);
   if(v == "") return def;
   return (StringFind(v, "true") >= 0);
}

string JsonStr(string src, string key, string def)
{
   string v = JsonRaw(src, key);
   if(v == "" || v == "null") return def;
   StringReplace(v, "\"", "");
   return v;
}

string Esc(string s)
{
   StringReplace(s, "\\", "");
   StringReplace(s, "\"", "'");
   StringReplace(s, "\n", " ");
   return s;
}

//==================== EVENTOS =====================================
void LogEvent(string kind, string detail, string symbol = "", long ticket = 0, double amount = 0)
{
   if(StringLen(g_events) > 4000) return;
   if(g_events != "") g_events += ",";
   g_events += StringFormat("{\"kind\":\"%s\",\"detail\":\"%s\",\"symbol\":\"%s\",\"ticket\":%I64d,\"amount\":%.2f}",
                            kind, Esc(detail), symbol, ticket, amount);
}

//==================== MEDIDAS DEL SIMBOLO =========================
double PipSize(string sym)
{
   int    dg = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   double pt = SymbolInfoDouble(sym, SYMBOL_POINT);
   return ((dg == 3 || dg == 5) ? pt * 10.0 : pt);
}

// Dinero que mueve 1 punto con 1 lote
double MoneyPerPointPerLot(string sym)
{
   double tickValue = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
   double point     = SymbolInfoDouble(sym, SYMBOL_POINT);
   if(tickSize <= 0) return 0;
   return tickValue * (point / tickSize);
}

// Comision que ya cobro el broker por esta posicion
double PositionCommission(ulong positionId)
{
   double total = 0;
   if(!HistorySelectByPosition(positionId)) return 0;
   int deals = HistoryDealsTotal();
   for(int i = 0; i < deals; i++)
   {
      ulong dt = HistoryDealGetTicket(i);
      if(dt == 0) continue;
      total += HistoryDealGetDouble(dt, DEAL_COMMISSION);
   }
   return total;
}

// Convierte la unidad del usuario (pips / R / dinero) a distancia en precio
double UnitsToPrice(string sym, double value, double volume, double entry, double sl)
{
   if(g_units == "money")
   {
      double mpp = MoneyPerPointPerLot(sym);
      if(mpp <= 0 || volume <= 0) return 0;
      double points = value / (mpp * volume);
      return points * SymbolInfoDouble(sym, SYMBOL_POINT);
   }
   if(g_units == "r")
   {
      if(sl <= 0) return 0;                 // sin stop no hay R que valga
      return value * MathAbs(entry - sl);
   }
   return value * PipSize(sym);             // pips por defecto
}

//==================== PANEL EN EL GRAFICO =========================
void PanelLabel(string name, string text, int x, int y, color clr, int size = 8, bool bold = false)
{
   string n = PREFIX + name;
   if(ObjectFind(0, n) < 0) ObjectCreate(0, n, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, n, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, n, OBJPROP_ANCHOR, ANCHOR_LEFT_UPPER);
   ObjectSetInteger(0, n, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, n, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, n, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, n, OBJPROP_FONTSIZE, size);
   ObjectSetString(0, n, OBJPROP_FONT, bold ? "Arial Bold" : "Arial");
   ObjectSetString(0, n, OBJPROP_TEXT, text);
   ObjectSetInteger(0, n, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, n, OBJPROP_BACK, false);
}

void PanelButton(string name, string text, int x, int y, int w, int h, color bg, color txt)
{
   string n = PREFIX + name;
   if(ObjectFind(0, n) < 0) ObjectCreate(0, n, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, n, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, n, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, n, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, n, OBJPROP_XSIZE, w);
   ObjectSetInteger(0, n, OBJPROP_YSIZE, h);
   ObjectSetInteger(0, n, OBJPROP_BGCOLOR, bg);
   ObjectSetInteger(0, n, OBJPROP_COLOR, txt);
   ObjectSetInteger(0, n, OBJPROP_BORDER_COLOR, COL_LINE);
   ObjectSetInteger(0, n, OBJPROP_FONTSIZE, 8);
   ObjectSetString(0, n, OBJPROP_TEXT, text);
   ObjectSetInteger(0, n, OBJPROP_STATE, false);
   ObjectSetInteger(0, n, OBJPROP_BACK, false);
}

void DrawPanel()
{
   int X = 12, W = 214, y = 22;
   int bx = X + W - 12 - 46;               // columna de los ON/OFF

   string bg = PREFIX + "bg";
   if(ObjectFind(0, bg) < 0) ObjectCreate(0, bg, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, bg, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, bg, OBJPROP_XDISTANCE, X);
   ObjectSetInteger(0, bg, OBJPROP_YDISTANCE, y - 10);
   ObjectSetInteger(0, bg, OBJPROP_XSIZE, W);
   ObjectSetInteger(0, bg, OBJPROP_YSIZE, 268);
   ObjectSetInteger(0, bg, OBJPROP_BGCOLOR, COL_BG);
   ObjectSetInteger(0, bg, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, bg, OBJPROP_COLOR, COL_LINE);
   ObjectSetInteger(0, bg, OBJPROP_BACK, false);
   ObjectSetInteger(0, bg, OBJPROP_SELECTABLE, false);

   PanelLabel("title", "Onyx Manager", X + 12, y, COL_TX, 9, true);
   y += PY;

   bool alive = (g_lastSyncOk > 0 && (TimeCurrent() - g_lastSyncOk) < 120);
   string st;
   if(g_lastSyncOk == 0)   st = T("Conectando...", "Connecting...");
   else if(alive)          st = T("Conectado - cuenta ", "Connected - account ") + (string)g_login;
   else                    st = T("Sin senal del servidor", "No server signal");
   PanelLabel("state", st, X + 12, y, alive ? COL_ON : COL_MUT, 8);
   y += PY;

   if(g_lastError != "")
   {
      PanelLabel("err", StringSubstr(g_lastError, 0, 32), X + 12, y, COL_RED, 7);
      y += PY - 6;
   }
   else ObjectDelete(0, PREFIX + "err");

   PanelLabel("mods", T("Modulos", "Modules"), X + 12, y, COL_MUT, 8);
   y += PY - 2;

   PanelLabel("lbe", "Break even", X + 12, y + 3, COL_TX, 8);
   PanelButton("bbe", g_beOn ? "ON" : "OFF", bx, y, 46, 18, g_beOn ? COL_ON : COL_OFF, C'20,25,38');
   y += PY;

   PanelLabel("ltr", "Trailing stop", X + 12, y + 3, COL_TX, 8);
   PanelButton("btr", g_trOn ? "ON" : "OFF", bx, y, 46, 18, g_trOn ? COL_ON : COL_OFF, C'20,25,38');
   y += PY;

   PanelLabel("lpt", T("TP parciales", "Partial TPs"), X + 12, y + 3, COL_TX, 8);
   PanelButton("bpt", g_ptOn ? "ON" : "OFF", bx, y, 46, 18, g_ptOn ? COL_ON : COL_OFF, C'20,25,38');
   y += PY + 8;

   PanelLabel("acts", T("Acciones rapidas", "Quick actions"), X + 12, y, COL_MUT, 8);
   y += PY - 2;

   int bw = 92;
   PanelButton("bslbe", T("SL a BE", "SL to BE"),      X + 12,      y, bw, 20, C'35,44,66', COL_TX);
   PanelButton("bhalf", T("Cerrar 50%", "Close 50%"),  X + 18 + bw, y, bw, 20, C'35,44,66', COL_TX);
   y += 24;
   PanelButton("bwin",  T("Ganadoras", "Winners"),     X + 12,      y, bw, 20, C'35,44,66', COL_TX);
   PanelButton("ball",  T("Cerrar todo", "Close all"), X + 18 + bw, y, bw, 20, C'120,40,55', COL_TX);
   y += 26;

   PanelLabel("foot", T("Onyx no abre operaciones", "Onyx never opens trades"), X + 12, y, COL_MUT, 7);

   ChartRedraw();
}

void DeletePanel()
{
   ObjectsDeleteAll(0, PREFIX);
   ChartRedraw();
}

//==================== CUERPO QUE SE ENVIA =========================
string BuildBody()
{
   string s = "{";
   s += "\"apiKey\":\"" + ApiKey + "\",";
   s += "\"eaVersion\":\"" + EA_VERSION + "\",";

   // desfase del servidor del broker respecto a UTC, en minutos
   int offMin = (int)((TimeCurrent() - TimeGMT()) / 60);
   s += StringFormat("\"serverOffset\":%d,", offMin);

   s += "\"account\":{";
   s += StringFormat("\"login\":%I64d,", AccountInfoInteger(ACCOUNT_LOGIN));
   s += "\"broker\":\"" + Esc(AccountInfoString(ACCOUNT_COMPANY)) + "\",";
   s += "\"server\":\"" + Esc(AccountInfoString(ACCOUNT_SERVER)) + "\",";
   s += "\"name\":\"" + Esc(AccountInfoString(ACCOUNT_NAME)) + "\",";
   s += "\"currency\":\"" + AccountInfoString(ACCOUNT_CURRENCY) + "\",";
   s += StringFormat("\"leverage\":%I64d,", AccountInfoInteger(ACCOUNT_LEVERAGE));
   s += "\"platform\":\"MT5\",";
   s += StringFormat("\"balance\":%.2f,", AccountInfoDouble(ACCOUNT_BALANCE));
   s += StringFormat("\"equity\":%.2f", AccountInfoDouble(ACCOUNT_EQUITY));
   s += "},";

   s += "\"openPositions\":[";
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong tk = PositionGetTicket(i);
      if(tk == 0) continue;
      if(n > 0) s += ",";
      s += StringFormat("{\"ticket\":%I64u,\"symbol\":\"%s\",\"side\":\"%s\",\"volume\":%.2f,\"openTime\":%I64d,\"openPrice\":%.5f,\"sl\":%.5f,\"tp\":%.5f,\"profit\":%.2f}",
            tk,
            PositionGetString(POSITION_SYMBOL),
            (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "buy" : "sell"),
            PositionGetDouble(POSITION_VOLUME),
            (long)PositionGetInteger(POSITION_TIME),
            PositionGetDouble(POSITION_PRICE_OPEN),
            PositionGetDouble(POSITION_SL),
            PositionGetDouble(POSITION_TP),
            PositionGetDouble(POSITION_PROFIT));
      n++;
   }
   s += "],";

   s += "\"closedTrades\":[";
   int m = 0;
   datetime from = TimeCurrent() - 3 * 24 * 3600;
   if(HistorySelect(from, TimeCurrent()))
   {
      int deals = HistoryDealsTotal();
      for(int i = 0; i < deals; i++)
      {
         ulong dt = HistoryDealGetTicket(i);
         if(dt == 0) continue;
         if(HistoryDealGetInteger(dt, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;
         if(m > 0) s += ",";
         double comm = HistoryDealGetDouble(dt, DEAL_COMMISSION);
         double swap = HistoryDealGetDouble(dt, DEAL_SWAP);
         double prof = HistoryDealGetDouble(dt, DEAL_PROFIT);
         s += StringFormat("{\"ticket\":%I64u,\"symbol\":\"%s\",\"side\":\"%s\",\"volume\":%.2f,\"closeTime\":%I64d,\"closePrice\":%.5f,\"profit\":%.2f,\"commission\":%.2f,\"swap\":%.2f,\"netProfit\":%.2f}",
               dt,
               HistoryDealGetString(dt, DEAL_SYMBOL),
               (HistoryDealGetInteger(dt, DEAL_TYPE) == DEAL_TYPE_SELL ? "buy" : "sell"),
               HistoryDealGetDouble(dt, DEAL_VOLUME),
               (long)HistoryDealGetInteger(dt, DEAL_TIME),
               HistoryDealGetDouble(dt, DEAL_PRICE),
               prof, comm, swap, prof + comm + swap);
         m++;
         if(m >= 300) break;
      }
   }
   s += "]";

   if(g_events   != "") s += ",\"events\":["       + g_events   + "]";
   if(g_doneCmds != "") s += ",\"doneCommands\":[" + g_doneCmds + "]";

   s += "}";
   return s;
}

//==================== CONFIG Y COMANDOS ===========================
void ApplyConfig(string resp)
{
   if(StringFind(resp, "\"config\":null") >= 0)
   {
      g_managerOn = false;
      g_beOn = false; g_trOn = false; g_ptOn = false;
      return;
   }

   string cfg = JsonSection(resp, "config");
   if(cfg == "") return;

   int ver = (int)JsonNum(cfg, "version", 0);
   if(ver == g_cfgVersion) return;          // nada nuevo que aplicar
   g_cfgVersion = ver;
   g_managerOn  = true;
   g_units      = JsonStr(cfg, "units", "pips");

   string be = JsonSection(cfg, "breakeven");
   g_beOn      = JsonBool(be, "on", false);
   g_beTrigger = JsonNum(be, "trigger", 15);
   g_beMode    = JsonStr(be, "mode", "above");
   g_beOffset  = JsonNum(be, "offset", 2);
   g_beCosts   = JsonBool(be, "cover_costs", true);

   string tr = JsonSection(cfg, "trailing");
   g_trOn       = JsonBool(tr, "on", false);
   g_trStart    = JsonNum(tr, "start", 20);
   g_trDistance = JsonNum(tr, "distance", 20);

   g_ptCount = 0; g_ptOn = false;
   string arr = JsonArray(cfg, "partials");
   if(arr != "" && StringLen(arr) > 2)
   {
      int pos = 0;
      while(g_ptCount < 4)
      {
         int b = StringFind(arr, "{", pos);
         if(b < 0) break;
         int e = StringFind(arr, "}", b);
         if(e < 0) break;
         string it = StringSubstr(arr, b, e - b + 1);
         double at = JsonNum(it, "at", 0);
         double cl = JsonNum(it, "close", 0);
         if(at > 0 && cl > 0) { g_ptAt[g_ptCount] = at; g_ptClose[g_ptCount] = cl; g_ptCount++; }
         pos = e + 1;
      }
      g_ptOn = (g_ptCount > 0);
   }

   Print("Onyx: ", T("configuracion actualizada v", "config updated v"), g_cfgVersion);
}

void HandleCommands(string resp)
{
   string arr = JsonArray(resp, "commands");
   if(arr == "" || StringLen(arr) < 4) return;

   g_doneCmds = "";
   int pos = 0;
   while(true)
   {
      int b = StringFind(arr, "{", pos);
      if(b < 0) break;
      int e = StringFind(arr, "}", b);
      if(e < 0) break;
      string it  = StringSubstr(arr, b, e - b + 1);
      string id  = JsonStr(it, "id", "");
      string cmd = JsonStr(it, "command", "");
      if(cmd != "")
      {
         RunCommand(cmd);
         if(id != "")
         {
            if(g_doneCmds != "") g_doneCmds += ",";
            g_doneCmds += "\"" + id + "\"";
         }
      }
      pos = e + 1;
   }
}

void Sync()
{
   if(ApiKey == "") { g_lastError = T("Falta la API key", "API key missing"); return; }

   char post[], result[];
   string headers = "Content-Type: application/json\r\n";
   string body = BuildBody();

   int blen = StringToCharArray(body, post, 0, WHOLE_ARRAY, CP_UTF8) - 1;   // sin el 0 final
   if(blen < 0) blen = 0;
   ArrayResize(post, blen);

   string resHeaders;
   ResetLastError();
   int code = WebRequest("POST", g_url, headers, 15000, post, result, resHeaders);

   if(code == -1)
   {
      int err = GetLastError();
      if(err == 4014) g_lastError = T("Permite la URL en Opciones", "Allow the URL in Options");
      else            g_lastError = T("Error de red ", "Network error ") + (string)err;
      return;
   }

   string resp = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);

   if(code != 200)
   {
      string msg = JsonStr(resp, "error", "");
      g_lastError = (msg != "" ? StringSubstr(msg, 0, 60) : "HTTP " + (string)code);
      return;
   }

   g_lastError  = "";
   g_lastSyncOk = TimeCurrent();
   g_events     = "";              // ya viajaron

   ApplyConfig(resp);
   HandleCommands(resp);
}

//==================== GESTION DE POSICIONES =======================
// Marca de parciales ya ejecutados, persistente entre reinicios
string PartialKey(ulong ticket) { return "onyx_p_" + (string)ticket; }

bool PartialDone(ulong ticket, int level)
{
   if(!GlobalVariableCheck(PartialKey(ticket))) return false;
   int mask = (int)GlobalVariableGet(PartialKey(ticket));
   return ((mask & (1 << level)) != 0);
}

void MarkPartial(ulong ticket, int level)
{
   int mask = GlobalVariableCheck(PartialKey(ticket)) ? (int)GlobalVariableGet(PartialKey(ticket)) : 0;
   mask |= (1 << level);
   GlobalVariableSet(PartialKey(ticket), mask);
}

double NormalizeVol(string sym, double vol)
{
   double step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   double vmin = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   if(step <= 0) step = 0.01;
   double v = MathFloor(vol / step) * step;
   if(v < vmin) return 0;
   return NormalizeDouble(v, 2);
}

void ManagePosition(ulong ticket)
{
   if(!PositionSelectByTicket(ticket)) return;

   string sym   = PositionGetString(POSITION_SYMBOL);
   long   type  = PositionGetInteger(POSITION_TYPE);
   double entry = PositionGetDouble(POSITION_PRICE_OPEN);
   double sl    = PositionGetDouble(POSITION_SL);
   double tp    = PositionGetDouble(POSITION_TP);
   double vol   = PositionGetDouble(POSITION_VOLUME);
   double swap  = PositionGetDouble(POSITION_SWAP);
   bool   isBuy = (type == POSITION_TYPE_BUY);
   double price = isBuy ? SymbolInfoDouble(sym, SYMBOL_BID) : SymbolInfoDouble(sym, SYMBOL_ASK);
   int    dg    = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);

   double profitDist = isBuy ? (price - entry) : (entry - price);
   if(profitDist <= 0) return;              // solo actuamos cuando va a favor

   //--------- BREAK EVEN ---------
   if(g_beOn)
   {
      double trigger = UnitsToPrice(sym, g_beTrigger, vol, entry, sl);
      if(trigger > 0 && profitDist >= trigger)
      {
         double offset = UnitsToPrice(sym, g_beOffset, vol, entry, sl);
         double target = entry;

         if(g_beMode == "below")    target = isBuy ? entry - offset : entry + offset;
         else if(g_beMode == "at")  target = entry;
         else
         {
            // "above": el stop cubre comision y swap, para salir a cero de verdad
            double extra = offset;
            if(g_beCosts)
            {
               double costs = MathAbs(PositionCommission(ticket)) + MathAbs(swap);
               double mpp   = MoneyPerPointPerLot(sym);
               if(mpp > 0 && vol > 0)
                  extra += (costs / (mpp * vol)) * SymbolInfoDouble(sym, SYMBOL_POINT);
            }
            target = isBuy ? entry + extra : entry - extra;
         }
         target = NormalizeDouble(target, dg);

         bool better = (sl == 0) || (isBuy ? target > sl : target < sl);
         bool valid  = isBuy ? (target < price) : (target > price);

         if(better && valid && trade.PositionModify(ticket, target, tp))
            LogEvent("breakeven", T("Stop movido a break even", "Stop moved to break even"), sym, (long)ticket, 0);
      }
   }

   //--------- TRAILING ---------
   if(g_trOn)
   {
      double start = UnitsToPrice(sym, g_trStart, vol, entry, sl);
      double dist  = UnitsToPrice(sym, g_trDistance, vol, entry, sl);
      if(start > 0 && dist > 0 && profitDist >= start)
      {
         double target = isBuy ? price - dist : price + dist;
         target = NormalizeDouble(target, dg);
         bool better = (sl == 0) || (isBuy ? target > sl : target < sl);
         bool valid  = isBuy ? (target < price) : (target > price);
         if(better && valid && trade.PositionModify(ticket, target, tp))
            LogEvent("trailing", T("Stop ajustado", "Stop trailed"), sym, (long)ticket, 0);
      }
   }

   //--------- TP PARCIALES ---------
   if(g_ptOn && g_ptCount > 0)
   {
      for(int i = 0; i < g_ptCount; i++)
      {
         if(PartialDone(ticket, i)) continue;
         double at = UnitsToPrice(sym, g_ptAt[i], vol, entry, sl);
         if(at <= 0 || profitDist < at) continue;

         double closeVol = NormalizeVol(sym, vol * (g_ptClose[i] / 100.0));
         if(closeVol <= 0)
         {
            MarkPartial(ticket, i);
            LogEvent("info", T("Lote demasiado pequeno para el parcial", "Lot too small to split"), sym, (long)ticket, 0);
            continue;
         }
         if(closeVol >= vol) closeVol = NormalizeVol(sym, vol);

         if(trade.PositionClosePartial(ticket, closeVol))
         {
            MarkPartial(ticket, i);
            LogEvent("partial", StringFormat(T("Cerrado %.0f%% en TP%d", "Closed %.0f%% at TP%d"), g_ptClose[i], i + 1), sym, (long)ticket, closeVol);
            return;                    // el volumen cambio: seguimos en el proximo tick
         }
      }
   }
}

void ManageAll()
{
   if(!g_managerOn) return;
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED)) return;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong tk = PositionGetTicket(i);
      if(tk == 0) continue;
      ManagePosition(tk);
   }
}

//==================== ACCIONES RAPIDAS ============================
void RunCommand(string cmd)
{
   int done = 0;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong tk = PositionGetTicket(i);
      if(tk == 0 || !PositionSelectByTicket(tk)) continue;

      string sym   = PositionGetString(POSITION_SYMBOL);
      double prof  = PositionGetDouble(POSITION_PROFIT);
      double vol   = PositionGetDouble(POSITION_VOLUME);
      double entry = PositionGetDouble(POSITION_PRICE_OPEN);
      double tp    = PositionGetDouble(POSITION_TP);
      int    dg    = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);

      if(cmd == "close_all")
      { if(trade.PositionClose(tk)) done++; }
      else if(cmd == "close_profitable")
      { if(prof > 0 && trade.PositionClose(tk)) done++; }
      else if(cmd == "close_losing")
      { if(prof < 0 && trade.PositionClose(tk)) done++; }
      else if(cmd == "close_half")
      {
         double half = NormalizeVol(sym, vol / 2.0);
         if(half > 0 && trade.PositionClosePartial(tk, half)) done++;
      }
      else if(cmd == "sl_to_be")
      {
         if(trade.PositionModify(tk, NormalizeDouble(entry, dg), tp)) done++;
      }
   }

   string txt = T("Accion ejecutada: ", "Action done: ") + cmd;
   LogEvent(cmd == "close_all" ? "close_all" : "info", txt + StringFormat(" (%d)", done), "", 0, done);
   Print("Onyx: ", txt, " (", done, ")");
}

//==================== CICLO DE VIDA ===============================
int OnInit()
{
   g_url   = ServidorUrl + "/api/v1/sync";
   g_login = AccountInfoInteger(ACCOUNT_LOGIN);
   trade.SetAsyncMode(false);
   trade.SetDeviationInPoints(20);

   if(ApiKey == "")
      Print("Onyx: ", T("Falta la API key. Pegala en los inputs.", "API key missing. Paste it in the inputs."));

   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
      Print("Onyx: ", T("Activa AlgoTrading para que pueda gestionar.", "Turn on AlgoTrading so it can manage."));

   DrawPanel();
   EventSetTimer(SYNC_SECS);
   Sync();
   DrawPanel();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   DeletePanel();
}

void OnTimer()
{
   Sync();
   ManageAll();
   DrawPanel();
}

void OnTick()
{
   ManageAll();          // reaccionar rapido entre sincronizaciones
}

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   if(id != CHARTEVENT_OBJECT_CLICK) return;
   if(StringFind(sparam, PREFIX) != 0) return;

   ObjectSetInteger(0, sparam, OBJPROP_STATE, false);
   string key = StringSubstr(sparam, StringLen(PREFIX));

   // interruptores locales de modulo
   if(key == "bbe") { g_beOn = !g_beOn; LogEvent("info", "Break even " + (g_beOn ? "ON" : "OFF")); }
   if(key == "btr") { g_trOn = !g_trOn; LogEvent("info", "Trailing "   + (g_trOn ? "ON" : "OFF")); }
   if(key == "bpt") { g_ptOn = !g_ptOn; LogEvent("info", "Partials "   + (g_ptOn ? "ON" : "OFF")); }

   // acciones rapidas: siempre piden confirmacion
   if(key == "bslbe" || key == "bhalf" || key == "bwin" || key == "ball")
   {
      string what = "";
      string cmd  = "";
      if(key == "bslbe") { what = T("Poner el SL en break even?", "Move SL to break even?");   cmd = "sl_to_be"; }
      if(key == "bhalf") { what = T("Cerrar la mitad de todo?", "Close half of everything?");  cmd = "close_half"; }
      if(key == "bwin")  { what = T("Cerrar las ganadoras?", "Close winning trades?");         cmd = "close_profitable"; }
      if(key == "ball")  { what = T("CERRAR TODAS las posiciones?", "CLOSE ALL positions?");   cmd = "close_all"; }

      if(MessageBox(what, "Onyx Manager", MB_YESNO | MB_ICONQUESTION) == IDYES)
         RunCommand(cmd);
   }

   DrawPanel();
}
//+------------------------------------------------------------------+
