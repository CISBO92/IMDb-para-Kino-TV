/**
 * Adaptación de Rating-Sync para el ecosistema de Kino TV
 * Desarrollado por CISBO92 (2026)
 */

let omdbKey = "";

// Inicialización: Lee la API Key que el usuario guardó en los ajustes de Kino
export async function init(settings) {
  omdbKey = settings.omdb_api_key || "";
}

// Define las secciones del menú principal de tu plugin
export async function getHomeRows() {
  return [
    { id: "peliculas_destacadas", title: "Catálogo de Video" }
  ];
}

// Obtiene los elementos de cada fila (Debes conectar esto a tu API de videos real)
export async function getHomeRowItems(rowId, page = 1) {
  try {
    // REEMPLAZA ESTA URL con la de tu servidor de contenido real si tienes uno
    const res = await fetch(`https://mi-fuente-de-video.com{page}`);
    const data = await res.json();

    return {
      items: data.results.map(item => ({
        id: item.id,
        title: item.title,
        poster: item.poster_url,
        type: "movie"
      })),
      hasMore: data.page < data.total_pages
    };
  } catch (err) {
    console.error("Error al cargar fila de videos:", err);
    return { items: [], hasMore: false };
  }
}

// Función auxiliar: Consulta OMDb y extrae las notas de IMDb y Rotten Tomatoes
async function fetchExternalRatings(title, year = "") {
  if (!omdbKey) return null;

  try {
    const url = `https://omdbapi.com{encodeURIComponent(title)}&y=${year}&apikey=${omdbKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.Response === "False") return null;

    let imdbRating = data.imdbRating || "N/A";
    let rtRating = "N/A";

    // Extrae la puntuación de Rotten Tomatoes del array secundario de OMDb
    if (data.Ratings && Array.isArray(data.Ratings)) {
      const rtSource = data.Ratings.find(r => r.Source === "Rotten Tomatoes");
      if (rtSource) rtRating = rtSource.Value;
    }

    return { imdb: imdbRating, rt: rtRating };
  } catch (error) {
    console.error("Error consultando OMDb:", error);
    return null;
  }
}

// Inyecta las calificaciones de forma dinámica en la ficha técnica de Kino TV
export async function getItemDetails(itemId) {
  // 1. Obtiene los metadatos base de tu servidor de video
  const res = await fetch(`https://mi-fuente-de-video.com{itemId}`);
  const mediaItem = await res.json();

  // 2. Busca las notas correspondientes en OMDb
  const scores = await fetchExternalRatings(mediaItem.title, mediaItem.release_year);

  // 3. Modifica la descripción para mostrar las puntuaciones arriba del texto base
  let enhancedDescription = mediaItem.summary || "";
  if (scores) {
    enhancedDescription = `⭐ IMDb: ${scores.imdb}/10 | 🍅 Rotten Tomatoes: ${scores.rt}\n\n${enhancedDescription}`;
  }

  return {
    id: mediaItem.id,
    title: mediaItem.title,
    description: enhancedDescription,
    year: parseInt(mediaItem.release_year) || 0,
    background: mediaItem.backdrop_url,
    poster: mediaItem.poster_url,
    seasons: null 
  };
}

// Resuelve el streaming directo hacia el reproductor nativo de Kino
export async function resolveStream(itemId) {
  const res = await fetch(`https://mi-fuente-de-video.com{itemId}`);
  const streamData = await res.json();

  return {
    url: streamData.url,
    headers: {
      "User-Agent": "KinoPlayer/1.0"
    }
  };
}
