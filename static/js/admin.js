const BASE_URL = "/api";

function getCSRFToken() {
    const name = "csrftoken";
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
        const trimmed = cookie.trim();
        if (trimmed.startsWith(name + "=")) {
            return decodeURIComponent(trimmed.substring(name.length + 1));
        }
    }
    return "";
}

async function apiFetch(url, options = {}) {
    const headers = options.headers || {};
    headers["Content-Type"] = "application/json";
    headers["X-CSRFToken"] = getCSRFToken();
    options.headers = headers;
    
    const res = await fetch(url, options);

    // Handle 204 No Content (for DELETE)
    if (res.status === 204) {
        return null; // Return null for success with no content
    }
    
    // Check for other errors
    if (!res.ok) {
        let err;
        try {
            err = await res.json(); // Try to parse error JSON
        } catch (e) {
            err = { detail: await res.text() }; // Fallback to text
        }

        console.error("API error:", err);
        // Use a specific error message if available
        const message = err.username ? err.username[0] : (err.detail || 'An unknown server error occurred.');
        throw new Error(message);
    }
    
    // Only parse JSON if there's content and response wasn't 204
    if (res.status !== 204) {
        return res.json();
    }
    return null;
}


function logout() {
    fetch("/logout/", { method: "POST" }).then(() => {
        sessionStorage.clear();
        window.location.href = "/";
    });
}

function showModal(modalId, message) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (modalId === 'successModal') {
        document.getElementById('successMessage').textContent = message;
    } else if (modalId === 'errorModal') {
        document.getElementById('errorMessage').textContent = message;
    } else if (modalId === 'confirmDeleteModal' && message) {
        document.getElementById('confirmDeleteMessage').textContent = message;
    }
    
    modal.classList.add('show');
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('show'));
}

function validateForm() {
    const name = document.getElementById('managerName').value.trim();
    const username = document.getElementById('managerUsername').value.trim();
    const password = document.getElementById('managerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!name || !username || !password || !confirmPassword) {
        showModal('errorModal', 'All fields are required.');
        return false;
    }

    if (password.length < 6) {
        showModal('errorModal', 'Password must be at least 6 characters long.');
        return false;
    }

    if (password !== confirmPassword) {
        showModal('errorModal', 'Passwords do not match.');
        return false;
    }

    return true;
}

