module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  // 1. Desestructurar los datos enviados desde staff.html
  const { usuario_discord, opcion_marcada, tipo_eleccion, region, ubicacion } = req.body;
  
  if (!usuario_discord || !opcion_marcada) {
    return res.status(400).json({ error: 'Faltan campos obligatorios en el formulario.' });
  }

  const OWNER = process.env.GITHUB_USER;
  const REPO = process.env.GITHUB_REPO;
  const TOKEN = process.env.GITHUB_TOKEN;
  const FILE_PATH = 'staff.json'; // Nombre del nuevo archivo

  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
    
    // Intentar leer el archivo staff.json actual
    const resGet = await fetch(url, {
      headers: { 
        'Authorization': `token ${TOKEN}`, 
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Vercel-App'
      }
    });

    let sha = null;
    let staffActuales = [];

    if (resGet.status === 200) {
      const dataGet = await resGet.json();
      sha = dataGet.sha;
      const contenidoTexto = Buffer.from(dataGet.content, 'base64').toString('utf-8');
      staffActuales = JSON.parse(contenidoTexto || '[]');
    } else if (resGet.status !== 404) {
      return res.status(500).json({ error: `Error de conexión con GitHub (Status ${resGet.status}).` });
    }

    // 2. Capturar IP y verificar duplicados
    const ip_votante = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'IP_DESCONOCIDA';

    const yaPostulo = staffActuales.some(postulacion => 
      postulacion.ip_votante === ip_votante && ip_votante !== 'IP_DESCONOCIDA'
    );

    if (yaPostulo) {
      return res.status(403).json({ 
        error: 'Acceso denegado', 
        mensaje: 'Ya existe una postulación registrada desde esta dirección IP.' 
      });
    }

    // 3. Crear nuevo registro de Staff
    const nuevoRegistro = {
      id: staffActuales.length + 1,
      usuario_discord,
      rol_solicitado: opcion_marcada, // El rol que eligió
      pais: region,                   // El país que puso en el select
      ip_votante,
      fecha_postulacion: new Date().toISOString()
    };

    staffActuales.push(nuevoRegistro);

    // 4. Guardar cambios en GitHub
    const nuevoContenidoBase64 = Buffer.from(JSON.stringify(staffActuales, null, 2)).toString('base64');

    const resPut = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Vercel-App'
      },
      body: JSON.stringify({
        message: `📋 Nueva postulación de Staff: ${usuario_discord}`,
        content: nuevoContenidoBase64,
        sha: sha
      })
    });

    if (!resPut.ok) {
      return res.status(500).json({ error: `No se pudo guardar la postulación en GitHub.` });
    }

    return res.status(200).json({ OK: true });

  } catch (error) {
    console.error("❌ Error en sistema de Staff:", error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
