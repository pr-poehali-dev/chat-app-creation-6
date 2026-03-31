"""Контакты (друзья): поиск, добавление, список, принятие/отклонение заявок"""
import json
import os
import psycopg2


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def cors():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-User-Id",
        "Content-Type": "application/json"
    }


def get_user_from_token(cur, token):
    if not token:
        return None
    cur.execute("SELECT user_id FROM sessions WHERE token = %s AND expires_at > NOW()", (token,))
    row = cur.fetchone()
    return str(row[0]) if row else None


def handler(event: dict, context) -> dict:
    """Управление контактами: список друзей, поиск, заявки в друзья"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors(), "body": ""}

    method = event.get("httpMethod", "GET")
    headers = event.get("headers", {})
    token = headers.get("X-Auth-Token") or headers.get("x-auth-token")
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

    conn = get_conn()
    cur = conn.cursor()
    user_id = get_user_from_token(cur, token)

    if not user_id:
        cur.close(); conn.close()
        return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Не авторизован"})}

    try:
        if method == "GET" and action == "list":
            return list_contacts(cur, user_id, params)
        elif method == "POST" and action == "add":
            return add_contact(cur, conn, event, user_id)
        elif method == "PUT" and action == "respond":
            contact_id = params.get("id", "")
            return update_contact(cur, conn, event, user_id, contact_id)
        elif method == "GET" and action == "search":
            return search_users(cur, user_id, params)
        else:
            return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Not found"})}
    finally:
        cur.close(); conn.close()


def list_contacts(cur, user_id: str, params: dict) -> dict:
    status_filter = params.get("status", "accepted")
    cur.execute("""
        SELECT c.id, c.status, c.created_at,
               u.id as uid, u.username, u.display_name, u.avatar_url, u.is_online, u.last_seen, u.agent_name,
               'outgoing' as direction
        FROM contacts c JOIN users u ON c.contact_id = u.id
        WHERE c.user_id = %s AND c.status = %s
        UNION ALL
        SELECT c.id, c.status, c.created_at,
               u.id as uid, u.username, u.display_name, u.avatar_url, u.is_online, u.last_seen, u.agent_name,
               'incoming' as direction
        FROM contacts c JOIN users u ON c.user_id = u.id
        WHERE c.contact_id = %s AND c.status = %s
        ORDER BY created_at DESC
    """, (user_id, status_filter, user_id, status_filter))

    rows = cur.fetchall()
    contacts = []
    for r in rows:
        contacts.append({
            "id": str(r[0]), "status": r[1],
            "created_at": r[2].isoformat() if r[2] else None,
            "user": {
                "id": str(r[3]), "username": r[4], "display_name": r[5],
                "avatar_url": r[6], "is_online": r[7],
                "last_seen": r[8].isoformat() if r[8] else None,
                "agent_name": r[9]
            },
            "direction": r[10]
        })
    return {"statusCode": 200, "headers": cors(), "body": json.dumps({"contacts": contacts})}


def add_contact(cur, conn, event: dict, user_id: str) -> dict:
    body = json.loads(event.get("body") or "{}")
    target_id = body.get("user_id") or body.get("contact_id")
    username = body.get("username")

    if not target_id and username:
        cur.execute("SELECT id FROM users WHERE username = %s", (username.lower(),))
        row = cur.fetchone()
        if not row:
            return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Пользователь не найден"})}
        target_id = str(row[0])

    if not target_id:
        return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "user_id или username обязателен"})}

    if target_id == user_id:
        return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нельзя добавить себя"})}

    cur.execute("SELECT id, status FROM contacts WHERE (user_id = %s AND contact_id = %s) OR (user_id = %s AND contact_id = %s)",
                (user_id, target_id, target_id, user_id))
    existing = cur.fetchone()
    if existing:
        return {"statusCode": 409, "headers": cors(), "body": json.dumps({"error": "Заявка уже существует", "status": existing[1]})}

    cur.execute("INSERT INTO contacts (user_id, contact_id, status) VALUES (%s, %s, 'pending') RETURNING id",
                (user_id, target_id))
    contact_id = str(cur.fetchone()[0])
    conn.commit()
    return {"statusCode": 201, "headers": cors(), "body": json.dumps({"contact_id": contact_id, "status": "pending"})}


def update_contact(cur, conn, event: dict, user_id: str, contact_id: str) -> dict:
    body = json.loads(event.get("body") or "{}")
    action = body.get("action")

    if action not in ("accept", "reject"):
        return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "action: accept или reject"})}

    cur.execute("SELECT id, user_id, contact_id FROM contacts WHERE id = %s", (contact_id,))
    row = cur.fetchone()
    if not row:
        return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Заявка не найдена"})}

    req_id, from_id, to_id = row
    if str(to_id) != user_id:
        return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Нет доступа"})}

    new_status = "accepted" if action == "accept" else "rejected"
    cur.execute("UPDATE contacts SET status = %s WHERE id = %s", (new_status, contact_id))

    if action == "accept":
        cur.execute("INSERT INTO contacts (user_id, contact_id, status) VALUES (%s, %s, 'accepted') ON CONFLICT DO NOTHING",
                    (str(to_id), str(from_id)))
    conn.commit()
    return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True, "status": new_status})}


def search_users(cur, user_id: str, params: dict) -> dict:
    q = (params.get("q") or "").strip().lower()
    if len(q) < 2:
        return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Минимум 2 символа"})}

    cur.execute("""
        SELECT id, username, display_name, avatar_url, is_online
        FROM users
        WHERE id != %s AND (LOWER(username) LIKE %s OR LOWER(display_name) LIKE %s)
        LIMIT 20
    """, (user_id, f"%{q}%", f"%{q}%"))
    rows = cur.fetchall()
    users = [{"id": str(r[0]), "username": r[1], "display_name": r[2], "avatar_url": r[3], "is_online": r[4]} for r in rows]
    return {"statusCode": 200, "headers": cors(), "body": json.dumps({"users": users})}