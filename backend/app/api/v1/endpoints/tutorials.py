import re
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.audit import log_audit_event
from app.models.user import User
from app.models.tutorial import Tutorial, TutorialProgress
from app.schemas.tutorial import (
    TutorialCreate,
    TutorialUpdate,
    TutorialOut,
    TutorialProgressUpdate,
    TutorialProgressOut
)
from app.api.v1.endpoints.auth import get_current_user, get_optional_current_user
from app.api.v1.endpoints.admin import require_admin

router = APIRouter(tags=["Tutorials"])

def extract_youtube_id(url_or_id: Optional[str]) -> Optional[str]:
    if not url_or_id:
        return None
    if len(url_or_id) == 11 and re.match(r"^[a-zA-Z0-9_-]{11}$", url_or_id):
        return url_or_id
    regex = r"(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})"
    match = re.search(regex, url_or_id)
    if match:
        return match.group(1)
    return None

@router.get("/tutorials", response_model=List[TutorialOut])
def list_published_tutorials(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    query = db.query(Tutorial).filter(Tutorial.is_published == True)
    if category and category != "all":
        query = query.filter(Tutorial.category == category)
    tutorials = query.order_by(Tutorial.order_index.asc(), Tutorial.created_at.asc()).all()

    results = []
    for tut in tutorials:
        prog_out = None
        if current_user:
            prog = (
                db.query(TutorialProgress)
                .filter(TutorialProgress.tutorial_id == tut.id, TutorialProgress.user_id == current_user.id)
                .first()
            )
            if prog:
                prog_out = TutorialProgressOut.from_orm(prog)

        results.append(
            TutorialOut(
                id=tut.id,
                title=tut.title,
                description=tut.description,
                category=tut.category,
                video_url=tut.video_url,
                youtube_id=tut.youtube_id,
                duration_minutes=tut.duration_minutes,
                order_index=tut.order_index,
                is_published=tut.is_published,
                steps_json=tut.steps_json or [],
                created_at=tut.created_at,
                updated_at=tut.updated_at,
                user_progress=prog_out
            )
        )
    return results

@router.get("/tutorials/{tutorial_id}", response_model=TutorialOut)
def get_tutorial_detail(
    tutorial_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    tut = db.query(Tutorial).filter(Tutorial.id == tutorial_id).first()
    if not tut:
        raise HTTPException(status_code=404, detail="Tutorial not found")

    prog_out = None
    if current_user:
        prog = (
            db.query(TutorialProgress)
            .filter(TutorialProgress.tutorial_id == tut.id, TutorialProgress.user_id == current_user.id)
            .first()
        )
        if prog:
            prog_out = TutorialProgressOut.from_orm(prog)

    return TutorialOut(
        id=tut.id,
        title=tut.title,
        description=tut.description,
        category=tut.category,
        video_url=tut.video_url,
        youtube_id=tut.youtube_id,
        duration_minutes=tut.duration_minutes,
        order_index=tut.order_index,
        is_published=tut.is_published,
        steps_json=tut.steps_json or [],
        created_at=tut.created_at,
        updated_at=tut.updated_at,
        user_progress=prog_out
    )

@router.post("/tutorials/{tutorial_id}/progress", response_model=TutorialProgressOut)
def update_tutorial_progress(
    tutorial_id: str,
    progress_in: TutorialProgressUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tut = db.query(Tutorial).filter(Tutorial.id == tutorial_id).first()
    if not tut:
        raise HTTPException(status_code=404, detail="Tutorial not found")

    prog = (
        db.query(TutorialProgress)
        .filter(TutorialProgress.tutorial_id == tutorial_id, TutorialProgress.user_id == current_user.id)
        .first()
    )
    if not prog:
        prog = TutorialProgress(
            tutorial_id=tutorial_id,
            user_id=current_user.id,
            completed=False,
            last_step_index=0
        )
        db.add(prog)

    if progress_in.last_step_index is not None:
        prog.last_step_index = progress_in.last_step_index
    if progress_in.completed is not None:
        prog.completed = progress_in.completed
        if progress_in.completed and not prog.completed_at:
            prog.completed_at = datetime.utcnow()

    prog.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(prog)
    return TutorialProgressOut.from_orm(prog)

# --- Admin Endpoints ---
@router.get("/admin/tutorials", response_model=List[TutorialOut])
def admin_list_tutorials(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    query = db.query(Tutorial)
    if category and category != "all":
        query = query.filter(Tutorial.category == category)
    tutorials = query.order_by(Tutorial.order_index.asc(), Tutorial.created_at.desc()).all()
    return [
        TutorialOut(
            id=t.id,
            title=t.title,
            description=t.description,
            category=t.category,
            video_url=t.video_url,
            youtube_id=t.youtube_id,
            duration_minutes=t.duration_minutes,
            order_index=t.order_index,
            is_published=t.is_published,
            steps_json=t.steps_json or [],
            created_at=t.created_at,
            updated_at=t.updated_at,
            user_progress=None
        )
        for t in tutorials
    ]

@router.post("/admin/tutorials", response_model=TutorialOut)
def create_tutorial(
    tut_in: TutorialCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    yt_id = extract_youtube_id(tut_in.video_url)

    steps_data = [s.dict() for s in tut_in.steps]
    tut = Tutorial(
        title=tut_in.title,
        description=tut_in.description,
        category=tut_in.category,
        video_url=tut_in.video_url,
        youtube_id=yt_id,
        duration_minutes=tut_in.duration_minutes,
        order_index=tut_in.order_index,
        is_published=tut_in.is_published,
        steps_json=steps_data
    )
    db.add(tut)
    db.commit()
    db.refresh(tut)

    log_audit_event(
        db=db,
        action="CREATE_TUTORIAL",
        resource_type="tutorial",
        resource_id=tut.id,
        user=current_user,
        details={"title": tut.title, "category": tut.category, "youtube_id": yt_id},
        request=request
    )

    return TutorialOut(
        id=tut.id,
        title=tut.title,
        description=tut.description,
        category=tut.category,
        video_url=tut.video_url,
        youtube_id=tut.youtube_id,
        duration_minutes=tut.duration_minutes,
        order_index=tut.order_index,
        is_published=tut.is_published,
        steps_json=tut.steps_json or [],
        created_at=tut.created_at,
        updated_at=tut.updated_at,
        user_progress=None
    )

@router.put("/admin/tutorials/{tutorial_id}", response_model=TutorialOut)
def update_tutorial(
    tutorial_id: str,
    tut_in: TutorialUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    tut = db.query(Tutorial).filter(Tutorial.id == tutorial_id).first()
    if not tut:
        raise HTTPException(status_code=404, detail="Tutorial not found")

    if tut_in.title is not None:
        tut.title = tut_in.title
    if tut_in.description is not None:
        tut.description = tut_in.description
    if tut_in.category is not None:
        tut.category = tut_in.category
    if tut_in.duration_minutes is not None:
        tut.duration_minutes = tut_in.duration_minutes
    if tut_in.order_index is not None:
        tut.order_index = tut_in.order_index
    if tut_in.is_published is not None:
        tut.is_published = tut_in.is_published
    if tut_in.steps is not None:
        tut.steps_json = [s.dict() for s in tut_in.steps]
    if tut_in.video_url is not None:
        tut.video_url = tut_in.video_url
        tut.youtube_id = extract_youtube_id(tut_in.video_url)

    tut.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(tut)

    log_audit_event(
        db=db,
        action="UPDATE_TUTORIAL",
        resource_type="tutorial",
        resource_id=tut.id,
        user=current_user,
        details={"title": tut.title, "youtube_id": tut.youtube_id},
        request=request
    )

    return TutorialOut(
        id=tut.id,
        title=tut.title,
        description=tut.description,
        category=tut.category,
        video_url=tut.video_url,
        youtube_id=tut.youtube_id,
        duration_minutes=tut.duration_minutes,
        order_index=tut.order_index,
        is_published=tut.is_published,
        steps_json=tut.steps_json or [],
        created_at=tut.created_at,
        updated_at=tut.updated_at,
        user_progress=None
    )

@router.delete("/admin/tutorials/{tutorial_id}")
def delete_tutorial(
    tutorial_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    tut = db.query(Tutorial).filter(Tutorial.id == tutorial_id).first()
    if not tut:
        raise HTTPException(status_code=404, detail="Tutorial not found")

    title = tut.title
    db.delete(tut)
    db.commit()

    log_audit_event(
        db=db,
        action="DELETE_TUTORIAL",
        resource_type="tutorial",
        resource_id=tutorial_id,
        user=current_user,
        details={"title": title},
        request=request
    )

    return {"message": f"Tutorial '{title}' deleted successfully", "id": tutorial_id}
