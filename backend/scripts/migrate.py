"""Placeholder for Alembic migrations."""

from app.db.session import init_db


def main() -> None:
    init_db()


if __name__ == "__main__":
    main()
