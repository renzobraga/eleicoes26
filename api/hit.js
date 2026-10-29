// Contador de acessos — função serverless (Vercel)
// Conta visitantes ÚNICOS POR DIA: recarregar a página no mesmo dia (mesmo IP)
// não conta de novo; acessar em outro dia conta +1.
//
// Privacidade (LGPD): o IP cru NUNCA é armazenado. Guardamos apenas um hash
// (SHA-256 com sal) com validade de 48h, só para deduplicar o dia, mais um
// contador agregado (um número inteiro). Nada identifica a pessoa.
//
// Armazenamento: Redis via REST (Upstash / Vercel KV). Defina no projeto:
//   UPSTASH_REDIS_REST_URL  + UPSTASH_REDIS_REST_TOKEN   (Upstash nativo), ou
//   KV_REST_API_URL         + KV_REST_API_TOKEN          (Vercel KV)
// Sem essas variáveis, a função responde { enabled:false } e o site apenas
// esconde o contador — nada quebra.

const crypto = require("crypto");

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
const SALT = process.env.COUNTER_SALT || "a-conta-da-virada-2026";

const TTL_SEGUNDOS = 60 * 60 * 48;   // 48h: cobre a virada do dia com folga
const COUNTER_KEY = "acv:total";     // contador agregado

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.headers["x-real-ip"] || (req.socket && req.socket.remoteAddress) || "desconhecido";
}

// data no fuso de São Paulo: o "dia" vira à meia-noite local (America/Sao_Paulo)
function diaBR() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

// envia um comando Redis pela REST API (corpo = array JSON)
async function redis(args) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  return r.json(); // { result: ... }
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (!REDIS_URL || !REDIS_TOKEN) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ enabled: false }));
  }

  try {
    if (req.method === "POST") {
      const dia = diaBR();
      const ip = clientIp(req);
      const hash = crypto.createHash("sha256").update(SALT + "|" + dia + "|" + ip).digest("hex").slice(0, 20);
      const key = "acv:seen:" + dia + ":" + hash;

      // SET key 1 NX EX TTL -> "OK" se é a 1ª vez do IP hoje; null se já viu hoje
      const set = await redis(["SET", key, "1", "NX", "EX", String(TTL_SEGUNDOS)]);
      const novo = set && set.result === "OK";

      const total = novo
        ? (await redis(["INCR", COUNTER_KEY])).result
        : (await redis(["GET", COUNTER_KEY])).result;

      res.statusCode = 200;
      return res.end(JSON.stringify({ enabled: true, total: Number(total) || 0, counted: !!novo }));
    }

    // GET: só lê o total, sem contar
    const total = (await redis(["GET", COUNTER_KEY])).result;
    res.statusCode = 200;
    return res.end(JSON.stringify({ enabled: true, total: Number(total) || 0 }));
  } catch (e) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ enabled: false, error: "indisponivel" }));
  }
};
