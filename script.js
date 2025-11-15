// --- 1. GLOBALS & INITIALIZATION (MODIFIED) ---
let notificationTimeout = null;
let currentUser = null;
let notes = [];
let todos = [];
let stopwatchTime = 0;
let stopwatchInterval = null;
let isStopwatchRunning = false;
let timerInterval = null;
let timerTimeRemaining = 0;
let editingNoteId = null; // <-- ADDED: To track which note is being edited
let isTimerPaused = false;
const pad = (num, size = 2) => ('000' + num).slice(size * -1);
let draggedWidget = null;
let calendarDate = new Date();
let todoSortOrder = 'newest'; // 'newest' or 'deadline'

const GLOBAL_THEME_KEY = 'omni-tool-global-theme';
const DEFAULT_ACCENT = '#007acc';
const DEFAULT_FONT_SIZE = '16';
const DEFAULT_ICON = '👤';
const PROFILE_ICONS = [
    '👤', '👨‍💻', '👩‍💻', '🧑‍🚀', '👾', '🧠', '🤖', '🧐', '💡', '⚡️',
    '🧭', '🎯', '🚀', '🧪', '🧬', '⚙️', '🖥️', '📚', '🔐', '🔑'
];
const USER_DATA_KEYS = ['notes', 'todos', 'layout', 'hidden', 'accent', 'fontsize'];
// MODIFIED: Added tag regex
const TAG_REGEX = /#(\w+)/g;

// --- 1.5 UTILITY FUNCTIONS ---
function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}


// --- 2. CRYPTO / HASHING LOGIC ---
function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return bufferToHex(hashBuffer);
}

// --- 3. NOTIFICATION SYSTEM ---
function showNotification(message, isError = false) {
    const bar = document.getElementById('notification-bar');
    if (notificationTimeout) clearTimeout(notificationTimeout);
    bar.textContent = message;
    bar.className = 'notification-error';
    if (isError) { bar.className = 'notification-error'; }
    else { bar.className = 'notification-success'; }
    bar.classList.add('show');
    notificationTimeout = setTimeout(() => {
        bar.classList.remove('show');
    }, 3000);
}

// --- 3.5. MODIFIED: THEME & SETTINGS LOGIC ---

function applySavedTheme() {
    const savedTheme = localStorage.getItem(GLOBAL_THEME_KEY) || 'dark';
    document.body.classList.remove('light-mode', 'dark-mode');
    document.body.classList.add(savedTheme + '-mode');
}

function setTheme(themeName) {
    document.body.classList.remove('light-mode', 'dark-mode');
    document.body.classList.add(themeName + '-mode');
    localStorage.setItem(GLOBAL_THEME_KEY, themeName);
    updateSettingsUIThemeButtons();
}

function applyUserPreferences() {
    if (!currentUser) return;
    const profiles = JSON.parse(localStorage.getItem('omni-tool-profiles') || '[]');
    const userProfile = profiles.find(p => p.username === currentUser);
    
    const accent = localStorage.getItem(`omni-tool-accent-${currentUser}`) || DEFAULT_ACCENT;
    document.documentElement.style.setProperty('--accent-primary', accent);
    
    const fontSize = localStorage.getItem(`omni-tool-fontsize-${currentUser}`) || DEFAULT_FONT_SIZE;
    document.documentElement.style.setProperty('--font-scale', fontSize + 'px');
    
    const icon = (userProfile && userProfile.icon) ? userProfile.icon : DEFAULT_ICON;
    document.getElementById('user-icon-display').textContent = icon;
}

function resetUserPreferencesOnLogout() {
     document.documentElement.style.removeProperty('--accent-primary');
     document.documentElement.style.removeProperty('--font-scale');
     document.getElementById('user-icon-display').textContent = '';
}

/**
 * Updates the Appearance tab UI
 */
function updateAppearanceUI() {
    if (!currentUser) return;
    
    // Update theme buttons
    updateSettingsUIThemeButtons();
    
    // Update username placeholders
    document.getElementById('settings-user-accent').textContent = currentUser;
    document.getElementById('settings-user-font').textContent = currentUser;

    // Update accent color picker
    const accent = localStorage.getItem(`omni-tool-accent-${currentUser}`) || DEFAULT_ACCENT;
    document.getElementById('accent-color-picker').value = accent;
    
    // Update font size slider
    const fontSize = localStorage.getItem(`omni-tool-fontsize-${currentUser}`) || DEFAULT_FONT_SIZE;
    document.getElementById('font-size-slider').value = fontSize;
    document.getElementById('font-size-label').textContent = fontSize + 'px';
}

function updateSettingsUIThemeButtons() {
    const theme = localStorage.getItem(GLOBAL_THEME_KEY) || 'dark';
    const darkBtn = document.getElementById('theme-btn-dark');
    const lightBtn = document.getElementById('theme-btn-light');
    
    if (theme === 'light') {
        lightBtn.classList.add('active');
        darkBtn.classList.remove('active');
    } else {
        darkBtn.classList.add('active');
        lightBtn.classList.remove('active');
    }
}

function setAccentColor(color) {
    if (!currentUser) return;
    document.documentElement.style.setProperty('--accent-primary', color);
    localStorage.setItem(`omni-tool-accent-${currentUser}`, color);
}

function setFontSize(size) {
    if (!currentUser) return;
    document.documentElement.style.setProperty('--font-scale', size + 'px');
    document.getElementById('font-size-label').textContent = size + 'px';
    localStorage.setItem(`omni-tool-fontsize-${currentUser}`, size);
}

function resetSettings() {
    if (!currentUser) return;
    
    localStorage.removeItem(GLOBAL_THEME_KEY);
    applySavedTheme(); // Applies default 'dark'

    localStorage.removeItem(`omni-tool-accent-${currentUser}`);
    localStorage.removeItem(`omni-tool-fontsize-${currentUser}`);
    
    document.documentElement.style.setProperty('--accent-primary', DEFAULT_ACCENT);
    document.documentElement.style.setProperty('--font-scale', DEFAULT_FONT_SIZE + 'px');

    updateAppearanceUI();
}

// --- 4. AUTH & PROFILE LOGIC (MODIFIED) ---
function showLoginScreen() {
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
    loadProfiles();
}
function showMainApp() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('user-id-display').textContent = `user@${currentUser}`;
    loadUserData();
}

async function loginUser() {
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');
    
    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!username || !password) {
        showNotification("Username and password are required", true);
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Verifying...';
    
    try {
        const profiles = JSON.parse(localStorage.getItem('omni-tool-profiles') || '[]');
        const userProfile = profiles.find(p => p.username === username);
        const newHash = await hashPassword(password);

        if (userProfile) {
            // --- LOGIN ---
            if (newHash === userProfile.hash) {
                startSession(username);
            } else {
                showNotification("Incorrect password", true);
            }
        } else {
            // --- REGISTRATION ---
            profiles.push({ 
                username: username, 
                hash: newHash, 
                icon: PROFILE_ICONS[Math.floor(Math.random() * PROFILE_ICONS.length)]
            });
            localStorage.setItem('omni-tool-profiles', JSON.stringify(profiles));
            startSession(username);
        }
    } catch (e) {
        console.error("Login error:", e);
        showNotification("An error occurred. See console.", true);
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login / Create Profile';
        passwordInput.value = '';
    }
}

function startSession(username) {
    currentUser = username;
    sessionStorage.setItem('omni-tool-currentUser', username);
    document.getElementById('username-input').value = '';
    showMainApp();
}

function logoutUser() {
    currentUser = null;
    sessionStorage.removeItem('omni-tool-currentUser');
    notes = []; todos = [];
    resetTimer();
    resetStopwatch();
    resetUserPreferencesOnLogout(); 
    showLoginScreen();
}

