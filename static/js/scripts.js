/* ============================
   DESIGN SYSTEM (v4) - SCRIPT
   This script matches the new sidebar layout.
============================ */

const BASE_URL = "/api";
let locationSalesChart = null;
let expensePieChart = null;
let milkUsageChart = null;
let salesTrendChart = null;

// New color palette for charts
const CHART_COLORS = [
    '#2c5a41', /* --primary */
    '#d4af37', /* --accent */
    '#6c757d', /* --text-light */
    '#5a9a6f', /* Lighter Green */
    '#f7d98e', /* Lighter Gold */
    '#adb5bd', /* Muted Gray */
    '#8dbf9e',
    '#f9ebc0',
];

/* ============================
   MODALS & HELPERS
============================ */

function showModal(modalId, message) {
    closeModal();
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error("Modal not found:", modalId);
        return;
    }

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

function getCurrentDate() {
    return new Date().toISOString().split("T")[0];
}

function getSelectedDate() {
    // Find *either* the manager's or seller's date selector
    const dateSelector = document.getElementById('globalDateSelector') || document.getElementById('dateSelector');
    return dateSelector ? dateSelector.value : getCurrentDate();
}

function logout() {
    fetch("/logout/", { method: "POST" }).then(() => {
        sessionStorage.clear();
        window.location.href = "/"; // Redirect to login
    });
}

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

    if (res.status === 204) {
        return null;
    }

    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        if (res.ok) {
            throw new Error('Invalid JSON response');
        } else {
            data = { detail: text };
        }
    }

    if (!res.ok) {
        console.error("API error:", data);
        let message = 'An unknown server error occurred.';
        if (typeof data === 'object' && data !== null) {
            // Check for specific validation errors
            if (data.username) message = `Username: ${data.username[0]}`;
            else if (data.password) message = `Password: ${data.password[0]}`;
            else message = Object.values(data).flat().join(' ');
        }
        throw new Error(message);
    }

    return data;
}

/* ============================
   PAGE INITIALIZATION
============================ */

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Handle Login Page
    if (document.getElementById("loginForm")) {
        initLoginPage();
    }

    // 2. Handle ALL Dashboard Pages
    if (document.querySelector('.dashboard-layout')) {
        initSidebarNav();
        initUserData(); // Populate sidebar profile
    }

    // 3. Handle Manager Page
    if (document.getElementById('globalDateSelector')) {
        initManagerPage();
    }

    // 4. Handle Seller Page
    if (document.getElementById('dateSelector')) {
        initSellerPage();
    }
    
    // 5. Handle Employee Page
    if (document.getElementById('employeeId')) {
        initEmployeePage();
    }

    // 6. Attach listeners to all forms that exist
    initGlobalFormListeners();

    // 7. Add listeners for modals
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    });
});

function initLoginPage() {
    const loginForm = document.getElementById("loginForm");
    loginForm.addEventListener("submit", async e => {
        e.preventDefault();
        const role = document.getElementById("role").value.trim();
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();

        if (!role || !username || !password) {
            showModal("errorModal", "Please fill all fields before logging in.");
            return;
        }

        try {
            const response = await fetch("/api/login/", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFToken() },
                body: JSON.stringify({ username, password, role }),
            });

            const data = await response.json();

            if (response.ok && data.message === "Login successful") {
                sessionStorage.setItem("role", data.user.role);
                sessionStorage.setItem("username", data.user.username);
                sessionStorage.setItem("user_id", data.user.user_id);
                sessionStorage.setItem("userData", JSON.stringify(data.user)); // Store all user data

                showModal("successModal", "Login successful! Redirecting...");

                setTimeout(() => {
                    const userRole = data.user.role;
                    if (userRole === "admin") window.location.href = "/admin/";
                    else if (userRole === "manager") window.location.href = "/manager/";
                    else if (userRole === "employee") window.location.href = "/employee/";
                    else if (userRole === "seller") window.location.href = "/seller/";
                    else showModal("errorModal", "Unknown user role. Please contact admin.");
                }, 1000); 

            } else {
                const errorMsg = data.message || data.detail || (data.non_field_errors ? data.non_field_errors[0] : null) || "Invalid credentials or role mismatch.";
                showModal("errorModal", errorMsg);
            }
        } catch (error) {
            console.error("Login error:", error);
            showModal("errorModal", "Could not connect to the server. Please try again later.");
        }
    });
}

function initSidebarNav() {
    const tabs = document.querySelectorAll('.sidebar-nav .tab');
    const tabContents = document.querySelectorAll('.dashboard-content .tab-content');

    // Activate the first tab by default
    if (tabs.length > 0) {
        tabs[0].classList.add('active');
        const firstTabId = tabs[0].getAttribute('href').substring(1);
        const firstTabContent = document.getElementById(firstTabId);
        if (firstTabContent) {
            firstTabContent.classList.add('active');
        }
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Update tab active state
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show content
            const targetId = tab.getAttribute('href').substring(1);
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetId) {
                    content.classList.add('active');
                }
            });
        });
    });
}

