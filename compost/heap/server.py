#!/usr/bin/env python3
"""
Research Pipeline Dashboard Server

Serves the HTML dashboard interface and provides REST API for:
- Pipeline status (from PROGRESS.md)
- Experiments data (from IMPROVEMENT-LOG.md)
- Inbox items (from inbox/*.md)
- Archive contents (from archive/*/)
- Raw file access (for detail views)
"""

import json
import logging
import os
import re
import secrets
import sqlite3
import time
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse, unquote
from pathlib import Path
from typing import Optional, Tuple, Any

# Paths
SCRIPT_DIR = Path(__file__).parent
DB_PATH = SCRIPT_DIR / 'workspace.db'
PIPELINE_ROOT = SCRIPT_DIR.parent  # research-pipeline/
AUTH_CONFIG_PATH = SCRIPT_DIR / 'auth.json'
LOG_PATH = SCRIPT_DIR / 'human-door.log'

# Security constants
MAX_CONTENT_LENGTH = 1024 * 1024  # 1MB max request size
MAX_FTS_QUERY_LENGTH = 200

# Rate limiting (simple in-memory, per-IP)
_request_counts: dict[str, list[float]] = {}
RATE_LIMIT_REQUESTS = 100
RATE_LIMIT_WINDOW = 60  # seconds

# Authentication
AUTH_ENABLED = False  # Set to True to enable token auth
_auth_token: Optional[str] = None

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('human-door')


# ============ Authentication Functions ============

def get_or_create_auth_token() -> str:
    """Get existing auth token or create a new one."""
    global _auth_token

    if _auth_token:
        return _auth_token

    # Try to load from config file
    if AUTH_CONFIG_PATH.exists():
        try:
            with open(AUTH_CONFIG_PATH, 'r') as f:
                config = json.load(f)
                _auth_token = config.get('token')
                if _auth_token:
                    return _auth_token
        except Exception as e:
            logger.warning(f"Failed to load auth config: {e}")

    # Generate new token
    _auth_token = secrets.token_urlsafe(32)

    # Save to config file
    try:
        with open(AUTH_CONFIG_PATH, 'w') as f:
            json.dump({
                'token': _auth_token,
                'created_at': datetime.now().isoformat(),
                'note': 'Keep this token secret. Required for write operations.'
            }, f, indent=2)
        logger.info(f"Generated new auth token, saved to {AUTH_CONFIG_PATH}")
    except Exception as e:
        logger.error(f"Failed to save auth config: {e}")

    return _auth_token


def validate_auth_token(provided_token: str) -> bool:
    """Validate the provided auth token."""
    if not AUTH_ENABLED:
        return True  # Auth disabled, always allow

    expected_token = get_or_create_auth_token()
    return secrets.compare_digest(provided_token, expected_token)


# ============ Security Helper Functions ============

def sanitize_filename(filename: str) -> str:
    """Sanitize a filename to prevent path traversal and ensure safe characters."""
    # Strip directory components
    filename = os.path.basename(filename)
    # Remove null bytes and other dangerous characters
    filename = filename.replace('\x00', '').replace('\\', '').replace('/', '')
    # Only allow alphanumeric, dash, underscore, and dot
    filename = re.sub(r'[^\w\-.]', '_', filename)
    # Ensure it ends with .md
    if not filename.endswith('.md'):
        filename = filename.rstrip('.') + '.md'
    return filename


def sanitize_fts_query(query: str) -> str:
    """Sanitize FTS5 query to prevent injection attacks."""
    if not query:
        return ""
    # Limit length
    query = query[:MAX_FTS_QUERY_LENGTH]
    # Remove all special characters except alphanumeric, spaces, and hyphens
    # This prevents FTS5 syntax errors and injection
    query = re.sub(r'[^\w\s\-]', ' ', query)
    # Collapse multiple spaces
    query = re.sub(r'\s+', ' ', query).strip()
    return query


def safe_path_join(base_dir: Path, filename: str) -> Optional[Path]:
    """
    Safely join a base directory with a filename, preventing path traversal.
    Returns None if the path is unsafe.
    """
    # Get the base dir's real path
    base_real = base_dir.resolve()

    # Sanitize the filename
    safe_name = sanitize_filename(filename)

    # Construct the full path
    full_path = base_real / safe_name

    # Resolve to get the real path
    try:
        real_path = full_path.resolve()
    except (OSError, RuntimeError):
        return None

    # Verify it's within the base directory
    try:
        real_path.relative_to(base_real)
    except ValueError:
        return None

    # Check for symlinks (security risk)
    if real_path.is_symlink():
        return None

    return real_path


