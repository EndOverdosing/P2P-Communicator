export default async function handler(req, res) {
    const fullPath = req.url.split('?')[0];

    if (!fullPath.includes('/storage/v1/object/public/')) {
        return res.status(400).json({ error: 'Invalid path', received: fullPath });
    }

    const supabaseUrl = `https://mfjqbejulpkuoutgeuuw.supabase.co${fullPath}`;

    try {
        const response = await fetch(supabaseUrl);
        if (!response.ok) {
            return res.status(response.status).json({
                error: 'Failed to fetch from Supabase',
                status: response.status,
                statusText: response.statusText,
                url: supabaseUrl
            });
        }

        const buffer = await response.arrayBuffer();

        const contentType = response.headers.get('content-type') || 'image/jpeg';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(Buffer.from(buffer));

    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch image',
            details: error.message,
            stack: error.stack
        });
    }
}