function initUserData() {
    try {
        const userData = JSON.parse(sessionStorage.getItem("userData"));
        const role = sessionStorage.getItem("role");
        if (!userData) return;

        let avatar, nameElem, roleElem;

        if (role === 'manager') {
            avatar = document.getElementById("managerAvatar");
            nameElem = document.getElementById("managerName");
            roleElem = document.querySelector(".sidebar-footer .user-info p");
        } else if (role === 'seller') {
            avatar = document.getElementById("sellerAvatar");
            nameElem = document.getElementById("sellerName");
            roleElem = document.getElementById("sellerLocation");
        } else if (role === 'employee') {
            // Employee data is passed from template, so we skip
            return;
        }

        if (nameElem && userData.name) {
            nameElem.textContent = userData.name;
        }
        if (avatar && userData.name) {
            avatar.textContent = userData.name.charAt(0).toUpperCase();
        }
        if (roleElem) {
            if (role === 'seller') {
                roleElem.textContent = userData.location_name || 'No Location';
            } else if (roleElem) {
                roleElem.textContent = role.charAt(0).toUpperCase() + role.slice(1);
            }
        }

    } catch (e) {
        console.error("Could not parse user data from session storage");
    }
}

function initManagerPage() {
    const dateSelector = document.getElementById("globalDateSelector");
    dateSelector.value = getCurrentDate();
    
    const loadAllManagerData = (date) => {
        loadManagerDashboardStats(date); // This will load data for the stat cards and charts
        loadDatewiseData(date); // This will load data for the "Datewise Data" tab
        loadDailyDataForDate(date); // This will pre-fill forms in "Daily Data"
    };

    dateSelector.addEventListener("change", () => loadAllManagerData(dateSelector.value));

    // Initial load for all manager data
    loadEmployees();
    loadLocations();
    loadLocationsForMilkDistribution();
    loadManagerPendingDistributions();
    loadAllManagerData(dateSelector.value); // Load all date-specific data
    loadSalesTrendChart(); // This one is not date-dependent
}

function initSellerPage() {
    const dateSelector = document.getElementById('dateSelector');
    dateSelector.value = getCurrentDate();

    const loadAllSellerData = () => {
        loadSellerSummary();
        loadPendingDistributions();
    };
    
    dateSelector.addEventListener('change', loadAllSellerData);

    // Initial load
    loadAllSellerData();
    loadIncomingRequests();
    loadMyRequests();
    loadBorrowLendHistory();
}

function initEmployeePage() {
    loadEmployeeDashboard();
}

/* ============================
   GLOBAL FORM LISTENERS
============================ */
function initGlobalFormListeners() {
    // Helper function to auto-fill date
    const setFormDate = (form) => {
        const dateInput = form.querySelector('input[type="hidden"][name="date"]');
        if (dateInput) {
            dateInput.value = getSelectedDate();
        }
    };
    
    // Manager Forms
    attachFormListener("feedEntryForm", `${BASE_URL}/manager/feed/`, "Feed entry saved!", () => loadDatewiseData(getSelectedDate()), false, setFormDate);
    attachFormListener("dailyExpenseForm", `${BASE_URL}/manager/expense/`, "Expense saved!", () => loadDatewiseData(getSelectedDate()), false, setFormDate);
    attachFormListener("milkDistributionForm", `${BASE_URL}/manager/milk-distribution/`, "Milk distribution recorded!", () => {
        loadDatewiseData(getSelectedDate());
        loadManagerPendingDistributions();
        loadLocations();
    }, false, setFormDate);
    attachFormListener("leftoverMilkForm", `${BASE_URL}/manager/leftover-milk/`, "Leftover milk data updated!", () => loadDatewiseData(getSelectedDate()), false, setFormDate);
    attachFormListener("miscExpenseForm", `${BASE_URL}/misc-expenses/`, "Miscellaneous expense saved!", () => loadDatewiseData(getSelectedDate()), false, setFormDate);
    attachFormListener("medicineForm", `${BASE_URL}/manager/medicine/`, "Medicine purchase recorded!", () => loadDatewiseData(getSelectedDate()), false, setFormDate);
    attachFormListener("addEmployeeForm", `${BASE_URL}/manager/employees/add/`, "Employee added!", loadEmployees);
    attachFormListener("deductionForm", `${BASE_URL}/manager/deductions/`, "Deduction applied!");
    attachFormListener("addLocationForm", `${BASE_URL}/manager/locations/`, "Location added!", () => {
        loadLocations();
        loadLocationsForMilkDistribution();
    });
    attachFormListener("addSellerForm", `${BASE_URL}/manager/sellers/add/`, "Seller added!", loadLocations);

    // Seller Forms
    attachFormListener("customerSaleForm", `${BASE_URL}/seller/sale/record/`, "Sale recorded!", (newSummary) => {
        updateSellerSummaryUI(newSummary); // Special case: API returns new summary
    }, true, setFormDate);
    attachFormListener("dailyTotalsForm", `${BASE_URL}/seller/daily-totals/`, "Daily financial totals recorded!", loadSellerSummary, false, setFormDate);
    attachFormListener("milkRequestForm", `${BASE_URL}/seller/milk-request/create/`, "Milk request sent!", loadMyRequests);

    // Auto-calculate revenue for seller
    const dailyTotalsForm = document.getElementById("dailyTotalsForm");
    if (dailyTotalsForm) {
        dailyTotalsForm.addEventListener("input", e => {
            const cash = parseFloat(dailyTotalsForm.querySelector('[name="cashEarned"]').value) || 0;
            const online = parseFloat(dailyTotalsForm.querySelector('[name="onlineEarned"]').value) || 0;
            dailyTotalsForm.querySelector('[name="revenue"]').value = (cash + online).toFixed(2);
        });
    }
}

