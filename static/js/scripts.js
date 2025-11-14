const BASE_URL = "/api";
let locationSalesChart = null;
let expensePieChart = null;
let milkUsageChart = null;
let salesTrendChart = null;

const CHART_COLORS = [
    'rgba(255, 99, 132, 0.7)',
    'rgba(54, 162, 235, 0.7)',
    'rgba(255, 206, 86, 0.7)',
    'rgba(75, 192, 192, 0.7)',
    'rgba(153, 102, 255, 0.7)',
    'rgba(255, 159, 64, 0.7)',
    'rgba(199, 199, 199, 0.7)',
    'rgba(83, 102, 255, 0.7)',
    'rgba(40, 159, 64, 0.7)',
    'rgba(210, 99, 132, 0.7)'
];

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

function setTodayDates() {
  const dateInputs = document.querySelectorAll('input[type="date"]');
  const today = getCurrentDate();
  dateInputs.forEach(input => {
    if (!input.value) input.value = today;
  });
}

function getSelectedDate() {
  const globalDateSelector = document.getElementById('globalDateSelector');
  const dateSelector = document.getElementById('dateSelector');
  if (globalDateSelector) return globalDateSelector.value || getCurrentDate();
  if (dateSelector) return dateSelector.value || getCurrentDate();
  return getCurrentDate();
}

function updateDateInputs() {
  const selectedDate = getSelectedDate();
  const dateInputs = document.querySelectorAll('input[type="date"]');
  dateInputs.forEach(input => {
    if (input.id !== 'globalDateSelector' && input.id !== 'dateSelector') {
      input.value = selectedDate;
    }
  });
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(pageId);
  if (target) target.classList.add("active");
  setTodayDates();
}

function switchTab(event, tabId) {
  const tabsContainer = event.target.closest(".dashboard-content");
  if (!tabsContainer) return;
  tabsContainer.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
  tabsContainer.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));
  event.target.classList.add("active");
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add("active");
}

function logout() {
  fetch("/logout/", { method: "POST" }).then(() => {
    sessionStorage.clear();
    window.location.href = "/";
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
      message = Object.values(data).flat().join(' ');
    }
    throw new Error(message);
  }

  return data;
}


