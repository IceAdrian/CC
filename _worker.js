export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Die Ziel-URL, die im Hintergrund geladen werden soll
    const targetUrl = "https://beefway6tower.com/ca12d670c" + url.search;

    // Anfrage an die Zielseite weiterleiten
    const modifiedRequest = new Request(targetUrl, {
      headers: request.headers,
      method: request.method,
      body: request.body,
      redirect: "follow"
    });

    try {
      let response = await fetch(modifiedRequest);
      
      // Antwort zurückgeben (optional: Header anpassen, falls Frames blockiert werden)
      let newResponse = new Response(response.body, response);
      newResponse.headers.delete("X-Frame-Options");
      newResponse.headers.delete("Content-Security-Policy");
      
      return newResponse;
    } catch (e) {
      return new Response("Fehler beim Laden der Zielseite: " + e.message, { status: 500 });
    }
  },
};
