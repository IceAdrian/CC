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

    // Statische Dateien direkt durchlassen
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
      } catch (e) {}
    }

    // URL-Parameter für den allerersten Aufruf setzen (nur bei GET)
    if (request.method === "GET" && trackerId && !url.searchParams.has("trackerId")) {
      url.searchParams.set("trackerId", trackerId);
      if (affiliateId) url.searchParams.set("affiliateId", affiliateId);
      return Response.redirect(url.toString(), 302);
    }

    // WICHTIG: Wir leiten hier alle Anfragen (egal ob GET oder POST für Login/Registrierung) 
    // an die echte Casino-Seite weiter, bleiben aber auf deiner Domain!
    const fetchUrl = new URL(url.pathname + url.search, targetBase);
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set("Host", "www.21.com");
    proxyHeaders.set("Referer", "https://www.21.com/");

    const fetchOptions = {
      method: request.method,
      headers: proxyHeaders,
      redirect: "manual" // Verhindert harte Weiterleitungen des Casinos weg von deiner Domain
    };

    // Wenn der Nutzer Login-/Registrierungsdaten absendet (POST), reichen wir sie durch
    if (request.method === "POST") {
      fetchOptions.body = request.body;
    }

    const response = await fetch(fetchUrl, fetchOptions);

    // Falls das Casino versucht, den Nutzer per Redirect woandershin zu schicken, fangen wir das ab
    const locationHeader = response.headers.get("Location");
    if (locationHeader && (response.status === 301 || response.status === 302 || response.status === 303)) {
      const redirectUrl = new URL(locationHeader, targetBase);
      // Wir behalten den Nutzer auf deiner Domain bei
      redirectUrl.host = url.host; 
      return Response.redirect(redirectUrl.toString(), response.status);
    }

    const contentType = response.headers.get("content-type") || "";

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

                    // Links auf der Seite mit Affiliate-Daten versorgen
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

      // Cookies für das Tracking beibehalten
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