function loadProfiles() {
    let profiles = JSON.parse(localStorage.getItem('omni-tool-profiles') || '[]');
    let migrationNeeded = false;
    
    // --- Migration for old profiles without icons ---
    profiles.forEach(profile => {
        if (typeof profile.icon === 'undefined') {
            profile.icon = DEFAULT_ICON;
            migrationNeeded = true;
        }
    });
    
    if (migrationNeeded) {
        localStorage.setItem('omni-tool-profiles', JSON.stringify(profiles));
    }
    // --- End Migration ---

    const listDiv = document.getElementById('profile-list');
    listDiv.innerHTML = '';
    if (profiles.length === 0) {
        listDiv.innerHTML = '<p class="empty-list-message">// No profiles found</p>';
        return;
    }
    profiles.forEach(profile => {
        const btn = document.createElement('button');
        btn.className = 'profile-button';
        btn.innerHTML = `<span class="profile-icon">${profile.icon}</span>`;
        btn.append(document.createTextNode(profile.username));
        btn.onclick = () => fillUsername(profile.username);
        listDiv.appendChild(btn);
    });
}

function fillUsername(username) {
     document.getElementById('username-input').value = username;
     document.getElementById('password-input').focus();
}

function checkSession() {
    const storedUser = sessionStorage.getItem('omni-tool-currentUser');
    if (storedUser) {
        currentUser = storedUser;
        showMainApp();
    } else {
        showLoginScreen();
    }
}

async function confirmDeleteAccount() {
    if (!currentUser) return;
    
    const passwordInput = document.getElementById('delete-password-input');
    const password = passwordInput.value;
    
    if (!password) {
        showNotification("Please type your password to confirm deletion", true);
        return;
    }

    try {
        const profiles = JSON.parse(localStorage.getItem('omni-tool-profiles') || '[]');
        const userProfile = profiles.find(p => p.username === currentUser);
        
        if (!userProfile) {
            showNotification("Error: Could not find user profile.", true);
            return;
        }
        
        const enteredHash = await hashPassword(password);
        
        if (enteredHash !== userProfile.hash) {
            showNotification("Incorrect password. Account not deleted.", true);
            passwordInput.value = "";
            return;
        }
        
        if (!confirm(`FINAL WARNING: Are you sure you want to delete "${currentUser}"?\nAll notes and to-dos will be lost forever.`)) {
            passwordInput.value = "";
            return;
        }
        
        // 1. Delete user-specific data
        USER_DATA_KEYS.forEach(key => {
            localStorage.removeItem(`omni-tool-${key}-${currentUser}`);
        });
        
        // 2. Delete user from profile list
        const updatedProfiles = profiles.filter(p => p.username !== currentUser);
        localStorage.setItem('omni-tool-profiles', JSON.stringify(updatedProfiles));
        
        // 3. Log out
        showNotification(`Account "${currentUser}" has been deleted.`, false);
        logoutUser();
        
    } catch (e) {
         console.error("Delete account error:", e);
         showNotification("An error occurred while deleting the account.", true);
    }
}

function toggleUserManagementModal() {
    const modal = document.getElementById('user-management-modal');
    const backdrop = document.getElementById('modal-backdrop-auth');
    const confirmInput = document.getElementById('delete-users-confirm-input');
    const deleteBtn = document.getElementById('delete-selected-users-btn');

    const isHidden = modal.classList.toggle('hidden');
    backdrop.classList.toggle('hidden', isHidden);

    if (!isHidden) {
        confirmInput.value = '';
        deleteBtn.disabled = true;
        populateUserManagementModal();
    }
}

function populateUserManagementModal() {
    const list = document.getElementById('user-toggle-list');
    list.innerHTML = '';
    const profiles = JSON.parse(localStorage.getItem('omni-tool-profiles') || '[]');
    
    if (profiles.length === 0) {
         list.innerHTML = '<p class="empty-list-message">// No profiles found</p>';
         return;
    }

    profiles.forEach(profile => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.username = profile.username;
        label.appendChild(checkbox);
        label.innerHTML += `<span class="profile-icon" style="font-size: 1rem; margin-right: 0.25rem;">${profile.icon || DEFAULT_ICON}</span>`;
        label.appendChild(document.createTextNode(profile.username));
        list.appendChild(label);
    });
}

