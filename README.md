# A Conta da Virada — eleicoes26

Site de página única + análise forense dos votos do **2º turno da eleição
presidencial brasileira de 2026** (cargo Presidente), feito com os **dados
oficiais do TSE** (votação por seção eleitoral).

A tese, demonstrada com métodos estatísticos aplicados aos dados abertos:
**não há sinal de fraude**. O site mostra as fórmulas, os números e as fontes
de um jeito que o eleitor leigo entende — e todo número é reproduzível.

> Análise independente, feita com dados abertos oficiais. Sem vínculo com o
> TSE, partidos ou candidatos.

---

## O que tem aqui

```
index.html        # o site (uma página só)
styles.css        # identidade visual (dossiê forense / terminal âmbar)
app.js            # gráficos (D3), scrollytelling (GSAP), fórmulas (KaTeX), simulador
data.json         # distribuições, histograma e totais que o site lê (não carrega o CSV de 1,5 GB)
vendor/           # D3, GSAP + ScrollTrigger e KaTeX servidos localmente (sem depender de CDN)
vercel.json       # configuração de deploy estático
scripts/
  analyze.py      # testes do último dígito e de Benford (2º dígito)
  fingerprint.py  # teste de "fingerprint" (enchimento de urna, estilo Klimek)
requirements.txt  # numpy, scipy
```

O site é **100% estático**: não há build, servidor nem API. As bibliotecas
estão em `vendor/` para que a página funcione mesmo se uma CDN cair — o que
importa num site feito para convencer céticos.

---

## Rodar o site localmente

Precisa de um servidor estático (o `fetch` de `data.json` não funciona via
`file://`):

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Publicar na Vercel

É um site estático, sem passo de build:

1. Suba este repositório para o GitHub.
2. Na Vercel: **Add New… → Project** e importe o repositório.
3. Framework Preset: **Other**. Build Command: *vazio*. Output Directory: `./`.
4. **Deploy.** Pronto.

Ou pela CLI, na raiz do projeto:

```bash
npm i -g vercel
vercel --prod
```

---

## Reproduzir os números da análise

Qualquer pessoa baixa o mesmo arquivo do TSE e reproduz exatamente os
resultados abaixo.

1. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```
2. Baixe o arquivo oficial do TSE (votação por seção, ~155 MB zipado) e extraia:
   - Página: https://dadosabertos.tse.jus.br/dataset/resultados-2026
   - Arquivo direto: https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_2026_BR.zip
   ```bash
   unzip votacao_secao_2026_BR.zip -d data
   ```
3. Rode os testes:
   ```bash
   python3 scripts/analyze.py data/votacao_secao_2026_BR.csv 2 out/t2.json
   python3 scripts/fingerprint.py data/votacao_secao_2026_BR.csv out/fingerprint_t2.json
   ```

---

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
**Lula 64.256.232 · Flávio 59.826.041** — primeiro atestado de integridade do arquivo.

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

### O "truque do 1 em 190"
Lula superou as pesquisas finais em 2,79 pontos. Usando **só** o erro amostral
de uma pesquisa (σ ≈ 1,0 ponto), isso vira um "1 em 190". Somando as quatro
fontes reais de erro — amostral, desenho, viés de casa e mudança tardia —
`σ_total = √(0,8² + 1,1² + 1,5² + 1,75²) ≈ 2,68`, então `z = 2,79/2,68 ≈ 1,04`
e a probabilidade é de **~1 em 3**. Comum. O site traz um simulador que
recalcula o valor ao vivo conforme você muda o σ.

## O que isto prova (e o que não prova)

Os testes mostram **ausência de qualquer sinal** de fraude nos dados oficiais —
não são, sozinhos, uma "prova" de ausência. A garantia forte é processual:
teste público de integridade com urnas sorteadas e votadas na frente de fiscais,
boletim de urna impresso e conferível, e código-fonte auditado por partidos,
OAB, Polícia Federal e Forças Armadas.

## Fontes
- Dados brutos: Portal de Dados Abertos do TSE — https://dadosabertos.tse.jus.br/dataset/resultados-2026
- Resultado oficial do 2º turno: https://www.tse.jus.br/
- Pesquisas: Quaest e Datafolha
- Benford forense: Walter R. Mebane Jr. · Fingerprint: Klimek et al., PNAS 2012 · Falácia ecológica: W. S. Robinson (1950)

---

## Créditos das bibliotecas (em `vendor/`)
- [D3.js](https://d3js.org/) 7.9.0 (ISC)
- [GSAP + ScrollTrigger](https://gsap.com/) 3.12.5 (Standard GSAP license)
- [KaTeX](https://katex.org/) 0.16.11 (MIT)
