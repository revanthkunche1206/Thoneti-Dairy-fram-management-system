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
    options.credentials = "include"; // ✅ Allow Django session cookies

    const res = await fetch(url, options);
    if (!res.ok) {
        const err = await res.text();
        console.error("API error:", err);
        throw new Error(err);
    }
    return res.json();
}


function logout() {
    fetch("/logout/", { method: "POST" }).then(() => {
        sessionStorage.clear();
        window.location.href = "/";
    });
}

function showModal(modalId, message) {
    const modal = document.getElementById(modalId);
    if (modalId === 'successModal') {
        document.getElementById('successMessage').textContent = message;
    } else if (modalId === 'errorModal') {
        document.getElementById('errorMessage').textContent = message;
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
            credentials: 'include',
            body: JSON.stringify(data)
        });


        const result = await response.json();

        if (response.ok) {
            showModal('successModal', `Manager "${result.name}" registered successfully!`);
            event.target.reset();
            loadManagers();
        } else {
            const errorMsg = result.username ? result.username[0] : 'Registration failed. Please try again.';
            showModal('errorModal', errorMsg);
        }
    } catch (error) {
        console.error('Registration error:', error);
        showModal('errorModal', 'Network error. Please check your connection and try again.');
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
                <button class="action-btn btn-delete" title="Delete Manager">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    updateStats(managers);
}

function updateStats(managers) {
    const totalManagers = managers.length;
    const activeManagers = managers.filter(m => m.user.is_active).length;
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
        showModal('errorModal', 'Failed to load managers. Please refresh the page.');
    }
}

function setAdminName() {
    const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
    const adminName = userData.name || 'Administrator';
    document.getElementById('adminName').textContent = adminName;
}

document.addEventListener('DOMContentLoaded', () => {
    setAdminName();
    loadManagers();

    const registerForm = document.getElementById('registerManagerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', registerManager);
    }

    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    });
});
