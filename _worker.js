export default {
  async fetch(request) {
    // Hier deinen kompletten Affiliate-Link eintragen
    const targetBase = "https://prod.trk21.com/click?offer=FF5GG2YAJ0P0&uid=CVuo3XCJ";
    
    const url = new URL(request.url);
    const fetchUrl = new URL(url.pathname + url.search, targetBase);

    // Anfrage an das Casino schicken
    const response = await fetch(fetchUrl, {
      method: request.method,
      headers: {
        "User-Agent": request.headers.get("User-Agent") || "",
        "Host": "www.21.com",
        "Referer": "https://www.21.com/"
      }
    });

    const contentType = response.headers.get("content-type") || "";
    
    // Wenn das Casino HTML-Code ausliefert, tauschen wir Inhalte aus
    if (contentType.includes("text/html")) {
      return new HTMLRewriter()
        .on("img", {
          element(e) {
            // Sobald du weißt, wie die Klasse des 21.com Logos heißt, kannst du hier die Bild-URL ersetzen
            // e.setAttribute("src", "https://deine-seite.com/neues-logo.png");
          }
        })
        .transform(response);
    }
    
    // Alle anderen Dateien (CSS, Bilder) normal durchlassen
    return response;
  }
};