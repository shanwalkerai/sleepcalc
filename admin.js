import { supabase } from './src/supabaseClient.js'; // Ensure correct path
import Quill from 'quill';
import Chart from 'chart.js/auto';

// --- DOM Elements ---
const themeToggle = document.getElementById('theme-toggle');
const sidebarLinks = document.querySelectorAll('.sidebar-link');
const adminModules = document.querySelectorAll('.admin-module');
const contentArea = document.querySelector('.admin-content-area');
const statusMessageGlobal = document.getElementById('admin-status-message');
const logoutButton = document.getElementById('admin-logout-button');

// Module Specific Elements
const homeContentEditor = document.getElementById('home-content-editor'); // Container for live edit items

const menuItemsTableBody = document.querySelector('#menu-items-table tbody');
const menuItemForm = document.getElementById('menu-item-form');
const menuItemIdInput = document.getElementById('menu-item-id');
const menuItemTitleInput = document.getElementById('menu-item-title');
const menuItemUrlInput = document.getElementById('menu-item-url');
const menuItemOrderInput = document.getElementById('menu-item-order');
const cancelMenuEditBtn = document.getElementById('cancel-menu-edit');

const footerSettingsForm = document.getElementById('footer-settings-form');
const footerCopyrightInput = document.getElementById('footer-copyright');
const copyrightLoadingIndicator = document.getElementById('copyright-loading');
const footerLinksTableBody = document.querySelector('#footer-links-table tbody');
const footerLinkForm = document.getElementById('footer-link-form');
const footerLinkIdInput = document.getElementById('footer-link-id');
const footerLinkTitleInput = document.getElementById('footer-link-title');
const footerLinkUrlInput = document.getElementById('footer-link-url');
const footerLinkOrderInput = document.getElementById('footer-link-order');
const cancelFooterLinkEditBtn = document.getElementById('cancel-footer-link-edit');

const blogPostsTableBody = document.querySelector('#blog-posts-table tbody');
const blogPostFormContainer = document.getElementById('blog-post-form-container');
const blogPostForm = document.getElementById('blog-post-form');
const blogFormTitle = document.getElementById('blog-form-title');
const blogPostIdInput = document.getElementById('blog-post-id');
const blogPostTitleInput = document.getElementById('blog-post-title');
const blogPostSlugInput = document.getElementById('blog-post-slug');
const blogPostContentInput = document.getElementById('blog-post-content'); // Hidden textarea
const blogPostImageUrlInput = document.getElementById('blog-post-image-url');
const blogPostMetaTitleInput = document.getElementById('blog-post-meta-title');
const blogPostMetaDescInput = document.getElementById('blog-post-meta-description');
const blogPostKeywordsInput = document.getElementById('blog-post-keywords');
const blogPostStatusInput = document.getElementById('blog-post-status');
const addNewPostBtn = document.getElementById('add-new-post-button');
const cancelPostEditBtn = document.getElementById('cancel-post-edit');
const blogSearchInput = document.getElementById('blog-search');
const blogFilterStatus = document.getElementById('blog-filter-status');

const seoSettingsForm = document.getElementById('seo-settings-form');
const seoSiteTitleInput = document.getElementById('seo-site-title');
const seoSiteDescInput = document.getElementById('seo-site-description');
const seoTitleLoading = document.getElementById('seo-title-loading');
const seoDescLoading = document.getElementById('seo-desc-loading');

const popupsTableBody = document.querySelector('#popups-table tbody');
const popupForm = document.getElementById('popup-form');
const popupIdInput = document.getElementById('popup-id');
const popupMessageInput = document.getElementById('popup-message');
const popupStartTimeInput = document.getElementById('popup-start-time');
const popupEndTimeInput = document.getElementById('popup-end-time');
const popupIsActiveInput = document.getElementById('popup-is-active');
const cancelPopupEditBtn = document.getElementById('cancel-popup-edit');

// --- Global State ---
let currentConfig = {}; // To store site_settings
let quillInstance = null;

// --- Utility Functions ---

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Slugify function
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // separate accent from letter
    .replace(/[\u0300-\u036f]/g, '') // remove all separated accents
    .replace(/\s+/g, '-') // replace spaces with -
    .replace(/[^\w-]+/g, '') // remove all non-word chars
    .replace(/--+/g, '-') // replace multiple - with single -
    .replace(/^-+/, '') // trim - from start of text
    .replace(/-+$/, ''); // trim - from end of text
}

// Format datetime-local input/output
function formatDateTimeForInput(isoString) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        // Adjust for local timezone offset
        const timezoneOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
        const localISOTime = new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
        return localISOTime;
    } catch (e) {
        console.error("Error formatting date:", isoString, e);
        return '';
    }
}

function formatInputDateTimeForSupabase(localDateTimeString) {
    if (!localDateTimeString) return null;
    try {
        // Input is already in local time, convert it directly to ISO string with timezone
        const date = new Date(localDateTimeString);
        if (isNaN(date.getTime())) return null; // Invalid date
        return date.toISOString();
    } catch (e) {
        console.error("Error formatting input date for Supabase:", localDateTimeString, e);
        return null;
    }
}


