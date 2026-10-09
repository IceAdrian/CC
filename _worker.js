export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetBase = "https://www.21.com";

    // =========================================================================
    // 1. KONFIGURATION
    // =========================================================================
    const affiliateTrackerUrl = "https://prod.trk21.com/click?offer=FF5GG2YAJ0P0&uid=CVuo3XCJ";
    
    const newLogoUrl = "https://cdn.phototourl.com/member/2026-10-09-e328e6ac-8adb-4699-97f1-35ca1f9f17ac.png"; 
    const customFaviconUrl = "https://cdn.phototourl.com/member/2026-10-09-e328e6ac-8adb-4699-97f1-35ca1f9f17ac.png"; 

    const customTabTitle = "11bet - Bestes online Casino inkl. Sportwetten"; 

    const textReplacements = {
      "21.com": "11bet",
      "21": "11bet",
      "21-Casino": "11bet"
    };
    // =========================================================================

    // Nur rein statische Medien direkt durchleiten (.js entfernt, damit wir es umschreiben können)
    const isStaticMedia = url.pathname.match(/\.(png|jpg|jpeg|gif|svg|css|woff|woff2|ttf|eot|ico|json)$/i);
    if (isStaticMedia) {
      const fetchUrl = new URL(url.pathname + url.search, targetBase);
      return fetch(fetchUrl, {
        headers: { "Host": "www.21.com", "User-Agent": request.headers.get("User-Agent") || "" }
      });
    }

    // Cookie & Affiliate Tracking
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
      const [k, v] = c.trim().split('=');
      return [k || '', v || ''];
    }));

    let affiliateId = url.searchParams.get("affiliateId") || cookies["aff_affiliateId"];
    let trackerId = url.searchParams.get("trackerId") || cookies["aff_trackerId"];

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

    if (trackerId && !url.searchParams.has("trackerId")) {
      url.searchParams.set("trackerId", trackerId);
      if (affiliateId) url.searchParams.set("affiliateId", affiliateId);
      return Response.redirect(url.toString(), 302);
    }

    // Request-Headers für den Proxy anpassen
    const fetchUrl = new URL(url.pathname + url.search, targetBase);
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set("Host", "www.21.com");
    proxyHeaders.set("Referer", "https://www.21.com/");
    if (request.headers.get("Origin")) {
      proxyHeaders.set("Origin", "https://www.21.com");
    }

    const fetchOptions = {
      method: request.method,
      headers: proxyHeaders,
      redirect: "manual"
    };

    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase())) {
      fetchOptions.body = request.body;
    }

    const response = await fetch(fetchUrl, fetchOptions);

    // Response Headers bereinigen
    const newHeaders = new Headers(response.headers);

    // 1. Set-Cookie Domain entfernen, damit Cookies auf deiner Domain gespeichert werden
    const rawCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    if (rawCookies.length > 0) {
      newHeaders.delete("Set-Cookie");
      for (let cookie of rawCookies) {
        newHeaders.append("Set-Cookie", cookie.replace(/Domain=[^;]+;?/gi, ''));
      }
    }

    // 2. Server-Seitige Umleitungen auf deine Domain umschreiben
    const location = newHeaders.get("Location");
    if (location) {
      const rewrittenLocation = location.replace(/https?:\/\/(www\.)?21\.com/gi, url.origin);
      newHeaders.set("Location", rewrittenLocation);
    }

    if (trackerId) {
      newHeaders.append("Set-Cookie", `aff_trackerId=${trackerId}; Path=/; Max-Age=2592000; SameSite=Lax`);
    }
    if (affiliateId) {
      newHeaders.append("Set-Cookie", `aff_affiliateId=${affiliateId}; Path=/; Max-Age=2592000; SameSite=Lax`);
    }

    const contentType = response.headers.get("content-type") || "";

    // 3. JavaScript-Dateien abfangen und URLs durch deine Domain ersetzen
    if (contentType.includes("javascript") || url.pathname.endsWith(".js")) {
      let jsText = await response.text();
      jsText = jsText.replace(/https?:\/\/(www\.)?21\.com/gi, url.origin);
      jsText = jsText.replace(/https?:\\\/\\\/www\.21\.com/gi, url.origin.replace(/\//g, '\\/'));
      return new Response(jsText, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }

    // 4. HTML-Transformation mit Client-Seitigem Interceptor
    if (contentType.includes("text/html")) {
      let newResponse = new HTMLRewriter()
        .on("head", {
          element(el) {
            el.prepend(`
              <script>
                // CLIENT-SIDE INTERCEPTOR: Verhindert, dass JS im Browser direkt auf 21.com zugreift
                (function() {
                  const myOrigin = window.location.origin;
                  const targetRegex = /https?:\\/\\/(www\\.)?21\\.com/gi;

                  // Intercept fetch API
                  const origFetch = window.fetch;
                  window.fetch = function(input, init) {
                    if (typeof input === 'string') {
                      input = input.replace(targetRegex, myOrigin);
                    } else if (input && input.url) {
                      const newUrl = input.url.replace(targetRegex, myOrigin);
                      input = new Request(newUrl, input);
                    }
                    return origFetch.call(this, input, init);
                  };

                  // Intercept XMLHttpRequest (AJAX)
                  const origOpen = XMLHttpRequest.prototype.open;
                  XMLHttpRequest.prototype.open = function(method, url, ...args) {
                    if (typeof url === 'string') {
                      url = url.replace(targetRegex, myOrigin);
                    }
                    return origOpen.call(this, method, url, ...args);
                  };

                  // Intercept SPA Routing (pushState / replaceState)
                  const origPush = history.pushState;
                  history.pushState = function(state, title, url) {
                    if (url && typeof url === 'string') {
                      url = url.replace(targetRegex, myOrigin);
                    }
                    return origPush.call(this, state, title, url);
                  };

                  const origReplace = history.replaceState;
                  history.replaceState = function(state, title, url) {
                    if (url && typeof url === 'string') {
                      url = url.replace(targetRegex, myOrigin);
                    }
                    return origReplace.call(this, state, title, url);
                  };
                })();
              </script>
            `, { html: true });

            el.append(`
              <style>
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

                  if (newTitle) {
                    document.title = newTitle;
                    try {
                      Object.defineProperty(document, 'title', {
                        get: function() { return newTitle; },
                        set: function() { /* Ignorieren */ }
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

      return new Response(newResponse.body, {
        status: newResponse.status,
        statusText: newResponse.statusText,
        headers: newHeaders
      });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
};
