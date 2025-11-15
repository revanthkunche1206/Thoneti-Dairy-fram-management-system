from datetime import datetime, date
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.core.exceptions import ValidationError
from .models import (
    DailyOperations, Salary, Attendance, MilkReceived, 
    MilkDistribution, Deduction, Notification, Seller, 
    BorrowLendRecord, Location, Sale, DailyTotal
)
from calendar import monthrange


def get_or_create_daily_operations(manager, operation_date=None):
    if operation_date is None:
        operation_date = date.today()

    daily_ops, created = DailyOperations.objects.get_or_create(
        manager=manager,
        date=operation_date,
        defaults={'date': operation_date}
    )
    return daily_ops


@transaction.atomic
def mark_attendance_and_update(employee, attendance_date, status: str):
    if isinstance(attendance_date, str):
        attendance_date = datetime.strptime(attendance_date, "%Y-%m-%d").date()

    validate_attendance_date(attendance_date)

    attendance, created = Attendance.objects.get_or_create(
        employee=employee,
        date=attendance_date,
        defaults={'status': status}
    )

    if not created and attendance.status == status:
        return attendance, {'message': 'No change — same status.'}

    attendance.status = status
    attendance.save()

    if status == 'present':
        salary = calculate_and_update_salary(employee, attendance_date)
        message = f"Marked present for {attendance_date}. Salary updated."
    else:
        salary = calculate_and_update_salary(employee, attendance_date)
        message = f"Marked {status} for {attendance_date}."

    return attendance, {'message': message, 'salary_updated': True}


def calculate_and_update_salary(employee, attendance_date):
    month = attendance_date.strftime('%Y-%m')

    salary, _ = Salary.objects.get_or_create(
        employee=employee,
        month=month,
        defaults={
            'base_salary': employee.base_salary,
            'total_deductions': Decimal('0.00'),
            'final_salary': Decimal('0.00'),
            'days_worked': 0
        }
    )

    days_worked = Attendance.objects.filter(
        employee=employee,
        date__year=attendance_date.year,
        date__month=attendance_date.month,
        status='present'
    ).count()

    salary_balance = employee.base_salary * days_worked
    total_deductions = Deduction.objects.filter(salary=salary).aggregate(
        total=Sum('amount')
    )['total'] or Decimal('0.00')

    final_salary = salary_balance - total_deductions

    salary.days_worked = days_worked
    salary.total_deductions = total_deductions
    salary.final_salary = final_salary
    salary.save()

    return salary


