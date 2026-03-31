"""Аутентификация: регистрация, вход, выход, текущий пользователь"""
import json
import os
import hashlib
import secrets
import psycopg2
from datetime import datetime, timedelta, timezone


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hash_password(password: str) -> str:
    salt = os.environ.get("SECRET_SALT", "pino_secret_salt_2024")
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-User-Id",
        "Content-Type": "application/json"
    }


def handler(event: dict, context) -> dict:
    """Обработчик регистрации, входа, выхода и получения профиля"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    method = event.get("httpMethod", "GET")
    headers = event.get("headers", {})
    token = headers.get("X-Auth-Token") or headers.get("x-auth-token")
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")

    if method == "POST" and action == "register":
        return register(event)
    elif method == "POST" and action == "login":
        return login(event)
    elif method == "POST" and action == "logout":
        return logout(token)
    elif method == "GET" and action == "me":
        return get_me(token)
    elif method == "PUT" and action == "me":
        return update_me(event, token)
    else:
        return {"statusCode": 404, "headers": cors_headers(), "body": json.dumps({"error": "Not found"})}


def register(event: dict) -> dict:
    body = json.loads(event.get("body") or "{}")
    username = (body.get("username") or "").strip().lower()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    display_name = (body.get("display_name") or username).strip()

    if not username or not email or not password:
        return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "username, email и password обязательны"})}

    if len(password) < 6:
        return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "Пароль минимум 6 символов"})}

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE username = %s OR email = %s", (username, email))
    existing = cur.fetchone()
    if existing:
        cur.close(); conn.close()
        return {"statusCode": 409, "headers": cors_headers(), "body": json.dumps({"error": "Пользователь уже существует"})}

    pw_hash = hash_password(password)
    cur.execute(
        "INSERT INTO users (username, display_name, email, password_hash) VALUES (%s, %s, %s, %s) RETURNING id",
        (username, display_name, email, pw_hash)
    )
    user_id = cur.fetchone()[0]

    cur.execute(
        "INSERT INTO agents (user_id, name, is_pino) VALUES (%s, %s, %s) RETURNING id",
        (str(user_id), "Пино", True)
    )
    conn.commit()

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=30)
    cur.execute("INSERT INTO sessions (user_id, token, expires_at) VALUES (%s, %s, %s)", (str(user_id), token, expires))
    conn.commit()
    cur.close(); conn.close()

    return {
        "statusCode": 201,
        "headers": cors_headers(),
        "body": json.dumps({"token": token, "user_id": str(user_id), "username": username, "display_name": display_name})
    }


def login(event: dict) -> dict:
    body = json.loads(event.get("body") or "{}")
    login_val = (body.get("login") or body.get("username") or body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not login_val or not password:
        return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "login и password обязательны"})}

    conn = get_conn()
    cur = conn.cursor()
    pw_hash = hash_password(password)
    cur.execute(
        "SELECT id, username, display_name, email, avatar_url, agent_name FROM users WHERE (username = %s OR email = %s) AND password_hash = %s",
        (login_val, login_val, pw_hash)
    )
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Неверный логин или пароль"})}

    user_id, username, display_name, email, avatar_url, agent_name = row
    cur.execute("UPDATE users SET is_online = true, last_seen = NOW() WHERE id = %s", (str(user_id),))
    conn.commit()

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=30)
    cur.execute("INSERT INTO sessions (user_id, token, expires_at) VALUES (%s, %s, %s)", (str(user_id), token, expires))
    conn.commit()
    cur.close(); conn.close()

    return {
        "statusCode": 200,
        "headers": cors_headers(),
        "body": json.dumps({
            "token": token,
            "user": {"id": str(user_id), "username": username, "display_name": display_name, "email": email, "avatar_url": avatar_url, "agent_name": agent_name}
        })
    }


def logout(token: str) -> dict:
    if not token:
        return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM sessions WHERE token = %s", (token,))
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE users SET is_online = false, last_seen = NOW() WHERE id = %s", (str(row[0]),))
        cur.execute("UPDATE sessions SET expires_at = NOW() WHERE token = %s", (token,))
        conn.commit()
    cur.close(); conn.close()
    return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}


def get_me(token: str) -> dict:
    if not token:
        return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.username, u.display_name, u.email, u.avatar_url, u.bio, u.city, u.age, u.occupation, u.interests, u.agent_name, u.is_online
        FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.token = %s AND s.expires_at > NOW()
    """, (token,))
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row:
        return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Сессия истекла"})}
    cols = ["id", "username", "display_name", "email", "avatar_url", "bio", "city", "age", "occupation", "interests", "agent_name", "is_online"]
    user = dict(zip(cols, row))
    user["id"] = str(user["id"])
    return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"user": user})}


def update_me(event: dict, token: str) -> dict:
    if not token:
        return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
    body = json.loads(event.get("body") or "{}")
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM sessions WHERE token = %s AND expires_at > NOW()", (token,))
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error": "Не авторизован"})}
    user_id = row[0]

    allowed = ["display_name", "bio", "city", "age", "occupation", "interests", "agent_name"]
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        cur.close(); conn.close()
        return {"statusCode": 400, "headers": cors_headers(), "body": json.dumps({"error": "Нет данных для обновления"})}

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values()) + [str(user_id)]
    cur.execute(f"UPDATE users SET {set_clause}, updated_at = NOW() WHERE id = %s", values)
    conn.commit()
    cur.close(); conn.close()
    return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}