function deleteSelectedUsers() {
    const checkboxes = document.querySelectorAll('#user-toggle-list input[type="checkbox"]:checked');
    const usersToDelete = Array.from(checkboxes).map(cb => cb.dataset.username);

    if (usersToDelete.length === 0) {
        showNotification("No users selected to delete.", true);
        return;
    }
    
    if (!confirm(`Are you sure you want to permanently delete ${usersToDelete.length} user(s) and all their data?\n\nUsers: ${usersToDelete.join(', ')}\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        let profiles = JSON.parse(localStorage.getItem('omni-tool-profiles') || '[]');

        // 1. Delete data for each selected user
        usersToDelete.forEach(username => {
            USER_DATA_KEYS.forEach(key => {
                localStorage.removeItem(`omni-tool-${key}-${username}`);
            });
        });

        // 2. Filter the master profile list
        const updatedProfiles = profiles.filter(profile => !usersToDelete.includes(profile.username));
        localStorage.setItem('omni-tool-profiles', JSON.stringify(updatedProfiles));

        // 3. Close modal and refresh login screen
        toggleUserManagementModal();
        loadProfiles(); // Refresh the profile buttons on the login page
        showNotification(`${usersToDelete.length} user(s) have been deleted.`, false);

    } catch (e) {
        console.error("Delete selected users error:", e);
        showNotification("An error occurred while deleting users.", true);
    }
}

// --- 4.5. MODIFIED: NEW USER SETTINGS LOGIC ---

function initUserSettingsTab() {
    if (!currentUser) return;
    
    const picker = document.getElementById('icon-picker');
    picker.innerHTML = '';
    
    const profiles = JSON.parse(localStorage.getItem('omni-tool-profiles') || '[]');
    const userProfile = profiles.find(p => p.username === currentUser);
    const currentIcon = (userProfile && userProfile.icon) ? userProfile.icon : DEFAULT_ICON;
    
    PROFILE_ICONS.forEach(icon => {
        const iconEl = document.createElement('div');
        iconEl.className = 'profile-icon-option';
        if (icon === currentIcon) {
            iconEl.classList.add('selected');
        }
        iconEl.textContent = icon;
        iconEl.addEventListener('click', () => selectIcon(icon, iconEl));
        picker.appendChild(iconEl);
    });
}

function selectIcon(icon, selectedElement) {
    // Update UI
    document.querySelectorAll('.profile-icon-option').forEach(el => el.classList.remove('selected'));
    selectedElement.classList.add('selected');
    
    // Save it
    saveProfileIcon(icon);
}

function saveProfileIcon(icon) {
    if (!currentUser) return;
    
    try {
        const profiles = JSON.parse(localStorage.getItem('omni-tool-profiles') || '[]');
        const userProfile = profiles.find(p => p.username === currentUser);
        
        if (userProfile) {
            userProfile.icon = icon;
            localStorage.setItem('omni-tool-profiles', JSON.stringify(profiles));
            document.getElementById('user-icon-display').textContent = icon;
            showNotification('Profile icon updated!');
        } else {
            throw new Error("Could not find user profile to update icon.");
        }
    } catch (e) {
        console.error("Error saving icon: ", e);
        showNotification('Failed to save icon.', true);
    }
}

function changeUsername() {
    if (!currentUser) return;
    
    const newUsernameInput = document.getElementById('new-username-input');
    const newUsername = newUsernameInput.value.trim().toLowerCase();
    
    if (!newUsername) {
        showNotification("New username cannot be empty.", true);
        return;
    }
    
    if (newUsername === currentUser) {
        showNotification("This is already your username.", true);
        return;
    }
    
    try {
        const profiles = JSON.parse(localStorage.getItem('omni-tool-profiles') || '[]');
        
        // Check if new username is taken
        if (profiles.some(p => p.username === newUsername)) {
            showNotification("Username already taken.", true);
            return;
        }
        
        const userProfile = profiles.find(p => p.username === currentUser);
        if (!userProfile) {
             throw new Error("Could not find current user profile.");
        }

        // 1. Update username in profile object
        const oldUsername = currentUser;
        userProfile.username = newUsername;
        localStorage.setItem('omni-tool-profiles', JSON.stringify(profiles));

        // 2. Migrate all user data
        USER_DATA_KEYS.forEach(key => {
            const oldKey = `omni-tool-${key}-${oldUsername}`;
            const newKey = `omni-tool-${key}-${newUsername}`;
            const data = localStorage.getItem(oldKey);
            if (data) {
                localStorage.setItem(newKey, data);
                localStorage.removeItem(oldKey);
            }
        });

        // 3. Update current session
        currentUser = newUsername;
        sessionStorage.setItem('omni-tool-currentUser', newUsername);
        
        // 4. Update UI
        document.getElementById('user-id-display').textContent = `user@${newUsername}`;
        document.getElementById('dash-welcome-user').textContent = newUsername;
        updateAppearanceUI(); // Update username display in Appearance tab
        newUsernameInput.value = '';
        showNotification("Username successfully changed!");

    } catch (e) {
        console.error("Error changing username: ", e);
        showNotification('An error occurred. See console.', true);
    }
}

async function changePassword() {
    if (!currentUser) return;
    
    const oldPassInput = document.getElementById('old-password-input');
    const newPassInput = document.getElementById('new-password-input');
    const confirmPassInput = document.getElementById('confirm-password-input');

    const oldPass = oldPassInput.value;
    const newPass = newPassInput.value;
    const confirmPass = confirmPassInput.value;

    if (!oldPass || !newPass || !confirmPass) {
        showNotification("All password fields are required.", true);
        return;
    }
    
    if (newPass !== confirmPass) {
        showNotification("New passwords do not match.", true);
        return;
    }

    try {
        const profiles = JSON.parse(localStorage.getItem('omni-tool-profiles') || '[]');
        const userProfile = profiles.find(p => p.username === currentUser);

        if (!userProfile) {
             throw new Error("Could not find current user profile.");
        }

        // 1. Verify old password
        const oldHash = await hashPassword(oldPass);
        if (oldHash !== userProfile.hash) {
            showNotification("Incorrect old password.", true);
            return;
        }
        
        // 2. Save new password hash
        userProfile.hash = await hashPassword(newPass);
        localStorage.setItem('omni-tool-profiles', JSON.stringify(profiles));
        
        // 3. Clear fields and notify
        oldPassInput.value = '';
        newPassInput.value = '';
        confirmPassInput.value = '';
        showNotification("Password changed successfully!");
        
    } catch (e) {
        console.error("Error changing password: ", e);
        showNotification('An error occurred. See console.', true);
    }
}

function exportUserData() {
    if (!currentUser) return;
    
    try {
        const userData = {};
        
        // 1. Get user data (notes, todos, etc.)
        USER_DATA_KEYS.forEach(key => {
            const storageKey = `omni-tool-${key}-${currentUser}`;
            const data = localStorage.getItem(storageKey);
            if (data) {
                userData[key] = data; // Store as raw string
            }
        });
        
        // 2. Get profile data (icon)
        const profiles = JSON.parse(localStorage.getItem('omni-tool-profiles') || '[]');
        const userProfile = profiles.find(p => p.username === currentUser);
        if (userProfile) {
            userData.profile = {
                icon: userProfile.icon
            };
        }

        if (Object.keys(userData).length === 0) {
            showNotification("No data found to export.", true);
            return;
        }
        
        // 3. Create and download the file
        const dataStr = JSON.stringify(userData, null, 2);
        const dataBlob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(dataBlob);
        
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().split('T')[0];
        a.download = `ani-tool_backup_${currentUser}_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification("User data exported successfully!");

    } catch (e) {
        console.error("Error exporting data: ", e);
        showNotification("An error occurred during export.", true);
    }
}

function importUserData() {
    if (!currentUser) return;
    
    const fileInput = document.getElementById('import-file-input');
    if (fileInput.files.length === 0) {
        showNotification("Please select a backup file first.", true);
        return;
    }
    
    if (!confirm(`WARNING:\nAre you sure you want to import this file?\n\nThis will OVERWRITE all existing notes, tasks, and settings for "${currentUser}". This action cannot be undone.`)) {
        fileInput.value = ''; // Clear the file input
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            const userData = JSON.parse(e.target.result);
            
            // 1. Import all user data (notes, todos, etc.)
            let importedCount = 0;
            USER_DATA_KEYS.forEach(key => {
                if (userData[key]) {
                    const storageKey = `omni-tool-${key}-${currentUser}`;
                    localStorage.setItem(storageKey, userData[key]);
                    importedCount++;
                }
            });
            
            // 2. Import profile icon
            if (userData.profile && userData.profile.icon) {
                saveProfileIcon(userData.profile.icon); // Use existing function to save
            }
            
            if (importedCount === 0) {
                showNotification("Import file did not contain valid data.", true);
            } else {
                showNotification("Data imported successfully! Reloading...", false);
                // Force a reload to apply all settings and load new data
                setTimeout(() => {
                    location.reload();
                }, 1500);
            }
            
        } catch (err) {
            console.error("Error importing data: ", err);
            showNotification("Import failed. File may be corrupt.", true);
        } finally {
            fileInput.value = ''; // Clear the file input
        }
    };
    
    reader.readAsText(file);
}

// --- 5. DASHBOARD LOGIC ---
function updateDashboard() {
    if (!currentUser) return;
    document.getElementById('dash-welcome-user').textContent = currentUser;
    document.getElementById('dash-note-count').textContent = notes.length;
    const pending = todos.filter(t => !t.completed).length;
    const completed = todos.length - pending;
    document.getElementById('dash-todo-pending').textContent = pending;
    document.getElementById('dash-todo-completed').textContent = completed;
    const deletePassInput = document.getElementById('delete-password-input');
    if(deletePassInput) {
        deletePassInput.value = "";
    }
    // MODIFIED: Update agenda
    updateDashboardAgenda();
}

// --- MODIFIED: NEW DASHBOARD AGENDA WIDGET ---
function updateDashboardAgenda() {
    if (!currentUser) return;
    const agendaList = document.getElementById('dash-agenda-list');
    if (!agendaList) return;
    
    // Get today's date in "YYYY-MM-DD" format
    const today = new Date().toLocaleDateString('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
    
    const tasksDueToday = todos.filter(t => t.deadline === today);
    
    if (tasksDueToday.length === 0) {
        agendaList.innerHTML = '<p class="empty-list-message" style="font-size: 0.9rem;">// No tasks due today</p>';
        return;
    }
    
    agendaList.innerHTML = ''; // Clear list
    tasksDueToday.forEach(todo => {
        const item = document.createElement('li');
        item.className = 'agenda-item';
        if (todo.completed) {
            item.classList.add('completed');
        }
        const checked = todo.completed ? 'checked' : '';
        item.innerHTML = `
            <label>
                <input type="checkbox" data-id="${todo.id}" ${checked}>
                <span>${escapeHTML(todo.task)}</span>
            </label>
        `;
        agendaList.appendChild(item);
    });

    agendaList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.addEventListener('change', (e) => toggleTodoComplete(e.target.dataset.id)));
}

// --- 5.5. DASHBOARD CUSTOMIZATION LOGIC ---

function toggleCustomizeModal() {
    const modal = document.getElementById('customize-modal');
    const backdrop = document.getElementById('modal-backdrop');
    const isHidden = modal.classList.toggle('hidden');
    backdrop.classList.toggle('hidden', isHidden);
    
    if (!isHidden) {
        populateCustomizeModal();
    }
}

function populateCustomizeModal() {
    const list = document.getElementById('widget-toggle-list');
    list.innerHTML = '';
    const hiddenWidgets = JSON.parse(localStorage.getItem(`omni-tool-hidden-${currentUser}`) || '[]');
    
    document.querySelectorAll('.dashboard-grid .dashboard-widget').forEach(widget => {
        const id = widget.id;
        let title = id;
        const titleEl = widget.querySelector('.widget-title');
        if (titleEl) {
            title = titleEl.textContent;
        } else if (id === 'dash-stopwatch-widget') {
            title = 'STOPWATCH_RUNNING';
        } else if (id === 'dash-timer-widget') {
            title = 'TIMER_ACTIVE';
        }
        
        const isHidden = hiddenWidgets.includes(id);
        
        const label = document.createElement('label');
        label.innerHTML = `
            <input type="checkbox" data-widget-id="${id}" ${!isHidden ? 'checked' : ''}>
            <span>${escapeHTML(title)}</span>
        `;
        list.appendChild(label);
    });

    list.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.addEventListener('change', toggleWidgetVisibility));
}

