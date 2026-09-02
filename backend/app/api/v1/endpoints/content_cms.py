from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.user import User
from app.models.content_cms import ContentPage, ContentPageVersion, ContentPageStatus
from app.schemas.content_cms import (
    ContentPageCreate,
    ContentPageUpdate,
    ContentPageOut,
    ContentPageVersionOut,
    PublicContentPageOut
)
from app.api.v1.endpoints.auth import get_current_user
from app.api.v1.endpoints.admin import require_admin

router = APIRouter(tags=["Content CMS"])

DEFAULT_PAGES = {
    "about-us": {
        "title": "About TRACE-X Intelligence Platform",
        "summary": "Transformative Relational Analytics & Criminal Evidence Cross-Examination for modern law enforcement and investigative agencies.",
        "body_markdown": """# TRACE-X: Advanced Law Enforcement Relational Intelligence

## Mission & Purpose
**TRACE-X** (Transformative Relational Analytics & Criminal Evidence Cross-Examination) is an enterprise-grade investigative intelligence platform designed for police departments, economic intelligence units, and federal crime agencies.

### Core Capabilities
1. **Mathematical Evidence Quality Scoring**: Multi-factor 4D weighting (Source reliability, Temporal freshness, Corroboration degree, Custody integrity) with continuous exponential decay tracking.
2. **Analysis of Competing Hypotheses (ACH)**: Richards Heuer diagnostic contradiction matrix with calibrated likelihood estimators.
3. **Value-of-Information Action Prioritizer**: Decision-theoretic engine calculating Expected Information Gain (EIG) to optimize investigative resource allocation.
4. **Cryptographic Chain of Custody**: Continuous SHA-256 evidence hashing and immutable audit logging.
5. **Counterfactual Simulation & Resilience Testing**: High-fidelity scenario exploration without baseline distortion.

---

### Built for Inter-Agency Standards
TRACE-X conforms strictly to legal chain-of-custody protocols, judicial admissibility guidelines, and multi-tier role-based access control."""
    }
}

@router.get("/content/public/{slug}", response_model=PublicContentPageOut)
def get_public_content_page(slug: str, db: Session = Depends(get_db)):
    page = (
        db.query(ContentPage)
        .filter(ContentPage.slug == slug, ContentPage.status == ContentPageStatus.PUBLISHED)
        .first()
    )
    if page:
        return PublicContentPageOut(
            slug=page.slug,
            title=page.title,
            summary=page.summary,
            body_markdown=page.body_markdown,
            version=page.current_version,
            published_at=page.published_at,
            is_fallback=False
        )

    # Fallback to hardcoded safe static copy if present
    if slug in DEFAULT_PAGES:
        fallback = DEFAULT_PAGES[slug]
        return PublicContentPageOut(
            slug=slug,
            title=fallback["title"],
            summary=fallback["summary"],
            body_markdown=fallback["body_markdown"],
            version=1,
            published_at=datetime.utcnow(),
            is_fallback=True
        )

    raise HTTPException(status_code=404, detail="Page not found or not published")

