from django.db import models, IntegrityError, transaction
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone
# from django.db.models.signals import post_save
# from django.dispatch import receiver
import uuid
from decimal import Decimal

class UserManager(BaseUserManager):
    def create_user(self, username, password=None, role='employee'):
        if not username:
            raise ValueError('Users must have a username')
        user, created = self.model.objects.get_or_create(username=username, defaults={'role': role})
        if not created:
            raise ValueError(f'A user with username "{username}" already exists.')
        user.set_password(password)
        if role == 'admin':
            user.is_staff = True
            user.is_admin = True
            user.is_superuser = True
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None):
        user = self.create_user(username, password, role='admin')
        user.is_admin = True
        user.is_superuser = True
        user.is_staff = True
        user.save(using=self._db)
        return user



class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('manager', 'Manager'),
        ('employee', 'Employee'),
        ('seller', 'Seller'),
        ('admin', 'Admin'),
    ]

    user_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=100, unique=True)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=True)
    is_admin = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    last_login_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'username'

    def __str__(self):
        return f"{self.username} ({self.role})"

    class Meta:
        db_table = 'user'



class Manager(models.Model):
    manager_id = models.CharField(max_length=10, primary_key=True, unique=True, editable=False, blank=True)
    name = models.CharField(max_length=255)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='manager_profile')
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.manager_id:
            last_manager = Manager.objects.order_by('-manager_id').first()
            if last_manager and last_manager.manager_id.startswith('manager'):
                try:
                    num = int(last_manager.manager_id[7:]) + 1 # 'manager' is 7 chars
                    self.manager_id = f'manager{num:03d}'
                except ValueError:
                    self.manager_id = 'manager001'
            else:
                self.manager_id = 'manager001'
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'manager'


class Location(models.Model):
    location_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    location_name = models.CharField(max_length=255)
    address = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.location_name

    class Meta:
        db_table = 'location'


class Seller(models.Model):
    seller_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name='sellers')
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='seller_profile')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.location.location_name}"

    class Meta:
        db_table = 'seller'


class Employee(models.Model):
    id = models.AutoField(primary_key=True)
    employee_id = models.CharField(max_length=6, unique=True, blank=True, editable=False)
    name = models.CharField(max_length=255)
    base_salary = models.DecimalField(max_digits=10, decimal_places=2)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employee_profile')
    manager = models.ForeignKey(Manager, on_delete=models.CASCADE, related_name='employees')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # def save(self, *args, **kwargs):
    #     if not self.employee_id:
    #         last_employee = Employee.objects.order_by('-employee_id').first()
    #         if last_employee and last_employee.employee_id.startswith('EMP'):
    #             try:
    #                 num = int(last_employee.employee_id[3:]) + 1
    #                 self.employee_id = f'EMP{num:03d}'
    #             except ValueError:
    #                 self.employee_id = 'EMP001'
    #         else:
    #             self.employee_id = 'EMP001'
    #     super().save(*args, **kwargs)

    def save(self, *args, **kwargs):
     if not self.employee_id:
        # Use a transaction to prevent race conditions
        with transaction.atomic():
            # Lock the Employee table for reading to find the last ID
            last_employee = Employee.objects.select_for_update().order_by('-employee_id').first()

            if last_employee and last_employee.employee_id.startswith('EMP'):
                try:
                    num = int(last_employee.employee_id[3:]) + 1
                    self.employee_id = f'EMP{num:03d}'
                except ValueError:
                    # Fallback in case of unexpected ID format
                    self.employee_id = 'EMP001'
            else:
                # No employees exist yet, start from 001
                self.employee_id = 'EMP001'

    # Save the instance *after* the transaction block is complete
     super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'employee'


class Admin(models.Model):
    admin_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='admin_profile')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'admin'


class DailyOperations(models.Model):
    record_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField()
    manager = models.ForeignKey(Manager, on_delete=models.CASCADE, related_name='daily_operations')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Daily Operations - {self.date}"

    class Meta:
        db_table = 'dailyoperations'
        unique_together = ['date', 'manager']


class FeedRecord(models.Model):
    feed_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField()
    feed_type = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    cost = models.DecimalField(max_digits=10, decimal_places=2)
    record = models.ForeignKey(DailyOperations, on_delete=models.CASCADE, related_name='feed_records')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.feed_type} - {self.date}"

    class Meta:
        db_table = 'feedrecord'


class ExpenseRecord(models.Model):
    expense_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField()
    category = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    record = models.ForeignKey(DailyOperations, on_delete=models.CASCADE, related_name='expense_records')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.category} - ₹{self.amount}"

    class Meta:
        db_table = 'expenserecord'