// Function to set nested properties
function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }
    current[keys[keys.length - 1]] = value;
}

// Function to get nested properties
function getNestedValue(obj, path) {
    if (!obj || typeof path !== 'string') return undefined;
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current === null || typeof current !== 'object' || !(key in current)) {
            return undefined;
        }
        current = current[key];
    }
    return current;
}

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

// --- Status Messages ---
function showStatus(message, type = 'info', duration = 5000) {
    if (!statusMessageGlobal) return;
    statusMessageGlobal.textContent = message;
    statusMessageGlobal.className = type; // 'success', 'error', 'info'
    statusMessageGlobal.style.display = 'block';

    // Auto-hide after duration
    if (duration > 0) {
        setTimeout(() => {
            hideStatus();
        }, duration);
    }
}

function hideStatus() {
    if (statusMessageGlobal) statusMessageGlobal.style.display = 'none';
}

// --- Navigation / Module Switching ---
function showModule(targetId) {
    adminModules.forEach(module => {
        module.classList.remove('active');
        if (module.id === targetId) {
            module.classList.add('active');
        }
    });
    sidebarLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.target === targetId) {
            link.classList.add('active');
        }
    });
    if (contentArea) contentArea.scrollTop = 0;
    window.location.hash = targetId;
    loadModuleData(targetId);
}

function handleNavigation(event) {
    event.preventDefault();
    const targetLink = event.target.closest('.sidebar-link');
    if (targetLink && targetLink.dataset.target) {
        showModule(targetLink.dataset.target);
    }
}

// --- Data Loading ---
async function loadModuleData(moduleId) {
    hideStatus();
    console.log(`Loading data for module: ${moduleId}`);
    switch (moduleId) {
        case 'home-page-edit':
            await loadSiteSettings();
            populateHomePageEditor(); // Use the new function
            break;
        case 'menu-edit':
            await loadMenuItems();
            break;
        case 'footer-edit':
            await loadSiteSettings();
            populateFooterSettingsForm();
            await loadFooterLinks();
            break;
        case 'blog-articles':
            initializeQuill();
            await loadBlogPosts();
            break;
        case 'seo-manager':
             await loadSiteSettings();
             populateSeoForm();
            break;
        case 'popups':
            await loadPopups();
            break;
        case 'media-manager':
            break;
        case 'analytics':
            renderAnalyticsPlaceholderChart();
            break;
    }
}

// --- Supabase Helper Functions ---
async function fetchSiteSettings() {
    console.log("Fetching site settings...");
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            if (response.status === 404) {
                 console.log('Config file not found via API, using empty object.');
                 return {};
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Site settings fetched:", data);
        return data;
    } catch (error) {
        console.error('Error fetching site settings via API:', error);
        showStatus(`Error loading site settings: ${error.message}`, 'error');
        return {};
    }
}

async function saveSiteSettings(settings) {
    console.log("Saving site settings:", settings);
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || `HTTP error! status: ${response.status}`);
        }
        // Don't show global status for inline saves, handle locally
        // showStatus('Site settings saved successfully!', 'success');
        currentConfig = settings; // Update local cache
        return true;
    } catch (error) {
        console.error('Error saving site settings via API:', error);
        showStatus(`Error saving site settings: ${error.message}`, 'error');
        return false;
    }
}

// Generic Supabase fetch function
async function fetchSupabaseData(tableName, columns = '*', orderOptions = null, filterOptions = null) {
    try {
        let query = supabase.from(tableName).select(columns);
        if (filterOptions) {
            query = query.match(filterOptions);
        }
        if (orderOptions) {
            query = query.order(orderOptions.column, { ascending: orderOptions.ascending });
        }
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error(`Error fetching ${tableName}:`, error);
        showStatus(`Error loading data from ${tableName}: ${error.message}`, 'error');
        return [];
    }
}

// Generic Supabase upsert function
async function upsertSupabaseData(tableName, dataObject) {
    try {
        const { data, error } = await supabase
            .from(tableName)
            .upsert(dataObject, { onConflict: 'id' })
            .select(); // Select the upserted data
        if (error) throw error;
        showStatus(`${tableName.replace('_', ' ')} saved successfully!`, 'success');
        return data && data[0]; // Return the first (and likely only) record upserted
    } catch (error) {
        console.error(`Error saving ${tableName}:`, error);
        showStatus(`Error saving ${tableName.replace('_', ' ')}: ${error.message}`, 'error');
        return null;
    }
}

// Generic Supabase delete function
async function deleteSupabaseData(tableName, id) {
    try {
        const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('id', id);
        if (error) throw error;
        showStatus(`${tableName.replace('_', ' ')} deleted successfully!`, 'success');
        return true;
    } catch (error) {
        console.error(`Error deleting ${tableName} with id ${id}:`, error);
        showStatus(`Error deleting ${tableName.replace('_', ' ')}: ${error.message}`, 'error');
        return false;
    }
}

