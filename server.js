import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js'; // Import Supabase client

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Environment Variables & Supabase Client ---
let supabaseUrl, supabaseAnonKey;
try {
    const envData = await fs.readFile(path.join(__dirname, '.env'), 'utf-8');
    const envLines = envData.split('\n');
    envLines.forEach(line => {
        if (line.startsWith('VITE_SUPABASE_URL=')) {
            supabaseUrl = line.split('=')[1].trim();
        } else if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
            supabaseAnonKey = line.split('=')[1].trim();
        }
    });
} catch (err) {
    console.warn("Could not read .env file for server. Ensure it exists.", err.message);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Server-side Supabase URL or Anon Key is missing. Exiting.");
  process.exit(1); // Exit if Supabase keys aren't available server-side
}

// Initialize Supabase client for server-side operations (like generating blog index)
const supabase = createClient(supabaseUrl, supabaseAnonKey);


const app = express();
const port = process.env.PORT || 3000;
const CONFIG_PATH = path.join(__dirname, 'config.json');
const INCLUDES_DIR = path.join(__dirname, 'includes');
const BLOG_DIR = path.join(__dirname, 'blog');
const BLOG_MANIFEST_PATH = path.join(BLOG_DIR, 'manifest.json'); // Path for blog index data

// Middleware to parse JSON bodies
app.use(express.json());

// --- Helper Functions ---

async function readConfigFile() {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return {};
        console.error('Error reading config file:', error);
        throw error;
    }
}

// Function to create an excerpt (basic)
function createExcerpt(content, wordLimit = 30) {
    if (!content) return '';
    const textContent = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const words = textContent.split(' ');
    if (words.length <= wordLimit) return textContent;
    return words.slice(0, wordLimit).join(' ') + '...';
}

// --- Blog Manifest Helpers ---
async function readBlogManifest() {
    try {
        await fs.access(BLOG_MANIFEST_PATH); // Check if file exists
        const data = await fs.readFile(BLOG_MANIFEST_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Blog manifest not found, returning empty object.');
            return {}; // Return empty object if file doesn't exist
        }
        console.error('Error reading blog manifest:', error);
        return {}; // Return empty on other errors too, to be safe
    }
}

async function writeBlogManifest(manifestData) {
    try {
        await fs.mkdir(BLOG_DIR, { recursive: true }); // Ensure directory exists
        await fs.writeFile(BLOG_MANIFEST_PATH, JSON.stringify(manifestData, null, 2), 'utf-8');
        console.log("Blog manifest updated.");
    } catch (error) {
        console.error('Error writing blog manifest:', error);
    }
}

// --- HTML Generation Helpers ---

function generateHeaderHtml(menuItems = []) {
    const linksHtml = menuItems
        .sort((a, b) => a.order - b.order)
        .map(item => `<li><a href="${item.url}">${item.title}</a></li>`)
        .join('\n          ');
    return `
<div class="header-top">
  <h1>Sleep Calculator</h1>
  <button id="theme-toggle" aria-label="Toggle light/dark mode">🌙</button>
</div>
<nav class="main-nav">
  <ul>
    <li><a href="/">Home</a></li>
    ${linksHtml}
    <li><a href="/blog.html">Blog</a></li>
  </ul>
</nav>
    `.trim();
}

function generateFooterHtml(footerLinks = [], copyrightText = '') {
    const linksHtml = footerLinks
        .sort((a, b) => a.order - b.order)
        .map(item => `<a href="${item.url}">${item.title}</a>`)
        .join(' | ');

    const currentYear = new Date().getFullYear();
    return `
<p>&copy; <span id="current-year">${currentYear}</span> ${copyrightText || 'Sleep Calculator. All rights reserved.'}</p>
<nav class="footer-links">
    ${linksHtml}
</nav>
<a href="/admin-login.html" class="admin-login-button">Admin Login</a>
    `.trim();
}

