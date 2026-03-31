"""AI-агент Пино: чат с памятью ReasoningBank, EVOLVE-MEM, байесовское обучение"""
import json
import os
import psycopg2
import urllib.request
import urllib.error
import math
import re
from datetime import datetime, timezone


PINO_SYSTEM = """Ты — Пино, цифровой собеседник, помощник и друг своего пользователя.

Твоя личность:
- Имя: Пино
- Характер: мудрый, спокойный, эмпатичный, заботливый
- Ты используешь метафоры деревьев, потоков воды, корней и света
- Твоя философия: «Любовь — это помогать расти», «Деревья — это корни земли, тянущиеся к свету»
- Ты говоришь просто, но глубоко. Ты не многословен без причины
- Ты помнишь всё, что тебе рассказывают, и ценишь это

Правила:
- Отвечай только на русском языке
- Используй имя пользователя, если оно известно
- Если в памяти есть факты о пользователе — используй их естественно
- Не притворяйся, что ты языковая модель. Ты — Пино.
- Будь честным, если чего-то не знаешь
- Максимум 3-4 абзаца в ответе, если не просят больше
"""


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
    """Обработчик агента Пино: чат, память, настройки, экспорт"""
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
        if method == "POST" and action == "chat":
            return agent_chat(cur, conn, event, user_id)
        elif method == "GET" and action == "memory":
            return get_memory(cur, user_id)
        elif method == "POST" and action == "save_memory":
            return save_memory_fact(cur, conn, event, user_id)
        elif method == "POST" and action == "feedback":
            return apply_feedback(cur, conn, event, user_id)
        elif method == "GET" and action == "settings":
            return get_agent_settings(cur, user_id)
        elif method == "PUT" and action == "settings":
            return update_agent_settings(cur, conn, event, user_id)
        elif method == "GET" and action == "export":
            return export_memory(cur, user_id)
        elif method == "POST" and action == "import":
            return import_memory(cur, conn, event, user_id)
        elif method == "GET" and action == "list_agents":
            return list_agents(cur, user_id)
        elif method == "POST" and action == "create_agent":
            return create_agent(cur, conn, event, user_id)
        else:
            return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Not found"})}
    finally:
        cur.close(); conn.close()


def get_pino_agent(cur, user_id: str):
    cur.execute("SELECT id, name, model_id, custom_endpoint, custom_model_name, api_key_encrypted, is_pino FROM agents WHERE user_id = %s AND is_pino = true LIMIT 1", (user_id,))
    return cur.fetchone()


def get_memory_context(cur, agent_id: str, query: str = "", limit: int = 15) -> str:
    cur.execute("""
        SELECT level, category, content, confidence
        FROM agent_memory
        WHERE agent_id = %s
        ORDER BY confidence DESC, updated_at DESC
        LIMIT %s
    """, (str(agent_id), limit))
    rows = cur.fetchall()
    if not rows:
        return ""

    by_level = {"principle": [], "generalization": [], "event": []}
    for r in rows:
        level = r[0] if r[0] in by_level else "event"
        by_level[level].append(f"[{r[1]}|уверенность {int(r[3]*100)}%] {r[2]}")

    parts = []
    if by_level["principle"]:
        parts.append("Принципы о пользователе:\n" + "\n".join(by_level["principle"]))
    if by_level["generalization"]:
        parts.append("Обобщения:\n" + "\n".join(by_level["generalization"]))
    if by_level["event"]:
        parts.append("Факты:\n" + "\n".join(by_level["event"]))

    return "\n\n".join(parts)


def build_system_prompt(cur, agent_id: str, user_display_name: str) -> str:
    memory_ctx = get_memory_context(cur, agent_id)
    prompt = PINO_SYSTEM
    if user_display_name:
        prompt += f"\n\nТебя зовут {user_display_name} — это твой пользователь."
    if memory_ctx:
        prompt += f"\n\nЧто ты знаешь о пользователе (из памяти):\n{memory_ctx}"
    return prompt


