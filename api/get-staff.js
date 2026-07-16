module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const OWNER = process.env.GITHUB_USER;
  const REPO = process.env.GITHUB_REPO;
  const TOKEN = process.env.GITHUB_TOKEN;
  const FILE_PATH = 'votos.json';

  if (!OWNER || !REPO || !TOKEN) {
    return res.status(500).json({ error: 'Faltan variables de entorno en Vercel.' });
  }

  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
    
    const response = await fetch(url, {
      headers: { 
        'Authorization': `token ${TOKEN}`, 
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Vercel-App'
      }
    });

    if (response.status === 404) {
      // Si el archivo aún no existe en GitHub, devolvemos un array vacío de manera limpia
      return res.status(200).json([]);
    }

    if (!response.ok) {
      return res.status(500).json({ error: 'Error al obtener datos de GitHub.' });
    }

    const data = await response.json();
    const contenidoTexto = Buffer.from(data.content, 'base64').toString('utf-8');
    const votos = JSON.parse(contenidoTexto || '[]');

    return res.status(200).json(votos);

  } catch (error) {
    console.error("❌ Error en api/get-staff:", error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
