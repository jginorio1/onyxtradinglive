// ============================================================
// Onyx Bot Factory · Fase 5 — Generador de código EA (.mq5 / .mq4)
// Convierte una estrategia (Spec) en un Expert Advisor compilable de MetaTrader,
// con los bloques elegidos (indicador, regla, sesión, TP/SL/BE/trailing) y el
// magic number. PURO (corre en el navegador para descargar el archivo).
// ============================================================

import type { Spec } from '@/lib/backtest';

const IND_MT5: Record<string, string> = {
  ema: 'h_ind=iMA(_Symbol,_Period,P1,0,MODE_EMA,PRICE_CLOSE);',
  sma: 'h_ind=iMA(_Symbol,_Period,P1,0,MODE_SMA,PRICE_CLOSE);',
  rsi: 'h_ind=iRSI(_Symbol,_Period,P1,PRICE_CLOSE);',
  stoch: 'h_ind=iStochastic(_Symbol,_Period,P1,3,3,MODE_SMA,STO_LOWHIGH);',
  cci: 'h_ind=iCCI(_Symbol,_Period,P1,PRICE_TYPICAL);',
  macd: 'h_ind=iMACD(_Symbol,_Period,12,26,9,PRICE_CLOSE);',
  atr: 'h_ind=iATR(_Symbol,_Period,P1);',
};
function indKindMt5(id: string): 'ma' | 'osc' { return ['rsi', 'stoch', 'cci'].includes(id) ? 'osc' : 'ma'; }

// Devuelve el nombre base ONYX-...
export function eaName(spec: Spec, botName?: string): string { return (botName || `ONYX_${spec.ind1}_${spec.entry}`).replace(/[^A-Za-z0-9_]/g, '_'); }

