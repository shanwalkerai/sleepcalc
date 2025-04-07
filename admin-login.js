import { supabase } from './src/supabaseClient.js'; // Ensure correct path

      // --- DOM Elements ---
      const loginForm = document.getElementById('admin-login-form');
      const emailInput = document.getElementById('email');
      const passwordInput = document.getElementById('password');
      const loginButton = document.getElementById('login-button');
      const statusMessage = document.getElementById('login-status');
      const themeToggle = document.getElementById('theme-toggle');

      // --- Theme Handling ---
      function applyInitialTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
          document.body.classList.add('dark-mode');
          document.body.classList.remove('light-mode');
          if (themeToggle) themeToggle.textContent = '☀️';
        } else {
          document.body.classList.add('light-mode');
          document.body.classList.remove('dark-mode');
          if (themeToggle) themeToggle.textContent = '🌙';
        }
      }

      function toggleTheme() {
        document.body.classList.toggle('dark-mode');
        document.body.classList.toggle('light-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        if (themeToggle) themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
      }

      // --- Status Message ---
      function showStatus(message, type = 'info') {
          if (!statusMessage) return;
          statusMessage.textContent = message;
          statusMessage.className = type; // 'success' or 'error'
          statusMessage.style.display = 'block';
      }

      function hideStatus() {
          if (statusMessage) statusMessage.style.display = 'none';
      }

      // --- Login Logic ---
      async function handleLogin(event) {
          event.preventDefault();
          hideStatus();
          if (loginButton) loginButton.disabled = true;
          showStatus('Logging in...', 'info');

          const email = emailInput.value;
          const password = passwordInput.value;

          if (!email || !password) {
              showStatus('Please enter both email and password.', 'error');
              if (loginButton) loginButton.disabled = false;
              return;
          }

          try {
              // 1. Attempt to sign in
              const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                  email: email,
                  password: password,
              });

              if (signInError) {
                  console.error('Login error:', signInError);
                  showStatus(signInError.message || 'Invalid login credentials.', 'error');
                  if (loginButton) loginButton.disabled = false;
                  return;
              }

              if (signInData.user) {
                  console.log('Login successful for user:', signInData.user.email);

                  // 2. Check if the user has an admin profile
                  const { data: profileData, error: profileError } = await supabase
                      .from('admin_profiles')
                      .select('id') // Select only necessary field
                      .eq('id', signInData.user.id)
                      .maybeSingle(); // Use maybeSingle to handle null if no profile exists

                  if (profileError) {
                      console.error('Error checking admin profile:', profileError);
                      showStatus('Login successful, but could not verify admin status.', 'error');
                      // Log the user out as a safety measure? Or let them stay logged in but without access?
                      // await supabase.auth.signOut();
                      if (loginButton) loginButton.disabled = false;
                      return;
                  }

                  // 3. Verify if profile exists
                  if (profileData) {
                      console.log('Admin profile found. Redirecting...');
                      showStatus('Login successful! Redirecting...', 'success');
                      // Redirect to the main admin panel
                      window.location.href = '/admin.html';
                  } else {
                      console.warn('User logged in but no admin profile found.');
                      showStatus('Login successful, but you do not have admin privileges.', 'error');
                      // Log the user out as they are not an admin
                      await supabase.auth.signOut();
                      console.log('User signed out.');
                      if (loginButton) loginButton.disabled = false;
                  }

              } else {
                   // Should not happen if signInError is null, but good to check
                   console.error('Login successful but no user data returned.');
                   showStatus('An unexpected error occurred during login.', 'error');
                   if (loginButton) loginButton.disabled = false;
              }

          } catch (error) {
              console.error('Unexpected error during login process:', error);
              showStatus('An unexpected error occurred. Please try again.', 'error');
              if (loginButton) loginButton.disabled = false;
          }
      }

      // --- Initialization ---
      function init() {
          applyInitialTheme();
          if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
          if (loginForm) loginForm.addEventListener('submit', handleLogin);
          else console.error("Login form not found!");

          // Check if already logged in and is admin, redirect immediately
          supabase.auth.getUser().then(async ({ data: { user } }) => {
              if (user) {
                  console.log("User already logged in:", user.email);
                  const { data: profileData, error } = await supabase
                      .from('admin_profiles')
                      .select('id')
                      .eq('id', user.id)
                      .maybeSingle();

                  if (profileData && !error) {
                      console.log("Admin profile found for logged-in user. Redirecting to admin panel.");
                      window.location.href = '/admin.html';
                  } else {
                       console.log("Logged-in user does not have an admin profile.");
                       // Optionally sign them out if they land here while logged in but not admin
                       // await supabase.auth.signOut();
                  }
              } else {
                 console.log("No user logged in.");
              }
          }).catch(error => {
              console.error("Error checking initial user state:", error);
          });
      }

      // Run init
      if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', init);
      } else {
          init();
      }