// Updated helper for attaching form listeners
function attachFormListener(formId, url, successMessage, callback, apiReturnsData = false, beforeSubmit = null) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener("submit", async e => {
        e.preventDefault();
        try {
            // Run any pre-submit logic (like setting the date)
            if (beforeSubmit) {
                beforeSubmit(form);
            }

            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            // Clean up field names that don't match API
            if(data.feedType) { data.feed_type = data.feedType; delete data.feedType; }
            if(data.medicineName) { data.medicine_name = data.medicineName; delete data.medicineName; }
            if(data.baseSalary) { data.base_salary = data.baseSalary; delete data.baseSalary; }
            if(data.sellerName) { data.name = data.sellerName; delete data.sellerName; }
            if(data.sellerUsername) { data.username = data.sellerUsername; delete data.sellerUsername; }
            if(data.sellerPassword) { data.password = data.sellerPassword; delete data.sellerPassword; }
            if(data.locationName) { data.location_name = data.locationName; delete data.locationName; }
            if(data.locationId) { data.location_id = data.locationId; delete data.locationId; }
            
            // Handle specific fields from your new forms
            if(data.employeeId) { data.employeeId = data.employeeId; }
            if(data.cashEarned) { data.cashEarned = data.cashEarned; }
            if(data.onlineEarned) { data.onlineEarned = data.onlineEarned; }
            if(data.leftoverMilk) { data.leftoverMilk = data.leftoverMilk; }
            if(data.leftoverSales) { data.leftoverSales = data.leftoverSales; }

            const response = await apiFetch(url, { method: "POST", body: JSON.stringify(data) });
            
            showModal("successModal", successMessage);
            e.target.reset();
            
            if (callback) {
                if (apiReturnsData) {
                    callback(response); // Pass API response to callback
                } else {
                    callback(); // Just call the function
                }
            }
        } catch (error) {
            showModal("errorModal", error.message);
        }
    });
}


/* ============================
   MANAGER DATA LOADING
============================ */

async function loadManagerDashboardStats(selectedDate) {
    // This function loads the top 4 stat cards AND the charts
    try {
        // We get ALL data for the selected date
        const data = await apiFetch(`${BASE_URL}/manager/datewise-data/?date=${selectedDate}`);
        
        // We still need the employee/location counts, which are not date-specific
        const [employees, locations] = await Promise.all([
            apiFetch(`${BASE_URL}/manager/employees/`),
            apiFetch(`${BASE_URL}/manager/locations/`)
        ]);
        
        document.getElementById("dashTotalEmployees").textContent = employees.length;
        document.getElementById("dashTotalLocations").textContent = locations.length;

        // Calculate totals from date-specific data
        let totalMilk = 0;
        if (data.milk_distribution && data.milk_distribution.length > 0) {
            totalMilk = data.milk_distribution.reduce((acc, dist) => acc + parseFloat(dist.total_milk), 0);
        }
        document.getElementById("dashTodayMilk").textContent = totalMilk.toFixed(2);

        let totalExpenses = 0;
        if (data.feed_records) totalExpenses += data.feed_records.reduce((acc, feed) => acc + parseFloat(feed.cost), 0);
        if (data.expense_records) totalExpenses += data.expense_records.reduce((acc, exp) => acc + parseFloat(exp.amount), 0);
        if (data.medicine_records) totalExpenses += data.medicine_records.reduce((acc, med) => acc + parseFloat(med.cost), 0);
        document.getElementById("dashTodayExpenses").textContent = totalExpenses.toFixed(2);
        
        // Init charts with the new data
        initLocationSalesChart(data.daily_totals);
        initExpensePieChart(data.feed_records, data.expense_records, data.medicine_records);
        initMilkUsageChart(data.milk_distribution);

    } catch (error) {
        console.error("Failed to load manager dashboard stats:", error);
    }
}

