# eleicoes26 — Análise forense dos votos (2º turno, Presidente 2026)

Scripts para testar, com os dados **oficiais do TSE** (votação por seção eleitoral),
se há sinal estatístico de fraude no 2º turno da eleição presidencial de 2026.

Qualquer pessoa pode baixar o mesmo arquivo do TSE e reproduzir exatamente os
números abaixo.

## Como reproduzir

1. Instale as dependências:
   ```
   pip install -r requirements.txt
   ```
2. Baixe o arquivo oficial do TSE (votação por seção, ~155 MB zipado) e extraia:
   - Página: https://dadosabertos.tse.jus.br/dataset/resultados-2026
   - Arquivo direto: https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_2026_BR.zip
   ```
   unzip votacao_secao_2026_BR.zip -d data
   ```
3. Rode os testes:
   ```
   python3 scripts/analyze.py data/votacao_secao_2026_BR.csv 2 out/t2.json
   python3 scripts/fingerprint.py data/votacao_secao_2026_BR.csv out/fingerprint_t2.json
   ```

## Métodos

- **Último dígito** (`analyze.py`): numa apuração honesta, o último dígito da
  contagem de cada seção é ~Uniforme(0–9). Teste qui-quadrado (9 g.l.).
- **Lei de Benford, 2º dígito** (`analyze.py`): distribuição esperada
  `P(d) = Σ_{k=1..9} log10(1 + 1/(10k+d))`. Teste qui-quadrado.
- **Fingerprint** (`fingerprint.py`): correlação entre o tamanho da seção e o
  % do vencedor, e a forma da distribuição do % do vencedor (método estilo
  Klimek et al., PNAS 2012).

## Resultados (2º turno, 499 mil seções)

Os totais somados a partir das seções batem exatamente com os oficiais:
Lula 64.256.232 · Flávio 59.826.041.

### Teste do último dígito (o confiável)
| Candidato | χ² | p | veredito |
|---|---|---|---|
| Lula   | 4,98  | 0,8364 | passa (uniforme) |
| Flávio | 12,36 | 0,1936 | passa (uniforme) |

### Lei de Benford (o teste que acusações de fraude costumam citar)
| Candidato | χ² | p | veredito |
|---|---|---|---|
| Lula   | 10.742 | ~0 | "reprova" |
| Flávio | 8.067  | ~0 | "reprova" |

Benford "reprova" **os dois** candidatos — inclusive o que contesta o resultado.
Um teste que acusa os dois lados ao mesmo tempo não distingue nada. Benford vale
para números que variam por ordens de magnitude; votos por seção variam pouco
(quase toda urna tem 50–400 eleitores), então "reprovam" com ou sem fraude.
Ver Walter R. Mebane Jr., *Election Forensics: The Second-Digit Benford's Law Test*.

### Fingerprint (enchimento de urna)
- Correlação (tamanho da seção × % do vencedor) = **−0,18** (perto de 0 e negativa → sem sinal de enchimento)
- Média do % do vencedor por seção: 62,1% (mediana 61%)
- Seções com vencedor ≥95%: 880 (0,18%) · ≥99%: 64 · ~100%: 30
- Distribuição em forma de sino, sem pico anômalo perto de 100%.

## O que isto prova (e o que não prova)

Os testes mostram **ausência de qualquer sinal** de fraude nos dados oficiais —
não são, sozinhos, uma "prova" de ausência. A garantia forte é processual:
teste público de integridade com urnas sorteadas e votadas na frente de fiscais,
boletim de urna impresso e conferível, e código-fonte auditado por partidos,
OAB, Polícia Federal e Forças Armadas.

## Fontes
- Dados brutos: Portal de Dados Abertos do TSE — https://dadosabertos.tse.jus.br/dataset/resultados-2026
- Resultado oficial do 2º turno: https://www.tse.jus.br/
- Benford forense: Walter R. Mebane Jr. · Fingerprint: Klimek et al., PNAS 2012 · Falácia ecológica: W. S. Robinson (1950)

---
*Análise independente, feita com dados abertos oficiais. Sem vínculo com o TSE, partidos ou candidatos.*