@router.get("/admin/content/pages", response_model=List[ContentPageOut])
def list_cms_pages(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    query = db.query(ContentPage)
    if status and status != "all":
        query = query.filter(ContentPage.status == status)
    pages = query.order_by(ContentPage.updated_at.desc()).all()
    return pages

@router.post("/admin/content/pages", response_model=ContentPageOut)
def create_cms_page(
    page_in: ContentPageCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    existing = db.query(ContentPage).filter(ContentPage.slug == page_in.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="A content page with this slug already exists")

    page = ContentPage(
        slug=page_in.slug,
        title=page_in.title,
        summary=page_in.summary,
        body_markdown=page_in.body_markdown,
        status=page_in.status,
        current_version=1,
        author_id=current_user.id,
        published_at=datetime.utcnow() if page_in.status == ContentPageStatus.PUBLISHED else None
    )
    db.add(page)
    db.commit()
    db.refresh(page)

    # Create initial version snapshot
    version = ContentPageVersion(
        page_id=page.id,
        version_number=1,
        title=page.title,
        summary=page.summary,
        body_markdown=page.body_markdown,
        status=page.status,
        created_by=current_user.id,
        change_summary="Initial page creation"
    )
    db.add(version)
    db.commit()
    db.refresh(page)

    log_audit_event(
        db=db,
        action="CREATE_CMS_PAGE",
        resource_type="content_page",
        resource_id=page.id,
        user=current_user,
        details={"slug": page.slug, "title": page.title, "status": page.status.value},
        request=request
    )

    return page

@router.get("/admin/content/pages/{page_id}", response_model=ContentPageOut)
def get_cms_page_detail(
    page_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    page = db.query(ContentPage).filter(ContentPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Content page not found")
    return page

@router.put("/admin/content/pages/{page_id}", response_model=ContentPageOut)
def update_cms_page(
    page_id: str,
    page_in: ContentPageUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    page = db.query(ContentPage).filter(ContentPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Content page not found")

    if page_in.title is not None:
        page.title = page_in.title
    if page_in.summary is not None:
        page.summary = page_in.summary
    if page_in.body_markdown is not None:
        page.body_markdown = page_in.body_markdown
    if page_in.status is not None:
        page.status = page_in.status
        if page_in.status == ContentPageStatus.PUBLISHED and not page.published_at:
            page.published_at = datetime.utcnow()

    page.updated_at = datetime.utcnow()
    page.current_version += 1

    # Record version snapshot
    version = ContentPageVersion(
        page_id=page.id,
        version_number=page.current_version,
        title=page.title,
        summary=page.summary,
        body_markdown=page.body_markdown,
        status=page.status,
        created_by=current_user.id,
        change_summary=page_in.change_summary or f"Updated to version {page.current_version}"
    )
    db.add(version)
    db.commit()
    db.refresh(page)

    log_audit_event(
        db=db,
        action="UPDATE_CMS_PAGE",
        resource_type="content_page",
        resource_id=page.id,
        user=current_user,
        details={"slug": page.slug, "version": page.current_version, "status": page.status.value},
        request=request
    )

    return page

@router.post("/admin/content/pages/{page_id}/publish", response_model=ContentPageOut)
def publish_cms_page(
    page_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    page = db.query(ContentPage).filter(ContentPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Content page not found")

    page.status = ContentPageStatus.PUBLISHED
    page.published_at = datetime.utcnow()
    page.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(page)

    log_audit_event(
        db=db,
        action="PUBLISH_CMS_PAGE",
        resource_type="content_page",
        resource_id=page.id,
        user=current_user,
        details={"slug": page.slug, "version": page.current_version},
        request=request
    )

    return page

@router.post("/admin/content/pages/{page_id}/rollback/{version_number}", response_model=ContentPageOut)
def rollback_cms_page(
    page_id: str,
    version_number: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    page = db.query(ContentPage).filter(ContentPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Content page not found")

    version_target = (
        db.query(ContentPageVersion)
        .filter(ContentPageVersion.page_id == page_id, ContentPageVersion.version_number == version_number)
        .first()
    )
    if not version_target:
        raise HTTPException(status_code=404, detail=f"Version {version_number} not found for this page")

    page.title = version_target.title
    page.summary = version_target.summary
    page.body_markdown = version_target.body_markdown
    page.status = version_target.status
    page.current_version += 1
    page.updated_at = datetime.utcnow()

    new_version_record = ContentPageVersion(
        page_id=page.id,
        version_number=page.current_version,
        title=page.title,
        summary=page.summary,
        body_markdown=page.body_markdown,
        status=page.status,
        created_by=current_user.id,
        change_summary=f"Rolled back to Version {version_number}"
    )
    db.add(new_version_record)
    db.commit()
    db.refresh(page)

    log_audit_event(
        db=db,
        action="ROLLBACK_CMS_PAGE",
        resource_type="content_page",
        resource_id=page.id,
        user=current_user,
        details={"slug": page.slug, "target_version": version_number, "new_version": page.current_version},
        request=request
    )

    return page
