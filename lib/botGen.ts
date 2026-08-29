import type { BotSpec } from '@/lib/botSpec';

// ============================================================
// Generador del EA MT5 (Fase 2). Produce un .mq5 AUTÓNOMO y compilable a partir
// del spec: entrada por catálogo (cruce de medias, RSI, Donchian, ruptura de
// swing, hora), sesgo de tendencia, SL por ATR, TP1 parcial + runner + break-even
// + trailing + time-stop, riesgo %, cap diario, límites de fondeo (estático/
// trailing/trailing-BE), frenos de cuenta, objetivo de fase, horario, panel.
// NO incluye el motor de noticias (usa el filtro de Onyx / fase 2.1).
// El código es responsabilidad del trader: compilar en MetaEditor y probar en DEMO.
// ============================================================

const b = (v: boolean) => (v ? 'true' : 'false');
const TF: Record<string, string> = { M1: 'PERIOD_M1', M5: 'PERIOD_M5', M15: 'PERIOD_M15', M30: 'PERIOD_M30', H1: 'PERIOD_H1', H4: 'PERIOD_H4', D1: 'PERIOD_D1' };
const tf = (x: string) => TF[x] || 'PERIOD_M5';
const q = (s: string) => '"' + String(s).replace(/"/g, "'") + '"';

export function renderMT5(spec: BotSpec): string {
  const s = spec;
  const trig = { breakout_swing: 0, ma_cross: 1, rsi: 2, donchian: 3, time: 4 }[s.entryTrigger] ?? 1;
  return `//+------------------------------------------------------------------+
//|  ${s.name}  ·  generado por Onyx Bot Builder                       |
//|  Motor autónomo: entrada por catálogo + gestión + límites de fondeo|
//|  Compila en MetaEditor. PRUEBA EN DEMO antes de real.              |
//+------------------------------------------------------------------+
#property copyright ${q(s.name)}
#property version   "1.00"
#property strict
#include <Trade/Trade.mqh>
#include <Trade/PositionInfo.mqh>
CTrade        trade;
CPositionInfo pos;

enum ENUM_ACCT_MODE { MODE_FASE1=0, MODE_FASE2=1, MODE_REAL=2 };
enum ENUM_DD_TYPE   { DD_TRAIL=0, DD_STATIC=1, DD_TRAIL_BE=2 };
enum ENUM_ENTRY     { ENT_SWING=0, ENT_MA=1, ENT_RSI=2, ENT_DONCH=3, ENT_TIME=4 };

//====================== INPUTS (valores de tu receta) ======================
input string  InpComment      = ${q(s.name)};          // Nombre/comentario del bot
input string  InpSymbol       = ${q(s.symbol)};        // Instrumento (vacio = grafico)
input long    InpMagic        = ${s.magic};            // Magic unico
input ENUM_TIMEFRAMES InpTF    = ${tf(s.tf)};          // Temporalidad de ejecucion

input ENUM_ENTRY InpEntry     = ${trig};               // Gatillo de entrada
input int     InpMAfast       = 12;                    // (Cruce) Media rapida
input int     InpMAslow       = 50;                    // (Cruce) Media lenta
input int     InpRSIperiod    = 14;                    // (RSI) Periodo
input double  InpRSIos        = 30;                    // (RSI) Sobreventa (compra)
input double  InpRSIob        = 70;                    // (RSI) Sobrecompra (venta)
input int     InpDonchN       = 20;                    // (Donchian) Velas del canal
input int     InpMicroSwing   = ${s.microSwing};       // (Swing) Velas a cada lado
input int     InpEntryHour    = 9;                     // (Hora) Hora de entrada (servidor)

input int     InpTrendMode    = ${s.trendMode};        // Sesgo: 0 media 1 estructura 2 donchian
input ENUM_TIMEFRAMES InpTrendTF = ${tf(s.trendTF)};   // Temporalidad del sesgo
input int     InpTrendMA      = 50;                    // (Sesgo media) Periodo
input int     InpTrendSwing   = 6;                     // (Sesgo estructura) Swing
input int     InpTrendDonchN  = 20;                    // (Sesgo donchian) Velas
input bool    InpAllowLongs   = ${b(s.allowLongs)};    // Permitir compras
input bool    InpAllowShorts  = ${b(s.allowShorts)};   // Permitir ventas
input int     InpSignalFromH  = ${s.signalFromH};      // Ventana señales: hora inicio
input int     InpSignalFromM  = ${s.signalFromM};      // ...minuto inicio
input int     InpSignalToH    = ${s.signalToH};        // Ventana señales: hora fin
input int     InpSignalToM    = ${s.signalToM};        // ...minuto fin
input int     InpMaxTradesPerDay = ${s.maxTradesPerDay}; // Tope ops/dia (0=sin tope)

input int     InpATRPeriod    = 14;                    // Periodo ATR
input double  InpSLBufferATR  = ${s.slBufferATR};      // SL = esto x ATR
input double  InpTP1_R        = ${s.tp1R};             // TP parcial en R
input double  InpPartialPct   = ${s.partialPct};       // % que cierra en TP1
input double  InpRunnerMaxR   = ${s.runnerMaxR};       // Tope del runner (R)
input bool    InpUseTrail     = ${b(s.useTrail)};      // Trailing tras TP1
input double  InpTrail_ATRcoef= ${s.trailATRcoef};     // Trailing = esto x ATR
input double  InpBEOffsetR    = 0.0;                   // BE + offset en R
input int     InpTimeStopBars = ${s.timeStopBars};     // Time-stop antes de TP1 (0=off)

input double  InpRiskPct      = ${s.riskPct};          // Riesgo por operacion (%)
input double  InpMaxLots      = ${s.maxLots};          // Tope de lotes
input double  InpDailyLossCapPct = ${s.dailyLossCapPct}; // Cap diario de la cuenta (%)

input string  InpFirmName     = ${q(s.firmName)};      // Nombre del fondeo (etiqueta)
input ENUM_DD_TYPE InpDDType   = ${s.ddType};          // Tipo de DD total del firm
input double  InpFirmTotalLimitPct = ${s.firmTotalLimitPct}; // Limite total del firm (%)
input double  InpAcctSoftStopPct = ${s.acctSoftStopPct};  // Freno suave diario (%)
input double  InpAcctDailyStopPct= ${s.acctDailyStopPct}; // Freno duro diario (%)
input double  InpAcctMaxDDPct    = ${s.acctMaxDDPct};     // Freno total (%)

input ENUM_ACCT_MODE InpAccountMode = ${s.accountMode}; // Fase de la cuenta
input double  InpInitBalance  = ${s.initBalance};      // Balance inicial (0=auto)
input double  InpTargetP1     = ${s.targetP1};         // Objetivo Fase 1 (%)
input double  InpTargetP2     = ${s.targetP2};         // Objetivo Fase 2 (%)
input bool    InpHaltAtTarget = true;                  // Al llegar al objetivo, deja de abrir

input bool    InpUseDayClose  = ${b(s.useDayClose)};   // Cerrar al fin de sesion
input int     InpForceCloseHourNY = ${s.forceCloseHourNY}; // Hora de cierre (servidor)
input int     InpForceCloseMinNY  = ${s.forceCloseMinNY};  // Minuto de cierre
input bool    InpNoWeekend    = ${b(s.noWeekend)};     // Cerrar viernes / no fin de semana
input int     InpFridayHour   = 21;                    // Hora de cierre del viernes
input bool    InpShowPanel    = true;                  // Mostrar panel en el grafico
input int     InpPanelX       = 12;
input int     InpPanelY       = 20;

//====================== GLOBALES ======================
string S=""; int gDigits=0; double point=0, minStop=0;
int atrH=INVALID_HANDLE, maF=INVALID_HANDLE, maS=INVALID_HANDLE, rsiH=INVALID_HANDLE, trendH=INVALID_HANDLE;
ulong tk=0; long ptype=-1; double entryPx=0, riskPx=0, gInitVol=0, gTP1Px=0; bool gTP1done=false; datetime openBar=0;
datetime lastBar=0; int gTradesToday=0, curDayId=-1; double dayStartEq=0, gInitBal=0, gPeakEq=0;
bool dayLocked=false, gTargetHit=false; string PFX="OBX_"; string noReason="Iniciando";
int stTrades=0, stWins=0; double stNet=0, stWR=0;

datetime SrvNow(){ return TimeCurrent(); }
int DayId(){ MqlDateTime d; TimeToStruct(SrvNow(),d); return d.year*1000+d.day_of_year; }
int RefMin(){ MqlDateTime d; TimeToStruct(SrvNow(),d); return d.hour*60+d.min; }
int RefDow(){ MqlDateTime d; TimeToStruct(SrvNow(),d); return d.day_of_week; }
bool InWindow(){ int m=RefMin(), f=InpSignalFromH*60+InpSignalFromM, t=InpSignalToH*60+InpSignalToM; return (f<=t)?(m>=f&&m<=t):(m>=f||m<=t); }
bool DayOperable(){ int w=RefDow(); return (w>=1&&w<=5); }
bool ForceClose(){ if(!InpUseDayClose) return false; return RefMin()>=InpForceCloseHourNY*60+InpForceCloseMinNY; }
bool FridayCut(){ if(!InpNoWeekend) return false; if(RefDow()!=5) return false; return RefMin()>=InpFridayHour*60; }
bool NewBar(){ datetime t[]; if(CopyTime(S,InpTF,0,1,t)<=0) return false; if(t[0]!=lastBar){ lastBar=t[0]; return true; } return false; }
double Atr(){ double a[]; if(atrH!=INVALID_HANDLE && CopyBuffer(atrH,0,1,1,a)>0) return a[0]; return 0; }

string ResolveSymbol(string want){ if(want==""||want==NULL) return _Symbol; if(SymbolSelect(want,true)) return want;
   string u=want; StringToUpper(u); int tot=SymbolsTotal(false);
   for(int i=0;i<tot;i++){ string nm=SymbolName(i,false); string x=nm; StringToUpper(x); if(StringFind(x,u)>=0 && SymbolSelect(nm,true)) return nm; }
   return _Symbol; }

//====================== SESGO ======================
int TrendDir(){
   if(InpTrendMode==0){ if(trendH==INVALID_HANDLE) return 0; double m[]; if(CopyBuffer(trendH,0,0,1,m)<1) return 0;
      double px=SymbolInfoDouble(S,SYMBOL_BID); return (px>m[0])?1:((px<m[0])?-1:0); }
   if(InpTrendMode==2){ int N=InpTrendDonchN; if(N<2)N=2; MqlRates r[]; ArraySetAsSeries(r,true); if(CopyRates(S,InpTrendTF,1,N,r)<N) return 0;
      double hh=-DBL_MAX,ll=DBL_MAX; for(int i=0;i<N;i++){ if(r[i].high>hh)hh=r[i].high; if(r[i].low<ll)ll=r[i].low; }
      double mid=(hh+ll)/2.0, px=SymbolInfoDouble(S,SYMBOL_BID); return (px>mid)?1:((px<mid)?-1:0); }
   int k=InpTrendSwing; if(k<1)k=1; MqlRates r[]; ArraySetAsSeries(r,true); int got=CopyRates(S,InpTrendTF,0,260,r); if(got<2*k+3) return 0;
   double sh[],sl[]; for(int i=k+1;i<=got-k-1;i++){ bool isH=true,isL=true;
      for(int j=1;j<=k;j++){ if(r[i].high<=r[i-j].high||r[i].high<=r[i+j].high) isH=false; if(r[i].low>=r[i-j].low||r[i].low>=r[i+j].low) isL=false; if(!isH&&!isL) break; }
      if(isH){ int n=ArraySize(sh); ArrayResize(sh,n+1); sh[n]=r[i].high; } if(isL){ int n=ArraySize(sl); ArrayResize(sl,n+1); sl[n]=r[i].low; }
      if(ArraySize(sh)>=2 && ArraySize(sl)>=2) break; }
   if(ArraySize(sh)<2||ArraySize(sl)<2) return 0;
   if(sh[0]>sh[1] && sl[0]>sl[1]) return 1; if(sh[0]<sh[1] && sl[0]<sl[1]) return -1; return 0; }

//====================== SEÑAL DE ENTRADA (catalogo) ======================
// Devuelve +1 (comprar), -1 (vender), 0 (nada). Usa la vela cerrada (shift 1/2).
int EntrySignal(){
   if(InpEntry==ENT_MA){ if(maF==INVALID_HANDLE||maS==INVALID_HANDLE) return 0; double f[],sw[]; if(CopyBuffer(maF,0,1,2,f)<2||CopyBuffer(maS,0,1,2,sw)<2) return 0;
      bool up=(f[1]<=sw[1] && f[0]>sw[0]); bool dn=(f[1]>=sw[1] && f[0]<sw[0]); return up?1:(dn?-1:0); }
   if(InpEntry==ENT_RSI){ if(rsiH==INVALID_HANDLE) return 0; double v[]; if(CopyBuffer(rsiH,0,1,2,v)<2) return 0;
      bool up=(v[1]<=InpRSIos && v[0]>InpRSIos); bool dn=(v[1]>=InpRSIob && v[0]<InpRSIob); return up?1:(dn?-1:0); }
   if(InpEntry==ENT_DONCH){ int N=InpDonchN; if(N<2)N=2; MqlRates r[]; ArraySetAsSeries(r,true); if(CopyRates(S,InpTF,1,N+1,r)<N+1) return 0;
      double hh=-DBL_MAX,ll=DBL_MAX; for(int i=1;i<=N;i++){ if(r[i].high>hh)hh=r[i].high; if(r[i].low<ll)ll=r[i].low; }
      if(r[0].close>hh) return 1; if(r[0].close<ll) return -1; return 0; }
   if(InpEntry==ENT_TIME){ MqlDateTime d; TimeToStruct(SrvNow(),d); if(d.hour==InpEntryHour && d.min<5) return 1; return 0; } // hora fija: sesgo decide direccion
   // ENT_SWING (ruptura del ultimo swing menor con la vela cerrada)
   int k=InpMicroSwing; if(k<1)k=1; MqlRates r[]; ArraySetAsSeries(r,true); int got=CopyRates(S,InpTF,0,120,r); if(got<2*k+4) return 0;
   double hi=0,lo=0; for(int i=k+1;i<=got-k-1;i++){ bool isH=true; for(int j=1;j<=k;j++) if(r[i].high<=r[i-j].high||r[i].high<=r[i+j].high){ isH=false; break; } if(isH){ hi=r[i].high; break; } }
   for(int i=k+1;i<=got-k-1;i++){ bool isL=true; for(int j=1;j<=k;j++) if(r[i].low>=r[i-j].low||r[i].low>=r[i+j].low){ isL=false; break; } if(isL){ lo=r[i].low; break; } }
   if(hi>0 && r[1].close>hi) return 1; if(lo>0 && r[1].close<lo) return -1; return 0; }

//====================== RIESGO / EJECUCION ======================
double CalcLots(double slDist){ if(slDist<=0) return 0; double eq=AccountInfoDouble(ACCOUNT_EQUITY); double riskMoney=eq*InpRiskPct/100.0;
   double ts=SymbolInfoDouble(S,SYMBOL_TRADE_TICK_SIZE), tv=SymbolInfoDouble(S,SYMBOL_TRADE_TICK_VALUE); if(ts<=0||tv<=0) return 0;
   double lots=riskMoney/((slDist/ts)*tv); double step=SymbolInfoDouble(S,SYMBOL_VOLUME_STEP), mn=SymbolInfoDouble(S,SYMBOL_VOLUME_MIN), mx=SymbolInfoDouble(S,SYMBOL_VOLUME_MAX);
   if(step>0) lots=MathFloor(lots/step)*step; if(lots<mn) lots=mn; if(lots>mx) lots=mx; if(lots>InpMaxLots) lots=InpMaxLots; return lots; }
double AdjVol(double v){ double step=SymbolInfoDouble(S,SYMBOL_VOLUME_STEP),mn=SymbolInfoDouble(S,SYMBOL_VOLUME_MIN); if(step>0) v=MathFloor(v/step)*step; if(v<mn) v=mn; return v; }
int CountMine(){ int n=0; for(int i=PositionsTotal()-1;i>=0;i--){ ulong t=PositionGetTicket(i); if(t==0)continue; if(pos.SelectByTicket(t)&&pos.Symbol()==S&&pos.Magic()==InpMagic) n++; } return n; }
void CloseMine(string why){ for(int i=PositionsTotal()-1;i>=0;i--){ ulong t=PositionGetTicket(i); if(t==0)continue; if(pos.SelectByTicket(t)&&pos.Symbol()==S&&pos.Magic()==InpMagic) trade.PositionClose(t); } }

void OpenTrade(int dir){ double atr=Atr(); if(atr<=0) return; double slDist=InpSLBufferATR*atr; if(slDist<minStop) slDist=minStop; if(slDist<0.2*atr) slDist=0.2*atr;
   double ask=SymbolInfoDouble(S,SYMBOL_ASK), bid=SymbolInfoDouble(S,SYMBOL_BID);
   double entry=(dir>0)?ask:bid; double sl=(dir>0)?entry-slDist:entry+slDist; double tp=(dir>0)?entry+InpRunnerMaxR*slDist:entry-InpRunnerMaxR*slDist;
   double lots=CalcLots(slDist); if(lots<=0) return;
   sl=NormalizeDouble(sl,gDigits); tp=NormalizeDouble(tp,gDigits);
   bool okk=(dir>0)?trade.Buy(lots,S,ask,sl,tp,InpComment):trade.Sell(lots,S,bid,sl,tp,InpComment);
   if(okk){ gTradesToday++; gTP1done=false; } }

// TP1 parcial + BE + trailing + time-stop
void Manage(){ ulong found=0; for(int i=PositionsTotal()-1;i>=0;i--){ ulong t=PositionGetTicket(i); if(t==0)continue; if(pos.SelectByTicket(t)&&pos.Symbol()==S&&pos.Magic()==InpMagic){ found=t; break; } }
   if(found==0){ tk=0; gTP1done=false; return; } pos.SelectByTicket(found);
   if(found!=tk){ tk=found; entryPx=pos.PriceOpen(); ptype=pos.PositionType(); gInitVol=pos.Volume(); openBar=lastBar;
      double sl0=pos.StopLoss(); riskPx=(sl0>0)?MathAbs(entryPx-sl0):InpSLBufferATR*Atr(); if(riskPx<=0) riskPx=Atr(); gTP1done=false; }
   double bid=SymbolInfoDouble(S,SYMBOL_BID), ask=SymbolInfoDouble(S,SYMBOL_ASK);
   double fav=(ptype==POSITION_TYPE_BUY)?bid-entryPx:entryPx-ask;
   if(!gTP1done){
      if(InpTimeStopBars>0){ int held=(int)((lastBar-openBar)/PeriodSeconds(InpTF)); if(held>=InpTimeStopBars && fav<0.5*riskPx){ CloseMine("Time-stop"); return; } }
      if(riskPx>0 && fav>=InpTP1_R*riskPx){ double cv=AdjVol(gInitVol*InpPartialPct/100.0);
         if(cv>0 && cv<pos.Volume()) trade.PositionClosePartial(tk,cv);
         double be=NormalizeDouble((ptype==POSITION_TYPE_BUY)?entryPx+InpBEOffsetR*riskPx:entryPx-InpBEOffsetR*riskPx,gDigits);
         if(pos.SelectByTicket(tk)) trade.PositionModify(tk,be,pos.TakeProfit()); gTP1done=true; }
   } else if(InpUseTrail){ double a=Atr(); if(a>0){ double csl=pos.StopLoss(),ctp=pos.TakeProfit();
      if(ptype==POSITION_TYPE_BUY){ double nsl=NormalizeDouble(bid-InpTrail_ATRcoef*a,gDigits); if(nsl>csl && bid-nsl>=minStop) trade.PositionModify(tk,nsl,ctp); }
      else { double nsl=NormalizeDouble(ask+InpTrail_ATRcoef*a,gDigits); if((csl==0||nsl<csl) && nsl-ask>=minStop) trade.PositionModify(tk,nsl,ctp); } } } }

//====================== OBJETIVO / DD ======================
double TargetPct(){ if(InpAccountMode==MODE_FASE1) return InpTargetP1; if(InpAccountMode==MODE_FASE2) return InpTargetP2; return 0; }
double ProfitPct(){ if(gInitBal<=0) return 0; return 100.0*(AccountInfoDouble(ACCOUNT_EQUITY)-gInitBal)/gInitBal; }
double DDFloor(){ double L=InpAcctMaxDDPct/100.0; double eq=AccountInfoDouble(ACCOUNT_EQUITY);
   if(InpDDType==DD_STATIC && gInitBal>0) return gInitBal*(1.0-L);
   if(InpDDType==DD_TRAIL_BE && gInitBal>0){ double f=gPeakEq-L*gInitBal; return (f>gInitBal)?gInitBal:f; }
   return gPeakEq*(1.0-L); }
double DDPct(){ double ref=(InpDDType==DD_STATIC && gInitBal>0)?gInitBal:gPeakEq; double eq=AccountInfoDouble(ACCOUNT_EQUITY); return (ref>0)?100.0*(ref-eq)/ref:0; }

void ComputeStats(){ stTrades=0; stWins=0; stNet=0; if(!HistorySelect(0,TimeCurrent()+3600)) return; int n=HistoryDealsTotal();
   ulong ids[]; double prof[]; for(int i=0;i<n;i++){ ulong t=HistoryDealGetTicket(i); if(t==0)continue; if(HistoryDealGetInteger(t,DEAL_MAGIC)!=InpMagic)continue;
      long dt=HistoryDealGetInteger(t,DEAL_TYPE); if(dt!=DEAL_TYPE_BUY&&dt!=DEAL_TYPE_SELL)continue; ulong pid=(ulong)HistoryDealGetInteger(t,DEAL_POSITION_ID);
      double dp=HistoryDealGetDouble(t,DEAL_PROFIT)+HistoryDealGetDouble(t,DEAL_SWAP)+HistoryDealGetDouble(t,DEAL_COMMISSION);
      int at=-1; for(int k=0;k<ArraySize(ids);k++) if(ids[k]==pid){ at=k; break; } if(at<0){ at=ArraySize(ids); ArrayResize(ids,at+1); ArrayResize(prof,at+1); ids[at]=pid; prof[at]=0; } prof[at]+=dp; }
   for(int k=0;k<ArraySize(ids);k++){ double p=prof[k]; stTrades++; stNet+=p; if(p>=0) stWins++; } stWR=stTrades>0?100.0*stWins/stTrades:0; }

//====================== INIT / TICK ======================
int OnInit(){ S=ResolveSymbol(InpSymbol); if(!SymbolSelect(S,true)){ Print("Simbolo no disponible: ",S); return INIT_FAILED; }
   point=SymbolInfoDouble(S,SYMBOL_POINT); gDigits=(int)SymbolInfoInteger(S,SYMBOL_DIGITS);
   long a=SymbolInfoInteger(S,SYMBOL_TRADE_STOPS_LEVEL),f2=SymbolInfoInteger(S,SYMBOL_TRADE_FREEZE_LEVEL); minStop=(double)MathMax(a,f2)*point;
   atrH=iATR(S,InpTF,InpATRPeriod);
   if(InpEntry==ENT_MA){ maF=iMA(S,InpTF,InpMAfast,0,MODE_EMA,PRICE_CLOSE); maS=iMA(S,InpTF,InpMAslow,0,MODE_EMA,PRICE_CLOSE); }
   if(InpEntry==ENT_RSI){ rsiH=iRSI(S,InpTF,InpRSIperiod,PRICE_CLOSE); }
   if(InpTrendMode==0){ trendH=iMA(S,InpTrendTF,InpTrendMA,0,MODE_EMA,PRICE_CLOSE); }
   trade.SetExpertMagicNumber(InpMagic); trade.SetTypeFillingBySymbol(S); trade.SetDeviationInPoints(20);
   curDayId=DayId(); dayStartEq=AccountInfoDouble(ACCOUNT_EQUITY); gPeakEq=AccountInfoDouble(ACCOUNT_EQUITY);
   gInitBal=(InpInitBalance>0)?InpInitBalance:AccountInfoDouble(ACCOUNT_BALANCE);
   ComputeStats(); EventSetTimer(2);
   Print(${q(s.name)}," iniciado en ",S); return INIT_SUCCEEDED; }
void OnDeinit(const int reason){ EventKillTimer(); if(atrH!=INVALID_HANDLE) IndicatorRelease(atrH); if(maF!=INVALID_HANDLE) IndicatorRelease(maF); if(maS!=INVALID_HANDLE) IndicatorRelease(maS); if(rsiH!=INVALID_HANDLE) IndicatorRelease(rsiH); if(trendH!=INVALID_HANDLE) IndicatorRelease(trendH); ObjectsDeleteAll(0,PFX); }
void OnTimer(){ Engine(); Panel(); }
void OnTick(){ Engine(); Panel(); }

void DailyReset(){ int d=DayId(); if(d!=curDayId){ curDayId=d; gTradesToday=0; dayLocked=false; dayStartEq=AccountInfoDouble(ACCOUNT_EQUITY); } }

void Engine(){ if(atrH==INVALID_HANDLE) return; DailyReset(); bool nb=NewBar(); Manage();
   double eq=AccountInfoDouble(ACCOUNT_EQUITY); if(eq>gPeakEq) gPeakEq=eq;
   if(TimeCurrent()%30==0) ComputeStats();
   // cierres por horario
   if(ForceClose() && CountMine()>0) CloseMine("Cierre de sesion");
   if(FridayCut() && CountMine()>0) CloseMine("Fin de semana");
   // cap diario de la cuenta
   if(InpDailyLossCapPct>0 && !dayLocked && dayStartEq>0){ double dd=100.0*(dayStartEq-eq)/dayStartEq; if(dd>=InpDailyLossCapPct){ dayLocked=true; CloseMine("Cap diario"); } }
   // frenos de cuenta (suave / duro diario / total)
   bool soft=(InpAcctSoftStopPct>0 && dayStartEq>0 && 100.0*(dayStartEq-eq)/dayStartEq>=InpAcctSoftStopPct);
   bool hardDay=(InpAcctDailyStopPct>0 && dayStartEq>0 && 100.0*(dayStartEq-eq)/dayStartEq>=InpAcctDailyStopPct);
   bool totHalt=(InpAcctMaxDDPct>0 && eq<=DDFloor());
   if((hardDay||totHalt) && CountMine()>0){ CloseMine("Guardian de cuenta"); dayLocked=true; }
   // objetivo de fase
   if(InpHaltAtTarget && TargetPct()>0 && gInitBal>0 && !gTargetHit && ProfitPct()>=TargetPct()){ gTargetHit=true; }
   // ¿puede abrir?
   bool blocked = dayLocked||soft||gTargetHit||FridayCut()||!DayOperable()||!InWindow()||(InpMaxTradesPerDay>0 && gTradesToday>=InpMaxTradesPerDay);
   if(nb && !blocked && CountMine()==0){ int bias=TrendDir(); int sig=EntrySignal();
      int dir=0; if(InpEntry==ENT_TIME) dir=(bias!=0?bias:0); else dir=sig;
      if(dir!=0 && (bias==0 || (dir>0?bias>0:bias<0))){ if(dir>0 && InpAllowLongs) OpenTrade(1); else if(dir<0 && InpAllowShorts) OpenTrade(-1); } }
   // texto de estado
   if(gTargetHit) noReason="Objetivo alcanzado"; else if(dayLocked) noReason="Dia bloqueado"; else if(soft) noReason="Freno suave"; else if(!DayOperable()||FridayCut()) noReason="Fuera de sesion"; else if(!InWindow()) noReason="Fuera de horario"; else if(CountMine()>0) noReason="En operacion"; else noReason="Buscando entrada"; }

//====================== PANEL ======================
void L(string n,int x,int y,string txt,color c,int fs=9,bool bold=false){ string nm=PFX+n; if(ObjectFind(0,nm)<0) ObjectCreate(0,nm,OBJ_LABEL,0,0,0);
   ObjectSetInteger(0,nm,OBJPROP_XDISTANCE,x); ObjectSetInteger(0,nm,OBJPROP_YDISTANCE,y); ObjectSetString(0,nm,OBJPROP_TEXT,txt); ObjectSetInteger(0,nm,OBJPROP_COLOR,c);
   ObjectSetInteger(0,nm,OBJPROP_FONTSIZE,fs); ObjectSetString(0,nm,OBJPROP_FONT,bold?"Segoe UI Semibold":"Segoe UI"); ObjectSetInteger(0,nm,OBJPROP_CORNER,CORNER_LEFT_UPPER); ObjectSetInteger(0,nm,OBJPROP_SELECTABLE,false); ObjectSetInteger(0,nm,OBJPROP_HIDDEN,true); }
void RR(string n,int x,int y,int w,int h,color bg){ string nm=PFX+n; if(ObjectFind(0,nm)<0) ObjectCreate(0,nm,OBJ_RECTANGLE_LABEL,0,0,0);
   ObjectSetInteger(0,nm,OBJPROP_XDISTANCE,x); ObjectSetInteger(0,nm,OBJPROP_YDISTANCE,y); ObjectSetInteger(0,nm,OBJPROP_XSIZE,w); ObjectSetInteger(0,nm,OBJPROP_YSIZE,h);
   ObjectSetInteger(0,nm,OBJPROP_BGCOLOR,bg); ObjectSetInteger(0,nm,OBJPROP_BORDER_TYPE,BORDER_FLAT); ObjectSetInteger(0,nm,OBJPROP_CORNER,CORNER_LEFT_UPPER); ObjectSetInteger(0,nm,OBJPROP_BACK,false); ObjectSetInteger(0,nm,OBJPROP_SELECTABLE,false); ObjectSetInteger(0,nm,OBJPROP_HIDDEN,true); }
void Panel(){ if(!InpShowPanel) return; int X=InpPanelX,Y=InpPanelY,W=260,PAD=10;
   color bg=C'28,30,36',cv=C'235,236,240',cm=C'150,153,160',cg=C'90,210,150',cr=C'235,110,110',ca=C'240,190,90';
   RR("bg",X,Y,W,176,bg); int y=Y+8;
   L("t",X+PAD,y,InpComment,cv,11,true); y+=18;
   int _td=TrendDir(); L("sub",X+PAD,y,S+" · sesgo "+(_td>0?"ALCISTA":(_td<0?"BAJISTA":"rango"))+" · ops "+(string)gTradesToday,cm,8); y+=18;
   color bc=(CountMine()>0?cg:(dayLocked?cr:ca)); RR("ban",X+PAD,y,W-2*PAD,20,C'38,40,47'); L("banl",X+PAD+6,y+3,noReason,bc,9,true); y+=28;
   double eq=AccountInfoDouble(ACCOUNT_EQUITY), bal=AccountInfoDouble(ACCOUNT_BALANCE);
   L("a",X+PAD,y,"Bal $"+DoubleToString(bal,0)+"  ·  Eq $"+DoubleToString(eq,0),cv,9); y+=16;
   double dd=DDPct(); if(dd<0)dd=0; color dc=(dd<InpFirmTotalLimitPct*0.5)?cg:((dd<InpFirmTotalLimitPct*0.8)?ca:cr);
   L("dd",X+PAD,y,"DD "+DoubleToString(dd,2)+"% / "+DoubleToString(InpFirmTotalLimitPct,0)+"%  ("+InpFirmName+")",dc,9); y+=16;
   double tg=TargetPct(); if(tg>0){ double pp=ProfitPct(); color tc=(pp>=tg)?cg:(pp>=0?cv:cr); L("tg",X+PAD,y,"Objetivo "+(pp>=0?"+":"")+DoubleToString(pp,2)+"% / "+DoubleToString(tg,0)+"%",tc,9); y+=16; }
   L("s",X+PAD,y,"WR "+DoubleToString(stWR,0)+"%  ·  Trades "+(string)stTrades+"  ·  Neto "+(stNet>=0?"+$":"-$")+DoubleToString(MathAbs(stNet),0),cv,9);
   ChartRedraw(); }
`;
}
