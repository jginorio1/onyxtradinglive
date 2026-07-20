//+------------------------------------------------------------------+
//|                                            OnyxConnector_MT5.mq5  |
//|            Onyx Trading Live - Conector de cuenta MT5            |
//|                                                                  |
//|  Lee la cuenta (info, historial de operaciones y posiciones      |
//|  abiertas) y las envia a tu servidor Onyx por HTTPS (WebRequest) |
//|  autenticado con una API key. Sincronizacion incremental.        |
//|                                                                  |
//|  IMPORTANTE: en MT5 -> Herramientas -> Opciones -> Asesores      |
//|  Expertos, activa "Permitir WebRequest para" y añade tu dominio  |
//|  (ej. https://api.onyxtradinglive.com).                          |
//+------------------------------------------------------------------+
#property copyright "Onyx Trading Live"
#property version   "1.00"
#property description "Conecta tu cuenta MT5 con Onyx Trading Live (solo lectura + envio de operaciones)"
#property strict

//====================================================================
//  INPUTS
//====================================================================
input group "=== CONEXION ONYX ==="
input string InpApiUrl       = "https://onyxtradinglive.vercel.app/api/v1/sync"; // URL de tu API Onyx (whitelist en Opciones)
input string InpApiKey       = "";      // Tu API key (desde tu panel de Onyx Trading Live)
input int    InpSyncSeconds  = 60;      // Cada cuantos segundos sincroniza
input int    InpHistoryDays  = 120;     // Dias de historial a enviar en la primera sincronizacion
input bool   InpSendOpen     = true;    // Enviar tambien las posiciones abiertas
input bool   InpShowPanel    = true;    // Mostrar panel de estado en el grafico

//====================================================================
//  GLOBALES
//====================================================================
#define PFX "ONYX_"
datetime lastSyncedClose = 0;   // ultima hora de cierre ya enviada (persistente)
datetime lastSyncOK      = 0;   // ultima sincronizacion correcta
string   lastStatus      = "Iniciando...";
color    lastStatusCol   = C'240,190,90';
int      sentTotal       = 0;

string GVName(){ return PFX+"lastclose_"+(string)AccountInfoInteger(ACCOUNT_LOGIN); }