def validate_json_request(handler) -> Tuple[Optional[dict], Optional[str]]:
    """
    Validate and parse JSON request body.
    Returns (data, error_message). If successful, error_message is None.
    """
    # Check Content-Length header
    content_length_str = handler.headers.get('Content-Length', '0')
    try:
        content_length = int(content_length_str)
    except ValueError:
        return None, "Invalid Content-Length header"

    # Validate content length
    if content_length < 0:
        return None, "Content-Length cannot be negative"
    if content_length > MAX_CONTENT_LENGTH:
        return None, f"Request body too large (max {MAX_CONTENT_LENGTH} bytes)"

    # Read and parse body
    try:
        body = handler.rfile.read(content_length)
        data = json.loads(body)
    except json.JSONDecodeError as e:
        return None, f"Invalid JSON: {str(e)}"
    except Exception as e:
        return None, f"Failed to read request body: {str(e)}"

    return data, None


def check_rate_limit(client_ip: str) -> bool:
    """
    Check if the client IP is within rate limits.
    Returns True if allowed, False if rate limited.
    """
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW

    # Get or create request list for this IP
    if client_ip not in _request_counts:
        _request_counts[client_ip] = []

    # Clean old requests
    _request_counts[client_ip] = [
        t for t in _request_counts[client_ip] if t > window_start
    ]

    # Check limit
    if len(_request_counts[client_ip]) >= RATE_LIMIT_REQUESTS:
        return False

    # Record this request
    _request_counts[client_ip].append(now)
    return True


def get_client_ip(handler) -> str:
    """Get the client IP address from the handler."""
    return handler.client_address[0] if handler.client_address else 'unknown'

# Import parsers
import sys
sys.path.insert(0, str(SCRIPT_DIR))
from parsers import parse_progress, parse_experiments, list_inbox, list_archive


