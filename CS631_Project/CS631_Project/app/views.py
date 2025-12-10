from flask import Blueprint, render_template, request, redirect, url_for, flash
from datetime import datetime, date
from .models import db, Employee, Department, Division, EmployeeSalary
from sqlalchemy.orm import aliased
from sqlalchemy import func, and_, desc

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
@main_bp.route('/home')
def home():
    return render_template('index.html', title='Home Page', year=datetime.now().year)

@main_bp.route('/contact')
def contact():
    return render_template('contact.html', title='Contact', year=datetime.now().year, message='Your contact page.')

@main_bp.route('/about')
def about():
    return render_template('about.html', title='About', year=datetime.now().year, message='Your application description page.')

@main_bp.route('/test-template')
def test_template():
    return "<h1>Test route works!</h1>"

@main_bp.route('/human-resources')
def human_resources():
    # Subquery to get the max start_date per employee (latest salary start)
    latest_salary_subq = (
        db.session.query(
            EmployeeSalary.employee_no,
            func.max(EmployeeSalary.start_date).label('max_start_date')
        )
        .group_by(EmployeeSalary.employee_no)
        .subquery()
    )
    
    latest_salary = aliased(EmployeeSalary)

    # Query to join employees with departments, divisions, and their latest salary
    results = (
        db.session.query(Employee, Department, Division, latest_salary)
        .join(Department, Employee.department_name == Department.department_name, isouter=True)
        .join(Division, Department.division_name == Division.division_name, isouter=True)
        .join(
            latest_salary_subq,
            Employee.employee_no == latest_salary_subq.c.employee_no,
            isouter=True
        )
        .join(
            latest_salary,
            and_(
                latest_salary.employee_no == latest_salary_subq.c.employee_no,
                latest_salary.start_date == latest_salary_subq.c.max_start_date,
                latest_salary.end_date == None  # Only current salaries where end_date IS NULL
            ),
            isouter=True
        )
        .filter(Employee.is_active == True)
        .order_by(Employee.employee_no)
        .all()
    )

    employees = []
    for emp, dept, div, salary in results:
        employees.append({
            "employee_no": emp.employee_no,
            "employee_name": emp.employee_name,
            "title": emp.title,
            "department_name": dept.department_name if dept else '',
            "division_name": div.division_name if div else '',
            "employment_start_date": emp.employment_start_date,
            "employment_end_date": emp.employment_end_date,
            "is_active": emp.is_active,
            "salary": salary.salary if salary else None,
            "salary_start_date": salary.start_date if salary else None
        })

    return render_template('human_resources.html', employees=employees)

@main_bp.route('/add-employee', methods=['GET', 'POST'])
def add_employee():
    if request.method == 'POST':
        # Retrieve form data
        employee_name = request.form.get('employee_name')
        phone_number = request.form.get('phone_number')
        title = request.form.get('title')
        department_name = request.form.get('department_name')

        # Create new Employee instance
        new_employee = Employee(
            employee_name=employee_name,
            phone_number=phone_number,
            title=title,
            department_name=department_name,
            employment_start_date=date.today(),
            is_active=True
        )

        # Add to DB and commit
        db.session.add(new_employee)
        db.session.commit()

        flash('Employee added successfully!', 'success')
        return redirect(url_for('main.human_resources'))

    departments = Department.query.order_by(Department.department_name).all()
    return render_template('add_employee.html', departments=departments)
