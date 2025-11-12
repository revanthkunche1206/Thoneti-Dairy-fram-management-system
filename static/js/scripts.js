const BASE_URL = "/api";

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
  if (!res.ok) {
    const err = await res.text();
    console.error("API error:", err);
    showModal("errorModal", "Error: " + err);
    throw new Error(err);
  }
  return res.json();
}

document.addEventListener("DOMContentLoaded", () => {
  setTodayDates();

  if (document.getElementById("managerDashboard")) {
    loadEmployees();
    loadLocations();
    loadLocationsForMilkDistribution();
    initializeGlobalDateSelector();
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
            "Invalid credentials or role mismatch.";
          showModal("errorModal", errorMsg);
        }
      } catch (error) {
        console.error("Login error:", error);
        showModal("errorModal", "Could not connect to the server. Please try again later.");
      }
    });
  }




  const feedEntryForm = document.getElementById("feedEntryForm");
  if (feedEntryForm) {
    feedEntryForm.addEventListener("submit", async e => {
      e.preventDefault();
      const form = new FormData(e.target);
      const data = {
        feed_type: form.get("feedType"),
        quantity: parseFloat(form.get("quantity")),
        cost: parseFloat(form.get("cost")),
        date: getCurrentDate(),
      };
      await apiFetch(`${BASE_URL}/manager/feed/`, { method: "POST", body: JSON.stringify(data) });
      alert("Feed entry saved!");
      e.target.reset();
      window.location.reload();
    });
  }

  const dailyExpenseForm = document.getElementById("dailyExpenseForm");
  if (dailyExpenseForm) {
    dailyExpenseForm.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = {
        category: f.get("category"),
        amount: parseFloat(f.get("amount")),
        date: getCurrentDate(),
      };
      await apiFetch(`${BASE_URL}/manager/expense/`, { method: "POST", body: JSON.stringify(data) });
      alert("Expense saved!");
      e.target.reset();
      window.location.reload();
    });
  }

  const milkDistributionForm = document.getElementById("milkDistributionForm");
  if (milkDistributionForm) {
    milkDistributionForm.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = {
        locationId: f.get("locationId"),
        quantity: parseFloat(f.get("quantity")),
        date: getCurrentDate(),
      };
      await apiFetch(`${BASE_URL}/manager/milk-distribution/`, { method: "POST", body: JSON.stringify(data) });
      alert("Milk distribution recorded!");
      e.target.reset();
      window.location.reload();
    });
  }

  const leftoverMilkForm = document.getElementById("leftoverMilkForm");
  if (leftoverMilkForm) {
    leftoverMilkForm.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = {
        leftoverMilk: parseFloat(f.get("leftoverMilk")),
        leftoverSales: parseFloat(f.get("leftoverSales")),
        date: getCurrentDate(),
      };
      await apiFetch(`${BASE_URL}/manager/leftover-milk/`, { method: "POST", body: JSON.stringify(data) });
      alert("Leftover milk data updated!");
      e.target.reset();
      window.location.reload();
    });
  }

  const miscExpenseForm = document.getElementById("miscExpenseForm");
  if (miscExpenseForm) {
    miscExpenseForm.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = {
        category: f.get("category"),
        amount: parseFloat(f.get("amount")),
        date: getCurrentDate(),
      };
      await apiFetch(`${BASE_URL}/misc-expenses/`, { method: "POST", body: JSON.stringify(data) });
      alert("Miscellaneous expense saved!");
      e.target.reset();
      window.location.reload();
    });
  }

  const medicineForm = document.getElementById("medicineForm");
  if (medicineForm) {
    medicineForm.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = {
        medicine_name: f.get("medicineName"),
        cost: parseFloat(f.get("cost")),
        date: getCurrentDate(),
      };
      await apiFetch(`${BASE_URL}/manager/medicine/`, { method: "POST", body: JSON.stringify(data) });
      alert("Medicine purchase recorded!");
      e.target.reset();
      window.location.reload();
    });
  }

  const addEmployeeForm = document.getElementById("addEmployeeForm");
  if (addEmployeeForm) {
    addEmployeeForm.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = {
        username: f.get("username"),
        password: f.get("password"),
        name: f.get("name"),
        base_salary: parseFloat(f.get("baseSalary")),
        manager_id: sessionStorage.getItem("user_id"),
      };
      await apiFetch(`${BASE_URL}/manager/employees/add/`, { method: "POST", body: JSON.stringify(data) });
      alert("Employee added!");
      e.target.reset();
      loadEmployees();
      window.location.reload();
    });
  }

  const deductionForm = document.getElementById("deductionForm");
  if (deductionForm) {
    deductionForm.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = {
        employeeId: f.get("employeeId"),
        reason: f.get("reason"),
        amount: parseFloat(f.get("amount")),
      };
      await apiFetch(`${BASE_URL}/manager/deductions/`, { method: "POST", body: JSON.stringify(data) });
      alert("Deduction applied!");
      e.target.reset();
      window.location.reload();
    });
  }

  window.markAttendance = async function (employeeId, status) {
    const date = document.getElementById("attendanceDate")?.value || getCurrentDate();
    const data = { employeeId: employeeId, date, status };
    await apiFetch(`${BASE_URL}/manager/attendance/`, { method: "POST", body: JSON.stringify(data) });
    alert(`Attendance marked ${status} for ${employeeId}`);
    window.location.reload();
  };

  const addLocationForm = document.getElementById("addLocationForm");
  if (addLocationForm) {
    addLocationForm.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const loc = {
        location_name: f.get("locationName"),
        address: f.get("address"),
      };
      const location = await apiFetch(`${BASE_URL}/manager/locations/`, { method: "POST", body: JSON.stringify(loc) });
      alert(`Location ${location.location_name} added!`);
      e.target.reset();
      loadLocations();
      window.location.reload();
    });
  }

  const addSellerForm = document.getElementById("addSellerForm");
  if (addSellerForm) {
    addSellerForm.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = {
        username: f.get("sellerUsername"),
        password: f.get("sellerPassword"),
        name: f.get("sellerName"),
        location_id: f.get("locationId"),
      };
      await apiFetch(`${BASE_URL}/manager/sellers/add/`, { method: "POST", body: JSON.stringify(data) });
      alert("Seller added!");
      e.target.reset();
      loadSellers();
      window.location.reload();
    });
  }


  if (document.getElementById("sellerDashboard")) {
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
  }

  const milkReceivedForm = document.getElementById("milkReceivedForm");
  if (milkReceivedForm) {
    milkReceivedForm.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = {
        quantity: parseFloat(f.get("quantity")),
        date: getSelectedDate(),
      };
      await apiFetch(`${BASE_URL}/seller/milk-received/`, { method: "POST", body: JSON.stringify(data) });
      alert("Milk received recorded!");
      e.target.reset();
      updateDateInputs();
      loadSellerSummary();
      window.location.reload();
    });
  }

  const dailySalesForm = document.getElementById("dailySalesForm");
  if (dailySalesForm) {
    dailySalesForm.addEventListener("input", e => {
      const cash = parseFloat(dailySalesForm.querySelector('[name="cashEarned"]').value) || 0;
      const online = parseFloat(dailySalesForm.querySelector('[name="onlineEarned"]').value) || 0;
      dailySalesForm.querySelector('[name="revenue"]').value = cash + online;
    });
    dailySalesForm.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = {
        cashEarned: parseFloat(f.get("cashEarned")),
        onlineEarned: parseFloat(f.get("onlineEarned")),
        revenue: parseFloat(f.get("revenue")),
        date: getSelectedDate(),
      };
      await apiFetch(`${BASE_URL}/seller/sales/`, { method: "POST", body: JSON.stringify(data) });
      alert("Daily sales recorded!");
      e.target.reset();
      updateDateInputs();
      loadSellerSummary();
      window.location.reload();
    });
  }

  const milkRequestForm = document.getElementById("milkRequestForm");
  if (milkRequestForm) {
    milkRequestForm.addEventListener("submit", async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const data = {
        quantity: parseFloat(f.get("quantity")),
      };
      await apiFetch(`${BASE_URL}/seller/milk-request/create/`, { method: "POST", body: JSON.stringify(data) });
      alert("Milk request sent!");
      e.target.reset();
      window.location.reload();
    });
  }

  window.acceptRequest = async function (requestId) {
    await apiFetch(`${BASE_URL}/seller/milk-request/${requestId}/accept/`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    alert("Request accepted! Status changed to On Hold.");
    loadIncomingRequests();
    window.location.reload();
  };

  window.markAsReceived = async function (requestId) {
    await apiFetch(`${BASE_URL}/seller/milk-request/${requestId}/received/`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    alert("Milk marked as received! Transaction completed.");
    loadMyRequests();
    loadSellerSummary();
  };

  async function loadSellerSummary() {
    try {
      const selectedDate = getSelectedDate();
      const summary = await apiFetch(`${BASE_URL}/seller/summary/?date=${selectedDate}`);
      document.getElementById("todayMilkReceived").textContent = summary.milk_received;
      document.getElementById("todayInterSellerMilk").textContent = summary.inter_seller_milk;
      document.getElementById("todayRevenue").textContent = summary.revenue;
      document.getElementById("todayCash").textContent = summary.total_received;
      document.getElementById("todayOnline").textContent = summary.total_sold;
    } catch (error) {
      console.error("Failed to load seller summary:", error);
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
          <h4>Request from ${request.from_seller_name}</h4>
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
        statusBadge = '<span class="badge badge-on-hold">On Hold</span>';
        actionButton = `<button class="btn-secondary btn-success btn-small" onclick="markAsReceived('${request.request_id}')">Mark as Received</button>`;
      } else if (request.status === "received") {
        statusBadge = '<span class="badge badge-received">Received</span>';
      } else if (request.status === "rejected") {
        statusBadge = '<span class="badge badge-rejected">Rejected</span>';
      }

      card.innerHTML = `
        <div class="request-info">
          <h4>Request #${request.request_id.slice(0, 8)}</h4>
          <p><strong>Quantity:</strong> ${request.quantity} Liters</p>
          <p><strong>Date:</strong> ${new Date(request.created_at).toLocaleDateString()}</p>
          ${request.to_seller_name ? `<p><strong>Accepted by:</strong> ${request.to_seller_name}</p>` : ''}
        </div>
        <div>
          ${statusBadge}
          ${actionButton}
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
      row.innerHTML = `
        <td>${record.date}</td>
        <td>${record.type}</td>
        <td>${record.other_party}</td>
        <td>${record.quantity}</td>
        <td><span class="badge ${record.status === 'Settled' ? 'badge-success' : 'badge-pending'}">${record.status}</span></td>
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
    alert(`Viewing details for employee ${employeeId}`);
  };


  async function loadLocations() {
  try {
    const locations = await apiFetch(`${BASE_URL}/manager/locations/`);
    populateLocationGrid(locations);
    populateSellerLocationSelect(locations);
  } catch (error) {
    console.error("Failed to load locations:", error);
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
            row.innerHTML = `
              <td>${new Date(attendance.date).toLocaleDateString()}</td>
              <td><span class="badge ${attendance.status === 'present' ? 'badge-success' : 'badge-danger'}">${attendance.status.charAt(0).toUpperCase() + attendance.status.slice(1)}</span></td>
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

      populateTable('feedRecordsTable', data.feed_records, ['feed_type', 'quantity', 'cost'], ['Feed Type', 'Quantity (kg)', 'Cost (₹)']);

      populateTable('expensesTable', data.expense_records, ['category', 'amount'], ['Category', 'Amount (₹)']);

      populateTable('medicineTable', data.medicine_records, ['medicine_name', 'cost'], ['Medicine Name', 'Cost (₹)']);

      populateTable('milkDistributionTable', data.milk_distribution, ['total_milk', 'leftover_milk', 'leftover_sales'], ['Total Milk (L)', 'Leftover Milk (L)', 'Leftover Sales (₹)']);

      populateTable('milkReceivedTable', data.milk_received, ['seller_name', 'quantity', 'source'], ['Seller Name', 'Quantity (L)', 'Source']);

      populateTable('dailyTotalsTable', data.daily_totals, ['seller_name', 'total_received', 'total_sold', 'revenue'], ['Seller Name', 'Total Received (₹)', 'Total Sold (₹)', 'Revenue (₹)']);

      populateTable('attendanceTable', data.attendance, ['employee_name', 'status'], ['Employee Name', 'Status']);

    } catch (error) {
      console.error("Failed to load datewise data:", error);
      alert("Failed to load data for the selected date.");
    }
  }

  function populateTable(tableId, data, fields, headers) {
    const tbody = document.querySelector(`#${tableId} tbody`);
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
        if (field.includes('cost') || field.includes('amount') || field.includes('received') || field.includes('sold') || field.includes('revenue')) {
          value = `₹${parseFloat(value).toFixed(2)}`;
        } else if (field.includes('quantity') || field.includes('milk')) {
          value = `${parseFloat(value).toFixed(2)}`;
        }
        cell.textContent = value;
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
      loadDailyDataForDate(getCurrentDate());
      loadDatewiseData(getCurrentDate());
    }
  }

  async function loadDailyDataForDate(selectedDate) {
    try {
      const data = await apiFetch(`${BASE_URL}/manager/daily-data/?date=${selectedDate}`);

      if (data.feed_records && data.feed_records.length > 0) {
        const feedRecord = data.feed_records[0]; 
        const feedForm = document.getElementById("feedEntryForm");
        if (feedForm) {
          feedForm.querySelector('[name="recordId"]').value = feedRecord.feed_id;
          feedForm.querySelector('[name="feedType"]').value = feedRecord.feed_type;
          feedForm.querySelector('[name="quantity"]').value = feedRecord.quantity;
          feedForm.querySelector('[name="cost"]').value = feedRecord.cost;
        }
      } else {
        const feedForm = document.getElementById("feedEntryForm");
        if (feedForm) {
          feedForm.querySelector('[name="recordId"]').value = '';
          feedForm.reset();
        }
      }

      const dailyExpenseForm = document.getElementById("dailyExpenseForm");
      if (dailyExpenseForm && data.expense_records) {
        const dailyExpenses = data.expense_records.filter(record => record.category !== 'Miscellaneous' && record.category !== 'Medicine');
        if (dailyExpenses.length > 0) {
          const expenseRecord = dailyExpenses[0];
          dailyExpenseForm.querySelector('[name="recordId"]').value = expenseRecord.expense_id;
          dailyExpenseForm.querySelector('[name="category"]').value = expenseRecord.category;
          dailyExpenseForm.querySelector('[name="amount"]').value = expenseRecord.amount;
        } else {
          dailyExpenseForm.querySelector('[name="recordId"]').value = '';
          dailyExpenseForm.reset();
        }
      }

      const medicineForm = document.getElementById("medicineForm");
      if (medicineForm && data.medicine_records && data.medicine_records.length > 0) {
        const medicineRecord = data.medicine_records[0];
        medicineForm.querySelector('[name="recordId"]').value = medicineRecord.medicine_id;
        medicineForm.querySelector('[name="medicineName"]').value = medicineRecord.medicine_name;
        medicineForm.querySelector('[name="cost"]').value = medicineRecord.cost;
      } else {
        if (medicineForm) {
          medicineForm.querySelector('[name="recordId"]').value = '';
          medicineForm.reset();
        }
      }

      const leftoverMilkForm = document.getElementById("leftoverMilkForm");
      if (leftoverMilkForm && data.milk_distribution && data.milk_distribution.length > 0) {
        const milkDist = data.milk_distribution[0];
        leftoverMilkForm.querySelector('[name="recordId"]').value = milkDist.distribution_id;
        leftoverMilkForm.querySelector('[name="leftoverMilk"]').value = milkDist.leftover_milk;
        leftoverMilkForm.querySelector('[name="leftoverSales"]').value = milkDist.leftover_sales;
      } else {
        if (leftoverMilkForm) {
          leftoverMilkForm.querySelector('[name="recordId"]').value = '';
          leftoverMilkForm.reset();
        }
      }

      const miscExpenseForm = document.getElementById("miscExpenseForm");
      if (miscExpenseForm && data.expense_records) {
        const miscExpenses = data.expense_records.filter(record => record.category === 'Miscellaneous' || record.category === 'Medicine');
        if (miscExpenses.length > 0) {
          const miscRecord = miscExpenses[0];
          miscExpenseForm.querySelector('[name="recordId"]').value = miscRecord.expense_id;
          miscExpenseForm.querySelector('[name="category"]').value = miscRecord.category;
          miscExpenseForm.querySelector('[name="amount"]').value = miscRecord.amount;
        } else {
          miscExpenseForm.querySelector('[name="recordId"]').value = '';
          miscExpenseForm.reset();
        }
      }

    } catch (error) {
      console.error("Failed to load daily data:", error);
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