// --- API Call Helper for Static Generation ---
async function triggerStaticGeneration(endpoint, body) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || `HTTP error! status: ${response.status}`);
        }
        console.log(`Static generation triggered successfully via ${endpoint}:`, result.message);
        return true;
    } catch (error) {
        console.error(`Error triggering static generation via ${endpoint}:`, error);
        showStatus(`Error updating static file: ${error.message}`, 'error', 0); // Show error persistently
        return false;
    }
}


// --- Module Implementations ---

// --- Home Page Edit (Live Edit Version) ---
async function loadSiteSettings() {
    currentConfig = await fetchSiteSettings();
}

function populateHomePageEditor() {
    if (!homeContentEditor) return;
    homeContentEditor.innerHTML = ''; // Clear previous content/loading
    const loadingIndicator = homeContentEditor.querySelector('.loading-indicator');
    if(loadingIndicator) loadingIndicator.style.display = 'none';

    // Define fields to be editable
    const homePageFields = [
        { key: 'siteTitle', label: 'Site Title', type: 'text' },
        { key: 'description', label: 'Meta Description', type: 'textarea' },
        { key: 'sleepCycleCalculator.title', label: 'Sleep Calc Title', type: 'text' },
        { key: 'sleepCycleCalculator.description', label: 'Sleep Calc Desc', type: 'textarea' },
        { key: 'remCalculator.title', label: 'REM Calc Title', type: 'text' },
        { key: 'aiFeatures.title', label: 'AI Features Title', type: 'text' },
        // Add other text/textarea fields from config.json here
        // Note: Checkboxes are not suitable for this inline edit approach
    ];

    homePageFields.forEach(field => {
        const value = getNestedValue(currentConfig, field.key) ?? '';
        const itemDiv = document.createElement('div');
        itemDiv.className = 'editable-item';
        itemDiv.dataset.configKey = field.key;
        itemDiv.dataset.fieldType = field.type; // Store field type (text/textarea)

        itemDiv.innerHTML = `
            <span class="item-label">${field.label}</span>
            <div class="item-value">
                <span class="display-value">${value || '<i>empty</i>'}</span>
                <!-- Input field will be inserted here -->
            </div>
            <div class="item-actions">
                <button class="admin-button secondary small edit-inline-btn">Edit</button>
                <button class="admin-button small save-inline-btn">Save</button>
                <button class="admin-button secondary small cancel-inline-btn">Cancel</button>
            </div>
        `;
        homeContentEditor.appendChild(itemDiv);
    });
}

function handleHomeEditClick(event) {
    const target = event.target;
    const editableItem = target.closest('.editable-item');
    if (!editableItem) return;

    const configKey = editableItem.dataset.configKey;
    const fieldType = editableItem.dataset.fieldType || 'text'; // Default to text
    const valueContainer = editableItem.querySelector('.item-value');
    const displaySpan = valueContainer.querySelector('.display-value');
    const actionsContainer = editableItem.querySelector('.item-actions');

    if (target.classList.contains('edit-inline-btn')) {
        // --- Start Editing ---
        const currentValue = getNestedValue(currentConfig, configKey) ?? '';
        displaySpan.style.display = 'none'; // Hide display span

        // Create input/textarea
        let inputElement;
        if (fieldType === 'textarea') {
            inputElement = document.createElement('textarea');
            inputElement.rows = 3; // Adjust as needed
        } else {
            inputElement = document.createElement('input');
            inputElement.type = 'text';
        }
        inputElement.className = 'inline-input';
        inputElement.value = currentValue;
        inputElement.dataset.originalValue = currentValue; // Store original value for cancel

        // Remove any existing input first
        const existingInput = valueContainer.querySelector('.inline-input');
        if (existingInput) existingInput.remove();

        valueContainer.appendChild(inputElement);
        inputElement.focus();
        inputElement.select();

        editableItem.classList.add('editing'); // Toggle visibility of buttons via CSS

    } else if (target.classList.contains('cancel-inline-btn')) {
        // --- Cancel Editing ---
        const inputElement = valueContainer.querySelector('.inline-input');
        displaySpan.textContent = inputElement.dataset.originalValue || '<i>empty</i>'; // Restore original value
        displaySpan.style.display = 'inline-block'; // Show display span
        inputElement.remove(); // Remove input field
        editableItem.classList.remove('editing'); // Toggle button visibility

    } else if (target.classList.contains('save-inline-btn')) {
        // --- Save Editing ---
        const inputElement = valueContainer.querySelector('.inline-input');
        const newValue = inputElement.value;

        // Update local state and display immediately
        displaySpan.textContent = newValue || '<i>empty</i>';
        displaySpan.style.display = 'inline-block';
        setNestedValue(currentConfig, configKey, newValue); // Update global config object
        inputElement.remove();
        editableItem.classList.remove('editing');

        // Save the entire config object to the backend
        showStatus('Saving...', 'info', 2000); // Brief saving indicator
        saveSiteSettings(currentConfig)
            .then(success => {
                if (success) {
                    showStatus('Saved!', 'success', 1500);
                } else {
                    // Error handled in saveSiteSettings, maybe revert UI?
                    showStatus('Save failed.', 'error');
                    // Revert UI to original value if save failed?
                    displaySpan.textContent = inputElement.dataset.originalValue || '<i>empty</i>';
                    setNestedValue(currentConfig, configKey, inputElement.dataset.originalValue);
                }
            });
    }
}


