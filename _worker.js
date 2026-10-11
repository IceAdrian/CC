export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetBase = "https://coins.game";

    // =========================================================================
    // KONFIGURATION (Coins.game)
    // =========================================================================
    const affiliateInitUrl = "https://coins.game/c/2957023_cb861072";
    
    // Passe hier deine eigenen Branding-Daten an:
    const newLogoUrl = "https://DEINE-DOMAIN.com/DEIN-NEUES-LOGO.png"; 
    const customFaviconUrl = "https://DEINE-DOMAIN.com/DEIN-FAVICON.png"; 
    const customTabTitle = "Coins.game - Krypto Casino & Bonus"; 

    const textReplacements = {
      "Coins.game": "MeinCasino",
      "Sign Up": "Registrieren",
      "Log In": "Anmelden"
    };
    // =========================================================================

    // 1. Prüfen, ob der Nutzer bereits das Affiliate-Tracking initialisiert hat (via Cookie)
    const cookieHeader = request.headers.get("Cookie") || "";
    const hasTracked = cookieHeader.includes("coins_tracked=1");
    let extraCookiesToSet = [];

    if (!hasTracked) {
      try {
        // Wir besuchen im Hintergrund deinen Affiliate-Link, damit Coins.game den Tracking-Cookie setzt
        const initResponse = await fetch(affiliateInitUrl, {
          method: "GET",
          headers: {
            "User-Agent": request.headers.get("User-Agent") || "",
            "X-Forwarded-For": request.headers.get("CF-Connecting-IP") || "",
            "CF-Connecting-IP": request.headers.get("CF-Connecting-IP") || ""
          },
          redirect: "manual"
        });

        // Wir sammeln alle Cookies, die Coins.game für das Affiliate-Tracking vergibt
        const setCookieHeaders = initResponse.headers.get("set-cookie");
        if (setCookieHeaders) {
          // Cookies für den Nutzer übernehmen
          extraCookiesToSet.push(setCookieHeaders);
        }
        // Unser eigener Marker, damit das nicht bei jedem Klick neu gemacht werden muss
        extraCookiesToSet.push("coins_tracked=1; Path=/; Max-Age=2592000; SameSite=Lax");
      } catch (e) {}
    }

    // 2. Ziel-URL für den Proxy aufbauen
    const targetUrl = new URL(url.pathname + url.search, targetBase);

    // 3. Proxy-Header für Coins.game vorbereiten
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set("Host", "coins.game");
    proxyHeaders.set("Origin", "https://coins.game");
    proxyHeaders.set("Referer", "https://coins.game/");

    // Falls Tracking-Cookies vorhanden sind, geben wir sie an die Anfrage an Coins.game weiter
    if (cookieHeader) {
      proxyHeaders.set("Cookie", cookieHeader);
    }

    const fetchOptions = {
      method: request.method,
      headers: proxyHeaders,
      redirect: "follow"
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      fetchOptions.body = request.body;
    }

    let response;
    try {
      response = await fetch(targetUrl, fetchOptions);
    } catch (err) {
      return new Response(JSON.stringify({ error: "Proxy connection failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const contentType = response.headers.get("content-type") || "";

    // 4. Wenn HTML zurückkommt, Branding anpassen (Logo, Titel, Favicon, Texte)
    if (contentType.includes("text/html")) {
      let newResponse = new HTMLRewriter()
        .on("head", {
          element(el) {
            el.append(`
              <style>
                /* Coins.game Logo-Selektoren dauerhaft überschreiben */
                img[src*="logo"], img[alt*="Coins"], svg[class*="logo"] {
                  content: url("${newLogoUrl}") !important;
                }
              </style>
              <script>
                (function() {
                  const newTitle = "${customTabTitle}";
                  const newFavicon = "${customFaviconUrl}";
                  const replacements = ${JSON.stringify(textReplacements)};

                  if (newTitle) {
                    document.title = newTitle;
                    try {
                      Object.defineProperty(document, 'title', {
                        get: function() { return newTitle; },
                        set: function() {}
                      });
                    } catch(e) {}
                  }

                  function enforceFavicon() {
                    if (!newFavicon) return;
                    let icons = document.querySelectorAll("link[rel*='icon'], link[rel='shortcut icon']");
                    if (icons.length === 0) {
                      let link = document.createElement('link');
                      link.rel = 'icon';
                      link.href = newFavicon;
                      document.head.appendChild(link);
                    } else {
                      icons.forEach(icon => {
                        if (icon.href !== newFavicon) icon.href = newFavicon;
                      });
                    }
                  }

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
                    enforceFavicon();
                    replaceTextNodes(document.body);

                    const headObserver = new MutationObserver(() => {
                      if (newTitle) {
                        const titleTag = document.querySelector("title");
                        if (titleTag && titleTag.innerText !== newTitle) {
                          titleTag.innerText = newTitle;
                        }
                      }
                      enforceFavicon();
                    });
                    if (document.head) {
                      headObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
                    }

                    const bodyObserver = new MutationObserver((mutations) => {
                      mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => replaceTextNodes(node));
                      });
                    });
                    if (document.body) {
                      bodyObserver.observe(document.body, { childList: true, subtree: true });
                    }
                  });
                })();
              </script>
            `, { html: true });
          }
        })
        .transform(response);

      const finalHeaders = new Headers(newResponse.headers);
      finalHeaders.delete("Content-Security-Policy");
      
      for (const c of extraCookiesToSet) {
        finalHeaders.append("Set-Cookie", c);
      }

      return new Response(newResponse.body, {
        status: newResponse.status,
        statusText: newResponse.statusText,
        headers: finalHeaders
      });
    }

    // Für API-Aufrufe, JSON, Bilder, CSS etc.
    const finalHeaders = new Headers(response.headers);
    finalHeaders.delete("Content-Security-Policy");
    for (const c of extraCookiesToSet) {
      finalHeaders.append("Set-Cookie", c);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: finalHeaders
    });
  }
};