function toggleWidgetVisibility(event) {
    const checkbox = event.target;
    const widgetId = checkbox.dataset.widgetId;
    const widget = document.getElementById(widgetId);
    if (widget) {
        widget.classList.toggle('hidden', !checkbox.checked);
    }
    saveWidgetVisibility();
}

function saveWidgetVisibility() {
    if (!currentUser) return;
    const hiddenWidgets = [];
    document.querySelectorAll('#widget-toggle-list input[type="checkbox"]').forEach(cb => {
        if (!cb.checked) {
            hiddenWidgets.push(cb.dataset.widgetId);
        }
    });
    localStorage.setItem(`omni-tool-hidden-${currentUser}`, JSON.stringify(hiddenWidgets));
}

function loadWidgetVisibility() {
    if (!currentUser) return;
    const hiddenWidgets = JSON.parse(localStorage.getItem(`omni-tool-hidden-${currentUser}`) || '[]');
    
    document.querySelectorAll('.dashboard-grid .dashboard-widget').forEach(widget => {
        if (widget.id !== 'dash-stopwatch-widget' && widget.id !== 'dash-timer-widget') {
             widget.classList.remove('hidden');
        }
    });
    
    hiddenWidgets.forEach(id => {
        const widget = document.getElementById(id);
        if (widget) {
            widget.classList.add('hidden');
        }
    });
}