// --- Menu Edit ---
async function loadMenuItems() {
    if (!menuItemsTableBody) return;
    menuItemsTableBody.innerHTML = `<tr><td colspan="4" class="loading-indicator">Loading menu items...</td></tr>`;
    // Fetch items ordered by the 'order' column
    const menuItems = await fetchSupabaseData('site_menu', '*', { column: 'order', ascending: true });
    renderMenuItems(menuItems);
}

function renderMenuItems(items) {
     if (!menuItemsTableBody) return;
     menuItemsTableBody.innerHTML = ''; // Clear loading/previous items
     if (items.length === 0) {
         menuItemsTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 1rem;">No menu items found. Add one below.</td></tr>`;
         return;
     }
     items.forEach(item => {
         const row = menuItemsTableBody.insertRow();
         // Display order, title, url, and action buttons
         row.innerHTML = `
             <td>${item.order}</td>
             <td>${item.title}</td>
             <td>${item.url}</td>
             <td class="actions">
                 <button class="admin-button secondary edit-menu-item" data-id="${item.id}">Edit</button>
                 <button class="admin-button danger delete-menu-item" data-id="${item.id}">Delete</button>
             </td>
         `;
         // Add event listeners for the new buttons
         row.querySelector('.edit-menu-item').addEventListener('click', handleEditMenuItem);
         row.querySelector('.delete-menu-item').addEventListener('click', handleDeleteMenuItem);
     });
}

// Populates the form when 'Edit' is clicked
function handleEditMenuItem(event) {
    const button = event.target;
    const id = button.dataset.id;
    const row = button.closest('tr');
    // Get data from the table row cells
    const order = row.cells[0].textContent;
    const title = row.cells[1].textContent;
    const url = row.cells[2].textContent;

    // Populate the form fields
    menuItemIdInput.value = id;
    menuItemTitleInput.value = title;
    menuItemUrlInput.value = url;
    menuItemOrderInput.value = order;
    cancelMenuEditBtn.style.display = 'inline-block'; // Show cancel button
    menuItemTitleInput.focus(); // Focus the first field
}

// Clears the form and hides the cancel button
function resetMenuItemForm() {
    menuItemForm.reset(); // Reset form fields to default
    menuItemIdInput.value = ''; // Clear the hidden ID field
    cancelMenuEditBtn.style.display = 'none'; // Hide cancel button
}

// Handles saving both new and existing menu items
async function handleSaveMenuItem(event) {
    event.preventDefault();
    showStatus('Saving menu item...', 'info', 0); // Show saving message

    const menuItemData = {
        id: menuItemIdInput.value || undefined, // If ID exists, it's an update; otherwise, it's an insert
        title: menuItemTitleInput.value.trim(),
        url: menuItemUrlInput.value.trim(),
        order: parseInt(menuItemOrderInput.value, 10) || 0, // Get order value, default to 0
    };

    // Basic validation
    if (!menuItemData.title || !menuItemData.url) {
        showStatus('Title and URL are required.', 'error');
        return;
    }

    // Use upsert to handle both insert and update
    const saved = await upsertSupabaseData('site_menu', menuItemData);

    if (saved) {
        resetMenuItemForm(); // Clear the form on success
        await loadMenuItems(); // Reload the list to show changes (including new order)
        // Trigger header regeneration
        await triggerStaticGeneration('/api/generate-header', {});
    } else {
         hideStatus(); // Hide 'saving...' message if error occurred
    }
}

// Handles deleting a menu item
async function handleDeleteMenuItem(event) {
    const id = event.target.dataset.id;
    if (!id) return;

    // Confirm before deleting
    if (confirm('Are you sure you want to delete this menu item?')) {
        showStatus('Deleting menu item...', 'info', 0);
        const deleted = await deleteSupabaseData('site_menu', id);
        if (deleted) {
            await loadMenuItems(); // Reload the list after deletion
            // Trigger header regeneration
            await triggerStaticGeneration('/api/generate-header', {});
        } else {
             hideStatus(); // Hide 'deleting...' message if error occurred
        }
    }
}

// --- Footer Edit ---
function populateFooterSettingsForm() {
    if (!footerCopyrightInput || !copyrightLoadingIndicator) return;
    const copyrightText = getNestedValue(currentConfig, 'footer.copyrightText') ?? '';
    footerCopyrightInput.value = copyrightText;
    copyrightLoadingIndicator.style.display = 'none';
}

