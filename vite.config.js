import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// No app nativo (Capacitor) e no dev local os assets moram na raiz do
// domínio. No GitHub Pages (projeto, não usuário/org) eles moram em
// /<repo>/ — o workflow de deploy exporta GH_PAGES=true antes do build.
const BASE = process.env.GH_PAGES === "true" ? "/bookdex/" : "/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "fonts/*.woff2", "fonts/fonts.css", "icons/*.png"],
      manifest: {
        name: "Bookdex",
        short_name: "Bookdex",
        description: "Escaneie um assunto: técnicas, conceitos ou tipos, e monte sua Pokédex de conhecimento.",
        lang: "pt-BR",
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        orientation: "portrait",
        theme_color: "#D6293B",
        background_color: "#e8e6df",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: "index.html",
        // A API da Anthropic nunca é cacheada: geração de conteúdo exige rede.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "tecnicadex-static" },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
