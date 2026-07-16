import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json());

// API: Créer un utilisateur via le serveur (rôle administrateur requis)
app.post('/api/admin/users', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Non autorisé' });
    return;
  }

  const supabaseUrl = process.env['SUPABASE_URL'] || 'https://jwpigzkxkbszxzngfepn.supabase.co';
  const supabaseServiceRole = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseServiceRole) {
    res.status(500).json({ error: 'La configuration du serveur est incomplète (SUPABASE_SERVICE_ROLE_KEY manquant).' });
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Verify the admin making the request
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user || user.user_metadata?.['role'] !== 'admin') {
    res.status(403).json({ error: 'Privilèges administrateur requis.' });
    return;
  }

  const { email, password, displayName, role } = req.body;

  // Create the new user using the admin API
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      role: role || 'user',
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
    }
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ success: true, user: data.user });
});

// API: Récupérer toutes les opérations (rôle administrateur requis)
app.get('/api/admin/operations', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Non autorisé' });
    return;
  }

  const supabaseUrl = process.env['SUPABASE_URL'] || 'https://jwpigzkxkbszxzngfepn.supabase.co';
  const supabaseServiceRole = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseServiceRole) {
    res.status(500).json({ error: 'La configuration du serveur est incomplète (SUPABASE_SERVICE_ROLE_KEY manquant).' });
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Verify the admin making the request
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user || user.user_metadata?.['role'] !== 'admin') {
    res.status(403).json({ error: 'Privilèges administrateur requis.' });
    return;
  }

  // Fetch all operations with admin privileges
  const { data, error } = await supabaseAdmin
    .from('operations')
    .select('*, operation_items(*)')
    .order('date', { ascending: false });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ success: true, operations: data });
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next()
    )
    .catch(next);
});

/**
 * Start the server if this file is run directly.
 */
if (process.env['NODE_ENV'] === 'production') {
  const port = process.env['PORT'] || 3000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * The request handler used by the Angular CLI (for dev server)
 */
export const reqHandler = createNodeRequestHandler(app);
