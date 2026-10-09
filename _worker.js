export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // Deinen Tracking-Link und dein Logo eintragen
    const affiliateTrackerUrl = "https://prod.trk21.com/click?offer=FF5GG2YAJ0P0&uid=CVuo3XCJ";
    const newLogoUrl = "https://images.law.com/brightspot/07/9a/9f50cbdc4a4eaa523a73b70a4814/flank-logo-1-767x633.jpg"; 
    const targetBase = "https://www.21.com";

    // 1. Statische Dateien (Bilder, CSS, JS) direkt durchlassen
    const isStaticFile = url.pathname.match(/\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot|ico|json)$/i);
    if (isStaticFile) {
      const fetchUrl = new URL(url.pathname + url.search, targetBase);
      return fetch(fetchUrl, {
        headers: { "Host": "www.21.com", "User-Agent": request.headers.get("User-Agent") || "" }
      });
    }

    // 2. Cookies auslesen (um zu prüfen, ob sich der Worker die trackerId schon gemerkt hat)
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
      const [k, v] = c.trim().split('=');
      return [k, v];
    }));

    let affiliateId = url.searchParams.get("affiliateId") || cookies["aff_affiliateId"];
    let trackerId = url.searchParams.get("trackerId") || cookies["aff_trackerId"];

    // 3. Nur wenn WEDER in der URL noch im Cookie eine trackerId liegt, fragen wir den Tracker EINMALIG an
    if (!trackerId) {
      try {
        const trackerResponse = await fetch(affiliateTrackerUrl, {
          method: "GET",
          headers: {
            "User-Agent": request.headers.get("User-Agent") || "",
            "X-Forwarded-For": request.headers.get("CF-Connecting-IP") || "",
            "CF-Connecting-IP": request.headers.get("CF-Connecting-IP") || ""
          },
          redirect: "manual"
        });

        const locationHeader = trackerResponse.headers.get("Location");
        if (locationHeader) {
          const redirectTarget = new URL(locationHeader);
          affiliateId = redirectTarget.searchParams.get("affiliateId");
          trackerId = redirectTarget.searchParams.get("trackerId");
        }
      } catch (e) {
        console.error("Tracker Fetch Fehler:", e);
      }
    }

    // 4. Wenn wir die IDs haben, aber sie noch NICHT in der aktuellen URL stehen (z.B. nach Klick auf ein Spiel),
    // hängen wir sie an die URL an.
    if (trackerId && !url.searchParams.has("trackerId")) {
      url.searchParams.set("trackerId", trackerId);
      if (affiliateId) url.searchParams.set("affiliateId", affiliateId);
      return Response.redirect(url.toString(), 302);
    }

    // 5. Seite von 21.com laden
    const fetchUrl = new URL(url.pathname + url.search, targetBase);
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set("Host", "www.21.com");
    proxyHeaders.set("Referer", "https://www.21.com/");

    const response = await fetch(fetchUrl, {
      method: request.method,
      headers: proxyHeaders
    });

    const contentType = response.headers.get("content-type") || "";

    // 6. Logo austauschen + Links auf der Seite automatisch mit Affiliate-Parametern ausstatten
    if (contentType.includes("text/html")) {
      let newResponse = new HTMLRewriter()
        .on("head", {
          element(el) {
            el.append(`
              <style>
                /* Logo dauerhaft ersetzen */
                img[src*="logo"], img[alt*="21.com"], img[aria-label*="21.com"] {
                  content: url("${newLogoUrl}") !important;
                }
              </style>
              <script>
                // Automatisch bei jedem Klick auf ein Spiel/Link auf der Seite die IDs mitgeben
                (function() {
                  const affId = "${affiliateId || ''}";
                  const trkId = "${trackerId || ''}";
                  if (!affId || !trkId) return;

                  document.addEventListener("click", function(e) {
                    const a = e.target.closest("a");
                    if (a && a.href && a.href.startsWith(window.location.origin)) {
                      try {
                        const linkUrl = new URL(a.href);
                        if (!linkUrl.searchParams.has("trackerId")) {
                          linkUrl.searchParams.set("trackerId", trkId);
                          linkUrl.searchParams.set("affiliateId", affId);
                          a.href = linkUrl.toString();
                        }
                      } catch(err) {}
                    }
                  }, true);
                })();
              </script>
            `, { html: true });
          }
        })
        .transform(response);

      // Die IDs im Cookie des Nutzers für 30 Tage speichern
      const headers = new Headers(newResponse.headers);
      if (trackerId) {
        headers.append("Set-Cookie", `aff_trackerId=${trackerId}; Path=/; Max-Age=2592000; SameSite=Lax`);
      }
      if (affiliateId) {
        headers.append("Set-Cookie", `aff_affiliateId=${affiliateId}; Path=/; Max-Age=2592000; SameSite=Lax`);
      }

      return new Response(newResponse.body, {
        status: newResponse.status,
        statusText: newResponse.statusText,
        headers: headers
      });
    }

    return response;
  }
};
