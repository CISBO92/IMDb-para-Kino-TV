/**
 * Adaptación de Sincronizador de Metadatos IMDb para Kino TV
 * Autor: CISBO92 - Código Estable de Producción
 */

let omdbKey = "";

export async function init(settings) {
  omdbKey = settings.omdb_api_key || "";
}

export async function getHomeRows() {
  return [
    { id: "scifi_classics", title: "Ciencia Ficción Clásica" },
    { id: "noir_films", title: "Cine Negro y Policial" }
  ];
}

export async function getHomeRowItems(rowId, page = 1) {
  let searchQuery = "collection:(scifi) AND mediatype:(movies)";
  if (rowId === "noir_films") {
    searchQuery = "collection:(film_noir) AND mediatype:(movies)";
  }

  const archiveUrl = `https://archive.org{encodeURIComponent(searchQuery)}&fl=identifier,title,year&rows=10&page=${page}&output=json`;
  
  try {
    const res = await fetch(archiveUrl);
    const data = await res.json();
    const docs = data.response.docs || [];

    return {
      items: docs.map(doc => ({
        id: doc.identifier,
        title: doc.title,
        poster: `https://archive.org{doc.identifier}`,
        type: "movie"
      })),
      hasMore: docs.length === 10
    };
  } catch (err) {
    console.error("Error cargando el catálogo:", err);
    return { items: [], hasMore: false };
  }
}

async function fetchExternalRatings(title, year = "") {
  if (!omdbKey) return null;

  try {
    const cleanTitle = title.replace(/\([^)]*\)/g, "").trim();
    const url = `https://omdbapi.com{encodeURIComponent(cleanTitle)}&y=${year}&apikey=${omdbKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.Response === "False") return null;

    let imdbRating = data.imdbRating || "N/A";
    let rtRating = "N/A";

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

export async function getItemDetails(itemId) {
  const metadataUrl = `https://archive.org{itemId}`;
  const res = await fetch(metadataUrl);
  const data = await res.json();
  const info = data.metadata;

  const title = info.title || "Película Clásica";
  const year = info.year || "";
  const description = info.description || "Sin descripción disponible.";

  const scores = await fetchExternalRatings(title, year);

  let enhancedDescription = description;
  if (scores) {
    enhancedDescription = `⭐ IMDb: ${scores.imdb}/10 | 🍅 Rotten Tomatoes: ${scores.rt}\n\n${enhancedDescription}`;
  }

  return {
    id: itemId,
    title: title,
    description: enhancedDescription,
    year: parseInt(year) || 0,
    background: `https://archive.org{itemId}`,
    poster: `https://archive.org{itemId}`,
    seasons: null 
  };
}

export async function resolveStream(itemId) {
  const metadataUrl = `https://archive.org{itemId}`;
  const res = await fetch(metadataUrl);
  const data = await res.json();
  
  const videoFile = data.files.find(f => f.name.endsWith(".mp4") || f.name.endsWith(".h264"));
  
  if (!videoFile) {
    throw new Error("Formato de video no compatible en esta ficha.");
  }

  const directStreamUrl = `https://archive.org{itemId}/${videoFile.name}`;

  return {
    url: directStreamUrl,
    headers: {
      "User-Agent": "KinoPlayer/1.0"
    }
  };
}