async function handleSaveFooterSettings(event) {
    event.preventDefault();
    showStatus('Saving footer text...', 'info', 0);
    const updatedConfig = JSON.parse(JSON.stringify(currentConfig));
    setNestedValue(updatedConfig, 'footer.copyrightText', footerCopyrightInput.value);
    const saved = await saveSiteSettings(updatedConfig);
    if (saved) {
        // Trigger footer regeneration
        await triggerStaticGeneration('/api/generate-footer', {});
    }
    // Re-populate in case save failed and reverted
    populateFooterSettingsForm();
}

async function loadFooterLinks() {
    if (!footerLinksTableBody) return;
    footerLinksTableBody.innerHTML = `<tr><td colspan="4" class="loading-indicator">Loading footer links...</td></tr>`;
    const footerLinks = await fetchSupabaseData('site_footer', '*', { column: 'order', ascending: true });
    renderFooterLinks(footerLinks);
}

function renderFooterLinks(links) {
     if (!footerLinksTableBody) return;
     footerLinksTableBody.innerHTML = '';
     if (links.length === 0) {
         footerLinksTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 1rem;">No footer links found. Add one below.</td></tr>`;
         return;
     }
     links.forEach(link => {
         const row = footerLinksTableBody.insertRow();
         row.innerHTML = `
             <td>${link.order}</td>
             <td>${link.title}</td>
             <td>${link.url}</td>
             <td class="actions">
                 <button class="admin-button secondary edit-footer-link" data-id="${link.id}">Edit</button>
                 <button class="admin-button danger delete-footer-link" data-id="${link.id}">Delete</button>
             </td>
         `;
         row.querySelector('.edit-footer-link').addEventListener('click', handleEditFooterLink);
         row.querySelector('.delete-footer-link').addEventListener('click', handleDeleteFooterLink);
     });
}

function handleEditFooterLink(event) {
    const button = event.target;
    const id = button.dataset.id;
    const row = button.closest('tr');
    const order = row.cells[0].textContent;
    const title = row.cells[1].textContent;
    const url = row.cells[2].textContent;

    footerLinkIdInput.value = id;
    footerLinkTitleInput.value = title;
    footerLinkUrlInput.value = url;
    footerLinkOrderInput.value = order;
    cancelFooterLinkEditBtn.style.display = 'inline-block';
    footerLinkTitleInput.focus();
}

function resetFooterLinkForm() {
    footerLinkForm.reset();
    footerLinkIdInput.value = '';
    cancelFooterLinkEditBtn.style.display = 'none';
}

async function handleSaveFooterLink(event) {
    event.preventDefault();
    showStatus('Saving footer link...', 'info', 0);

    const footerLinkData = {
        id: footerLinkIdInput.value || undefined,
        title: footerLinkTitleInput.value.trim(),
        url: footerLinkUrlInput.value.trim(),
        order: parseInt(footerLinkOrderInput.value, 10) || 0,
    };

     if (!footerLinkData.title || !footerLinkData.url) {
        showStatus('Title and URL are required.', 'error');
        return;
    }

    const saved = await upsertSupabaseData('site_footer', footerLinkData);
    if (saved) {
        resetFooterLinkForm();
        await loadFooterLinks();
        // Trigger footer regeneration
        await triggerStaticGeneration('/api/generate-footer', {});
    } else {
         hideStatus();
    }
}

async function handleDeleteFooterLink(event) {
    const id = event.target.dataset.id;
    if (!id) return;

    if (confirm('Are you sure you want to delete this footer link?')) {
        showStatus('Deleting footer link...', 'info', 0);
        const deleted = await deleteSupabaseData('site_footer', id);
        if (deleted) {
            await loadFooterLinks();
            // Trigger footer regeneration
            await triggerStaticGeneration('/api/generate-footer', {});
        } else {
             hideStatus();
        }
    }
}


// --- Blog Articles ---
function initializeQuill() {
    if (quillInstance || !document.getElementById('quill-editor')) return;

    quillInstance = new Quill('#quill-editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link', 'image', 'blockquote', 'code-block'],
                [{ 'align': [] }],
                ['clean']
            ]
        }
    });

    quillInstance.on('text-change', () => {
        if (blogPostContentInput) {
            blogPostContentInput.value = quillInstance.root.innerHTML;
        }
    });
     console.log("Quill initialized");
}

function showBlogPostForm(post = null) {
    blogPostForm.reset();
    blogPostIdInput.value = '';
    if (quillInstance) quillInstance.root.innerHTML = '';
    blogPostContentInput.value = '';

    if (post) {
        blogFormTitle.textContent = 'Edit Post';
        blogPostIdInput.value = post.id;
        blogPostTitleInput.value = post.title;
        blogPostSlugInput.value = post.slug;
        if (quillInstance) quillInstance.root.innerHTML = post.content || '';
        blogPostContentInput.value = post.content || '';
        blogPostImageUrlInput.value = post.image_url || '';
        blogPostMetaTitleInput.value = post.meta_title || '';
        blogPostMetaDescInput.value = post.meta_description || '';
        blogPostKeywordsInput.value = (post.keywords || []).join(', ');
        blogPostStatusInput.value = post.status || 'draft';
    } else {
        blogFormTitle.textContent = 'Add New Post';
        blogPostSlugInput.value = '';
    }
    blogPostFormContainer.style.display = 'block';
    blogPostTitleInput.focus();
}

