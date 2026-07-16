module.exports = async function handler(req, res) {
  // Solo permitir lecturas GET
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const OWNER = process.env.GITHUB_USER;
  const REPO = process.env.GITHUB_REPO;
  const TOKEN = process.env.GITHUB_TOKEN;
  const FILE_PATH = 'staff.json';

  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
    
    const resGet = await fetch(url, {
      headers: { 
        'Authorization': `token ${TOKEN}`, 
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Vercel-App'
      }
    });

    if (resGet.status === 200) {
      const dataGet = await resGet.json();
      const contenidoTexto = Buffer.from(dataGet.content, 'base64').toString('utf-8');
      const staffActuales = JSON.parse(contenidoTexto || '[]');
      
      // Devolver los datos de las postulaciones de manera exitosa
      return res.status(200).json(staffActuales);
    } else if (resGet.status === 404) {
      // Si el archivo no existe aún, devolvemos un arreglo vacío
      return res.status(200).json([]);
    } else {
      return res.status(500).json({ error: `Error leyendo datos de GitHub (Status ${resGet.status}).` });
    }

  } catch (error) {
    console.error("❌ Error leyendo postulaciones de Staff:", error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

