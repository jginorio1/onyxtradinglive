//+------------------------------------------------------------------+
//|                                            OnyxConnector_MT4.mq4  |
//|            Onyx Trading Live - Conector de cuenta MT4            |
//|                                                                  |
//|  Lee la cuenta (info, historial de operaciones y posiciones      |
//|  abiertas) y las envia a tu servidor Onyx por HTTPS (WebRequest) |
//|  autenticado con una API key. Sincronizacion incremental.        |
//|                                                                  |
//|  IMPORTANTE: en MT4 -> Herramientas -> Opciones -> Asesores      |
//|  Expertos, activa "Permitir WebRequest para" y añade tu dominio  |
//|  (ej. https://api.onyxtradinglive.com).                          |
//+------------------------------------------------------------------+
#property copyright "Onyx Trading Live"
#property version   "1.00"
#property strict
#property description "Conecta tu cuenta MT4 con Onyx Trading Live (solo lectura + envio de operaciones)"

//====================================================================
//  INPUTS
//====================================================================
extern string InpApiUrl      = "https://onyxtradinglive.vercel.app/api/v1/sync"; // URL de tu API Onyx (whitelist en Opciones)
extern string InpApiKey      = "";      // Tu API key (desde tu panel de Onyx Trading Live)
extern int    InpSyncSeconds = 60;      // Cada cuantos segundos sincroniza
extern int    InpHistoryDays = 120;     // Dias de historial en la primera sincronizacion
extern bool   InpSendOpen    = true;    // Enviar tambien las posiciones abiertas
extern bool   InpShowPanel   = true;    // Mostrar panel de estado en el grafico

//====================================================================
//  GLOBALES
//====================================================================
#define PFX "ONYX_"
datetime lastSyncedClose = 0;
datetime lastSyncOK      = 0;
string   lastStatus      = "Iniciando...";
color    lastStatusCol   = C'240,190,90';
int      sentTotal       = 0;

string GVName(){ return PFX+"lastclose_"+IntegerToString(AccountNumber()); }

//+------------------------------------------------------------------+
int OnInit()
  {
   if(InpApiKey=="")
      Print("AVISO: falta InpApiKey. Ponla desde tu panel de Onyx Trading Live.");

   string gv=GVName();
   if(GlobalVariableCheck(gv)) lastSyncedClose=(datetime)GlobalVariableGet(gv);
   else                        lastSyncedClose=TimeCurrent()-InpHistoryDays*86400;

   EventSetTimer(MathMax(5,InpSyncSeconds));
   DrawPanel();
   Print("Onyx Connector (MT4) iniciado. Cuenta #",AccountNumber()," Broker: ",AccountCompany());
   SyncNow();
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   ObjectsDeleteAll(0,PFX);
   ChartRedraw();
  }

void OnTimer(){ SyncNow(); DrawPanel(); }

//+------------------------------------------------------------------+
//| Escapa una cadena para JSON (MT4-safe)                           |
//+------------------------------------------------------------------+
string JEsc(string s)
  {
   string o=""; int n=StringLen(s);
   for(int i=0;i<n;i++)
     {
      string ch=StringSubstr(s,i,1);
      if(ch=="\"" || ch=="\\") o=o+"\\"+ch;
      else if(ch=="\n" || ch=="\r" || ch=="\t") o=o+" ";
      else o=o+ch;
     }
   return o;
  }
string JNum(double v,int d=2){ return DoubleToString(v,d); }

//+------------------------------------------------------------------+
//| JSON de la cuenta                                                |
//+------------------------------------------------------------------+
string AccountJson()
  {
   string j="\"account\":{";
   j+="\"login\":"+IntegerToString(AccountNumber())+",";
   j+="\"broker\":\""+JEsc(AccountCompany())+"\",";
   j+="\"server\":\""+JEsc(AccountServer())+"\",";
   j+="\"name\":\""+JEsc(AccountName())+"\",";
   j+="\"currency\":\""+JEsc(AccountCurrency())+"\",";
   j+="\"leverage\":"+IntegerToString(AccountLeverage())+",";
   j+="\"balance\":"+JNum(AccountBalance())+",";
   j+="\"equity\":"+JNum(AccountEquity())+",";
   j+="\"platform\":\"MT4\"";
   j+="}";
   return j;
  }

