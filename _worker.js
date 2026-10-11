export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetBase = "https://vave.com";

    // =========================================================================
    // KONFIGURATION (Hier kannst du alles anpassen)
    // =========================================================================
    const affiliateTrackerUrl = "https://go.vavepartners.com/redirect.aspx?pid=113375&bid=1481&lpid=204";
    
    const newLogoUrl = "https://DEINE-DOMAIN.com/DEIN-NEUES-LOGO.png"; 
    const customFaviconUrl = "https://DEINE-DOMAIN.com/DEIN-FAVICON.png"; 

    const customTabTitle = "Vave - Sportwetten & Casino"; 

    // Begriffe auf der Vave-Seite suchen und ersetzen
    const textReplacements = {
      "Vave": "MeinCasino",
      "Willkommensbonus": "Exklusiver Bonus",
      "Registrieren": "Konto erstellen"
    };
    // =========================================================================

    // Statische Dateien (Bilder, CSS, JS etc.) direkt durchlassen
    const isStaticFile = url.pathname.match(/\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot|ico|json|webp)$/i);
    if (isStaticFile) {
      const fetchUrl = new URL(url.pathname + url.search, targetBase);
      const proxyHeaders = new Headers(request.headers);
      proxyHeaders.set("Host", "vave.com");
      return fetch(fetchUrl, { headers: proxyHeaders });
    }

    // 1. Cookies auslesen
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
      const [k, v] = c.trim().split('=');
      return [k, v];
    }));

    let refParams = cookies["vave_ref"] || "";
    let setCookiesToSave = [];

    // 2. Wenn noch kein Tracking-Cookie da ist, einmalig den Affiliate-Link im Hintergrund abfragen
    if (!refParams) {
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
          refParams = redirectTarget.search; // Speichert alle Tracking-Parameter (z.B. ?pid=...)
          
          if (refParams) {
            setCookiesToSave.push(`vave_ref=${encodeURIComponent(refParams)}; Path=/; Max-Age=2592000; SameSite=Lax`);
          }
        }
      } catch (e) {}
    }

    // Falls Parameter im Cookie liegen, hängen wir sie an die Ziel-URL an
    const targetUrl = new URL(url.pathname + url.search, targetBase);
    if (refParams && !targetUrl.search) {
      // Wenn keine eigenen Query-Parameter da sind, die Tracking-Parameter anhängen
      const params = new URLSearchParams(refParams);
      params.forEach((val, key) => {
        if (!targetUrl.searchParams.has(key)) targetUrl.searchParams.set(key, val);
      });
    }

    // 3. Proxy-Anfrage an Vave senden
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set("Host", "vave.com");
    proxyHeaders.set("Origin", "https://vave.com");
    proxyHeaders.set("Referer", "https://vave.com/");

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
      if (request.headers.get("accept")?.includes("application/json")) {
        return new Response(JSON.stringify({ error: "Proxy connection failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response("Proxy Error", { status: 500 });
    }

    const contentType = response.headers.get("content-type") || "";

    // 4. HTML bearbeiten (Logo, Titel, Favicon, Texte)
    if (contentType.includes("text/html")) {
      let newResponse = new HTMLRewriter()
        .on("head", {
          element(el) {
            el.append(`
              <style>
                img[src*="logo"], img[alt*="Vave"], svg[class*="logo"] {
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

    // Für API, Bilder, CSS, JS etc.
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
