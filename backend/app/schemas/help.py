from typing import List, Optional
from pydantic import BaseModel

class FAQItem(BaseModel):
    id: str
    question: str
    category: str # 'Chain-of-Custody' | 'Investigation & Graph' | 'Hypotheses' | 'Admin & Security'
    answer: str
    tags: List[str]

class KnowledgeArticle(BaseModel):
    id: str
    slug: str
    title: str
    category: str # 'Getting Started' | 'Evidence Management' | 'Chain-of-Custody' | 'Admin Guide'
    reading_time: str
    summary: str
    content_markdown: str

class VideoTutorial(BaseModel):
    id: str
    title: str
    duration: str
    description: str
    category: str
    embed_url: str
    thumbnail_icon: str
