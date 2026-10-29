"""
Análise forense dos votos por seção — testes de Benford (2º dígito) e do último dígito.
Dados: arquivo oficial do TSE "votacao_secao_2026_BR.csv" (dentro do .zip de votação por seção).
Uso:  python3 scripts/analyze.py <caminho_do_csv> <turno:1|2> <saida.json>
Requisitos: numpy, scipy  (pip install -r requirements.txt)
"""
import sys, csv, json, math
from array import array
from collections import defaultdict
import numpy as np
from scipy.stats import chisquare

csv.field_size_limit(10**7)
PATH, TURNO, OUT = sys.argv[1], sys.argv[2], sys.argv[3]

# Distribuição esperada do 2º dígito pela Lei de Benford:
# P(d) = soma_{k=1..9} log10(1 + 1/(10k + d))
def benford_2nd():
    return np.array([sum(math.log10(1+1.0/(10*k+d)) for k in range(1,10)) for d in range(10)])
BEN2 = benford_2nd()

# Lê o CSV (latin-1, separador ';'), filtra cargo Presidente e o turno pedido,
# e guarda a contagem de votos de cada seção por candidato (NR_VOTAVEL).
votes = defaultdict(lambda: array('i'))
names = {}
nrows = 0
with open(PATH, encoding='latin-1', newline='') as f:
    r = csv.reader(f, delimiter=';')
    header = next(r)
    idx = {h.strip('"'): i for i,h in enumerate(header)}
    iT,iV,iN,iQ,iC = idx['NR_TURNO'],idx['NR_VOTAVEL'],idx['NM_VOTAVEL'],idx['QT_VOTOS'],idx['DS_CARGO']
    for row in r:
        if row[iT].strip('"') != TURNO: continue
        if row[iC].strip('"') != 'Presidente': continue
        try: q = int(row[iQ])
        except (ValueError, IndexError): continue
        nr = row[iV].strip('"')
        votes[nr].append(q); names.setdefault(nr, row[iN].strip('"')); nrows += 1

# Teste qui-quadrado: chi2 = soma (Observado - Esperado)^2 / Esperado
def chi(obs, probs):
    obs = np.asarray(obs, float); n = obs.sum()
    if n < 1000: return None
    exp = probs*n
    if (exp <= 0).any(): return None
    _, p = chisquare(obs, f_exp=exp)
    return {"chi2": round(float(((obs-exp)**2/exp).sum()),2), "dof": len(obs)-1, "p": float(p),
            "observed":[int(x) for x in obs], "expected":[round(float(x),1) for x in exp]}

# Benford do 2º dígito (só seções com >=10 votos, que têm 2º dígito)
def benford_2bl(counts):
    a = np.asarray(counts); a = a[a>=10]
    if a.size < 1000: return {"n":int(a.size),"valid":False}
    obs = np.bincount((a//10)%10, minlength=10)[:10]
    res = chi(obs, BEN2)
    if not res: return {"n":int(a.size),"valid":False}
    res.update({"n":int(a.size),"valid":True,"digits":list(range(10))}); return res

# Último dígito: numa apuração honesta é ~Uniforme(0-9); testa contra 0,1 cada
def last_digit(counts, thr=10):
    a = np.asarray(counts); a = a[a>=thr]
    if a.size < 1000: return {"n":int(a.size),"valid":False}
    obs = np.bincount(a%10, minlength=10)[:10]
    res = chi(obs, np.full(10,0.1))
    if not res: return {"n":int(a.size),"valid":False}
    res.update({"n":int(a.size),"valid":True,"digits":list(range(10)),"threshold":thr}); return res

totals = {nr:int(np.sum(c)) for nr,c in votes.items()}
ranked = sorted(totals.items(), key=lambda kv:-kv[1])
out = {"turno":TURNO,"n_section_rows":nrows,"candidates":[]}
for nr,tot in ranked:
    c = np.asarray(votes[nr])
    out["candidates"].append({"nr":nr,"nome":names[nr],"total_votos":tot,"n_secoes":int(c.size),
        "media_por_secao":round(float(c.mean()),1),
        "benford_2bl":benford_2bl(c),"ultimo_digito":last_digit(c)})
json.dump(out, open(OUT,"w"), ensure_ascii=False, indent=1)

def fp(t): return f"{t['p']:>9.4f}" if t.get("valid") else "  (insuf.)"
print(f"TURNO {TURNO} | linhas Presidente: {nrows:,}\n")
print(f"{'NOME':<26}{'TOTAL':>13}{'SEÇÕES':>9}{'MÉDIA':>7}  {'BENFORD-2BL p':>13}{'ÚLT-DÍG p':>11}")
for cd in out["candidates"][:8]:
    print(f"{cd['nome'][:26]:<26}{cd['total_votos']:>13,}{cd['n_secoes']:>9,}{cd['media_por_secao']:>7.1f}  "
          f"{fp(cd['benford_2bl']):>13}{fp(cd['ultimo_digito']):>11}")
