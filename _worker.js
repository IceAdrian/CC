export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // 1. Deine Links
    const affiliateTrackerUrl = "https://prod.trk21.com/click?offer=FF5GG2YAJ0P0&uid=CVuo3XCJ";
    
    // WICHTIG: Hier dein neues Logo eintragen!
    const newLogoUrl = "https://images.law.com/brightspot/07/9a/9f50cbdc4a4eaa523a73b70a4814/flank-logo-1-767x633.jpg"; 
    const targetBase = "https://www.21.com";

    // 2. Wir rufen den Tracker nur auf, wenn es sich um eine Webseite handelt (keine Bilder/CSS) 
    // UND wenn die trackerId noch fehlt.
    const isStaticFile = url.pathname.match(/\.[a-zA-Z0-9]+$/);
    
    if (!isStaticFile && !url.searchParams.has("trackerId")) {
      
      // Worker fragt den Tracker im Hintergrund an.
      // 'redirect: "manual"' bedeutet: Folge der Weiterleitung nicht, sondern lies sie nur aus.
      const trackerResponse = await fetch(affiliateTrackerUrl, {
        method: "GET",
        headers: {
          // Wir geben die echte IP des Nutzers an den Tracker weiter, damit keine Test Console kommt
          "User-Agent": request.headers.get("User-Agent") || "",
          "X-Forwarded-For": request.headers.get("CF-Connecting-IP") || "",
          "CF-Connecting-IP": request.headers.get("CF-Connecting-IP") || ""
        },
        redirect: "manual" 
      });

      // Wir lesen das Ziel aus (das ist die 21.com URL mit der generierten trackerId)
      const locationHeader = trackerResponse.headers.get("Location");

      if (locationHeader && locationHeader.includes("trackerId")) {
        const redirectTarget = new URL(locationHeader);
        
        // Wir nehmen DEINE URL und hängen den Pfad (/de) und die Tracking-Parameter an
        url.pathname = redirectTarget.pathname; 
        url.search = redirectTarget.search;     
        
        // Wir leiten den Nutzer auf SEINE EIGENE Worker-URL (aber mit Parametern) um
        return Response.redirect(url.toString(), 302);
      }
    }

    // 3. Ab hier hat der Nutzer die Parameter in der URL.
    // Wir spiegeln die Casino-Seite jetzt 1:1.
    const fetchUrl = new URL(url.pathname + url.search, targetBase);

    // Header anpassen, damit 21.com die Anfrage akzeptiert
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set("Host", "www.21.com");
    proxyHeaders.set("Referer", "https://www.21.com/");

    const response = await fetch(fetchUrl, {
      method: request.method,
      headers: proxyHeaders
    });

    const contentType = response.headers.get("content-type") || "";

    // 4. Logo austauschen (bleibt jetzt auch bei Registrierung erhalten!)
    if (contentType.includes("text/html")) {
      return new HTMLRewriter()
        .on("head", {
          element(el) {
            el.append(`
              <style>
                /* Überschreibt das Logo auf der gesamten Seite dauerhaft */
                img[src*="logo"], img[alt*="21.com"], img[aria-label*="21.com"] {
                  content: url("${newLogoUrl}") !important;
                }
              </style>
            `, { html: true });
          }
        })
        .transform(response);
    }

    return response;
  }
};