def calculate_total_milk_distributed(daily_operations=None):
    if daily_operations:
        return MilkReceived.objects.filter(
            date=daily_operations.date
        ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.00')
    else:
        from datetime import date
        return MilkReceived.objects.filter(
            date=date.today()
        ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.00')


def update_milk_distribution_totals(daily_operations):
    total_milk = calculate_total_milk_distributed(daily_operations)

    milk_dist, created = MilkDistribution.objects.get_or_create(
        record=daily_operations,
        date=daily_operations.date,
        defaults={
            'total_milk': total_milk,
            'leftover_milk': Decimal('0.00'),
            'leftover_sales': Decimal('0.00')
        }
    )

    if not created:
        milk_dist.total_milk = total_milk
        milk_dist.save()

    return milk_dist


def get_employee_dashboard_data(employee):
    today = date.today()
    current_month = today.strftime('%Y-%m')
    total_days = monthrange(today.year, today.month)[1]

    days_worked = Attendance.objects.filter(
        employee=employee,
        date__year=today.year,
        date__month=today.month,
        status='present'
    ).count()

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

    salary_balance = employee.base_salary * days_worked
    deductions = Deduction.objects.filter(salary=salary)
    total_deductions = deductions.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    final_salary = salary_balance - total_deductions

    attendance_percentage = (days_worked / total_days * 100) if total_days > 0 else 0

    return {
        'employee_id': employee.employee_id,
        'name': employee.name,
        'base_salary': employee.base_salary,
        'days_worked': days_worked,
        'total_days': total_days,
        'attendance_percentage': round(attendance_percentage, 2),
        'salary_balance': salary_balance,
        'total_deductions': total_deductions,
        'final_salary': final_salary,
        'deductions': deductions
    }


def create_notification(user, message):
    return Notification.objects.create(user=user, message=message)


def notify_all_sellers_about_request(milk_request):
    other_sellers = Seller.objects.filter(is_active=True).exclude(
        seller_id=milk_request.from_seller.seller_id
    )

    message = (
        f"New milk request from {milk_request.from_seller.name} "
        f"({milk_request.from_seller.location.location_name}). "
        f"Quantity: {milk_request.quantity}L"
    )

    for seller in other_sellers:
        create_notification(seller.user, message)


def create_borrow_lend_record(milk_request, accepting_seller):
    record = BorrowLendRecord.objects.create(
        borrower_seller=milk_request.from_seller,
        lender_seller=accepting_seller,
        quantity=milk_request.quantity,
        borrow_date=date.today(),
        settled=False,
        request=milk_request
    )

    message = (
        f"Your milk request for {milk_request.quantity}L has been accepted by "
        f"{accepting_seller.name} ({accepting_seller.location.location_name})."
    )
    create_notification(milk_request.from_seller.user, message)

    return record


def validate_attendance_date(attendance_date):
    if attendance_date > date.today():
        raise ValidationError("Cannot mark attendance for future dates.")
    return True


def get_monthly_attendance_summary(employee, year, month):
    attendances = Attendance.objects.filter(
        employee=employee,
        date__year=year,
        date__month=month
    )
    present_count = attendances.filter(status='present').count()
    absent_count = attendances.filter(status='absent').count()
    total_days = monthrange(year, month)[1]

    return {
        'total_days': total_days,
        'present': present_count,
        'absent': absent_count,
        'unmarked': total_days - (present_count + absent_count)
    }

def get_seller_daily_summary(seller, summary_date=None):
    if summary_date is None:
        summary_date = date.today()

    milk_received_records = MilkReceived.objects.filter(
        seller=seller,
        date=summary_date,
        status__in=['received', 'pending']  
    )
    total_received_today = milk_received_records.aggregate(total=Sum('quantity'))['total'] or Decimal('0.00')

    farm_milk = milk_received_records.filter(
                source__iexact='From Farm'  
            ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.00')

    inter_seller_milk = milk_received_records.filter(
                source__iexact='Inter Seller' 
            ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.00')
    total_sold_today = Sale.objects.filter(
        seller=seller,
        date=summary_date
    ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.00')
    
    individual_sales = Sale.objects.filter(
        seller=seller,
        date=summary_date
    ).order_by('-created_at')

    total_lent_today = BorrowLendRecord.objects.filter(
        lender_seller=seller,
        borrow_date=summary_date,
        settled=False
    ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.00')

    total_in_all_time = (MilkReceived.objects.filter(
        seller=seller,
        status__in=['received', 'pending']  
    ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.00'))
    
    total_sold_all_time = (Sale.objects.filter(
        seller=seller
    ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.00'))
    
    total_lent_all_time = (BorrowLendRecord.objects.filter(
        lender_seller=seller,
        settled=False  
    ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.00'))

    remaining_milk = total_in_all_time - total_sold_all_time - total_lent_all_time

    daily_total = DailyTotal.objects.filter(seller=seller, date=summary_date).first()

    return {
        'date': summary_date,
        'total_milk_received': total_received_today,   
        'farm_milk': farm_milk,                         
        'inter_seller_milk': inter_seller_milk,         
        'total_milk_sold': total_sold_today,            
        'total_milk_lent': total_lent_today,           
        'remaining_milk': remaining_milk,               
        'revenue': daily_total.revenue if daily_total else Decimal('0.00'),
        'cash_sales': daily_total.cash_sales if daily_total else Decimal('0.00'),
        'online_sales': daily_total.online_sales if daily_total else Decimal('0.00'),
        'individual_sales': individual_sales           
    }

def get_location_statistics(selected_date=None):
    stats = []
    
    if selected_date is None:
        selected_date = date.today()

    for location in Location.objects.all():
        sellers = Seller.objects.filter(location=location, is_active=True)

        total_milk_today = MilkReceived.objects.filter(
            seller__location=location,
            date=selected_date
        ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.00')

        farm_milk_today = MilkReceived.objects.filter(
            seller__location=location,
            date=selected_date,
            source='From Farm'
        ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.00')

        inter_seller_milk_today = MilkReceived.objects.filter(
            seller__location=location,
            date=selected_date,
            source='Inter Seller'
        ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.00')

        stats.append({
            'location_id': str(location.location_id),
            'location_name': location.location_name,
            'address': location.address,
            'seller_count': sellers.count(),
            'milk_received_today': total_milk_today,
            'farm_milk_today': farm_milk_today,
            'inter_seller_milk_today': inter_seller_milk_today
        })

    return stats