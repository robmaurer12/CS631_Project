from flask import Blueprint, render_template, request, jsonify
from datetime import datetime, date
from calendar import monthrange
from sqlalchemy.orm import aliased
from sqlalchemy import func, and_, or_
from .models import db, Employee, Department, Division, EmployeeSalary
from .human_res_service import get_employees_with_salary

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
@main_bp.route('/home')
def home(): return render_template('index.html', title='Home Page', year=datetime.now().year)

@main_bp.route('/contact')
def contact(): return render_template('contact.html', title='Contact', year=datetime.now().year, message='Your contact page.')

@main_bp.route('/about')
def about(): return render_template('about.html', title='About', year=datetime.now().year, message='Your application description page.')

@main_bp.route('/test-template')
def test_template(): return "<h1>Test route works!</h1>"

@main_bp.route('/human-resources')
def human_resources():
    employees = get_employees_with_salary()
    return render_template('human_resources.html', employees=employees)

@main_bp.route('/set-salary', methods=['POST'])
def set_salary():
    data = request.get_json()
    employee_no = data.get('employee_no')
    new_salary_str = data.get('new_salary')
    percent_increase_str = data.get('percent_increase')

    if not employee_no:
        return jsonify({'message': 'Employee number missing.'}), 400

    try:
        new_salary = float(new_salary_str) if new_salary_str else None
        percent_increase = float(percent_increase_str) if percent_increase_str else None
    except ValueError:
        return jsonify({'message': 'Invalid input for salary or percent increase.'}), 400

    if new_salary is None and percent_increase is None:
        return jsonify({'message': 'Please enter either a new salary or a percent increase.'}), 400

    current_salary_record = EmployeeSalary.query.filter_by(employee_no=employee_no, end_date=None).first()
    if not current_salary_record:
        return jsonify({'message': 'Current salary record not found.'}), 404

    current_salary = current_salary_record.salary

    if new_salary is None and percent_increase is not None:
        new_salary = current_salary * (1 + percent_increase / 100)
    if percent_increase is None and new_salary is not None:
        percent_increase = ((new_salary - current_salary) / current_salary) * 100

    current_salary_record.end_date = date.today()
    db.session.add(current_salary_record)

    new_salary_record = EmployeeSalary(
        employee_no=employee_no,
        salary=new_salary,
        start_date=date.today(),
        end_date=None,
        type=current_salary_record.type
    )
    db.session.add(new_salary_record)

    db.session.commit()

    return jsonify({
        'message': f'Salary updated successfully for Employee #{employee_no}. New salary: ${new_salary:.2f} ({percent_increase:.2f}% increase)',
        'new_salary': new_salary,
        'salary_type': current_salary_record.type,
        'start_date': date.today().isoformat(),
        'salary_id': new_salary_record.id
    }), 200

@main_bp.route('/salary-history/<int:employee_no>/<int:year>', methods=['GET'])
def salary_history(employee_no, year):
    records = EmployeeSalary.query.filter(
        EmployeeSalary.employee_no == employee_no,
        EmployeeSalary.start_date <= date(year, 12, 31),
        or_(EmployeeSalary.end_date == None, EmployeeSalary.end_date >= date(year, 1, 1))
    ).order_by(EmployeeSalary.start_date).all()

    monthly_data = []

    for month in range(1, 13):
        month_start = date(year, month, 1)
        month_end = date(year, month, monthrange(year, month)[1])

        salary_record_for_month = None
        for record in records:
            rec_end = record.end_date or date.today()
            if record.start_date <= month_end and rec_end >= month_start:
                if (salary_record_for_month is None or record.start_date > salary_record_for_month.start_date):
                    salary_record_for_month = record
        
        if salary_record_for_month:
            if salary_record_for_month.type == 'salary':
                monthly_salary = salary_record_for_month.salary / 12
            else:  # hourly
                monthly_salary = salary_record_for_month.salary * 160
        else:
            monthly_salary = 0

        fed_tax = monthly_salary * 0.10
        state_tax = monthly_salary * 0.05
        other_tax = monthly_salary * 0.03
        take_home = monthly_salary - (fed_tax + state_tax + other_tax)

        monthly_data.append({
            "month": month,
            "salary": round(monthly_salary, 2),
            "federal_tax": round(fed_tax, 2),
            "state_tax": round(state_tax, 2),
            "other_taxes": round(other_tax, 2),
            "take_home": round(take_home, 2)
        })

    return jsonify({
        "employee_no": employee_no,
        "year": year,
        "monthly_salary_history": monthly_data
    })