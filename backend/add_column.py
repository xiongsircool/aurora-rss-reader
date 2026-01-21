
import sqlite3
import os

db_path = r"d:\githubs\aurora-rss-reader\backend\data\rss.sqlite"

if not os.path.exists(db_path):
    print(f"Database file not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Check if column exists
    cursor.execute("PRAGMA table_info(translations)")
    columns = [info[1] for info in cursor.fetchall()]
    
    if "paragraph_map" not in columns:
        print("Adding paragraph_map column...")
        cursor.execute("ALTER TABLE translations ADD COLUMN paragraph_map JSON")
        print("Successfully added paragraph_map column")
    else:
        print("Column paragraph_map already exists")

except Exception as e:
    print(f"Error: {e}")

conn.commit()
conn.close()