//+------------------------------------------------------------------+
int OnInit()
  {
   if(InpApiKey=="")
      Print("AVISO: falta InpApiKey. Ponla desde tu panel de Onyx Trading Live.");

   string gv=GVName();
   if(GlobalVariableCheck(gv)) lastSyncedClose=(datetime)GlobalVariableGet(gv);
   else                        lastSyncedClose=TimeCurrent()-(datetime)InpHistoryDays*86400;

   EventSetTimer(MathMax(5,InpSyncSeconds));
   DrawPanel();
   Print("Onyx Connector iniciado. Cuenta #",AccountInfoInteger(ACCOUNT_LOGIN),
         "  Broker: ",AccountInfoString(ACCOUNT_COMPANY));
   SyncNow();   // primera sincronizacion inmediata
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
//| Escapa una cadena para JSON                                      |
//+------------------------------------------------------------------+
string JEsc(string s)
  {
   string o="";
   for(int i=0;i<StringLen(s);i++)
     {
      ushort c=StringGetCharacter(s,i);
      if(c=='"' || c=='\\') { o+="\\"; o+=ShortToString(c); }
      else if(c=='\n') o+="\\n";
      else if(c=='\r') o+="";
      else if(c=='\t') o+=" ";
      else o+=ShortToString(c);
     }
   return o;
  }
string JNum(double v,int d=2){ return DoubleToString(v,d); }

//+------------------------------------------------------------------+
//| JSON de la cuenta                                                |
//+------------------------------------------------------------------+
string AccountJson()
  {
   int dig=(int)SymbolInfoInteger(_Symbol,SYMBOL_DIGITS);
   string j="\"account\":{";
   j+="\"login\":"+(string)AccountInfoInteger(ACCOUNT_LOGIN)+",";
   j+="\"broker\":\""+JEsc(AccountInfoString(ACCOUNT_COMPANY))+"\",";
   j+="\"server\":\""+JEsc(AccountInfoString(ACCOUNT_SERVER))+"\",";
   j+="\"name\":\""+JEsc(AccountInfoString(ACCOUNT_NAME))+"\",";
   j+="\"currency\":\""+JEsc(AccountInfoString(ACCOUNT_CURRENCY))+"\",";
   j+="\"leverage\":"+(string)AccountInfoInteger(ACCOUNT_LEVERAGE)+",";
   j+="\"balance\":"+JNum(AccountInfoDouble(ACCOUNT_BALANCE))+",";
   j+="\"equity\":"+JNum(AccountInfoDouble(ACCOUNT_EQUITY))+",";
   j+="\"platform\":\"MT5\"";
   j+="}";
   return j;
  }

//+------------------------------------------------------------------+
//| JSON de operaciones cerradas desde 'fromT'. Actualiza maxClose.  |
//+------------------------------------------------------------------+
string ClosedTradesJson(datetime fromT, datetime &maxClose, int &count)
  {
   count=0; maxClose=fromT;
   if(!HistorySelect(fromT-1, TimeCurrent()+60)) return "[]";
   int total=HistoryDealsTotal();

   ulong    pid[];   string psym[];  int pdir[];   double pvol[];
   datetime potime[];double poprice[];datetime pctime[];double pcprice[];
   double   pprofit[];double pcomm[]; double pswap[]; bool pclosed[]; double psl[]; double ptp[];

   for(int i=0;i<total;i++)
     {
      ulong tk=HistoryDealGetTicket(i); if(tk==0) continue;
      long entry=HistoryDealGetInteger(tk,DEAL_ENTRY);
      ulong posid=(ulong)HistoryDealGetInteger(tk,DEAL_POSITION_ID);
      // buscar/crear indice
      int at=-1; for(int k=0;k<ArraySize(pid);k++) if(pid[k]==posid){ at=k; break; }
      if(at<0)
        {
         at=ArraySize(pid);
         ArrayResize(pid,at+1); ArrayResize(psym,at+1); ArrayResize(pdir,at+1); ArrayResize(pvol,at+1);
         ArrayResize(potime,at+1); ArrayResize(poprice,at+1); ArrayResize(pctime,at+1); ArrayResize(pcprice,at+1);
         ArrayResize(pprofit,at+1); ArrayResize(pcomm,at+1); ArrayResize(pswap,at+1); ArrayResize(pclosed,at+1);
         ArrayResize(psl,at+1); ArrayResize(ptp,at+1);
         pid[at]=posid; psym[at]=""; pdir[at]=0; pvol[at]=0; potime[at]=0; poprice[at]=0;
         pctime[at]=0; pcprice[at]=0; pprofit[at]=0; pcomm[at]=0; pswap[at]=0; pclosed[at]=false; psl[at]=0; ptp[at]=0;
        }
      double price=HistoryDealGetDouble(tk,DEAL_PRICE);
      datetime dtime=(datetime)HistoryDealGetInteger(tk,DEAL_TIME);
      if(entry==DEAL_ENTRY_IN)
        {
         psym[at]=HistoryDealGetString(tk,DEAL_SYMBOL);
         pdir[at]=(HistoryDealGetInteger(tk,DEAL_TYPE)==DEAL_TYPE_BUY)?1:-1;
         pvol[at]=HistoryDealGetDouble(tk,DEAL_VOLUME);
         potime[at]=dtime; poprice[at]=price;
        }
      else if(entry==DEAL_ENTRY_OUT || entry==DEAL_ENTRY_OUT_BY)
        {
         pprofit[at]+=HistoryDealGetDouble(tk,DEAL_PROFIT);
         pcomm[at]  +=HistoryDealGetDouble(tk,DEAL_COMMISSION);
         pswap[at]  +=HistoryDealGetDouble(tk,DEAL_SWAP);
         pctime[at]=dtime; pcprice[at]=price; pclosed[at]=true;
         if(psym[at]=="") psym[at]=HistoryDealGetString(tk,DEAL_SYMBOL);
        }
     }

   string arr="["; bool first=true;
   for(int k=0;k<ArraySize(pid);k++)
     {
      if(!pclosed[k]) continue;
      if(pctime[k]<=fromT) continue;             // ya enviada antes
      if(pctime[k]>maxClose) maxClose=pctime[k];
      if(!first) arr+=","; first=false;
      arr+="{";
      arr+="\"ticket\":"+(string)pid[k]+",";
      arr+="\"symbol\":\""+JEsc(psym[k])+"\",";
      arr+="\"side\":\""+(pdir[k]>0?"buy":"sell")+"\",";
      arr+="\"volume\":"+JNum(pvol[k],2)+",";
      arr+="\"openTime\":"+(string)(long)potime[k]+",";
      arr+="\"openPrice\":"+JNum(poprice[k],5)+",";
      arr+="\"closeTime\":"+(string)(long)pctime[k]+",";
      arr+="\"closePrice\":"+JNum(pcprice[k],5)+",";
      arr+="\"profit\":"+JNum(pprofit[k])+",";
      arr+="\"commission\":"+JNum(pcomm[k])+",";
      arr+="\"swap\":"+JNum(pswap[k])+",";
      arr+="\"netProfit\":"+JNum(pprofit[k]+pcomm[k]+pswap[k]);
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
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      ulong tk=PositionGetTicket(i); if(tk==0) continue;
      if(!PositionSelectByTicket(tk)) continue;
      if(!first) arr+=","; first=false;
      arr+="{";
      arr+="\"ticket\":"+(string)tk+",";
      arr+="\"symbol\":\""+JEsc(PositionGetString(POSITION_SYMBOL))+"\",";
      arr+="\"side\":\""+((PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY)?"buy":"sell")+"\",";
      arr+="\"volume\":"+JNum(PositionGetDouble(POSITION_VOLUME),2)+",";
      arr+="\"openTime\":"+(string)(long)PositionGetInteger(POSITION_TIME)+",";
      arr+="\"openPrice\":"+JNum(PositionGetDouble(POSITION_PRICE_OPEN),5)+",";
      arr+="\"sl\":"+JNum(PositionGetDouble(POSITION_SL),5)+",";
      arr+="\"tp\":"+JNum(PositionGetDouble(POSITION_TP),5)+",";
      arr+="\"profit\":"+JNum(PositionGetDouble(POSITION_PROFIT));
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
   if(len>0) ArrayResize(data,len);   // sin el 0 final
   char result[]; string rh;
   string headers="Content-Type: application/json\r\n";
   headers+="Authorization: Bearer "+InpApiKey+"\r\n";
   ResetLastError();
   int code=WebRequest("POST",InpApiUrl,headers,10000,data,result,rh);
   response=CharArrayToString(result,0,-1,CP_UTF8);
   if(code==-1)
     {
      int err=GetLastError();
      lastStatus="Error WebRequest ("+(string)err+"). Permite la URL en Opciones.";
      lastStatusCol=C'235,110,110';
      Print("Onyx: ",lastStatus);
      return false;
     }
   if(code>=200 && code<300) return true;
   lastStatus="Servidor respondio "+(string)code;
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
   payload+="\"sentAt\":"+(string)(long)TimeCurrent()+",";
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
      lastStatus="Sincronizado ("+(string)nClosed+" nuevas)";
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
   ObjectSetInteger(0,nm,OBJPROP_FONTSIZE,fs); ObjectSetString(0,nm,OBJPROP_FONT,bold?"Segoe UI Semibold":"Segoe UI");
   ObjectSetInteger(0,nm,OBJPROP_CORNER,CORNER_LEFT_UPPER); ObjectSetInteger(0,nm,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,nm,OBJPROP_HIDDEN,true);
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
   ObjectSetInteger(0,bn,OBJPROP_BACK,false); ObjectSetInteger(0,bn,OBJPROP_SELECTABLE,false); ObjectSetInteger(0,bn,OBJPROP_HIDDEN,true);

   Lbl("t",X+12,Y+10,"◆ ONYX TRADING LIVE",C'150,140,235',11,true);
   Lbl("a",X+12,Y+30,"Cuenta #"+(string)AccountInfoInteger(ACCOUNT_LOGIN),C'180,183,190',9);
   Lbl("s",X+12,Y+48,lastStatus,lastStatusCol,9,true);
   string last=(lastSyncOK>0)?TimeToString(lastSyncOK,TIME_MINUTES|TIME_SECONDS):"--";
   Lbl("l",X+12,Y+66,"Ultimo envio: "+last,C'150,153,160',8);
   Lbl("c",X+12,Y+82,"Operaciones enviadas: "+(string)sentTotal,C'150,153,160',8);
   ChartRedraw();
  }
//+------------------------------------------------------------------+