async function loadSalesTrendChart() {
    try {
        const trendData = await apiFetch(`${BASE_URL}/manager/sales-trend/`);
        const ctx = document.getElementById('salesTrendChart')?.getContext('2d');
        if (!ctx) return;

        const labels = trendData.map(item => item.day);
        const data = trendData.map(item => item.daily_revenue);

        if (salesTrendChart) salesTrendChart.destroy();
        salesTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue (₹)',
                    data: data,
                    borderColor: 'var(--primary)',
                    backgroundColor: 'var(--primary-light)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (error)
    {
        console.error("Failed to load sales trend:", error);
    }
}

async function loadDatewiseData(selectedDate) {
    // This function populates all the tables in the "Datewise Data" tab
    try {
        const data = await apiFetch(`${BASE_URL}/manager/datewise-data/?date=${selectedDate}`);
        
        populateTable('feedRecordsTable', data.feed_records, ['feed_type', 'quantity', 'cost'], ['Feed Type', 'Quantity (kg)', 'Cost (₹)']);
        populateTable('expensesTable', data.expense_records, ['category', 'amount'], ['Category', 'Amount (₹)']);
        populateTable('medicineTable', data.medicine_records, ['medicine_name', 'cost'], ['Medicine Name', 'Cost (₹)']);
        populateTable('milkDistributionTable', data.milk_distribution, ['total_milk', 'leftover_milk', 'leftover_sales'], ['Total Milk (L)', 'Leftover Milk (L)', 'Leftover Sales (₹)']);
        populateTable('milkReceivedTable', data.milk_received, ['seller_name', 'quantity', 'source', 'status'], ['Seller Name', 'Quantity (L)', 'Source', 'Status']);
        populateTable('dailyTotalsTable', data.daily_totals, ['seller_name', 'cash_sales', 'online_sales', 'revenue'], ['Seller Name', 'Cash Sales (₹)', 'Online Sales (₹)', 'Total Revenue (₹)']); 
        populateTable('attendanceTable', data.attendance, ['employee_name', 'status'], ['Employee Name', 'Status']);

    } catch (error) {
        console.error("Failed to load datewise data:", error);
        showModal("errorModal", "Failed to load data for the selected date: " + error.message);
    }
}

function populateTable(tableId, data, fields, headers) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) {
        console.warn(`Table body not found for ${tableId}`);
        return;
    }
    tbody.innerHTML = "";
    if (!data || data.length === 0) {
        const colspan = headers.length;
        tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; color: var(--text-muted);">No data available</td></tr>`;
        return;
    }
    data.forEach(item => {
        const row = document.createElement("tr");
        fields.forEach(field => {
            const cell = document.createElement("td");
            let value = item[field];
            if (field.includes('.')) { // Handle nested fields like 'seller.name'
                value = field.split('.').reduce((o, k) => (o || {})[k], item);
            }
            
            if (field === 'status') {
                let statusClass = '';
                if (value === 'pending') statusClass = 'badge-pending';
                else if (value === 'received') statusClass = 'badge-accepted';
                else if (value === 'not_received') statusClass = 'badge-danger';
                else statusClass = '';
                
                cell.innerHTML = value ? `<span class="badge ${statusClass}">${value}</span>` : 'N/A';
            } else {
                if (typeof value === 'number' || (!isNaN(parseFloat(value)) && (field.includes('cost') || field.includes('amount') || field.includes('revenue') || field.includes('quantity') || field.includes('milk') || field.includes('sales')))) {
                    value = parseFloat(value).toFixed(2);
                    if (field.includes('cost') || field.includes('amount') || field.includes('revenue') || field.includes('sales')) {
                        value = `₹${value}`;
                    }
                }
                cell.textContent = value === null || value === undefined ? 'N/A' : value;
            }
            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
}


async function loadDailyDataForDate(selectedDate) {
    // This populates the forms in the "Daily Data" tab with existing data
    try {
        const data = await apiFetch(`${BASE_URL}/manager/daily-data/?date=${selectedDate}`);

        const resetAndSetDate = (formEl) => {
            if (formEl) {
                formEl.reset();
                const recordIdInput = formEl.querySelector('input[type="hidden"][name="recordId"]');
                if (recordIdInput) recordIdInput.value = '';
                const dateInput = formEl.querySelector('input[type="hidden"][name="date"]');
                if(dateInput) dateInput.value = selectedDate;
            }
        };

        const populateForm = (formEl, record, idField) => {
            if (formEl && record) {
                const recordIdInput = formEl.querySelector(`input[type="hidden"][name="recordId"]`);
                if(recordIdInput) recordIdInput.value = record[idField];
                
                for (const key in record) {
                    // Use data-field for mapping API names (e.g., feed_type) to form names (e.g., feedType)
                    const input = formEl.querySelector(`[data-field="${key}"]`);
                    if (input) {
                        input.value = record[key];
                    }
                }
            } else {
                resetAndSetDate(formEl);
            }
        };
        
        populateForm(document.getElementById("feedEntryForm"), data.feed_records?.[0], 'feed_id');
        populateForm(document.getElementById("dailyExpenseForm"), data.expense_records?.[0], 'expense_id'); // Assumes first is non-misc
        populateForm(document.getElementById("medicineForm"), data.medicine_records?.[0], 'medicine_id');
        populateForm(document.getElementById("leftoverMilkForm"), data.milk_distribution?.[0], 'distribution_id');
        
        // Set dates for forms that are always new
        resetAndSetDate(document.getElementById("miscExpenseForm"));
        resetAndSetDate(document.getElementById("milkDistributionForm"));
        
        const attDate = document.getElementById("attendanceDate");
        if(attDate) attDate.value = selectedDate;

    } catch (error) {
        console.error("Failed to load daily form data:", error);
    }
}

async function loadEmployees() {
    try {
        const employees = await apiFetch(`${BASE_URL}/manager/employees/`);
        populateEmployeeTable(employees);
        populateAttendanceGrid(employees);
        populateEmployeeSelect(employees);
    } catch (error) {
        console.error("Failed to load employees:", error);
    }
}

function populateEmployeeTable(employees) {
    const tbody = document.querySelector("#employeeTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No employees added yet</td></tr>';
        return;
    }
    employees.forEach(employee => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${employee.employee_id}</td>
            <td>${employee.name}</td>
            <td>${employee.username}</td>
            <td>₹${employee.base_salary}</td>
            <td><button class="btn-secondary btn-small" onclick="viewEmployeeDetails('${employee.employee_id}')">View</button></td>
        `;
        tbody.appendChild(row);
    });
}

function populateEmployeeSelect(employees) {
    const select = document.querySelector('select[name="employeeId"]');
    if (!select) return;
    select.innerHTML = '<option value="">Choose employee...</option>';
    employees.forEach(employee => {
        const option = document.createElement("option");
        option.value = employee.employee_id;
        option.textContent = `${employee.name} (${employee.employee_id})`;
        select.appendChild(option);
    });
}

function populateAttendanceGrid(employees) {
    const grid = document.getElementById("attendanceGrid");
    if (!grid) return;
    grid.innerHTML = "";
    if (employees.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No employees to mark attendance for.</p>';
        return;
    }
    employees.forEach(employee => {
        const row = document.createElement("div");
        row.className = "attendance-row";
        row.innerHTML = `
            <div class="attendance-info">
                <h4>${employee.name}</h4>
                <p>ID: ${employee.employee_id} | Salary: ₹${employee.base_salary}/day</p>
            </div>
            <div class="attendance-actions">
                <button class="btn-secondary btn-success btn-small" onclick="markAttendance('${employee.employee_id}', 'present')">Present</button>
                <button class="btn-secondary btn-danger btn-small" onclick="markAttendance('${employee.employee_id}', 'absent')">Absent</button>
            </div>
        `;
        grid.appendChild(row);
    });
}

window.markAttendance = async function (employeeId, status) {
    try {
        const date = document.getElementById("attendanceDate")?.value || getCurrentDate();
        const data = { employeeId, date, status };
        const response = await apiFetch(`${BASE_URL}/manager/attendance/`, { method: "POST", body: JSON.stringify(data) });
        showModal("successModal", response.message || `Attendance marked ${status}`);
        loadDatewiseData(date); // Refresh datewise table
    } catch (error) {
        showModal("errorModal", error.message);
    }
};

window.viewEmployeeDetails = function(employeeId) {
    // Placeholder - you can expand this
    showModal("successModal", `Viewing details for employee ${employeeId}.`);
};

async function loadLocations() {
    try {
        const selectedDate = getSelectedDate(); // Get the current date from the selector
        const locations = await apiFetch(`${BASE_URL}/manager/locations/?date=${selectedDate}`);
        populateLocationGrid(locations);
        populateSellerLocationSelect(locations);
    } catch (error) {
        console.error("Failed to load locations:", error);
    }
}

function populateLocationGrid(locations) {
    const grid = document.getElementById("locationGrid");
    const count = document.getElementById("locationCount");
    if (!grid || !count) return;

    grid.innerHTML = "";
    count.textContent = locations.length;
    if (locations.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No locations added yet</p>';
        document.getElementById("totalMilkToday").textContent = "0.00";
        return;
    }

    let totalMilk = 0;
    locations.forEach(location => {
        const card = document.createElement("div");
        card.className = "location-card";
        card.innerHTML = `
            <h4>${location.location_name}</h4>
            <p><strong>Address:</strong> ${location.address || 'N/A'}</p>
            <p><strong>Sellers:</strong> ${location.seller_count}</p>
            <p><strong>Milk (Selected Date):</strong> ${location.milk_received_today} L</p> 
        `;
        grid.appendChild(card);
        totalMilk += parseFloat(location.milk_received_today);
    });
    document.getElementById("totalMilkToday").textContent = totalMilk.toFixed(2);
}

function populateSellerLocationSelect(locations) {
    const select = document.querySelector('#addSellerForm select[data-field="locationId"]');
    if (!select) return;
    select.innerHTML = '<option value="">Choose location...</option>';
    locations.forEach(location => {
        const option = document.createElement("option");
        option.value = location.location_id;
        option.textContent = `${location.location_name} (${location.address || 'N/A'})`;
        select.appendChild(option);
    });
}

async function loadLocationsForMilkDistribution() {
    try {
        const locations = await apiFetch(`${BASE_URL}/manager/locations/`);
        const select = document.querySelector('#milkDistributionForm select[data-field="locationId"]');
        if (!select) return;
        select.innerHTML = '<option value="">Choose location...</option>';
        locations.forEach(location => {
            const option = document.createElement("option");
            option.value = location.location_id;
            option.textContent = location.location_name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Failed to load locations for milk form:", error);
    }
}

async function loadManagerPendingDistributions() {
    try {
        const records = await apiFetch(`${BASE_URL}/manager/pending-distributions/`);
        const container = document.getElementById("managerPendingDistributionsList");
        if (!container) return;
        
        container.innerHTML = "";
        if (records.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">No pending distributions.</p>';
            return;
        }

        records.forEach(record => {
            const card = document.createElement("div");
            card.className = "request-card";
            const locationName = record.seller_location_name || 'Unknown Location';
            card.innerHTML = `
                <div class="request-info">
                    <h4>To: ${record.seller_name} (${locationName})</h4>
                    <p><strong>Quantity:</strong> ${record.quantity} Liters</p>
                    <p><strong>Date:</strong> ${record.date}</p>
                </div>
                <div><span class="badge badge-pending">Pending</span></div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error("Failed to load manager pending distributions:", error);
    }
}

/* ============================
   SELLER DATA LOADING
============================ */

function updateSellerSummaryUI(summary) {
    document.getElementById("todayRemainingMilk").textContent = summary.remaining_milk;
    document.getElementById("todayMilkReceived").textContent = summary.total_milk_received;
    document.getElementById("todayMilkSold").textContent = summary.total_milk_sold;
    document.getElementById("todayInterSellerMilk").textContent = summary.inter_seller_milk;
    document.getElementById("todayRevenue").textContent = summary.revenue;
    document.getElementById("todayCash").textContent = summary.cash_sales;
    document.getElementById("todayOnline").textContent = summary.online_sales;
    
    populateTodaySalesTable(summary.individual_sales);
}

async function loadSellerSummary() {
    try {
        const selectedDate = getSelectedDate();
        const summary = await apiFetch(`${BASE_URL}/seller/summary/?date=${selectedDate}`);
        updateSellerSummaryUI(summary);
    } catch (error) {
        console.error("Failed to load seller summary:", error);
    }
}

function populateTodaySalesTable(sales) {
    const tbody = document.querySelector("#todaySalesTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!sales || sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No sales recorded yet today.</td></tr>';
        return;
    }
    sales.forEach(sale => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${new Date(sale.created_at).toLocaleTimeString()}</td>
            <td>${sale.customer_name || 'N/A'}</td>
            <td>${sale.quantity} L</td>
        `;
        tbody.appendChild(row);
    });
}

async function loadPendingDistributions() {
    try {
        const records = await apiFetch(`${BASE_URL}/seller/pending-distributions/`);
        populateSellerPendingDistributions(records);
    } catch (error) {
        console.error("Failed to load pending distributions:", error);
    }
}

function populateSellerPendingDistributions(records) {
    const container = document.getElementById("pendingDistributionsList");
    if (!container) return;
    container.innerHTML = "";
    if (records.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">No pending deliveries.</p>';
        return;
    }
    
    records.forEach(record => {
        const card = document.createElement("div");
        card.className = "request-card";
        const from = record.manager_name ? `Manager (${record.manager_name})` : 'Farm';
        let statusBadge = '';
        let actionButton = '';

        if (record.status === 'pending') {
            statusBadge = '<span class="badge badge-pending">Pending</span>';
            actionButton = `<button class="btn-secondary btn-success btn-small" onclick="handleStatusUpdate('${record.receipt_id}', 'received')">Mark as Received</button>
                            <button class="btn-secondary btn-danger btn-small" onclick="handleStatusUpdate('${record.receipt_id}', 'not_received')">Not Received</button>`;
        } else { // 'not_received'
            statusBadge = '<span class="badge badge-danger">Not Received</span>';
            actionButton = `<button class="btn-secondary btn-success btn-small" onclick="handleStatusUpdate('${record.receipt_id}', 'received')">Mark as Received</button>`;
        }

        card.innerHTML = `
            <div class="request-info">
                <h4>Delivery from ${from}</h4>
                <p><strong>Quantity:</strong> ${record.quantity} Liters</p>
                <p><strong>Date:</strong> ${record.date}</p>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
                ${statusBadge}
                <div style="display: flex; gap: 5px;">${actionButton}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

window.handleStatusUpdate = async function(receiptId, newStatus) {
    try {
        await apiFetch(`${BASE_URL}/seller/milk-received/${receiptId}/update-status/`, {
            method: 'POST',
            body: JSON.stringify({ status: newStatus })
        });
        showModal("successModal", `Successfully marked as ${newStatus}!`);
        loadPendingDistributions(); // Refresh this list
        loadSellerSummary(); // Refresh the summary stats
    } catch (error) {
        showModal("errorModal", "Failed to update status: " + error.message);
    }
}

async function loadIncomingRequests() {
    try {
        const requests = await apiFetch(`${BASE_URL}/seller/milk-requests/incoming/`);
        const container = document.getElementById("incomingRequests");
        if (!container) return;
        container.innerHTML = "";
        if (requests.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">No incoming requests</p>';
            return;
        }
        requests.forEach(request => {
            const card = document.createElement("div");
            card.className = "request-card";
            card.innerHTML = `
                <div class="request-info">
                <h4>Request from ${request.from_seller_name} (${request.from_seller_location})</h4>
                <p><strong>Quantity:</strong> ${request.quantity} Liters</p>
                <p><strong>Date:</strong> ${new Date(request.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                <span class="badge badge-pending">Pending</span>
                <button class="btn-secondary btn-success btn-small" style="margin-left: 10px;" onclick="acceptRequest('${request.request_id}')">Accept</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error("Failed to load incoming requests:", error);
    }
}

window.acceptRequest = async function (requestId) {
    try {
        await apiFetch(`${BASE_URL}/seller/milk-request/${requestId}/accept/`, {
            method: "POST",
            body: JSON.stringify({}),
        });
        showModal("successModal", "Request accepted! Status changed to On Hold.");
        loadIncomingRequests();
        loadSellerSummary(); // Refresh summary as our remaining milk has changed
    } catch (error) {
        showModal("errorModal", error.message);
    }
};

async function loadMyRequests() {
    try {
        const requests = await apiFetch(`${BASE_URL}/seller/milk-requests/mine/`);
        const container = document.getElementById("myRequestsList");
        if (!container) return;
        container.innerHTML = "";
        if (requests.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">No requests made yet</p>';
            return;
        }
        requests.forEach(request => {
            const card = document.createElement("div");
            card.className = "request-card";
            let statusBadge = "";
            let actionButton = "";

            if (request.status === "pending") {
                statusBadge = '<span class="badge badge-pending">Pending</span>';
            } else if (request.status === "on_hold") {
                statusBadge = '<span class="badge" style="background-color: #ffeeba; color: #85640b;">On Hold</span>';
                actionButton = `<button class="btn-secondary btn-success btn-small" onclick="markAsReceived('${request.request_id}')">Mark as Received</button>`;
            } else if (request.status === "received") {
                statusBadge = '<span class="badge badge-accepted">Received</span>';
            } else if (request.status === "rejected") {
                statusBadge = '<span class="badge badge-danger">Rejected</span>';
            }

            card.innerHTML = `
                <div class="request-info">
                <h4>Request #${request.request_id.slice(0, 8)}</h4>
                <p><strong>Quantity:</strong> ${request.quantity} Liters</p>
                <p><strong>Date:</strong> ${new Date(request.created_at).toLocaleDateString()}</p>
                ${request.to_seller_name ? `<p><strong>Accepted by:</strong> ${request.to_seller_name}</p>` : ''}
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
                ${statusBadge}
                ${actionButton}
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error("Failed to load my requests:", error);
    }
}

window.markAsReceived = async function (requestId) {
    try {
        await apiFetch(`${BASE_URL}/seller/milk-request/${requestId}/received/`, {
            method: "POST",
            body: JSON.stringify({}),
        });
        showModal("successModal", "Milk marked as received! Transaction completed.");
        loadMyRequests();
        loadSellerSummary(); // Refresh summary as our received milk has changed
        loadBorrowLendHistory();
    } catch (error) {
        showModal("errorModal", error.message);
    }
};

async function loadBorrowLendHistory() {
    try {
        const history = await apiFetch(`${BASE_URL}/seller/borrow-lend-history/`);
        populateBorrowLendTable(history);
    } catch (error) {
        console.error("Failed to load borrow/lend history:", error);
    }
}

function populateBorrowLendTable(history) {
    const tbody = document.querySelector("#borrowLendTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No borrow/lend records</td></tr>';
        return;
    }
    history.forEach(record => {
        const row = document.createElement("tr");
        const isSettled = record.status === 'Settled';
        row.innerHTML = `
            <td>${record.date}</td>
            <td>${record.type}</td>
            <td>${record.other_party}</td>
            <td>${record.quantity} L</td>
            <td><span class="badge ${isSettled ? 'badge-accepted' : 'badge-pending'}">${record.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}


/* ============================
   EMPLOYEE DATA LOADING
============================ */

async function loadEmployeeDashboard() {
    try {
        const data = await apiFetch(`${BASE_URL}/employee/dashboard/`);
        document.getElementById("daysWorked").textContent = `${data.days_worked} / ${data.total_days}`;
        document.getElementById("attendancePercent").textContent = `${data.attendance_percentage}%`;
        document.getElementById("baseSalary").textContent = data.base_salary;
        document.getElementById("salaryBalance").textContent = `₹${data.salary_balance}`;
        document.getElementById("totalDeductions").textContent = `₹${data.total_deductions}`;
        document.getElementById("finalSalary").textContent = `₹${data.final_salary}`;
        
        const progressFill = document.getElementById("attendanceProgress");
        if (progressFill) {
            progressFill.style.width = `${data.attendance_percentage}%`;
        }

        const tbody = document.querySelector("#deductionTable tbody");
        tbody.innerHTML = "";
        if (data.deductions && data.deductions.length > 0) {
            data.deductions.forEach(deduction => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${new Date(deduction.created_at).toLocaleDateString()}</td>
                    <td>${deduction.reason}</td>
                    <td>₹${deduction.amount}</td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No deductions recorded</td></tr>';
        }
    } catch (error) {
        console.error("Failed to load employee dashboard:", error);
    }
}

window.viewAttendanceSummary = async function() {
    const container = document.getElementById("attendanceSummaryContainer");
    const tbody = document.querySelector("#attendanceTable tbody");
    if (!container || !tbody) return;

    if (container.style.display === "none") {
        container.style.display = "block";
        try {
            const attendances = await apiFetch(`${BASE_URL}/employee/attendance/`);
            tbody.innerHTML = "";
            if (attendances.length > 0) {
                attendances.forEach(attendance => {
                    const row = document.createElement("tr");
                    const statusClass = attendance.status === 'present' ? 'badge-accepted' : 'badge-danger';
                    row.innerHTML = `
                        <td>${attendance.date}</td>
                        <td><span class="badge ${statusClass}">${attendance.status}</span></td>
                    `;
                    tbody.appendChild(row);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">No attendance records found</td></tr>';
            }
        } catch (error) {
            console.error("Failed to load attendance summary:", error);
            tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">Failed to load attendance data</td></tr>';
        }
    } else {
        container.style.display = "none";
    }
};

/* ============================
   CHART FUNCTIONS
============================ */

function initLocationSalesChart(dailyTotals) {
    const ctx = document.getElementById('locationSalesChart')?.getContext('2d');
    if (!ctx) return;
    
    const salesByLocation = dailyTotals.reduce((acc, sale) => {
        const location = sale.location_name || 'Unknown';
        if (!acc[location]) acc[location] = 0;
        acc[location] += parseFloat(sale.revenue);
        return acc;
    }, {});

    const labels = Object.keys(salesByLocation);
    const data = Object.values(salesByLocation);

    if (locationSalesChart) locationSalesChart.destroy();
    locationSalesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Revenue (₹)',
                data: data,
                backgroundColor: '#eaf3ed', // <-- FIX
                borderColor: '#2c5a41',       // <-- FIX
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: { 
            scales: { y: { beginAtZero: true, grid: { color: '#f0f0f0' } }, x: { grid: { display: false } } }, 
            responsive: true, 
            maintainAspectRatio: false 
        }
    });
}

function initExpensePieChart(feed, expenses, medicine) {
    const ctx = document.getElementById('expensePieChart')?.getContext('2d');
    if (!ctx) return;
    
    const categories = {};
    const addExpense = (cat, cost) => {
        const category = cat || 'Other Expense';
        if (!categories[category]) categories[category] = 0;
        categories[category] += parseFloat(cost);
    };

    feed.forEach(item => addExpense(item.feed_type, item.cost));
    expenses.forEach(item => addExpense(item.category, item.amount));
    medicine.forEach(item => addExpense(item.medicine_name, item.cost));

    const labels = Object.keys(categories);
    const data = Object.values(categories);
    const backgroundColors = labels.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]);

    if (expensePieChart) expensePieChart.destroy();
    expensePieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: backgroundColors, borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function initMilkUsageChart(milkDistribution) {
    const ctx = document.getElementById('milkUsageChart')?.getContext('2d');
    if (!ctx) return;
    
    const record = milkDistribution[0] || { total_milk: 0, leftover_milk: 0 };
    const totalMilk = parseFloat(record.total_milk);
    const leftoverMilk = parseFloat(record.leftover_milk);
    const distributedMilk = totalMilk - leftoverMilk;

    if (milkUsageChart) milkUsageChart.destroy();
    milkUsageChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Milk Distributed', 'Milk Leftover'],
            datasets: [{
                data: [distributedMilk, leftoverMilk],
                backgroundColor: ['#2c5a41', '#e9e9e9'], // <-- FIX
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
    });
}