async function registerManager(event) {
    event.preventDefault();

    if (!validateForm()) return;

    const formData = new FormData(event.target);
    const data = {
        name: formData.get('name'),
        username: formData.get('username'),
        password: formData.get('password')
    };

    try {
        const response = await fetch(`${BASE_URL}/admin/managers/add/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(data)
        });

        // --- FIX: LOGIC RE-ORDERED ---
        // First, check if the response is OK (e.g., 200, 201)
        if (response.ok) {
            const result = await response.json(); // Now it's safe to parse success JSON
            showModal('successModal', `Manager "${result.name}" registered successfully!`);
            event.target.reset();
            loadManagers(); // This will refresh the table and stats
        } else {
            // If response is not OK (e.g., 400), parse the error JSON
            const result = await response.json();
            // Display the specific error from the server
            const errorMsg = result.username ? result.username[0] : (result.detail || 'Registration failed. Please try again.');
            showModal('errorModal', errorMsg);
        }
        // --- END OF FIX ---

    } catch (error) {
        console.error('Registration error:', error);
        // This 'catch' will now only handle actual network failures
        showModal('errorModal', error.message || 'Network error. Please check your connection.');
    }
}


function populateManagersTable(managers) {
    const tbody = document.getElementById('managersTableBody');
    tbody.innerHTML = '';

    if (managers.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="6" class="no-data">
                    <div class="no-data-message">
                        <span class="no-data-icon">📭</span>
                        <p>No managers registered yet</p>
                        <small>Use the form above to register the first manager</small>
                    </div>
                </td>
            </tr>
        `;
        // Still update stats even if empty
        updateStats(managers);
        return;
    }

    managers.forEach(manager => {
        const row = document.createElement('tr');
        const registeredDate = new Date(manager.created_at).toLocaleDateString();

        row.innerHTML = `
            <td>${manager.name}</td>
            <td>${manager.username}</td>
            <td>${manager.manager_id}</td>
            <td>${registeredDate}</td>
            <td><span class="status status-active">Active</span></td>
            <td>
                <button class="action-btn btn-edit" title="Edit Manager">✏️</button>
                
                <!-- --- MODIFIED THIS BUTTON --- -->
                <button class="action-btn btn-delete" 
                        title="Delete Manager"
                        data-id="${manager.manager_id}"
                        data-name="${manager.name}">
                    🗑️
                </button>
                <!-- --- END OF MODIFICATION --- -->
            </td>
        `;
        tbody.appendChild(row);
    });

    updateStats(managers);
}

function updateStats(managers) {
    const totalManagers = managers.length;
    
    // --- FIX AS DISCUSSED PREVIOUSLY ---
    // The API returns only active managers, so the count is just the length.
    const activeManagers = managers.length;
    // --- END OF FIX ---

    const today = new Date().toISOString().split('T')[0];
    const todayManagers = managers.filter(m => m.created_at.startsWith(today)).length;

    document.getElementById('totalManagers').textContent = totalManagers;
    document.getElementById('activeManagers').textContent = activeManagers;
    document.getElementById('todayManagers').textContent = todayManagers;
}

async function loadManagers() {
    try {
        const managers = await apiFetch(`${BASE_URL}/admin/managers/`);
        populateManagersTable(managers);
    } catch (error) {
        console.error('Failed to load managers:', error);
        showModal('errorModal', `Failed to load managers: ${error.message}. Please refresh the page.`);
    }
}

function setAdminName() {
    const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
    const adminName = userData.name || 'Administrator';
    document.getElementById('adminName').textContent = adminName;
}

// --- ADD THESE NEW FUNCTIONS ---
function showDeleteConfirmation(managerId, managerName) {
    // Set the message
    const message = `Do you really want to delete manager "${managerName}" (ID: ${managerId})? This action cannot be undone.`;
    showModal('confirmDeleteModal', message);

    // Store the ID on the confirm button
    const confirmButton = document.getElementById('confirmDeleteButton');
    confirmButton.dataset.id = managerId;
}

async function handleDeleteManager() {
    const confirmButton = document.getElementById('confirmDeleteButton');
    const managerId = confirmButton.dataset.id;

    if (!managerId) return;

    try {
        // apiFetch will return null for a 204 success
        await apiFetch(`${BASE_URL}/admin/managers/${managerId}/delete/`, {
            method: 'DELETE',
        });

        // Close confirmation modal
        closeModal();

        // Show success
        showModal('successModal', `Manager (ID: ${managerId}) has been successfully deleted.`);

        // Reload the table
        loadManagers();

    } catch (error) {
        console.error('Delete error:', error);
        closeModal();
        showModal('errorModal', `Failed to delete manager: ${error.message}`);
    } finally {
        // Clear the ID from the button
        delete confirmButton.dataset.id;
    }
}
// --- END OF ADDED FUNCTIONS ---


document.addEventListener('DOMContentLoaded', () => {
    setAdminName();
    loadManagers();

    const registerForm = document.getElementById('registerManagerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', registerManager);
    }

    // --- ADD EVENT LISTENERS ---
    
    // 1. Listen for clicks on the delete button in the table
    const tableBody = document.getElementById('managersTableBody');
    if (tableBody) {
        tableBody.addEventListener('click', (e) => {
            const deleteButton = e.target.closest('.btn-delete');
            if (deleteButton) {
                e.preventDefault(); // Good practice
                const managerId = deleteButton.dataset.id;
                const managerName = deleteButton.dataset.name;
                showDeleteConfirmation(managerId, managerName);
            }
        });
    }

    // 2. Listen for clicks on the final confirmation button
    const confirmButton = document.getElementById('confirmDeleteButton');
    if (confirmButton) {
        confirmButton.addEventListener('click', handleDeleteManager);
    }
    // --- END OF ADDED LISTENERS ---

    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    });
});