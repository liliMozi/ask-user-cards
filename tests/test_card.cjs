"use strict";

/*
 * Ask User Cards 行为测试：用 jsdom 加载真实模板，验证出题渲染、作答、
 * 翻页、standalone 复制降级、宿主 emit 提交与「都交给你决定」。
 * 不复述实现，只断言用户可观察的行为与事件契约。
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const TEMPLATE = path.join(__dirname, "..", "assets", "ask-user.card.html");
const html = fs.readFileSync(TEMPLATE, "utf8");

function flush(times = 6) {
  let p = Promise.resolve();
  for (let i = 0; i < times; i += 1) p = p.then(() => new Promise((r) => setTimeout(r, 0)));
  return p;
}

/** 宿主 mock：capabilities 全可用，state 用内存对象，emit/track 记录调用。 */
function makeHost(seed = {}) {
  const store = Object.assign({ answers: {}, submittedAt: null, allDefault: false, currentPage: 0 }, seed);
  const calls = { emit: [], track: [], set: [] };
  const card = {
    capabilities: () => Promise.resolve({
      ok: true,
      result: { capabilities: { emit: "available", state: "available", track: { status: "available" } } }
    }),
    state: {
      get: (key) => Promise.resolve({ ok: true, result: { value: store[key] } }),
      set: (key, value) => { store[key] = value; calls.set.push(key); return Promise.resolve({ ok: true }); }
    },
    emit: (name, payload) => { calls.emit.push({ name, payload }); return Promise.resolve({ ok: true }); },
    track: (name, data) => { calls.track.push({ name, data }); return Promise.resolve({ ok: true }); }
  };
  return { card, store, calls };
}

function boot(hostCard) {
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "https://card.local/",
    beforeParse(window) {
      if (hostCard) window.card = hostCard;
    }
  });
  return dom;
}

const visible = (el) => el && !el.classList.contains("ask-hidden");

