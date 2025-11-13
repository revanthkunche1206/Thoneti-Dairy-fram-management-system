from rest_framework import status, viewsets
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import login, logout, get_user_model
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.db.models import Q , Sum
from django.shortcuts import get_object_or_404
from datetime import date, datetime, timedelta
from decimal import Decimal
from django.utils import timezone
from django.views.generic import TemplateView
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from datetime import date, timedelta
from django.db.models import Sum
from django.db.models.functions import TruncDate

from .models import (
    User, Manager, Employee, Seller, Location, DailyOperations,
    FeedRecord, ExpenseRecord, MedicineRecord, MilkReceived,
    MilkDistribution, Attendance, Salary, Deduction, DailyTotal,
    MilkRequest, BorrowLendRecord, Notification, Admin
)

from .serializers import (
    LoginSerializer, UserSerializer, AdminSerializer, ManagerSerializer,
    ManagerCreateSerializer, EmployeeSerializer, EmployeeCreateSerializer,
    LocationSerializer, SellerSerializer, LocationSellerCreateSerializer,
    SellerCreateSerializer, FeedRecordSerializer, ExpenseRecordSerializer,
    MedicineRecordSerializer, MilkReceivedSerializer, MilkDistributionSerializer,
    AttendanceSerializer, SalarySerializer, EmployeeDashboardSerializer,
    DailyTotalSerializer, MilkRequestSerializer, BorrowLendRecordSerializer,
    NotificationSerializer, DeductionSerializer
)

from .utils import (
    get_or_create_daily_operations, calculate_and_update_salary,
    update_milk_distribution_totals, get_employee_dashboard_data,
    notify_all_sellers_about_request, create_borrow_lend_record,
    get_seller_daily_summary, validate_attendance_date, get_location_statistics,
    create_notification
)


class LoginPageView(TemplateView):
    template_name = 'login.html'


@method_decorator(login_required, name='dispatch')
class ManagerDashboardView(TemplateView):
    template_name = 'manager.html'


@method_decorator(login_required, name='dispatch')
class EmployeeDashboardView(TemplateView):
    template_name = 'employee.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        employee = get_object_or_404(Employee, user=self.request.user)
        context['employee'] = employee
        return context


@method_decorator(login_required, name='dispatch')
class AdminDashboardView(TemplateView):
    template_name = 'admin.html'


@method_decorator(login_required, name='dispatch')
class SellerDashboardView(TemplateView):
    template_name = 'seller.html'





