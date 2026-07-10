require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3000;

// ─────────────────────────────────────────
// 텔레그램 설정
// - TELEGRAM_TOKEN, TELEGRAM_CHAT_ID는 .env에서 읽어옴
// ─────────────────────────────────────────
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// ─────────────────────────────────────────
// 미들웨어 설정
// - express.json() : 클라이언트에서 보내는 JSON 데이터를 읽을 수 있게 해줌
// - express.static() : public 폴더 안의 HTML/CSS/JS 파일을 브라우저에 제공
// ─────────────────────────────────────────
app.use(express.json());
app.use(express.static('public'));

// ─────────────────────────────────────────
// 데이터 저장소 (메모리 방식)
// - todos : 할 일 목록을 배열로 저장 (서버 재시작 시 초기화됨)
// - nextId : 새 항목 추가 시 자동으로 증가하는 고유 번호
// ─────────────────────────────────────────
let todos = [];
let nextId = 1;

// ─────────────────────────────────────────
// sendTelegramMessage(text)
// 기능 : 설정된 chat_id로 텔레그램 메시지 전송
// ─────────────────────────────────────────
async function sendTelegramMessage(text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text
    });
  } catch (err) {
    console.error('텔레그램 메시지 전송 실패:', err.message);
  }
}

// ─────────────────────────────────────────
// [GET] /api/todos
// 기능 : 현재 할 일 목록 전체를 반환
// 사용 : 브라우저가 페이지를 열 때 목록을 불러올 때 호출
// ─────────────────────────────────────────
app.get('/api/todos', (req, res) => {
  res.json(todos);
});

// ─────────────────────────────────────────
// [POST] /api/todos
// 기능 : 새로운 할 일 항목 추가
// 요청 : { text: "할 일 내용" }
// 응답 : 추가된 항목 객체 { id, text, done, createdAt }
// 사용 : 브라우저 추가 버튼 클릭 or 텔레그램 "추가 xxx" 명령
// ─────────────────────────────────────────
app.post('/api/todos', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: '할 일 내용을 입력해주세요' });

  const todo = {
    id: nextId++,       // 고유 번호 (1부터 자동 증가)
    text,               // 할 일 내용
    done: false,        // 완료 여부 (기본값: 미완료)
    createdAt: new Date().toISOString() // 추가된 시간
  };
  todos.push(todo);

  sendTelegramMessage(`✅ ${text} 추가됐어요`);

  res.json(todo);
});

// ─────────────────────────────────────────
// [PATCH] /api/todos/:id/text
// 기능 : 특정 항목의 내용(텍스트)을 변경
// 요청 : { text: "변경할 내용" }
// 응답 : 변경된 항목 객체
// 사용 : 브라우저 변경 버튼 클릭 or 텔레그램 "변경 1 새내용" 명령
// ─────────────────────────────────────────
app.patch('/api/todos/:id/text', (req, res) => {
  const id = parseInt(req.params.id); // URL의 :id를 숫자로 변환
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: '변경할 내용을 입력해주세요' });

  const todo = todos.find(t => t.id === id);
  if (!todo) return res.status(404).json({ error: '해당 항목을 찾을 수 없습니다' });

  const oldText = todo.text;
  todo.text = text;

  sendTelegramMessage(`✏️ ${oldText} → ${text}로 변경됐어요`);

  res.json(todo);
});

// ─────────────────────────────────────────
// [PATCH] /api/todos/:id/done
// 기능 : 특정 항목을 완료 처리 (done: true로 변경)
// 응답 : 완료 처리된 항목 객체
// 사용 : 브라우저 완료 버튼 클릭 or 텔레그램 "완료 1" 명령
// 주의 : 한 번 완료 처리하면 다시 미완료로 되돌릴 수 없음 (실습용 단순 구조)
// ─────────────────────────────────────────
app.patch('/api/todos/:id/done', (req, res) => {
  const id = parseInt(req.params.id);
  const todo = todos.find(t => t.id === id);
  if (!todo) return res.status(404).json({ error: '해당 항목을 찾을 수 없습니다' });

  todo.done = true;

  sendTelegramMessage(`☑️ ${todo.text} 완료됐어요`);

  res.json(todo);
});

// ─────────────────────────────────────────
// [DELETE] /api/todos/:id
// 기능 : 특정 항목을 목록에서 삭제
// 응답 : { success: true }
// 사용 : 브라우저 삭제 버튼 클릭 or 텔레그램 "삭제 1" 명령
// 참고 : 삭제 시 텔레그램 알림은 전송하지 않음
// ─────────────────────────────────────────
app.delete('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = todos.findIndex(t => t.id === id);
  if (index === -1) return res.status(404).json({ error: '해당 항목을 찾을 수 없습니다' });

  todos.splice(index, 1); // 해당 index의 항목 1개 제거
  res.json({ success: true });
});