function hideBlogPostForm() {
    blogPostFormContainer.style.display = 'none';
    blogPostForm.reset();
    blogPostIdInput.value = '';
     if (quillInstance) quillInstance.root.innerHTML = '';
     blogPostContentInput.value = '';
}

async function loadBlogPosts(searchTerm = '', statusFilter = '') {
    if (!blogPostsTableBody) return;
    blogPostsTableBody.innerHTML = `<tr><td colspan="5" class="loading-indicator">Loading blog posts...</td></tr>`;

    try {
        let query = supabase.from('blog_posts').select('id, title, slug, status, updated_at');
        if (statusFilter) query = query.eq('status', statusFilter);
        if (searchTerm) query = query.ilike('title', `%${searchTerm}%`);
        query = query.order('updated_at', { ascending: false });
        const { data: posts, error } = await query;
        if (error) throw error;
        renderBlogPosts(posts || []);
    } catch (error) {
        console.error('Error fetching blog posts:', error);
        showStatus(`Error loading blog posts: ${error.message}`, 'error');
        blogPostsTableBody.innerHTML = `<tr><td colspan="5" class="error-indicator">Error loading posts.</td></tr>`;
    }
}

function renderBlogPosts(posts) {
     if (!blogPostsTableBody) return;
     blogPostsTableBody.innerHTML = '';
     if (posts.length === 0) {
         blogPostsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1rem;">No blog posts found matching criteria.</td></tr>`;
         return;
     }
     posts.forEach(post => {
         const row = blogPostsTableBody.insertRow();
         const updatedDate = post.updated_at ? new Date(post.updated_at).toLocaleDateString() : 'N/A';
         row.innerHTML = `
             <td>${post.title}</td>
             <td>${post.slug}</td>
             <td><span class="status-${post.status}">${post.status}</span></td>
             <td>${updatedDate}</td>
             <td class="actions">
                 <button class="admin-button secondary edit-blog-post" data-id="${post.id}">Edit</button>
                 <button class="admin-button danger delete-blog-post" data-id="${post.id}" data-slug="${post.slug}">Delete</button> <!-- Add data-slug -->
             </td>
         `;
          row.querySelector('.edit-blog-post').addEventListener('click', async (e) => {
             const id = e.target.dataset.id;
             showStatus('Loading post data...', 'info', 0);
             const { data: postData, error } = await supabase.from('blog_posts').select('*').eq('id', id).single();
             hideStatus();
             if (error) {
                 showStatus(`Error loading post: ${error.message}`, 'error');
             } else if (postData) {
                 showBlogPostForm(postData);
             }
         });
         row.querySelector('.delete-blog-post').addEventListener('click', handleDeleteBlogPost);
     });
}

async function handleSaveBlogPost(event) {
    event.preventDefault();
    showStatus('Saving blog post...', 'info', 0);

    if (quillInstance && blogPostContentInput) {
        blogPostContentInput.value = quillInstance.root.innerHTML;
    }

    const keywordsArray = blogPostKeywordsInput.value
        .split(',')
        .map(k => k.trim())
        .filter(k => k);

    const postData = {
        id: blogPostIdInput.value || undefined,
        title: blogPostTitleInput.value.trim(),
        slug: blogPostSlugInput.value.trim() || slugify(blogPostTitleInput.value.trim()),
        content: blogPostContentInput.value,
        image_url: blogPostImageUrlInput.value.trim() || null,
        meta_title: blogPostMetaTitleInput.value.trim() || null,
        meta_description: blogPostMetaDescInput.value.trim() || null,
        keywords: keywordsArray.length > 0 ? keywordsArray : null,
        status: blogPostStatusInput.value,
        // Include created_at only if it's a new post (id is undefined)
        // Supabase handles created_at on insert, updated_at on update via trigger
    };

     if (!postData.title) {
        showStatus('Post title is required.', 'error'); return;
    }
     if (!postData.slug) {
        showStatus('Post slug is required.', 'error'); return;
    }
     if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(postData.slug)) {
         showStatus('Slug contains invalid characters.', 'error');
         blogPostSlugInput.focus(); return;
     }

    // Save to Supabase first
    const savedPost = await upsertSupabaseData('blog_posts', postData);

    if (savedPost) {
        // If save successful, trigger static file generation/deletion
        if (savedPost.status === 'published') {
            showStatus('Post saved. Generating static file...', 'info', 0);
            await triggerStaticGeneration('/api/generate-blog-post', savedPost);
        } else {
            // If status is draft or anything else, ensure static file is deleted
            showStatus('Post saved as draft. Removing static file if exists...', 'info', 0);
            await triggerStaticGeneration('/api/delete-blog-post-file', { slug: savedPost.slug });
        }
        hideBlogPostForm();
        await loadBlogPosts(blogSearchInput.value, blogFilterStatus.value);
    } else {
         hideStatus(); // Hide 'saving...' message if Supabase save failed
    }
}

