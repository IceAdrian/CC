export default {
  async fetch(request) {
    // MUSS die Casino-Hauptseite sein (enthält HTML, CSS & Spiele)
    const targetBase = "https://www.21.com";
    
    // DEIN AFFILIATE-LINK (wird aufgerufen, wenn jemand klickt)
    const affiliateUrl = "https://prod.trk21.com/click?offer=FF5GG2YAJ0P0&uid=CVuo3XCJ";
    
    // DEIN NEUES LOGO
    const newLogoUrl = "https://images.law.com/brightspot/07/9a/9f50cbdc4a4eaa523a73b70a4814/flank-logo-1-767x633.jpg";

    const url = new URL(request.url);
    const fetchUrl = new URL(url.pathname + url.search, targetBase);

    const response = await fetch(fetchUrl, {
      method: request.method,
      headers: {
        "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Host": "www.21.com",
        "Referer": "https://www.21.com/"
      }
    });

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      return new HTMLRewriter()
        // 1. Alle HTML-Links (<a>), die zur Registrierung führen, durch deinen Affiliate-Link ersetzen
        .on("a", {
          element(el) {
            const href = (el.getAttribute("href") || "").toLowerCase();
            if (
              href.includes("register") ||
              href.includes("signup") ||
              href.includes("join") ||
              href.includes("login")
            ) {
              el.setAttribute("href", affiliateUrl);
              el.setAttribute("target", "_blank"); // Öffnet in neuem Tab für sauberes Tracking
            }
          }
        })
        // 2. Logo austauschen + Klick-Interceptor für Buttons einfügen
        .on("head", {
          element(el) {
            el.append(`
              <style>
                /* Ersetzt das Logo dauerhaft */
                img[src*="logo"], img[alt*="21.com"], img[aria-label*="21.com"] {
                  content: url("${newLogoUrl}") !important;
                }
              </style>
              <script>
                document.addEventListener("DOMContentLoaded", function() {
                  // Fängt Klicks auf Buttons ab, die kein normales <a>-Tag sind
                  document.addEventListener("click", function(e) {
                    const target = e.target.closest("a, button");
                    if (!target) return;

                    const text = (target.innerText || "").toLowerCase();
                    const href = (target.getAttribute("href") || "").toLowerCase();

                    if (
                      text.includes("registrier") ||
                      text.includes("anmelden") ||
                      text.includes("jetzt spielen") ||
                      text.includes("konto") ||
                      href.includes("register") ||
                      href.includes("signup")
                    ) {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open("${affiliateUrl}", "_blank");
                    }
                  }, true);
                });
              </script>
            `, { html: true });
          }
        })
        .transform(response);
    }

    return response;
  }
};