document.addEventListener("DOMContentLoaded", () => {
  setTodayDates();

  if (document.getElementById("managerDashboard")) {
    loadEmployees();
    loadLocations();
    loadLocationsForMilkDistribution();
    initializeGlobalDateSelector();
    loadManagerPendingDistributions();
  }

  if (document.getElementById("employeeDashboard")) {
    loadEmployeeDashboard();
  }

  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
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
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCSRFToken(),
          },
          body: JSON.stringify({ username, password, role }),
        });

        const data = await response.json();

        if (response.ok && data.message === "Login successful") {
          console.log("✅ Login success:", data);

          sessionStorage.setItem("role", data.user.role);
          sessionStorage.setItem("username", data.user.username);
          sessionStorage.setItem("user_id", data.user.user_id);
          sessionStorage.setItem("userData", JSON.stringify(data.user));

          showModal("successModal", "Login successful! Redirecting...");

          setTimeout(() => {
            const userRole = data.user.role;
            if (userRole === "admin") window.location.href = "/admin/";
            else if (userRole === "manager") window.location.href = "/manager/";
            else if (userRole === "employee") window.location.href = "/employee/";
            else if (userRole === "seller") window.location.href = "/seller/";
            else showModal("errorModal", "Unknown user role. Please contact admin.");
          }, 1000); 

        }

        else {
          const errorMsg =
            data.message ||
            data.detail ||
            (data.non_field_errors ? data.non_field_errors[0] : null) ||
            "Invalid credentials or role mismatch.";
          showModal("errorModal", errorMsg);
        }
      } catch (error) {
        console.error("Login error:", error);
        showModal("errorModal", "Could not connect to the server. Please try again later.");
      }
    });
  }


  // --- ALL FORM HANDLERS BELOW ARE NOW WRAPPED IN try...catch ---

  const feedEntryForm = document.getElementById("feedEntryForm");
  if (feedEntryForm) {
    feedEntryForm.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        const form = new FormData(e.target);
        const data = {
          feed_type: form.get("feedType"),
          quantity: parseFloat(form.get("quantity")),
          cost: parseFloat(form.get("cost")),
          date: getSelectedDate(),
        };
        await apiFetch(`${BASE_URL}/manager/feed/`, { method: "POST", body: JSON.stringify(data) });
        showModal("successModal", "Feed entry saved!");
        e.target.reset();
        loadDatewiseData(getSelectedDate());
      } catch (error) {
        showModal("errorModal", error.message);
      }
    });
  }

  const dailyExpenseForm = document.getElementById("dailyExpenseForm");
  if (dailyExpenseForm) {
    dailyExpenseForm.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        const f = new FormData(e.target);
        const data = {
          category: f.get("category"),
          amount: parseFloat(f.get("amount")),
          date: getSelectedDate(),
        };
        await apiFetch(`${BASE_URL}/manager/expense/`, { method: "POST", body: JSON.stringify(data) });
        showModal("successModal", "Expense saved!");
        e.target.reset();
        loadDatewiseData(getSelectedDate());
      } catch (error) {
        showModal("errorModal", error.message);
      }
    });
  }

  const milkDistributionForm = document.getElementById("milkDistributionForm");
  if (milkDistributionForm) {
    milkDistributionForm.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        const f = new FormData(e.target);
        const data = {
          locationId: f.get("locationId"),
          quantity: parseFloat(f.get("quantity")),
          date: getSelectedDate(),
        };
        await apiFetch(`${BASE_URL}/manager/milk-distribution/`, { method: "POST", body: JSON.stringify(data) });
        showModal("successModal", "Milk distribution recorded!");
        e.target.reset();
        loadDatewiseData(getSelectedDate());
        loadManagerPendingDistributions();
      } catch (error) {
        showModal("errorModal", error.message);
      }
    });
  }

  const leftoverMilkForm = document.getElementById("leftoverMilkForm");
  if (leftoverMilkForm) {
    leftoverMilkForm.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        const f = new FormData(e.target);
        const data = {
          leftoverMilk: parseFloat(f.get("leftoverMilk")),
          leftoverSales: parseFloat(f.get("leftoverSales")),
          date: getSelectedDate(),
        };
        await apiFetch(`${BASE_URL}/manager/leftover-milk/`, { method: "POST", body: JSON.stringify(data) });
        showModal("successModal", "Leftover milk data updated!");
        e.target.reset();
        loadDatewiseData(getSelectedDate());
      } catch (error) {
        showModal("errorModal", error.message);
      }
    });
  }

  const miscExpenseForm = document.getElementById("miscExpenseForm");
  if (miscExpenseForm) {
    miscExpenseForm.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        const f = new FormData(e.target);
        const data = {
          category: f.get("category"),
          amount: parseFloat(f.get("amount")),
          date: getSelectedDate(),
        };
        await apiFetch(`${BASE_URL}/misc-expenses/`, { method: "POST", body: JSON.stringify(data) });
        showModal("successModal", "Miscellaneous expense saved!");
        e.target.reset();
        loadDatewiseData(getSelectedDate());
      } catch (error) {
        showModal("errorModal", error.message);
      }
    });
  }

  const medicineForm = document.getElementById("medicineForm");
  if (medicineForm) {
    medicineForm.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        const f = new FormData(e.target);
        const data = {
          medicine_name: f.get("medicineName"),
          cost: parseFloat(f.get("cost")),
          date: getSelectedDate(),
        };
        await apiFetch(`${BASE_URL}/manager/medicine/`, { method: "POST", body: JSON.stringify(data) });
        showModal("successModal", "Medicine purchase recorded!");
        e.target.reset();
        loadDatewiseData(getSelectedDate());
      } catch (error) {
        showModal("errorModal", error.message);
      }
    });
  }

  const addEmployeeForm = document.getElementById("addEmployeeForm");
  if (addEmployeeForm) {
    addEmployeeForm.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        const f = new FormData(e.target);
        const data = {
          username: f.get("username"),
          password: f.get("password"),
          name: f.get("name"),
          base_salary: parseFloat(f.get("baseSalary")),
          manager_id: JSON.parse(sessionStorage.getItem("userData")).manager_id,
        };
        await apiFetch(`${BASE_URL}/manager/employees/add/`, { method: "POST", body: JSON.stringify(data) });
        showModal("successModal", "Employee added!");
        e.target.reset();
        loadEmployees();
      } catch (error) {
        showModal("errorModal", error.message);
      }
    });
  }

  const deductionForm = document.getElementById("deductionForm");
  if (deductionForm) {
    deductionForm.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        const f = new FormData(e.target);
        const data = {
          employeeId: f.get("employeeId"),
          reason: f.get("reason"),
          amount: parseFloat(f.get("amount")),
        };
        await apiFetch(`${BASE_URL}/manager/deductions/`, { method: "POST", body: JSON.stringify(data) });
        showModal("successModal", "Deduction applied!");
        e.target.reset();
      } catch (error) {
        showModal("errorModal", error.message);
      }
    });
  }

  window.markAttendance = async function (employeeId, status) {
    try {
      const date = document.getElementById("attendanceDate")?.value || getCurrentDate();
      const data = { employeeId: employeeId, date, status };
      const response = await apiFetch(`${BASE_URL}/manager/attendance/`, { method: "POST", body: JSON.stringify(data) });
      showModal("successModal", response.message || `Attendance marked ${status}`);
      loadDatewiseData(date);
    } catch (error) {
      showModal("errorModal", error.message);
    }
  };

  const addLocationForm = document.getElementById("addLocationForm");
  if (addLocationForm) {
    addLocationForm.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        const f = new FormData(e.target);
        const loc = {
          location_name: f.get("locationName"),
          address: f.get("address"),
        };
        const location = await apiFetch(`${BASE_URL}/manager/locations/`, { method: "POST", body: JSON.stringify(loc) });
        showModal("successModal", `Location ${location.location_name} added!`);
        e.target.reset();
        loadLocations();
        loadLocationsForMilkDistribution();
      } catch (error) {
        showModal("errorModal", error.message);
      }
    });
  }

  const addSellerForm = document.getElementById("addSellerForm");
  if (addSellerForm) {
    addSellerForm.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        const f = new FormData(e.target);
        const data = {
          username: f.get("sellerUsername"),
          password: f.get("sellerPassword"),
          name: f.get("sellerName"),
          location_id: f.get("locationId"),
        };
        await apiFetch(`${BASE_URL}/manager/sellers/add/`, { method: "POST", body: JSON.stringify(data) });
        showModal("successModal", "Seller added!");
        e.target.reset();
        loadLocations();
      } catch (error) {
        showModal("errorModal", error.message);
      }
    });
  }


  if (document.getElementById("sellerDashboard")) {
    const userData = JSON.parse(sessionStorage.getItem("userData") || "{}");
    document.getElementById("sellerName").textContent = userData.name || "Seller";
    document.getElementById("sellerLocation").textContent = userData.location_name || "N/A";

    const dateSelector = document.getElementById('dateSelector');
    if (dateSelector) {
      dateSelector.value = getCurrentDate();
      dateSelector.addEventListener('change', () => {
        updateDateInputs();
        loadSellerSummary();
      });
    }
    loadSellerSummary();
    loadIncomingRequests();
    loadMyRequests();
    loadBorrowLendHistory();
    loadPendingDistributions();
    updateDateInputs();
  }

  // --- THIS IS THE NEW FORM HANDLER FOR INDIVIDUAL SALES ---
  const customerSaleForm = document.getElementById("customerSaleForm");
  if (customerSaleForm) {
      customerSaleForm.addEventListener("submit", async e => {
          e.preventDefault();
          try {
              const f = new FormData(e.target);
              const data = {
                  customerName: f.get("customerName"),
                  quantity: parseFloat(f.get("quantity")),
                  date: getSelectedDate(),
              };

              // The API now returns the full updated summary
              const newSummary = await apiFetch(`${BASE_URL}/seller/sale/record/`, { 
                  method: "POST", 
                  body: JSON.stringify(data) 
              });
              
              showModal("successModal", "Sale recorded!");
              e.target.reset();
              updateDateInputs();
              
              // Update all stats with the new summary data from the response
              updateSellerSummaryUI(newSummary);

          } catch (error) {
              showModal("errorModal", error.message);
          }
      });
  }

  // --- THIS FORM HANDLER IS RENAMED AND UPDATED ---
  const dailyTotalsForm = document.getElementById("dailyTotalsForm");
  if (dailyTotalsForm) {
    dailyTotalsForm.addEventListener("input", e => {
      const cash = parseFloat(dailyTotalsForm.querySelector('[name="cashEarned"]').value) || 0;
      const online = parseFloat(dailyTotalsForm.querySelector('[name="onlineEarned"]').value) || 0;
      dailyTotalsForm.querySelector('[name="revenue"]').value = (cash + online).toFixed(2);
    });
    dailyTotalsForm.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        const f = new FormData(e.target);
        const data = {
          cashEarned: parseFloat(f.get("cashEarned")),
          onlineEarned: parseFloat(f.get("onlineEarned")),
          revenue: parseFloat(f.get("revenue")),
          date: getSelectedDate(),
        };
        // URL is updated
        await apiFetch(`${BASE_URL}/seller/daily-totals/`, { method: "POST", body: JSON.stringify(data) });
        showModal("successModal", "Daily financial totals recorded!");
        e.target.reset();
        updateDateInputs();
        loadSellerSummary(); // Refresh summary
      } catch (error) {
        showModal("errorModal", error.message);
      }
    });
  }

  const milkRequestForm = document.getElementById("milkRequestForm");
  if (milkRequestForm) {
    milkRequestForm.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        const f = new FormData(e.target);
        const data = {
          quantity: parseFloat(f.get("quantity")),
        };
        await apiFetch(`${BASE_URL}/seller/milk-request/create/`, { method: "POST", body: JSON.stringify(data) });
        showModal("successModal", "Milk request sent!");
        e.target.reset();
        loadMyRequests();
      } catch (error) {
        showModal("errorModal", error.message);
      }
    });
  }

  window.acceptRequest = async function (requestId) {
    try {
      await apiFetch(`${BASE_URL}/seller/milk-request/${requestId}/accept/`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      showModal("successModal", "Request accepted! Status changed to On Hold.");
      loadIncomingRequests();
      loadSellerSummary(); 
    } catch (error) {
      showModal("errorModal", error.message);
    }
  };

  window.markAsReceived = async function (requestId) {
    try {
      await apiFetch(`${BASE_URL}/seller/milk-request/${requestId}/received/`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      showModal("successModal", "Milk marked as received! Transaction completed.");
      const dateSelector = document.getElementById('dateSelector');
      if (dateSelector) {
          dateSelector.value = getCurrentDate();
          updateDateInputs();
      }
      loadMyRequests();
      loadSellerSummary();
      loadBorrowLendHistory();
    } catch (error) {
      showModal("errorModal", error.message);
    }
  };


  function populateTodaySalesTable(sales) {
    const tbody = document.querySelector("#todaySalesTable tbody");
    tbody.innerHTML = "";
    if (!sales || sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999;">No sales recorded yet today.</td></tr>';
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

  // --- NEW FUNCTION TO UPDATE ALL UI ELEMENTS FROM SUMMARY DATA ---
  function updateSellerSummaryUI(summary) {
      document.getElementById("todayRemainingMilk").textContent = summary.remaining_milk;
      document.getElementById("todayMilkReceived").textContent = summary.total_milk_received;
      document.getElementById("todayMilkSold").textContent = summary.total_milk_sold;
      document.getElementById("todayInterSellerMilk").textContent = summary.inter_seller_milk;
      document.getElementById("todayRevenue").textContent = summary.revenue;
      document.getElementById("todayCash").textContent = summary.cash_sales;
      document.getElementById("todayOnline").textContent = summary.online_sales;
      
      // Populate the new sales table
      populateTodaySalesTable(summary.individual_sales);
  }

  async function loadSellerSummary() {
    try {
      const selectedDate = getSelectedDate();
      const summary = await apiFetch(`${BASE_URL}/seller/summary/?date=${selectedDate}`);
      updateSellerSummaryUI(summary); // Use the new helper function
    } catch (error) {
      console.error("Failed to load seller summary:", error);
    }
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
    container.innerHTML = "";
    if (records.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No pending deliveries.</p>';
      return;
    }
    
    records.forEach(record => {
      const card = document.createElement("div");
      card.className = "request-card"; // Reuse existing style
      
      const from = record.manager_name ? `Manager (${record.manager_name})` : 'Farm';
      let statusBadge = '';
      let actionButton = '';

      if (record.status === 'pending') {
          statusBadge = '<span class="badge badge-pending">Pending</span>';
          actionButton = `<button class="btn-secondary btn-success btn-small" onclick="handleStatusUpdate('${record.receipt_id}', 'received')">Mark as Received</button>
                          <button class="btn-secondary btn-danger btn-small" style="margin-left: 5px;" onclick="handleStatusUpdate('${record.receipt_id}', 'not_received')">Not Received</button>`;
      } else { // 'not_received'
          statusBadge = '<span class="badge badge-danger" style="background: #f5c6cb; color: #721c24;">Not Received</span>';
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
          ${actionButton}
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
      populateIncomingRequests(requests);
    } catch (error) {
      console.error("Failed to load incoming requests:", error);
    }
  }

  async function loadMyRequests() {
    try {
      const requests = await apiFetch(`${BASE_URL}/seller/milk-requests/mine/`);
      populateMyRequests(requests);
    } catch (error) {
      console.error("Failed to load my requests:", error);
    }
  }

  function populateIncomingRequests(requests) {
    const container = document.getElementById("incomingRequests");
    container.innerHTML = "";
    if (requests.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No incoming requests</p>';
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
          <button class="btn-secondary btn-success btn-small" style="margin-left: 10px;" onclick="acceptRequest('${request.request_id}')" data-action="acceptRequest" data-request-id="${request.request_id}">Accept</button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  function populateMyRequests(requests) {
    const container = document.getElementById("myRequestsList");
    container.innerHTML = "";
    if (requests.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No requests made yet</p>';
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
        statusBadge = '<span class="badge badge-accepted" style="background: #ffeeba; color: #85640b;">On Hold</span>'; // Adjusted style
        actionButton = `<button class="btn-secondary btn-success btn-small" onclick="markAsReceived('${request.request_id}')">Mark as Received</button>`;
      } else if (request.status === "received") {
        statusBadge = '<span class="badge badge-accepted">Received</span>';
      } else if (request.status === "rejected") {
        statusBadge = '<span class="badge badge-danger" style="background: #f5c6cb; color: #721c24;">Rejected</span>'; // Adjusted style
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
  }


  async function loadManagerPendingDistributions() {
    try {
        const records = await apiFetch(`${BASE_URL}/manager/pending-distributions/`);
        populateManagerPendingDistributions(records);
    } catch (error) {
        console.error("Failed to load manager pending distributions:", error);
    }
  }



  function populateManagerPendingDistributions(records) {
    const container = document.getElementById("managerPendingDistributionsList");
    container.innerHTML = "";
    if (records.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No pending distributions.</p>';
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
        <div>
          <span class="badge badge-pending">Pending</span>
        </div>
      `;
      container.appendChild(card);
    });
  }

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
    tbody.innerHTML = "";
    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999;">No borrow/lend records</td></tr>';
      return;
    }
    history.forEach(record => {
      const row = document.createElement("tr");
      const isSettled = record.status === 'Settled';
      row.innerHTML = `
        <td>${record.date}</td>
        <td>${record.type}</td>
        <td>${record.other_party}</td>
        <td>${record.quantity}</td>
        <td><span class="badge ${isSettled ? 'badge-accepted' : 'badge-pending'}">${record.status}</span></td>
      `;
      tbody.appendChild(row);
    });
  }

  async function loadEmployees() {
    try {
      const employees = await apiFetch(`${BASE_URL}/manager/employees/`);
      populateEmployeeTable(employees);
      populateAttendanceGrid(employees);
      populateEmployeeSelect(employees);
    } catch (error) {
      console.error("Failed to load employees:", error);
      showModal("errorModal", "Failed to load employee data: " + error.message);
    }
  }

  function populateEmployeeTable(employees) {
    const tbody = document.querySelector("#employeeTable tbody");
    tbody.innerHTML = "";
    if (employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999;">No employees added yet</td></tr>';
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
    grid.innerHTML = "";
    if (employees.length === 0) {
      grid.innerHTML = '<p style="text-align: center; color: #999;">No employees to mark attendance for.</p>';
      return;
    }
    employees.forEach(employee => {
      const row = document.createElement("div");
      row.className = "attendance-row";
      row.innerHTML = `
        <div class="attendance-info">
          <h4>${employee.name}</h4>
          <p>Employee ID: ${employee.employee_id} | Base Salary: ₹${employee.base_salary}/day</p>
        </div>
        <div class="attendance-actions">
          <button class="btn-secondary btn-small btn-success" onclick="markAttendance('${employee.employee_id}', 'present')">Present</button>
          <button class="btn-secondary btn-small btn-danger" onclick="markAttendance('${employee.employee_id}', 'absent')">Absent</button>
        </div>
      `;
      grid.appendChild(row);
    });
  }

  window.viewEmployeeDetails = function(employeeId) {
    showModal("successModal", `This is where you would show details for employee ${employeeId}.`);
  };


  async function loadLocations() {
  try {
    const locations = await apiFetch(`${BASE_URL}/manager/locations/`);
    populateLocationGrid(locations);
    populateSellerLocationSelect(locations);
  } catch (error) {
    console.error("Failed to load locations:", error);
    showModal("errorModal", "Failed to load locations: " + error.message);
  }
}

  function populateLocationGrid(locations) {
    const grid = document.getElementById("locationGrid");
    const count = document.getElementById("locationCount");
    grid.innerHTML = "";
    if (locations.length === 0) {
      grid.innerHTML = '<p style="text-align: center; color: #999;">No locations added yet</p>';
      count.textContent = "0";
      return;
    }
    count.textContent = locations.length;

    let totalMilk = 0;

    locations.forEach(location => {
      const card = document.createElement("div");
      card.className = "location-card";
      card.innerHTML = `
        <h4>${location.location_name}</h4>
        <p><strong>Address:</strong> ${location.address}</p>
        <p><strong>Sellers:</strong> ${location.seller_count}</p>
        <p><strong>Total Milk Today:</strong> ${location.milk_received_today}L</p>

      `;
      grid.appendChild(card);

      totalMilk += parseFloat(location.milk_received_today);
    });

    document.getElementById("totalMilkToday").textContent = totalMilk.toFixed(2);
  }

  function populateLocationSelect(locations) {
    const select = document.querySelector('#milkDistributionForm select[name="locationId"]');
    if (!select) return;
    select.innerHTML = '<option value="">Choose location...</option>';
    locations.forEach(location => {
      const option = document.createElement("option");
      option.value = location.location_id;
      option.textContent = location.location_name;
      select.appendChild(option);
    });
  }

  function populateSellerLocationSelect(locations) {
    const select = document.querySelector('#addSellerForm select[name="locationId"]');
    if (!select) return;
    select.innerHTML = '<option value="">Choose location...</option>';
    locations.forEach(location => {
      const option = document.createElement("option");
      option.value = location.location_id;
      option.textContent = `${location.location_name} (${location.address})`;
      select.appendChild(option);
    });
  }

  async function loadLocationsForMilkDistribution() {
    try {
      const locations = await apiFetch(`${BASE_URL}/manager/locations/`);
      populateLocationSelect(locations);
    } catch (error) {
      console.error("Failed to load locations:", error);
      showModal("errorModal", "Failed to load locations for milk distribution: " + error.message);
    }
  }

  async function loadEmployeeDashboard() {
    try {
      const data = await apiFetch(`${BASE_URL}/employee/dashboard/`);
      document.getElementById("daysWorked").textContent = `${data.days_worked} / ${data.total_days}`;
      document.getElementById("attendancePercent").textContent = `${data.attendance_percentage}%`;
      document.getElementById("baseSalary").textContent = data.base_salary;
      document.getElementById("salaryBalance").textContent = `₹${data.salary_balance}`;
      document.getElementById("totalDeductions").textContent = `₹${data.total_deductions}`;
      document.getElementById("finalSalary").textContent = `₹${data.final_salary}`;
      document.getElementById("attendanceProgress").style.width = `${data.attendance_percentage}%`;

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
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999;">No deductions recorded</td></tr>';
      }
    } catch (error) {
      console.error("Failed to load employee dashboard:", error);
      showModal("errorModal", "Failed to load employee dashboard: " + error.message);
    }
  }

  window.viewAttendanceSummary = async function() {
    const container = document.getElementById("attendanceSummaryContainer");
    const tbody = document.querySelector("#attendanceTable tbody");

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
              <td><span class="badge ${statusClass}">${attendance.status.charAt(0).toUpperCase() + attendance.status.slice(1)}</span></td>
            `;
            tbody.appendChild(row);
          });
        } else {
          tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #999;">No attendance records found</td></tr>';
        }
      } catch (error) {
        console.error("Failed to load attendance summary:", error);
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #999;">Failed to load attendance data</td></tr>';
      }
    } else {
      container.style.display = "none";
    }
  };

  async function loadDatewiseData(selectedDate) {
    try {
      const data = await apiFetch(`${BASE_URL}/manager/datewise-data/?date=${selectedDate}`);

      let totalMilk = 0;
      if (data.milk_distribution && data.milk_distribution.length > 0) {
          totalMilk = data.milk_distribution.reduce((acc, dist) => acc + parseFloat(dist.total_milk), 0);
      }
      document.getElementById("dashTodayMilk").textContent = totalMilk.toFixed(2);

      let totalExpenses = 0;

      if (data.feed_records && data.feed_records.length > 0) {
          totalExpenses += data.feed_records.reduce((acc, feed) => acc + parseFloat(feed.cost), 0);
      }

      if (data.expense_records && data.expense_records.length > 0) {
          totalExpenses += data.expense_records.reduce((acc, exp) => acc + parseFloat(exp.amount), 0);
      }
      if (data.medicine_records && data.medicine_records.length > 0) {
          totalExpenses += data.medicine_records.reduce((acc, med) => acc + parseFloat(med.cost), 0);
      }
      document.getElementById("dashTodayExpenses").textContent = totalExpenses.toFixed(2);
      


      initLocationSalesChart(data.daily_totals);
      initExpensePieChart(data.feed_records, data.expense_records, data.medicine_records);
      initMilkUsageChart(data.milk_distribution);


      populateTable('feedRecordsTable', data.feed_records, ['feed_type', 'quantity', 'cost'], ['Feed Type', 'Quantity (kg)', 'Cost (₹)']);
      populateTable('expensesTable', data.expense_records, ['category', 'amount'], ['Category', 'Amount (₹)']);
      populateTable('medicineTable', data.medicine_records, ['medicine_name', 'cost'], ['Medicine Name', 'Cost (₹)']);
      populateTable('milkDistributionTable', data.milk_distribution, ['total_milk', 'leftover_milk', 'leftover_sales'], ['Total Milk (L)', 'Leftover Milk (L)', 'Leftover Sales (₹)']);
      
      populateTable('milkReceivedTable', data.milk_received, 
          ['seller_name', 'quantity', 'source', 'status'], 
          ['Seller Name', 'Quantity (L)', 'Source', 'Status']
      );

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
    if (data.length === 0) {
      const colspan = headers.length;
      tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; color: #999;">No data available</td></tr>`;
      return;
    }
    data.forEach(item => {
      const row = document.createElement("tr");
      fields.forEach(field => {
        const cell = document.createElement("td");
        let value = item[field];
        if (field === 'status') {
            let statusClass = '';
            if (value === 'pending') statusClass = 'badge-pending';
            else if (value === 'received') statusClass = 'badge-accepted';
            else if (value === 'not_received') statusClass = 'badge-danger';
            else statusClass = '';
            
            cell.innerHTML = value ? `<span class="badge ${statusClass}">${value}</span>` : 'N/A';
        }else {
            if (typeof value === 'number' || (!isNaN(parseFloat(value)) && (field.includes('cost') || field.includes('amount') || field.includes('received') || field.includes('sold') || field.includes('revenue') || field.includes('quantity') || field.includes('milk')))) {
                value = parseFloat(value).toFixed(2);
                if (field.includes('cost') || field.includes('amount') || field.includes('received') || field.includes('sold') || field.includes('revenue')) {
                    value = `₹${value}`;
                }
            }
            cell.textContent = value;
        }
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    });
  }

  function initializeGlobalDateSelector() {
    const globalDateSelector = document.getElementById("globalDateSelector");
    if (globalDateSelector) {
      globalDateSelector.value = getCurrentDate();
      globalDateSelector.addEventListener("change", e => {
        const selectedDate = e.target.value;
        if (selectedDate) {
          updateDateInputs();
          loadDailyDataForDate(selectedDate);
          loadDatewiseData(selectedDate);
        }
      });
      loadManagerCardStats();
      loadSalesTrendChart();
      const today = getCurrentDate();
      loadDailyDataForDate(today);
      loadDatewiseData(today);
    }
  }

  async function loadDailyDataForDate(selectedDate) {
    try {
      const data = await apiFetch(`${BASE_URL}/manager/daily-data/?date=${selectedDate}`);

      const resetForm = (form) => {
          if (form) {
            form.reset();
            form.querySelector('input[type="hidden"][name="recordId"]')?.setAttribute('value', '');
            form.querySelector('input[type="hidden"][name="date"]')?.setAttribute('value', selectedDate);
          }
      };
      
      const populateForm = (form, record, idField) => {
          if (form && record) {
              form.querySelector(`input[type="hidden"][name="recordId"]`).value = record[idField];
              for (const key in record) {
                  const input = form.querySelector(`[data-field="${key}"]`);
                  if (input) {
                      input.value = record[key];
                  }
              }
          } else {
              resetForm(form);
          }
      };

      const feedForm = document.getElementById("feedEntryForm");
      if (data.feed_records && data.feed_records.length > 0) {
          populateForm(feedForm, data.feed_records[0], 'feed_id');
      } else {
          resetForm(feedForm);
      }

      const dailyExpenseForm = document.getElementById("dailyExpenseForm");
      if (data.expense_records && data.expense_records.length > 0) {
          const dailyExpense = data.expense_records.find(r => r.category !== 'Miscellaneous' && r.category !== 'Medicine');
          populateForm(dailyExpenseForm, dailyExpense, 'expense_id');
      } else {
          resetForm(dailyExpenseForm);
      }

      const medicineForm = document.getElementById("medicineForm");
      if (data.medicine_records && data.medicine_records.length > 0) {
          populateForm(medicineForm, data.medicine_records[0], 'medicine_id');
      } else {
          resetForm(medicineForm);
      }

      const leftoverMilkForm = document.getElementById("leftoverMilkForm");
      if (data.milk_distribution && data.milk_distribution.length > 0) {
          populateForm(leftoverMilkForm, data.milk_distribution[0], 'distribution_id');
      } else {
          resetForm(leftoverMilkForm);
      }
      
 
    } catch (error) {
      console.error("Failed to load daily data:", error);
      showModal("errorModal", "Failed to load form data for selected date: " + error.message);
    }
  }
  
  document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
          if (e.target === modal) {
              closeModal();
          }
      });
  });
  
});


async function loadManagerCardStats() {
    try {
        const [employees, locations] = await Promise.all([
            apiFetch(`${BASE_URL}/manager/employees/`),
            apiFetch(`${BASE_URL}/manager/locations/`)
        ]);
        
        document.getElementById("dashTotalEmployees").textContent = employees.length;
        document.getElementById("dashTotalLocations").textContent = locations.length;

    } catch (error) {
        console.error("Failed to load manager card stats:", error);
    }
}



// --- ADD THESE FOUR NEW FUNCTIONS ---

function initLocationSalesChart(dailyTotals) {
    const ctx = document.getElementById('locationSalesChart').getContext('2d');
    
    // Process data: Group sales by location
    const salesByLocation = dailyTotals.reduce((acc, sale) => {
        const location = sale.location_name || 'Unknown';
        if (!acc[location]) {
            acc[location] = 0;
        }
        acc[location] += parseFloat(sale.revenue);
        return acc;
    }, {});

    const labels = Object.keys(salesByLocation);
    const data = Object.values(salesByLocation);

    if (locationSalesChart) {
        locationSalesChart.destroy();
    }
    locationSalesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Revenue (₹)',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            responsive: true
        }
    });
}

