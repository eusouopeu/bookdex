/**
 * PLANO B (opcional) — proxy mínimo para a API da Anthropic.
 *
 * Use apenas se a chamada direta do WebView/navegador for bloqueada por CORS.
 * O Worker injeta a chave guardada no servidor (secret ANTHROPIC_API_KEY), de
 * modo que a chave não precisa ficar no aparelho.
 *
 * Deploy:
 *   npm create cloudflare@latest tecnicadex-proxy   # template "Hello World"
 *   # substitua src/index.js por este arquivo
 *   npx wrangler secret put ANTHROPIC_API_KEY
 *   npx wrangler secret put SHARED_TOKEN           # opcional, ver abaixo
 *   npx wrangler deploy
 *
 * Depois cole a URL do Worker em Configurações → Proxy, por exemplo:
 *   https://tecnicadex-proxy.SEU-SUBDOMINIO.workers.dev/v1/messages
 *
 * ATENÇÃO: um Worker sem proteção deixa qualquer pessoa gastar sua cota. Defina
 * o secret SHARED_TOKEN e informe esse valor no campo "API key" do app — ele é
 * enviado no header x-api-key e conferido aqui antes de chamar a Anthropic.
 */

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key, anthropic-version",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: cors });
    }

    if (env.SHARED_TOKEN && request.headers.get("x-api-key") !== env.SHARED_TOKEN) {
      return new Response(JSON.stringify({ error: { message: "Token inválido." } }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: await request.text(),
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};