async function handleDeleteBlogPost(event) {
    const id = event.target.dataset.id;
    const slug = event.target.dataset.slug; // Get slug from button
    if (!id || !slug) return;

    if (confirm('Are you sure you want to delete this blog post? This will also remove the published file.')) {
        showStatus('Deleting blog post...', 'info', 0);
        // Delete from Supabase first
        const deleted = await deleteSupabaseData('blog_posts', id);

        if (deleted) {
            // If Supabase delete successful, delete the static file
            showStatus('Post deleted from database. Removing static file...', 'info', 0);
            await triggerStaticGeneration('/api/delete-blog-post-file', { slug: slug });
            await loadBlogPosts(blogSearchInput.value, blogFilterStatus.value);
        } else {
             hideStatus(); // Hide 'deleting...' message if Supabase delete failed
        }
    }
}

const debouncedSearch = debounce(() => {
    loadBlogPosts(blogSearchInput.value, blogFilterStatus.value);
}, 300);


// --- SEO Manager ---
function populateSeoForm() {
    if (!seoSiteTitleInput || !seoSiteDescInput || !seoTitleLoading || !seoDescLoading) return;
    seoSiteTitleInput.value = getNestedValue(currentConfig, 'siteTitle') ?? '';
    seoSiteDescInput.value = getNestedValue(currentConfig, 'description') ?? '';
    seoTitleLoading.style.display = 'none';
    seoDescLoading.style.display = 'none';
}

async function handleSaveSeoSettings(event) {
    event.preventDefault();
    showStatus('Saving SEO defaults...', 'info', 0);
    const updatedConfig = JSON.parse(JSON.stringify(currentConfig));
    setNestedValue(updatedConfig, 'siteTitle', seoSiteTitleInput.value);
    setNestedValue(updatedConfig, 'description', seoSiteDescInput.value);
    await saveSiteSettings(updatedConfig);
    // Re-populate in case save failed and reverted
    populateSeoForm();
}

// --- Popups ---
async function loadPopups() {
    if (!popupsTableBody) return;
    popupsTableBody.innerHTML = `<tr><td colspan="5" class="loading-indicator">Loading popups...</td></tr>`;
    const popups = await fetchSupabaseData('popups', '*', { column: 'created_at', ascending: false });
    renderPopups(popups);
}

function renderPopups(popups) {
    if (!popupsTableBody) return;
    popupsTableBody.innerHTML = '';
    if (popups.length === 0) {
        popupsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1rem;">No popups found. Add one below.</td></tr>`;
        return;
    }
    popups.forEach(popup => {
        const row = popupsTableBody.insertRow();
        const startTime = popup.start_time ? new Date(popup.start_time).toLocaleString() : 'N/A';
        const endTime = popup.end_time ? new Date(popup.end_time).toLocaleString() : 'N/A';
        const messagePreview = popup.message.length > 100 ? popup.message.substring(0, 100) + '...' : popup.message;

        row.innerHTML = `
            <td>${messagePreview}</td>
            <td>${startTime}</td>
            <td>${endTime}</td>
            <td>${popup.is_active ? '✅ Active' : '❌ Inactive'}</td>
            <td class="actions">
                <button class="admin-button secondary edit-popup" data-id="${popup.id}">Edit</button>
                <button class="admin-button danger delete-popup" data-id="${popup.id}">Delete</button>
            </td>
        `;
         row.querySelector('.edit-popup').addEventListener('click', handleEditPopup);
         row.querySelector('.delete-popup').addEventListener('click', handleDeletePopup);
    });
}

function handleEditPopup(event) {
    const id = event.target.dataset.id;
     showStatus('Loading popup data...', 'info', 0);
     supabase.from('popups').select('*').eq('id', id).single()
         .then(({ data: popup, error }) => {
             hideStatus();
             if (error) {
                 showStatus(`Error loading popup: ${error.message}`, 'error');
             } else if (popup) {
                 popupIdInput.value = popup.id;
                 popupMessageInput.value = popup.message;
                 popupStartTimeInput.value = formatDateTimeForInput(popup.start_time);
                 popupEndTimeInput.value = formatDateTimeForInput(popup.end_time);
                 popupIsActiveInput.checked = popup.is_active;
                 cancelPopupEditBtn.style.display = 'inline-block';
                 popupMessageInput.focus();
             }
         });
}

function resetPopupForm() {
    popupForm.reset();
    popupIdInput.value = '';
    popupIsActiveInput.checked = true;
    cancelPopupEditBtn.style.display = 'none';
}

