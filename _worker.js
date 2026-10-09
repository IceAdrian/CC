export default {
  async fetch(request) {
    const targetBase = "https://www.21.com";
    const affiliateUrl = "https://prod.trk21.com/click?offer=FF5GG2YAJ0P0&uid=CVuo3XCJ";
    
    // ACHTUNG: Hier wieder deinen Logo-Link eintragen!
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
                /* Logo dauerhaft überschreiben */
                img[src*="logo"], img[alt*="21.com"], img[aria-label*="21.com"] {
                  content: url("${newLogoUrl}") !important;
                }
              </style>
              <script>
                const affLink = "${affiliateUrl}";
                
                // Fängt Klicks aggressiv auf der höchsten Browser-Ebene ab (Capture Phase)
                window.addEventListener("click", function(e) {
                  const target = e.target.closest("a, button, [role='button']");
                  if (!target) return;
                  
                  const text = (target.textContent || "").toLowerCase();
                  const href = (target.getAttribute("href") || "").toLowerCase();

                  // Prüfen, ob der Klick mit Anmeldung, Registrierung oder Spielen zu tun hat
                  if (
                    href.includes("register") || href.includes("login") || href.includes("signup") ||
                    text.includes("registrier") || text.includes("anmelden") || text.includes("login") ||
                    text.includes("spielen") || text.includes("einzahlen") || text.includes("konto")
                  ) {
                    e.preventDefault(); // Verhindert das Öffnen des Login-Popups
                    e.stopPropagation(); // Blockiert das Casino-Skript
                    window.location.href = affLink; // Sofortige Weiterleitung zum Tracker
                  }
                }, true); // <- Dieses 'true' ist der Gamechanger!
              </script>
            `, { html: true });
          }
        })
        .transform(response);
    }

    return response;
  }
};