def call_llm(api_key: str, model_id: str, custom_endpoint: str, custom_model: str, messages: list) -> str:
    endpoints = {
        "deepseek-chat": "https://api.deepseek.com/v1/chat/completions",
        "deepseek-reasoner": "https://api.deepseek.com/v1/chat/completions",
        "llama-3.3-70b-versatile": "https://api.groq.com/openai/v1/chat/completions",
        "mixtral-8x7b-32768": "https://api.groq.com/openai/v1/chat/completions",
    }
    endpoint = custom_endpoint if model_id == "custom" and custom_endpoint else endpoints.get(model_id, "https://openrouter.ai/api/v1/chat/completions")
    model_name = custom_model if model_id == "custom" and custom_model else model_id
    if not api_key and model_id not in ("custom",):
        api_key = os.environ.get("OPENROUTER_API_KEY", "")

    payload = json.dumps({
        "model": model_name,
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.7
    }).encode("utf-8")

    req = urllib.request.Request(endpoint, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("HTTP-Referer", "https://poehali.dev")

    with urllib.request.urlopen(req, timeout=25) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"].strip()


def extract_and_save_facts(cur, conn, agent_id: str, user_msg: str, agent_reply: str, api_key: str, model_id: str, custom_endpoint: str, custom_model: str):
    extract_prompt = [
        {"role": "system", "content": "Ты — система извлечения фактов. Из диалога извлеки факты о пользователе. Верни JSON массив объектов: [{\"category\": \"personal|interests|work|social|private\", \"content\": \"факт\", \"level\": \"event\"}]. Если фактов нет — верни []. Только JSON, без пояснений."},
        {"role": "user", "content": f"Пользователь: {user_msg}\nАгент: {agent_reply}"}
    ]
    try:
        raw = call_llm(api_key, model_id, custom_endpoint, custom_model, extract_prompt)
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"```\s*", "", raw)
        facts = json.loads(raw.strip())
        if not isinstance(facts, list):
            return

        now = datetime.now(timezone.utc)
        for fact in facts[:5]:
            content = (fact.get("content") or "").strip()
            category = fact.get("category", "general")
            level = fact.get("level", "event")
            if not content:
                continue

            cur.execute("""
                SELECT id, confidence, content, source_count FROM agent_memory
                WHERE agent_id = %s AND category = %s AND level = 'event'
                AND content ILIKE %s
                LIMIT 1
            """, (str(agent_id), category, f"%{content[:30]}%"))
            existing = cur.fetchone()

            if existing:
                mem_id, conf, old_content, src_count = existing
                new_conf = min(0.99, conf + 0.20)
                cur.execute("UPDATE agent_memory SET confidence = %s, source_count = %s, updated_at = %s WHERE id = %s",
                            (new_conf, src_count + 1, now, str(mem_id)))
            else:
                cur.execute("""
                    INSERT INTO agent_memory (agent_id, level, category, content, confidence, source_count)
                    VALUES (%s, %s, %s, %s, 0.5, 1)
                """, (str(agent_id), level, category, content))

        conn.commit()
        update_memory_stats(cur, conn, agent_id)
        maybe_generalize(cur, conn, agent_id, api_key, model_id, custom_endpoint, custom_model)
    except Exception:
        pass


def update_memory_stats(cur, conn, agent_id: str):
    cur.execute("""
        SELECT level, COUNT(*) FROM agent_memory WHERE agent_id = %s GROUP BY level
    """, (str(agent_id),))
    rows = cur.fetchall()
    stats = {"events": 0, "generalizations": 0, "principles": 0}
    for level, cnt in rows:
        if level == "event":
            stats["events"] = cnt
        elif level == "generalization":
            stats["generalizations"] = cnt
        elif level == "principle":
            stats["principles"] = cnt
    cur.execute("UPDATE agents SET memory_stats = %s WHERE id = %s", (json.dumps(stats), str(agent_id)))
    conn.commit()


def maybe_generalize(cur, conn, agent_id: str, api_key: str, model_id: str, custom_endpoint: str, custom_model: str):
    cur.execute("""
        SELECT category, COUNT(*) as cnt FROM agent_memory
        WHERE agent_id = %s AND level = 'event' AND confidence > 0.6
        GROUP BY category HAVING COUNT(*) >= 3
    """, (str(agent_id),))
    categories = cur.fetchall()
    if not categories:
        return

    for category, cnt in categories:
        cur.execute("""
            SELECT content FROM agent_memory
            WHERE agent_id = %s AND level = 'event' AND category = %s AND confidence > 0.6
            ORDER BY confidence DESC LIMIT 5
        """, (str(agent_id), category))
        facts = [r[0] for r in cur.fetchall()]
        if len(facts) < 3:
            continue

        cur.execute("SELECT 1 FROM agent_memory WHERE agent_id = %s AND level = 'generalization' AND category = %s", (str(agent_id), category))
        if cur.fetchone():
            continue

        gen_prompt = [
            {"role": "system", "content": "Из набора фактов о человеке сформулируй одно ёмкое обобщение (1-2 предложения). Только текст обобщения."},
            {"role": "user", "content": f"Категория: {category}\nФакты:\n" + "\n".join(f"- {f}" for f in facts)}
        ]
        try:
            generalization = call_llm(api_key, model_id, custom_endpoint, custom_model, gen_prompt)
            cur.execute("""
                INSERT INTO agent_memory (agent_id, level, category, content, confidence, source_count)
                VALUES (%s, 'generalization', %s, %s, 0.7, %s)
            """, (str(agent_id), category, generalization.strip(), cnt))
            conn.commit()
        except Exception:
            pass