function initExpensePieChart(feed, expenses, medicine) {
    const ctx = document.getElementById('expensePieChart').getContext('2d');
    
    const categories = {};

    feed.forEach(item => {
        const category = item.feed_type || 'Feed (Uncategorized)';
        const cost = parseFloat(item.cost);
        if (!categories[category]) {
            categories[category] = 0;
        }
        categories[category] += cost;
    });

    expenses.forEach(item => {
        const category = item.category || 'Other Expense';
        const cost = parseFloat(item.amount);
        if (!categories[category]) {
            categories[category] = 0;
        }
        categories[category] += cost;
    });

    medicine.forEach(item => {
        const category = item.medicine_name || 'Medicine (Uncategorized)';
        const cost = parseFloat(item.cost);
        if (!categories[category]) {
            categories[category] = 0;
        }
        categories[category] += cost;
    });

    const labels = Object.keys(categories);
    const data = Object.values(categories);

    const backgroundColors = labels.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]);

    if (expensePieChart) {
        expensePieChart.destroy();
    }
    
    expensePieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: labels.length > 0,
                    position: 'top',
                }
            }
        }
    });
}

function initMilkUsageChart(milkDistribution) {
    const ctx = document.getElementById('milkUsageChart').getContext('2d');
    
    const record = milkDistribution[0] || { total_milk: 0, leftover_milk: 0 };
    const totalMilk = parseFloat(record.total_milk);
    const leftoverMilk = parseFloat(record.leftover_milk);
    const distributedMilk = totalMilk - leftoverMilk;

    if (milkUsageChart) {
        milkUsageChart.destroy();
    }
    milkUsageChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Milk Distributed', 'Milk Leftover'],
            datasets: [{
                data: [distributedMilk, leftoverMilk],
                backgroundColor: [
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(201, 203, 207, 0.7)'
                ]
            }]
        },
        options: {
            responsive: true
        }
    });
}

async function loadSalesTrendChart() {
    try {
        const trendData = await apiFetch(`${BASE_URL}/manager/sales-trend/`);
        const ctx = document.getElementById('salesTrendChart').getContext('2d');

        const labels = trendData.map(item => item.day);
        const data = trendData.map(item => item.daily_revenue);

        if (salesTrendChart) {
            salesTrendChart.destroy();
        }
        salesTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue (₹)',
                    data: data,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true
            }
        });
    } catch (error) {
        console.error("Failed to load sales trend:", error);
    }
}