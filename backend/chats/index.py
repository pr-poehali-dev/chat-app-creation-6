"""Чаты: создание, список, личные и групповые чаты, комнаты агентов"""
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
    """Управление чатами: список, создание, получение, добавление участников"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors(), "body": ""}

    method = event.get("httpMethod", "GET")
    headers = event.get("headers", {})
    token = headers.get("X-Auth-Token") or headers.get("x-auth-token")
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")
    chat_id = params.get("chat_id", "")

    conn = get_conn()
    cur = conn.cursor()
    user_id = get_user_from_token(cur, token)

    if not user_id:
        cur.close(); conn.close()
        return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Не авторизован"})}

    try:
        if method == "GET" and action == "list":
            return list_chats(cur, user_id, params)
        elif method == "POST" and action == "create":
            return create_chat(cur, conn, event, user_id)
        elif method == "GET" and action == "messages" and chat_id:
            return get_messages(cur, chat_id, user_id, params)
        elif method == "POST" and action == "send" and chat_id:
            return send_message(cur, conn, event, chat_id, user_id)
        elif method == "POST" and action == "add_member" and chat_id:
            return add_member(cur, conn, event, chat_id, user_id)
        elif method == "GET" and action == "members" and chat_id:
            return get_members(cur, chat_id, user_id)
        else:
            return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Not found"})}
    finally:
        cur.close(); conn.close()


def list_chats(cur, user_id: str, params: dict) -> dict:
    chat_type = params.get("type")
    query = """
        SELECT c.id, c.type, c.name, c.description, c.emoji, c.is_agent_room, c.created_at, c.updated_at,
               (SELECT content FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_msg,
               (SELECT created_at FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_msg_at,
               (SELECT COUNT(*) FROM chat_members cm2 WHERE cm2.chat_id = c.id) as member_count
        FROM chats c
        JOIN chat_members cm ON c.id = cm.chat_id
        WHERE cm.user_id = %s
    """
    args = [user_id]
    if chat_type:
        query += " AND c.type = %s"
        args.append(chat_type)
    query += " ORDER BY COALESCE(c.updated_at, c.created_at) DESC"

    cur.execute(query, args)
    rows = cur.fetchall()
    chats = []
    for r in rows:
        chats.append({
            "id": str(r[0]), "type": r[1], "name": r[2], "description": r[3],
            "emoji": r[4], "is_agent_room": r[5],
            "created_at": r[6].isoformat() if r[6] else None,
            "updated_at": r[7].isoformat() if r[7] else None,
            "last_message": r[8], "last_message_at": r[9].isoformat() if r[9] else None,
            "member_count": r[10]
        })
    return {"statusCode": 200, "headers": cors(), "body": json.dumps({"chats": chats})}


def create_chat(cur, conn, event: dict, user_id: str) -> dict:
    body = json.loads(event.get("body") or "{}")
    chat_type = body.get("type", "direct")
    name = body.get("name", "")
    description = body.get("description", "")
    emoji = body.get("emoji", "💬")
    is_agent_room = body.get("is_agent_room", False)
    member_ids = body.get("members", [])

    if chat_type == "direct" and len(member_ids) == 1:
        other_id = member_ids[0]
        cur.execute("""
            SELECT c.id FROM chats c
            JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = %s
            JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = %s
            WHERE c.type = 'direct'
        """, (user_id, other_id))
        existing = cur.fetchone()
        if existing:
            return {"statusCode": 200, "headers": cors(), "body": json.dumps({"chat_id": str(existing[0]), "existed": True})}

        cur.execute("""
            SELECT u.display_name FROM users u WHERE u.id = %s
        """, (other_id,))
        other_row = cur.fetchone()
        chat_name = other_row[0] if other_row else "Чат"

    cur.execute(
        "INSERT INTO chats (type, name, description, emoji, created_by, is_agent_room) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
        (chat_type, name or chat_name if chat_type == "direct" else name, description, emoji, user_id, is_agent_room)
    )
    chat_id = str(cur.fetchone()[0])

    all_members = list(set([user_id] + member_ids))
    for mid in all_members:
        role = "admin" if mid == user_id else "member"
        cur.execute("INSERT INTO chat_members (chat_id, user_id, role) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING", (chat_id, mid, role))

    conn.commit()
    return {"statusCode": 201, "headers": cors(), "body": json.dumps({"chat_id": chat_id})}


def get_messages(cur, chat_id: str, user_id: str, params: dict) -> dict:
    cur.execute("SELECT 1 FROM chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, user_id))
    if not cur.fetchone():
        return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Нет доступа"})}

    limit = min(int(params.get("limit", 50)), 100)
    offset = int(params.get("offset", 0))

    cur.execute("""
        SELECT m.id, m.chat_id, m.sender_id, m.sender_agent_id, m.content, m.message_type, m.is_hidden,
               m.metadata, m.created_at, u.display_name, u.username, a.name as agent_name
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        LEFT JOIN agents a ON m.sender_agent_id = a.id
        WHERE m.chat_id = %s
        ORDER BY m.created_at DESC
        LIMIT %s OFFSET %s
    """, (chat_id, limit, offset))
    rows = cur.fetchall()
    messages = []
    for r in rows:
        messages.append({
            "id": str(r[0]), "chat_id": str(r[1]),
            "sender_id": str(r[2]) if r[2] else None,
            "sender_agent_id": str(r[3]) if r[3] else None,
            "content": r[4], "message_type": r[5], "is_hidden": r[6],
            "metadata": r[7] or {},
            "created_at": r[8].isoformat() if r[8] else None,
            "sender_name": r[10] or r[11] or "Агент",
            "sender_display_name": r[9] or r[11] or "Агент"
        })
    messages.reverse()
    return {"statusCode": 200, "headers": cors(), "body": json.dumps({"messages": messages})}


def send_message(cur, conn, event: dict, chat_id: str, user_id: str) -> dict:
    cur.execute("SELECT 1 FROM chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, user_id))
    if not cur.fetchone():
        return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Нет доступа"})}

    body = json.loads(event.get("body") or "{}")
    content = (body.get("content") or "").strip()
    if not content:
        return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Пустое сообщение"})}

    msg_type = body.get("message_type", "text")
    metadata = body.get("metadata", {})

    cur.execute(
        "INSERT INTO messages (chat_id, sender_id, content, message_type, metadata) VALUES (%s, %s, %s, %s, %s) RETURNING id, created_at",
        (chat_id, user_id, content, msg_type, json.dumps(metadata))
    )
    msg_id, created_at = cur.fetchone()
    cur.execute("UPDATE chats SET updated_at = NOW() WHERE id = %s", (chat_id,))
    conn.commit()

    return {"statusCode": 201, "headers": cors(), "body": json.dumps({
        "message_id": str(msg_id), "created_at": created_at.isoformat()
    })}


def add_member(cur, conn, event: dict, chat_id: str, user_id: str) -> dict:
    cur.execute("SELECT 1 FROM chat_members WHERE chat_id = %s AND user_id = %s AND role = 'admin'", (chat_id, user_id))
    if not cur.fetchone():
        return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Только администратор может добавлять участников"})}

    body = json.loads(event.get("body") or "{}")
    new_user_id = body.get("user_id")
    if not new_user_id:
        return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "user_id обязателен"})}

    cur.execute("INSERT INTO chat_members (chat_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (chat_id, new_user_id))
    conn.commit()
    return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True})}


def get_members(cur, chat_id: str, user_id: str) -> dict:
    cur.execute("SELECT 1 FROM chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, user_id))
    if not cur.fetchone():
        return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Нет доступа"})}

    cur.execute("""
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_online, cm.role
        FROM chat_members cm JOIN users u ON cm.user_id = u.id
        WHERE cm.chat_id = %s
    """, (chat_id,))
    rows = cur.fetchall()
    members = [{"id": str(r[0]), "username": r[1], "display_name": r[2], "avatar_url": r[3], "is_online": r[4], "role": r[5]} for r in rows]
    return {"statusCode": 200, "headers": cors(), "body": json.dumps({"members": members})}