// ─────────────────────────────────────────
// handleTelegramCommand(text)
// 기능 : 텔레그램으로 수신한 명령어 텍스트를 해석해서 실행하고 결과를 회신
// 지원 명령 : _추가 / _변경 / _완료 / _삭제 / _목록 / _명령어
// ─────────────────────────────────────────

// findTodoByIdentifier(identifier)
// 기능 : 식별자가 숫자면 id로, 아니면 text 전체 일치로 항목을 찾음
function findTodoByIdentifier(identifier) {
  const trimmed = identifier.trim();
  if (/^\d+$/.test(trimmed)) {
    return todos.find(t => t.id === parseInt(trimmed, 10));
  }
  return todos.find(t => t.text === trimmed);
}

async function handleTelegramCommand(text) {
  const addMatch = text.match(/^_추가\s+(.+)$/);
  const changeMatch = text.match(/^_변경\s+(\S+)\s+(.+)$/);
  const doneMatch = text.match(/^_완료\s+(.+)$/);
  const deleteMatch = text.match(/^_삭제\s+(.+)$/);

  if (addMatch) {
    const todoText = addMatch[1].trim();
    const todo = {
      id: nextId++,
      text: todoText,
      done: false,
      createdAt: new Date().toISOString()
    };
    todos.push(todo);
    await sendTelegramMessage(`✅ ${todoText} 추가됐어요`);
    return;
  }

  if (changeMatch) {
    const todo = findTodoByIdentifier(changeMatch[1]);
    if (!todo) {
      await sendTelegramMessage('해당 항목을 찾을 수 없어요');
      return;
    }
    const newText = changeMatch[2].trim();
    todo.text = newText;
    await sendTelegramMessage(`✏️ ${todo.id}번 항목이 "${newText}"로 변경됐어요`);
    return;
  }

  if (doneMatch) {
    const todo = findTodoByIdentifier(doneMatch[1]);
    if (!todo) {
      await sendTelegramMessage('해당 항목을 찾을 수 없어요');
      return;
    }
    todo.done = true;
    await sendTelegramMessage(`☑️ ${todo.text} 완료됐어요`);
    return;
  }

  if (deleteMatch) {
    const todo = findTodoByIdentifier(deleteMatch[1]);
    if (!todo) {
      await sendTelegramMessage('해당 항목을 찾을 수 없어요');
      return;
    }
    const index = todos.findIndex(t => t.id === todo.id);
    todos.splice(index, 1);
    await sendTelegramMessage(`🗑️ ${todo.text} 삭제됐어요`);
    return;
  }

  if (text === '_목록') {
    if (todos.length === 0) {
      await sendTelegramMessage('할 일이 없어요');
      return;
    }
    const listText = todos
      .map(t => `${t.id}. ${t.done ? '✅' : '⬜'} ${t.text}`)
      .join('\n');
    await sendTelegramMessage(listText);
    return;
  }

  if (text === '_명령어') {
    const helpText = [
      '📋 사용 가능한 명령어',
      '_추가 <내용>  (예: _추가 우유사기)',
      '_변경 <번호 또는 내용> <새 내용>  (예: _변경 1 마트가기)',
      '_완료 <번호 또는 내용>  (예: _완료 1)',
      '_삭제 <번호 또는 내용>  (예: _삭제 1)',
      '_목록',
      '_명령어'
    ].join('\n');
    await sendTelegramMessage(helpText);
    return;
  }

  await sendTelegramMessage('올바른 명령어를 입력해주세요');
}

// ─────────────────────────────────────────
// pollTelegram()
// 기능 : getUpdates를 polling 방식으로 호출해 새 메시지를 확인하고 처리
// ─────────────────────────────────────────
let lastUpdateId = 0;

async function pollTelegram() {
  try {
    const res = await axios.get(`${TELEGRAM_API}/getUpdates`, {
      params: { offset: lastUpdateId + 1, timeout: 0 }
    });

    for (const update of res.data.result) {
      lastUpdateId = update.update_id;
      const messageText = update.message && update.message.text;
      if (!messageText) continue;
      await handleTelegramCommand(messageText.trim());
    }
  } catch (err) {
    console.error('텔레그램 polling 오류:', err.message);
  } finally {
    // 이전 요청이 끝난 뒤에만 다음 polling을 예약 (요청이 겹쳐 409 Conflict가 나는 것을 방지)
    setTimeout(pollTelegram, 2000);
  }
}

// ─────────────────────────────────────────
// 서버 시작
// - PORT 3000번으로 실행
// - 브라우저에서 http://localhost:3000 으로 접속 가능
// ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Todo 서버 실행 중: http://localhost:${PORT}`);

  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('⚠️  TELEGRAM_TOKEN / TELEGRAM_CHAT_ID가 설정되지 않아 텔레그램 연동을 시작하지 않습니다');
    return;
  }

  console.log('📌 텔레그램 polling 시작');
  pollTelegram();
});
