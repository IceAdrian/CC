export default {
  async fetch(request) {
    // Direkte Zielseite der Casino-Website nutzen (nicht den Tracking-Link)
    const targetBase = "https://www.21.com;
    
    const url = new URL(request.url);
    const fetchUrl = new URL(url.pathname + url.search, targetBase);

    // Anfrage an das Casino mit echten Browser-Headern schicken
    const response = await fetch(fetchUrl, {
      method: request.method,
      headers: {
        "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Host": "www.21.com",
        "Referer": "https://www.21.com/"
      }
    });

    const contentType = response.headers.get("content-type") || "";
    
    // Wenn HTML geliefert wird, tauschen wir das Logo aus
    if (contentType.includes("text/html")) {
      return new HTMLRewriter()
        .on('img[src*="logo.svg"]', {
          element(e) {
            // Ersetze diese URL mit dem Link zu deinem eigenen Logo
            e.setAttribute("src", "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQEu-B3ZjMB6CQ-rhWdgJKFi8yt8mVwholTCJ8S6pKvBw&s");
            e.setAttribute("srcset", ""); // Deaktiviert alternative Bildquellen
          }
        })
        .transform(response);
    }
    
    return response;
  }
};
