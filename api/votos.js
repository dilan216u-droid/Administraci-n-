module.exports = async function handler(req, res) {
  // Configuración de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { usuario_discord, opcion_marcada, tipo_eleccion } = req.body;
  
  if (!usuario_discord || !opcion_marcada) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (usuario o rol).' });
  }

  const OWNER = process.env.GITHUB_USER;
  const REPO = process.env.GITHUB_REPO;
  const TOKEN = process.env.GITHUB_TOKEN;
  const FILE_PATH = 'votos.json';

  if (!OWNER || !REPO || !TOKEN) {
    console.error("❌ ERROR: Faltan variables de entorno en Vercel (GITHUB_USER, GITHUB_REPO o GITHUB_TOKEN)");
    return res.status(500).json({ error: 'Las variables de entorno de GitHub no están configuradas.' });
  }

  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
    
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
      console.error(`❌ Error al conectar con GitHub. Status: ${resGet.status}`);
      return res.status(500).json({ error: `Error de conexión con GitHub API (${resGet.status}).` });
    }

    // IP obtenida de manera 100% segura para evitar caídas (500)
    const ip_votante = req.headers['x-forwarded-for']?.split(',')[0].trim() 
                       || req.headers['x-real-ip'] 
                       || req.connection?.remoteAddress 
                       || req.socket?.remoteAddress 
                       || 'IP_DESCONOCIDA';

    // Verificar duplicados por IP
    const yaVoto = votosActuales.some(voto => 
      voto.ip_votante === ip_votante && ip_votante !== 'IP_DESCONOCIDA'
    );

    if (yaVoto) {
      return res.status(403).json({ 
        error: 'Acceso denegado', 
        mensaje: 'Ya se ha registrado un voto o postulación desde tu conexión de internet (IP).' 
      });
    }

    const nuevoVoto = {
      id: votosActuales.length + 1,
      usuario_discord,
      opcion_marcada,
      tipo_eleccion: tipo_eleccion || "Postulacion_Staff",
      ip_votante,
      fecha_registro: new Date().toISOString()
    };

    votosActuales.push(nuevoVoto);

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
        message: `🗳️ Nuevo registro de voto: ${usuario_discord}`,
        content: nuevoContenidoBase64,
        sha: sha
      })
    });

    if (!resPut.ok) {
      const errorText = await resPut.text();
      console.error("❌ GitHub PUT falló:", errorText);
      return res.status(500).json({ error: 'No se pudo guardar el registro en GitHub.' });
    }

    return res.status(200).json({ OK: true });

  } catch (error) {
    console.error("❌ Error grave en la API de votos:", error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor.' });
  }
};
        