//+------------------------------------------------------------------+
//| JSON de operaciones cerradas desde 'fromT'. Actualiza maxClose.  |
//+------------------------------------------------------------------+
string ClosedTradesJson(datetime fromT, datetime &maxClose, int &count)
  {
   count=0; maxClose=fromT;
   string arr="["; bool first=true;
   int total=OrdersHistoryTotal();
   for(int i=0;i<total;i++)
     {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_HISTORY)) continue;
      if(OrderType()>OP_SELL) continue;              // solo compras/ventas (no balance/credito)
      datetime ct=OrderCloseTime();
      if(ct<=fromT) continue;
      if(ct>maxClose) maxClose=ct;
      double prof=OrderProfit(), comm=OrderCommission(), sw=OrderSwap();
      if(!first) arr+=","; first=false;
      arr+="{";
      arr+="\"ticket\":"+IntegerToString(OrderTicket())+",";
      arr+="\"symbol\":\""+JEsc(OrderSymbol())+"\",";
      arr+="\"side\":\""+(OrderType()==OP_BUY?"buy":"sell")+"\",";
      arr+="\"volume\":"+JNum(OrderLots(),2)+",";
      arr+="\"openTime\":"+IntegerToString((long)OrderOpenTime())+",";
      arr+="\"openPrice\":"+JNum(OrderOpenPrice(),5)+",";
      arr+="\"closeTime\":"+IntegerToString((long)ct)+",";
      arr+="\"closePrice\":"+JNum(OrderClosePrice(),5)+",";
      arr+="\"profit\":"+JNum(prof)+",";
      arr+="\"commission\":"+JNum(comm)+",";
      arr+="\"swap\":"+JNum(sw)+",";
      arr+="\"netProfit\":"+JNum(prof+comm+sw);
      arr+="}";
      count++;
     }
   arr+="]";
   return arr;
  }

//+------------------------------------------------------------------+
//| JSON de posiciones abiertas                                      |
//+------------------------------------------------------------------+
string OpenPositionsJson()
  {
   string arr="["; bool first=true;
   int total=OrdersTotal();
   for(int i=0;i<total;i++)
     {
      if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES)) continue;
      if(OrderType()>OP_SELL) continue;              // ignora ordenes pendientes
      if(!first) arr+=","; first=false;
      arr+="{";
      arr+="\"ticket\":"+IntegerToString(OrderTicket())+",";
      arr+="\"symbol\":\""+JEsc(OrderSymbol())+"\",";
      arr+="\"side\":\""+(OrderType()==OP_BUY?"buy":"sell")+"\",";
      arr+="\"volume\":"+JNum(OrderLots(),2)+",";
      arr+="\"openTime\":"+IntegerToString((long)OrderOpenTime())+",";
      arr+="\"openPrice\":"+JNum(OrderOpenPrice(),5)+",";
      arr+="\"sl\":"+JNum(OrderStopLoss(),5)+",";
      arr+="\"tp\":"+JNum(OrderTakeProfit(),5)+",";
      arr+="\"profit\":"+JNum(OrderProfit());
      arr+="}";
     }
   arr+="]";
   return arr;
  }

//+------------------------------------------------------------------+
//| Envia el POST a Onyx                                             |
//+------------------------------------------------------------------+
bool HttpPost(string payload,string &response)
  {
   char data[]; int len=StringToCharArray(payload,data,0,StringLen(payload),CP_UTF8);
   if(len>0) ArrayResize(data,len);
   char result[]; string rh;
   string headers="Content-Type: application/json\r\nAuthorization: Bearer "+InpApiKey+"\r\n";
   ResetLastError();
   int code=WebRequest("POST",InpApiUrl,headers,10000,data,result,rh);
   response=CharArrayToString(result,0,-1,CP_UTF8);
   if(code==-1)
     {
      int err=GetLastError();
      lastStatus="Error WebRequest ("+IntegerToString(err)+"). Permite la URL en Opciones.";
      lastStatusCol=C'235,110,110';
      Print("Onyx: ",lastStatus);
      return false;
     }
   if(code>=200 && code<300) return true;
   lastStatus="Servidor respondio "+IntegerToString(code);
   lastStatusCol=C'235,110,110';
   Print("Onyx: HTTP ",code,"  ",response);
   return false;
  }

