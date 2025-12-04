from flask.cli import FlaskGroup
from CS631_Project.app import create_app, db
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
app = create_app()
migrate = Migrate(app, db)
cli = FlaskGroup(app)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL',
    'postgresql://postgres:password@localhost:5432/mydb'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

if __name__ == '__main__':
    cli()
