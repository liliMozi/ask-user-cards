# Ask User Cards

把请教做成一张安静的卡片。

打断式提问（弹窗、模态、追问刷屏）会抢走用户的焦点。这个配方给 Agent 另一种礼仪：把整组问题一次排好，铸成一张留在对话流里的卡片——不抢焦点、可跳过、可补充。用户什么时候答、答几题，都由用户决定；答完点一次提交，答案以 `ask-user-answers` 事件回到会话里叫醒 Agent。

## 卡片行为

- 一张卡 2–6 题，默认朝 3 题以内努力；整卡固定高度，一次一题，左右翻页。
- 题型三种：`single` 单选、`multi` 多选、`text` 自由文本；选项题可带 `hint` 说明代价或方向，可开 `allowNote` 留一个补充出口。
- 所有题都可跳过；内置「都交给你决定」一键全权委托。
- 底部圆点一身三职：位置、已答变绿、点击跳题；作答实时持久化到 card state。
- 提交后切换为答案摘要，同高不推挤对话流；可「修改答案」后再次提交。
- 在 Hana 之外（standalone）打开时，提交降级为「复制回答」，用户粘贴回对话即可。
- 所有交互在卡片本地完成，无网络请求；唯一出卡通道是提交时的那一次 emit。

## 使用

通过 Hana 的配方管理安装本目录或 `.recipe` 归档，也可以直接从市场安装。安装后不需要记任何命令——当 Agent 遇到「答案会实质影响产出方向」的时刻，会自己想到这张卡：

- 信息不全、且不同答案做出的是两样东西；
- 多个有界决策点可以一次收集；
- 语气 / 受众 / 篇幅 / 审美方向的校准；
- 删除、外发、覆盖等不可撤销动作之前的确认。

单个简单问题、查得到的事实、低风险的假设，都不会触发铸卡。

## 铸造契约

Agent 铸卡时向模板 `ask-user-cards/assets/ask-user.card.html` 传完整 state（整体替换模板默认快照）：

```json
{
  "uiLanguage": "zh",
  "title": "动手之前，想先问你三件事",
  "intro": "",
  "questions": [
    {
      "id": "audience",
      "text": "这篇内容主要写给谁看？",
      "type": "single",
      "allowNote": true,
      "options": [
        { "label": "泛读者", "hint": "多比喻少术语，重直觉与故事", "recommended": true },
        { "label": "同行开发者", "hint": "可以放开用术语，重架构与细节" }
      ]
    }
  ],
  "answers": {},
  "currentPage": 0,
  "submittedAt": null,
  "allDefault": false
}
```

字段含义与出题原则见 [SKILL.md](SKILL.md)。

## 提交事件

用户提交后，卡片 emit `ask-user-answers`，payload 形如：

```json
{
  "title": "…",
  "allDefault": false,
  "submittedAt": "…",
  "answers": {
    "audience": { "question": "…", "answer": "同行开发者", "note": "…", "skipped": false }
  }
}
```

用户可以「修改答案」后再次提交，以最新一次事件为准。

## 开发验证

使用 Node.js 24.15.0（或兼容的 Node 24）：

```sh
npm ci --ignore-scripts
npm test
```

GitHub Actions 运行相同检查。普通使用不需要安装这些开发依赖。

公开配方 ID 为 `ask-user-cards`。
