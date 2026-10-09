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

    // Nur reine Medien-Dateien direkt durchleiten
    const isStaticMedia = url.pathname.match(/\.(png|jpg|jpeg|gif|svg|css|woff|woff2|ttf|eot|ico)$/i);
    if (isStaticMedia) {
      const fetchUrl = new URL(url.pathname + url.search, targetBase);
      return fetch(fetchUrl, {
        headers: { "Host": "www.21.com", "User-Agent": request.headers.get("User-Agent") || "" }
      });
    }

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
      fetchOptions.duplex = "half";
    }

    const response = await fetch(fetchUrl, fetchOptions);

    const newHeaders = new Headers(response.headers);

    // 1. Cookies an die eigene Domain anpassen
    const rawCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    if (rawCookies.length > 0) {
      newHeaders.delete("Set-Cookie");
      for (let cookie of rawCookies) {
        newHeaders.append("Set-Cookie", cookie.replace(/Domain=[^;]+;?/gi, ''));
      }
    } else {
      const singleCookie = response.headers.get("Set-Cookie");
      if (singleCookie) {
        newHeaders.set("Set-Cookie", singleCookie.replace(/Domain=[^;]+;?/gi, ''));
      }
    }

    // 2. HTTP-Redirects abfangen und auf die eigene Domain umbiegen
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

    // 3. JSON & API-ANTWORTEN ANPASSEN (Verhindert, dass API-Antworten die originale URL zurückgeben)
    if (contentType.includes("application/json") || contentType.includes("text/plain")) {
      let text = await response.text();
      text = text.replace(/https?:\/\/(www\.)?21\.com/gi, url.origin);
      return new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }

    // 4. HTML-ANTWORTEN ANPASSEN (Inklusive Client-Side Interceptor Script)
    if (contentType.includes("text/html")) {
      let newResponse = new HTMLRewriter()
        .on("head", {
          element(el) {
            // Mit prepend wird das Script ganz oben eingefügt, NOCH BEVOR das Casino-Script startet
            el.prepend(`
              <script>
                (function() {
                  const MY_ORIGIN = window.location.origin;
                  const TARGET_REGEX = /https?:\\/\\/(www\\.)?21\\.com/gi;

                  // A) Abfangen von clientseitigen fetch-Aufrufen
                  const origFetch = window.fetch;
                  window.fetch = function(input, init) {
                    if (typeof input === 'string') {
                      input = input.replace(TARGET_REGEX, MY_ORIGIN);
                    } else if (input && input.url) {
                      const newUrl = input.url.replace(TARGET_REGEX, MY_ORIGIN);
                      input = new Request(newUrl, input);
                    }
                    return origFetch.call(this, input, init);
                  };

                  // B) Abfangen von XMLHttpRequest (XHR)
                  const origOpen = XMLHttpRequest.prototype.open;
                  XMLHttpRequest.prototype.open = function(method, url, ...args) {
                    if (typeof url === 'string') {
                      url = url.replace(TARGET_REGEX, MY_ORIGIN);
                    }
                    return origOpen.call(this, method, url, ...args);
                  };

                  // C) Abfangen von JS-Umleitungen (window.location.assign / replace)
                  const origAssign = window.location.assign.bind(window.location);
                  window.location.assign = function(url) {
                    origAssign(typeof url === 'string' ? url.replace(TARGET_REGEX, MY_ORIGIN) : url);
                  };

                  const origReplace = window.location.replace.bind(window.location);
                  window.location.replace = function(url) {
                    origReplace(typeof url === 'string' ? url.replace(TARGET_REGEX, MY_ORIGIN) : url);
                  };
                })();
              </script>
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
