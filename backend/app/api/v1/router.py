from fastapi import APIRouter

from app.api.v1.endpoints import agents, auth, content, locations, properties

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(properties.router)
api_router.include_router(locations.router)
api_router.include_router(agents.router)
api_router.include_router(content.router)
api_router.include_router(content.admin_router)