// Updated template using client-side includes
function generateBlogPostHtml(post) {
    const publishedDate = post.created_at ? new Date(post.created_at).toLocaleDateString() : 'N/A';
    const metaTitle = post.meta_title || post.title;
    const metaDescription = post.meta_description || createExcerpt(post.content, 50) || 'Read this blog post.';
    const keywords = (post.keywords || []).join(', ');

    // Use placeholders for client-side includes
    return `
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${metaTitle}</title>
    <meta name="description" content="${metaDescription}">
    <meta name="keywords" content="${keywords}">
    <link rel="stylesheet" href="/style.css">
    <style>
        .blog-post-content img { max-width: 100%; height: auto; margin: 1rem 0; border-radius: var(--border-radius); }
        .blog-post-meta { font-size: 0.9rem; color: #666; margin-bottom: 1.5rem; }
        body.dark-mode .blog-post-meta { color: #ccc; }
        .blog-post-content { padding: 1.5rem; } /* Add padding to content area */
        @media (min-width: 768px) { .blog-post-content { padding: 2rem; } }
    </style>
</head>
<body class="light-mode">
    <div id="app">
        <header id="main-header">
            <!-- Header will be loaded by JS -->
            <div class="loading-indicator">Loading header...</div>
        </header>

        <main class="container mt-4 mb-5">
            <article class="blog-post-content card">
                <h1>${post.title}</h1>
                <div class="blog-post-meta">
                    Published on: ${publishedDate}
                </div>
                ${post.image_url ? `<img src="${post.image_url}" alt="${post.title}" class="img-fluid rounded mb-3">` : ''}
                <div>
                    ${post.content || '<p>No content available.</p>'}
                </div>
            </article>
            <div class="mt-4 text-center">
                <a href="/blog.html" class="admin-button secondary">← Back to Blog List</a>
            </div>
        </main>

        <footer id="main-footer">
            <!-- Footer will be loaded by JS -->
             <div class="loading-indicator">Loading footer...</div>
        </footer>
    </div>
    <script>
        // Basic theme handling + year (copied from static pages)
        const themeToggle = document.getElementById('theme-toggle'); // Will be loaded into header
        const currentYearSpan = document.getElementById('current-year'); // Will be loaded into footer

        function applyStaticTheme() {
            const savedTheme = localStorage.getItem('theme');
            const isDark = savedTheme === 'dark';
            document.body.classList.toggle('dark-mode', isDark);
            document.body.classList.toggle('light-mode', !isDark);
            // Update toggle button text after header loads
        }
        function toggleStaticTheme() {
            document.body.classList.toggle('dark-mode');
            document.body.classList.toggle('light-mode');
            const isDarkMode = document.body.classList.contains('dark-mode');
            if (document.getElementById('theme-toggle')) { // Check if loaded
                 document.getElementById('theme-toggle').textContent = isDarkMode ? '☀️' : '🌙';
            }
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        }

        // Function to load includes
        async function loadIncludes() {
            try {
                const headerRes = await fetch('/includes/header.html');
                const headerEl = document.getElementById('main-header');
                if (headerRes.ok && headerEl) {
                    headerEl.innerHTML = await headerRes.text();
                    // Re-select theme toggle after header load
                    const loadedThemeToggle = document.getElementById('theme-toggle');
                    if (loadedThemeToggle) {
                        loadedThemeToggle.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
                        loadedThemeToggle.addEventListener('click', toggleStaticTheme);
                    }
                     // Set active nav link after header load
                     setActiveNavLink();
                } else if(headerEl) {
                     headerEl.innerHTML = '<p class="error-indicator">Error loading header.</p>';
                }

                const footerRes = await fetch('/includes/footer.html');
                 const footerEl = document.getElementById('main-footer');
                if (footerRes.ok && footerEl) {
                    footerEl.innerHTML = await footerRes.text();
                     const loadedYearSpan = document.getElementById('current-year');
                     if(loadedYearSpan) loadedYearSpan.textContent = new Date().getFullYear();
                } else if (footerEl) {
                     footerEl.innerHTML = '<p class="error-indicator">Error loading footer.</p>';
                }
            } catch (err) {
                console.error("Error loading includes:", err);
                 const headerEl = document.getElementById('main-header');
                 const footerEl = document.getElementById('main-footer');
                 if(headerEl) headerEl.innerHTML = '<p class="error-indicator">Error loading header.</p>';
                 if(footerEl) footerEl.innerHTML = '<p class="error-indicator">Error loading footer.</p>';
            }
        }

         // Set Active Nav Link Function
         function setActiveNavLink() {
            const currentPath = window.location.pathname;
            const navLinks = document.querySelectorAll('#main-header .main-nav a'); // Scope to header
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === currentPath || (currentPath.startsWith('/blog/') && link.getAttribute('href') === '/blog.html')) {
                    link.classList.add('active');
                }
            });
             if (!currentPath.startsWith('/blog/') && currentPath !== '/') {
                 const homeLink = document.querySelector('#main-header .main-nav a[href="/"]');
                 if (homeLink) homeLink.classList.remove('active');
             }
        }


        applyStaticTheme(); // Apply theme immediately
        loadIncludes(); // Load header/footer after DOM is ready
    </script>
</body>
</html>
    `.trim();
}

