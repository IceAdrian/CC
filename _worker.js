export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetBase = "https://www.21.com";

    // =========================================================================
    // KONFIGURATION
    // =========================================================================
    const affiliateTrackerUrl = "https://prod.trk21.com/click?offer=FF5GG2YAJ0P0&uid=CVuo3XCJ";
    
    const newLogoUrl = "https://DEINE-DOMAIN.com/DEIN-NEUES-LOGO.png"; 
    const customFaviconUrl = "https://DEINE-DOMAIN.com/DEIN-FAVICON.png"; 

    const customTabTitle = "Mein Casino - Exklusiver Bonus"; 

    const textReplacements = {
      "21.com": "MeinCasino",
      "Willkommensbonus": "Exklusiver 200% Bonus",
      "Registrieren": "Konto erstellen"
    };
    // =========================================================================

    // 1. Cookies auslesen
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
      const [k, v] = c.trim().split('=');
      return [k, v];
    }));

    let trackerId = cookies["aff_trackerId"];
    let affiliateId = cookies["aff_affiliateId"];
    let setCookiesToSave = [];

    // 2. Wenn noch keine Tracking-ID im Cookie ist, einmalig im Hintergrund anfragen
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

          if (trackerId) {
            setCookiesToSave.push(`aff_trackerId=${trackerId}; Path=/; Max-Age=2592000; SameSite=Lax`);
          }
          if (affiliateId) {
            setCookiesToSave.push(`aff_affiliateId=${affiliateId}; Path=/; Max-Age=2592000; SameSite=Lax`);
          }
        }
      } catch (e) {}
    }

    // 3. Ziel-URL für das Casino aufbauen
    const targetUrl = new URL(url.pathname + url.search, targetBase);
    if (trackerId && !targetUrl.searchParams.has("trackerId")) {
      targetUrl.searchParams.set("trackerId", trackerId);
      if (affiliateId) targetUrl.searchParams.set("affiliateId", affiliateId);
    }

    // 4. Proxy-Header vorbereiten (WICHTIG: Origin und Referer auf 21.com setzen für AJAX/Login)
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set("Host", "www.21.com");
    proxyHeaders.set("Origin", "https://www.21.com");
    proxyHeaders.set("Referer", "https://www.21.com/");

    const fetchOptions = {
      method: request.method,
      headers: proxyHeaders,
      redirect: "follow"
    };

    // Für POST/PUT (Login, Registrierung, AJAX-Calls) den Body sicher klonen
    if (request.method !== "GET" && request.method !== "HEAD") {
      try {
        fetchOptions.body = request.clone().body;
      } catch (e) {}
    }

    let response;
    try {
      response = await fetch(targetUrl, fetchOptions);
    } catch (err) {
      // JSON-freundlicher Fehler falls AJAX fehlschlägt
      if (request.headers.get("accept")?.includes("application/json")) {
        return new Response(JSON.stringify({ error: "Proxy connection failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response("Proxy Error", { status: 500 });
    }

    const contentType = response.headers.get("content-type") || "";

    // 5. Wenn HTML zurückkommt, Logo, Titel, Favicon und Texte anpassen
    if (contentType.includes("text/html")) {
      let newResponse = new HTMLRewriter()
        .on("head", {
          element(el) {
            el.append(`
              <style>
                img[src*="logo"], img[alt*="21.com"], img[aria-label*="21.com"] {
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
      
      for (const c of setCookiesToSave) {
        finalHeaders.append("Set-Cookie", c);
      }

      return new Response(newResponse.body, {
        status: newResponse.status,
        statusText: newResponse.statusText,
        headers: finalHeaders
      });
    }

    // Für API-Antworten, JSON, Bilder, CSS, JS etc.
    const finalHeaders = new Headers(response.headers);
    finalHeaders.delete("Content-Security-Policy");
    for (const c of setCookiesToSave) {
      finalHeaders.append("Set-Cookie", c);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: finalHeaders
    });
  }
};
