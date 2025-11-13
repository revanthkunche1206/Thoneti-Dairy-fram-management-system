from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, Manager, Employee, Seller, Admin, Location,
    DailyOperations, FeedRecord, ExpenseRecord, MedicineRecord,
    MilkReceived, MilkDistribution, Attendance, Salary, Deduction,
    DailyTotal, Sale, MilkRequest, BorrowLendRecord, Notification
)


# -------------------------------------------------------
# User Admin
# -------------------------------------------------------
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'role', 'is_active', 'is_admin', 'created_at')
    list_filter = ('role', 'is_active', 'is_admin')
    search_fields = ('username',)
    ordering = ('-created_at',)
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Role & Status', {'fields': ('role', 'is_active', 'is_admin')}),
        ('Important dates', {'fields': ('last_login',)}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'password1', 'password2', 'role', 'is_active', 'is_admin'),
        }),
    )


# -------------------------------------------------------
# Manager Admin
# -------------------------------------------------------
@admin.register(Manager)
class ManagerAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at')
    search_fields = ('name', 'user__username')


# -------------------------------------------------------
# Employee Admin
# -------------------------------------------------------
@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('name', 'manager', 'base_salary', 'is_active', 'created_at')
    list_filter = ('is_active', 'manager')
    search_fields = ('name', 'manager__name')
    ordering = ('-created_at',)


# -------------------------------------------------------
# Seller Admin
# -------------------------------------------------------
@admin.register(Seller)
class SellerAdmin(admin.ModelAdmin):
    list_display = ('name', 'location', 'is_active', 'created_at')
    list_filter = ('is_active', 'location')
    search_fields = ('name', 'location__location_name')
    ordering = ('-created_at',)


# -------------------------------------------------------
# Admin Profile
# -------------------------------------------------------
@admin.register(Admin)
class AdminProfileAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at')
    search_fields = ('name', 'user__username')


# -------------------------------------------------------
# Location Admin
# -------------------------------------------------------
@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ('location_name', 'address', 'created_at')
    search_fields = ('location_name', 'address')
    ordering = ('location_name',)


# -------------------------------------------------------
# Daily Operations and Related Records
# -------------------------------------------------------
class FeedRecordInline(admin.TabularInline):
    model = FeedRecord
    extra = 0


class ExpenseRecordInline(admin.TabularInline):
    model = ExpenseRecord
    extra = 0


class MedicineRecordInline(admin.TabularInline):
    model = MedicineRecord
    extra = 0


@admin.register(DailyOperations)
class DailyOperationsAdmin(admin.ModelAdmin):
    list_display = ('manager', 'date', 'created_at')
    inlines = [FeedRecordInline, ExpenseRecordInline, MedicineRecordInline]
    ordering = ('-date',)
    search_fields = ('manager__name',)


# -------------------------------------------------------
# Milk & Distribution
# -------------------------------------------------------
@admin.register(MilkReceived)
class MilkReceivedAdmin(admin.ModelAdmin):
    list_display = ('seller', 'quantity', 'date', 'status', 'source', 'manager', 'created_at')
    list_filter = ('seller', 'date', 'status', 'source')
    search_fields = ('seller__name',)
    ordering = ('-date',)


@admin.register(MilkDistribution)
class MilkDistributionAdmin(admin.ModelAdmin):
    list_display = ('date', 'total_milk', 'leftover_milk', 'leftover_sales', 'record')
    ordering = ('-date',)
    list_filter = ('date',)


# -------------------------------------------------------
# Attendance & Salary
# -------------------------------------------------------
@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('employee', 'date', 'status', 'created_at')
    list_filter = ('status', 'date')
    search_fields = ('employee__name',)
    ordering = ('-date',)


class DeductionInline(admin.TabularInline):
    model = Deduction
    extra = 0


@admin.register(Salary)
class SalaryAdmin(admin.ModelAdmin):
    list_display = ('employee', 'month', 'base_salary', 'total_deductions', 'final_salary', 'days_worked')
    list_filter = ('month',)
    search_fields = ('employee__name',)
    inlines = [DeductionInline]


# -------------------------------------------------------
# Seller Sales, Requests & Borrow/Lend
# -------------------------------------------------------
@admin.register(DailyTotal)
class DailyTotalAdmin(admin.ModelAdmin):
    list_display = ('seller', 'date', 'revenue', 'cash_sales', 'online_sales')
    list_filter = ('date',)
    search_fields = ('seller__name',)
    ordering = ('-date',)


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ('seller', 'date', 'customer_name', 'quantity', 'total_amount')
    ordering = ('-date',)
    list_filter = ('date', 'seller')
    search_fields = ('seller__name', 'customer_name')


@admin.register(MilkRequest)
class MilkRequestAdmin(admin.ModelAdmin):
    list_display = ('from_seller', 'to_seller', 'quantity', 'status', 'created_at')
    list_filter = ('status',)
    ordering = ('-created_at',)


@admin.register(BorrowLendRecord)
class BorrowLendRecordAdmin(admin.ModelAdmin):
    list_display = ('borrower_seller', 'lender_seller', 'quantity', 'borrow_date', 'settled')
    list_filter = ('settled',)
    search_fields = ('borrower_seller__name', 'lender_seller__name')


# -------------------------------------------------------
# Notifications
# -------------------------------------------------------
@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'message', 'timestamp', 'is_read')
    list_filter = ('is_read',)
    search_fields = ('user__username', 'message')
    ordering = ('-timestamp',)