class MedicineRecord(models.Model):
    medicine_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField()
    medicine_name = models.CharField(max_length=255)
    cost = models.DecimalField(max_digits=10, decimal_places=2)
    record = models.ForeignKey(DailyOperations, on_delete=models.CASCADE, related_name='medicine_records')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.medicine_name} - {self.date}"

    class Meta:
        db_table = 'medicinerecord'


class MilkDistribution(models.Model):
    distribution_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date = models.DateField()
    total_milk = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    leftover_milk = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    leftover_sales = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    record = models.ForeignKey(DailyOperations, on_delete=models.CASCADE, related_name='milk_distribution')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Distribution - {self.date}"

    class Meta:
        db_table = 'milkdistribution'


class Attendance(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
    ]

    attendance_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.employee.name} - {self.date} - {self.status}"

    class Meta:
        db_table = 'attendance'
        unique_together = ['employee', 'date']


class Salary(models.Model):
    salary_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='salaries')
    month = models.CharField(max_length=7)  # Format: YYYY-MM
    base_salary = models.DecimalField(max_digits=10, decimal_places=2)
    total_deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    final_salary = models.DecimalField(max_digits=10, decimal_places=2)
    days_worked = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def calculate_final_salary(self):
        self.final_salary = (Decimal(self.base_salary) * Decimal(self.days_worked)) - Decimal(self.total_deductions)

    def __str__(self):
        return f"{self.employee.name} - {self.month}"

    class Meta:
        db_table = 'salary'
        unique_together = ['employee', 'month']


class Deduction(models.Model):
    deduction_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    salary = models.ForeignKey(Salary, on_delete=models.CASCADE, related_name='deductions')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Deduction - ₹{self.amount}"

    class Meta:
        db_table = 'deduction'


class MilkReceived(models.Model):
    receipt_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name='milk_received')
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    source = models.CharField(max_length=50, default='farm')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.seller.name} - {self.quantity}L on {self.date}"

    class Meta:
        db_table = 'milkreceived'


# @receiver(post_save, sender=MilkReceived)
# def update_milk_distribution_totals(sender, instance, created, **kwargs):
#     """
#     Updates MilkDistribution totals whenever a MilkReceived record is created.
#     This ensures totals are updated from all sources: manager distribution, seller recording, inter-seller transactions.
#     """
#     if created:
#         from .utils import get_or_create_daily_operations, update_milk_distribution_totals
#         # Find the manager for this seller's location
#         # Assuming each location has one manager, but since manager is per user, we need to get the manager who manages this location
#         # For now, we'll assume the manager is the one who has daily operations on this date
#         # But to make it general, we can get all managers and update their daily operations if they have sellers in this location
#         # Actually, since MilkDistribution is per manager per date, we need to update for the manager who manages this seller's location

#         # Get the manager who manages employees in this location? Wait, manager manages employees, not locations directly.
#         # Looking at the model, Manager has employees, but locations are separate.
#         # Perhaps we need to assume there's one manager per system, or find the manager who has daily operations on this date.

#         # For simplicity, since the system seems to have one manager, we'll get the manager from the seller's location or find the manager who has daily operations.

#         # Actually, looking at the code, in record_milk_distribution, it gets the manager from request.user
#         # But for other sources, we need to find the appropriate manager.

#         # Perhaps we can get the manager who has the most employees or something, but that's hacky.
#         # Better: since locations are managed by the system, and manager is per system, we can get the first manager.

#         manager = Manager.objects.first()
#         if manager:
#             daily_ops = get_or_create_daily_operations(manager, instance.date)
#             update_milk_distribution_totals(daily_ops)


class DailyTotal(models.Model):
    total_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name='daily_totals')
    date = models.DateField()
    total_received = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_sold = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    revenue = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.seller.name} - {self.date}"

    class Meta:
        db_table = 'dailytotal'
        unique_together = ['seller', 'date']


class Sale(models.Model):
    sale_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name='sales')
    date = models.DateField()
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Sale - {self.date}"

    class Meta:
        db_table = 'sale'


class MilkRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('on_hold', 'On Hold'),
        ('received', 'Received'),
        ('rejected', 'Rejected'),
    ]

    request_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name='sent_requests')
    to_seller = models.ForeignKey(Seller, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_requests')
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Request from {self.from_seller.name} - {self.quantity}L"

    class Meta:
        db_table = 'milkrequest'


class BorrowLendRecord(models.Model):
    record_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    borrower_seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name='borrowed_records')
    lender_seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name='lent_records')
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    borrow_date = models.DateField()
    settled = models.BooleanField(default=False)
    request = models.ForeignKey(MilkRequest, on_delete=models.CASCADE, related_name='borrow_lend_records')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.borrower_seller.name} borrowed from {self.lender_seller.name}"

    class Meta:
        db_table = 'borrowlendrecord'


class Notification(models.Model):
    notification_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"Notification for {self.user.username}"

    class Meta:
        db_table = 'notification'
        ordering = ['-timestamp']