// Generates blog.html based on the manifest
async function generateBlogIndexHtml() {
    const manifest = await readBlogManifest();
    const posts = Object.values(manifest).sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending
    let postsHtml = '';

    if (posts.length === 0) {
        postsHtml = '<div class="col-12"><p class="text-center">No blog posts published yet.</p></div>';
    } else {
        postsHtml = posts.map(post => {
            const articleLink = `/blog/${post.slug}.html`;
            const imageUrl = post.image_url || 'https://via.placeholder.com/400x200.png?text=No+Image';
            const excerpt = post.excerpt || 'Click to read more...';
            const publishedDate = post.date ? new Date(post.date).toLocaleDateString() : 'N/A';

            return `
            <div class="col">
                <div class="card h-100 shadow-sm blog-card">
                     <img src="${imageUrl}" class="card-img-top blog-card-img" alt="${post.title || 'Blog post image'}">
                    <div class="card-body">
                        <h5 class="card-title">
                            <a href="${articleLink}" class="text-decoration-none stretched-link">${post.title || 'Untitled Post'}</a>
                        </h5>
                        <p class="card-text text-muted">${excerpt}</p>
                        <a href="${articleLink}" class="btn btn-sm btn-outline-primary mt-auto align-self-start">Read More</a>
                    </div>
                     <div class="card-footer text-muted" style="font-size: 0.85rem;">
                        Published: ${publishedDate}
                    </div>
                </div>
            </div>
            `;
        }).join('\n');
    }

    // Use placeholders for client-side includes
    const blogIndexContent = `
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Blog | Sleep Calculator</title>
    <meta name="description" content="Read latest blog articles about sleep, cycles, REM, and healthy habits.">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="/style.css">
    <style>
        .blog-card-img { height: 200px; object-fit: cover; } /* Renamed class */
        .card-body { display: flex; flex-direction: column; }
        .card-text { flex-grow: 1; margin-bottom: 1rem; }
        #app { display: flex; flex-direction: column; min-height: 100vh; }
        main { flex-grow: 1; }
    </style>
</head>
<body class="light-mode">
    <div id="app">
        <header id="main-header">
             <!-- Header will be loaded by JS -->
             <div class="loading-indicator">Loading header...</div>
        </header>

        <main class="container mt-4 mb-5">
            <h1 class="mb-4">Our Blog</h1>
            <p>Latest articles about sleep health, cycles, and tips.</p>
            <div id="blog-posts-grid" class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
                ${postsHtml}
            </div>
        </main>

        <footer id="main-footer">
             <!-- Footer will be loaded by JS -->
              <div class="loading-indicator">Loading footer...</div>
        </footer>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
     <script>
        // Basic theme handling + year (copied from static pages)
        const themeToggle = document.getElementById('theme-toggle'); // Will be loaded into header
        const currentYearSpan = document.getElementById('current-year'); // Will be loaded into footer

        function applyStaticTheme() {
            const savedTheme = localStorage.getItem('theme');
            const isDark = savedTheme === 'dark';
            document.body.classList.toggle('dark-mode', isDark);
            document.body.classList.toggle('light-mode', !isDark);
             // Update toggle button text after header loads
        }
        function toggleStaticTheme() {
            document.body.classList.toggle('dark-mode');
            document.body.classList.toggle('light-mode');
            const isDarkMode = document.body.classList.contains('dark-mode');
             if (document.getElementById('theme-toggle')) { // Check if loaded
                 document.getElementById('theme-toggle').textContent = isDarkMode ? '☀️' : '🌙';
            }
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        }

        // Function to load includes
        async function loadIncludes() {
            try {
                const headerRes = await fetch('/includes/header.html');
                const headerEl = document.getElementById('main-header');
                if (headerRes.ok && headerEl) {
                    headerEl.innerHTML = await headerRes.text();
                    // Re-select theme toggle after header load
                    const loadedThemeToggle = document.getElementById('theme-toggle');
                    if (loadedThemeToggle) {
                        loadedThemeToggle.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
                        loadedThemeToggle.addEventListener('click', toggleStaticTheme);
                    }
                     // Set active nav link after header load
                     setActiveNavLink();
                } else if(headerEl) {
                     headerEl.innerHTML = '<p class="error-indicator">Error loading header.</p>';
                }

                const footerRes = await fetch('/includes/footer.html');
                 const footerEl = document.getElementById('main-footer');
                if (footerRes.ok && footerEl) {
                    footerEl.innerHTML = await footerRes.text();
                     const loadedYearSpan = document.getElementById('current-year');
                     if(loadedYearSpan) loadedYearSpan.textContent = new Date().getFullYear();
                } else if (footerEl) {
                     footerEl.innerHTML = '<p class="error-indicator">Error loading footer.</p>';
                }
            } catch (err) {
                console.error("Error loading includes:", err);
                 const headerEl = document.getElementById('main-header');
                 const footerEl = document.getElementById('main-footer');
                 if(headerEl) headerEl.innerHTML = '<p class="error-indicator">Error loading header.</p>';
                 if(footerEl) footerEl.innerHTML = '<p class="error-indicator">Error loading footer.</p>';
            }
        }

         // Set Active Nav Link Function
         function setActiveNavLink() {
            const currentPath = window.location.pathname;
            const navLinks = document.querySelectorAll('#main-header .main-nav a'); // Scope to header
            navLinks.forEach(link => {
                link.classList.remove('active');
                // Highlight 'Blog' link if on blog index or a blog post page
                if (link.getAttribute('href') === currentPath || (currentPath === '/blog.html' && link.getAttribute('href') === '/blog.html')) {
                    link.classList.add('active');
                }
            });
             if (currentPath !== '/blog.html' && currentPath !== '/') {
                 const homeLink = document.querySelector('#main-header .main-nav a[href="/"]');
                 if (homeLink) homeLink.classList.remove('active');
             }
        }

        applyStaticTheme(); // Apply theme immediately
        loadIncludes(); // Load header/footer after DOM is ready
    </script>
</body>
</html>
    `.trim();

    try {
        await fs.writeFile(path.join(__dirname, 'blog.html'), blogIndexContent, 'utf-8');
        console.log("Generated blog.html");
    } catch (error) {
        console.error("Error writing blog.html:", error);
    }
}