async function test(name, fn) {
  try {
    await fn();
    console.log("ok - " + name);
  } catch (err) {
    console.error("FAIL - " + name);
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

(async () => {
  await test("standalone：渲染首题、三个圆点、上一题按钮隐藏", async () => {
    const dom = boot(null);
    await flush();
    const d = dom.window.document;
    assert.equal(d.getElementById("askTitle").textContent, "动手之前，想先问你三件事");
    assert.match(d.getElementById("askPage").textContent, /这篇内容主要写给谁看？/);
    assert.equal(d.querySelectorAll(".ask-dot").length, 3);
    assert.ok(d.getElementById("askPrevBtn").classList.contains("ask-ghost"));
    assert.equal(d.getElementById("askNextBtn").textContent, "下一题 ›");
    assert.ok(visible(d.getElementById("askPage")));
    dom.window.close();
  });

  await test("standalone：单选作答后圆点变绿，翻页往返答案保留", async () => {
    const dom = boot(null);
    await flush();
    const d = dom.window.document;
    const opt = d.querySelectorAll(".ask-opt")[1]; // 同行开发者
    opt.click();
    assert.equal(opt.getAttribute("aria-pressed"), "true");
    assert.ok(d.querySelectorAll(".ask-dot")[0].classList.contains("done"));

    d.getElementById("askNextBtn").click(); // 到第 2 题
    assert.match(d.getElementById("askPage").textContent, /希望从哪些角度切入？/);
    d.getElementById("askPrevBtn").click(); // 回第 1 题
    const again = d.querySelectorAll(".ask-opt")[1];
    assert.equal(again.getAttribute("aria-pressed"), "true");
    dom.window.close();
  });

  await test("standalone：末题提交降级为复制回答，文本含已选答案", async () => {
    const dom = boot(null);
    await flush();
    const d = dom.window.document;
    d.querySelectorAll(".ask-opt")[1].click(); // 同行开发者
    d.getElementById("askNextBtn").click(); // 第 2 题
    d.getElementById("askNextBtn").click(); // 第 3 题（末题）
    const next = d.getElementById("askNextBtn");
    assert.equal(next.textContent, "提交回答");
    next.click();
    await flush();
    assert.ok(visible(d.getElementById("askCopyZone")));
    const text = d.getElementById("askCopyText").value;
    assert.match(text, /同行开发者/);
    assert.match(text, /跳过/);
    dom.window.close();
  });

  await test("宿主：提交 emit ask-user-answers，payload 符合事件契约", async () => {
    const host = makeHost();
    const dom = boot(host.card);
    await flush();
    const d = dom.window.document;
    d.querySelectorAll(".ask-opt")[1].click(); // audience: 同行开发者
    d.getElementById("askNextBtn").click(); // 第 2 题
    d.querySelector(".ask-check input").click(); // angle: 勾选第一项
    d.getElementById("askNextBtn").click(); // 第 3 题
    d.getElementById("askNextBtn").click(); // 提交
    await flush();

    assert.equal(host.calls.emit.length, 1);
    const { name, payload } = host.calls.emit[0];
    assert.equal(name, "ask-user-answers");
    assert.equal(payload.allDefault, false);
    assert.ok(payload.submittedAt);
    assert.equal(payload.answers.audience.answer, "同行开发者");
    assert.equal(payload.answers.audience.skipped, false);
    // payload 在 jsdom realm 中构造，跨 realm 的 deepStrictEqual 会比较原型；按内容比对
    assert.ok(Array.isArray(payload.answers.angle.answer));
    assert.equal(payload.answers.angle.answer.join("、"), "设计理念");
    assert.equal(payload.answers.extra.skipped, true);
    // 提交后切到摘要面，表单与底栏收起
    assert.ok(visible(d.getElementById("askSummary")));
    assert.ok(!visible(d.getElementById("askPage")));
    assert.match(d.getElementById("askSubmittedBadge").textContent, /已提交/);
    // track 上报一次
    assert.equal(host.calls.track.length, 1);
    assert.equal(host.calls.track[0].name, "ask-user-submitted");
    dom.window.close();
  });

  await test("宿主：「都交给你决定」提交 allDefault，摘要如实显示", async () => {
    const host = makeHost();
    const dom = boot(host.card);
    await flush();
    const d = dom.window.document;
    d.getElementById("askNextBtn").click();
    d.getElementById("askNextBtn").click(); // 末题
    const deferBtn = d.querySelector(".ask-defer-block button");
    assert.ok(deferBtn, "末题应有全权委托按钮");
    deferBtn.click();
    await flush();
    assert.equal(host.calls.emit.length, 1);
    assert.equal(host.calls.emit[0].payload.allDefault, true);
    assert.match(d.getElementById("askSummary").textContent, /全部交给 Agent 决定了/);
    dom.window.close();
  });

  await test("宿主：恢复已持久化的作答与提交态，直接显示摘要", async () => {
    const host = makeHost({
      answers: { audience: { value: "潜在用户", note: "" } },
      submittedAt: "2026-10-07T12:00:00.000Z",
      allDefault: false,
      currentPage: 0
    });
    const dom = boot(host.card);
    await flush();
    const d = dom.window.document;
    assert.ok(visible(d.getElementById("askSummary")), "已提交的卡应直接展示摘要");
    assert.match(d.getElementById("askSummary").textContent, /潜在用户/);
    assert.match(d.getElementById("askSummary").textContent, /（跳过，交给 Agent 判断）/);
    dom.window.close();
  });

  await test("宿主：作答持久化写入 card state", async () => {
    const host = makeHost();
    const dom = boot(host.card);
    await flush();
    const d = dom.window.document;
    d.querySelectorAll(".ask-opt")[0].click();
    await flush();
    assert.ok(host.calls.set.includes("answers"));
    assert.equal(host.store.answers.audience.value, "对 AI 好奇的泛读者");
    dom.window.close();
  });

  if (process.exitCode) {
    console.error("\n有测试失败。");
  } else {
    console.log("\n全部 7 组行为检查通过。");
  }
})();
