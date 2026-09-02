import logging
from typing import Optional, List, Dict, Any
from neo4j import GraphDatabase, Driver
from app.core.config import settings

logger = logging.getLogger("tracex.neo4j")

class Neo4jClient:
    def __init__(self):
        self._driver: Optional[Driver] = None
        self._is_connected = False

    def connect(self) -> bool:
        if self._driver is not None and self._is_connected:
            return True
        try:
            self._driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
                max_connection_lifetime=30 * 60,
                max_connection_pool_size=50,
                connection_acquisition_timeout=5.0
            )
            # Verify connectivity
            self._driver.verify_connectivity()
            self._is_connected = True
            logger.info("Successfully connected to Neo4j.")
            return True
        except Exception as e:
            logger.warning(f"Neo4j connection could not be established ({e}). Running in fallback mode.")
            self._is_connected = False
            return False

    def close(self):
        if self._driver:
            self._driver.close()
            self._is_connected = False

    @property
    def is_connected(self) -> bool:
        if not self._is_connected:
            return self.connect()
        return self._is_connected

    def execute_query(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        if not self.is_connected or not self._driver:
            logger.warning(f"Executing Cypher query in offline mode: {query}")
            return []
        
        try:
            with self._driver.session(database=settings.NEO4J_DATABASE) as session:
                result = session.run(query, parameters or {})
                return [record.data() for record in result]
        except Exception as e:
            logger.error(f"Error executing Cypher query: {e}")
            return []

    def check_health(self) -> bool:
        try:
            if not self._driver:
                return self.connect()
            self._driver.verify_connectivity()
            return True
        except Exception:
            return False

neo4j_client = Neo4jClient()