class DashboardHandler(SimpleHTTPRequestHandler):
    """Custom handler that serves static files and API endpoints."""

    def log_request_method(self, method: str, status: int = 200):
        """Log request details for audit trail."""
        client_ip = get_client_ip(self)
        path = self.path
        logger.info(f"{method} {path} - {status} - {client_ip}")

    def check_write_auth(self) -> bool:
        """Check authentication for write operations."""
        if not AUTH_ENABLED:
            return True

        # Check Authorization header
        auth_header = self.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            if validate_auth_token(token):
                return True

        # Check X-Auth-Token header
        token = self.headers.get('X-Auth-Token', '')
        if token and validate_auth_token(token):
            return True

        self.send_error_response(401, "Authentication required")
        return False

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/status':
            self.handle_get_status()
        elif path == '/api/experiments':
            self.handle_get_experiments()
        elif path == '/api/inbox':
            self.handle_get_inbox()
        elif path == '/api/archive':
            self.handle_get_archive()
        elif path == '/api/archive/stats':
            self.handle_get_archive_stats()
        elif path == '/api/next-experiment':
            self.handle_get_next_experiment()
        elif path.startswith('/api/pipeline/'):
            topic = unquote(path[len('/api/pipeline/'):])
            self.handle_get_pipeline(topic)
        elif path.startswith('/api/file/'):
            filepath = unquote(path[len('/api/file/'):])
            self.handle_get_file(filepath)
        elif path == '/api/thoughts':
            self.handle_get_thoughts()
        elif path == '/api/search':
            self.handle_search()
        elif path == '/' or path == '/index.html':
            self.serve_index()
        else:
            super().do_GET()

    def do_POST(self):
        # Check rate limit for write operations
        client_ip = get_client_ip(self)
        if not check_rate_limit(client_ip):
            self.send_error_response(429, "Rate limit exceeded. Try again later.")
            self.log_request_method('POST', 429)
            return

        # Check authentication for write operations
        if not self.check_write_auth():
            self.log_request_method('POST', 401)
            return

        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/thoughts':
            self.handle_create_thought()
        elif path == '/api/inbox':
            self.handle_create_inbox()
        else:
            self.send_error(404, "Not Found")
            self.log_request_method('POST', 404)

    def do_PUT(self):
        # Check rate limit for write operations
        client_ip = get_client_ip(self)
        if not check_rate_limit(client_ip):
            self.send_error_response(429, "Rate limit exceeded. Try again later.")
            self.log_request_method('PUT', 429)
            return

        # Check authentication for write operations
        if not self.check_write_auth():
            self.log_request_method('PUT', 401)
            return

        match = re.match(r'/api/thoughts/(\d+)', self.path)
        inbox_match = re.match(r'/api/inbox/(.+)', self.path)
        if match:
            self.handle_update_thought(int(match.group(1)))
        elif inbox_match:
            self.handle_update_inbox(unquote(inbox_match.group(1)))
        else:
            self.send_error(404, "Not Found")
            self.log_request_method('PUT', 404)

    def do_DELETE(self):
        # Check rate limit for write operations
        client_ip = get_client_ip(self)
        if not check_rate_limit(client_ip):
            self.send_error_response(429, "Rate limit exceeded. Try again later.")
            self.log_request_method('DELETE', 429)
            return

        # Check authentication for write operations
        if not self.check_write_auth():
            self.log_request_method('DELETE', 401)
            return

        match = re.match(r'/api/thoughts/(\d+)', self.path)
        inbox_match = re.match(r'/api/inbox/(.+)', self.path)

        if match:
            self.handle_delete_thought(int(match.group(1)))
        elif inbox_match:
            self.handle_delete_inbox(unquote(inbox_match.group(1)))
        else:
            self.send_error(404, "Not Found")
            self.log_request_method('DELETE', 404)

    def serve_index(self):
        """Serve the main HTML file."""
        self.path = '/index.html'
        super().do_GET()

    # ============ Dashboard API Endpoints ============

    def handle_get_status(self):
        """GET /api/status - Get current pipeline status."""
        try:
            progress_path = PIPELINE_ROOT / "PROGRESS.md"
            content = progress_path.read_text() if progress_path.exists() else ""
            data = parse_progress(content)
            self.send_json(data)
        except Exception as e:
            self.send_error_response(500, str(e))

    def handle_get_experiments(self):
        """GET /api/experiments - Get experiment data."""
        try:
            log_path = PIPELINE_ROOT / "IMPROVEMENT-LOG.md"
            content = log_path.read_text() if log_path.exists() else ""
            data = parse_experiments(content)
            self.send_json(data)
        except Exception as e:
            self.send_error_response(500, str(e))

    def handle_get_inbox(self):
        """GET /api/inbox - Get inbox items."""
        try:
            inbox_dir = PIPELINE_ROOT / "inbox"
            items = list_inbox(inbox_dir)
            self.send_json(items)
        except Exception as e:
            self.send_error_response(500, str(e))

    def handle_get_archive(self):
        """GET /api/archive - Get archive contents."""
        try:
            archive_dir = PIPELINE_ROOT / "archive"
            from parsers.archive import list_archive
            items = list_archive(archive_dir)
            self.send_json(items)
        except Exception as e:
            self.send_error_response(500, str(e))

    def handle_get_archive_stats(self):
        """GET /api/archive/stats - Get archive statistics."""
        try:
            archive_dir = PIPELINE_ROOT / "archive"
            from parsers.archive import get_archive_stats
            stats = get_archive_stats(archive_dir)
            self.send_json(stats)
        except Exception as e:
            self.send_error_response(500, str(e))

    def handle_get_next_experiment(self):
        """GET /api/next-experiment - Recommend next experiment based on current weakest."""
        try:
            # Get current weakest from status
            progress_path = PIPELINE_ROOT / "PROGRESS.md"
            progress_content = progress_path.read_text() if progress_path.exists() else ""
            status = parse_progress(progress_content)

            # Get experiments
            log_path = PIPELINE_ROOT / "IMPROVEMENT-LOG.md"
            log_content = log_path.read_text() if log_path.exists() else ""
            experiments = parse_experiments(log_content)

            # Map component names to experiment targets
            target_map = {
                "Source Credibility": "Credibility",
                "Depth": "Depth",
                "Actionability": "Actionability",
                "Recency": "Recency",
                "Gap Fill": "Gap Fill",
            }

            weakest = status.get("weakest_component")
            weakest_score = status.get("weakest_score")

            if not weakest:
                self.send_json({"experiment": None, "reason": "No component scores available"})
                return

            target = target_map.get(weakest, weakest)

            # Find experiments targeting this component with fewest runs
            active_experiments = experiments.get("active", [])
            candidates = [
                e for e in active_experiments
                if target.lower() in e["target"].lower() and e["runs"] < 3
            ]

            # Sort by runs (fewest first), then by score (highest first)
            if candidates:
                recommended = sorted(candidates, key=lambda e: (e["runs"], -e["score"]))[0]
                self.send_json({
                    "experiment": recommended["id"],
                    "name": recommended["name"],
                    "target": target,
                    "weakest_component": weakest,
                    "weakest_score": weakest_score,
                    "reason": f"Targets weakest component ({weakest}: {weakest_score})"
                })
            else:
                # Fallback: pick any experiment with fewest runs
                if active_experiments:
                    fallback = sorted(active_experiments, key=lambda e: (e["runs"], -e["score"]))[0]
                    self.send_json({
                        "experiment": fallback["id"],
                        "name": fallback["name"],
                        "target": fallback["target"],
                        "weakest_component": weakest,
                        "weakest_score": weakest_score,
                        "reason": f"No experiments directly target {target}, using fallback"
                    })
                else:
                    self.send_json({
                        "experiment": None,
                        "reason": f"No active experiments available",
                        "weakest_component": weakest,
                        "weakest_score": weakest_score
                    })
        except Exception as e:
            self.send_error_response(500, str(e))

    def handle_get_pipeline(self, topic: str):
        """GET /api/pipeline/:topic - Get stage progress for a topic."""
        try:
            stages = []
            stage_dirs = sorted(PIPELINE_ROOT.glob("stages/*"))

            for stage_dir in stage_dirs:
                if not stage_dir.is_dir():
                    continue

                stage_name = stage_dir.name
                output_dir = stage_dir / "output"

                # Check for files matching this topic
                status = "pending"
                output_files = []

                if output_dir.exists():
                    # Look for files matching the topic (slug format)
                    topic_slug = topic.lower().replace(' ', '-').replace('_', '-')
                    matching_files = list(output_dir.glob(f"*{topic_slug}*.md"))

                    if not matching_files:
                        # Also check for exact match files
                        matching_files = list(output_dir.glob(f"{topic_slug}.md"))

                    if matching_files:
                        status = "done"
                        output_files = [f.name for f in matching_files]

                stages.append({
                    "stage": stage_name,
                    "status": status,
                    "files": output_files
                })

            self.send_json({
                "topic": topic,
                "stages": stages
            })
        except Exception as e:
            self.send_error_response(500, str(e))

    def handle_get_file(self, filepath: str):
        """GET /api/file/* - Read any markdown file."""
        try:
            # Security: use safe path join to prevent traversal
            # Strip any directory components from the filepath
            safe_name = os.path.basename(filepath)

            # Only allow .md files
            if not safe_name.endswith('.md'):
                self.send_error_response(403, "Access denied: only markdown files allowed")
                return

            full_path = PIPELINE_ROOT / safe_name

            # Resolve and verify it's within pipeline root
            try:
                real_path = full_path.resolve()
                real_path.relative_to(PIPELINE_ROOT.resolve())
            except (ValueError, OSError):
                self.send_error_response(403, "Access denied: path traversal attempt blocked")
                return

            # Check for symlinks
            if real_path.is_symlink():
                self.send_error_response(403, "Access denied: symlinks not allowed")
                return

            if not real_path.exists():
                self.send_error_response(404, "File not found")
                return

            content = real_path.read_text()
            self.send_json({
                "path": safe_name,
                "content": content
            })
        except Exception as e:
            self.send_error_response(500, str(e))

    def handle_create_inbox(self):
        """POST /api/inbox - Create new inbox item."""
        # Validate request
        data, error = validate_json_request(self)
        if error:
            self.send_error_response(400, error)
            return

        try:
            from parsers.inbox import create_inbox_item
            inbox_dir = PIPELINE_ROOT / "inbox"
            title = data.get('title', 'Untitled')
            # Limit title length
            title = str(title)[:200] if title else 'Untitled'
            content = data.get('content')

            filepath = create_inbox_item(inbox_dir, title, content)
            self.send_json({
                'filename': filepath.name,
                'status': 'created'
            }, 201)
        except Exception as e:
            self.send_error_response(500, str(e))

    def handle_update_inbox(self, filename: str):
        """PUT /api/inbox/:filename - Update an inbox item."""
        # Validate request
        data, error = validate_json_request(self)
        if error:
            self.send_error_response(400, error)
            return

        try:
            inbox_dir = PIPELINE_ROOT / "inbox"

            # Use safe path join to prevent traversal
            filepath = safe_path_join(inbox_dir, filename)
            if filepath is None:
                self.send_error_response(403, "Access denied: invalid filename")
                return

            if not filepath.exists():
                self.send_error_response(404, "File not found")
                return

            # Write updated content
            content = data.get('content', '')
            # Limit content size
            if len(content) > MAX_CONTENT_LENGTH:
                self.send_error_response(400, f"Content too large (max {MAX_CONTENT_LENGTH} bytes)")
                return
            filepath.write_text(content)
            self.send_json({'filename': filepath.name, 'status': 'updated'})
        except Exception as e:
            self.send_error_response(500, str(e))

    def handle_delete_inbox(self, filename: str):
        """DELETE /api/inbox/:filename - Delete an inbox item."""
        try:
            inbox_dir = PIPELINE_ROOT / "inbox"

            # Use safe path join to prevent traversal
            filepath = safe_path_join(inbox_dir, filename)
            if filepath is None:
                self.send_error_response(403, "Access denied: invalid filename")
                return

            if not filepath.exists():
                self.send_error_response(404, "File not found")
                return

            # Atomic delete
            filepath.unlink()
            self.send_json({'filename': filepath.name, 'status': 'deleted'})
        except Exception as e:
            self.send_error_response(500, str(e))

    # ============ Legacy Thoughts API (kept for backward compat) ============

    def handle_get_thoughts(self):
        """GET /api/thoughts - List all thoughts."""
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, content, source, category, metadata, created_at, updated_at
                FROM thoughts
                ORDER BY created_at DESC
                LIMIT 100
            ''')
            thoughts = []
            for row in cursor.fetchall():
                thoughts.append({
                    'id': row[0],
                    'content': row[1],
                    'source': row[2],
                    'category': row[3],
                    'metadata': json.loads(row[4]) if row[4] else None,
                    'created_at': row[5],
                    'updated_at': row[6]
                })
            self.send_json(thoughts)
            conn.close()
        except Exception as e:
            self.send_error_response(500, str(e))

    def handle_search(self):
        """GET /api/search?q=query - Search thoughts."""
        query = parse_qs(urlparse(self.path).query).get('q', [''])[0]
        if not query:
            self.handle_get_thoughts()
            return

        # Sanitize the FTS5 query
        safe_query = sanitize_fts_query(query)
        if not safe_query:
            self.send_json([])  # Empty result for invalid query
            return

        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            # Use FTS5 for search with sanitized query
            cursor.execute('''
                SELECT t.id, t.content, t.source, t.category, t.metadata, t.created_at, t.updated_at
                FROM thoughts t
                JOIN thoughts_fts fts ON t.id = fts.rowid
                WHERE thoughts_fts MATCH ?
                ORDER BY bm25(thoughts_fts) DESC
                LIMIT 20
            ''', (safe_query,))
            thoughts = []
            for row in cursor.fetchall():
                thoughts.append({
                    'id': row[0],
                    'content': row[1],
                    'source': row[2],
                    'category': row[3],
                    'metadata': json.loads(row[4]) if row[4] else None,
                    'created_at': row[5],
                    'updated_at': row[6]
                })
            self.send_json(thoughts)
            conn.close()
        except Exception as e:
            self.send_error_response(500, str(e))

    def handle_create_thought(self):
        """POST /api/thoughts - Create a new thought."""
        # Validate request
        data, error = validate_json_request(self)
        if error:
            self.send_error_response(400, error)
            return

        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO thoughts (content, source, category, metadata)
                VALUES (?, ?, ?, ?)
            ''', (
                str(data.get('content', ''))[:MAX_CONTENT_LENGTH],
                str(data.get('source', 'human'))[:100],
                str(data.get('category', ''))[:100] if data.get('category') else None,
                json.dumps(data.get('metadata', {}))
            ))
            conn.commit()
            thought_id = cursor.lastrowid
            conn.close()
            self.send_json({'id': thought_id, 'status': 'created'}, 201)
        except Exception as e:
            self.send_error_response(500, str(e))

    def handle_update_thought(self, thought_id):
        """PUT /api/thoughts/:id - Update a thought."""
        # Validate request
        data, error = validate_json_request(self)
        if error:
            self.send_error_response(400, error)
            return

        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE thoughts
                SET content = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (str(data.get('content', ''))[:MAX_CONTENT_LENGTH], thought_id))
            conn.commit()
            conn.close()
            self.send_json({'id': thought_id, 'status': 'updated'})
        except Exception as e:
            self.send_error_response(500, str(e))

    def handle_delete_thought(self, thought_id):
        """DELETE /api/thoughts/:id - Delete a thought."""
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM thoughts WHERE id = ?", (thought_id,))
            conn.commit()
            conn.close()
            self.send_json({'id': thought_id, 'status': 'deleted'})
        except Exception as e:
            self.send_error_response(500, str(e))

    # ============ Helpers ============

    def send_json(self, data, status=200):
        """Send JSON response."""
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        # Restrict CORS to localhost only
        self.send_header('Access-Control-Allow-Origin', 'http://localhost:8765')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.end_headers()
        self.wfile.write(body)

    def send_error_response(self, status, message):
        """Send error response."""
        body = json.dumps({'error': message}).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    PORT = 8765
    print(f"Research Pipeline Dashboard running at http://localhost:{PORT}")
    print(f"Open http://localhost:{PORT} in your browser or phone")
    HTTPServer(('', PORT), DashboardHandler).serve_forever()