const SESS: Record<string, string> = {
  sydney: '(hh>=21 || hh<6)', tokyo: '(hh>=0 && hh<9)', london: '(hh>=7 && hh<16)',
  ny: '(hh>=12 && hh<21)', overlap: '(hh>=12 && hh<16)', all: 'true',
};
function pipsVal(id: string): number { const n = parseFloat(id.replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : n; }

export function genMt5(spec: Spec, symbol: string, magic: number, botName?: string): string {
  const name = eaName(spec, botName);
  const kind = indKindMt5(spec.ind1);
  const initInd = IND_MT5[spec.ind1] || IND_MT5.ema;
  const tp = spec.tp.startsWith('atr') ? 0 : pipsVal(spec.tp);
  const sl = spec.sl.startsWith('atr') ? 0 : pipsVal(spec.sl);
  const be = spec.be === 'off' ? 0 : pipsVal(spec.be.replace('be', '')) || 0;
  const tr = spec.trailing === 'off' ? 0 : pipsVal(spec.trailing.replace('t', '')) || 0;
  const sess = SESS[spec.sessions] || 'true';
  // Regla de entrada (long) — el short es el espejo.
  const longRule = ({
    cross_up: 'val>lvlMid && valPrev<=lvlMid', cross_dn: 'false', above: 'val>lvlMid', below: 'false',
    oversold: 'val<30', overbought: 'false', breakout: 'close>hiN', pullback: 'val>lvlMid && close<ma1', divergence: 'val>50 && valPrev<=50',
  } as Record<string, string>)[spec.entry] || 'val>lvlMid';
  const shortRule = ({
    cross_up: 'false', cross_dn: 'val<lvlMid && valPrev>=lvlMid', above: 'false', below: 'val<lvlMid',
    oversold: 'false', overbought: 'val>70', breakout: 'close<loN', pullback: 'val<lvlMid && close>ma1', divergence: 'val<50 && valPrev>=50',
  } as Record<string, string>)[spec.entry] || 'val<lvlMid';

  return `//+------------------------------------------------------------------+
//|  ${name}.mq5  ·  generado por Onyx Bot Factory                    |
//|  Estrategia: ${spec.ind1}${spec.ind2 ? '+' + spec.ind2 : ''} / ${spec.entry} / TP:${spec.tp} SL:${spec.sl} BE:${spec.be} Trail:${spec.trailing} / ${spec.sessions}
//|  Símbolo objetivo: ${symbol}  ·  MAGIC ${magic}
//+------------------------------------------------------------------+
#property strict
#include <Trade/Trade.mqh>
CTrade trade;

input double Lots        = 0.10;
input int    P1          = ${spec.p1 || 20};      // periodo del indicador
input int    TP_Pips     = ${tp};                 // 0 = usar ATR x2
input int    SL_Pips     = ${sl};                 // 0 = usar ATR x1.5
input int    BE_Pips     = ${be};                 // 0 = sin break-even
input int    Trail_Pips  = ${tr};                 // 0 = sin trailing
input long   MagicNumber = ${magic};
input bool   AnyBroker   = true;                  // ignora prefijos/sufijos del símbolo

int    h_ind=INVALID_HANDLE, h_atr=INVALID_HANDLE;
double pip;
datetime lastBar=0;

int OnInit(){
  ${initInd}
  h_atr=iATR(_Symbol,_Period,14);
  pip = (_Digits==3 || _Digits==5) ? _Point*10 : _Point;
  trade.SetExpertMagicNumber(MagicNumber);
  return(INIT_SUCCEEDED);
}
void OnDeinit(const int r){ if(h_ind!=INVALID_HANDLE) IndicatorRelease(h_ind); if(h_atr!=INVALID_HANDLE) IndicatorRelease(h_atr); }

double IndVal(int shift){ double b[]; if(CopyBuffer(h_ind,0,shift,1,b)<1) return 0; return b[0]; }
double AtrVal(){ double a[]; if(CopyBuffer(h_atr,0,0,1,a)<1) return 0; return a[0]; }
bool NewBar(){ datetime t=iTime(_Symbol,_Period,0); if(t==lastBar) return false; lastBar=t; return true; }

bool HasPos(){ return PositionSelect(_Symbol) && PositionGetInteger(POSITION_MAGIC)==MagicNumber; }

void Manage(){
  if(!HasPos()) return;
  long type=PositionGetInteger(POSITION_TYPE);
  double open=PositionGetDouble(POSITION_PRICE_OPEN);
  double sl=PositionGetDouble(POSITION_SL);
  double price=(type==POSITION_TYPE_BUY)?SymbolInfoDouble(_Symbol,SYMBOL_BID):SymbolInfoDouble(_Symbol,SYMBOL_ASK);
  double prog=(type==POSITION_TYPE_BUY)?(price-open)/pip:(open-price)/pip;
  double newSl=sl;
  if(BE_Pips>0 && prog>=BE_Pips){ newSl=(type==POSITION_TYPE_BUY)?open+pip:open-pip; }
  if(Trail_Pips>0 && prog>=Trail_Pips){ double t=(type==POSITION_TYPE_BUY)?price-Trail_Pips*pip:price+Trail_Pips*pip; if(type==POSITION_TYPE_BUY? t>newSl : t<newSl) newSl=t; }
  if(newSl!=sl && newSl>0) trade.PositionModify(_Symbol,newSl,PositionGetDouble(POSITION_TP));
}

void OnTick(){
  Manage();
  if(!NewBar()) return;
  if(HasPos()) return;

  MqlDateTime dt; TimeToStruct(TimeCurrent(),dt); int hh=dt.hour;
  if(!(${sess})) return;

  double val=IndVal(1), valPrev=IndVal(2);
  double lvlMid = ${kind === 'osc' ? '50' : 'iClose(_Symbol,_Period,1)'};
  double ma1 = ${kind === 'osc' ? 'iClose(_Symbol,_Period,1)' : 'val'};
  double close=iClose(_Symbol,_Period,1);
  double hiN=iHigh(_Symbol,_Period,iHighest(_Symbol,_Period,MODE_HIGH,20,2));
  double loN=iLow(_Symbol,_Period,iLowest(_Symbol,_Period,MODE_LOW,20,2));

  double atr=AtrVal();
  double slp=(SL_Pips>0)?SL_Pips*pip:1.5*atr;
  double tpp=(TP_Pips>0)?TP_Pips*pip:2.0*atr;
  double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK), bid=SymbolInfoDouble(_Symbol,SYMBOL_BID);

  bool goLong  = ${longRule};
  bool goShort = ${shortRule};

  if(goLong)  trade.Buy (Lots,_Symbol,ask,ask-slp,ask+tpp,"Onyx");
  else if(goShort) trade.Sell(Lots,_Symbol,bid,bid+slp,bid-tpp,"Onyx");
}
//+------------------------------------------------------------------+
`;
}

// Variante MT4 (clásica). Misma lógica, API OrderSend.
export function genMt4(spec: Spec, symbol: string, magic: number, botName?: string): string {
  const name = eaName(spec, botName);
  const kind = indKindMt5(spec.ind1);
  const indCall = ({
    ema: 'iMA(NULL,0,P1,0,MODE_EMA,PRICE_CLOSE,s)', sma: 'iMA(NULL,0,P1,0,MODE_SMA,PRICE_CLOSE,s)',
    rsi: 'iRSI(NULL,0,P1,PRICE_CLOSE,s)', stoch: 'iStochastic(NULL,0,P1,3,3,MODE_SMA,0,MODE_MAIN,s)',
    cci: 'iCCI(NULL,0,P1,PRICE_TYPICAL,s)', macd: 'iMACD(NULL,0,12,26,9,PRICE_CLOSE,MODE_MAIN,s)', atr: 'iATR(NULL,0,P1,s)',
  } as Record<string, string>)[spec.ind1] || 'iMA(NULL,0,P1,0,MODE_EMA,PRICE_CLOSE,s)';
  const tp = spec.tp.startsWith('atr') ? 0 : pipsVal(spec.tp);
  const sl = spec.sl.startsWith('atr') ? 0 : pipsVal(spec.sl);
  const be = spec.be === 'off' ? 0 : pipsVal(spec.be.replace('be', '')) || 0;
  const tr = spec.trailing === 'off' ? 0 : pipsVal(spec.trailing.replace('t', '')) || 0;
  const sess = SESS[spec.sessions] || 'true';
  const longRule = ({ cross_up: 'val>lvl && valP<=lvl', above: 'val>lvl', oversold: 'val<30', breakout: 'Close[1]>hiN', pullback: 'val>lvl && Close[1]<val', divergence: 'val>50 && valP<=50', cross_dn: 'false', below: 'false', overbought: 'false' } as Record<string, string>)[spec.entry] || 'val>lvl';
  const shortRule = ({ cross_dn: 'val<lvl && valP>=lvl', below: 'val<lvl', overbought: 'val>70', breakout: 'Close[1]<loN', pullback: 'val<lvl && Close[1]>val', divergence: 'val<50 && valP>=50', cross_up: 'false', above: 'false', oversold: 'false' } as Record<string, string>)[spec.entry] || 'val<lvl';
  return `//+------------------------------------------------------------------+
//|  ${name}.mq4  ·  generado por Onyx Bot Factory                    |
//|  ${spec.ind1} / ${spec.entry} / TP:${spec.tp} SL:${spec.sl} / ${spec.sessions}  ·  MAGIC ${magic}
//+------------------------------------------------------------------+
#property strict
extern double Lots=0.10; extern int P1=${spec.p1 || 20}; extern int TP_Pips=${tp}; extern int SL_Pips=${sl};
extern int BE_Pips=${be}; extern int Trail_Pips=${tr}; extern int MagicNumber=${magic};
double pip;
int OnInit(){ pip=(Digits==3||Digits==5)?Point*10:Point; return(0);}
double Ind(int s){ return ${indCall}; }
bool NewBar(){ static datetime lb=0; if(Time[0]==lb) return false; lb=Time[0]; return true; }
int Count(){ int c=0; for(int i=0;i<OrdersTotal();i++){ if(OrderSelect(i,SELECT_BY_POS) && OrderSymbol()==Symbol() && OrderMagicNumber()==MagicNumber) c++; } return c; }
void Trail(){ for(int i=0;i<OrdersTotal();i++){ if(!OrderSelect(i,SELECT_BY_POS)) continue; if(OrderSymbol()!=Symbol()||OrderMagicNumber()!=MagicNumber) continue;
  double op=OrderOpenPrice(); double prog=(OrderType()==OP_BUY)?(Bid-op)/pip:(op-Ask)/pip; double ns=OrderStopLoss();
  if(BE_Pips>0 && prog>=BE_Pips) ns=(OrderType()==OP_BUY)?op+pip:op-pip;
  if(Trail_Pips>0 && prog>=Trail_Pips){ double t=(OrderType()==OP_BUY)?Bid-Trail_Pips*pip:Ask+Trail_Pips*pip; if(OrderType()==OP_BUY? t>ns : (ns==0||t<ns)) ns=t; }
  if(ns!=OrderStopLoss() && ns>0) OrderModify(OrderTicket(),op,ns,OrderTakeProfit(),0); } }
void OnTick(){ Trail(); if(!NewBar()||Count()>0) return; int hh=TimeHour(TimeCurrent()); if(!(${sess})) return;
  double val=Ind(1), valP=Ind(2); double lvl=${kind === 'osc' ? '50' : 'Close[1]'};
  double hiN=High[iHighest(NULL,0,MODE_HIGH,20,2)]; double loN=Low[iLowest(NULL,0,MODE_LOW,20,2)];
  double atr=iATR(NULL,0,14,1); double slp=(SL_Pips>0)?SL_Pips*pip:1.5*atr; double tpp=(TP_Pips>0)?TP_Pips*pip:2.0*atr;
  bool L=${longRule}; bool S=${shortRule};
  if(L) OrderSend(Symbol(),OP_BUY,Lots,Ask,3,Ask-slp,Ask+tpp,"Onyx",MagicNumber,0,clrGreen);
  else if(S) OrderSend(Symbol(),OP_SELL,Lots,Bid,3,Bid+slp,Bid-tpp,"Onyx",MagicNumber,0,clrRed); }
//+------------------------------------------------------------------+
`;
}

// ============================================================
// cTrader cBot (.cs / cAlgo) — punto de partida compilable en cTrader.
// Traduce la misma estrategia a C#. Igual que los EA: es un esqueleto que
// entra por señal del indicador con TP/SL; ajusta detalles en cAlgo.
// ============================================================
export function genCtrader(spec: Spec, symbol: string, magic: number, botName?: string): string {
  const name = (botName || eaName(spec, botName)).replace(/[^A-Za-z0-9_]/g, '_');
  const p1 = spec.p1 || 20, p2 = spec.p2 || 50;
  const tp = String(spec.tp || '40'), sl = String(spec.sl || '30');
  const tpN = /atr/i.test(tp) ? 40 : parseInt(tp) || 40;
  const slN = /atr/i.test(sl) ? 30 : parseInt(sl) || 30;
  return `using cAlgo.API;
using cAlgo.API.Indicators;

namespace cAlgo.Robots {
  // Onyx Bot Factory · ${name} · ${symbol}
  [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.None)]
  public class ${name} : Robot {
    [Parameter("Volume (lots)", DefaultValue = 0.1)] public double Lots { get; set; }
    [Parameter("TP (pips)", DefaultValue = ${tpN})] public int TpPips { get; set; }
    [Parameter("SL (pips)", DefaultValue = ${slN})] public int SlPips { get; set; }
    [Parameter("Fast period", DefaultValue = ${p1})] public int Fast { get; set; }
    [Parameter("Slow period", DefaultValue = ${p2})] public int Slow { get; set; }
    private MovingAverage _fast, _slow;
    private const string Label = "Onyx_${magic}";

    protected override void OnStart() {
      _fast = Indicators.MovingAverage(Bars.ClosePrices, Fast, MovingAverageType.Exponential);
      _slow = Indicators.MovingAverage(Bars.ClosePrices, Slow, MovingAverageType.Exponential);
    }
    protected override void OnBar() {
      bool up = _fast.Result.Last(1) > _slow.Result.Last(1) && _fast.Result.Last(2) <= _slow.Result.Last(2);
      bool dn = _fast.Result.Last(1) < _slow.Result.Last(1) && _fast.Result.Last(2) >= _slow.Result.Last(2);
      var pos = Positions.FindAll(Label, SymbolName);
      if (up) { foreach (var p in pos) if (p.TradeType == TradeType.Sell) ClosePosition(p);
        if (Positions.FindAll(Label, SymbolName, TradeType.Buy).Length == 0)
          ExecuteMarketOrder(TradeType.Buy, SymbolName, Symbol.QuantityToVolumeInUnits(Lots), Label, SlPips, TpPips); }
      else if (dn) { foreach (var p in pos) if (p.TradeType == TradeType.Buy) ClosePosition(p);
        if (Positions.FindAll(Label, SymbolName, TradeType.Sell).Length == 0)
          ExecuteMarketOrder(TradeType.Sell, SymbolName, Symbol.QuantityToVolumeInUnits(Lots), Label, SlPips, TpPips); }
    }
  }
}
`;
}

// Pseudocódigo legible (para revisar la lógica sin leer MQL/C#).
export function genPseudo(spec: Spec, symbol: string, magic: number, extra?: string): string {
  const L = (k: string, v: any) => `  ${k.padEnd(16)}: ${v}`;
  return [
    'ONYX BOT FACTORY · Pseudocódigo de la estrategia',
    '='.repeat(52),
    L('Símbolo', symbol),
    L('Magic', magic),
    L('Indicador 1', spec.ind1 + (spec.ind2 ? ' + ' + spec.ind2 : '')),
    L('Períodos', `${spec.p1 || '-'} / ${spec.p2 || '-'}`),
    L('Entrada', spec.entry),
    L('Salida', spec.exit),
    L('Sesión', spec.sessions || 'todas'),
    L('Take Profit', spec.tp),
    L('Stop Loss', spec.sl),
    L('Break-even', spec.be || 'off'),
    L('Trailing', spec.trailing || 'off'),
    L('Dirección', (spec as any).dir || 'both'),
    '',
    'LÓGICA:',
    `  1. Calcular ${spec.ind1}${spec.ind2 ? ' y ' + spec.ind2 : ''} con los períodos indicados.`,
    `  2. Entrar cuando se cumpla la condición de entrada (${spec.entry}) dentro de la sesión.`,
    `  3. Colocar TP=${spec.tp} y SL=${spec.sl}${spec.be && spec.be !== 'off' ? `, mover a break-even (${spec.be})` : ''}${spec.trailing && spec.trailing !== 'off' ? `, trailing (${spec.trailing})` : ''}.`,
    `  4. Salir por ${spec.exit}.`,
    extra ? '\nNOTA IA:\n' + extra : '',
    '',
    'Advertencia: el backtest es histórico; valida en demo antes de operar real.',
  ].join('\n');
}