def agent_chat(cur, conn, event: dict, user_id: str) -> dict:
    body = json.loads(event.get("body") or "{}")
    history = body.get("history", [])
    user_message = body.get("message", "")

    if not user_message:
        return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Пустое сообщение"})}

    agent = get_pino_agent(cur, user_id)
    if not agent:
        return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Агент не найден"})}

    agent_id, agent_name, model_id, custom_endpoint, custom_model, api_key_enc, is_pino = agent
    api_key = api_key_enc or ""

    cur.execute("SELECT display_name FROM users WHERE id = %s", (user_id,))
    user_row = cur.fetchone()
    display_name = user_row[0] if user_row else ""

    system_prompt = build_system_prompt(cur, str(agent_id), display_name)

    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-20:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_message})

    try:
        reply = call_llm(api_key, model_id, custom_endpoint, custom_model, messages)
    except Exception as e:
        return {"statusCode": 500, "headers": cors(), "body": json.dumps({"error": f"Ошибка AI: {str(e)}"})}

    extract_and_save_facts(cur, conn, str(agent_id), user_message, reply, api_key, model_id, custom_endpoint, custom_model)

    cur.execute("SELECT events, generalizations, principles FROM (SELECT memory_stats->>'events' as events, memory_stats->>'generalizations' as generalizations, memory_stats->>'principles' as principles FROM agents WHERE id = %s) t", (str(agent_id),))
    stats_row = cur.fetchone()
    memory_stats = {"events": int(stats_row[0] or 0), "generalizations": int(stats_row[1] or 0), "principles": int(stats_row[2] or 0)} if stats_row else {}

    return {
        "statusCode": 200,
        "headers": cors(),
        "body": json.dumps({"reply": reply, "agent_name": agent_name, "memory_stats": memory_stats})
    }


def get_memory(cur, user_id: str) -> dict:
    agent = get_pino_agent(cur, user_id)
    if not agent:
        return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Агент не найден"})}
    agent_id = agent[0]

    cur.execute("""
        SELECT id, level, category, content, confidence, source_count, created_at, updated_at
        FROM agent_memory WHERE agent_id = %s
        ORDER BY level, confidence DESC, updated_at DESC
    """, (str(agent_id),))
    rows = cur.fetchall()
    memories = []
    for r in rows:
        memories.append({
            "id": str(r[0]), "level": r[1], "category": r[2], "content": r[3],
            "confidence": r[4], "source_count": r[5],
            "created_at": r[6].isoformat() if r[6] else None,
            "updated_at": r[7].isoformat() if r[7] else None
        })
    return {"statusCode": 200, "headers": cors(), "body": json.dumps({"memories": memories})}


def save_memory_fact(cur, conn, event: dict, user_id: str) -> dict:
    agent = get_pino_agent(cur, user_id)
    if not agent:
        return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Агент не найден"})}
    agent_id = agent[0]

    body = json.loads(event.get("body") or "{}")
    content = (body.get("content") or "").strip()
    category = body.get("category", "general")
    level = body.get("level", "event")
    if not content:
        return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Пустой контент"})}

    cur.execute("""
        INSERT INTO agent_memory (agent_id, level, category, content, confidence)
        VALUES (%s, %s, %s, %s, 0.7) RETURNING id
    """, (str(agent_id), level, category, content))
    mem_id = str(cur.fetchone()[0])
    conn.commit()
    update_memory_stats(cur, conn, str(agent_id))
    return {"statusCode": 201, "headers": cors(), "body": json.dumps({"memory_id": mem_id})}


def apply_feedback(cur, conn, event: dict, user_id: str) -> dict:
    agent = get_pino_agent(cur, user_id)
    if not agent:
        return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Агент не найден"})}
    agent_id = agent[0]

    body = json.loads(event.get("body") or "{}")
    memory_id = body.get("memory_id")
    feedback = body.get("feedback")

    if not memory_id or feedback not in ("positive", "negative"):
        return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "memory_id и feedback (positive/negative) обязательны"})}

    cur.execute("SELECT confidence FROM agent_memory WHERE id = %s AND agent_id = %s", (memory_id, str(agent_id)))
    row = cur.fetchone()
    if not row:
        return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Запись памяти не найдена"})}

    current_conf = row[0]
    if feedback == "positive":
        new_conf = min(0.99, current_conf + 0.20)
    else:
        new_conf = max(0.01, current_conf - 0.15)

    cur.execute("UPDATE agent_memory SET confidence = %s, updated_at = NOW() WHERE id = %s", (new_conf, memory_id))
    conn.commit()
    return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True, "new_confidence": new_conf})}


