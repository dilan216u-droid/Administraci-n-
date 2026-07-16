module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { usuario_discord, opcion_marcada, tipo_eleccion, region, ubicacion } = req.body;
  
  if (!usuario_discord || !opcion_marcada) {
    return res.status(400).json({ error: 'Campos obligatorios faltantes (usuario o opción).' });
  }

  const OWNER = process.env.GITHUB_USER;
  const REPO = process.env.GITHUB_REPO;
  const TOKEN = process.env.GITHUB_TOKEN;
  const FILE_PATH = 'votos.json'; // Archivo centralizado de votos

  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
    
    // 1. Intentar obtener el archivo votos.json existente
    const resGet = await fetch(url, {
      headers: { 
        'Authorization': `token ${TOKEN}`, 
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Vercel-App'
      }
    });

    let sha = null;
    let votosActuales = [];

    if (resGet.status === 200) {
      const dataGet = await resGet.json();
      sha = dataGet.sha;
      const contenidoTexto = Buffer.from(dataGet.content, 'base64').toString('utf-8');
      votosActuales = JSON.parse(contenidoTexto || '[]');
    } else if (resGet.status !== 404) {
      return res.status(500).json({ error: `Error al conectar con GitHub (Status ${resGet.status}).` });
    }

    // 2. Capturar IP y verificar duplicados
    const ip_votante = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'IP_DESCONOCIDA';

    const yaVoto = votosActuales.some(voto => 
      voto.ip_votante === ip_votante && ip_votante !== 'IP_DESCONOCIDA'
    );

    if (yaVoto) {
      return res.status(403).json({ 
        error: 'Acceso denegado', 
        mensaje: 'Ya se ha registrado un voto/postulación desde esta dirección IP.' 
      });
    }

    // 3. Estructurar el nuevo voto
    const nuevoVoto = {
      id: votosActuales.length + 1,
      usuario_discord,
      opcion_marcada,
      tipo_eleccion: tipo_eleccion || "Staff_Apply",
      region: region || "No especificada",
      ubicacion: ubicacion || "General",
      ip_votante,
      fecha_registro: new Date().toISOString()
    };

    votosActuales.push(nuevoVoto);

    // 4. Guardar los cambios actualizados en GitHub
    const nuevoContenidoBase64 = Buffer.from(JSON.stringify(votosActuales, null, 2)).toString('base64');

    const resPut = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Vercel-App'
      },
      body: JSON.stringify({
        message: `🗳️ Nuevo voto registrado: ${usuario_discord}`,
        content: nuevoContenidoBase64,
        sha: sha
      })
    });

    if (!resPut.ok) {
      return res.status(500).json({ error: 'No se pudo escribir el voto en la base de datos.' });
    }

    return res.status(200).json({ OK: true });

  } catch (error) {
    console.error("❌ Error en el guardado de votos:", error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
        