function initDragAndDrop() {
    const grid = document.querySelector('.dashboard-grid');
    
    grid.addEventListener('dragstart', e => {
        if (e.target.classList.contains('dashboard-widget')) {
            draggedWidget = e.target;
            setTimeout(() => draggedWidget.classList.add('dragging'), 0);
        }
    });

    grid.addEventListener('dragend', e => {
        if (draggedWidget) {
            draggedWidget.classList.remove('dragging');
            draggedWidget = null;
            saveWidgetOrder();
        }
    });

    grid.addEventListener('dragover', e => {
        e.preventDefault();
        if (!draggedWidget) return;

        const afterElement = getDragAfterElement(grid, e.clientY);
        if (afterElement == null) {
            grid.appendChild(draggedWidget);
        } else {
            grid.insertBefore(draggedWidget, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.dashboard-widget:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function saveWidgetOrder() {
    if (!currentUser) return;
    const grid = document.querySelector('.dashboard-grid');
    const widgetIds = [...grid.children].map(widget => widget.id);
    localStorage.setItem(`omni-tool-layout-${currentUser}`, JSON.stringify(widgetIds));
}

function loadWidgetOrder() {
    if (!currentUser) return;
    const grid = document.querySelector('.dashboard-grid');
    const widgetIds = JSON.parse(localStorage.getItem(`omni-tool-layout-${currentUser}`) || 'null');
    
    if (widgetIds) {
        widgetIds.forEach(id => {
            const widget = document.getElementById(id);
            if (widget) {
                grid.appendChild(widget);
            }
        });
    }
}

// --- 6. CORE APP LOGIC (MODIFIED) ---
function loadUserData() {
    applyUserPreferences();
    
    loadDataFromStorage();
    loadWidgetOrder();
    loadWidgetVisibility();
    
    renderNotes();
    renderTodos();
    renderCalendar(); 
    
    updateAppearanceUI(); 
    initUserSettingsTab(); 
    
    const defaultTabButton = document.querySelector('.tab-button[onclick*="dashboard"]');
    if(defaultTabButton) {
        defaultTabButton.classList.add('active');
    }
}
function initApp() {
    updateClock();
    setInterval(updateClock, 1000);
    updateStopwatchDisplay();
    initDragAndDrop();
    
    renderCalendar(); 
}

function switchTab(tabId, forceSetActive = false) {
    document.querySelectorAll('.app-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    
    const tabButton = document.querySelector(`.tab-button[data-tab-id="${tabId}"]`);

    // Deactivate all tab buttons first
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    if (forceSetActive && tabButton) {
        tabButton.classList.add('active');
    }
}

// --- 7. CLOCK & STOPWATCH LOGIC ---
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
    const dateString = now.toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    document.getElementById('digital-clock').textContent = timeString;
    document.getElementById('date-display').textContent = dateString;
    if (currentUser) {
        document.getElementById('dash-time').textContent = timeString;
        document.getElementById('dash-date').textContent = dateString;
    }
}
function updateStopwatchDisplay() {
    let totalMilliseconds = stopwatchTime;
    const ms = Math.floor((totalMilliseconds % 1000) / 10);
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const timeString = `${pad(totalHours % 99)}:${pad(totalMinutes % 60)}:${pad(totalSeconds % 60)}.${pad(ms)}`;
    document.getElementById('stopwatch-milliseconds').textContent = pad(ms);
    document.getElementById('stopwatch-seconds').textContent = pad(totalSeconds % 60);
    document.getElementById('stopwatch-minutes').textContent = pad(totalMinutes % 60);
    document.getElementById('stopwatch-hours').textContent = pad(totalHours % 99);
    document.getElementById('dash-stopwatch-display').textContent = timeString;
}
function toggleStopwatch() {
    const startBtn = document.getElementById('stopwatch-start-btn');
    const dashWidget = document.getElementById('dash-stopwatch-widget');
    if (isStopwatchRunning) {
        clearInterval(stopwatchInterval); isStopwatchRunning = false;
        startBtn.textContent = 'Start';
        startBtn.classList.remove('button-yellow'); startBtn.classList.add('button-green');
        const hiddenWidgets = JSON.parse(localStorage.getItem(`omni-tool-hidden-${currentUser}`) || '[]');
        if (!hiddenWidgets.includes('dash-stopwatch-widget')) {
            dashWidget.classList.add('hidden');
        }
    } else {
        const startTime = Date.now() - stopwatchTime;
        stopwatchInterval = setInterval(() => {
            stopwatchTime = Date.now() - startTime;
            updateStopwatchDisplay();
        }, 10);
        isStopwatchRunning = true; startBtn.textContent = 'Stop';
        startBtn.classList.remove('button-green'); startBtn.classList.add('button-yellow');
        const hiddenWidgets = JSON.parse(localStorage.getItem(`omni-tool-hidden-${currentUser}`) || '[]');
        if (!hiddenWidgets.includes('dash-stopwatch-widget')) {
            dashWidget.classList.remove('hidden');
        }
    }
}
function resetStopwatch() {
    clearInterval(stopwatchInterval); stopwatchTime = 0; isStopwatchRunning = false;
    const startBtn = document.getElementById('stopwatch-start-btn');
    startBtn.textContent = 'Start';
    startBtn.classList.remove('button-yellow'); startBtn.classList.add('button-green');
    document.getElementById('dash-stopwatch-widget').classList.add('hidden');
    updateStopwatchDisplay();
}

// --- 8. TIMER LOGIC ---
function updateTimerDisplay() {
    const h = Math.floor(timerTimeRemaining / 3600);
    const m = Math.floor((timerTimeRemaining % 3600) / 60);
    const s = timerTimeRemaining % 60;
    const timeString = `${pad(h)}:${pad(m)}:${pad(s)}`;
    document.getElementById('timer-display').textContent = timeString;
    document.getElementById('dash-timer-display').textContent = timeString;
}
function tickTimer() {
    if (isTimerPaused) return;
    timerTimeRemaining--;
    updateTimerDisplay();
    if (timerTimeRemaining <= 0) {
        clearInterval(timerInterval);
        showNotification("Timer Finished!", false);
        resetTimer();
    }
}
function startTimer() {
    if (timerInterval) return;
    const h = parseInt(document.getElementById('timer-hours-input').value) || 0;
    const m = parseInt(document.getElementById('timer-minutes-input').value) || 0;
    const s = parseInt(document.getElementById('timer-seconds-input').value) || 0;
    timerTimeRemaining = (h * 3600) + (m * 60) + s;
    if (timerTimeRemaining <= 0) {
        showNotification("Please set a valid time", true);
        return;
    }
    isTimerPaused = false;
    document.getElementById('timer-input-container').classList.add('hidden');
    document.getElementById('timer-display').classList.remove('hidden');
    document.getElementById('timer-start-btn').classList.add('hidden');
    document.getElementById('timer-pause-btn').classList.remove('hidden');
    document.getElementById('timer-reset-btn').classList.remove('hidden');
    
    const hiddenWidgets = JSON.parse(localStorage.getItem(`omni-tool-hidden-${currentUser}`) || '[]');
    if (!hiddenWidgets.includes('dash-timer-widget')) {
        document.getElementById('dash-timer-widget').classList.remove('hidden');
    }

    updateTimerDisplay();
    timerInterval = setInterval(tickTimer, 1000);
}
function pauseTimer() {
    isTimerPaused = !isTimerPaused;
    const pauseBtn = document.getElementById('timer-pause-btn');
    pauseBtn.textContent = isTimerPaused ? "Resume" : "Pause";
}
function resetTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerTimeRemaining = 0;
    isTimerPaused = false;
    document.getElementById('timer-input-container').classList.remove('hidden');
    document.getElementById('timer-display').classList.add('hidden');
    document.getElementById('timer-start-btn').classList.remove('hidden');
    document.getElementById('timer-pause-btn').classList.add('hidden');
    document.getElementById('timer-reset-btn').classList.add('hidden');
    document.getElementById('timer-hours-input').value = "";
    document.getElementById('timer-minutes-input').value = "";
    document.getElementById('timer-seconds-input').value = "";
    const defaultDisplay = "00:00:00";
    document.getElementById('timer-display').textContent = defaultDisplay;
    document.getElementById('dash-timer-widget').classList.add('hidden');
    document.getElementById('dash-timer-display').textContent = defaultDisplay;
}

// --- 9. UNIT CONVERTER LOGIC ---
function convertLength(unit) {
    const metersInput = document.getElementById('meters-input');
    const feetInput = document.getElementById('feet-input');
    const METER_TO_FEET = 3.28084;
    try {
        if (unit === 'm') {
            const meters = parseFloat(metersInput.value);
            if (!isNaN(meters)) { feetInput.value = (meters * METER_TO_FEET).toFixed(4); }
            else if (metersInput.value === '') { feetInput.value = ''; }
        } else if (unit === 'ft') {
            const feet = parseFloat(feetInput.value);
            if (!isNaN(feet)) { metersInput.value = (feet / METER_TO_FEET).toFixed(4); }
            else if (feetInput.value === '') { metersInput.value = ''; }
        }
    } catch (e) { console.error("Length conversion error:", e); }
}
function convertTemp(unit) {
    const celsiusInput = document.getElementById('celsius-input');
    const fahrenheitInput = document.getElementById('fahrenheit-input');
    try {
        if (unit === 'c') {
            const c = parseFloat(celsiusInput.value);
            if (!isNaN(c)) { fahrenheitInput.value = ((c * 9/5) + 32).toFixed(2); }
            else if (celsiusInput.value === '') { fahrenheitInput.value = ''; }
        } else if (unit === 'f') {
            const f = parseFloat(fahrenheitInput.value);
            if (!isNaN(f)) { celsiusInput.value = ((f - 32) * 5/9).toFixed(2); }
            else if (fahrenheitInput.value === '') { celsiusInput.value = ''; }
        }
    } catch (e) { console.error("Temperature conversion error:", e); }
}

function convertDataStorage(unit) {
    const mbInput = document.getElementById('mb-input');
    const gbInput = document.getElementById('gb-input');
    const GB_TO_MB = 1024;

    try {
        if (unit === 'mb') {
            const mb = parseFloat(mbInput.value);
            if (!isNaN(mb)) { gbInput.value = (mb / GB_TO_MB).toFixed(6); }
            else if (mbInput.value === '') { gbInput.value = ''; }
        } else if (unit === 'gb') {
            const gb = parseFloat(gbInput.value);
            if (!isNaN(gb)) { mbInput.value = (gb * GB_TO_MB).toFixed(6); }
            else if (gbInput.value === '') { gbInput.value = ''; }
        }
    } catch (e) { console.error("Data storage conversion error:", e); }
}


function convertNumberBase(unit) {
    const decInput = document.getElementById('decimal-input');
    const hexInput = document.getElementById('hex-input');

    try {
        if (unit === 'dec') {
            const decValStr = decInput.value;
            if (decValStr === '') {
                hexInput.value = '';
                return;
            }
            if (/[^0-9]/.test(decValStr)) {
                 hexInput.value = '';
                 return;
            }
            const decVal = parseInt(decValStr, 10);
            if (!isNaN(decVal)) {
                hexInput.value = decVal.toString(16).toUpperCase();
            } else {
                hexInput.value = '';
            }
        } else if (unit === 'hex') {
            const hexVal = hexInput.value.trim().toUpperCase();
            hexInput.value = hexVal;
            
            if (hexVal === '') {
                decInput.value = '';
                return;
            }
            
            if (/[^0-9A-F]/.test(hexVal)) {
                decInput.value = '';
                return; 
            }
            
            const decVal = parseInt(hexVal, 16);
            if (!isNaN(decVal)) {
                decInput.value = decVal;
            } else {
                decInput.value = '';
            }
        }
    } catch (e) { console.error("Number base conversion error:", e); }
}
// --- 10. LOCAL STORAGE & DATA LOGIC ---
function loadDataFromStorage() {
    if (!currentUser) return;
    notes = []; todos = [];
    const storedNotes = localStorage.getItem(`omni-tool-notes-${currentUser}`);
    const storedTodos = localStorage.getItem(`omni-tool-todos-${currentUser}`);
    if (storedNotes) { notes = JSON.parse(storedNotes); }
    if (storedTodos) { todos = JSON.parse(storedTodos); }
}
function saveNotesToStorage() {
    if (!currentUser) return;
    localStorage.setItem(`omni-tool-notes-${currentUser}`, JSON.stringify(notes));
}
function saveTodosToStorage() {
    if (!currentUser) return;
    localStorage.setItem(`omni-tool-todos-${currentUser}`, JSON.stringify(todos));
}

// --- 11. NOTES APP LOGIC (MODIFIED) ---

// MODIFIED: Added search/filter text
function renderNotes(filterText = '') {
    const notesListDiv = document.getElementById('notes-list');
    notesListDiv.innerHTML = '';
    
    const normalizedFilter = filterText.toLowerCase();
    const filteredNotes = notes.filter(note => {
        return note.title.toLowerCase().includes(normalizedFilter) ||
               note.content.toLowerCase().includes(normalizedFilter);
    });

    if (filteredNotes.length === 0) {
        notesListDiv.innerHTML = `<p class="empty-list-message">// No notes found ${filterText ? 'matching search' : 'for this user'}</p>`;
        return;
    }
    
    const sortedNotes = [...filteredNotes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    sortedNotes.forEach(note => {
        // SECURITY: Create elements manually to prevent XSS from innerHTML.
        const noteElement = document.createElement('div');
        noteElement.className = 'list-item';

        const createdDate = new Date(note.createdAt).toLocaleString();
        const updatedDate = new Date(note.updatedAt).toLocaleString();

        const contentDiv = document.createElement('div');
        
        const h3 = document.createElement('h3');
        h3.textContent = note.title;
        
        const pContent = document.createElement('p');
        pContent.textContent = note.content;
        
        const pDate = document.createElement('p'); // Will hold created/updated dates
        pDate.className = 'date';
        
        // Only show "Last Modified" if it's different from the creation date
        if (note.updatedAt !== note.createdAt) {
            pDate.innerHTML = `Created: ${createdDate} <br> Last Modified: ${updatedDate}`;
        } else {
            pDate.textContent = `Created: ${createdDate}`;
        }

        contentDiv.append(h3, pContent, pDate);

        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'list-item-buttons';

        const editButton = document.createElement('button');
        editButton.className = 'edit-button';
        editButton.title = 'Edit note';
        editButton.addEventListener('click', () => populateNoteEditor(note.id));
        editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>`;

        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.title = 'Copy note content';
        copyButton.addEventListener('click', () => copyNoteContent(note.content));
        copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" /><path d="M4 3a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H4z" /></svg>`;

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.title = 'Delete note';
        deleteButton.addEventListener('click', () => deleteNote(note.id));
        deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z" clip-rule="evenodd" /></svg>`;

        buttonGroup.append(editButton, copyButton, deleteButton);
        noteElement.append(contentDiv, buttonGroup);
        notesListDiv.appendChild(noteElement);
    });
}

async function copyNoteContent(content) {
    if (!navigator.clipboard) {
        showNotification('Clipboard API not available in this browser.', true);
        return;
    }
    try {
        await navigator.clipboard.writeText(content);
        showNotification('Note content copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showNotification('Failed to copy content.', true);
    }
}

function updateNoteStats() {
    const contentInput = document.getElementById('note-content');
    const statsDisplay = document.getElementById('note-stats-display');
    if (!contentInput || !statsDisplay) return;

    const content = contentInput.value;
    const charCount = content.length;
    // Split by whitespace and filter out empty strings that result from multiple spaces
    const wordCount = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;

    statsDisplay.innerHTML = `<span>Words: ${wordCount}</span> | <span>Chars: ${charCount}</span>`;
}

function populateNoteEditor(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    document.getElementById('note-title').value = note.title;
    document.getElementById('note-content').value = note.content;
    document.getElementById('save-note-btn').textContent = 'Update Note';
    
    editingNoteId = noteId;
    updateNoteStats(); // Update stats for the loaded note

    // Scroll to the top of the page to see the editor
    window.scrollTo({ top: document.getElementById('notes').offsetTop, behavior: 'smooth' });
    document.getElementById('note-title').focus();
}

async function saveNote() {
    const titleInput = document.getElementById('note-title');
    const contentInput = document.getElementById('note-content');
    const btn = document.getElementById('save-note-btn');
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (!content) { showNotification('Note content cannot be empty.', true); return; }
    btn.disabled = true; btn.textContent = 'Saving...';
    
    try {
        if (editingNoteId) {
            // --- UPDATE EXISTING NOTE ---
            const noteToUpdate = notes.find(n => n.id === editingNoteId);
            if (noteToUpdate) {
                noteToUpdate.title = title || 'Untitled Note';
                noteToUpdate.content = content;
                noteToUpdate.updatedAt = new Date().toISOString();
                noteToUpdate.tags = [...content.matchAll(TAG_REGEX)].map(match => match[1]);
                showNotification('Note updated successfully!');
            }
        } else {
            // --- CREATE NEW NOTE ---
            const now = new Date().toISOString();
            const newNote = { 
                id: Date.now().toString(), 
                title: title || 'Untitled Note', 
                content: content, 
                createdAt: now,
                updatedAt: now, // Initially the same
                tags: [...content.matchAll(TAG_REGEX)].map(match => match[1])
            };
            notes.push(newNote);
            showNotification('Note saved successfully!');
        }

        saveNotesToStorage();
        renderNotes(); // Refresh list
        updateDashboard();
        
        // Reset form state
        titleInput.value = ''; 
        contentInput.value = '';
        editingNoteId = null;
        updateNoteStats(); // Reset counter display

    } catch (e) {
        console.error("Error saving note: ", e);
        showNotification('Failed to save note.', true);
    } finally {
        btn.disabled = false; 
        btn.textContent = 'Save Note'; // Always reset to default
    }
}
async function deleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
        notes = notes.filter(note => note.id !== noteId);
        saveNotesToStorage();
        renderNotes(); // Refresh list
        // If the deleted note was being edited, reset the form
        if (editingNoteId === noteId) {
            document.getElementById('note-title').value = '';
            document.getElementById('note-content').value = '';
            editingNoteId = null;
            document.getElementById('save-note-btn').textContent = 'Save Note';
        }
        updateDashboard();
        showNotification('Note deleted.');
    } catch (e) {
        console.error("Error deleting note: ", e);
        showNotification('Failed to delete note.', true);
    }
}

// --- 12. TO-DO LIST LOGIC (MODIFIED) ---

// MODIFIED: Added search/filter text
function renderTodos(filterText = '') {
    // Update sort button UI
    const newestBtn = document.getElementById('sort-todos-newest');
    const deadlineBtn = document.getElementById('sort-todos-deadline');
    if (newestBtn && deadlineBtn) {
        if (todoSortOrder === 'deadline') {
            deadlineBtn.classList.add('active');
            newestBtn.classList.remove('active');
            deadlineBtn.style.backgroundColor = 'var(--accent-primary)';
            newestBtn.style.backgroundColor = 'var(--bg-tertiary)';
        } else { // 'newest'
            newestBtn.classList.add('active');
            deadlineBtn.classList.remove('active');
            newestBtn.style.backgroundColor = 'var(--accent-primary)';
            deadlineBtn.style.backgroundColor = 'var(--bg-tertiary)';
        }
    }

    const todoListDiv = document.getElementById('todo-list');
    todoListDiv.innerHTML = '';

    const normalizedFilter = filterText.toLowerCase();
    const filteredTodos = todos.filter(todo => {
        if (filterText === '') return true;
        
        // Check task name
        if (todo.task.toLowerCase().includes(normalizedFilter)) return true;
        
        // Check tags
        if (normalizedFilter.startsWith('#')) {
            // Search by tag
            const searchTag = normalizedFilter.substring(1);
            return todo.tags.some(tag => tag.toLowerCase().startsWith(searchTag));
        } else {
            // General search, check tags as well
             return todo.tags.some(tag => tag.toLowerCase().includes(normalizedFilter));
        }
    });

    if (filteredTodos.length === 0) {
        todoListDiv.innerHTML = `<p class="empty-list-message">// No tasks found ${filterText ? 'matching search' : 'for this user'}</p>`;
        return;
    }
    
    let sortedTodos;
    if (todoSortOrder === 'deadline') {
        sortedTodos = [...filteredTodos].sort((a, b) => {
            // Tasks without deadlines go to the bottom
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            // Sort by date
            const dateA = new Date(a.deadline);
            const dateB = new Date(b.deadline);
            if (dateA - dateB !== 0) return dateA - dateB;
            // If deadlines are same, sort by creation date
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    } else { // 'newest'
        sortedTodos = [...filteredTodos].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    sortedTodos.forEach(todo => {
        // SECURITY: Create elements manually to prevent XSS from innerHTML.
        const todoElement = document.createElement('div');
        todoElement.className = 'list-item';
        if (todo.completed) { todoElement.classList.add('completed'); }

        const label = document.createElement('label');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = todo.completed;
        checkbox.addEventListener('change', () => toggleTodoComplete(todo.id));

        const todoContentDiv = document.createElement('div');
        todoContentDiv.className = 'todo-content';

        const taskSpan = document.createElement('span');
        taskSpan.textContent = todo.task;
        todoContentDiv.appendChild(taskSpan);

        if (todo.deadline) {
            const [y, m, d] = todo.deadline.split('-');
            const deadlineDate = new Date(y, m - 1, d);
            const dateString = deadlineDate.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
            const deadlineSpan = document.createElement('span');
            deadlineSpan.className = 'todo-deadline';
            deadlineSpan.textContent = `// Due: ${dateString}`;
            todoContentDiv.appendChild(deadlineSpan);
        }

        if (todo.tags && todo.tags.length > 0) {
            const tagListDiv = document.createElement('div');
            tagListDiv.className = 'tag-list';
            tagListDiv.innerHTML = todo.tags.map(tag => `<span class="tag">#${tag}</span>`).join('');
            todoContentDiv.appendChild(tagListDiv);
        }

        label.append(checkbox, todoContentDiv);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.addEventListener('click', () => deleteTodo(todo.id));
        deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z" clip-rule="evenodd" /></svg>`;

        todoElement.append(label, deleteButton);
        todoListDiv.appendChild(todoElement);
    });
}
async function addTodo() {
    const todoInput = document.getElementById('todo-input');
    const deadlineInput = document.getElementById('todo-deadline-input'); 
    const btn = document.getElementById('add-todo-btn');
    
    let task = todoInput.value.trim();
    const deadline = deadlineInput.value || null; 
    
    if (!task) { showNotification('Task cannot be empty.', true); return; }
    btn.disabled = true; btn.textContent = 'Adding...';
    try {
        // MODIFIED: Extract tags and clean task text
        const tags = [...task.matchAll(TAG_REGEX)].map(match => match[1].toLowerCase());
        task = task.replace(TAG_REGEX, '').trim(); // Remove tags from task text
        
        if (!task) { // Handle case where input was ONLY tags
             showNotification('Task cannot be empty.', true);
             btn.disabled = false; btn.textContent = 'Add';
             return;
        }

        const newTodo = { 
            id: Date.now().toString(), 
            task: task, 
            completed: false, 
            createdAt: new Date().toISOString(),
            deadline: deadline,
            tags: tags // Save tags array
        };
        todos.push(newTodo);
        saveTodosToStorage();
        renderTodos(document.getElementById('todo-search-input').value); // Refresh list
        updateDashboard();
        renderCalendar(); 
        todoInput.value = '';
        deadlineInput.value = ''; 
    } catch (e) {
        console.error("Error adding todo: ", e);
        showNotification('Failed to add todo.', true);
    } finally {
        btn.disabled = false; btn.textContent = 'Add';
    }
}

function setTodoSort(sortType) {
    todoSortOrder = sortType;
    renderTodos(document.getElementById('todo-search-input').value);
}

async function toggleTodoComplete(todoId) {
    try {
        const todo = todos.find(t => t.id === todoId);
        if (todo) {
            todo.completed = !todo.completed;
            saveTodosToStorage();
            renderTodos(document.getElementById('todo-search-input').value); // Refresh list
            updateDashboard();
            renderCalendar(); 
            // MODIFIED: Refresh calendar modal if it's open
            if (!document.getElementById('add-todo-modal').classList.contains('hidden')) {
                const dateStr = document.getElementById('calendar-todo-date-input').value;
                renderCalendarModalTasks(dateStr);
            }
        }
    } catch (e) { console.error("Error updating todo: ", e); showNotification('Failed to update task status.', true); }
}
async function deleteTodo(todoId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        todos = todos.filter(t => t.id !== todoId);
        saveTodosToStorage();
        renderTodos(document.getElementById('todo-search-input').value); // Refresh list
        updateDashboard();
        renderCalendar(); 
        showNotification('Task deleted.');
    } catch (e) { console.error("Error deleting todo: ", e); showNotification('Failed to delete task.', true); }
}

// --- 13. CALCULATOR LOGIC ---
function appendToDisplay(value) {
    const calcDisplay = document.getElementById('calc-display');
    if (calcDisplay.value === 'Error') { calcDisplay.value = ''; }
    calcDisplay.value += value;
}
function clearDisplay() { document.getElementById('calc-display').value = ''; }
function deleteLast() {
    const calcDisplay = document.getElementById('calc-display');
    if (calcDisplay.value === 'Error') { calcDisplay.value = ''; }
    else { calcDisplay.value = calcDisplay.value.slice(0, -1); }
}
function calculateResult() {
    const calcDisplay = document.getElementById('calc-display');
    if (calcDisplay.value === '' || calcDisplay.value === 'Error') { return; }
    try {
        // Use the Function constructor for safer evaluation than eval()
        const result = new Function('return ' + calcDisplay.value)();
        if (Number.isFinite(result) && !Number.isInteger(result)) {
            calcDisplay.value = parseFloat(result.toFixed(10));
        } else {
            calcDisplay.value = result;
        }
    } catch (e) {
        calcDisplay.value = 'Error';
        console.error("Calculator error:", e);
    }
}

// --- 14. CALENDAR LOGIC ---
function renderCalendar() {
    const daysGrid = document.getElementById('calendar-grid-days');
    const monthYearEl = document.getElementById('calendar-month-year');
    if (!daysGrid || !monthYearEl) return; 
    
    daysGrid.innerHTML = '';
    const today = new Date();
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth(); // 0-11

    monthYearEl.textContent = calendarDate.toLocaleDateString('en-US', {
        month: 'long', year: 'numeric'
    });

    const todosByDay = {}; // Key: "YYYY-MM-DD"
    if (currentUser) {
        todos.filter(t => t.deadline).forEach(t => {
            if (!todosByDay[t.deadline]) {
                todosByDay[t.deadline] = [];
            }
            todosByDay[t.deadline].push(t);
        });
    }

    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun, 1=Mon...
    const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
    
    const prevMonthDate = new Date(year, month, 0);
    const prevMonthLastDate = prevMonthDate.getDate();
    const prevMonth = prevMonthDate.getMonth(); // 0-11
    const prevYear = prevMonthDate.getFullYear();

    const nextMonthDate = new Date(year, month + 1, 1);
    const nextMonth = nextMonthDate.getMonth(); // 0-11
    const nextYear = nextMonthDate.getFullYear();

    for (let i = firstDayOfMonth; i > 0; i--) {
        const day = prevMonthLastDate - i + 1;
        const dateStr = `${prevYear}-${pad(prevMonth + 1)}-${pad(day)}`;
        daysGrid.innerHTML += createDayCell(day, dateStr, ['prev-month'], todosByDay[dateStr]);
    }

    for (let i = 1; i <= lastDateOfMonth; i++) {
        const dateStr = `${year}-${pad(month + 1)}-${pad(i)}`;
        let classes = [];
        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            classes.push('current-day');
        }
        daysGrid.innerHTML += createDayCell(i, dateStr, classes, todosByDay[dateStr]);
    }

    const totalCells = firstDayOfMonth + lastDateOfMonth;
    const nextMonthDays = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7); 
    
    for (let i = 1; i <= nextMonthDays; i++) {
        const dateStr = `${nextYear}-${pad(nextMonth + 1)}-${pad(i)}`;
        daysGrid.innerHTML += createDayCell(i, dateStr, ['next-month'], todosByDay[dateStr]);
    }
}

function createDayCell(dayNumber, dateStr, classes, tasks = []) {
    const tasksForThisDay = tasks || [];
    
    const markersHTML = tasksForThisDay.map(t => {
        return `<div class="calendar-todo-marker ${t.completed ? 'completed' : ''}" title="${escapeHTML(t.task)}"></div>`;
    }).join('');

    return `
        <div class="calendar-day ${classes.join(' ')}" data-date="${dateStr}">
            <span class="calendar-day-content">${dayNumber}</span>
            <div class="calendar-todo-markers">${markersHTML}</div>
        </div>
    `;
}

function prevMonth() {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
}

// --- 15. CALENDAR MODAL LOGIC (MODIFIED) ---

// MODIFIED: Renders the list of tasks inside the calendar modal
function renderCalendarModalTasks(dateStr) {
    const taskListDiv = document.getElementById('calendar-modal-task-list');
    const tasksForDay = todos.filter(t => t.deadline === dateStr);
    
    if (tasksForDay.length === 0) {
        taskListDiv.innerHTML = '<p class="empty-list-message" style="font-size: 0.9rem;">// No tasks for this day</p>';
        return;
    }
    
    taskListDiv.innerHTML = ''; // Clear
    tasksForDay.forEach(todo => {
        const todoElement = document.createElement('div');
        todoElement.className = 'list-item';
        if (todo.completed) { todoElement.classList.add('completed'); }
        const checkedAttr = todo.completed ? 'checked' : '';
        
        todoElement.innerHTML = `
            <label>
                <input type="checkbox" ${checkedAttr}>
                <div class="todo-content">
                    <span>${todo.task}</span>
                </div>
            </label>
        `;
        taskListDiv.appendChild(todoElement);
    });
    // Re-attach listeners for dynamically created checkboxes
    document.querySelectorAll('#calendar-modal-task-list input[type="checkbox"]').forEach((checkbox, index) => {
        checkbox.addEventListener('change', () => toggleTodoComplete(tasksForDay[index].id));
    });
}

function openAddTodoModal(event) {
    if (!currentUser) {
        showNotification("Please log in to add tasks", true);
        return;
    }
    
    const dateStr = event.target.closest('.calendar-day').dataset.date;
    if (!dateStr) return;

    const [y, m, d] = dateStr.split('-');
    const displayDate = new Date(y, m - 1, d).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
    });

    document.getElementById('calendar-modal-title').textContent = `Tasks for ${displayDate}`;
    document.getElementById('calendar-todo-date-input').value = dateStr;
    document.getElementById('calendar-todo-task-input').value = ''; 

    // MODIFIED: Render the task list
    renderCalendarModalTasks(dateStr);

    document.getElementById('modal-backdrop-calendar').classList.remove('hidden');
    document.getElementById('add-todo-modal').classList.remove('hidden');
    document.getElementById('calendar-todo-task-input').focus();
}

function closeAddTodoModal() {
    document.getElementById('modal-backdrop-calendar').classList.add('hidden');
    document.getElementById('add-todo-modal').classList.add('hidden');
}

async function addTodoFromCalendar() {
    const taskInput = document.getElementById('calendar-todo-task-input');
    const deadline = document.getElementById('calendar-todo-date-input').value;
    let task = taskInput.value.trim();
    const btn = document.getElementById('calendar-add-todo-btn');
    
    if (!task) {
        showNotification('Task name cannot be empty', true);
        return;
    }
    if (!deadline) {
        showNotification('Error: No deadline date found', true);
        return;
    }

    btn.disabled = true; btn.textContent = 'Adding...';
    try {
        // MODIFIED: Extract tags
        const tags = [...task.matchAll(TAG_REGEX)].map(match => match[1].toLowerCase());
        task = task.replace(TAG_REGEX, '').trim(); // Remove tags
        
        if (!task) { // Handle case where input was ONLY tags
             showNotification('Task cannot be empty.', true);
             btn.disabled = false; btn.textContent = 'Add Task';
             return;
        }

        const newTodo = { 
            id: Date.now().toString(), 
            task: task, 
            completed: false, 
            createdAt: new Date().toISOString(),
            deadline: deadline,
            tags: tags
        };
        todos.push(newTodo);
        saveTodosToStorage();
        
        // Refresh all related components
        renderTodos(document.getElementById('todo-search-input').value);
        updateDashboard();
        renderCalendar();
        renderCalendarModalTasks(deadline); // MODIFIED: Refresh modal list
        
        taskInput.value = ''; // Clear input for next task
        showNotification('Task added successfully!');

    } catch (e) {
        console.error("Error adding todo from calendar: ", e);
        showNotification('Failed to add task.', true);
    } finally {
        btn.disabled = false; btn.textContent = 'Add Task';
    }
}


// --- 16. EVENT LISTENERS ---
function initEventListeners() {
    // Auth
    document.getElementById('login-btn').addEventListener('click', loginUser);
    document.getElementById('logout-btn').addEventListener('click', logoutUser);
    document.getElementById('manage-users-btn').addEventListener('click', toggleUserManagementModal);
    document.getElementById('modal-backdrop-auth').addEventListener('click', toggleUserManagementModal);
    document.getElementById('delete-users-confirm-input').addEventListener('input', (e) => {
        const deleteBtn = document.getElementById('delete-selected-users-btn');
        deleteBtn.disabled = (e.target.value.trim() !== 'DELETE');
    });
    document.getElementById('delete-selected-users-btn').addEventListener('click', deleteSelectedUsers);
    document.getElementById('cancel-user-delete-btn').addEventListener('click', toggleUserManagementModal);

    // Main App & Tabs
    document.getElementById('tab-container').addEventListener('click', (e) => {
        if (e.target.matches('.tab-button')) {
            e.currentTarget.querySelector('.active')?.classList.remove('active');
            e.target.classList.add('active');
            switchTab(e.target.dataset.tabId);
        }
    });

    // Dashboard
    document.getElementById('customize-btn').addEventListener('click', toggleCustomizeModal);
    document.getElementById('dash-manage-account-btn').addEventListener('click', () => switchTab('user-settings', true));
    document.getElementById('delete-account-btn').addEventListener('click', confirmDeleteAccount);
    document.getElementById('modal-backdrop').addEventListener('click', toggleCustomizeModal);
    document.getElementById('close-customize-modal-btn').addEventListener('click', toggleCustomizeModal);

    // Clock & Timer
    document.getElementById('stopwatch-start-btn').addEventListener('click', toggleStopwatch);
    document.getElementById('stopwatch-reset-btn').addEventListener('click', resetStopwatch);
    document.getElementById('timer-start-btn').addEventListener('click', startTimer);
    document.getElementById('timer-pause-btn').addEventListener('click', pauseTimer);
    document.getElementById('timer-reset-btn').addEventListener('click', resetTimer);

    // Notes
    document.getElementById('note-search-input').addEventListener('input', (e) => renderNotes(e.target.value));
    document.getElementById('note-content').addEventListener('input', updateNoteStats);
    document.getElementById('save-note-btn').addEventListener('click', saveNote);

    // To-Do List
    document.getElementById('todo-search-input').addEventListener('input', (e) => renderTodos(e.target.value));
    document.getElementById('add-todo-btn').addEventListener('click', addTodo);
    document.getElementById('todo-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });
    document.getElementById('todo-sort-buttons').addEventListener('click', (e) => {
        if (e.target.matches('button')) {
            setTodoSort(e.target.id === 'sort-todos-newest' ? 'newest' : 'deadline');
        }
    });

    // Calendar
    document.getElementById('calendar-prev-btn').addEventListener('click', prevMonth);
    document.getElementById('calendar-next-btn').addEventListener('click', nextMonth);
    document.getElementById('modal-backdrop-calendar').addEventListener('click', closeAddTodoModal);
    document.getElementById('calendar-add-todo-btn').addEventListener('click', addTodoFromCalendar);
    document.getElementById('calendar-cancel-btn').addEventListener('click', closeAddTodoModal);
    document.getElementById('calendar-grid-days').addEventListener('click', (e) => {
        if (e.target.closest('.calendar-day')) {
            openAddTodoModal(e);
        }
    });

    document.getElementById('username-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('password-input').focus();
    });

    // User Settings
    document.getElementById('change-username-btn').addEventListener('click', changeUsername);
    document.getElementById('change-password-btn').addEventListener('click', changePassword);
    document.getElementById('export-data-btn').addEventListener('click', exportUserData);
    document.getElementById('import-data-btn').addEventListener('click', importUserData);

    // Appearance
    document.getElementById('theme-btn-dark').addEventListener('click', () => setTheme('dark'));
    document.getElementById('theme-btn-light').addEventListener('click', () => setTheme('light'));
    document.getElementById('accent-color-picker').addEventListener('input', (e) => setAccentColor(e.target.value));
    document.getElementById('font-size-slider').addEventListener('input', (e) => setFontSize(e.target.value));
    document.getElementById('reset-settings-btn').addEventListener('click', resetSettings);

    // Converter
    document.getElementById('meters-input').addEventListener('input', () => convertLength('m'));
    document.getElementById('feet-input').addEventListener('input', () => convertLength('ft'));
    document.getElementById('celsius-input').addEventListener('input', () => convertTemp('c'));
    document.getElementById('fahrenheit-input').addEventListener('input', () => convertTemp('f'));
    document.getElementById('mb-input').addEventListener('input', () => convertDataStorage('mb'));
    document.getElementById('gb-input').addEventListener('input', () => convertDataStorage('gb'));
    document.getElementById('decimal-input').addEventListener('input', () => convertNumberBase('dec'));
    document.getElementById('hex-input').addEventListener('input', () => convertNumberBase('hex'));

    // Calculator
    document.getElementById('calculator-grid').addEventListener('click', (e) => {
        if (!e.target.matches('button')) return;

        const button = e.target;
        const value = button.textContent;

        if (value === 'AC') {
            clearDisplay();
        } else if (value === 'DEL') {
            deleteLast();
        } else if (value === '=') {
            calculateResult();
        } else {
            appendToDisplay(value);
        }
    });
    document.getElementById('calc-display').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            calculateResult();
        }
    });
}

// --- 16. APP INITIALIZATION (MODIFIED) ---
document.addEventListener('DOMContentLoaded', () => {
    applySavedTheme(); // Apply theme before content loads
    initApp();
    initEventListeners();
    checkSession();
});