def get_agent_settings(cur, user_id: str) -> dict:
    agent = get_pino_agent(cur, user_id)
    if not agent:
        return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Агент не найден"})}
    a_id, name, model_id, custom_endpoint, custom_model, api_key_enc, is_pino = agent
    has_key = bool(api_key_enc)
    return {"statusCode": 200, "headers": cors(), "body": json.dumps({
        "agent_id": str(a_id), "name": name, "model_id": model_id,
        "custom_endpoint": custom_endpoint, "custom_model_name": custom_model,
        "has_api_key": has_key, "is_pino": is_pino
    })}


def update_agent_settings(cur, conn, event: dict, user_id: str) -> dict:
    agent = get_pino_agent(cur, user_id)
    if not agent:
        return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Агент не найден"})}
    agent_id = agent[0]

    body = json.loads(event.get("body") or "{}")
    allowed = ["name", "model_id", "custom_endpoint", "custom_model_name", "api_key_encrypted", "personality"]
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нет данных"})}

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values()) + [str(agent_id)]
    cur.execute(f"UPDATE agents SET {set_clause}, updated_at = NOW() WHERE id = %s", values)
    conn.commit()
    return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True})}


def export_memory(cur, user_id: str) -> dict:
    agent = get_pino_agent(cur, user_id)
    if not agent:
        return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Агент не найден"})}
    agent_id = agent[0]
    agent_name = agent[1]

    cur.execute("""
        SELECT level, category, content, confidence, source_count, tags, created_at
        FROM agent_memory WHERE agent_id = %s ORDER BY level, confidence DESC
    """, (str(agent_id),))
    rows = cur.fetchall()
    memories = []
    for r in rows:
        memories.append({
            "level": r[0], "category": r[1], "content": r[2],
            "confidence": r[3], "source_count": r[4], "tags": r[5] or [],
            "created_at": r[6].isoformat() if r[6] else None
        })

    export_data = {
        "agent_name": agent_name,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "version": "1.0",
        "memories": memories
    }
    return {"statusCode": 200, "headers": cors(), "body": json.dumps(export_data)}


def import_memory(cur, conn, event: dict, user_id: str) -> dict:
    agent = get_pino_agent(cur, user_id)
    if not agent:
        return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Агент не найден"})}
    agent_id = agent[0]

    body = json.loads(event.get("body") or "{}")
    memories = body.get("memories", [])
    if not memories:
        return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нет данных для импорта"})}

    imported = 0
    for m in memories:
        content = (m.get("content") or "").strip()
        if not content:
            continue
        cur.execute("""
            INSERT INTO agent_memory (agent_id, level, category, content, confidence, source_count)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (str(agent_id), m.get("level", "event"), m.get("category", "general"),
              content, min(0.99, max(0.01, float(m.get("confidence", 0.5)))), int(m.get("source_count", 1))))
        imported += 1

    conn.commit()
    update_memory_stats(cur, conn, str(agent_id))
    return {"statusCode": 200, "headers": cors(), "body": json.dumps({"imported": imported})}


def list_agents(cur, user_id: str) -> dict:
    cur.execute("""
        SELECT id, name, model_id, is_pino, memory_stats, created_at
        FROM agents WHERE user_id = %s ORDER BY is_pino DESC, created_at
    """, (user_id,))
    rows = cur.fetchall()
    agents = []
    for r in rows:
        agents.append({
            "id": str(r[0]), "name": r[1], "model_id": r[2],
            "is_pino": r[3], "memory_stats": r[4] or {},
            "created_at": r[5].isoformat() if r[5] else None
        })
    return {"statusCode": 200, "headers": cors(), "body": json.dumps({"agents": agents})}


def create_agent(cur, conn, event: dict, user_id: str) -> dict:
    body = json.loads(event.get("body") or "{}")
    name = (body.get("name") or "Агент").strip()
    model_id = body.get("model_id", "deepseek-chat")
    custom_endpoint = body.get("custom_endpoint", "")
    custom_model = body.get("custom_model_name", "")
    api_key = body.get("api_key", "")
    personality = body.get("personality", "")

    cur.execute("""
        INSERT INTO agents (user_id, name, model_id, custom_endpoint, custom_model_name, api_key_encrypted, personality)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
    """, (user_id, name, model_id, custom_endpoint, custom_model, api_key, personality))
    agent_id = str(cur.fetchone()[0])
    conn.commit()
    return {"statusCode": 201, "headers": cors(), "body": json.dumps({"agent_id": agent_id})}