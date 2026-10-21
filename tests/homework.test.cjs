const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const script = fs.readFileSync('exam_answer_selector.user.js', 'utf8');

function page(options = {}) {
  const dom = new JSDOM(`<!doctype html><body>
    <div class="singleQuesId"><span class="num_option">A</span><span class="num_option">B</span></div>
    <div class="singleQuesId"><span class="num_option">A</span><span class="num_option">B</span></div>
  </body>`, { url: 'https://mooc1-api.chaoxing.com/mooc-ans/mooc2/work/dowork', runScripts: 'outside-only' });
  const { window } = dom;
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
    get() { return this.textContent; },
    set(value) { this.textContent = value; },
  });
  window.HTMLElement.prototype.getClientRects = () => ({ length: 1 });
  window.GM_getValue = (key, fallback) => key === 'apiToken' ? 'test-token' : key === 'autoSubmit' ? !!options.autoSubmit : fallback;
  window.GM_setValue = () => {};
  window.setInterval = (fn) => { fn(); return 0; };
  if (options.auto) {
    window.html2canvas = async (question) => {
      options.onCapture?.(question);
      return { toBlob: (callback) => callback(new window.Blob(['x'])) };
    };
    window.GM_xmlhttpRequest = ({ onload }) => {
      if (options.requestHandler) return options.requestHandler(onload);
      options.onRequest?.();
      onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: '{"answer":"A"}' } }] }) });
    };
    window.setTimeout = (fn, delay) => {
      options.delays?.push(delay);
      return global.setTimeout(fn, 0);
    };
  }
  window.eval(script);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return dom;
}

test('homework navigation moves between separate question containers', () => {
  const dom = page();
  const { document } = dom.window;
  const questions = document.querySelectorAll('.singleQuesId');
  let first = 0;
  let second = 0;
  questions[0].querySelector('.num_option').addEventListener('click', () => first++);
  questions[1].querySelector('.num_option').addEventListener('click', () => second++);
  document.querySelector('#dynamic-buttons').querySelector('button')?.click();
  document.querySelector('#next-btn').click();
  document.querySelector('#dynamic-buttons').querySelector('button')?.click();
  assert.equal(first, 1);
  assert.equal(second, 1);
});

test('late AI response from a stopped run cannot change an answer', async () => {
  const pending = [];
  const dom = page({ auto: true, requestHandler: onload => pending.push(onload) });
  const { document } = dom.window;
  let firstClicks = 0;
  document.querySelector('.singleQuesId .num_option').addEventListener('click', () => firstClicks++);
  const respond = onload => onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: '{"answer":"A"}' } }] }) });
  document.querySelector('#ai-auto-start').click();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(pending.length, 1);
  document.querySelector('#ai-auto-stop').click();
  document.querySelector('#ai-auto-start').click();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(pending.length, 2);
  respond(pending[0]);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(firstClicks, 0);
  respond(pending[1]);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(firstClicks, 1);
});

test('restart keeps the current homework index instead of revisiting earlier questions', async () => {
  const pending = [];
  const captures = [];
  const dom = page({
    auto: true,
    requestHandler: onload => pending.push(onload),
    onCapture: question => captures.push([...question.parentElement.querySelectorAll('.singleQuesId')].indexOf(question)),
  });
  const { document } = dom.window;
  const respond = onload => onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: '{"answer":"A"}' } }] }) });
  document.querySelector('#ai-auto-start').click();
  await new Promise(resolve => setTimeout(resolve, 20));
  respond(pending[0]);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(captures, [0, 1]);
  document.querySelector('#ai-auto-stop').click();
  document.querySelector('#ai-auto-start').click();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(captures, [0, 1, 1]);
});

test('restart resumes after interruption without toggling the answered choice', async () => {
  const dom = page({ auto: true });
  const { document } = dom.window;
  const questions = document.querySelectorAll('.singleQuesId');
  const selected = [false, false];
  const clicks = [0, 0];
  questions.forEach((q, i) => q.querySelector('.num_option').addEventListener('click', event => {
    clicks[i]++;
    selected[i] = !selected[i];
    event.currentTarget.classList.toggle('check_answer', selected[i]);
    if (i === 0 && clicks[i] === 1) document.querySelector('#ai-auto-stop').click();
  }));
  document.querySelector('#ai-auto-start').click();
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(clicks, [1, 0]);
  document.querySelector('#ai-auto-start').click();
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.deepEqual(clicks, [1, 1]);
  assert.deepEqual(selected, [true, true]);
});

test('already answered homework question is skipped', async () => {
  let apiCalls = 0;
  const dom = page({ auto: true, onRequest: () => apiCalls++ });
  const { document } = dom.window;
  const questions = document.querySelectorAll('.singleQuesId');
  questions[0].querySelector('.num_option').classList.add('check_answer');
  let firstClicks = 0;
  questions[0].querySelector('.num_option').addEventListener('click', () => firstClicks++);
  document.querySelector('#ai-auto-start').click();
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(firstClicks, 0);
  assert.equal(apiCalls, 1);
});

test('auto mode visits every homework question and never submits', async () => {
  const delays = [];
  const dom = page({ auto: true, autoSubmit: true, delays });
  const { document } = dom.window;
  const questions = document.querySelectorAll('.singleQuesId');
  const counts = [0, 0];
  questions.forEach((q, i) => q.querySelector('.num_option').addEventListener('click', () => counts[i]++));
  let submits = 0;
  const submit = document.createElement('a');
  submit.textContent = '交卷';
  submit.addEventListener('click', () => submits++);
  document.body.append(submit);
  document.querySelector('#ai-auto-start').click();
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.deepEqual(counts, [1, 1]);
  assert.equal(submits, 0);
  const answerDelay = delays.indexOf(800);
  assert.ok(answerDelay >= 0, `Expected 800 ms answer delay; got ${delays.join(', ')}`);
  assert.equal(delays[answerDelay + 1], 600);
});
