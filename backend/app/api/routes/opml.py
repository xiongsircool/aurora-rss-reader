from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from io import StringIO

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlmodel import Session, select

from app.db.deps import get_session
from app.db.models import Feed

router = APIRouter(prefix="/opml", tags=["opml"])


@router.get("/export")
async def export_opml(session: Session = Depends(get_session)) -> Response:
    """Export all feeds as OPML."""
    feeds = session.exec(select(Feed)).all()
    
    # Create OPML XML structure
    opml = ET.Element("opml", version="2.0")
    head = ET.SubElement(opml, "head")
    
    title = ET.SubElement(head, "title")
    title.text = "RSS READER Subscriptions"
    
    date_created = ET.SubElement(head, "dateCreated")
    date_created.text = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
    
    body = ET.SubElement(opml, "body")
    
    # Group feeds by group_name
    groups: dict[str, list[Feed]] = {}
    for feed in feeds:
        group_name = feed.group_name or "default"
        if group_name not in groups:
            groups[group_name] = []
        groups[group_name].append(feed)
    
    # Create outline elements
    for group_name, group_feeds in groups.items():
        if len(groups) > 1:
            # Create group outline
            group_outline = ET.SubElement(body, "outline", text=group_name, title=group_name)
            for feed in group_feeds:
                ET.SubElement(
                    group_outline,
                    "outline",
                    type="rss",
                    text=feed.title or feed.url,
                    title=feed.title or feed.url,
                    xmlUrl=feed.url,
                    htmlUrl=feed.site_url or "",
                )
        else:
            # No grouping, add feeds directly
            for feed in group_feeds:
                ET.SubElement(
                    body,
                    "outline",
                    type="rss",
                    text=feed.title or feed.url,
                    title=feed.title or feed.url,
                    xmlUrl=feed.url,
                    htmlUrl=feed.site_url or "",
                )
    
    # Convert to string
    tree = ET.ElementTree(opml)
    output = StringIO()
    tree.write(output, encoding="unicode", xml_declaration=True)
    
    return Response(
        content=output.getvalue(),
        media_type="application/xml",
        headers={"Content-Disposition": "attachment; filename=rss_subscriptions.opml"},
    )


@router.post("/import")
async def import_opml(
    file: UploadFile = File(...), session: Session = Depends(get_session)
) -> dict[str, int | list[str]]:
    """Import feeds from OPML file."""
    if not file.filename or not file.filename.endswith((".opml", ".xml")):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an OPML file.")
    
    content = await file.read()
    
    try:
        root = ET.fromstring(content.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse OPML: {str(e)}")
    
    # Find all outline elements with type="rss" or xmlUrl attribute
    imported = 0
    skipped = 0
    errors: list[str] = []
    
    def process_outline(outline: ET.Element, parent_title: str | None = None) -> None:
        nonlocal imported, skipped
        
        xml_url = outline.get("xmlUrl")
        if xml_url:
            # This is a feed
            title = outline.get("title") or outline.get("text") or xml_url
            group_name = parent_title or "default"
            
            # Check if feed already exists
            try:
                existing = session.exec(select(Feed).where(Feed.url == xml_url)).first()
                if existing:
                    skipped += 1
                    return
                
                # Add new feed
                feed = Feed(
                    url=xml_url,
                    title=title,
                    site_url=outline.get("htmlUrl") or "",
                    group_name=group_name,
                )
                session.add(feed)
                imported += 1
            except Exception as e:
                errors.append(f"Error adding feed {xml_url}: {str(e)}")
        
        # Process children regardless (some feeds might have both xmlUrl and children)
        children = outline.findall("outline")
        if children:
            current_title = outline.get("title") or outline.get("text") or parent_title
            for child in children:
                process_outline(child, current_title)
    
    # Process body
    body = root.find("body")
    if body is not None:
        for outline in body.findall("outline"):
            try:
                process_outline(outline)
            except Exception as e:
                errors.append(f"Error processing outline: {str(e)}")
    
    session.commit()
    
    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
    }