@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """Authenticate user and return role-based info."""
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = serializer.validated_data['user']
    login(request, user)

    role_data = {}

    if user.role == 'admin':
        admin, created = Admin.objects.get_or_create(
            user=user, 
            defaults={'name': user.username}
        )
        role_data = {
            'admin_id': str(admin.admin_id),
            'name': admin.name
        }

    elif user.role == 'manager':
        manager, created = Manager.objects.get_or_create(
            user=user,
            defaults={'name': user.username}
        )
        role_data = {
            'manager_id': str(manager.manager_id),
            'name': manager.name
        }
        print(role_data)

    elif user.role == 'employee':
        employee = get_object_or_404(Employee, user=user)
        role_data = {
            'employee_id': str(employee.employee_id),
            'name': employee.name,
            'base_salary': str(employee.base_salary)
        }

    elif user.role == 'seller':
        seller = get_object_or_404(Seller, user=user)
        role_data = {
            'seller_id': str(seller.seller_id),
            'name': seller.name,
            'location_id': str(seller.location.location_id),
            'location_name': seller.location.location_name
        }

    return Response({
        'message': 'Login successful',
        'user': {
            'user_id': str(user.user_id),
            'username': user.username,
            'role': user.role,
            **role_data
        }
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
def logout_view(request):
    logout(request)
    return Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)

@api_view(['POST'])
def create_feed_record(request):
    """Manager adds or updates feed record."""
    manager = get_object_or_404(Manager, user=request.user)
    op_date = _parse_date(request.data.get('date'))
    daily_ops = get_or_create_daily_operations(manager, op_date)

    record_id = request.data.get('recordId')
    if record_id:
        # Update existing record
        try:
            feed_record = FeedRecord.objects.get(feed_id=record_id, record=daily_ops)
            serializer = FeedRecordSerializer(feed_record, data=request.data, partial=True)
        except FeedRecord.DoesNotExist:
            return Response({'message': 'Feed record not found.'}, status=status.HTTP_404_NOT_FOUND)
    else:
        # Create new record
        serializer = FeedRecordSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save(record=daily_ops, date=op_date)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def create_expense_record(request):
    """Manager adds or updates expense record."""
    manager = get_object_or_404(Manager, user=request.user)
    op_date = _parse_date(request.data.get('date'))
    daily_ops = get_or_create_daily_operations(manager, op_date)

    record_id = request.data.get('recordId')
    if record_id:
        # Update existing record
        try:
            expense_record = ExpenseRecord.objects.get(expense_id=record_id, record=daily_ops)
            serializer = ExpenseRecordSerializer(expense_record, data=request.data, partial=True)
        except ExpenseRecord.DoesNotExist:
            return Response({'message': 'Expense record not found.'}, status=status.HTTP_404_NOT_FOUND)
    else:
        # Create new record
        serializer = ExpenseRecordSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save(record=daily_ops, date=op_date)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def create_misc_expense_record(request):
    """Manager adds or updates miscellaneous expense record."""
    manager = get_object_or_404(Manager, user=request.user)
    op_date = _parse_date(request.data.get('date'))
    daily_ops = get_or_create_daily_operations(manager, op_date)

    record_id = request.data.get('recordId')
    if record_id:
        # Update existing record
        try:
            expense_record = ExpenseRecord.objects.get(expense_id=record_id, record=daily_ops)
            serializer = ExpenseRecordSerializer(expense_record, data=request.data, partial=True)
        except ExpenseRecord.DoesNotExist:
            return Response({'message': 'Expense record not found.'}, status=status.HTTP_404_NOT_FOUND)
    else:
        # Create new record
        serializer = ExpenseRecordSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save(record=daily_ops, date=op_date)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_medicine_record(request):
    """Manager adds or updates medicine record."""
    manager = get_object_or_404(Manager, user=request.user)
    op_date = _parse_date(request.data.get('date'))
    daily_ops = get_or_create_daily_operations(manager, op_date)

    record_id = request.data.get('recordId')
    if record_id:
        # Update existing record
        try:
            medicine_record = MedicineRecord.objects.get(medicine_id=record_id, record=daily_ops)
            serializer = MedicineRecordSerializer(medicine_record, data=request.data, partial=True)
        except MedicineRecord.DoesNotExist:
            return Response({'message': 'Medicine record not found.'}, status=status.HTTP_404_NOT_FOUND)
    else:
        # Create new record
        serializer = MedicineRecordSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save(record=daily_ops, date=op_date)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def record_milk_distribution(request):
    """Manager records milk sent to sellers."""
    manager = get_object_or_404(Manager, user=request.user)
    milk_date = _parse_date(request.data.get('date'))
    location_id = request.data.get('locationId')
    quantity = Decimal(request.data.get('quantity', 0))

    if not location_id:
        return Response({'message': 'Location ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

    location = get_object_or_404(Location, location_id=location_id)
    active_sellers = Seller.objects.filter(location=location, is_active=True)
    
    seller_count = active_sellers.count()
    if seller_count == 0:
        return Response({'message': 'No active sellers in this location.'}, status=status.HTTP_400_BAD_REQUEST)

    quantity_per_seller = quantity / seller_count
    
    notification_message = f"You have a pending milk delivery of {quantity_per_seller:.2f}L from your manager for {milk_date}."

    for seller in active_sellers:
        MilkReceived.objects.create(
            seller=seller,
            manager=manager,
            quantity=quantity_per_seller,
            date=milk_date,
            source='From Farm',
            status='pending' 
        )
        create_notification(seller.user, notification_message)

    daily_ops = get_or_create_daily_operations(manager, milk_date)
    update_milk_distribution_totals(daily_ops)
    return Response({'message': f'Milk distribution recorded for {seller_count} sellers.'}, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_pending_distributions(request):
    """Lists pending milk distributions for the logged-in seller."""
    seller = get_object_or_404(Seller, user=request.user)
    
    records = MilkReceived.objects.filter(
        seller=seller,
        status__in=['pending', 'not_received']
    ).select_related('manager').order_by('-date')
    
    return Response(MilkReceivedSerializer(records, many=True).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def update_milk_received_status(request, receipt_id):
    seller = get_object_or_404(Seller, user=request.user)
    record = get_object_or_404(MilkReceived, receipt_id=receipt_id, seller=seller)
    
    new_status = request.data.get('status')
    if new_status not in ['received', 'not_received']:
        return Response({'message': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)

    record.status = new_status
    record.save()
    
    if new_status == 'received':
        message = f"Seller {seller.name} has confirmed receipt of {record.quantity}L for {record.date}."
    else:
        message = f"Seller {seller.name} has marked the distribution of {record.quantity}L for {record.date} as 'Not Received'."

    if record.manager:
        create_notification(record.manager.user, message)

        if new_status == 'received':
            from .utils import update_milk_distribution_totals
            daily_ops = get_or_create_daily_operations(record.manager, record.date)
            update_milk_distribution_totals(daily_ops)

    return Response({'message': f'Status updated to {new_status}.'}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_manager_pending_distributions(request):
    manager = get_object_or_404(Manager, user=request.user)
    
    records = MilkReceived.objects.filter(
        manager=manager,
        status='pending'
    ).select_related('seller', 'seller__location').order_by('-date')
    
    return Response(MilkReceivedSerializer(records, many=True).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_leftover_milk(request):
    """Manager updates leftover milk and sales."""
    manager = get_object_or_404(Manager, user=request.user)
    op_date = _parse_date(request.data.get('date'))
    daily_ops = get_or_create_daily_operations(manager, op_date)

    milk_dist, _ = MilkDistribution.objects.get_or_create(record=daily_ops, date=op_date)
    milk_dist.leftover_milk = Decimal(request.data.get('leftoverMilk', milk_dist.leftover_milk))
    milk_dist.leftover_sales = Decimal(request.data.get('leftoverSales', milk_dist.leftover_sales))
    milk_dist.save()

    return Response({'message': 'Leftover milk updated successfully.'}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_daily_data(request):
    """Get existing daily data for a specific date."""
    manager = get_object_or_404(Manager, user=request.user)
    selected_date = _parse_date(request.query_params.get('date'))

    daily_ops = get_or_create_daily_operations(manager, selected_date)

    feed_records = FeedRecord.objects.filter(record=daily_ops).select_related('record')
    expense_records = ExpenseRecord.objects.filter(record=daily_ops).select_related('record')
    medicine_records = MedicineRecord.objects.filter(record=daily_ops).select_related('record')
    milk_distribution = MilkDistribution.objects.filter(record=daily_ops).select_related('record')

    data = {
        'feed_records': FeedRecordSerializer(feed_records, many=True).data,
        'expense_records': ExpenseRecordSerializer(expense_records, many=True).data,
        'medicine_records': MedicineRecordSerializer(medicine_records, many=True).data,
        'milk_distribution': MilkDistributionSerializer(milk_distribution, many=True).data,
    }

    return Response(data, status=status.HTTP_200_OK)


@api_view(['POST'])
@transaction.atomic
def add_employee(request):
    """Manager adds new employee (creates both user and employee)."""
    manager = get_object_or_404(Manager, user=request.user)
    data = request.data.copy()
    data['manager_id'] = str(manager.manager_id)

    serializer = EmployeeCreateSerializer(data=data)
    if serializer.is_valid():
        employee = serializer.save()
        return Response(EmployeeSerializer(employee).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def list_employees(request):
    """List all active employees for the logged-in manager."""
    manager = get_object_or_404(Manager, user=request.user)
    employees = Employee.objects.filter(manager=manager, is_active=True)
    return Response(EmployeeSerializer(employees, many=True).data, status=status.HTTP_200_OK)


@api_view(['POST'])
def mark_attendance(request):
    """Manager marks employee attendance."""
    employee_id = request.data.get('employeeId')
    attendance_date = _parse_date(request.data.get('date'))
    status_val = request.data.get('status', 'present')

    validate_attendance_date(attendance_date)
    employee = get_object_or_404(Employee, employee_id=employee_id)
    Attendance.objects.update_or_create(
        employee=employee,
        date=attendance_date,
        defaults={'status': status_val}
    )
    calculate_and_update_salary(employee, attendance_date)
    return Response({'message': f'Attendance marked as {status_val}.'}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@transaction.atomic
def create_deduction(request):
    """Manager creates a deduction for an employee."""
    manager = get_object_or_404(Manager, user=request.user)
    employee_id = request.data.get('employeeId')
    amount = Decimal(request.data.get('amount', 0))
    reason = request.data.get('reason')

    if not employee_id or not amount or not reason:
        return Response({'message': 'Employee ID, amount, and reason are required.'}, status=status.HTTP_400_BAD_REQUEST)

    employee = get_object_or_404(Employee, employee_id=employee_id, manager=manager)
    current_month = date.today().strftime('%Y-%m')

    salary, _ = Salary.objects.get_or_create(
        employee=employee,
        month=current_month,
        defaults={
            'base_salary': employee.base_salary,
            'total_deductions': Decimal('0.00'),
            'final_salary': Decimal('0.00'),
            'days_worked': 0
        }
    )

    deduction = Deduction.objects.create(
        salary=salary,
        amount=amount,
        reason=reason
    )

    # Recalculate salary after deduction
    calculate_and_update_salary(employee, date.today())

    return Response(DeductionSerializer(deduction).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@transaction.atomic
def add_location_seller(request):
    """Manager creates new location and seller (with user account)."""
    serializer = LocationSellerCreateSerializer(data=request.data)
    if serializer.is_valid():
        seller = serializer.save()
        return Response(SellerSerializer(seller).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@transaction.atomic
def add_seller(request):
    """Manager adds new seller to an existing location."""
    serializer = SellerCreateSerializer(data=request.data)
    if serializer.is_valid():
        seller = serializer.save()
        return Response(SellerSerializer(seller).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
def list_locations(request):
    """Return all locations and their seller stats. POST to create new location."""
    if request.method == 'POST':
        serializer = LocationSerializer(data=request.data)
        if serializer.is_valid():
            location = serializer.save()
            return Response(LocationSerializer(location).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    return Response(get_location_statistics(), status=status.HTTP_200_OK)


@api_view(['GET'])
def list_sellers(request):
    """Return all active sellers with their location info."""
    sellers = Seller.objects.filter(is_active=True).select_related('location')
    data = []
    for seller in sellers:
        data.append({
            'seller_id': str(seller.seller_id),
            'name': seller.name,
            'location_name': seller.location.location_name,
            'location_id': str(seller.location.location_id)
        })
    return Response(data, status=status.HTTP_200_OK)


@api_view(['GET'])
def employee_dashboard(request):
    """Return salary, attendance and deductions summary."""
    employee = get_object_or_404(Employee, user=request.user)
    data = get_employee_dashboard_data(employee)
    serializer = EmployeeDashboardSerializer(data)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_employee_attendance(request):
    """Return attendance records for the current month."""
    employee = get_object_or_404(Employee, user=request.user)
    today = date.today()
    attendances = Attendance.objects.filter(
        employee=employee,
        date__year=today.year,
        date__month=today.month
    ).order_by('date')
    data = [
        {
            'date': attendance.date.strftime('%Y-%m-%d'),
            'status': attendance.status
        }
        for attendance in attendances
    ]
    return Response(data, status=status.HTTP_200_OK)

@api_view(['POST'])
def record_milk_received(request):
    """Seller records received milk."""
    seller = get_object_or_404(Seller, user=request.user)
    milk_date = _parse_date(request.data.get('date'))
    quantity = Decimal(request.data.get('quantity', 0))
    source = request.data.get('source', 'From Farm')
    record = MilkReceived.objects.create(seller=seller, quantity=quantity, date=milk_date, source=source)
    return Response(MilkReceivedSerializer(record).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def record_daily_sales(request):
    """Seller records daily sales."""
    seller = get_object_or_404(Seller, user=request.user)
    sales_date = _parse_date(request.data.get('date'))
    cash = Decimal(request.data.get('cashEarned', 0))
    online = Decimal(request.data.get('onlineEarned', 0))
    revenue = cash + online

    daily_total, _ = DailyTotal.objects.update_or_create(
        seller=seller,
        date=sales_date,
        defaults={'revenue': revenue, 'total_received': cash, 'total_sold': online}
    )
    return Response(DailyTotalSerializer(daily_total).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def seller_daily_summary(request):
    """Seller gets summary for a given date."""
    seller = get_object_or_404(Seller, user=request.user)
    summary_date = _parse_date(request.query_params.get('date'))
    return Response(get_seller_daily_summary(seller, summary_date), status=status.HTTP_200_OK)


@api_view(['POST'])
@transaction.atomic
def create_milk_request(request):
    """Seller requests milk from other sellers."""
    seller = get_object_or_404(Seller, user=request.user)
    quantity = Decimal(request.data.get('quantity', 0))
    milk_request = MilkRequest.objects.create(from_seller=seller, quantity=quantity, status='pending')
    notify_all_sellers_about_request(milk_request)
    return Response(MilkRequestSerializer(milk_request).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@transaction.atomic
def accept_milk_request(request, request_id):
    """Seller accepts a milk request."""
    seller = get_object_or_404(Seller, user=request.user)
    milk_request = get_object_or_404(MilkRequest, request_id=request_id, status='pending')
    milk_request.to_seller = seller
    milk_request.status = 'on_hold'
    milk_request.save()

    record = create_borrow_lend_record(milk_request, seller)

    # Notify the requesting seller that their request has been accepted
    message = (
        f"Your milk request for {milk_request.quantity}L has been accepted by "
        f"{seller.name} ({seller.location.location_name}). "
        f"Please confirm receipt when you physically receive the milk."
    )
    create_notification(milk_request.from_seller.user, message)

    return Response(BorrowLendRecordSerializer(record).data, status=status.HTTP_200_OK)


@api_view(['GET'])
def list_incoming_requests(request):
    """Seller sees all incoming pending milk requests."""
    seller = get_object_or_404(Seller, user=request.user)
    requests = MilkRequest.objects.filter(status='pending').exclude(from_seller=seller)
    return Response(MilkRequestSerializer(requests, many=True).data, status=status.HTTP_200_OK)


@api_view(['GET'])
def list_my_requests(request):
    """Seller views their outgoing milk requests."""
    seller = get_object_or_404(Seller, user=request.user)
    requests = MilkRequest.objects.filter(from_seller=seller).order_by('-created_at')
    return Response(MilkRequestSerializer(requests, many=True).data, status=status.HTTP_200_OK)


@api_view(['POST'])
@transaction.atomic
def mark_as_received(request, request_id):
    seller = get_object_or_404(Seller, user=request.user)
    milk_request = get_object_or_404(MilkRequest, request_id=request_id, from_seller=seller, status='on_hold')

    milk_request.status = 'received'
    milk_request.save()

    MilkReceived.objects.create(
        seller=milk_request.from_seller,
        quantity=milk_request.quantity,
        date=date.today(),
        source='Inter Seller'
    )

    borrow_lend_record = milk_request.borrow_lend_records.first()
    if borrow_lend_record:
        borrow_lend_record.settled = True
        borrow_lend_record.save()

    message = (
        f"The milk you provided ({milk_request.quantity}L) has been received by "
        f"{milk_request.from_seller.name} ({milk_request.from_seller.location.location_name}). "
        f"Transaction completed."
    )
    create_notification(milk_request.to_seller.user, message)

    return Response({'message': 'Milk marked as received successfully.'}, status=status.HTTP_200_OK)


@api_view(['GET'])
def list_notifications(request):
    """List latest notifications for user."""
    notifications = Notification.objects.filter(user=request.user).order_by('-timestamp')[:20]
    return Response(NotificationSerializer(notifications, many=True).data, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_borrow_lend_history(request):
    """Get borrow/lend history for the logged-in seller."""
    seller = get_object_or_404(Seller, user=request.user)
    borrow_lend_records = BorrowLendRecord.objects.filter(
        Q(borrower_seller=seller) | Q(lender_seller=seller)
    ).select_related('borrower_seller', 'lender_seller').order_by('-borrow_date')

    data = []
    for record in borrow_lend_records:
        if record.borrower_seller == seller:
            # This seller is the borrower
            other_party = record.lender_seller.name
            transaction_type = "Borrowed"
        else:
            # This seller is the lender
            other_party = record.borrower_seller.name
            transaction_type = "Lent"

        data.append({
            'date': record.borrow_date.strftime('%Y-%m-%d'),
            'type': transaction_type,
            'other_party': other_party,
            'quantity': str(record.quantity),
            'status': 'Settled' if record.settled else 'Pending'
        })

    return Response(data, status=status.HTTP_200_OK)


@api_view(['POST'])
def mark_notification_read(request, notification_id):
    """Mark notification as read."""
    notif = get_object_or_404(Notification, notification_id=notification_id, user=request.user)
    notif.is_read = True
    notif.save()
    return Response({'message': 'Notification marked as read.'}, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_datewise_data(request):
    """Get all data for a specific date."""
    manager = get_object_or_404(Manager, user=request.user)
    selected_date = _parse_date(request.query_params.get('date'))

    # Get or create daily operations for the date
    daily_ops = get_or_create_daily_operations(manager, selected_date)

    # Fetch all related data
    feed_records = FeedRecord.objects.filter(record=daily_ops).select_related('record')
    expense_records = ExpenseRecord.objects.filter(record=daily_ops).select_related('record')
    medicine_records = MedicineRecord.objects.filter(record=daily_ops).select_related('record')
    milk_distribution = MilkDistribution.objects.filter(record=daily_ops).select_related('record')
    milk_received = MilkReceived.objects.filter(date=selected_date).select_related('seller')
    daily_totals = DailyTotal.objects.filter(date=selected_date).select_related('seller')
    attendance = Attendance.objects.filter(date=selected_date).select_related('employee')

    # Serialize data
    data = {
        'feed_records': FeedRecordSerializer(feed_records, many=True).data,
        'expense_records': ExpenseRecordSerializer(expense_records, many=True).data,
        'medicine_records': MedicineRecordSerializer(medicine_records, many=True).data,
        'milk_distribution': MilkDistributionSerializer(milk_distribution, many=True).data,
        'milk_received': MilkReceivedSerializer(milk_received, many=True).data,
        'daily_totals': DailyTotalSerializer(daily_totals, many=True).data,
        'attendance': AttendanceSerializer(attendance, many=True).data,
    }

    return Response(data, status=status.HTTP_200_OK)


@api_view(['POST'])
@transaction.atomic
def add_manager(request):
    """Admin creates new manager."""
    serializer = ManagerCreateSerializer(data=request.data)
    if serializer.is_valid():
        manager = serializer.save()
        return Response(ManagerSerializer(manager).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def list_managers(request):
    """List all managers."""
    managers = Manager.objects.filter(user__is_active=True)
    return Response(ManagerSerializer(managers, many=True).data, status=status.HTTP_200_OK)


# --- FIX: Corrected delete_manager view ---
@api_view(['DELETE'])
@transaction.atomic
def delete_manager(request, manager_id):
    """
    Admin deletes a manager.
    
    --- FIX ---
    We find the manager, get their associated user, and delete the USER.
    The on_delete=models.CASCADE on the Manager model's 'user' field
    will then automatically delete the Manager profile.
    """
    try:
        # Use the string manager_id you created (e.g., "manager001")
        manager = get_object_or_404(Manager, manager_id=manager_id)
        
        # Get the user associated with this manager
        user_to_delete = manager.user
        
        # Delete the User. The Manager object will be deleted by CASCADE.
        user_to_delete.delete()
        
        return Response({'message': 'Manager and associated user deleted successfully'}, status=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        return Response({'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)
# --- END OF FIX ---


def _parse_date(input_date):
    """Convert string to date object safely."""
    if not input_date:
        return date.today()
    if isinstance(input_date, date):
        return input_date
    return datetime.strptime(input_date, '%Y-%m-%d').date()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manager_dashboard_stats(request):
    """
    Provides aggregated data for the manager dashboard,
    covering the last 7 days.
    """
    try:
        manager = get_object_or_404(Manager, user=request.user)
        today = date.today()
        seven_days_ago = today - timedelta(days=6)


        operations = DailyOperations.objects.filter(
            manager=manager,
            date__gte=seven_days_ago,
            date__lte=today
        ).order_by('date')

        locations = Location.objects.all()
        sellers = Seller.objects.filter(location__in=locations, is_active=True)
        all_milk_received = MilkReceived.objects.filter(
            seller__in=sellers,
            date__gte=seven_days_ago,
            date__lte=today
        ).values('date').annotate(
            total_milk=Sum('quantity')
        )

        expenses = ExpenseRecord.objects.filter(
            record__in=operations
        ).values('date').annotate(
            total_expense=Sum('amount')
        )

        milk_dist = MilkDistribution.objects.filter(
            record__in=operations
        ).values('date').annotate(
            leftover_sales=Sum('leftover_sales')
        )

        labels = [(seven_days_ago + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(7)]

        # Use the direct MilkReceived query for milk data
        milk_data = {item['date'].strftime('%Y-%m-%d'): item['total_milk'] or 0 for item in all_milk_received}
        sales_data = {item['date'].strftime('%Y-%m-%d'): item['leftover_sales'] or 0 for item in milk_dist}
        expense_data = {item['date'].strftime('%Y-%m-%d'): item['total_expense'] or 0 for item in expenses}

        chart_data = {
            'labels': labels,
            'datasets': [
                {
                    'label': 'Total Milk (L)',
                    'data': [float(milk_data.get(label, 0)) for label in labels],
                    'borderColor': '#667eea',
                    'fill': False,
                    'tension': 0.1
                },
                {
                    'label': 'Leftover Sales (₹)',
                    'data': [float(sales_data.get(label, 0)) for label in labels],
                    'borderColor': '#27ae60',
                    'fill': False,
                    'tension': 0.1
                },
                {
                    'label': 'Total Expenses (₹)',
                    'data': [float(expense_data.get(label, 0)) for label in labels],
                    'borderColor': '#e74c3c',
                    'fill': False,
                    'tension': 0.1
                }
            ]
        }

        # 4. Get other stats
        total_employees = Employee.objects.filter(manager=manager, is_active=True).count()
        total_locations = Location.objects.count()

        # Get today's stats from our prepared data
        today_str = today.strftime('%Y-%m-%d')
        today_milk = milk_data.get(today_str, 0)
        today_expenses = expense_data.get(today_str, 0)

        return Response({
            'chart_data': chart_data,
            'total_employees': total_employees,
            'total_locations': total_locations,
            'today_milk': today_milk,
            'today_expenses': today_expenses
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_sales_trend(request):
    """
    Returns aggregated sales revenue for the last 30 days.
    """
    manager = get_object_or_404(Manager, user=request.user)
    
    thirty_days_ago = date.today() - timedelta(days=30)
    
    sales_data = DailyTotal.objects.filter(
        date__gte=thirty_days_ago
    ).annotate(
        day=TruncDate('date')
    ).values(
        'day'
    ).annotate(
        daily_revenue=Sum('revenue')
    ).order_by('day')
    
    return Response(sales_data)