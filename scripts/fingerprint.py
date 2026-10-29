"""
Teste de "fingerprint" eleitoral (estilo Klimek et al., PNAS 2012).
Procura sinal de enchimento de urna: correlação entre o tamanho da seção e o
% do vencedor, e a forma da distribuição do % do vencedor (um pico perto de
100% seria suspeito). Roda no 2º turno, cargo Presidente.
Uso:  python3 scripts/fingerprint.py <caminho_do_csv> <saida.json>
"""
import sys, csv, json
from collections import defaultdict
import numpy as np
csv.field_size_limit(10**7)
PATH = sys.argv[1] if len(sys.argv) > 1 else "data/votacao_secao_2026_BR.csv"
OUT  = sys.argv[2] if len(sys.argv) > 2 else "out/fingerprint_t2.json"

# Agrega os votos por seção (UF + zona + seção) no 2º turno
sec = defaultdict(lambda: defaultdict(int))
with open(PATH, encoding='latin-1', newline='') as f:
    r=csv.reader(f, delimiter=';')
    h=next(r); idx={x.strip('"'):i for i,x in enumerate(h)}
    iT,iC,iV,iQ=idx['NR_TURNO'],idx['DS_CARGO'],idx['NR_VOTAVEL'],idx['QT_VOTOS']
    iU,iZ,iS=idx['SG_UF'],idx['NR_ZONA'],idx['NR_SECAO']
    for row in r:
        if row[iT].strip('"')!='2' or row[iC].strip('"')!='Presidente': continue
        try: q=int(row[iQ])
        except: continue
        k=(row[iU],row[iZ],row[iS]); sec[k][row[iV].strip('"')]+=q

lula=[];flavio=[];tot=[];winpct=[]
for k,v in sec.items():
    l=v.get('13',0); f=v.get('22',0); t=sum(v.values())
    if t<=0: continue
    lula.append(l);flavio.append(f);tot.append(t)
    winpct.append(100.0*max(l,f)/t)       # % do vencedor na seção
lula=np.array(lula);flavio=np.array(flavio);tot=np.array(tot);winpct=np.array(winpct)

# Correlação de Pearson entre tamanho da seção e % do vencedor.
# Enchimento de urna produziria correlação POSITIVA e forte. Perto de 0 = sem sinal.
pear=float(np.corrcoef(tot, winpct)[0,1])
bins=np.arange(30,101,5)
hist,_=np.histogram(winpct,bins=bins)
ge95=int((winpct>=95).sum()); ge99=int((winpct>=99).sum()); eq100=int((winpct>=99.9).sum())
out={"n_secoes":len(tot),
 "corr_tamanho_vs_share_vencedor":round(pear,4),
 "share_vencedor_hist_bins":[f"{bins[i]}-{bins[i+1]}%" for i in range(len(bins)-1)],
 "share_vencedor_hist":hist.tolist(),
 "secoes_ge_95pct":ge95,"secoes_ge_99pct":ge99,"secoes_100pct":eq100,
 "media_share_vencedor":round(float(winpct.mean()),2),
 "mediana_share_vencedor":round(float(np.median(winpct)),2)}
json.dump(out,open(OUT,"w"),ensure_ascii=False,indent=1)
print("Seções agregadas:",len(tot))
print("Correlação (tamanho da seção x % do vencedor):",round(pear,4),"  (perto de 0 = sem sinal de enchimento)")
print("Média % do vencedor por seção:",round(float(winpct.mean()),2))
print("Seções com vencedor >=95%:",ge95,f"({100*ge95/len(tot):.2f}%)")
print("Seções com vencedor >=99%:",ge99,f"({100*ge99/len(tot):.3f}%)")
print("Seções ~100%:",eq100)
print("\nDistribuição do % do vencedor:")
for i in range(len(bins)-1):
    bar='#'*int(hist[i]/max(hist)*40)
    print(f"  {bins[i]:>3}-{bins[i+1]:>3}%: {hist[i]:>7,} {bar}")