// --- API Endpoints ---

// GET /api/config - Retrieve current configuration
app.get('/api/config', async (req, res) => {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    if (error.code === 'ENOENT') return res.json({});
    console.error('Error reading config file:', error);
    res.status(500).json({ message: 'Error reading configuration' });
  }
});

// POST /api/config - Update configuration
app.post('/api/config', async (req, res) => {
  try {
    const newConfig = req.body;
    if (typeof newConfig !== 'object' || newConfig === null) {
      return res.status(400).json({ message: 'Invalid configuration format.' });
    }
    await fs.writeFile(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');
    // Trigger regeneration of files dependent on config
    await Promise.all([
        triggerFooterGeneration(), // Regenerate footer if config changes
        // triggerHomepageGeneration() // Add if homepage depends on config
    ]);
    res.json({ message: 'Configuration updated successfully' });
  } catch (error) {
    console.error('Error writing config file:', error);
    res.status(500).json({ message: 'Error updating configuration' });
  }
});

// --- Generation API Endpoints ---

// Trigger Header Generation
async function triggerHeaderGeneration() {
    try {
        const { data: menuItems, error } = await supabase
            .from('site_menu')
            .select('title, url, order')
            .order('order', { ascending: true });
        if (error) throw error;
        const headerHtml = generateHeaderHtml(menuItems);
        await fs.mkdir(INCLUDES_DIR, { recursive: true });
        await fs.writeFile(path.join(INCLUDES_DIR, 'header.html'), headerHtml, 'utf-8');
        console.log("Generated includes/header.html");
        return { success: true };
    } catch (error) {
        console.error("Error generating header:", error);
        return { success: false, message: error.message };
    }
}
app.post('/api/generate-header', async (req, res) => {
    const result = await triggerHeaderGeneration();
    res.status(result.success ? 200 : 500).json(result);
});

// Trigger Footer Generation
async function triggerFooterGeneration() {
    try {
        const { data: footerLinks, error: linksError } = await supabase
            .from('site_footer')
            .select('title, url, order')
            .order('order', { ascending: true });
        if (linksError) throw linksError;

        const config = await readConfigFile();
        const copyrightText = config?.footer?.copyrightText || '';

        const footerHtml = generateFooterHtml(footerLinks, copyrightText);
         await fs.mkdir(INCLUDES_DIR, { recursive: true });
        await fs.writeFile(path.join(INCLUDES_DIR, 'footer.html'), footerHtml, 'utf-8');
        console.log("Generated includes/footer.html");
        return { success: true };
    } catch (error) {
        console.error("Error generating footer:", error);
        return { success: false, message: error.message };
    }
}
app.post('/api/generate-footer', async (req, res) => {
    const result = await triggerFooterGeneration();
    res.status(result.success ? 200 : 500).json(result);
});

// Trigger Blog Post Generation/Update
app.post('/api/generate-blog-post', async (req, res) => {
    const postData = req.body;
    if (!postData || !postData.slug || postData.status !== 'published') {
        return res.status(400).json({ message: 'Invalid data or post not published.' });
    }
    try {
        // 1. Generate HTML file
        const blogPostHtml = generateBlogPostHtml(postData);
        const filePath = path.join(BLOG_DIR, `${postData.slug}.html`);
        await fs.mkdir(BLOG_DIR, { recursive: true });
        await fs.writeFile(filePath, blogPostHtml, 'utf-8');
        console.log(`Generated/Updated blog/${postData.slug}.html`);

        // 2. Update Manifest
        const manifest = await readBlogManifest();
        manifest[postData.slug] = {
            slug: postData.slug,
            title: postData.title,
            excerpt: createExcerpt(postData.content),
            image_url: postData.image_url || null,
            date: postData.created_at || new Date().toISOString(), // Use created_at or current date
        };
        await writeBlogManifest(manifest);

        // 3. Regenerate Index
        await generateBlogIndexHtml();

        res.json({ success: true, message: 'Blog post file and manifest updated.' });
    } catch (error) {
        console.error("Error generating blog post file:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Trigger Blog Post File Deletion
app.post('/api/delete-blog-post-file', async (req, res) => {
    const { slug } = req.body;
    if (!slug) {
        return res.status(400).json({ message: 'Slug is required.' });
    }
    try {
        // 1. Delete HTML file
        const filePath = path.join(BLOG_DIR, `${slug}.html`);
        try {
            await fs.unlink(filePath);
            console.log(`Deleted blog/${slug}.html`);
        } catch (unlinkError) {
            if (unlinkError.code === 'ENOENT') {
                console.log(`File blog/${slug}.html not found, likely already deleted.`);
            } else {
                throw unlinkError; // Re-throw other unlink errors
            }
        }

        // 2. Update Manifest
        const manifest = await readBlogManifest();
        if (manifest[slug]) {
            delete manifest[slug];
            await writeBlogManifest(manifest);
        } else {
            console.log(`Slug ${slug} not found in manifest.`);
        }

        // 3. Regenerate Index
        await generateBlogIndexHtml();

        res.json({ success: true, message: 'Blog post file deleted and manifest updated.' });
    } catch (error) {
        console.error("Error deleting blog post file:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- Specific Page Routes (Define BEFORE generic static middleware) ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/blog.html', (req, res) => res.sendFile(path.join(__dirname, 'blog.html'))); // Serve generated index
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/admin-login.html', (req, res) => res.sendFile(path.join(__dirname, 'admin-login.html')));
app.get('/about.html', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/contact.html', (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));
app.get('/privacy.html', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/terms.html', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
// Add other specific HTML page routes here if needed

// --- Static File Serving (Define AFTER specific routes) ---
app.use(express.static(path.join(__dirname, 'public'))); // Serve /public directory first
app.use('/includes', express.static(path.join(__dirname, 'includes'))); // Serve /includes
app.use('/blog', express.static(path.join(__dirname, 'blog'))); // Serve generated blog posts from /blog
app.use(express.static(__dirname)); // Serve root files (like style.css, main.js) LAST

// --- Catch-all for 404 (Define LAST) ---
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '404.html')); // Optional: Serve a 404 page
});


// --- Start Server ---
app.listen(port, async () => {
  console.log(`Server listening at http://localhost:${port}`);
  console.log(`Admin panel potentially available at http://localhost:${port}/admin.html`);

  // Initial generation on server start
  console.log("Performing initial static file generation...");
  await fs.mkdir(INCLUDES_DIR, { recursive: true });
  await fs.mkdir(BLOG_DIR, { recursive: true });

  // Ensure manifest exists
  try {
      await fs.access(BLOG_MANIFEST_PATH);
  } catch (error) {
      if (error.code === 'ENOENT') {
          console.log("Creating initial empty blog manifest.");
          await writeBlogManifest({});
      }
  }

  await triggerHeaderGeneration();
  await triggerFooterGeneration();
  await generateBlogIndexHtml(); // Generate blog index on start
  console.log("Initial generation complete.");
});