async function handleSavePopup(event) {
    event.preventDefault();
    showStatus('Saving popup...', 'info', 0);

    const popupData = {
        id: popupIdInput.value || undefined,
        message: popupMessageInput.value.trim(),
        start_time: formatInputDateTimeForSupabase(popupStartTimeInput.value),
        end_time: formatInputDateTimeForSupabase(popupEndTimeInput.value),
        is_active: popupIsActiveInput.checked,
    };

     if (!popupData.message) {
        showStatus('Popup message is required.', 'error'); return;
    }

    const saved = await upsertSupabaseData('popups', popupData);
    if (saved) {
        resetPopupForm();
        await loadPopups();
    } else {
         hideStatus();
    }
}

async function handleDeletePopup(event) {
    const id = event.target.dataset.id;
    if (!id) return;

    if (confirm('Are you sure you want to delete this popup?')) {
        showStatus('Deleting popup...', 'info', 0);
        const deleted = await deleteSupabaseData('popups', id);
        if (deleted) {
            await loadPopups();
        } else {
             hideStatus();
        }
    }
}

// --- Analytics Placeholder ---
function renderAnalyticsPlaceholderChart() {
    const canvas = document.getElementById('analytics-placeholder-chart');
    if (!canvas || Chart.getChart(canvas)) return;

    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Placeholder Visitors',
                data: [12, 19, 3, 5, 2, 3, 9],
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: { display: true, text: 'Website Traffic (Placeholder)' }
            }
        }
    });
}


// --- Initialization ---
async function initAdmin() {
    applyInitialTheme();

    // Event Listeners
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (logoutButton) logoutButton.addEventListener('click', async () => {
        showStatus('Logging out...', 'info', 0);
        const { error } = await supabase.auth.signOut();
        if (error) {
            showStatus(`Logout failed: ${error.message}`, 'error');
        } else {
            showStatus('Logout successful!', 'success');
            window.location.href = '/admin-login.html'; // Redirect to login
        }
    });

    sidebarLinks.forEach(link => link.addEventListener('click', handleNavigation));

    // Form Submissions (excluding home page form)
    if (menuItemForm) menuItemForm.addEventListener('submit', handleSaveMenuItem);
    if (cancelMenuEditBtn) cancelMenuEditBtn.addEventListener('click', resetMenuItemForm); // Add listener for cancel button
    if (footerSettingsForm) footerSettingsForm.addEventListener('submit', handleSaveFooterSettings);
    if (footerLinkForm) footerLinkForm.addEventListener('submit', handleSaveFooterLink);
    if (cancelFooterLinkEditBtn) cancelFooterLinkEditBtn.addEventListener('click', resetFooterLinkForm);
    if (blogPostForm) blogPostForm.addEventListener('submit', handleSaveBlogPost);
    if (addNewPostBtn) addNewPostBtn.addEventListener('click', () => showBlogPostForm());
    if (cancelPostEditBtn) cancelPostEditBtn.addEventListener('click', hideBlogPostForm);
    if (blogSearchInput) blogSearchInput.addEventListener('input', debouncedSearch);
    if (blogFilterStatus) blogFilterStatus.addEventListener('change', () => loadBlogPosts(blogSearchInput.value, blogFilterStatus.value));
    if (seoSettingsForm) seoSettingsForm.addEventListener('submit', handleSaveSeoSettings);
    if (popupForm) popupForm.addEventListener('submit', handleSavePopup);
    if (cancelPopupEditBtn) cancelPopupEditBtn.addEventListener('click', resetPopupForm);

    // Home Page Live Edit Listener (delegated)
    if (homeContentEditor) homeContentEditor.addEventListener('click', handleHomeEditClick);

    // Auto-slug generation for blog posts
    if (blogPostTitleInput && blogPostSlugInput) {
        blogPostTitleInput.addEventListener('input', () => {
            // Only auto-generate if slug is empty or matches the slugified version of the title minus the last char (to allow typing)
            const currentTitleSlug = slugify(blogPostTitleInput.value);
            const currentSlug = blogPostSlugInput.value;
            if (!currentSlug || currentSlug === slugify(blogPostTitleInput.value.slice(0, -1))) {
                 blogPostSlugInput.value = currentTitleSlug;
            }
        });
         // Also update slug if title changes and slug was previously auto-generated
         blogPostTitleInput.addEventListener('change', () => { // Use change event
             const currentTitleSlug = slugify(blogPostTitleInput.value);
             // Consider updating only if the slug seems auto-generated or empty
             // This logic might need refinement based on desired UX
             if (!blogPostSlugInput.value || blogPostSlugInput.dataset.autoGenerated === 'true') {
                 blogPostSlugInput.value = currentTitleSlug;
                 blogPostSlugInput.dataset.autoGenerated = 'true';
             }
         });
         // Mark slug as manually edited if user types in it
         blogPostSlugInput.addEventListener('input', () => {
             blogPostSlugInput.dataset.autoGenerated = 'false';
         });
    }

    // Initial module load
    const initialHash = window.location.hash.substring(1);
    const validTargets = Array.from(sidebarLinks).map(link => link.dataset.target);
    const targetModule = validTargets.includes(initialHash) ? initialHash : 'home-page-edit';
    showModule(targetModule);

    console.log("Admin Dashboard Initialized");
}

// --- Run Initialization ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
} else {
    initAdmin();
}