//+------------------------------------------------------------------+
//| Sincroniza ahora                                                 |
//+------------------------------------------------------------------+
void SyncNow()
  {
   if(InpApiKey=="")
     { lastStatus="Falta API key"; lastStatusCol=C'240,190,90'; DrawPanel(); return; }

   datetime maxClose=lastSyncedClose; int nClosed=0;
   string closed = ClosedTradesJson(lastSyncedClose, maxClose, nClosed);
   string opens  = InpSendOpen ? OpenPositionsJson() : "[]";

   string payload="{";
   payload+="\"apiKey\":\""+JEsc(InpApiKey)+"\",";
   payload+="\"sentAt\":"+IntegerToString((long)TimeCurrent())+",";
   payload+=AccountJson()+",";
   payload+="\"closedTrades\":"+closed+",";
   payload+="\"openPositions\":"+opens;
   payload+="}";

   string resp="";
   if(HttpPost(payload,resp))
     {
      if(maxClose>lastSyncedClose)
        { lastSyncedClose=maxClose; GlobalVariableSet(GVName(),(double)lastSyncedClose); }
      sentTotal+=nClosed;
      lastSyncOK=TimeCurrent();
      lastStatus="Sincronizado ("+IntegerToString(nClosed)+" nuevas)";
      lastStatusCol=C'90,210,150';
      Print("Onyx: sync OK. Nuevas cerradas=",nClosed);
     }
   DrawPanel();
  }

//+------------------------------------------------------------------+
//| Panel de estado                                                  |
//+------------------------------------------------------------------+
void Lbl(string n,int x,int y,string t,color c,int fs=9,bool bold=false)
  {
   string nm=PFX+n; if(ObjectFind(0,nm)<0) ObjectCreate(0,nm,OBJ_LABEL,0,0,0);
   ObjectSetInteger(0,nm,OBJPROP_XDISTANCE,x); ObjectSetInteger(0,nm,OBJPROP_YDISTANCE,y);
   ObjectSetString(0,nm,OBJPROP_TEXT,t); ObjectSetInteger(0,nm,OBJPROP_COLOR,c);
   ObjectSetInteger(0,nm,OBJPROP_FONTSIZE,fs); ObjectSetString(0,nm,OBJPROP_FONT,bold?"Arial Bold":"Arial");
   ObjectSetInteger(0,nm,OBJPROP_CORNER,CORNER_LEFT_UPPER); ObjectSetInteger(0,nm,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,nm,OBJPROP_BACK,false);
  }
void DrawPanel()
  {
   if(!InpShowPanel){ ObjectsDeleteAll(0,PFX); return; }
   int X=14,Y=20,W=270;
   string bn=PFX+"bg";
   if(ObjectFind(0,bn)<0) ObjectCreate(0,bn,OBJ_RECTANGLE_LABEL,0,0,0);
   ObjectSetInteger(0,bn,OBJPROP_XDISTANCE,X); ObjectSetInteger(0,bn,OBJPROP_YDISTANCE,Y);
   ObjectSetInteger(0,bn,OBJPROP_XSIZE,W); ObjectSetInteger(0,bn,OBJPROP_YSIZE,104);
   ObjectSetInteger(0,bn,OBJPROP_BGCOLOR,C'18,18,22'); ObjectSetInteger(0,bn,OBJPROP_BORDER_TYPE,BORDER_FLAT);
   ObjectSetInteger(0,bn,OBJPROP_COLOR,C'70,72,80'); ObjectSetInteger(0,bn,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,bn,OBJPROP_BACK,false); ObjectSetInteger(0,bn,OBJPROP_SELECTABLE,false);

   Lbl("t",X+12,Y+10,"* ONYX TRADING LIVE",C'150,140,235',10,true);
   Lbl("a",X+12,Y+30,"Cuenta #"+IntegerToString(AccountNumber()),C'180,183,190',9);
   Lbl("s",X+12,Y+48,lastStatus,lastStatusCol,9,true);
   string last=(lastSyncOK>0)?TimeToString(lastSyncOK,TIME_MINUTES|TIME_SECONDS):"--";
   Lbl("l",X+12,Y+66,"Ultimo envio: "+last,C'150,153,160',8);
   Lbl("c",X+12,Y+82,"Operaciones enviadas: "+IntegerToString(sentTotal),C'150,153,160',8);
   ChartRedraw();
  }
//+------------------------------------------------------------------+
