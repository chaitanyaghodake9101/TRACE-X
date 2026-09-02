import asyncio
import json
from typing import Dict, Set, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models.user import User, UserRole

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> Set[WebSocket]
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Maps case_id -> Set[WebSocket]
        self.case_subscriptions: Dict[str, Set[WebSocket]] = {}
        # Maps WebSocket -> user object metadata
        self.connection_meta: Dict[WebSocket, Dict[str, str]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, role: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        self.connection_meta[websocket] = {"user_id": user_id, "role": role}

    def disconnect(self, websocket: WebSocket):
        meta = self.connection_meta.pop(websocket, None)
        if meta:
            user_id = meta["user_id"]
            if user_id in self.active_connections:
                self.active_connections[user_id].discard(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
        
        # Remove from case subscriptions
        for case_id in list(self.case_subscriptions.keys()):
            self.case_subscriptions[case_id].discard(websocket)
            if not self.case_subscriptions[case_id]:
                del self.case_subscriptions[case_id]

    def subscribe_case(self, websocket: WebSocket, case_id: str):
        if case_id not in self.case_subscriptions:
            self.case_subscriptions[case_id] = set()
        self.case_subscriptions[case_id].add(websocket)

    async def broadcast_to_case(self, case_id: str, message: dict):
        if case_id in self.case_subscriptions:
            payload = json.dumps(message)
            for ws in list(self.case_subscriptions[case_id]):
                try:
                    await ws.send_text(payload)
                except Exception:
                    self.disconnect(ws)

    async def broadcast_to_admins(self, message: dict):
        payload = json.dumps(message)
        for ws, meta in list(self.connection_meta.items()):
            if meta.get("role") in ["admin", "auditor"]:
                try:
                    await ws.send_text(payload)
                except Exception:
                    self.disconnect(ws)

manager = ConnectionManager()

def broadcast_event_sync(payload: dict):
    """Synchronous helper invoked by domain outbox processor to broadcast to WebSockets."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    case_id = payload.get("data", {}).get("case_id") or payload.get("aggregate_id")
    
    if loop.is_running():
        if case_id:
            asyncio.create_task(manager.broadcast_to_case(case_id, payload))
        asyncio.create_task(manager.broadcast_to_admins(payload))
    else:
        if case_id:
            loop.run_until_complete(manager.broadcast_to_case(case_id, payload))
        loop.run_until_complete(manager.broadcast_to_admins(payload))

@router.websocket("/ws/events")
async def websocket_event_stream(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = payload.get("sub")
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user_role = user.role.value
    finally:
        db.close()

    await manager.connect(websocket, user_id=user_id, role=user_role)

    try:
        # Send initial connection confirmation
        await websocket.send_text(json.dumps({
            "event": "ws.connected",
            "message": "Connected to TRACE-X Real-Time Intelligence Stream"
        }))

        while True:
            data_text = await websocket.receive_text()
            try:
                msg = json.loads(data_text)
                action = msg.get("action")
                if action == "subscribe" and msg.get("case_id"):
                    manager.subscribe_case(websocket, msg["case_id"])
                    await websocket.send_text(json.dumps({
                        "event": "ws.subscribed",
                        "case_id": msg["case_id"]
                    }))
                elif action == "ping":
                    await websocket.send_text(json.dumps({"event": "ws.pong"}))
            except Exception:
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
