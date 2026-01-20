import asyncio
import httpx
import sys

# Define test feeds
TEST_FEEDS = [
    {"url": "https://sspai.com/feed", "group": "Tech - CN"},
    {"url": "https://www.theverge.com/rss/index.xml", "group": "Tech - EN"},
    {"url": "https://devblogs.microsoft.com/python/feed/", "group": "Dev"},
    {"url": "https://feeds.feedburner.com/TechCrunch/", "group": "Tech - EN"},
    {"url": "https://www.v2ex.com/index.xml", "group": "Community"},
]

API_URL = "http://localhost:15432/api/feeds"

async def add_feed(client, feed):
    try:
        # First add the feed
        print(f"Adding {feed['url']}...")
        response = await client.post(API_URL, json={"url": feed["url"]})
        
        if response.status_code == 200 or response.status_code == 201:
            data = response.json()
            feed_id = data["id"]
            title = data.get("title", feed["url"])
            print(f"✅ Successfully added: {title}")
            
            # Now update the group if specified
            # Assuming there is an endpoint to update feed or we need to check how to set group
            # Based on previous code, update is PATCH /feeds/{id} with {"group_name": "..."}
            if feed.get("group"):
                print(f"   Setting group to: {feed['group']}")
                patch_url = f"{API_URL}/{feed_id}"
                await client.patch(patch_url, json={"group_name": feed["group"]})
                
        elif response.status_code == 400 and "already exists" in response.text:
             print(f"⚠️  Feed already exists: {feed['url']}")
        else:
            print(f"❌ Failed to add {feed['url']}: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Error adding {feed['url']}: {e}")

async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            await client.get("http://localhost:15432/health")
        except:
            print("❌ Backend server is not running on port 15432.")
            return

        print("🚀 Starting feed import (Sequential)...")
        for feed in TEST_FEEDS:
            await add_feed(client, feed)
            await asyncio.sleep(1) # Pause between adds
        print("\n✨ Import finished!")

if __name__ == "__main__":
    asyncio.run(main())
