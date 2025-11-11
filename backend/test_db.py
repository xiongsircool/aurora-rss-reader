#!/usr/bin/env python3
from app.db.session import SessionLocal
from app.db.models import Feed
from sqlmodel import select

def test():
    try:
        session = SessionLocal()
        feeds = session.exec(select(Feed)).all()
        print(f"✅ 数据库连接成功！找到 {len(feeds)} 个订阅源")
        for feed in feeds:
            print(f"  - {feed.title or feed.url}")
        session.close()
    except Exception as e:
        print(f"❌ 错误: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test()

