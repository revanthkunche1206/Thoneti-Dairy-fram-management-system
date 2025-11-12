from rest_framework import serializers
from django.contrib.auth import authenticate
from django.db import IntegrityError

from .models import (
    User, Admin, Manager, Employee, Seller, Location,
    DailyOperations, FeedRecord, ExpenseRecord, MedicineRecord,
    MilkDistribution, MilkReceived, Attendance, Salary, Deduction,
    DailyTotal, Sale, MilkRequest, BorrowLendRecord, Notification
)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['user_id', 'username', 'role', 'is_active', 'created_at']
        read_only_fields = ['user_id', 'created_at']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'password', 'role']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    role = serializers.CharField()

    def validate(self, data):
        username = data.get("username")
        password = data.get("password")
        role = data.get("role")

        user = authenticate(username=username, password=password)
        if not user:
            raise serializers.ValidationError("Invalid credentials.")
        if not user.is_active:
            raise serializers.ValidationError("User account disabled.")
        if user.role != role:
            raise serializers.ValidationError("Incorrect role selected.")

        data["user"] = user
        return data


class AdminSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Admin
        fields = ['admin_id', 'name', 'username', 'created_at']
        read_only_fields = ['admin_id', 'created_at']


class ManagerSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Manager
        fields = ['manager_id', 'name', 'username', 'created_at']
        read_only_fields = ['manager_id', 'created_at']


class ManagerCreateSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    name = serializers.CharField()

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            role='manager'
        )
        return Manager.objects.create(
            name=validated_data['name'],
            user=user
        )


class EmployeeSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    manager_name = serializers.CharField(source='manager.name', read_only=True)

    class Meta:
        model = Employee
        fields = ['employee_id', 'name', 'base_salary', 'username', 'manager_name', 'is_active', 'created_at']
        read_only_fields = ['employee_id', 'created_at']


class EmployeeCreateSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    name = serializers.CharField()
    base_salary = serializers.DecimalField(max_digits=10, decimal_places=2)
    manager_id = serializers.CharField()

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            role='employee'
        )
        manager = Manager.objects.get(manager_id=validated_data['manager_id'])
        return Employee.objects.create(
            name=validated_data['name'],
            base_salary=validated_data['base_salary'],
            user=user,
            manager=manager
        )


class DeductionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deduction
        fields = ['deduction_id', 'amount', 'reason', 'created_at']
        read_only_fields = ['deduction_id', 'created_at']


class EmployeeDashboardSerializer(serializers.Serializer):
    employee_id = serializers.CharField()
    name = serializers.CharField()
    base_salary = serializers.DecimalField(max_digits=10, decimal_places=2)
    days_worked = serializers.IntegerField()
    total_days = serializers.IntegerField()
    attendance_percentage = serializers.DecimalField(max_digits=5, decimal_places=2)
    salary_balance = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_deductions = serializers.DecimalField(max_digits=10, decimal_places=2)
    final_salary = serializers.DecimalField(max_digits=10, decimal_places=2)
    deductions = DeductionSerializer(many=True, read_only=True)


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ['location_id', 'location_name', 'address', 'created_at']
        read_only_fields = ['location_id', 'created_at']


class SellerSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    location_name = serializers.CharField(source='location.location_name', read_only=True)

    class Meta:
        model = Seller
        fields = ['seller_id', 'name', 'username', 'location_name', 'is_active', 'created_at']
        read_only_fields = ['seller_id', 'created_at']


class LocationSellerCreateSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    location_name = serializers.CharField()
    address = serializers.CharField()
    seller_name = serializers.CharField()

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            role='seller'
        )
        location = Location.objects.create(
            location_name=validated_data['location_name'],
            address=validated_data['address']
        )
        return Seller.objects.create(
            name=validated_data['seller_name'],
            location=location,
            user=user
        )


class SellerCreateSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    name = serializers.CharField()
    location_id = serializers.UUIDField()

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            role='seller'
        )
        location = Location.objects.get(location_id=validated_data['location_id'])
        return Seller.objects.create(
            name=validated_data['name'],
            location=location,
            user=user
        )
 

class DailyOperationsSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyOperations
        fields = ['record_id', 'date', 'manager', 'created_at']
        read_only_fields = ['record_id', 'created_at']


class FeedRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedRecord
        fields = ['feed_id', 'date', 'feed_type', 'quantity', 'cost', 'record', 'created_at']
        read_only_fields = ['feed_id', 'created_at']
        extra_kwargs = {'record': {'required': False}}


class ExpenseRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseRecord
        fields = ['expense_id', 'date', 'category', 'amount', 'record', 'created_at']
        read_only_fields = ['expense_id', 'created_at']
        extra_kwargs = {'record': {'required': False}}


class MedicineRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicineRecord
        fields = ['medicine_id', 'date', 'medicine_name', 'cost', 'record', 'created_at']
        read_only_fields = ['medicine_id', 'created_at']
        extra_kwargs = {'record': {'required': False}}


class MilkDistributionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MilkDistribution
        fields = ['distribution_id', 'date', 'total_milk', 'leftover_milk', 'leftover_sales', 'record', 'created_at']
        read_only_fields = ['distribution_id', 'created_at']


class AttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)

    class Meta:
        model = Attendance
        fields = ['attendance_id', 'employee', 'employee_name', 'date', 'status', 'created_at']
        read_only_fields = ['attendance_id', 'created_at']


class DeductionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deduction
        fields = ['deduction_id', 'amount', 'reason', 'created_at']
        read_only_fields = ['deduction_id', 'created_at']


class SalarySerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)
    deductions = DeductionSerializer(many=True, read_only=True)

    class Meta:
        model = Salary
        fields = ['salary_id', 'employee', 'employee_name', 'month', 'base_salary',
                  'total_deductions', 'final_salary', 'days_worked', 'deductions', 'created_at']
        read_only_fields = ['salary_id', 'created_at']


class MilkReceivedSerializer(serializers.ModelSerializer):
    seller_name = serializers.CharField(source='seller.name', read_only=True)

    class Meta:
        model = MilkReceived
        fields = ['receipt_id', 'seller', 'seller_name', 'quantity', 'date', 'source', 'created_at']
        read_only_fields = ['receipt_id', 'created_at']


class DailyTotalSerializer(serializers.ModelSerializer):
    seller_name = serializers.CharField(source='seller.name', read_only=True)

    class Meta:
        model = DailyTotal
        fields = ['total_id', 'seller', 'seller_name', 'date', 'total_received',
                  'total_sold', 'revenue', 'created_at']
        read_only_fields = ['total_id', 'created_at']


class SaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sale
        fields = ['sale_id', 'seller', 'date', 'quantity', 'total_amount', 'created_at']
        read_only_fields = ['sale_id', 'created_at']


class MilkRequestSerializer(serializers.ModelSerializer):
    from_seller_name = serializers.CharField(source='from_seller.name', read_only=True)
    to_seller_name = serializers.CharField(source='to_seller.name', read_only=True)

    class Meta:
        model = MilkRequest
        fields = ['request_id', 'from_seller', 'from_seller_name', 'to_seller',
                  'to_seller_name', 'quantity', 'status', 'created_at', 'updated_at']
        read_only_fields = ['request_id', 'created_at', 'updated_at']


class BorrowLendRecordSerializer(serializers.ModelSerializer):
    borrower_name = serializers.CharField(source='borrower_seller.name', read_only=True)
    lender_name = serializers.CharField(source='lender_seller.name', read_only=True)

    class Meta:
        model = BorrowLendRecord
        fields = ['record_id', 'borrower_seller', 'borrower_name',
                  'lender_seller', 'lender_name', 'quantity', 'borrow_date',
                  'settled', 'request', 'created_at']
        read_only_fields = ['record_id', 'created_at']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['notification_id', 'user', 'message', 'timestamp', 'is_read']
        read_only_fields = ['notification_id', 'timestamp']
